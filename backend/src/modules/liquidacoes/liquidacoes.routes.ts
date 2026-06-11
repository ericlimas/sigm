import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";
import { calcularRetencao } from "@/modules/retencoes/retencoes.service";

const router = Router();

const liquidacaoSchema = z.object({
  empenhoId: z.string().uuid(),
  data: z.coerce.date(),
  documento: z.string().optional().nullable(),
  tipoDocumento: z.string().optional().nullable(),
  contratoId: z.string().uuid().optional().nullable(),
  historico: z.string().min(3),
  valor: z.coerce.number().positive(),
});

router.get("/", requirePermissao("LIQUIDACOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { empenhoId, status } = req.query;

  const where = {
    deletedAt: null,
    empenho: { entidadeId, deletedAt: null },
    ...(empenhoId ? { empenhoId: String(empenhoId) } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.liquidacao.findMany({
      where,
      include: {
        empenho: { include: { credor: true } },
        retencao: true,
        pagamentos: true,
      },
      orderBy: { data: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.liquidacao.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("LIQUIDACOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const liquidacao = await prisma.liquidacao.findFirst({
    where: { id: req.params.id, deletedAt: null, empenho: { entidadeId, deletedAt: null } },
    include: {
      empenho: { include: { credor: true, dotacao: true } },
      retencao: true,
      pagamentos: { include: { contaBancaria: true } },
      contrato: true,
    },
  });
  if (!liquidacao) throw AppError.notFound("Liquidacao nao encontrada");
  res.json(liquidacao);
});

// POST /api/liquidacoes - liquidacao parcial ou total de um empenho
router.post("/", requirePermissao("LIQUIDACOES", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = liquidacaoSchema.parse(req.body);

  const empenho = await prisma.empenho.findFirst({
    where: { id: data.empenhoId, entidadeId, deletedAt: null },
    include: { credor: true },
  });
  if (!empenho) throw AppError.notFound("Empenho nao encontrado");
  if (empenho.status !== "NORMAL") throw AppError.badRequest("Empenho nao esta em situacao normal");

  const saldoNaoLiquidado = Number(empenho.valor) - Number(empenho.valorAnulado) - Number(empenho.valorLiquidado);
  if (data.valor > saldoNaoLiquidado) {
    throw AppError.badRequest("Valor da liquidacao maior que o saldo nao liquidado do empenho", {
      saldoNaoLiquidado,
    });
  }

  if (data.contratoId) {
    const contrato = await prisma.contrato.findFirst({ where: { id: data.contratoId, entidadeId, deletedAt: null } });
    if (!contrato) throw AppError.notFound("Contrato nao encontrado");
  }

  const ultimo = await prisma.liquidacao.findFirst({
    where: { empenhoId: empenho.id },
    orderBy: { numero: "desc" },
  });
  const numero = (ultimo?.numero ?? 0) + 1;

  const liquidacao = await prisma.$transaction(async (tx) => {
    const criada = await tx.liquidacao.create({
      data: { ...data, numero, status: "LIQUIDADA" },
    });

    await tx.empenho.update({ where: { id: empenho.id }, data: { valorLiquidado: { increment: data.valor } } });
    await tx.dotacao.update({ where: { id: empenho.dotacaoId }, data: { valorLiquidado: { increment: data.valor } } });

    // Pessoa Fisica: calcula automaticamente as retencoes obrigatorias (INSS/IRRF)
    if (empenho.credor.tipoPessoa === "FISICA") {
      const resultado = await calcularRetencao({
        entidadeId,
        valorBruto: data.valor,
        dataReferencia: data.data,
        numeroDependentes: empenho.credor.numeroDependentes,
        naturezaServicoId: null,
      });

      await tx.retencaoCalculo.create({
        data: {
          liquidacaoId: criada.id,
          credorId: empenho.credor.id,
          valorBruto: data.valor,
          ...resultado,
        },
      });
    }

    return criada;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "LIQUIDACOES",
    entidadeAfetada: "liquidacoes",
    registroId: liquidacao.id,
    dadosNovos: liquidacao,
  });

  const completa = await prisma.liquidacao.findUnique({
    where: { id: liquidacao.id },
    include: { retencao: true, empenho: { include: { credor: true } } },
  });

  res.status(201).json(completa);
});

// POST /api/liquidacoes/:id/anular - anula liquidacao (somente se nao houver pagamentos)
router.post("/:id/anular", requirePermissao("LIQUIDACOES", "ANULAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { justificativa } = z.object({ justificativa: z.string().min(3) }).parse(req.body);

  const liquidacao = await prisma.liquidacao.findFirst({
    where: { id: req.params.id, deletedAt: null, empenho: { entidadeId, deletedAt: null } },
    include: { empenho: true, pagamentos: true },
  });
  if (!liquidacao) throw AppError.notFound("Liquidacao nao encontrada");
  if (liquidacao.status !== "LIQUIDADA") throw AppError.badRequest("Liquidacao ja anulada");
  if (liquidacao.pagamentos.some((p) => p.status === "PAGO")) {
    throw AppError.badRequest("Nao e possivel anular liquidacao com pagamentos efetuados");
  }

  const atualizada = await prisma.$transaction(async (tx) => {
    const upd = await tx.liquidacao.update({ where: { id: liquidacao.id }, data: { status: "ANULADA" } });
    await tx.empenho.update({
      where: { id: liquidacao.empenhoId },
      data: { valorLiquidado: { decrement: liquidacao.valor } },
    });
    await tx.dotacao.update({
      where: { id: liquidacao.empenho.dotacaoId },
      data: { valorLiquidado: { decrement: liquidacao.valor } },
    });
    return upd;
  });

  await registrarAuditoria({
    req,
    acao: "ANULACAO",
    modulo: "LIQUIDACOES",
    entidadeAfetada: "liquidacoes",
    registroId: liquidacao.id,
    dadosAnteriores: { status: liquidacao.status },
    dadosNovos: { status: atualizada.status, justificativa },
  });

  res.json(atualizada);
});

export default router;
