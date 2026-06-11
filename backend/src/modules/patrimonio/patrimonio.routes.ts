import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const CATEGORIAS = ["MOVEL", "IMOVEL", "VEICULO", "EQUIPAMENTO_TI", "OUTROS"] as const;
const STATUS = ["ATIVO", "TRANSFERIDO", "BAIXADO", "EM_MANUTENCAO"] as const;
const TIPOS_MOVIMENTACAO = ["AQUISICAO", "TRANSFERENCIA", "BAIXA", "DEPRECIACAO", "REAVALIACAO"] as const;

const bemSchema = z.object({
  numeroTombamento: z.string().min(1),
  descricao: z.string().min(2),
  categoria: z.enum(CATEGORIAS),
  dataAquisicao: z.coerce.date(),
  valorAquisicao: z.coerce.number().positive(),
  valorAtual: z.coerce.number().min(0).optional(),
  vidaUtilAnos: z.coerce.number().int().positive().optional().nullable(),
  taxaDepreciacaoAnual: z.coerce.number().min(0).max(100).optional().nullable(),
  localizacao: z.string().optional().nullable(),
  responsavelCredorId: z.string().uuid().optional().nullable(),
  status: z.enum(STATUS).default("ATIVO"),
});

const movimentacaoSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMENTACAO),
  data: z.coerce.date(),
  valor: z.coerce.number().optional().nullable(),
  localOrigem: z.string().optional().nullable(),
  localDestino: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
});

router.get("/bens", requirePermissao("PATRIMONIO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { categoria, status, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(categoria ? { categoria: categoria as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { numeroTombamento: { contains: String(q), mode: "insensitive" as const } },
            { descricao: { contains: String(q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.bem.findMany({
      where,
      include: { responsavelCredor: true },
      orderBy: { numeroTombamento: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.bem.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/bens/:id", requirePermissao("PATRIMONIO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const bem = await prisma.bem.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { responsavelCredor: true, movimentacoes: { orderBy: { data: "desc" } } },
  });
  if (!bem) throw AppError.notFound("Bem patrimonial nao encontrado");
  res.json(bem);
});

router.post("/bens", requirePermissao("PATRIMONIO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = bemSchema.parse(req.body);

  const existente = await prisma.bem.findFirst({
    where: { entidadeId, numeroTombamento: data.numeroTombamento, deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe um bem com este numero de tombamento");

  const bem = await prisma.bem.create({
    data: { ...data, entidadeId, valorAtual: data.valorAtual ?? data.valorAquisicao },
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "PATRIMONIO",
    entidadeAfetada: "bens",
    registroId: bem.id,
    dadosNovos: bem,
  });

  res.status(201).json(bem);
});

router.put("/bens/:id", requirePermissao("PATRIMONIO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = bemSchema.partial().parse(req.body);

  const existente = await prisma.bem.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Bem patrimonial nao encontrado");

  const bem = await prisma.bem.update({ where: { id: existente.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "PATRIMONIO",
    entidadeAfetada: "bens",
    registroId: bem.id,
    dadosAnteriores: existente,
    dadosNovos: bem,
  });

  res.json(bem);
});

router.delete("/bens/:id", requirePermissao("PATRIMONIO", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const existente = await prisma.bem.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Bem patrimonial nao encontrado");

  await prisma.bem.update({ where: { id: existente.id }, data: { deletedAt: new Date() } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "PATRIMONIO",
    entidadeAfetada: "bens",
    registroId: existente.id,
    dadosAnteriores: existente,
  });

  res.status(204).send();
});

// POST /bens/:id/movimentacoes - registra transferencia/baixa/depreciacao/reavaliacao
router.post("/bens/:id/movimentacoes", requirePermissao("PATRIMONIO", "EDITAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const data = movimentacaoSchema.parse(req.body);

  const bem = await prisma.bem.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!bem) throw AppError.notFound("Bem patrimonial nao encontrado");

  const atualizacao: Record<string, unknown> = {};
  if (data.tipo === "BAIXA") atualizacao.status = "BAIXADO";
  if (data.tipo === "TRANSFERENCIA") {
    atualizacao.status = "TRANSFERIDO";
    if (data.localDestino) atualizacao.localizacao = data.localDestino;
  }
  if ((data.tipo === "DEPRECIACAO" || data.tipo === "REAVALIACAO") && data.valor !== undefined && data.valor !== null) {
    atualizacao.valorAtual =
      data.tipo === "DEPRECIACAO" ? Math.max(0, Number(bem.valorAtual) - data.valor) : data.valor;
  }

  const movimentacao = await prisma.$transaction(async (tx) => {
    const criada = await tx.bemMovimentacao.create({ data: { ...data, bemId: bem.id, usuarioId } });
    if (Object.keys(atualizacao).length > 0) {
      await tx.bem.update({ where: { id: bem.id }, data: atualizacao });
    }
    return criada;
  });

  await registrarAuditoria({
    req,
    acao: "MOVIMENTACAO_BEM",
    modulo: "PATRIMONIO",
    entidadeAfetada: "bem_movimentacoes",
    registroId: movimentacao.id,
    dadosNovos: movimentacao,
  });

  res.status(201).json(movimentacao);
});

export default router;
