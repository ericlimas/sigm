import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";
import { valorPorExtenso } from "@/utils/numeroPorExtenso";

const router = Router();

const empenhoSchema = z.object({
  exercicio: z.coerce.number().int(),
  tipo: z.enum(["ORDINARIO", "GLOBAL", "ESTIMATIVO"]).default("ORDINARIO"),
  data: z.coerce.date(),
  credorId: z.string().uuid(),
  dotacaoId: z.string().uuid(),
  processo: z.string().optional().nullable(),
  historico: z.string().min(3),
  valor: z.coerce.number().positive(),
});

const movimentoSchema = z.object({
  valor: z.coerce.number().positive(),
  justificativa: z.string().min(3),
});

/** Calcula o saldo disponivel (valor atualizado - empenhado) de uma dotacao */
function saldoDisponivelDotacao(dotacao: {
  valorInicial: unknown;
  valorAdicionado: unknown;
  valorReduzido: unknown;
  valorEmpenhado: unknown;
}) {
  return (
    Number(dotacao.valorInicial) +
    Number(dotacao.valorAdicionado) -
    Number(dotacao.valorReduzido) -
    Number(dotacao.valorEmpenhado)
  );
}

/** Saldo do empenho ainda nao liquidado (disponivel para liquidar) */
function saldoNaoLiquidado(empenho: { valor: unknown; valorAnulado: unknown; valorLiquidado: unknown }) {
  return Number(empenho.valor) - Number(empenho.valorAnulado) - Number(empenho.valorLiquidado);
}

router.get("/", requirePermissao("EMPENHOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, credorId, dotacaoId, status, tipo, restoAPagar, q } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(credorId ? { credorId: String(credorId) } : {}),
    ...(dotacaoId ? { dotacaoId: String(dotacaoId) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
    ...(restoAPagar !== undefined ? { restoAPagar: restoAPagar === "true" } : {}),
    ...(q
      ? {
          OR: [
            { historico: { contains: String(q), mode: "insensitive" as const } },
            { processo: { contains: String(q) } },
            { credor: { nome: { contains: String(q), mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.empenho.findMany({
      where,
      include: {
        credor: true,
        dotacao: { include: { orgao: true, unidadeOrcamentaria: true, fonteRecurso: true } },
      },
      orderBy: [{ exercicio: "desc" }, { numero: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.empenho.count({ where }),
  ]);

  const enriched = data.map((e) => ({ ...e, saldoNaoLiquidado: saldoNaoLiquidado(e) }));

  res.json(buildPaginatedResponse(enriched, total, pagination));
});

router.get("/:id", requirePermissao("EMPENHOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const empenho = await prisma.empenho.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: {
      credor: true,
      dotacao: { include: { orgao: true, unidadeOrcamentaria: true, fonteRecurso: true, programa: true, acao: true } },
      movimentos: { orderBy: { createdAt: "desc" } },
      liquidacoes: { include: { pagamentos: true, retencao: true }, orderBy: { numero: "asc" } },
    },
  });
  if (!empenho) throw AppError.notFound("Empenho nao encontrado");
  res.json({ ...empenho, saldoNaoLiquidado: saldoNaoLiquidado(empenho) });
});

// GET /:id/imprimir - dados formatados para impressao da Ordem de Pagamento / Nota de Empenho
router.get("/:id/imprimir", requirePermissao("EMPENHOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId, nome: usuarioNome } = req.authContext!;
  const empenho = await prisma.empenho.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: {
      credor: true,
      dotacao: { include: { orgao: true, unidadeOrcamentaria: true, fonteRecurso: true, programa: true, acao: true } },
      movimentos: true,
      entidade: true,
    },
  });
  if (!empenho) throw AppError.notFound("Empenho nao encontrado");

  const valorLiquido = Number(empenho.valor) - Number(empenho.valorAnulado);

  res.json({
    documento: "ORDEM DE PAGAMENTO",
    numero: `${empenho.numero}/${empenho.exercicio}`,
    exercicio: empenho.exercicio,
    tipo: empenho.tipo,
    data: empenho.data,
    entidade: {
      nome: empenho.entidade.nome,
      municipio: empenho.entidade.municipio,
      uf: empenho.entidade.uf,
    },
    credor: {
      nome: empenho.credor.nome,
      cpfCnpj: empenho.credor.cpfCnpj,
      inscricaoEstadual: empenho.credor.inscricaoEstadual,
      logradouro: empenho.credor.logradouro,
      numero: empenho.credor.numero,
      complemento: empenho.credor.complemento,
      bairro: empenho.credor.bairro,
      cep: empenho.credor.cep,
      municipio: empenho.credor.municipio,
      uf: empenho.credor.uf,
      banco: empenho.credor.banco,
      agencia: empenho.credor.agencia,
      conta: empenho.credor.conta,
    },
    dotacao: {
      ficha: empenho.dotacao.ficha,
      orgao: empenho.dotacao.orgao.nome,
      unidade: empenho.dotacao.unidadeOrcamentaria.nome,
      funcao: empenho.dotacao.funcao,
      subfuncao: empenho.dotacao.subfuncao,
      programa: empenho.dotacao.programa?.nome,
      acao: empenho.dotacao.acao?.nome,
      elementoDespesa: empenho.dotacao.elementoDespesa,
      fonteRecurso: `${empenho.dotacao.fonteRecurso.codigo} - ${empenho.dotacao.fonteRecurso.descricao}`,
    },
    processo: empenho.processo,
    historico: empenho.historico,
    valor: empenho.valor,
    valorAnulado: empenho.valorAnulado,
    valorLiquido,
    valorExtenso: valorPorExtenso(valorLiquido),
    descontos: 0,
    movimentos: empenho.movimentos,
    usuarioLogado: usuarioNome,
  });
});

router.post("/", requirePermissao("EMPENHOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = empenhoSchema.parse(req.body);

  const [credor, dotacao] = await Promise.all([
    prisma.credor.findFirst({ where: { id: data.credorId, entidadeId, deletedAt: null } }),
    prisma.dotacao.findFirst({ where: { id: data.dotacaoId, entidadeId, deletedAt: null } }),
  ]);

  if (!credor) throw AppError.notFound("Credor nao encontrado");
  if (!dotacao) throw AppError.notFound("Dotacao nao encontrada");
  if (!credor.ativo) throw AppError.badRequest("Credor inativo");
  if (dotacao.exercicio !== data.exercicio) {
    throw AppError.badRequest("Exercicio do empenho diverge do exercicio da dotacao");
  }

  const saldo = saldoDisponivelDotacao(dotacao);
  if (data.valor > saldo) {
    throw AppError.badRequest("Saldo da dotacao insuficiente para o empenho", {
      saldoDisponivel: saldo,
      valorSolicitado: data.valor,
    });
  }

  const ultimo = await prisma.empenho.findFirst({
    where: { entidadeId, exercicio: data.exercicio },
    orderBy: { numero: "desc" },
  });
  const numero = (ultimo?.numero ?? 0) + 1;

  const empenho = await prisma.$transaction(async (tx) => {
    const criado = await tx.empenho.create({
      data: { ...data, entidadeId, numero },
      include: { credor: true, dotacao: true },
    });
    await tx.dotacao.update({
      where: { id: dotacao.id },
      data: { valorEmpenhado: { increment: data.valor } },
    });
    return criado;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "EMPENHOS",
    entidadeAfetada: "empenhos",
    registroId: empenho.id,
    dadosNovos: empenho,
  });

  res.status(201).json(empenho);
});

// POST /:id/reforco - aumenta o valor do empenho (credito disponivel na dotacao)
router.post("/:id/reforco", requirePermissao("EMPENHOS", "REFORCAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { valor, justificativa } = movimentoSchema.parse(req.body);

  const empenho = await prisma.empenho.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { dotacao: true },
  });
  if (!empenho) throw AppError.notFound("Empenho nao encontrado");
  if (empenho.status !== "NORMAL") throw AppError.badRequest("Somente empenhos normais podem ser reforcados");

  const saldo = saldoDisponivelDotacao(empenho.dotacao);
  if (valor > saldo) {
    throw AppError.badRequest("Saldo da dotacao insuficiente para o reforco", { saldoDisponivel: saldo });
  }

  const atualizado = await prisma.$transaction(async (tx) => {
    const upd = await tx.empenho.update({
      where: { id: empenho.id },
      data: { valor: { increment: valor } },
    });
    await tx.dotacao.update({ where: { id: empenho.dotacaoId }, data: { valorEmpenhado: { increment: valor } } });
    await tx.empenhoMovimento.create({
      data: {
        empenhoId: empenho.id,
        tipo: "REFORCO",
        valor,
        justificativa,
        usuarioId: req.authContext!.usuarioId,
      },
    });
    return upd;
  });

  await registrarAuditoria({
    req,
    acao: "REFORCO",
    modulo: "EMPENHOS",
    entidadeAfetada: "empenhos",
    registroId: empenho.id,
    dadosAnteriores: { valor: empenho.valor },
    dadosNovos: { valor: atualizado.valor, justificativa },
  });

  res.json(atualizado);
});

// POST /:id/anulacao - anula total ou parcialmente o saldo nao liquidado do empenho
router.post("/:id/anulacao", requirePermissao("EMPENHOS", "ANULAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { valor, justificativa } = movimentoSchema.parse(req.body);

  const empenho = await prisma.empenho.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
    include: { dotacao: true },
  });
  if (!empenho) throw AppError.notFound("Empenho nao encontrado");
  if (empenho.status !== "NORMAL") throw AppError.badRequest("Empenho ja anulado ou estornado");

  const disponivelParaAnular = saldoNaoLiquidado(empenho);
  if (valor > disponivelParaAnular) {
    throw AppError.badRequest("Valor de anulacao maior que o saldo nao liquidado do empenho", {
      saldoNaoLiquidado: disponivelParaAnular,
    });
  }

  const novoValorAnulado = Number(empenho.valorAnulado) + valor;
  const totalAnulado = novoValorAnulado >= Number(empenho.valor) - Number(empenho.valorLiquidado);

  const atualizado = await prisma.$transaction(async (tx) => {
    const upd = await tx.empenho.update({
      where: { id: empenho.id },
      data: {
        valorAnulado: { increment: valor },
        status: totalAnulado ? "ANULADO" : "NORMAL",
      },
    });
    await tx.dotacao.update({ where: { id: empenho.dotacaoId }, data: { valorEmpenhado: { decrement: valor } } });
    await tx.empenhoMovimento.create({
      data: {
        empenhoId: empenho.id,
        tipo: "ANULACAO",
        valor,
        justificativa,
        usuarioId: req.authContext!.usuarioId,
      },
    });
    return upd;
  });

  await registrarAuditoria({
    req,
    acao: "ANULACAO",
    modulo: "EMPENHOS",
    entidadeAfetada: "empenhos",
    registroId: empenho.id,
    dadosAnteriores: { valorAnulado: empenho.valorAnulado, status: empenho.status },
    dadosNovos: { valorAnulado: atualizado.valorAnulado, status: atualizado.status, justificativa },
  });

  res.json(atualizado);
});

// POST /:id/estorno - reverte totalmente o empenho (somente se nada foi liquidado)
router.post("/:id/estorno", requirePermissao("EMPENHOS", "ESTORNAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { justificativa } = z.object({ justificativa: z.string().min(3) }).parse(req.body);

  const empenho = await prisma.empenho.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!empenho) throw AppError.notFound("Empenho nao encontrado");
  if (empenho.status !== "NORMAL") throw AppError.badRequest("Empenho ja anulado ou estornado");
  if (Number(empenho.valorLiquidado) > 0) {
    throw AppError.badRequest("Nao e possivel estornar empenho que possui liquidacoes");
  }

  const valorEstorno = Number(empenho.valor) - Number(empenho.valorAnulado);

  const atualizado = await prisma.$transaction(async (tx) => {
    const upd = await tx.empenho.update({ where: { id: empenho.id }, data: { status: "ESTORNADO" } });
    await tx.dotacao.update({
      where: { id: empenho.dotacaoId },
      data: { valorEmpenhado: { decrement: valorEstorno } },
    });
    await tx.empenhoMovimento.create({
      data: {
        empenhoId: empenho.id,
        tipo: "ESTORNO",
        valor: valorEstorno,
        justificativa,
        usuarioId: req.authContext!.usuarioId,
      },
    });
    return upd;
  });

  await registrarAuditoria({
    req,
    acao: "ESTORNO",
    modulo: "EMPENHOS",
    entidadeAfetada: "empenhos",
    registroId: empenho.id,
    dadosAnteriores: { status: empenho.status },
    dadosNovos: { status: atualizado.status, justificativa },
  });

  res.json(atualizado);
});

export default router;
