import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const NATUREZAS_DEVEDORAS = new Set(["ATIVO", "VPD", "CONTROLE_DEVEDOR", "ORCAMENTARIA_DESPESA"]);

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function saldoPorNatureza(natureza: string, debitos: number, creditos: number): number {
  return NATUREZAS_DEVEDORAS.has(natureza) ? round2(debitos - creditos) : round2(creditos - debitos);
}

async function garantirPeriodoAberto(entidadeId: string, exercicio: number, data: Date) {
  const mes = data.getUTCMonth() + 1;
  const periodo = await prisma.periodoContabil.findUnique({
    where: { entidadeId_exercicio_mes: { entidadeId, exercicio, mes } },
  });
  if (periodo?.status === "ENCERRADO") {
    throw AppError.badRequest(`O periodo contabil ${mes}/${exercicio} esta encerrado`);
  }
}

// ---------------------------------------------------------------------------
// Lancamentos contabeis (partidas dobradas)
// ---------------------------------------------------------------------------

const partidaSchema = z.object({
  contaContabilId: z.string().uuid(),
  tipo: z.enum(["DEBITO", "CREDITO"]),
  valor: z.coerce.number().positive(),
  historico: z.string().optional().nullable(),
});

const lancamentoSchema = z.object({
  exercicio: z.coerce.number().int(),
  data: z.coerce.date(),
  historico: z.string().min(3),
  partidas: z.array(partidaSchema).min(2),
});

router.get("/lancamentos", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, mes, origemModulo, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(origemModulo ? { origemModulo: String(origemModulo) } : {}),
    ...(mes
      ? {
          data: {
            gte: new Date(Date.UTC(Number(exercicio), Number(mes) - 1, 1)),
            lt: new Date(Date.UTC(Number(exercicio), Number(mes), 1)),
          },
        }
      : {}),
    ...(q ? { historico: { contains: String(q), mode: "insensitive" as const } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.lancamentoContabil.findMany({
      where,
      include: { partidas: { include: { contaContabil: true } } },
      orderBy: [{ data: "desc" }, { numero: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.lancamentoContabil.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/lancamentos/:id", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const lancamento = await prisma.lancamentoContabil.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { partidas: { include: { contaContabil: true } } },
  });
  if (!lancamento) throw AppError.notFound("Lancamento contabil nao encontrado");
  res.json(lancamento);
});

router.post("/lancamentos", requirePermissao("CONTABIL", "CRIAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const data = lancamentoSchema.parse(req.body);

  const totalDebito = round2(data.partidas.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + p.valor, 0));
  const totalCredito = round2(data.partidas.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + p.valor, 0));

  if (totalDebito !== totalCredito) {
    throw AppError.badRequest("O somatorio dos debitos deve ser igual ao somatorio dos creditos", {
      totalDebito,
      totalCredito,
    });
  }

  await garantirPeriodoAberto(entidadeId, data.exercicio, data.data);

  const contas = await prisma.contaContabil.findMany({
    where: { id: { in: data.partidas.map((p) => p.contaContabilId) }, entidadeId, deletedAt: null },
  });
  if (contas.length !== new Set(data.partidas.map((p) => p.contaContabilId)).size) {
    throw AppError.notFound("Uma ou mais contas contabeis informadas nao foram encontradas");
  }
  const contaInvalida = contas.find((c) => !c.aceitaLancamento);
  if (contaInvalida) {
    throw AppError.badRequest(`A conta ${contaInvalida.codigo} - ${contaInvalida.descricao} nao aceita lancamentos diretos`);
  }

  const ultimo = await prisma.lancamentoContabil.findFirst({
    where: { entidadeId, exercicio: data.exercicio },
    orderBy: { numero: "desc" },
  });
  const numero = (ultimo?.numero ?? 0) + 1;

  const lancamento = await prisma.lancamentoContabil.create({
    data: {
      entidadeId,
      exercicio: data.exercicio,
      numero,
      data: data.data,
      historico: data.historico,
      tipo: "MANUAL",
      usuarioId,
      partidas: { create: data.partidas },
    },
    include: { partidas: { include: { contaContabil: true } } },
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "CONTABIL",
    entidadeAfetada: "lancamentos_contabeis",
    registroId: lancamento.id,
    dadosNovos: lancamento,
  });

  res.status(201).json(lancamento);
});

// POST /lancamentos/:id/estornar - cria um lancamento de estorno (partidas invertidas)
router.post("/lancamentos/:id/estornar", requirePermissao("CONTABIL", "ESTORNAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const { justificativa } = z.object({ justificativa: z.string().min(3) }).parse(req.body);

  const original = await prisma.lancamentoContabil.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { partidas: true },
  });
  if (!original) throw AppError.notFound("Lancamento contabil nao encontrado");

  const hoje = new Date();
  await garantirPeriodoAberto(entidadeId, hoje.getUTCFullYear(), hoje);

  const ultimo = await prisma.lancamentoContabil.findFirst({
    where: { entidadeId, exercicio: original.exercicio },
    orderBy: { numero: "desc" },
  });
  const numero = (ultimo?.numero ?? 0) + 1;

  const estorno = await prisma.lancamentoContabil.create({
    data: {
      entidadeId,
      exercicio: original.exercicio,
      numero,
      data: hoje,
      historico: `Estorno do lancamento ${original.numero}/${original.exercicio} - ${justificativa}`,
      tipo: "MANUAL",
      origemModulo: "ESTORNO",
      origemId: original.id,
      usuarioId,
      partidas: {
        create: original.partidas.map((p) => ({
          contaContabilId: p.contaContabilId,
          tipo: p.tipo === "DEBITO" ? "CREDITO" : "DEBITO",
          valor: p.valor,
          historico: p.historico,
        })),
      },
    },
    include: { partidas: { include: { contaContabil: true } } },
  });

  await registrarAuditoria({
    req,
    acao: "ESTORNO",
    modulo: "CONTABIL",
    entidadeAfetada: "lancamentos_contabeis",
    registroId: estorno.id,
    dadosAnteriores: original,
    dadosNovos: estorno,
  });

  res.status(201).json(estorno);
});

// ---------------------------------------------------------------------------
// Periodos contabeis (encerramento mensal/anual)
// ---------------------------------------------------------------------------

router.get("/periodos", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = z.object({ exercicio: z.coerce.number().int() }).parse(req.query);

  const existentes = await prisma.periodoContabil.findMany({ where: { entidadeId, exercicio } });
  const porMes = new Map(existentes.map((p) => [p.mes, p]));

  const periodos = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    return porMes.get(mes) ?? { entidadeId, exercicio, mes, status: "ABERTO" as const, dataEncerramento: null };
  });

  res.json(periodos);
});

const encerramentoSchema = z.object({ exercicio: z.coerce.number().int(), mes: z.coerce.number().int().min(1).max(12) });

router.post("/periodos/encerrar", requirePermissao("CONTABIL", "ENCERRAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const { exercicio, mes } = encerramentoSchema.parse(req.body);

  if (mes > 1) {
    const anterior = await prisma.periodoContabil.findUnique({
      where: { entidadeId_exercicio_mes: { entidadeId, exercicio, mes: mes - 1 } },
    });
    if (!anterior || anterior.status !== "ENCERRADO") {
      throw AppError.badRequest("O periodo anterior precisa estar encerrado antes deste");
    }
  }

  const periodo = await prisma.periodoContabil.upsert({
    where: { entidadeId_exercicio_mes: { entidadeId, exercicio, mes } },
    create: { entidadeId, exercicio, mes, status: "ENCERRADO", dataEncerramento: new Date(), usuarioEncerramentoId: usuarioId },
    update: { status: "ENCERRADO", dataEncerramento: new Date(), usuarioEncerramentoId: usuarioId },
  });

  await registrarAuditoria({
    req,
    acao: "ENCERRAMENTO",
    modulo: "CONTABIL",
    entidadeAfetada: "periodos_contabeis",
    registroId: periodo.id,
    dadosNovos: periodo,
  });

  res.json(periodo);
});

router.post("/periodos/reabrir", requirePermissao("CONTABIL", "ENCERRAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const { exercicio, mes } = encerramentoSchema.parse(req.body);

  if (mes < 12) {
    const posterior = await prisma.periodoContabil.findUnique({
      where: { entidadeId_exercicio_mes: { entidadeId, exercicio, mes: mes + 1 } },
    });
    if (posterior?.status === "ENCERRADO") {
      throw AppError.badRequest("Reabra primeiro os periodos posteriores");
    }
  }

  const periodo = await prisma.periodoContabil.update({
    where: { entidadeId_exercicio_mes: { entidadeId, exercicio, mes } },
    data: { status: "ABERTO", dataEncerramento: null, usuarioEncerramentoId: null },
  });

  await registrarAuditoria({
    req,
    acao: "REABERTURA",
    modulo: "CONTABIL",
    entidadeAfetada: "periodos_contabeis",
    registroId: periodo.id,
    dadosNovos: { ...periodo, usuarioId },
  });

  res.json(periodo);
});

// ---------------------------------------------------------------------------
// Relatorios contabeis
// ---------------------------------------------------------------------------

const periodoQuerySchema = z.object({ exercicio: z.coerce.number().int(), mes: z.coerce.number().int().min(1).max(12) });

// GET /relatorios/diario?exercicio=&mes=
router.get("/relatorios/diario", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio, mes } = periodoQuerySchema.parse(req.query);

  const lancamentos = await prisma.lancamentoContabil.findMany({
    where: {
      entidadeId,
      exercicio,
      deletedAt: null,
      data: { gte: new Date(Date.UTC(exercicio, mes - 1, 1)), lt: new Date(Date.UTC(exercicio, mes, 1)) },
    },
    include: { partidas: { include: { contaContabil: true } } },
    orderBy: [{ data: "asc" }, { numero: "asc" }],
  });

  res.json({ documento: "LIVRO DIARIO", periodo: { exercicio, mes }, lancamentos });
});

// GET /relatorios/razao?contaContabilId=&exercicio=&mes=
router.get("/relatorios/razao", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { contaContabilId, exercicio, mes } = z
    .object({ contaContabilId: z.string().uuid(), exercicio: z.coerce.number().int(), mes: z.coerce.number().int().min(1).max(12) })
    .parse(req.query);

  const conta = await prisma.contaContabil.findFirst({ where: { id: contaContabilId, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta contabil nao encontrada");

  const inicioPeriodo = new Date(Date.UTC(exercicio, mes - 1, 1));
  const fimPeriodo = new Date(Date.UTC(exercicio, mes, 1));

  const partidasAnteriores = await prisma.lancamentoContabilPartida.findMany({
    where: { contaContabilId, lancamento: { entidadeId, deletedAt: null, data: { lt: inicioPeriodo } } },
  });
  const saldoAnterior = saldoPorNatureza(
    conta.natureza,
    partidasAnteriores.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + Number(p.valor), 0),
    partidasAnteriores.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + Number(p.valor), 0)
  );

  const partidasPeriodo = await prisma.lancamentoContabilPartida.findMany({
    where: { contaContabilId, lancamento: { entidadeId, deletedAt: null, data: { gte: inicioPeriodo, lt: fimPeriodo } } },
    include: { lancamento: true },
    orderBy: { lancamento: { data: "asc" } },
  });

  let saldo = saldoAnterior;
  const movimentos = partidasPeriodo.map((p) => {
    const valor = Number(p.valor);
    saldo = NATUREZAS_DEVEDORAS.has(conta.natureza)
      ? round2(saldo + (p.tipo === "DEBITO" ? valor : -valor))
      : round2(saldo + (p.tipo === "CREDITO" ? valor : -valor));

    return {
      data: p.lancamento.data,
      numero: p.lancamento.numero,
      historico: p.historico ?? p.lancamento.historico,
      tipo: p.tipo,
      valor,
      saldo,
    };
  });

  res.json({
    documento: "LIVRO RAZAO",
    conta: { codigo: conta.codigo, descricao: conta.descricao, natureza: conta.natureza },
    periodo: { exercicio, mes },
    saldoAnterior,
    movimentos,
    saldoAtual: saldo,
  });
});

// GET /relatorios/balancete?exercicio=&mes=
router.get("/relatorios/balancete", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio, mes } = periodoQuerySchema.parse(req.query);

  const inicioPeriodo = new Date(Date.UTC(exercicio, mes - 1, 1));
  const fimPeriodo = new Date(Date.UTC(exercicio, mes, 1));

  const contas = await prisma.contaContabil.findMany({ where: { entidadeId, deletedAt: null, aceitaLancamento: true } });

  const todasPartidas = await prisma.lancamentoContabilPartida.findMany({
    where: { contaContabilId: { in: contas.map((c) => c.id) }, lancamento: { entidadeId, deletedAt: null, data: { lt: fimPeriodo } } },
    include: { lancamento: true },
  });

  const itens = contas
    .map((conta) => {
      const partidasConta = todasPartidas.filter((p) => p.contaContabilId === conta.id);
      const anteriores = partidasConta.filter((p) => p.lancamento.data < inicioPeriodo);
      const doPeriodo = partidasConta.filter((p) => p.lancamento.data >= inicioPeriodo);

      const saldoAnterior = saldoPorNatureza(
        conta.natureza,
        anteriores.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + Number(p.valor), 0),
        anteriores.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + Number(p.valor), 0)
      );

      const debitoPeriodo = round2(doPeriodo.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + Number(p.valor), 0));
      const creditoPeriodo = round2(doPeriodo.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + Number(p.valor), 0));

      const saldoAtual = NATUREZAS_DEVEDORAS.has(conta.natureza)
        ? round2(saldoAnterior + debitoPeriodo - creditoPeriodo)
        : round2(saldoAnterior + creditoPeriodo - debitoPeriodo);

      return {
        codigo: conta.codigo,
        descricao: conta.descricao,
        natureza: conta.natureza,
        saldoAnterior,
        debitoPeriodo,
        creditoPeriodo,
        saldoAtual,
      };
    })
    .filter((i) => i.saldoAnterior !== 0 || i.debitoPeriodo !== 0 || i.creditoPeriodo !== 0 || i.saldoAtual !== 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totais = itens.reduce(
    (acc, i) => ({
      debitoPeriodo: round2(acc.debitoPeriodo + i.debitoPeriodo),
      creditoPeriodo: round2(acc.creditoPeriodo + i.creditoPeriodo),
    }),
    { debitoPeriodo: 0, creditoPeriodo: 0 }
  );

  res.json({ documento: "BALANCETE DE VERIFICACAO", periodo: { exercicio, mes }, itens, totais });
});

// GET /relatorios/balanco-patrimonial?exercicio=&mes=
router.get("/relatorios/balanco-patrimonial", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio, mes } = periodoQuerySchema.parse(req.query);
  const fimPeriodo = new Date(Date.UTC(exercicio, mes, 1));

  const contas = await prisma.contaContabil.findMany({
    where: {
      entidadeId,
      deletedAt: null,
      aceitaLancamento: true,
      natureza: { in: ["ATIVO", "PASSIVO", "PATRIMONIO_LIQUIDO"] },
    },
  });

  const partidas = await prisma.lancamentoContabilPartida.findMany({
    where: { contaContabilId: { in: contas.map((c) => c.id) }, lancamento: { entidadeId, deletedAt: null, data: { lt: fimPeriodo } } },
  });

  const grupos: Record<string, { codigo: string; descricao: string; saldo: number }[]> = {
    ATIVO: [],
    PASSIVO: [],
    PATRIMONIO_LIQUIDO: [],
  };

  for (const conta of contas) {
    const partidasConta = partidas.filter((p) => p.contaContabilId === conta.id);
    const saldo = saldoPorNatureza(
      conta.natureza,
      partidasConta.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + Number(p.valor), 0),
      partidasConta.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + Number(p.valor), 0)
    );
    if (saldo === 0) continue;
    grupos[conta.natureza].push({ codigo: conta.codigo, descricao: conta.descricao, saldo });
  }

  const totalAtivo = round2(grupos.ATIVO.reduce((acc, c) => acc + c.saldo, 0));
  const totalPassivo = round2(grupos.PASSIVO.reduce((acc, c) => acc + c.saldo, 0));
  const totalPatrimonioLiquido = round2(grupos.PATRIMONIO_LIQUIDO.reduce((acc, c) => acc + c.saldo, 0));

  res.json({
    documento: "BALANCO PATRIMONIAL",
    periodo: { exercicio, mes },
    ativo: { contas: grupos.ATIVO, total: totalAtivo },
    passivo: { contas: grupos.PASSIVO, total: totalPassivo },
    patrimonioLiquido: { contas: grupos.PATRIMONIO_LIQUIDO, total: totalPatrimonioLiquido },
    totalPassivoMaisPL: round2(totalPassivo + totalPatrimonioLiquido),
  });
});

// GET /relatorios/dvp?exercicio=&mes= - Demonstrativo das Variacoes Patrimoniais
router.get("/relatorios/dvp", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio, mes } = periodoQuerySchema.parse(req.query);
  const inicioExercicio = new Date(Date.UTC(exercicio, 0, 1));
  const fimPeriodo = new Date(Date.UTC(exercicio, mes, 1));

  const contas = await prisma.contaContabil.findMany({
    where: { entidadeId, deletedAt: null, aceitaLancamento: true, natureza: { in: ["VPA", "VPD"] } },
  });

  const partidas = await prisma.lancamentoContabilPartida.findMany({
    where: {
      contaContabilId: { in: contas.map((c) => c.id) },
      lancamento: { entidadeId, deletedAt: null, data: { gte: inicioExercicio, lt: fimPeriodo } },
    },
  });

  const grupos: Record<string, { codigo: string; descricao: string; valor: number }[]> = { VPA: [], VPD: [] };

  for (const conta of contas) {
    const partidasConta = partidas.filter((p) => p.contaContabilId === conta.id);
    const valor = saldoPorNatureza(
      conta.natureza,
      partidasConta.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + Number(p.valor), 0),
      partidasConta.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + Number(p.valor), 0)
    );
    if (valor === 0) continue;
    grupos[conta.natureza].push({ codigo: conta.codigo, descricao: conta.descricao, valor });
  }

  const totalVpa = round2(grupos.VPA.reduce((acc, c) => acc + c.valor, 0));
  const totalVpd = round2(grupos.VPD.reduce((acc, c) => acc + c.valor, 0));

  res.json({
    documento: "DEMONSTRATIVO DAS VARIACOES PATRIMONIAIS",
    periodo: { exercicio, mesReferencia: mes, inicio: inicioExercicio, fim: fimPeriodo },
    variacoesAumentativas: { contas: grupos.VPA, total: totalVpa },
    variacoesDiminutivas: { contas: grupos.VPD, total: totalVpd },
    resultadoPatrimonial: round2(totalVpa - totalVpd),
  });
});

// GET /relatorios/balanco-orcamentario?exercicio=
router.get("/relatorios/balanco-orcamentario", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio } = z.object({ exercicio: z.coerce.number().int() }).parse(req.query);

  const loa = await prisma.loa.findFirst({
    where: { entidadeId, exercicio, deletedAt: null },
    include: { receitasPrevistas: { where: { deletedAt: null } }, dotacoes: { where: { deletedAt: null } } },
  });
  if (!loa) throw AppError.notFound("LOA nao encontrada para o exercicio informado");

  const arrecadacao = await prisma.receitaLancamento.aggregate({
    where: { entidadeId, exercicio, tipo: "ORCAMENTARIA", deletedAt: null },
    _sum: { valor: true },
  });

  const receitaPrevista = round2(loa.receitasPrevistas.reduce((acc, r) => acc + Number(r.valorAtualizado), 0));
  const receitaArrecadada = round2(Number(arrecadacao._sum.valor ?? 0));

  const despesaFixada = round2(
    loa.dotacoes.reduce((acc, d) => acc + Number(d.valorInicial) + Number(d.valorAdicionado) - Number(d.valorReduzido), 0)
  );
  const despesaEmpenhada = round2(loa.dotacoes.reduce((acc, d) => acc + Number(d.valorEmpenhado), 0));
  const despesaLiquidada = round2(loa.dotacoes.reduce((acc, d) => acc + Number(d.valorLiquidado), 0));
  const despesaPaga = round2(loa.dotacoes.reduce((acc, d) => acc + Number(d.valorPago), 0));

  res.json({
    documento: "BALANCO ORCAMENTARIO",
    exercicio,
    receita: {
      previsto: receitaPrevista,
      arrecadado: receitaArrecadada,
      saldo: round2(receitaPrevista - receitaArrecadada),
    },
    despesa: {
      fixado: despesaFixada,
      empenhado: despesaEmpenhada,
      liquidado: despesaLiquidada,
      pago: despesaPaga,
      saldoDotacao: round2(despesaFixada - despesaEmpenhada),
    },
    resultadoExecucaoOrcamentaria: round2(receitaArrecadada - despesaEmpenhada),
  });
});

// GET /relatorios/dfc?exercicio=&mes= - Demonstrativo dos Fluxos de Caixa
router.get("/relatorios/dfc", requirePermissao("CONTABIL", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { exercicio, mes } = periodoQuerySchema.parse(req.query);
  const inicioPeriodo = new Date(Date.UTC(exercicio, mes - 1, 1));
  const fimPeriodo = new Date(Date.UTC(exercicio, mes, 1));

  const movimentos = await prisma.movimentoBancario.findMany({
    where: { deletedAt: null, contaBancaria: { entidadeId }, data: { gte: inicioPeriodo, lt: fimPeriodo } },
  });

  const categorias: Record<string, { ingressos: number; desembolsos: number }> = {
    OPERACIONAL: { ingressos: 0, desembolsos: 0 },
    INVESTIMENTO: { ingressos: 0, desembolsos: 0 },
    FINANCIAMENTO: { ingressos: 0, desembolsos: 0 },
  };

  for (const mov of movimentos) {
    const categoria = mov.origem === "TRANSFERENCIA" ? "FINANCIAMENTO" : "OPERACIONAL";
    if (mov.tipo === "CREDITO") categorias[categoria].ingressos = round2(categorias[categoria].ingressos + Number(mov.valor));
    else categorias[categoria].desembolsos = round2(categorias[categoria].desembolsos + Number(mov.valor));
  }

  const totalIngressos = round2(Object.values(categorias).reduce((acc, c) => acc + c.ingressos, 0));
  const totalDesembolsos = round2(Object.values(categorias).reduce((acc, c) => acc + c.desembolsos, 0));

  res.json({
    documento: "DEMONSTRATIVO DOS FLUXOS DE CAIXA",
    periodo: { exercicio, mes },
    fluxoOperacional: categorias.OPERACIONAL,
    fluxoInvestimento: categorias.INVESTIMENTO,
    fluxoFinanciamento: categorias.FINANCIAMENTO,
    geracaoLiquidaCaixa: round2(totalIngressos - totalDesembolsos),
  });
});

export default router;
