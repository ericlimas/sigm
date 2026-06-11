import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const exercicioSchema = z.object({ exercicio: z.coerce.number().int() });

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// GET /resumo?exercicio= - principais indicadores do dashboard executivo
router.get("/resumo", requirePermissao("DASHBOARD", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = exercicioSchema.parse(req.query);

  const loa = await prisma.loa.findFirst({
    where: { entidadeId, exercicio, deletedAt: null },
    include: { receitasPrevistas: { where: { deletedAt: null } }, dotacoes: { where: { deletedAt: null } } },
  });
  if (!loa) throw AppError.notFound("LOA nao encontrada para o exercicio informado");

  const [arrecadacao, contas] = await Promise.all([
    prisma.receitaLancamento.aggregate({
      where: { entidadeId, exercicio, tipo: "ORCAMENTARIA", deletedAt: null },
      _sum: { valor: true },
    }),
    prisma.contaBancaria.findMany({ where: { entidadeId, deletedAt: null, ativo: true } }),
  ]);

  const receitaPrevista = round2(loa.receitasPrevistas.reduce((acc, r) => acc + Number(r.valorAtualizado), 0));
  const receitaArrecadada = round2(Number(arrecadacao._sum.valor ?? 0));

  const despesaFixada = round2(
    loa.dotacoes.reduce((acc, d) => acc + Number(d.valorInicial) + Number(d.valorAdicionado) - Number(d.valorReduzido), 0)
  );
  const despesaEmpenhada = round2(loa.dotacoes.reduce((acc, d) => acc + Number(d.valorEmpenhado), 0));
  const despesaLiquidada = round2(loa.dotacoes.reduce((acc, d) => acc + Number(d.valorLiquidado), 0));
  const despesaPaga = round2(loa.dotacoes.reduce((acc, d) => acc + Number(d.valorPago), 0));

  let saldoBancario = 0;
  for (const conta of contas) {
    const [creditos, debitos] = await Promise.all([
      prisma.movimentoBancario.aggregate({ where: { contaBancariaId: conta.id, deletedAt: null, tipo: "CREDITO" }, _sum: { valor: true } }),
      prisma.movimentoBancario.aggregate({ where: { contaBancariaId: conta.id, deletedAt: null, tipo: "DEBITO" }, _sum: { valor: true } }),
    ]);
    saldoBancario += Number(conta.saldoInicial) + Number(creditos._sum.valor ?? 0) - Number(debitos._sum.valor ?? 0);
  }

  const restosAPagar = await prisma.empenho.findMany({
    where: { entidadeId, restoAPagar: true, deletedAt: null, status: "NORMAL" },
  });
  const totalRestosAPagar = round2(
    restosAPagar.reduce((acc, e) => acc + (Number(e.valor) - Number(e.valorAnulado) - Number(e.valorPago)), 0)
  );

  const convenios = await prisma.convenio.findMany({ where: { entidadeId, exercicio, deletedAt: null } });
  const conveniosEmExecucao = convenios.filter((c) => c.status === "EM_EXECUCAO");

  res.json({
    exercicio,
    receita: { previsto: receitaPrevista, arrecadado: receitaArrecadada, percentual: receitaPrevista > 0 ? round2((receitaArrecadada / receitaPrevista) * 100) : 0 },
    despesa: {
      fixado: despesaFixada,
      empenhado: despesaEmpenhada,
      liquidado: despesaLiquidada,
      pago: despesaPaga,
      percentualExecutado: despesaFixada > 0 ? round2((despesaEmpenhada / despesaFixada) * 100) : 0,
    },
    saldoBancario: round2(saldoBancario),
    restosAPagar: { total: totalRestosAPagar, quantidade: restosAPagar.length },
    convenios: {
      total: convenios.length,
      emExecucao: conveniosEmExecucao.length,
      valorTotal: round2(convenios.reduce((acc, c) => acc + Number(c.valorTotal), 0)),
    },
  });
});

// GET /limites-lrf?exercicio= - indicadores constitucionais e da LRF (aproximados)
router.get("/limites-lrf", requirePermissao("DASHBOARD", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = exercicioSchema.parse(req.query);

  const [dotacoes, arrecadacao] = await Promise.all([
    prisma.dotacao.findMany({ where: { entidadeId, exercicio, deletedAt: null } }),
    prisma.receitaLancamento.aggregate({
      where: { entidadeId, exercicio, tipo: "ORCAMENTARIA", deletedAt: null },
      _sum: { valor: true },
    }),
  ]);

  const receitaCorrenteLiquida = round2(Number(arrecadacao._sum.valor ?? 0));

  const despesaPessoal = round2(dotacoes.filter((d) => d.grupoDespesa === "1").reduce((acc, d) => acc + Number(d.valorEmpenhado), 0));
  const despesaEducacao = round2(dotacoes.filter((d) => d.funcao === "12").reduce((acc, d) => acc + Number(d.valorLiquidado), 0));
  const despesaSaude = round2(dotacoes.filter((d) => d.funcao === "10").reduce((acc, d) => acc + Number(d.valorLiquidado), 0));

  const percentual = (valor: number, base: number) => (base > 0 ? round2((valor / base) * 100) : 0);

  res.json({
    exercicio,
    receitaCorrenteLiquida,
    despesaComPessoal: {
      valor: despesaPessoal,
      percentualRcl: percentual(despesaPessoal, receitaCorrenteLiquida),
      limiteLegal: 60,
    },
    manutencaoEnsino: {
      valor: despesaEducacao,
      percentualReceita: percentual(despesaEducacao, receitaCorrenteLiquida),
      limiteMinimoConstitucional: 25,
    },
    acoesServicosSaude: {
      valor: despesaSaude,
      percentualReceita: percentual(despesaSaude, receitaCorrenteLiquida),
      limiteMinimoConstitucional: 15,
    },
  });
});

// GET /indicadores-secretaria?exercicio= - execucao orcamentaria por orgao/secretaria
router.get("/indicadores-secretaria", requirePermissao("DASHBOARD", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = exercicioSchema.parse(req.query);

  const dotacoes = await prisma.dotacao.findMany({
    where: { entidadeId, exercicio, deletedAt: null },
    include: { orgao: true },
  });

  const porOrgao = new Map<string, { orgao: string; codigo: string; fixado: number; empenhado: number; liquidado: number; pago: number }>();

  for (const d of dotacoes) {
    const atual = porOrgao.get(d.orgaoId) ?? { orgao: d.orgao.nome, codigo: d.orgao.codigo, fixado: 0, empenhado: 0, liquidado: 0, pago: 0 };
    atual.fixado += Number(d.valorInicial) + Number(d.valorAdicionado) - Number(d.valorReduzido);
    atual.empenhado += Number(d.valorEmpenhado);
    atual.liquidado += Number(d.valorLiquidado);
    atual.pago += Number(d.valorPago);
    porOrgao.set(d.orgaoId, atual);
  }

  const indicadores = Array.from(porOrgao.values())
    .map((i) => ({
      ...i,
      fixado: round2(i.fixado),
      empenhado: round2(i.empenhado),
      liquidado: round2(i.liquidado),
      pago: round2(i.pago),
      percentualExecutado: i.fixado > 0 ? round2((i.empenhado / i.fixado) * 100) : 0,
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  res.json(indicadores);
});

// GET /graficos/receita-despesa-mensal?exercicio=
router.get("/graficos/receita-despesa-mensal", requirePermissao("DASHBOARD", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = exercicioSchema.parse(req.query);

  const [receitas, empenhos] = await Promise.all([
    prisma.receitaLancamento.findMany({ where: { entidadeId, exercicio, tipo: "ORCAMENTARIA", deletedAt: null } }),
    prisma.empenho.findMany({ where: { entidadeId, exercicio, deletedAt: null } }),
  ]);

  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    receitaArrecadada: 0,
    despesaEmpenhada: 0,
  }));

  for (const r of receitas) {
    meses[r.data.getUTCMonth()].receitaArrecadada += Number(r.valor);
  }
  for (const e of empenhos) {
    meses[e.data.getUTCMonth()].despesaEmpenhada += Number(e.valor) - Number(e.valorAnulado);
  }

  res.json(meses.map((m) => ({ ...m, receitaArrecadada: round2(m.receitaArrecadada), despesaEmpenhada: round2(m.despesaEmpenhada) })));
});

// GET /graficos/despesa-por-funcao?exercicio=
router.get("/graficos/despesa-por-funcao", requirePermissao("DASHBOARD", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = exercicioSchema.parse(req.query);

  const dotacoes = await prisma.dotacao.findMany({ where: { entidadeId, exercicio, deletedAt: null } });

  const porFuncao = new Map<string, number>();
  for (const d of dotacoes) {
    porFuncao.set(d.funcao, (porFuncao.get(d.funcao) ?? 0) + Number(d.valorEmpenhado));
  }

  res.json(
    Array.from(porFuncao.entries())
      .map(([funcao, valor]) => ({ funcao, valorEmpenhado: round2(valor) }))
      .sort((a, b) => a.funcao.localeCompare(b.funcao))
  );
});

export default router;
