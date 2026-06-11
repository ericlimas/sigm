import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const naturezaSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  codigoReceita: z.string().optional().nullable(),
  contaContabilId: z.string().uuid().optional().nullable(),
  percentualInss: z.coerce.number().min(0).max(100).default(11),
  sujeitoInss: z.boolean().optional(),
  sujeitoIrrf: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

router.get("/", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const naturezas = await prisma.naturezaServico.findMany({
    where: { entidadeId, deletedAt: null } as never,
    include: { contaContabil: true },
    orderBy: { codigo: "asc" },
  });
  res.json({ data: naturezas });
});

router.post("/", requirePermissao("RETENCOES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = naturezaSchema.parse(req.body);

  const natureza = await prisma.naturezaServico.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "NATUREZAS_SERVICO",
    entidadeAfetada: "naturezas_servico",
    registroId: natureza.id,
    dadosNovos: natureza,
  });

  res.status(201).json(natureza);
});

router.put("/:id", requirePermissao("RETENCOES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = naturezaSchema.partial().parse(req.body);

  const atual = await prisma.naturezaServico.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Natureza de servico nao encontrada");

  const natureza = await prisma.naturezaServico.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "NATUREZAS_SERVICO",
    entidadeAfetada: "naturezas_servico",
    registroId: natureza.id,
    dadosAnteriores: atual,
    dadosNovos: natureza,
  });

  res.json(natureza);
});

router.delete("/:id", requirePermissao("RETENCOES", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.naturezaServico.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!atual) throw AppError.notFound("Natureza de servico nao encontrada");

  const natureza = await prisma.naturezaServico.update({
    where: { id: atual.id },
    data: { ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "NATUREZAS_SERVICO",
    entidadeAfetada: "naturezas_servico",
    registroId: natureza.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
