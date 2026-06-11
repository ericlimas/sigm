import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshExpiryDate,
} from "@/utils/jwt";

async function carregarPermissoes(perfilId: string): Promise<string[]> {
  const permissoes = await prisma.perfilPermissao.findMany({
    where: { perfilId },
    include: { permissao: true },
  });
  return permissoes.map((p) => `${p.permissao.modulo}:${p.permissao.acao}`);
}

interface LoginInput {
  login: string;
  senha: string;
  entidadeId?: string;
  ip?: string;
  userAgent?: string;
}

export async function login({ login: loginInput, senha, entidadeId, ip, userAgent }: LoginInput) {
  const usuario = await prisma.usuario.findFirst({
    where: {
      OR: [{ login: loginInput }, { email: loginInput }],
      deletedAt: null,
    },
    include: {
      entidades: {
        where: { ativo: true },
        include: { entidade: true, perfil: true },
      },
    },
  });

  if (!usuario || !usuario.ativo) {
    throw AppError.unauthorized("Usuario ou senha invalidos");
  }

  const senhaConfere = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaConfere) {
    throw AppError.unauthorized("Usuario ou senha invalidos");
  }

  if (usuario.entidades.length === 0) {
    throw AppError.forbidden("Usuario sem acesso a nenhuma entidade/municipio");
  }

  let vinculo = usuario.entidades[0];

  if (usuario.entidades.length > 1) {
    if (!entidadeId) {
      return {
        requiresEntidadeSelection: true,
        entidades: usuario.entidades.map((v) => ({
          id: v.entidade.id,
          nome: v.entidade.nome,
          tipo: v.entidade.tipo,
          municipio: v.entidade.municipio,
          uf: v.entidade.uf,
          perfil: v.perfil.nome,
        })),
      } as const;
    }

    const encontrado = usuario.entidades.find((v) => v.entidadeId === entidadeId);
    if (!encontrado) {
      throw AppError.forbidden("Usuario nao possui acesso a entidade selecionada");
    }
    vinculo = encontrado;
  }

  const permissoes = await carregarPermissoes(vinculo.perfilId);

  const accessToken = signAccessToken({
    sub: usuario.id,
    entidadeId: vinculo.entidadeId,
    entidadeNome: vinculo.entidade.nome,
    perfilId: vinculo.perfilId,
    perfilChave: vinculo.perfil.chave,
    permissoes,
    nome: usuario.nome,
    email: usuario.email,
  });

  const refreshRecord = await prisma.refreshToken.create({
    data: {
      usuarioId: usuario.id,
      token: "",
      expiresAt: refreshExpiryDate(),
      ip,
      userAgent,
    },
  });

  const refreshToken = signRefreshToken({
    sub: usuario.id,
    jti: refreshRecord.id,
    entidadeId: vinculo.entidadeId,
    perfilId: vinculo.perfilId,
  });

  await prisma.refreshToken.update({
    where: { id: refreshRecord.id },
    data: { token: refreshToken },
  });

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date(), precisaTrocarSenha: usuario.precisaTrocarSenha },
  });

  await prisma.auditLog.create({
    data: {
      entidadeId: vinculo.entidadeId,
      usuarioId: usuario.id,
      acao: "LOGIN",
      modulo: "AUTENTICACAO",
      entidadeAfetada: "usuarios",
      registroId: usuario.id,
      ip,
      userAgent,
    },
  });

  return {
    requiresEntidadeSelection: false as const,
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      login: usuario.login,
      precisaTrocarSenha: usuario.precisaTrocarSenha,
    },
    entidade: {
      id: vinculo.entidade.id,
      nome: vinculo.entidade.nome,
      tipo: vinculo.entidade.tipo,
      municipio: vinculo.entidade.municipio,
      uf: vinculo.entidade.uf,
    },
    perfil: {
      id: vinculo.perfil.id,
      chave: vinculo.perfil.chave,
      nome: vinculo.perfil.nome,
    },
    permissoes,
  };
}

export async function refreshTokens(refreshToken: string, ip?: string, userAgent?: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized("Refresh token invalido ou expirado");
  }

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

  if (!record || record.revoked || record.token !== refreshToken || record.expiresAt < new Date()) {
    throw AppError.unauthorized("Refresh token invalido ou expirado");
  }

  const [usuario, vinculo] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: payload.sub } }),
    prisma.usuarioEntidade.findFirst({
      where: { usuarioId: payload.sub, entidadeId: payload.entidadeId, perfilId: payload.perfilId },
      include: { entidade: true, perfil: true },
    }),
  ]);

  if (!usuario || !usuario.ativo || !vinculo) {
    throw AppError.unauthorized("Sessao invalida");
  }

  const permissoes = await carregarPermissoes(vinculo.perfilId);

  const accessToken = signAccessToken({
    sub: usuario.id,
    entidadeId: vinculo.entidadeId,
    entidadeNome: vinculo.entidade.nome,
    perfilId: vinculo.perfilId,
    perfilChave: vinculo.perfil.chave,
    permissoes,
    nome: usuario.nome,
    email: usuario.email,
  });

  // Rotaciona o refresh token
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });

  const newRecord = await prisma.refreshToken.create({
    data: {
      usuarioId: usuario.id,
      token: "",
      expiresAt: refreshExpiryDate(),
      ip,
      userAgent,
    },
  });

  const newRefreshToken = signRefreshToken({
    sub: usuario.id,
    jti: newRecord.id,
    entidadeId: vinculo.entidadeId,
    perfilId: vinculo.perfilId,
  });

  await prisma.refreshToken.update({ where: { id: newRecord.id }, data: { token: newRefreshToken } });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti },
      data: { revoked: true },
    });
  } catch {
    // token ja invalido - nada a fazer
  }
}

export async function forgotPassword(email: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    // nao revela se o e-mail existe
    return { message: "Se o e-mail existir, um link de recuperacao sera enviado." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

  await prisma.passwordResetToken.create({
    data: { usuarioId: usuario.id, token, expiresAt },
  });

  // TODO: integrar envio de e-mail (SES/SendGrid). Em desenvolvimento, retornamos o token.
  return {
    message: "Se o e-mail existir, um link de recuperacao sera enviado.",
    devToken: process.env.NODE_ENV !== "production" ? token : undefined,
  };
}

export async function resetPassword(token: string, novaSenha: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw AppError.badRequest("Token de recuperacao invalido ou expirado");
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: resetToken.usuarioId },
      data: { senhaHash, precisaTrocarSenha: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { usuarioId: resetToken.usuarioId, revoked: false },
      data: { revoked: true },
    }),
  ]);

  return { message: "Senha alterada com sucesso" };
}
