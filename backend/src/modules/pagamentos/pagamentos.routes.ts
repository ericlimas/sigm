import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const pagamentoSchema = z.object({
  liquidacaoId: z.string().uuid(),
  data: z.coerce.date(),
  valor: z.coerce.number().positive(),
  formaPagamento: z.enum(["PIX", "TED", "DOC", "CHEQUE", "DINHEIRO", "CNAB"]),
  contaBancariaId: z.string().uuid(),
  numeroOrdemPagamento: z.string().optional().nullable(),
});

async function saldoContaBancaria(contaBancariaId: string): Promise<number> {
  const conta = await prisma.contaBancaria.findUniqueOrThrow({ where: { id: contaBancariaId } });
  const movimentos = await prisma.movimentoBancario.aggregate({
    where: { contaBancariaId, deletedAt: null },
    _sum: { valor: true },
  });

  const creditos = await prisma.movimentoBancario.aggregate({
    where: { contaBancariaId, deletedAt: null, tipo: "CREDITO" },
    _sum: { valor: true },
  });
  const debitos = await prisma.movimentoBancario.aggregate({
    where: { contaBancariaId, deletedAt: null, tipo: "DEBITO" },
    _sum: { valor: true },
  });
  void movimentos;

  return Number(conta.saldoInicial) + Number(creditos._sum.valor ?? 0) - Number(debitos._sum.valor ?? 0);
}

router.get("/", requirePermissao("PAGAMENTOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { liquidacaoId, status, contaBancariaId, formaPagamento, fonteRecursoId, restoAPagar } = req.query;

  const where = {
    deletedAt: null,
    liquidacao: {
      empenho: {
        entidadeId,
        deletedAt: null,
        ...(restoAPagar !== undefined ? { restoAPagar: restoAPagar === "true" } : {}),
        ...(fonteRecursoId ? { dotacao: { fonteRecursoId: String(fonteRecursoId) } } : {}),
      },
    },
    ...(liquidacaoId ? { liquidacaoId: String(liquidacaoId) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(contaBancariaId ? { contaBancariaId: String(contaBancariaId) } : {}),
    ...(formaPagamento ? { formaPagamento: formaPagamento as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.pagamento.findMany({
      where,
      include: {
        liquidacao: { include: { empenho: { include: { credor: true, dotacao: { include: { fonteRecurso: true } } } } } },
        contaBancaria: true,
      },
      orderBy: { data: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.pagamento.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("PAGAMENTOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagamento = await prisma.pagamento.findFirst({
    where: { id: req.params.id, deletedAt: null, liquidacao: { empenho: { entidadeId, deletedAt: null } } },
    include: {
      liquidacao: { include: { empenho: { include: { credor: true, dotacao: true } }, retencao: true } },
      contaBancaria: true,
    },
  });
  if (!pagamento) throw AppError.notFound("Pagamento nao encontrado");
  res.json(pagamento);
});

// POST /api/pagamentos - pagamento parcial ou total de uma liquidacao
router.post("/", requirePermissao("PAGAMENTOS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = pagamentoSchema.parse(req.body);

  const liquidacao = await prisma.liquidacao.findFirst({
    where: { id: data.liquidacaoId, deletedAt: null, empenho: { entidadeId, deletedAt: null } },
    include: {
      empenho: { include: { credor: true } },
      pagamentos: true,
      retencao: true,
    },
  });
  if (!liquidacao) throw AppError.notFound("Liquidacao nao encontrada");
  if (liquidacao.status !== "LIQUIDADA") throw AppError.badRequest("Liquidacao nao esta apta para pagamento");

  // Validacao obrigatoria de retencoes para credores Pessoa Fisica
  if (liquidacao.empenho.credor.tipoPessoa === "FISICA" && !liquidacao.retencao) {
    throw AppError.badRequest(
      "Nao e possivel efetuar o pagamento sem antes verificar/calcular as retencoes tributarias (INSS/IRRF) do credor Pessoa Fisica"
    );
  }

  const totalPago = liquidacao.pagamentos
    .filter((p) => p.status === "PAGO")
    .reduce((acc, p) => acc + Number(p.valor), 0);
  const saldoAPagar = Number(liquidacao.valor) - totalPago;

  if (data.valor > saldoAPagar) {
    throw AppError.badRequest("Valor do pagamento maior que o saldo a pagar da liquidacao", { saldoAPagar });
  }

  const conta = await prisma.contaBancaria.findFirst({ where: { id: data.contaBancariaId, entidadeId, deletedAt: null } });
  if (!conta) throw AppError.notFound("Conta bancaria nao encontrada");

  const saldoBancario = await saldoContaBancaria(conta.id);
  if (data.valor > saldoBancario) {
    throw AppError.badRequest("Saldo financeiro insuficiente na conta bancaria selecionada", { saldoBancario });
  }

  const ultimo = await prisma.pagamento.findFirst({
    where: { liquidacaoId: liquidacao.id },
    orderBy: { numero: "desc" },
  });
  const numero = (ultimo?.numero ?? 0) + 1;

  const pagamento = await prisma.$transaction(async (tx) => {
    const criado = await tx.pagamento.create({
      data: { ...data, numero, status: "PAGO" },
    });

    await tx.movimentoBancario.create({
      data: {
        contaBancariaId: conta.id,
        data: data.data,
        tipo: "DEBITO",
        historico: `Pagamento NL ${liquidacao.numero}/NE ${liquidacao.empenho.numero} - ${liquidacao.empenho.credor.nome}`,
        valor: data.valor,
        origem: "PAGAMENTO",
        pagamentoId: criado.id,
      },
    });

    await tx.empenho.update({ where: { id: liquidacao.empenhoId }, data: { valorPago: { increment: data.valor } } });
    await tx.dotacao.update({
      where: { id: (await tx.empenho.findUniqueOrThrow({ where: { id: liquidacao.empenhoId } })).dotacaoId },
      data: { valorPago: { increment: data.valor } },
    });

    return criado;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "PAGAMENTOS",
    entidadeAfetada: "pagamentos",
    registroId: pagamento.id,
    dadosNovos: pagamento,
  });

  const completo = await prisma.pagamento.findUnique({
    where: { id: pagamento.id },
    include: { liquidacao: { include: { empenho: { include: { credor: true } }, retencao: true } }, contaBancaria: true },
  });

  res.status(201).json(completo);
});

// POST /api/pagamentos/:id/cancelar
router.post("/:id/cancelar", requirePermissao("PAGAMENTOS", "CANCELAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { justificativa } = z.object({ justificativa: z.string().min(3) }).parse(req.body);

  const pagamento = await prisma.pagamento.findFirst({
    where: { id: req.params.id, deletedAt: null, liquidacao: { empenho: { entidadeId, deletedAt: null } } },
    include: { liquidacao: { include: { empenho: true } } },
  });
  if (!pagamento) throw AppError.notFound("Pagamento nao encontrado");
  if (pagamento.status !== "PAGO") throw AppError.badRequest("Pagamento ja cancelado");

  const atualizado = await prisma.$transaction(async (tx) => {
    const upd = await tx.pagamento.update({ where: { id: pagamento.id }, data: { status: "CANCELADO" } });

    await tx.movimentoBancario.create({
      data: {
        contaBancariaId: pagamento.contaBancariaId,
        data: new Date(),
        tipo: "CREDITO",
        historico: `Estorno do pagamento ${pagamento.numero} - ${justificativa}`,
        valor: pagamento.valor,
        origem: "AJUSTE",
        pagamentoId: pagamento.id,
      },
    });

    await tx.empenho.update({
      where: { id: pagamento.liquidacao.empenhoId },
      data: { valorPago: { decrement: pagamento.valor } },
    });
    await tx.dotacao.update({
      where: { id: pagamento.liquidacao.empenho.dotacaoId },
      data: { valorPago: { decrement: pagamento.valor } },
    });

    return upd;
  });

  await registrarAuditoria({
    req,
    acao: "CANCELAMENTO",
    modulo: "PAGAMENTOS",
    entidadeAfetada: "pagamentos",
    registroId: pagamento.id,
    dadosAnteriores: { status: pagamento.status },
    dadosNovos: { status: atualizado.status, justificativa },
  });

  res.json(atualizado);
});

// GET /api/pagamentos/:id/comprovante - dados para impressao do comprovante / ordem de pagamento
router.get("/:id/comprovante", requirePermissao("PAGAMENTOS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagamento = await prisma.pagamento.findFirst({
    where: { id: req.params.id, deletedAt: null, liquidacao: { empenho: { entidadeId, deletedAt: null } } },
    include: {
      liquidacao: { include: { empenho: { include: { credor: true, dotacao: { include: { fonteRecurso: true } } } }, retencao: true } },
      contaBancaria: true,
    },
  });
  if (!pagamento) throw AppError.notFound("Pagamento nao encontrado");

  res.json({
    documento: "ORDEM DE PAGAMENTO / COMPROVANTE",
    numero: pagamento.numeroOrdemPagamento ?? `${pagamento.numero}`,
    data: pagamento.data,
    formaPagamento: pagamento.formaPagamento,
    credor: {
      nome: pagamento.liquidacao.empenho.credor.nome,
      cpfCnpj: pagamento.liquidacao.empenho.credor.cpfCnpj,
      banco: pagamento.liquidacao.empenho.credor.banco,
      agencia: pagamento.liquidacao.empenho.credor.agencia,
      conta: pagamento.liquidacao.empenho.credor.conta,
      chavePix: pagamento.liquidacao.empenho.credor.chavePix,
    },
    referencias: {
      empenho: pagamento.liquidacao.empenho.numero,
      liquidacao: pagamento.liquidacao.numero,
      fonteRecurso: pagamento.liquidacao.empenho.dotacao.fonteRecurso.descricao,
    },
    valores: {
      valorBruto: pagamento.liquidacao.retencao?.valorBruto ?? pagamento.liquidacao.valor,
      inssRetido: pagamento.liquidacao.retencao?.inssRetido ?? 0,
      irrfRetido: pagamento.liquidacao.retencao?.irrfRetido ?? 0,
      valorPago: pagamento.valor,
    },
    contaBancaria: pagamento.contaBancaria,
  });
});

export default router;
