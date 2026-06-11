import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const TIPOS_MOVIMENTO = ["ENTRADA", "SAIDA", "TRANSFERENCIA", "AJUSTE"] as const;

const materialSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  unidade: z.string().min(1),
  categoria: z.string().optional().nullable(),
  estoqueMinimo: z.coerce.number().min(0).default(0),
  ativo: z.boolean().default(true),
});

const movimentoSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMENTO),
  data: z.coerce.date(),
  quantidade: z.coerce.number().positive(),
  valorUnitario: z.coerce.number().min(0).default(0),
  documento: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
});

router.get("/materiais", requirePermissao("ALMOXARIFADO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { categoria, ativo, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(categoria ? { categoria: String(categoria) } : {}),
    ...(ativo !== undefined ? { ativo: ativo === "true" } : {}),
    ...(q
      ? {
          OR: [
            { codigo: { contains: String(q), mode: "insensitive" as const } },
            { descricao: { contains: String(q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.material.findMany({ where, orderBy: { descricao: "asc" }, skip: pagination.skip, take: pagination.take }),
    prisma.material.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/materiais/:id", requirePermissao("ALMOXARIFADO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const material = await prisma.material.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { movimentos: { orderBy: { data: "desc" }, take: 50 } },
  });
  if (!material) throw AppError.notFound("Material nao encontrado");
  res.json(material);
});

router.post("/materiais", requirePermissao("ALMOXARIFADO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = materialSchema.parse(req.body);

  const existente = await prisma.material.findFirst({ where: { entidadeId, codigo: data.codigo, deletedAt: null } });
  if (existente) throw AppError.conflict("Ja existe um material com este codigo");

  const material = await prisma.material.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ALMOXARIFADO",
    entidadeAfetada: "materiais",
    registroId: material.id,
    dadosNovos: material,
  });

  res.status(201).json(material);
});

router.put("/materiais/:id", requirePermissao("ALMOXARIFADO", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = materialSchema.partial().parse(req.body);

  const existente = await prisma.material.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Material nao encontrado");

  const material = await prisma.material.update({ where: { id: existente.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "ALMOXARIFADO",
    entidadeAfetada: "materiais",
    registroId: material.id,
    dadosAnteriores: existente,
    dadosNovos: material,
  });

  res.json(material);
});

router.delete("/materiais/:id", requirePermissao("ALMOXARIFADO", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const existente = await prisma.material.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Material nao encontrado");

  await prisma.material.update({ where: { id: existente.id }, data: { deletedAt: new Date(), ativo: false } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "ALMOXARIFADO",
    entidadeAfetada: "materiais",
    registroId: existente.id,
    dadosAnteriores: existente,
  });

  res.status(204).send();
});

// POST /materiais/:id/movimentos - registra entrada/saida e atualiza estoque/valor medio
router.post("/materiais/:id/movimentos", requirePermissao("ALMOXARIFADO", "CRIAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const data = movimentoSchema.parse(req.body);

  const material = await prisma.material.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!material) throw AppError.notFound("Material nao encontrado");

  const estoqueAtual = Number(material.estoqueAtual);
  const valorMedio = Number(material.valorMedio);

  if (data.tipo === "SAIDA" || data.tipo === "TRANSFERENCIA") {
    if (data.quantidade > estoqueAtual) {
      throw AppError.badRequest("Quantidade maior que o estoque disponivel", { estoqueAtual });
    }
  }

  let novoEstoque = estoqueAtual;
  let novoValorMedio = valorMedio;

  if (data.tipo === "ENTRADA") {
    const valorTotalAtual = estoqueAtual * valorMedio;
    const valorTotalEntrada = data.quantidade * data.valorUnitario;
    novoEstoque = estoqueAtual + data.quantidade;
    novoValorMedio = novoEstoque > 0 ? (valorTotalAtual + valorTotalEntrada) / novoEstoque : 0;
  } else if (data.tipo === "SAIDA" || data.tipo === "TRANSFERENCIA") {
    novoEstoque = estoqueAtual - data.quantidade;
  } else {
    novoEstoque = data.quantidade;
  }

  const movimento = await prisma.$transaction(async (tx) => {
    const criado = await tx.movimentoEstoque.create({
      data: {
        materialId: material.id,
        tipo: data.tipo,
        data: data.data,
        quantidade: data.quantidade,
        valorUnitario: data.valorUnitario,
        documento: data.documento,
        observacao: data.observacao,
        origemModulo: "MANUAL",
        usuarioId,
      },
    });

    await tx.material.update({
      where: { id: material.id },
      data: { estoqueAtual: novoEstoque, valorMedio: novoValorMedio },
    });

    return criado;
  });

  await registrarAuditoria({
    req,
    acao: "MOVIMENTO_ESTOQUE",
    modulo: "ALMOXARIFADO",
    entidadeAfetada: "movimentos_estoque",
    registroId: movimento.id,
    dadosNovos: movimento,
  });

  res.status(201).json(movimento);
});

export default router;
