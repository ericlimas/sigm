import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

// ---------------------------------------------------------------------------
// TABELA INSS (faixas progressivas por vigencia)
// ---------------------------------------------------------------------------

const inssFaixaSchema = z.object({
  vigenciaInicio: z.coerce.date(),
  vigenciaFim: z.coerce.date().optional().nullable(),
  faixaInicial: z.coerce.number().min(0),
  faixaFinal: z.coerce.number().min(0).optional().nullable(),
  aliquota: z.coerce.number().min(0).max(100),
  parcelaDeduzir: z.coerce.number().min(0).default(0),
  tetoPrevidenciario: z.coerce.number().min(0),
  ativo: z.boolean().optional(),
});

router.get("/inss", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const faixas = await prisma.tabelaInssFaixa.findMany({
    where: { entidadeId },
    orderBy: [{ vigenciaInicio: "desc" }, { faixaInicial: "asc" }],
  });
  res.json({ data: faixas });
});

router.post("/inss", requirePermissao("RETENCOES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = inssFaixaSchema.parse(req.body);

  const faixa = await prisma.tabelaInssFaixa.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req, acao: "CREATE", modulo: "RETENCOES", entidadeAfetada: "tabela_inss_faixas",
    registroId: faixa.id, dadosNovos: faixa,
  });

  res.status(201).json(faixa);
});

router.put("/inss/:id", requirePermissao("RETENCOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = inssFaixaSchema.partial().parse(req.body);

  const atual = await prisma.tabelaInssFaixa.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Faixa de INSS nao encontrada");

  const faixa = await prisma.tabelaInssFaixa.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req, acao: "UPDATE", modulo: "RETENCOES", entidadeAfetada: "tabela_inss_faixas",
    registroId: faixa.id, dadosAnteriores: atual, dadosNovos: faixa,
  });

  res.json(faixa);
});

router.delete("/inss/:id", requirePermissao("RETENCOES", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.tabelaInssFaixa.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Faixa de INSS nao encontrada");

  await prisma.tabelaInssFaixa.delete({ where: { id: atual.id } });

  await registrarAuditoria({
    req, acao: "DELETE", modulo: "RETENCOES", entidadeAfetada: "tabela_inss_faixas",
    registroId: atual.id, dadosAnteriores: atual,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// TABELA IRRF (faixas progressivas por vigencia)
// ---------------------------------------------------------------------------

const irrfFaixaSchema = z.object({
  vigenciaInicio: z.coerce.date(),
  vigenciaFim: z.coerce.date().optional().nullable(),
  baseInicial: z.coerce.number().min(0),
  baseFinal: z.coerce.number().min(0).optional().nullable(),
  aliquota: z.coerce.number().min(0).max(100),
  parcelaDeduzir: z.coerce.number().min(0).default(0),
  ativo: z.boolean().optional(),
});

router.get("/irrf", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const faixas = await prisma.tabelaIrrfFaixa.findMany({
    where: { entidadeId },
    orderBy: [{ vigenciaInicio: "desc" }, { baseInicial: "asc" }],
  });
  res.json({ data: faixas });
});

router.post("/irrf", requirePermissao("RETENCOES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = irrfFaixaSchema.parse(req.body);

  const faixa = await prisma.tabelaIrrfFaixa.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req, acao: "CREATE", modulo: "RETENCOES", entidadeAfetada: "tabela_irrf_faixas",
    registroId: faixa.id, dadosNovos: faixa,
  });

  res.status(201).json(faixa);
});

router.put("/irrf/:id", requirePermissao("RETENCOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = irrfFaixaSchema.partial().parse(req.body);

  const atual = await prisma.tabelaIrrfFaixa.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Faixa de IRRF nao encontrada");

  const faixa = await prisma.tabelaIrrfFaixa.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req, acao: "UPDATE", modulo: "RETENCOES", entidadeAfetada: "tabela_irrf_faixas",
    registroId: faixa.id, dadosAnteriores: atual, dadosNovos: faixa,
  });

  res.json(faixa);
});

router.delete("/irrf/:id", requirePermissao("RETENCOES", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.tabelaIrrfFaixa.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Faixa de IRRF nao encontrada");

  await prisma.tabelaIrrfFaixa.delete({ where: { id: atual.id } });

  await registrarAuditoria({
    req, acao: "DELETE", modulo: "RETENCOES", entidadeAfetada: "tabela_irrf_faixas",
    registroId: atual.id, dadosAnteriores: atual,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// DEDUCAO POR DEPENDENTE (IRRF) por vigencia
// ---------------------------------------------------------------------------

const irrfDeducaoSchema = z.object({
  vigenciaInicio: z.coerce.date(),
  vigenciaFim: z.coerce.date().optional().nullable(),
  valorPorDependente: z.coerce.number().min(0),
  limiteFaixa1: z.coerce.number().min(0).optional().nullable(),
  reducaoMaxima: z.coerce.number().min(0).optional().nullable(),
  limiteFaixa2: z.coerce.number().min(0).optional().nullable(),
  constanteReducao: z.coerce.number().min(0).optional().nullable(),
  coeficienteReducao: z.coerce.number().min(0).optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get("/irrf-deducoes", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const deducoes = await prisma.tabelaIrrfDeducao.findMany({
    where: { entidadeId },
    orderBy: { vigenciaInicio: "desc" },
  });
  res.json({ data: deducoes });
});

router.post("/irrf-deducoes", requirePermissao("RETENCOES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = irrfDeducaoSchema.parse(req.body);

  const deducao = await prisma.tabelaIrrfDeducao.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req, acao: "CREATE", modulo: "RETENCOES", entidadeAfetada: "tabela_irrf_deducoes",
    registroId: deducao.id, dadosNovos: deducao,
  });

  res.status(201).json(deducao);
});

router.put("/irrf-deducoes/:id", requirePermissao("RETENCOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = irrfDeducaoSchema.partial().parse(req.body);

  const atual = await prisma.tabelaIrrfDeducao.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Deducao de IRRF nao encontrada");

  const deducao = await prisma.tabelaIrrfDeducao.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req, acao: "UPDATE", modulo: "RETENCOES", entidadeAfetada: "tabela_irrf_deducoes",
    registroId: deducao.id, dadosAnteriores: atual, dadosNovos: deducao,
  });

  res.json(deducao);
});

router.delete("/irrf-deducoes/:id", requirePermissao("RETENCOES", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.tabelaIrrfDeducao.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Deducao de IRRF nao encontrada");

  await prisma.tabelaIrrfDeducao.delete({ where: { id: atual.id } });

  await registrarAuditoria({
    req, acao: "DELETE", modulo: "RETENCOES", entidadeAfetada: "tabela_irrf_deducoes",
    registroId: atual.id, dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
