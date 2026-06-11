import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";
import { verifyAccessToken } from "@/utils/jwt";

/**
 * Middleware de autenticacao: valida o JWT de acesso e popula req.authContext
 * com o usuario, a entidade (tenant) ativa e o perfil/permissoes.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw AppError.unauthorized("Token de acesso nao informado");
  }

  const token = header.substring("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);

    req.authContext = {
      usuarioId: payload.sub,
      nome: payload.nome,
      email: payload.email,
      entidadeId: payload.entidadeId,
      entidadeNome: payload.entidadeNome,
      perfilId: payload.perfilId,
      perfilChave: payload.perfilChave,
      permissoes: payload.permissoes ?? [],
    };

    next();
  } catch {
    throw AppError.unauthorized("Token de acesso invalido ou expirado");
  }
}
