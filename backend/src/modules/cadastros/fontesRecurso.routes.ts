import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const fonteSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  especificacao: z.string().optional().nullable(),
  exercicio: z.coerce.number().int().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get("/", requirePermissao("FONTES_RECURSO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { q, ativo } = req.query;

  const fontes = await prisma.fonteRecurso.findMany({
    where: {
      entidadeId,
      deletedAt: null,
      ...(ativo !== undefined ? { ativo: ativo === "true" } : {}),
      ...(q
        ? {
            OR: [
              { descricao: { contains: String(q), mode: "insensitive" as const } },
              { codigo: { contains: String(q) } },
            ],
          }
        : {}),
    },
    orderBy: { codigo: "asc" },
  });

  res.json({ data: fontes });
});

router.post("/", requirePermissao("FONTES_RECURSO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = fonteSchema.parse(req.body);

  const fonte = await prisma.fonteRecurso.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "FONTES_RECURSO",
    entidadeAfetada: "fontes_recurso",
    registroId: fonte.id,
    dadosNovos: fonte,
  });

  res.status(201).json(fonte);
});

router.put("/:id", requirePermissao("FONTES_RECURSO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = fonteSchema.partial().parse(req.body);

  const atual = await prisma.fonteRecurso.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Fonte de recurso nao encontrada");

  const fonte = await prisma.fonteRecurso.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "FONTES_RECURSO",
    entidadeAfetada: "fontes_recurso",
    registroId: fonte.id,
    dadosAnteriores: atual,
    dadosNovos: fonte,
  });

  res.json(fonte);
});

router.delete("/:id", requirePermissao("FONTES_RECURSO", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.fonteRecurso.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Fonte de recurso nao encontrada");

  const fonte = await prisma.fonteRecurso.update({
    where: { id: atual.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "FONTES_RECURSO",
    entidadeAfetada: "fontes_recurso",
    registroId: fonte.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
