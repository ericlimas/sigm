import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const usuarioCreateSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  login: z.string().min(3),
  senha: z.string().min(6),
  perfilId: z.string().uuid(),
  ativo: z.boolean().optional(),
});

const usuarioUpdateSchema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional(),
  login: z.string().min(3).optional(),
  senha: z.string().min(6).optional(),
  perfilId: z.string().uuid().optional(),
  ativo: z.boolean().optional(),
});

router.get("/perfis", requirePermissao("USUARIOS", "VISUALIZAR"), async (_req, res) => {
  const perfis = await prisma.perfil.findMany({
    select: { id: true, chave: true, nome: true, descricao: true },
    orderBy: { nome: "asc" },
  });
  res.json({ data: perfis });
});

router.get("/", requirePermissao("USUARIOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;

  const vinculos = await prisma.usuarioEntidade.findMany({
    where: { entidadeId, usuario: { deletedAt: null } },
    include: { usuario: true, perfil: true },
    orderBy: { usuario: { nome: "asc" } },
  });

  const data = vinculos.map((v) => ({
    id: v.usuario.id,
    nome: v.usuario.nome,
    email: v.usuario.email,
    login: v.usuario.login,
    ativo: v.ativo && v.usuario.ativo,
    precisaTrocarSenha: v.usuario.precisaTrocarSenha,
    ultimoLogin: v.usuario.ultimoLogin,
    perfilId: v.perfilId,
    perfilNome: v.perfil.nome,
  }));

  res.json({ data });
});

router.post("/", requirePermissao("USUARIOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = usuarioCreateSchema.parse(req.body);

  const existente = await prisma.usuario.findFirst({
    where: { OR: [{ email: data.email }, { login: data.login }], deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe um usuario com este login ou e-mail");

  const perfil = await prisma.perfil.findUnique({ where: { id: data.perfilId } });
  if (!perfil) throw AppError.badRequest("Perfil invalido");

  const senhaHash = await bcrypt.hash(data.senha, 10);

  const usuario = await prisma.usuario.create({
    data: {
      nome: data.nome,
      email: data.email,
      login: data.login,
      senhaHash,
      ativo: true,
      precisaTrocarSenha: true,
      entidades: {
        create: {
          entidadeId,
          perfilId: data.perfilId,
          padrao: true,
          ativo: data.ativo ?? true,
        },
      },
    },
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "USUARIOS",
    entidadeAfetada: "usuarios",
    registroId: usuario.id,
    dadosNovos: { nome: usuario.nome, email: usuario.email, login: usuario.login, perfil: perfil.chave },
  });

  res.status(201).json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    login: usuario.login,
    ativo: data.ativo ?? true,
    precisaTrocarSenha: usuario.precisaTrocarSenha,
    ultimoLogin: usuario.ultimoLogin,
    perfilId: data.perfilId,
    perfilNome: perfil.nome,
  });
});

router.put("/:id", requirePermissao("USUARIOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = usuarioUpdateSchema.parse(req.body);

  const vinculo = await prisma.usuarioEntidade.findUnique({
    where: { usuarioId_entidadeId: { usuarioId: req.params.id, entidadeId } },
    include: { usuario: true, perfil: true },
  });
  if (!vinculo || vinculo.usuario.deletedAt) throw AppError.notFound("Usuario nao encontrado");

  if (data.email || data.login) {
    const conflito = await prisma.usuario.findFirst({
      where: {
        id: { not: vinculo.usuarioId },
        deletedAt: null,
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.login ? [{ login: data.login }] : []),
        ],
      },
    });
    if (conflito) throw AppError.conflict("Ja existe um usuario com este login ou e-mail");
  }

  const dadosAnteriores = {
    nome: vinculo.usuario.nome,
    email: vinculo.usuario.email,
    login: vinculo.usuario.login,
    perfil: vinculo.perfil.chave,
    ativo: vinculo.ativo,
  };

  let perfil = vinculo.perfil;
  if (data.perfilId && data.perfilId !== vinculo.perfilId) {
    const novoPerfil = await prisma.perfil.findUnique({ where: { id: data.perfilId } });
    if (!novoPerfil) throw AppError.badRequest("Perfil invalido");
    perfil = novoPerfil;
  }

  const usuarioData: Record<string, unknown> = {};
  if (data.nome !== undefined) usuarioData.nome = data.nome;
  if (data.email !== undefined) usuarioData.email = data.email;
  if (data.login !== undefined) usuarioData.login = data.login;
  if (data.senha) {
    usuarioData.senhaHash = await bcrypt.hash(data.senha, 10);
    usuarioData.precisaTrocarSenha = true;
  }

  if (Object.keys(usuarioData).length > 0) {
    await prisma.usuario.update({ where: { id: vinculo.usuarioId }, data: usuarioData });
  }

  const vinculoAtualizado = await prisma.usuarioEntidade.update({
    where: { id: vinculo.id },
    data: {
      ...(data.perfilId ? { perfilId: data.perfilId } : {}),
      ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
    },
  });

  const usuarioAtualizado = await prisma.usuario.findUniqueOrThrow({ where: { id: vinculo.usuarioId } });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "USUARIOS",
    entidadeAfetada: "usuarios",
    registroId: vinculo.usuarioId,
    dadosAnteriores,
    dadosNovos: {
      nome: usuarioAtualizado.nome,
      email: usuarioAtualizado.email,
      login: usuarioAtualizado.login,
      perfil: perfil.chave,
      ativo: vinculoAtualizado.ativo,
    },
  });

  res.json({
    id: usuarioAtualizado.id,
    nome: usuarioAtualizado.nome,
    email: usuarioAtualizado.email,
    login: usuarioAtualizado.login,
    ativo: vinculoAtualizado.ativo && usuarioAtualizado.ativo,
    precisaTrocarSenha: usuarioAtualizado.precisaTrocarSenha,
    ultimoLogin: usuarioAtualizado.ultimoLogin,
    perfilId: vinculoAtualizado.perfilId,
    perfilNome: perfil.nome,
  });
});

router.delete("/:id", requirePermissao("USUARIOS", "EXCLUIR"), async (req, res) => {
  const { entidadeId, usuarioId: usuarioLogadoId } = req.authContext!;

  if (req.params.id === usuarioLogadoId) {
    throw AppError.badRequest("Voce nao pode desativar o proprio usuario");
  }

  const vinculo = await prisma.usuarioEntidade.findUnique({
    where: { usuarioId_entidadeId: { usuarioId: req.params.id, entidadeId } },
    include: { usuario: true },
  });
  if (!vinculo || vinculo.usuario.deletedAt) throw AppError.notFound("Usuario nao encontrado");

  await prisma.usuarioEntidade.update({ where: { id: vinculo.id }, data: { ativo: false } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "USUARIOS",
    entidadeAfetada: "usuarios",
    registroId: vinculo.usuarioId,
    dadosAnteriores: { nome: vinculo.usuario.nome, email: vinculo.usuario.email, ativo: vinculo.ativo },
  });

  res.status(204).send();
});

export default router;
