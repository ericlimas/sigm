import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const orgaoSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(2),
  tipo: z.enum(["ORGAO", "SECRETARIA", "FUNDO", "AUTARQUIA", "FUNDACAO", "PODER_LEGISLATIVO"]),
  orgaoSuperiorId: z.string().uuid().optional().nullable(),
  ativo: z.boolean().optional(),
});

const unidadeSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(2),
  orgaoId: z.string().uuid(),
  ativo: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// ORGAOS / SECRETARIAS / FUNDOS / AUTARQUIAS
// ---------------------------------------------------------------------------

router.get("/", requirePermissao("ORGAOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { q, tipo, ativo } = req.query;

  const orgaos = await prisma.orgao.findMany({
    where: {
      entidadeId,
      deletedAt: null,
      ...(tipo ? { tipo: tipo as never } : {}),
      ...(ativo !== undefined ? { ativo: ativo === "true" } : {}),
      ...(q
        ? {
            OR: [
              { nome: { contains: String(q), mode: "insensitive" as const } },
              { codigo: { contains: String(q) } },
            ],
          }
        : {}),
    },
    include: { unidadesOrcamentarias: true, orgaoSuperior: true },
    orderBy: { codigo: "asc" },
  });

  res.json({ data: orgaos });
});

router.get("/:id", requirePermissao("ORGAOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const orgao = await prisma.orgao.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { unidadesOrcamentarias: true },
  });
  if (!orgao) throw AppError.notFound("Orgao nao encontrado");
  res.json(orgao);
});

router.post("/", requirePermissao("ORGAOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = orgaoSchema.parse(req.body);

  const orgao = await prisma.orgao.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORGAOS",
    entidadeAfetada: "orgaos",
    registroId: orgao.id,
    dadosNovos: orgao,
  });

  res.status(201).json(orgao);
});

router.put("/:id", requirePermissao("ORGAOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = orgaoSchema.partial().parse(req.body);

  const atual = await prisma.orgao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Orgao nao encontrado");

  const orgao = await prisma.orgao.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ORGAOS",
    entidadeAfetada: "orgaos",
    registroId: orgao.id,
    dadosAnteriores: atual,
    dadosNovos: orgao,
  });

  res.json(orgao);
});

router.delete("/:id", requirePermissao("ORGAOS", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.orgao.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Orgao nao encontrado");

  const orgao = await prisma.orgao.update({
    where: { id: atual.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "ORGAOS",
    entidadeAfetada: "orgaos",
    registroId: orgao.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// UNIDADES ORCAMENTARIAS
// ---------------------------------------------------------------------------

router.get("/unidades/listar", requirePermissao("ORGAOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { orgaoId } = req.query;

  const unidades = await prisma.unidadeOrcamentaria.findMany({
    where: {
      entidadeId,
      deletedAt: null,
      ...(orgaoId ? { orgaoId: String(orgaoId) } : {}),
    },
    include: { orgao: true },
    orderBy: { codigo: "asc" },
  });

  res.json({ data: unidades });
});

router.post("/unidades", requirePermissao("ORGAOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = unidadeSchema.parse(req.body);

  const unidade = await prisma.unidadeOrcamentaria.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "UNIDADES_ORCAMENTARIAS",
    entidadeAfetada: "unidades_orcamentarias",
    registroId: unidade.id,
    dadosNovos: unidade,
  });

  res.status(201).json(unidade);
});

router.put("/unidades/:id", requirePermissao("ORGAOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = unidadeSchema.partial().parse(req.body);

  const atual = await prisma.unidadeOrcamentaria.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!atual) throw AppError.notFound("Unidade orcamentaria nao encontrada");

  const unidade = await prisma.unidadeOrcamentaria.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "UNIDADES_ORCAMENTARIAS",
    entidadeAfetada: "unidades_orcamentarias",
    registroId: unidade.id,
    dadosAnteriores: atual,
    dadosNovos: unidade,
  });

  res.json(unidade);
});

router.delete("/unidades/:id", requirePermissao("ORGAOS", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.unidadeOrcamentaria.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!atual) throw AppError.notFound("Unidade orcamentaria nao encontrada");

  const unidade = await prisma.unidadeOrcamentaria.update({
    where: { id: atual.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "UNIDADES_ORCAMENTARIAS",
    entidadeAfetada: "unidades_orcamentarias",
    registroId: unidade.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
