import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const ldoSchema = z.object({
  exercicio: z.coerce.number().int(),
  lei: z.string().optional().nullable(),
  dataAprovacao: z.coerce.date().optional().nullable(),
  ativo: z.boolean().optional(),
});

const metaFiscalSchema = z.object({
  ano: z.coerce.number().int(),
  descricao: z.string().min(2),
  valorPrevisto: z.coerce.number(),
});

const prioridadeSchema = z.object({
  ordem: z.coerce.number().int(),
  descricao: z.string().min(2),
});

router.get("/", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const ldos = await prisma.ldo.findMany({
    where: { entidadeId, deletedAt: null },
    include: { metasFiscais: true, prioridades: { orderBy: { ordem: "asc" } } },
    orderBy: { exercicio: "desc" },
  });
  res.json({ data: ldos });
});

router.post("/", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = ldoSchema.parse(req.body);

  const existente = await prisma.ldo.findFirst({ where: { entidadeId, exercicio: data.exercicio, deletedAt: null } });
  if (existente) throw AppError.conflict("Ja existe LDO cadastrada para este exercicio");

  const ldo = await prisma.ldo.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_LDO",
    entidadeAfetada: "ldos",
    registroId: ldo.id,
    dadosNovos: ldo,
  });

  res.status(201).json(ldo);
});

router.put("/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = ldoSchema.partial().parse(req.body);
  const atual = await prisma.ldo.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("LDO nao encontrada");

  const ldo = await prisma.ldo.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_LDO",
    entidadeAfetada: "ldos",
    registroId: ldo.id,
    dadosAnteriores: atual,
    dadosNovos: ldo,
  });

  res.json(ldo);
});

router.post("/:ldoId/metas-fiscais", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const ldo = await prisma.ldo.findFirst({ where: { id: req.params.ldoId, deletedAt: null } });
  if (!ldo) throw AppError.notFound("LDO nao encontrada");

  const data = metaFiscalSchema.parse(req.body);
  const meta = await prisma.ldoMetaFiscal.create({ data: { ...data, ldoId: ldo.id } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_LDO_META_FISCAL",
    entidadeAfetada: "ldo_metas_fiscais",
    registroId: meta.id,
    dadosNovos: meta,
  });

  res.status(201).json(meta);
});

router.post("/:ldoId/prioridades", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const ldo = await prisma.ldo.findFirst({ where: { id: req.params.ldoId, deletedAt: null } });
  if (!ldo) throw AppError.notFound("LDO nao encontrada");

  const data = prioridadeSchema.parse(req.body);
  const prioridade = await prisma.ldoPrioridade.create({ data: { ...data, ldoId: ldo.id } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_LDO_PRIORIDADE",
    entidadeAfetada: "ldo_prioridades",
    registroId: prioridade.id,
    dadosNovos: prioridade,
  });

  res.status(201).json(prioridade);
});

export default router;
