import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const ppaSchema = z.object({
  anoInicio: z.coerce.number().int(),
  anoFim: z.coerce.number().int(),
  lei: z.string().optional().nullable(),
  dataAprovacao: z.coerce.date().optional().nullable(),
  ativo: z.boolean().optional(),
});

const programaSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(2),
  objetivo: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

const acaoSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(2),
  tipo: z.enum(["PROJETO", "ATIVIDADE", "OPERACAO_ESPECIAL"]),
  metaFisica: z.string().optional().nullable(),
  unidadeMedida: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

// PPA --------------------------------------------------------------------

router.get("/", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const ppas = await prisma.ppa.findMany({
    where: { entidadeId, deletedAt: null },
    include: { programas: { include: { acoes: true } } },
    orderBy: { anoInicio: "desc" },
  });
  res.json({ data: ppas });
});

router.post("/", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = ppaSchema.parse(req.body);
  const ppa = await prisma.ppa.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_PPA",
    entidadeAfetada: "ppas",
    registroId: ppa.id,
    dadosNovos: ppa,
  });

  res.status(201).json(ppa);
});

router.put("/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = ppaSchema.partial().parse(req.body);
  const atual = await prisma.ppa.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("PPA nao encontrado");

  const ppa = await prisma.ppa.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_PPA",
    entidadeAfetada: "ppas",
    registroId: ppa.id,
    dadosAnteriores: atual,
    dadosNovos: ppa,
  });

  res.json(ppa);
});

// Programas ----------------------------------------------------------------

router.post("/:ppaId/programas", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const ppa = await prisma.ppa.findFirst({ where: { id: req.params.ppaId, entidadeId, deletedAt: null } });
  if (!ppa) throw AppError.notFound("PPA nao encontrado");

  const data = programaSchema.parse(req.body);
  const programa = await prisma.ppaPrograma.create({ data: { ...data, ppaId: ppa.id } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_PPA_PROGRAMA",
    entidadeAfetada: "ppa_programas",
    registroId: programa.id,
    dadosNovos: programa,
  });

  res.status(201).json(programa);
});

router.put("/programas/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const data = programaSchema.partial().parse(req.body);
  const atual = await prisma.ppaPrograma.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!atual) throw AppError.notFound("Programa nao encontrado");

  const programa = await prisma.ppaPrograma.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_PPA_PROGRAMA",
    entidadeAfetada: "ppa_programas",
    registroId: programa.id,
    dadosAnteriores: atual,
    dadosNovos: programa,
  });

  res.json(programa);
});

// Acoes ----------------------------------------------------------------------

router.post("/programas/:programaId/acoes", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const programa = await prisma.ppaPrograma.findFirst({ where: { id: req.params.programaId, deletedAt: null } });
  if (!programa) throw AppError.notFound("Programa nao encontrado");

  const data = acaoSchema.parse(req.body);
  const acao = await prisma.ppaAcao.create({ data: { ...data, programaId: programa.id } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_PPA_ACAO",
    entidadeAfetada: "ppa_acoes",
    registroId: acao.id,
    dadosNovos: acao,
  });

  res.status(201).json(acao);
});

router.put("/acoes/:id", requirePermissao("ORCAMENTO", "EDITAR"), async (req, res) => {
  const data = acaoSchema.partial().parse(req.body);
  const atual = await prisma.ppaAcao.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!atual) throw AppError.notFound("Acao nao encontrada");

  const acao = await prisma.ppaAcao.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORCAMENTO_PPA_ACAO",
    entidadeAfetada: "ppa_acoes",
    registroId: acao.id,
    dadosAnteriores: atual,
    dadosNovos: acao,
  });

  res.json(acao);
});

export default router;
