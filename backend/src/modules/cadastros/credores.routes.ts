import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const credorSchema = z.object({
  tipoPessoa: z.enum(["FISICA", "JURIDICA"]),
  cpfCnpj: z.string().min(11).max(18),
  nome: z.string().min(2),
  nomeFantasia: z.string().optional().nullable(),
  classificacao: z.enum(["SERVIDOR", "AUTONOMO", "FORNECEDOR", "PRESTADOR_SERVICO", "OUTROS"]),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  municipio: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  tipoConta: z.enum(["CORRENTE", "POUPANCA", "PAGAMENTO"]).optional().nullable(),
  chavePix: z.string().optional().nullable(),
  inscricaoEstadual: z.string().optional().nullable(),
  inscricaoMunicipal: z.string().optional().nullable(),
  regimeTributario: z.string().optional().nullable(),
  dataNascimento: z.coerce.date().optional().nullable(),
  numeroDependentes: z.coerce.number().int().min(0).default(0),
  ativo: z.boolean().optional(),
});

// GET /api/credores - listagem com pesquisa instantanea e filtros
router.get("/", requirePermissao("CREDORES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { q, tipoPessoa, classificacao, ativo } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(tipoPessoa ? { tipoPessoa: tipoPessoa as "FISICA" | "JURIDICA" } : {}),
    ...(classificacao ? { classificacao: classificacao as never } : {}),
    ...(ativo !== undefined ? { ativo: ativo === "true" } : {}),
    ...(q
      ? {
          OR: [
            { nome: { contains: String(q), mode: "insensitive" as const } },
            { nomeFantasia: { contains: String(q), mode: "insensitive" as const } },
            { cpfCnpj: { contains: String(q) } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.credor.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.credor.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("CREDORES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const credor = await prisma.credor.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!credor) throw AppError.notFound("Credor nao encontrado");
  res.json(credor);
});

router.post("/", requirePermissao("CREDORES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = credorSchema.parse(req.body);

  const existente = await prisma.credor.findFirst({
    where: { entidadeId, cpfCnpj: data.cpfCnpj, deletedAt: null },
  });
  if (existente) throw AppError.conflict("Ja existe um credor cadastrado com este CPF/CNPJ");

  const credor = await prisma.credor.create({
    data: { ...data, email: data.email || null, entidadeId },
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "CREDORES",
    entidadeAfetada: "credores",
    registroId: credor.id,
    dadosNovos: credor,
  });

  res.status(201).json(credor);
});

router.put("/:id", requirePermissao("CREDORES", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = credorSchema.partial().parse(req.body);

  const atual = await prisma.credor.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!atual) throw AppError.notFound("Credor nao encontrado");

  const credor = await prisma.credor.update({
    where: { id: atual.id },
    data: { ...data, email: data.email || data.email === "" ? data.email || null : undefined },
  });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "CREDORES",
    entidadeAfetada: "credores",
    registroId: credor.id,
    dadosAnteriores: atual,
    dadosNovos: credor,
  });

  res.json(credor);
});

// Exclusao logica (nunca fisica)
router.delete("/:id", requirePermissao("CREDORES", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.credor.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!atual) throw AppError.notFound("Credor nao encontrado");

  const credor = await prisma.credor.update({
    where: { id: atual.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "CREDORES",
    entidadeAfetada: "credores",
    registroId: credor.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
