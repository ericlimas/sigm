import { Request } from "express";
import { prisma } from "@/config/prisma";

interface RegistrarAuditoriaParams {
  req: Request;
  acao: string; // CREATE, UPDATE, DELETE, ESTORNO, ANULACAO, REFORCO, LOGIN, LOGOUT, etc
  modulo: string; // ex: EMPENHOS, CREDORES, RETENCOES
  entidadeAfetada?: string; // nome da tabela/recurso
  registroId?: string;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
}

/**
 * Registra um evento de auditoria. Os registros de auditoria nunca sao
 * removidos fisicamente (sem delete/deleteMany para audit_logs).
 */
export async function registrarAuditoria({
  req,
  acao,
  modulo,
  entidadeAfetada,
  registroId,
  dadosAnteriores,
  dadosNovos,
}: RegistrarAuditoriaParams) {
  const ctx = req.authContext;

  await prisma.auditLog.create({
    data: {
      entidadeId: ctx?.entidadeId,
      usuarioId: ctx?.usuarioId,
      acao,
      modulo,
      entidadeAfetada,
      registroId,
      dadosAnteriores: dadosAnteriores ? JSON.parse(JSON.stringify(dadosAnteriores)) : undefined,
      dadosNovos: dadosNovos ? JSON.parse(JSON.stringify(dadosNovos)) : undefined,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });
}
