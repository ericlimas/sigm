import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";

const router = Router();

// Rotas publicas do Portal da Transparencia (Lei 12.527/2011 - LAI)
// Nao exigem autenticacao - identificacao do ente por CNPJ na URL.

router.get("/entidades", async (_req, res) => {
  const entidades = await prisma.entidade.findMany({
    where: { ativo: true, deletedAt: null },
    select: { id: true, tipo: true, nome: true, cnpj: true, municipio: true, uf: true, brasao: true },
    orderBy: { nome: "asc" },
  });
  res.json(entidades);
});

async function carregarEntidade(cnpj: string) {
  const entidade = await prisma.entidade.findFirst({ where: { cnpj, ativo: true, deletedAt: null } });
  if (!entidade) throw AppError.notFound("Entidade nao encontrada");
  return entidade;
}

const exercicioSchema = z.object({ exercicio: z.coerce.number().int() });

// GET /:cnpj/receitas?exercicio=
router.get("/:cnpj/receitas", async (req, res) => {
  const entidade = await carregarEntidade(req.params.cnpj);
  const pagination = getPagination(req);
  const { exercicio } = exercicioSchema.parse(req.query);

  const where = { entidadeId: entidade.id, exercicio, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.receitaLancamento.findMany({
      where,
      select: { id: true, data: true, tipo: true, categoria: true, codigoReceita: true, descricao: true, valor: true },
      orderBy: { data: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.receitaLancamento.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

// GET /:cnpj/despesas?exercicio= - execucao orcamentaria (empenho/liquidado/pago)
router.get("/:cnpj/despesas", async (req, res) => {
  const entidade = await carregarEntidade(req.params.cnpj);
  const pagination = getPagination(req);
  const { exercicio } = exercicioSchema.parse(req.query);

  const where = { entidadeId: entidade.id, exercicio, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.empenho.findMany({
      where,
      select: {
        id: true,
        numero: true,
        data: true,
        tipo: true,
        status: true,
        historico: true,
        valor: true,
        valorAnulado: true,
        valorLiquidado: true,
        valorPago: true,
        credor: { select: { nome: true, cpfCnpj: true } },
        dotacao: { select: { funcao: true, subfuncao: true, elementoDespesa: true, fonteRecurso: { select: { descricao: true } } } },
      },
      orderBy: { numero: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.empenho.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

// GET /:cnpj/licitacoes?exercicio=
router.get("/:cnpj/licitacoes", async (req, res) => {
  const entidade = await carregarEntidade(req.params.cnpj);
  const pagination = getPagination(req);
  const { exercicio } = exercicioSchema.parse(req.query);

  const where = { entidadeId: entidade.id, exercicio, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.licitacao.findMany({
      where,
      select: {
        id: true,
        numero: true,
        modalidade: true,
        objeto: true,
        dataAbertura: true,
        valorEstimado: true,
        valorHomologado: true,
        status: true,
      },
      orderBy: { dataAbertura: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.licitacao.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

// GET /:cnpj/contratos?exercicio=
router.get("/:cnpj/contratos", async (req, res) => {
  const entidade = await carregarEntidade(req.params.cnpj);
  const pagination = getPagination(req);
  const { exercicio } = exercicioSchema.parse(req.query);

  const where = { entidadeId: entidade.id, exercicio, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.contrato.findMany({
      where,
      select: {
        id: true,
        numero: true,
        objeto: true,
        dataInicio: true,
        dataFim: true,
        valor: true,
        valorAditivado: true,
        status: true,
        credor: { select: { nome: true, cpfCnpj: true } },
      },
      orderBy: { numero: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.contrato.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

export default router;
