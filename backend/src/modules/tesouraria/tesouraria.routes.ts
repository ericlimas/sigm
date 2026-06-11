import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";
import { parseOfx, parseCnab, detectarFormato } from "./extratoParsers";

const router = Router();

// ---------------------------------------------------------------------------
// Contas bancarias
// ---------------------------------------------------------------------------

const contaSchema = z.object({
  tipo: z.enum(["CAIXA", "BANCO", "APLICACAO"]),
  descricao: z.string().min(2),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  fonteRecursoId: z.string().uuid().optional().nullable(),
  saldoInicial: z.coerce.number().default(0),
});

export async function calcularSaldoConta(contaBancariaId: string): Promise<number> {
  const conta = await prisma.contaBancaria.findUniqueOrThrow({ where: { id: contaBancariaId } });
  const [creditos, debitos] = await Promise.all([
    prisma.movimentoBancario.aggregate({
      where: { contaBancariaId, deletedAt: null, tipo: "CREDITO" },
      _sum: { valor: true },
    }),
    prisma.movimentoBancario.aggregate({
      where: { contaBancariaId, deletedAt: null, tipo: "DEBITO" },
      _sum: { valor: true },
    }),
  ]);

  return Number(conta.saldoInicial) + Number(creditos._sum.valor ?? 0) - Number(debitos._sum.valor ?? 0);
}

router.get("/contas", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { tipo, ativo } = req.query;

  const contas = await prisma.contaBancaria.findMany({
    where: {
      entidadeId,
      deletedAt: null,
      ...(tipo ? { tipo: tipo as never } : {}),
      ...(ativo !== undefined ? { ativo: ativo === "true" } : {}),
    },
    include: { fonteRecurso: true },
    orderBy: { descricao: "asc" },
  });

  const comSaldo = await Promise.all(
    contas.map(async (c) => ({ ...c, saldoAtual: await calcularSaldoConta(c.id) }))
  );

  res.json(comSaldo);
});

router.post("/contas", requirePermissao("TESOURARIA", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = contaSchema.parse(req.body);

  const conta = await prisma.contaBancaria.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "TESOURARIA",
    entidadeAfetada: "contas_bancarias",
    registroId: conta.id,
    dadosNovos: conta,
  });

  res.status(201).json(conta);
});

router.put("/contas/:id", requirePermissao("TESOURARIA", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = contaSchema.partial().parse(req.body);

  const existente = await prisma.contaBancaria.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Conta bancaria nao encontrada");

  const conta = await prisma.contaBancaria.update({ where: { id: existente.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "TESOURARIA",
    entidadeAfetada: "contas_bancarias",
    registroId: conta.id,
    dadosAnteriores: existente,
    dadosNovos: conta,
  });

  res.json(conta);
});

router.delete("/contas/:id", requirePermissao("TESOURARIA", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const existente = await prisma.contaBancaria.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!existente) throw AppError.notFound("Conta bancaria nao encontrada");

  await prisma.contaBancaria.update({ where: { id: existente.id }, data: { deletedAt: new Date(), ativo: false } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "TESOURARIA",
    entidadeAfetada: "contas_bancarias",
    registroId: existente.id,
    dadosAnteriores: existente,
  });

  res.status(204).send();
});

router.get("/contas/:id/saldo", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const conta = await prisma.contaBancaria.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta bancaria nao encontrada");

  res.json({ contaBancariaId: conta.id, saldoAtual: await calcularSaldoConta(conta.id) });
});

// ---------------------------------------------------------------------------
// Movimentos bancarios (lancamentos manuais / extrato)
// ---------------------------------------------------------------------------

const movimentoSchema = z.object({
  contaBancariaId: z.string().uuid(),
  data: z.coerce.date(),
  tipo: z.enum(["CREDITO", "DEBITO"]),
  historico: z.string().min(2),
  valor: z.coerce.number().positive(),
  origem: z.enum(["TRANSFERENCIA", "AJUSTE", "MANUAL"]).default("MANUAL"),
});

router.get("/movimentos", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { contaBancariaId, dataInicio, dataFim, conciliado, tipo, origem } = req.query;

  const where = {
    deletedAt: null,
    contaBancaria: { entidadeId },
    ...(contaBancariaId ? { contaBancariaId: String(contaBancariaId) } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
    ...(origem ? { origem: origem as never } : {}),
    ...(conciliado !== undefined ? { conciliado: conciliado === "true" } : {}),
    ...(dataInicio || dataFim
      ? {
          data: {
            ...(dataInicio ? { gte: new Date(String(dataInicio)) } : {}),
            ...(dataFim ? { lte: new Date(String(dataFim)) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.movimentoBancario.findMany({
      where,
      include: { contaBancaria: true, conciliacao: true },
      orderBy: { data: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.movimentoBancario.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.post("/movimentos", requirePermissao("TESOURARIA", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = movimentoSchema.parse(req.body);

  const conta = await prisma.contaBancaria.findFirst({ where: { id: data.contaBancariaId, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta bancaria nao encontrada");

  const movimento = await prisma.movimentoBancario.create({ data });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "TESOURARIA",
    entidadeAfetada: "movimentos_bancarios",
    registroId: movimento.id,
    dadosNovos: movimento,
  });

  res.status(201).json(movimento);
});

router.delete("/movimentos/:id", requirePermissao("TESOURARIA", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const movimento = await prisma.movimentoBancario.findFirst({
    where: { id: req.params.id, deletedAt: null, contaBancaria: { entidadeId } },
  });
  if (!movimento) throw AppError.notFound("Movimento nao encontrado");
  if (movimento.origem !== "MANUAL" && movimento.origem !== "AJUSTE") {
    throw AppError.badRequest("Somente lancamentos manuais ou de ajuste podem ser excluidos");
  }

  await prisma.movimentoBancario.update({ where: { id: movimento.id }, data: { deletedAt: new Date() } });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "TESOURARIA",
    entidadeAfetada: "movimentos_bancarios",
    registroId: movimento.id,
    dadosAnteriores: movimento,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Conciliacao bancaria
// ---------------------------------------------------------------------------

router.post("/movimentos/:id/conciliar", requirePermissao("TESOURARIA", "CONCILIAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const { observacao } = z.object({ observacao: z.string().optional() }).parse(req.body ?? {});

  const movimento = await prisma.movimentoBancario.findFirst({
    where: { id: req.params.id, deletedAt: null, contaBancaria: { entidadeId } },
    include: { conciliacao: true },
  });
  if (!movimento) throw AppError.notFound("Movimento nao encontrado");
  if (movimento.conciliado) throw AppError.badRequest("Movimento ja conciliado");

  const conciliacao = await prisma.$transaction(async (tx) => {
    const c = await tx.conciliacaoBancaria.create({
      data: { movimentoBancarioId: movimento.id, usuarioId, observacao },
    });
    await tx.movimentoBancario.update({ where: { id: movimento.id }, data: { conciliado: true } });
    return c;
  });

  await registrarAuditoria({
    req,
    acao: "CONCILIACAO",
    modulo: "TESOURARIA",
    entidadeAfetada: "movimentos_bancarios",
    registroId: movimento.id,
    dadosNovos: conciliacao,
  });

  res.status(201).json(conciliacao);
});

router.post("/movimentos/:id/desconciliar", requirePermissao("TESOURARIA", "CONCILIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const movimento = await prisma.movimentoBancario.findFirst({
    where: { id: req.params.id, deletedAt: null, contaBancaria: { entidadeId } },
    include: { conciliacao: true },
  });
  if (!movimento) throw AppError.notFound("Movimento nao encontrado");
  if (!movimento.conciliado) throw AppError.badRequest("Movimento nao esta conciliado");

  await prisma.$transaction(async (tx) => {
    if (movimento.conciliacao) {
      await tx.conciliacaoBancaria.delete({ where: { id: movimento.conciliacao.id } });
    }
    await tx.movimentoBancario.update({ where: { id: movimento.id }, data: { conciliado: false } });
  });

  await registrarAuditoria({
    req,
    acao: "DESCONCILIACAO",
    modulo: "TESOURARIA",
    entidadeAfetada: "movimentos_bancarios",
    registroId: movimento.id,
  });

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Importacao de extratos OFX/CNAB
// ---------------------------------------------------------------------------

const importacaoSchema = z.object({
  contaBancariaId: z.string().uuid(),
  nomeArquivo: z.string(),
  conteudo: z.string().min(1),
});

router.get("/importacoes", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const importacoes = await prisma.importacaoArquivo.findMany({
    where: { entidadeId },
    include: { contaBancaria: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(importacoes);
});

router.post("/importacoes", requirePermissao("TESOURARIA", "CRIAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const data = importacaoSchema.parse(req.body);

  const conta = await prisma.contaBancaria.findFirst({ where: { id: data.contaBancariaId, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta bancaria nao encontrada");

  const formato = detectarFormato(data.conteudo);
  const movimentos = formato === "OFX" ? parseOfx(data.conteudo) : parseCnab(data.conteudo);

  if (movimentos.length === 0) {
    throw AppError.badRequest("Nenhum lancamento foi identificado no arquivo informado");
  }

  const importacao = await prisma.$transaction(async (tx) => {
    const registro = await tx.importacaoArquivo.create({
      data: {
        entidadeId,
        contaBancariaId: conta.id,
        tipo: formato === "OFX" ? "OFX" : "CNAB400",
        nomeArquivo: data.nomeArquivo,
        totalRegistros: movimentos.length,
        usuarioId,
      },
    });

    for (const mov of movimentos) {
      await tx.movimentoBancario.create({
        data: {
          contaBancariaId: conta.id,
          data: mov.data,
          tipo: mov.tipo,
          historico: mov.historico,
          valor: mov.valor,
          origem: "ARQUIVO",
          importacaoId: registro.id,
        },
      });
    }

    return registro;
  });

  await registrarAuditoria({
    req,
    acao: "IMPORTACAO",
    modulo: "TESOURARIA",
    entidadeAfetada: "importacoes_arquivos",
    registroId: importacao.id,
    dadosNovos: { totalRegistros: movimentos.length, formato },
  });

  res.status(201).json({ ...importacao, totalRegistros: movimentos.length });
});

// Conciliacao automatica: cruza lancamentos importados com movimentos do
// sistema (pagamentos/receitas) de mesma data, valor e tipo ainda nao conciliados
router.post("/importacoes/:id/conciliar-automatico", requirePermissao("TESOURARIA", "CONCILIAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;

  const importacao = await prisma.importacaoArquivo.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!importacao) throw AppError.notFound("Importacao nao encontrada");

  const importados = await prisma.movimentoBancario.findMany({
    where: { importacaoId: importacao.id, conciliado: false, deletedAt: null },
  });

  let conciliados = 0;

  for (const importado of importados) {
    const candidato = await prisma.movimentoBancario.findFirst({
      where: {
        id: { not: importado.id },
        contaBancariaId: importado.contaBancariaId,
        data: importado.data,
        valor: importado.valor,
        tipo: importado.tipo,
        conciliado: false,
        deletedAt: null,
        origem: { in: ["PAGAMENTO", "RECEITA", "TRANSFERENCIA", "MANUAL", "AJUSTE"] },
      },
    });

    if (!candidato) continue;

    await prisma.$transaction(async (tx) => {
      await tx.conciliacaoBancaria.create({
        data: { movimentoBancarioId: importado.id, usuarioId, observacao: "Conciliacao automatica" },
      });
      await tx.conciliacaoBancaria.create({
        data: { movimentoBancarioId: candidato.id, usuarioId, observacao: "Conciliacao automatica" },
      });
      await tx.movimentoBancario.update({ where: { id: importado.id }, data: { conciliado: true } });
      await tx.movimentoBancario.update({ where: { id: candidato.id }, data: { conciliado: true } });
    });

    conciliados += 1;
  }

  await prisma.importacaoArquivo.update({ where: { id: importacao.id }, data: { totalConciliados: conciliados } });

  await registrarAuditoria({
    req,
    acao: "CONCILIACAO_AUTOMATICA",
    modulo: "TESOURARIA",
    entidadeAfetada: "importacoes_arquivos",
    registroId: importacao.id,
    dadosNovos: { conciliados, total: importados.length },
  });

  res.json({ totalImportados: importados.length, conciliados });
});

// ---------------------------------------------------------------------------
// Relatorios
// ---------------------------------------------------------------------------

// GET /relatorios/boletim-diario?contaBancariaId=&data=
router.get("/relatorios/boletim-diario", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { contaBancariaId, data } = z
    .object({ contaBancariaId: z.string().uuid(), data: z.coerce.date() })
    .parse(req.query);

  const conta = await prisma.contaBancaria.findFirst({ where: { id: contaBancariaId, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta bancaria nao encontrada");

  const inicioDia = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const fimDia = new Date(inicioDia);
  fimDia.setUTCDate(fimDia.getUTCDate() + 1);

  const [creditosAnteriores, debitosAnteriores, movimentosDia] = await Promise.all([
    prisma.movimentoBancario.aggregate({
      where: { contaBancariaId, deletedAt: null, tipo: "CREDITO", data: { lt: inicioDia } },
      _sum: { valor: true },
    }),
    prisma.movimentoBancario.aggregate({
      where: { contaBancariaId, deletedAt: null, tipo: "DEBITO", data: { lt: inicioDia } },
      _sum: { valor: true },
    }),
    prisma.movimentoBancario.findMany({
      where: { contaBancariaId, deletedAt: null, data: { gte: inicioDia, lt: fimDia } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const saldoAnterior =
    Number(conta.saldoInicial) + Number(creditosAnteriores._sum.valor ?? 0) - Number(debitosAnteriores._sum.valor ?? 0);

  const totalCreditos = movimentosDia.filter((m) => m.tipo === "CREDITO").reduce((acc, m) => acc + Number(m.valor), 0);
  const totalDebitos = movimentosDia.filter((m) => m.tipo === "DEBITO").reduce((acc, m) => acc + Number(m.valor), 0);

  res.json({
    documento: "BOLETIM DIARIO DE CAIXA",
    contaBancaria: conta.descricao,
    data,
    saldoAnterior,
    totalCreditos,
    totalDebitos,
    saldoAtual: saldoAnterior + totalCreditos - totalDebitos,
    movimentos: movimentosDia,
  });
});

// GET /relatorios/fluxo?contaBancariaId=&dataInicio=&dataFim=
router.get("/relatorios/fluxo", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { contaBancariaId, dataInicio, dataFim } = z
    .object({ contaBancariaId: z.string().uuid().optional(), dataInicio: z.coerce.date(), dataFim: z.coerce.date() })
    .parse(req.query);

  const where = {
    deletedAt: null,
    data: { gte: dataInicio, lte: dataFim },
    contaBancaria: { entidadeId },
    ...(contaBancariaId ? { contaBancariaId } : {}),
  };

  const movimentos = await prisma.movimentoBancario.findMany({ where, orderBy: { data: "asc" } });

  const porDia = new Map<string, { data: string; creditos: number; debitos: number }>();
  for (const mov of movimentos) {
    const chave = mov.data.toISOString().slice(0, 10);
    const atual = porDia.get(chave) ?? { data: chave, creditos: 0, debitos: 0 };
    if (mov.tipo === "CREDITO") atual.creditos += Number(mov.valor);
    else atual.debitos += Number(mov.valor);
    porDia.set(chave, atual);
  }

  res.json({
    periodo: { dataInicio, dataFim },
    fluxo: Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data)),
  });
});

// GET /relatorios/disponibilidade - saldo consolidado por conta/fonte de recurso
router.get("/relatorios/disponibilidade", requirePermissao("TESOURARIA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;

  const contas = await prisma.contaBancaria.findMany({
    where: { entidadeId, deletedAt: null, ativo: true },
    include: { fonteRecurso: true },
  });

  const disponibilidade = await Promise.all(
    contas.map(async (c) => ({
      contaBancariaId: c.id,
      descricao: c.descricao,
      tipo: c.tipo,
      fonteRecurso: c.fonteRecurso?.descricao ?? null,
      saldoAtual: await calcularSaldoConta(c.id),
    }))
  );

  res.json({
    disponibilidade,
    totalGeral: disponibilidade.reduce((acc, c) => acc + c.saldoAtual, 0),
  });
});

export default router;
