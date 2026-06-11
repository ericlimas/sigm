import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const loaSchema = z.object({
  exercicio: z.coerce.number().int(),
  lei: z.string().optional().nullable(),
  dataAprovacao: z.coerce.date().optional().nullable(),
  ativo: z.boolean().optional(),
});

const receitaPrevistaSchema = z.object({
  codigoReceita: z.string().min(1),
  descricao: z.string().min(2),
  categoria: z
    .enum(["IPTU", "ISS", "ITBI", "TAXAS", "CONVENIO", "TRANSFERENCIA", "OUTRAS"])
    .default("OUTRAS"),
  valorPrevisto: z.coerce.number(),
});

router.get("/", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const loas = await prisma.loa.findMany({
    where: { entidadeId, deletedAt: null },
    orderBy: { exercicio: "desc" },
  });
  res.json({ data: loas });
});

router.get("/:id", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const loa = await prisma.loa.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { receitasPrevistas: true },
  });
  if (!loa) throw AppError.notFound("LOA nao encontrada");
  res.json(loa);
});

router.post("/", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = loaSchema.parse(req.body);

  const existente = await prisma.loa.findFirst({ where: { entidadeId, exercicio: data.exercicio, deletedAt: null } });
  if (existente) throw AppError.conflict("Ja existe LOA cadastrada para este exercicio");

  const loa = await prisma.loa.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_LOA",
    entidadeAfetada: "loas",
    registroId: loa.id,
    dadosNovos: loa,
  });

  res.status(201).json(loa);
});

router.put("/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = loaSchema.partial().parse(req.body);
  const atual = await prisma.loa.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("LOA nao encontrada");

  const loa = await prisma.loa.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_LOA",
    entidadeAfetada: "loas",
    registroId: loa.id,
    dadosAnteriores: atual,
    dadosNovos: loa,
  });

  res.json(loa);
});

// Receitas previstas ---------------------------------------------------------

router.post("/:loaId/receitas-previstas", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const loa = await prisma.loa.findFirst({ where: { id: req.params.loaId, entidadeId, deletedAt: null } });
  if (!loa) throw AppError.notFound("LOA nao encontrada");

  const data = receitaPrevistaSchema.parse(req.body);

  const receita = await prisma.receitaPrevista.create({
    data: {
      ...data,
      valorPrevisto: data.valorPrevisto,
      valorAtualizado: data.valorPrevisto,
      loaId: loa.id,
    },
  });

  await prisma.loa.update({
    where: { id: loa.id },
    data: { valorTotalReceita: { increment: data.valorPrevisto } },
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_LOA_RECEITA_PREVISTA",
    entidadeAfetada: "receitas_previstas",
    registroId: receita.id,
    dadosNovos: receita,
  });

  res.status(201).json(receita);
});

router.put("/receitas-previstas/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const data = receitaPrevistaSchema.partial().parse(req.body);

  const atual = await prisma.receitaPrevista.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!atual) throw AppError.notFound("Receita prevista nao encontrada");

  const receita = await prisma.receitaPrevista.update({
    where: { id: atual.id },
    data: {
      ...data,
      valorAtualizado: data.valorPrevisto !== undefined ? data.valorPrevisto : undefined,
    },
  });

  if (data.valorPrevisto !== undefined) {
    const diferenca = Number(data.valorPrevisto) - Number(atual.valorPrevisto);
    await prisma.loa.update({
      where: { id: atual.loaId },
      data: { valorTotalReceita: { increment: diferenca } },
    });
  }

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_LOA_RECEITA_PREVISTA",
    entidadeAfetada: "receitas_previstas",
    registroId: receita.id,
    dadosAnteriores: atual,
    dadosNovos: receita,
  });

  res.json(receita);
});

export default router;
