import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export interface AccessTokenPayload {
  sub: string; // usuarioId
  entidadeId: string;
  entidadeNome: string;
  perfilId: string;
  perfilChave: string;
  permissoes: string[];
  nome: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.secret) as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  sub: string; // usuarioId
  jti: string; // refresh token id (DB record id)
  entidadeId: string;
  perfilId: string;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}

export function refreshExpiryDate(): Date {
  const days = parseDaysFromExpiry(env.jwt.refreshExpiresIn);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function parseDaysFromExpiry(expiry: string): number {
  const match = /^(\d+)d$/.exec(expiry);
  if (match) return Number(match[1]);
  return 7;
}
