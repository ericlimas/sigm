import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const MODALIDADES = ["DISPENSA", "INEXIGIBILIDADE", "PREGAO", "CONCORRENCIA", "CREDENCIAMENTO", "CONCURSO", "LEILAO"] as const;
const STATUS = ["EM_ANDAMENTO", "HOMOLOGADA", "FRACASSADA", "DESERTA", "REVOGADA", "ANULADA"] as const;

const licitacaoSchema = z.object({
  exercicio: z.coerce.number().int(),
  numero: z.string().min(1),
  modalidade: z.enum(MODALIDADES),
  objeto: z.string().min(3),
  processo: z.string().optional().nullable(),
  dataAbertura: z.coerce.date(),
  valorEstimado: z.coerce.number().min(0).default(0),
  valorHomologado: z.coerce.number().min(0).default(0),
  status: z.enum(STATUS).default("EM_ANDAMENTO"),
});

const itemSchema = z.object({
  item: z.coerce.number().int().positive(),
  descricao: z.string().min(1),
  unidade: z.string().min(1),
  quantidade: z.coerce.number().positive(),
  valorEstimado: z.coerce.number().min(0),
  vencedorCredorId: z.string().uuid().optional().nullable(),
  valorVencedor: z.coerce.number().min(0).optional().nullable(),
});

router.get("/", requirePermissao("LICITACOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, modalidade, status, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(modalidade ? { modalidade: modalidade as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: String(q), mode: "insensitive" as const } },
            { objeto: { contains: String(q), mode: "insensitive" as const } },
            { processo: { contains: String(q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.licitacao.findMany({
      where,
      include: { itens: true, contratos: true },
      orderBy: [{ exercicio: "desc" }, { numero: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.licitacao.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("LICITACOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const licitacao = await prisma.licitacao.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { itens: { include: { vencedorCredor: true }, orderBy: { item: "asc" } }, contratos: true },
  });
  if (!licitacao) throw AppError.notFound("Licitacao nao encontrada");
  res.json(licitacao);
});

router.post("/", requirePermissao("LICITACOES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = licitacaoSchema.parse(req.body);

  const existente = await prisma.licitacao.findFirst({
    where: { entidadeId, exercicio: data.exercicio, numero: data.numero, deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe uma licitacao com este numero neste exercicio");

  const licitacao = await prisma.licitacao.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "LICITACOES",
    entidadeAfetada: "licitacoes",
    registroId: licitacao.id,
    dadosNovos: licitacao,
  });

  res.status(201).json(licitacao);
});

router.put("/:id", requirePermissao("LICITACOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = licitacaoSchema.partial().parse(req.body);

  const existente = await prisma.licitacao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Licitacao nao encontrada");

  const licitacao = await prisma.licitacao.update({ where: { id: existente.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "LICITACOES",
    entidadeAfetada: "licitacoes",
    registroId: licitacao.id,
    dadosAnteriores: existente,
    dadosNovos: licitacao,
  });

  res.json(licitacao);
});

router.delete("/:id", requirePermissao("LICITACOES", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const existente = await prisma.licitacao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Licitacao nao encontrada");

  await prisma.licitacao.update({ where: { id: existente.id }, data: { deletedAt: new Date() } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "LICITACOES",
    entidadeAfetada: "licitacoes",
    registroId: existente.id,
    dadosAnteriores: existente,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Itens da licitacao
// ---------------------------------------------------------------------------

router.post("/:id/itens", requirePermissao("LICITACOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = itemSchema.parse(req.body);

  const licitacao = await prisma.licitacao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!licitacao) throw AppError.notFound("Licitacao nao encontrada");

  const item = await prisma.licitacaoItem.create({ data: { ...data, licitacaoId: licitacao.id } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "LICITACOES",
    entidadeAfetada: "licitacao_itens",
    registroId: item.id,
    dadosNovos: item,
  });

  res.status(201).json(item);
});

router.put("/itens/:itemId", requirePermissao("LICITACOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = itemSchema.partial().parse(req.body);

  const item = await prisma.licitacaoItem.findFirst({
    where: { id: req.params.itemId, licitacao: { entidadeId, deletedAt: null } },
  });
  if (!item) throw AppError.notFound("Item nao encontrado");

  const atualizado = await prisma.licitacaoItem.update({ where: { id: item.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "LICITACOES",
    entidadeAfetada: "licitacao_itens",
    registroId: atualizado.id,
    dadosAnteriores: item,
    dadosNovos: atualizado,
  });

  res.json(atualizado);
});

export default router;
