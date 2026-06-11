import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";

/**
 * Restringe o acesso da rota a um conjunto de perfis (chaves).
 * O perfil ADMINISTRADOR sempre tem acesso liberado.
 */
export function requirePerfil(...perfis: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ctx = req.authContext;
    if (!ctx) throw AppError.unauthorized();

    if (ctx.perfilChave === "ADMINISTRADOR" || perfis.includes(ctx.perfilChave)) {
      return next();
    }

    throw AppError.forbidden("Seu perfil nao tem acesso a este recurso");
  };
}

/**
 * Restringe o acesso da rota a uma permissao granular no formato MODULO:ACAO.
 * O perfil ADMINISTRADOR sempre tem acesso liberado.
 */
export function requirePermissao(modulo: string, acao: string) {
  const chave = `${modulo}:${acao}`;
  return (req: Request, _res: Response, next: NextFunction) => {
    const ctx = req.authContext;
    if (!ctx) throw AppError.unauthorized();

    if (ctx.perfilChave === "ADMINISTRADOR" || ctx.permissoes.includes(chave)) {
      return next();
    }

    throw AppError.forbidden(`Permissao necessaria: ${chave}`);
  };
}
