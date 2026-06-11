import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const dotacaoSchema = z.object({
  loaId: z.string().uuid(),
  exercicio: z.coerce.number().int(),
  ficha: z.coerce.number().int(),
  orgaoId: z.string().uuid(),
  unidadeOrcamentariaId: z.string().uuid(),
  funcao: z.string().min(1),
  subfuncao: z.string().min(1),
  programaId: z.string().uuid().optional().nullable(),
  acaoId: z.string().uuid().optional().nullable(),
  categoriaEconomica: z.string().min(1),
  grupoDespesa: z.string().min(1),
  modalidadeAplicacao: z.string().min(1),
  elementoDespesa: z.string().min(1),
  fonteRecursoId: z.string().uuid(),
  valorInicial: z.coerce.number().min(0),
  ativo: z.boolean().optional(),
});

/** Anexa os campos calculados de saldo a uma dotacao. */
function comSaldos<T extends Record<string, unknown>>(dotacao: T) {
  const valorInicial = Number((dotacao as unknown as { valorInicial: Prisma.Decimal }).valorInicial);
  const valorAdicionado = Number((dotacao as unknown as { valorAdicionado: Prisma.Decimal }).valorAdicionado);
  const valorReduzido = Number((dotacao as unknown as { valorReduzido: Prisma.Decimal }).valorReduzido);
  const valorEmpenhado = Number((dotacao as unknown as { valorEmpenhado: Prisma.Decimal }).valorEmpenhado);
  const valorLiquidado = Number((dotacao as unknown as { valorLiquidado: Prisma.Decimal }).valorLiquidado);
  const valorPago = Number((dotacao as unknown as { valorPago: Prisma.Decimal }).valorPago);

  const valorAtualizado = valorInicial + valorAdicionado - valorReduzido;
  const saldoDisponivel = valorAtualizado - valorEmpenhado;

  return {
    ...dotacao,
    valorAtualizado,
    saldoDisponivel,
    saldoReservado: valorEmpenhado - valorLiquidado,
    saldoAPagar: valorLiquidado - valorPago,
  };
}

router.get("/", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, orgaoId, unidadeOrcamentariaId, fonteRecursoId, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(orgaoId ? { orgaoId: String(orgaoId) } : {}),
    ...(unidadeOrcamentariaId ? { unidadeOrcamentariaId: String(unidadeOrcamentariaId) } : {}),
    ...(fonteRecursoId ? { fonteRecursoId: String(fonteRecursoId) } : {}),
    ...(q
      ? {
          OR: [
            { elementoDespesa: { contains: String(q) } },
            { funcao: { contains: String(q) } },
            { subfuncao: { contains: String(q) } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.dotacao.findMany({
      where,
      include: { orgao: true, unidadeOrcamentaria: true, fonteRecurso: true, programa: true, acao: true },
      orderBy: { ficha: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.dotacao.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data.map(comSaldos), total, pagination));
});

router.get("/:id", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const dotacao = await prisma.dotacao.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { orgao: true, unidadeOrcamentaria: true, fonteRecurso: true, programa: true, acao: true },
  });
  if (!dotacao) throw AppError.notFound("Dotacao nao encontrada");
  res.json(comSaldos(dotacao));
});

router.post("/", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = dotacaoSchema.parse(req.body);

  const existente = await prisma.dotacao.findFirst({
    where: { entidadeId, exercicio: data.exercicio, ficha: data.ficha, deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe uma dotacao com esta ficha neste exercicio");

  const dotacao = await prisma.$transaction(async (tx) => {
    const criada = await tx.dotacao.create({ data: { ...data, entidadeId } });
    await tx.loa.update({
      where: { id: data.loaId },
      data: { valorTotalDespesa: { increment: data.valorInicial } },
    });
    return criada;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_DOTACAO",
    entidadeAfetada: "dotacoes",
    registroId: dotacao.id,
    dadosNovos: dotacao,
  });

  res.status(201).json(comSaldos(dotacao));
});

router.put("/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = dotacaoSchema.partial().parse(req.body);

  const atual = await prisma.dotacao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Dotacao nao encontrada");

  const dotacao = await prisma.dotacao.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_DOTACAO",
    entidadeAfetada: "dotacoes",
    registroId: dotacao.id,
    dadosAnteriores: atual,
    dadosNovos: dotacao,
  });

  res.json(comSaldos(dotacao));
});

router.delete("/:id", requirePermissao("ORCAMENTO", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.dotacao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Dotacao nao encontrada");

  if (Number(atual.valorEmpenhado) > 0) {
    throw AppError.badRequest("Nao e possivel excluir dotacao com empenhos vinculados");
  }

  const dotacao = await prisma.dotacao.update({
    where: { id: atual.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "ORCAMENTO_DOTACAO",
    entidadeAfetada: "dotacoes",
    registroId: dotacao.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
