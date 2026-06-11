import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const receitaSchema = z.object({
  exercicio: z.coerce.number().int(),
  data: z.coerce.date(),
  tipo: z.enum(["ORCAMENTARIA", "EXTRAORCAMENTARIA"]).default("ORCAMENTARIA"),
  categoria: z.enum(["IPTU", "ISS", "ITBI", "TAXAS", "CONVENIO", "TRANSFERENCIA", "OUTRAS"]).default("OUTRAS"),
  codigoReceita: z.string().optional().nullable(),
  descricao: z.string().min(2),
  documento: z.string().optional().nullable(),
  fonteRecursoId: z.string().uuid().optional().nullable(),
  contaBancariaId: z.string().uuid(),
  valor: z.coerce.number().positive(),
});

router.get("/", requirePermissao("RECEITAS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, tipo, categoria, contaBancariaId, dataInicio, dataFim, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
    ...(categoria ? { categoria: categoria as never } : {}),
    ...(contaBancariaId ? { contaBancariaId: String(contaBancariaId) } : {}),
    ...(dataInicio || dataFim
      ? {
          data: {
            ...(dataInicio ? { gte: new Date(String(dataInicio)) } : {}),
            ...(dataFim ? { lte: new Date(String(dataFim)) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { descricao: { contains: String(q), mode: "insensitive" as const } },
            { documento: { contains: String(q), mode: "insensitive" as const } },
            { codigoReceita: { contains: String(q) } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.receitaLancamento.findMany({
      where,
      include: { fonteRecurso: true, contaBancaria: true },
      orderBy: { data: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.receitaLancamento.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("RECEITAS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const receita = await prisma.receitaLancamento.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { fonteRecurso: true, contaBancaria: true, movimentosBancarios: true },
  });
  if (!receita) throw AppError.notFound("Lancamento de receita nao encontrado");
  res.json(receita);
});

router.post("/", requirePermissao("RECEITAS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = receitaSchema.parse(req.body);

  const conta = await prisma.contaBancaria.findFirst({ where: { id: data.contaBancariaId, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta bancaria nao encontrada");

  if (data.fonteRecursoId) {
    const fonte = await prisma.fonteRecurso.findFirst({ where: { id: data.fonteRecursoId, entidadeId, deletedAt: null } });
    if (!fonte) throw AppError.notFound("Fonte de recurso nao encontrada");
  }

  const receita = await prisma.$transaction(async (tx) => {
    const criada = await tx.receitaLancamento.create({ data: { ...data, entidadeId } });

    await tx.movimentoBancario.create({
      data: {
        contaBancariaId: conta.id,
        data: data.data,
        tipo: "CREDITO",
        historico: `Receita - ${data.descricao}`,
        valor: data.valor,
        origem: "RECEITA",
        receitaId: criada.id,
      },
    });

    return criada;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "RECEITAS",
    entidadeAfetada: "receita_lancamentos",
    registroId: receita.id,
    dadosNovos: receita,
  });

  res.status(201).json(receita);
});

router.delete("/:id", requirePermissao("RECEITAS", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const receita = await prisma.receitaLancamento.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { movimentosBancarios: true },
  });
  if (!receita) throw AppError.notFound("Lancamento de receita nao encontrado");
  if (receita.movimentosBancarios.some((m) => m.conciliado)) {
    throw AppError.badRequest("Nao e possivel excluir uma receita com movimento bancario ja conciliado");
  }

  await prisma.$transaction(async (tx) => {
    await tx.receitaLancamento.update({ where: { id: receita.id }, data: { deletedAt: new Date() } });
    await tx.movimentoBancario.updateMany({ where: { receitaId: receita.id }, data: { deletedAt: new Date() } });
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "RECEITAS",
    entidadeAfetada: "receita_lancamentos",
    registroId: receita.id,
    dadosAnteriores: receita,
  });

  res.status(204).send();
});

// GET /relatorios/previsto-arrecadado?exercicio= - confronto da receita prevista (LOA) x arrecadada
router.get("/relatorios/previsto-arrecadado", requirePermissao("RECEITAS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = z.object({ exercicio: z.coerce.number().int() }).parse(req.query);

  const loa = await prisma.loa.findFirst({
    where: { entidadeId, exercicio, deletedAt: null },
    include: { receitasPrevistas: { where: { deletedAt: null } } },
  });
  if (!loa) throw AppError.notFound("LOA nao encontrada para o exercicio informado");

  const arrecadacao = await prisma.receitaLancamento.groupBy({
    by: ["codigoReceita"],
    where: { entidadeId, exercicio, tipo: "ORCAMENTARIA", deletedAt: null, codigoReceita: { not: null } },
    _sum: { valor: true },
  });

  const arrecadadoPorCodigo = new Map(arrecadacao.map((a) => [a.codigoReceita, Number(a._sum.valor ?? 0)]));

  const itens = loa.receitasPrevistas.map((rp) => {
    const arrecadado = arrecadadoPorCodigo.get(rp.codigoReceita) ?? 0;
    return {
      codigoReceita: rp.codigoReceita,
      descricao: rp.descricao,
      categoria: rp.categoria,
      valorPrevisto: rp.valorAtualizado,
      valorArrecadado: arrecadado,
      percentualArrecadado: Number(rp.valorAtualizado) > 0 ? round2((arrecadado / Number(rp.valorAtualizado)) * 100) : 0,
      saldo: Number(rp.valorAtualizado) - arrecadado,
    };
  });

  const totais = itens.reduce(
    (acc, i) => ({
      valorPrevisto: acc.valorPrevisto + Number(i.valorPrevisto),
      valorArrecadado: acc.valorArrecadado + i.valorArrecadado,
    }),
    { valorPrevisto: 0, valorArrecadado: 0 }
  );

  res.json({ exercicio, itens, totais });
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default router;
