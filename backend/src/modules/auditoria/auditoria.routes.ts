import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

router.get("/", requirePermissao("AUDITORIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { modulo, acao, usuarioId, registroId, dataInicio, dataFim, q } = req.query;

  const where = {
    entidadeId,
    ...(modulo ? { modulo: String(modulo) } : {}),
    ...(acao ? { acao: String(acao) } : {}),
    ...(usuarioId ? { usuarioId: String(usuarioId) } : {}),
    ...(registroId ? { registroId: String(registroId) } : {}),
    ...(dataInicio || dataFim
      ? {
          createdAt: {
            ...(dataInicio ? { gte: new Date(String(dataInicio)) } : {}),
            ...(dataFim ? { lte: new Date(String(dataFim)) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { entidadeAfetada: { contains: String(q), mode: "insensitive" as const } },
            { modulo: { contains: String(q), mode: "insensitive" as const } },
            { acao: { contains: String(q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { usuario: { select: { id: true, nome: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("AUDITORIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const log = await prisma.auditLog.findFirst({
    where: { id: req.params.id, entidadeId },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
  });
  if (!log) throw AppError.notFound("Registro de auditoria nao encontrado");
  res.json(log);
});

// GET /registro/:entidadeAfetada/:registroId - historico completo de um registro especifico
router.get("/registro/:entidadeAfetada/:registroId", requirePermissao("AUDITORIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { entidadeAfetada, registroId } = z
    .object({ entidadeAfetada: z.string(), registroId: z.string() })
    .parse(req.params);

  const historico = await prisma.auditLog.findMany({
    where: { entidadeId, entidadeAfetada, registroId },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json(historico);
});

export default router;
