import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const creditoSchema = z.object({
  exercicio: z.coerce.number().int(),
  tipo: z.enum(["SUPLEMENTAR", "ESPECIAL", "EXTRAORDINARIO"]),
  numero: z.string().min(1),
  decreto: z.string().optional().nullable(),
  data: z.coerce.date(),
  dotacaoDestinoId: z.string().uuid(),
  dotacaoOrigemId: z.string().uuid().optional().nullable(),
  fonteRecursoDescricao: z.string().optional().nullable(),
  valor: z.coerce.number().positive(),
  justificativa: z.string().optional().nullable(),
});

router.get("/", requirePermissao("ORCAMENTO", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { exercicio, tipo } = req.query;

  const where = {
    entidadeId,
    deletedAt: null,
    ...(exercicio ? { exercicio: Number(exercicio) } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.creditoAdicional.findMany({
      where,
      include: {
        dotacaoDestino: { include: { unidadeOrcamentaria: true, fonteRecurso: true } },
        dotacaoOrigem: { include: { unidadeOrcamentaria: true, fonteRecurso: true } },
      },
      orderBy: { data: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.creditoAdicional.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.post("/", requirePermissao("ORCAMENTO", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = creditoSchema.parse(req.body);

  const destino = await prisma.dotacao.findFirst({ where: { id: data.dotacaoDestinoId, entidadeId, deletedAt: null } });
  if (!destino) throw AppError.notFound("Dotacao de destino nao encontrada");

  let origem = null;
  if (data.dotacaoOrigemId) {
    origem = await prisma.dotacao.findFirst({ where: { id: data.dotacaoOrigemId, entidadeId, deletedAt: null } });
    if (!origem) throw AppError.notFound("Dotacao de origem nao encontrada");

    const saldoOrigem =
      Number(origem.valorInicial) +
      Number(origem.valorAdicionado) -
      Number(origem.valorReduzido) -
      Number(origem.valorEmpenhado);

    if (data.valor > saldoOrigem) {
      throw AppError.badRequest("Saldo insuficiente na dotacao de origem para o credito adicional", {
        saldoDisponivelOrigem: saldoOrigem,
      });
    }
  }

  const credito = await prisma.$transaction(async (tx) => {
    const criado = await tx.creditoAdicional.create({ data: { ...data, entidadeId } });

    await tx.dotacao.update({
      where: { id: destino.id },
      data: { valorAdicionado: { increment: data.valor } },
    });

    if (origem) {
      await tx.dotacao.update({
        where: { id: origem.id },
        data: { valorReduzido: { increment: data.valor } },
      });
    } else {
      // Especial/Extraordinario sem dotacao de origem: aumenta o total da LOA
      // (superavit financeiro / excesso de arrecadacao / operacao de credito)
      await tx.loa.update({
        where: { id: destino.loaId },
        data: { valorTotalDespesa: { increment: data.valor } },
      });
    }

    return criado;
  });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "ORCAMENTO_CREDITO_ADICIONAL",
    entidadeAfetada: "creditos_adicionais",
    registroId: credito.id,
    dadosNovos: credito,
  });

  res.status(201).json(credito);
});

export default router;
