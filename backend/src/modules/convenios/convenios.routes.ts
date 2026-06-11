import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const STATUS = ["EM_EXECUCAO", "CONCLUIDO", "CANCELADO", "EM_PRESTACAO_CONTAS"] as const;

const convenioSchema = z.object({
  numero: z.string().min(1),
  exercicio: z.coerce.number().int(),
  concedente: z.string().optional().nullable(),
  convenente: z.string().optional().nullable(),
  objeto: z.string().min(3),
  valorTotal: z.coerce.number().positive(),
  valorContrapartida: z.coerce.number().min(0).default(0),
  vigenciaInicio: z.coerce.date(),
  vigenciaFim: z.coerce.date(),
  status: z.enum(STATUS).default("EM_EXECUCAO"),
});

router.get("/", requirePermissao("CONVENIOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, status, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: String(q), mode: "insensitive" as const } },
            { objeto: { contains: String(q), mode: "insensitive" as const } },
            { concedente: { contains: String(q), mode: "insensitive" as const } },
            { convenente: { contains: String(q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.convenio.findMany({
      where,
      orderBy: [{ exercicio: "desc" }, { numero: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.convenio.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("CONVENIOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const convenio = await prisma.convenio.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!convenio) throw AppError.notFound("Convenio nao encontrado");
  res.json(convenio);
});

router.post("/", requirePermissao("CONVENIOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = convenioSchema.parse(req.body);

  const existente = await prisma.convenio.findFirst({
    where: { entidadeId, exercicio: data.exercicio, numero: data.numero, deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe um convenio com este numero neste exercicio");

  const convenio = await prisma.convenio.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "CONVENIOS",
    entidadeAfetada: "convenios",
    registroId: convenio.id,
    dadosNovos: convenio,
  });

  res.status(201).json(convenio);
});

router.put("/:id", requirePermissao("CONVENIOS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = convenioSchema.partial().parse(req.body);

  const existente = await prisma.convenio.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Convenio nao encontrado");

  const convenio = await prisma.convenio.update({ where: { id: existente.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "CONVENIOS",
    entidadeAfetada: "convenios",
    registroId: convenio.id,
    dadosAnteriores: existente,
    dadosNovos: convenio,
  });

  res.json(convenio);
});

router.delete("/:id", requirePermissao("CONVENIOS", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const existente = await prisma.convenio.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Convenio nao encontrado");

  await prisma.convenio.update({ where: { id: existente.id }, data: { deletedAt: new Date() } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "CONVENIOS",
    entidadeAfetada: "convenios",
    registroId: existente.id,
    dadosAnteriores: existente,
  });

  res.status(204).send();
});

export default router;
