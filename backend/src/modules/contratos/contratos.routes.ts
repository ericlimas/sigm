import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const STATUS = ["VIGENTE", "ENCERRADO", "RESCINDIDO", "SUSPENSO"] as const;
const TIPOS_ADITIVO = ["PRAZO", "VALOR", "PRAZO_VALOR", "QUALITATIVO"] as const;

const contratoSchema = z.object({
  numero: z.string().min(1),
  exercicio: z.coerce.number().int(),
  licitacaoId: z.string().uuid().optional().nullable(),
  credorId: z.string().uuid(),
  objeto: z.string().min(3),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  valor: z.coerce.number().positive(),
  status: z.enum(STATUS).default("VIGENTE"),
});

const aditivoSchema = z.object({
  tipo: z.enum(TIPOS_ADITIVO),
  data: z.coerce.date(),
  valor: z.coerce.number().min(0).optional().nullable(),
  novaDataFim: z.coerce.date().optional().nullable(),
  descricao: z.string().optional().nullable(),
});

router.get("/", requirePermissao("CONTRATOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, status, credorId, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(credorId ? { credorId: String(credorId) } : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: String(q), mode: "insensitive" as const } },
            { objeto: { contains: String(q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contrato.findMany({
      where,
      include: { credor: true, licitacao: true, aditivos: true },
      orderBy: [{ exercicio: "desc" }, { numero: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.contrato.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("CONTRATOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const contrato = await prisma.contrato.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { credor: true, licitacao: true, aditivos: { orderBy: { numero: "asc" } }, liquidacoes: true },
  });
  if (!contrato) throw AppError.notFound("Contrato nao encontrado");
  res.json(contrato);
});

router.post("/", requirePermissao("CONTRATOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = contratoSchema.parse(req.body);

  const credor = await prisma.credor.findFirst({ where: { id: data.credorId, entidadeId, deletedAt: null } });
  if (!credor) throw AppError.notFound("Credor nao encontrado");

  const existente = await prisma.contrato.findFirst({
    where: { entidadeId, exercicio: data.exercicio, numero: data.numero, deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe um contrato com este numero neste exercicio");

  const contrato = await prisma.contrato.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "CONTRATOS",
    entidadeAfetada: "contratos",
    registroId: contrato.id,
    dadosNovos: contrato,
  });

  res.status(201).json(contrato);
});

router.put("/:id", requirePermissao("CONTRATOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = contratoSchema.partial().parse(req.body);

  const existente = await prisma.contrato.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Contrato nao encontrado");

  const contrato = await prisma.contrato.update({ where: { id: existente.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "CONTRATOS",
    entidadeAfetada: "contratos",
    registroId: contrato.id,
    dadosAnteriores: existente,
    dadosNovos: contrato,
  });

  res.json(contrato);
});

router.delete("/:id", requirePermissao("CONTRATOS", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const existente = await prisma.contrato.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Contrato nao encontrado");

  await prisma.contrato.update({ where: { id: existente.id }, data: { deletedAt: new Date() } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "CONTRATOS",
    entidadeAfetada: "contratos",
    registroId: existente.id,
    dadosAnteriores: existente,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Termos aditivos
// ---------------------------------------------------------------------------

router.post("/:id/aditivos", requirePermissao("CONTRATOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = aditivoSchema.parse(req.body);

  const contrato = await prisma.contrato.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!contrato) throw AppError.notFound("Contrato nao encontrado");

  const ultimo = await prisma.contratoAditivo.findFirst({ where: { contratoId: contrato.id }, orderBy: { numero: "desc" } });
  const numero = (ultimo?.numero ?? 0) + 1;

  const aditivo = await prisma.$transaction(async (tx) => {
    const criado = await tx.contratoAditivo.create({ data: { ...data, contratoId: contrato.id, numero } });

    const atualizacao: Record<string, unknown> = {};
    if (data.valor) atualizacao.valorAditivado = { increment: data.valor };
    if (data.novaDataFim) atualizacao.dataFim = data.novaDataFim;
    if (Object.keys(atualizacao).length > 0) {
      await tx.contrato.update({ where: { id: contrato.id }, data: atualizacao });
    }

    return criado;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "CONTRATOS",
    entidadeAfetada: "contrato_aditivos",
    registroId: aditivo.id,
    dadosNovos: aditivo,
  });

  res.status(201).json(aditivo);
});

export default router;
