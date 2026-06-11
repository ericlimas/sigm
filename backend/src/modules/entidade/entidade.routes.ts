import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const configuracaoSchema = z.object({
  ordenadorNome: z.string().trim().optional().nullable(),
  ordenadorCpf: z.string().trim().optional().nullable(),
  ordenadorCargo: z.string().trim().optional().nullable(),
  contadorNome: z.string().trim().optional().nullable(),
  contadorDocumento: z.string().trim().optional().nullable(),
  contadorCargo: z.string().trim().optional().nullable(),
  diretorFinanceiroNome: z.string().trim().optional().nullable(),
  diretorFinanceiroCpf: z.string().trim().optional().nullable(),
  diretorFinanceiroCargo: z.string().trim().optional().nullable(),
});

// GET /entidade/configuracao - dados dos responsaveis impressos na Nota de Empenho
router.get("/configuracao", requirePermissao("USUARIOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;

  const entidade = await prisma.entidade.findUnique({
    where: { id: entidadeId },
    select: {
      ordenadorNome: true,
      ordenadorCpf: true,
      ordenadorCargo: true,
      contadorNome: true,
      contadorDocumento: true,
      contadorCargo: true,
      diretorFinanceiroNome: true,
      diretorFinanceiroCpf: true,
      diretorFinanceiroCargo: true,
    },
  });
  if (!entidade) throw AppError.notFound("Entidade nao encontrada");

  res.json(entidade);
});

// PUT /entidade/configuracao - atualiza os responsaveis impressos na Nota de Empenho
router.put("/configuracao", requirePermissao("USUARIOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = configuracaoSchema.parse(req.body);

  const anterior = await prisma.entidade.findUnique({
    where: { id: entidadeId },
    select: {
      ordenadorNome: true,
      ordenadorCpf: true,
      ordenadorCargo: true,
      contadorNome: true,
      contadorDocumento: true,
      contadorCargo: true,
      diretorFinanceiroNome: true,
      diretorFinanceiroCpf: true,
      diretorFinanceiroCargo: true,
    },
  });
  if (!anterior) throw AppError.notFound("Entidade nao encontrada");

  const atualizado = await prisma.entidade.update({
    where: { id: entidadeId },
    data,
    select: {
      ordenadorNome: true,
      ordenadorCpf: true,
      ordenadorCargo: true,
      contadorNome: true,
      contadorDocumento: true,
      contadorCargo: true,
      diretorFinanceiroNome: true,
      diretorFinanceiroCpf: true,
      diretorFinanceiroCargo: true,
    },
  });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "USUARIOS",
    entidadeAfetada: "entidades",
    registroId: entidadeId,
    dadosAnteriores: anterior,
    dadosNovos: atualizado,
  });

  res.json(atualizado);
});

export default router;
