import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";
import { calcularRetencao } from "./retencoes.service";

const router = Router();

async function carregarLiquidacao(entidadeId: string, liquidacaoId: string) {
  const liquidacao = await prisma.liquidacao.findFirst({
    where: { id: liquidacaoId, deletedAt: null, empenho: { entidadeId, deletedAt: null } },
    include: { empenho: { include: { credor: true } }, retencao: { include: { historico: true } } },
  });
  if (!liquidacao) throw AppError.notFound("Liquidacao nao encontrada");
  return liquidacao;
}

// GET /api/retencoes/:liquidacaoId - retorna o calculo de retencao (se existir)
router.get("/:liquidacaoId", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const liquidacao = await carregarLiquidacao(entidadeId, req.params.liquidacaoId);

  res.json({
    credor: {
      id: liquidacao.empenho.credor.id,
      nome: liquidacao.empenho.credor.nome,
      tipoPessoa: liquidacao.empenho.credor.tipoPessoa,
      numeroDependentes: liquidacao.empenho.credor.numeroDependentes,
    },
    retencao: liquidacao.retencao,
    obrigatorio: liquidacao.empenho.credor.tipoPessoa === "FISICA",
  });
});

const calcularSchema = z.object({
  naturezaServicoId: z.string().uuid().optional().nullable(),
  numeroDependentes: z.coerce.number().int().min(0).optional(),
});

// POST /api/retencoes/:liquidacaoId/calcular - calculo automatico (INSS/IRRF)
router.post("/:liquidacaoId/calcular", requirePermissao("RETENCOES", "CALCULAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const liquidacao = await carregarLiquidacao(entidadeId, req.params.liquidacaoId);
  const body = calcularSchema.parse(req.body ?? {});

  const credor = liquidacao.empenho.credor;
  const numeroDependentes = body.numeroDependentes ?? credor.numeroDependentes;

  const resultado = await calcularRetencao({
    entidadeId,
    valorBruto: Number(liquidacao.valor),
    dataReferencia: liquidacao.data,
    numeroDependentes,
    naturezaServicoId: body.naturezaServicoId ?? null,
  });

  const dados = {
    liquidacaoId: liquidacao.id,
    credorId: credor.id,
    naturezaServicoId: body.naturezaServicoId ?? null,
    valorBruto: Number(liquidacao.valor),
    ...resultado,
    calculoManual: false,
    justificativaAjuste: null,
    ajustadoPorId: null,
  };

  const retencao = await prisma.retencaoCalculo.upsert({
    where: { liquidacaoId: liquidacao.id },
    create: dados,
    update: dados,
  });

  await registrarAuditoria({
    req,
    acao: liquidacao.retencao ? "UPDATE" : "CREATE",
    modulo: "RETENCOES",
    entidadeAfetada: "retencao_calculos",
    registroId: retencao.id,
    dadosAnteriores: liquidacao.retencao,
    dadosNovos: retencao,
  });

  res.json(retencao);
});

const ajusteSchema = z.object({
  inssRetido: z.coerce.number().min(0).optional(),
  irrfRetido: z.coerce.number().min(0).optional(),
  numeroDependentes: z.coerce.number().int().min(0).optional(),
  deducaoDependentes: z.coerce.number().min(0).optional(),
  baseIrrf: z.coerce.number().min(0).optional(),
  justificativa: z.string().min(10, "Informe uma justificativa detalhada para o ajuste manual"),
});

// PUT /api/retencoes/:liquidacaoId - edicao manual mediante justificativa (auditada)
router.put("/:liquidacaoId", requirePermissao("RETENCOES", "AJUSTAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const liquidacao = await carregarLiquidacao(entidadeId, req.params.liquidacaoId);
  const body = ajusteSchema.parse(req.body);

  if (!liquidacao.retencao) {
    throw AppError.badRequest("Calcule a retencao automaticamente antes de realizar ajustes manuais");
  }

  const atual = liquidacao.retencao;
  const camposAlterados: { campo: string; de: string; para: string }[] = [];

  const novosValores: Record<string, unknown> = {};

  for (const campo of ["inssRetido", "irrfRetido", "numeroDependentes", "deducaoDependentes", "baseIrrf"] as const) {
    if (body[campo] !== undefined && Number(body[campo]) !== Number(atual[campo])) {
      camposAlterados.push({ campo, de: String(atual[campo]), para: String(body[campo]) });
      novosValores[campo] = body[campo];
    }
  }

  const inss = Number(novosValores.inssRetido ?? atual.inssRetido);
  const irrf = Number(novosValores.irrfRetido ?? atual.irrfRetido);
  const valorLiquido = Number(atual.valorBruto) - inss - irrf;

  const retencao = await prisma.retencaoCalculo.update({
    where: { liquidacaoId: liquidacao.id },
    data: {
      ...novosValores,
      valorLiquido,
      calculoManual: true,
      justificativaAjuste: body.justificativa,
      ajustadoPorId: usuarioId,
    },
  });

  await Promise.all(
    camposAlterados.map((c) =>
      prisma.retencaoHistorico.create({
        data: {
          retencaoId: retencao.id,
          campoAlterado: c.campo,
          valorAnterior: c.de,
          valorNovo: c.para,
          justificativa: body.justificativa,
          usuarioId,
        },
      })
    )
  );

  await registrarAuditoria({
    req,
    acao: "AJUSTE_MANUAL",
    modulo: "RETENCOES",
    entidadeAfetada: "retencao_calculos",
    registroId: retencao.id,
    dadosAnteriores: atual,
    dadosNovos: retencao,
  });

  res.json(retencao);
});

// GET /api/retencoes/:liquidacaoId/demonstrativo - demonstrativo para o credor
router.get("/:liquidacaoId/demonstrativo", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const liquidacao = await carregarLiquidacao(entidadeId, req.params.liquidacaoId);

  if (!liquidacao.retencao) throw AppError.notFound("Retencao ainda nao calculada para esta liquidacao");

  res.json({
    documento: "DEMONSTRATIVO DE RETENCAO TRIBUTARIA",
    credor: {
      nome: liquidacao.empenho.credor.nome,
      cpfCnpj: liquidacao.empenho.credor.cpfCnpj,
    },
    referencia: { empenho: liquidacao.empenho.numero, liquidacao: liquidacao.numero, data: liquidacao.data },
    valores: {
      valorBruto: liquidacao.retencao.valorBruto,
      inssRetido: liquidacao.retencao.inssRetido,
      baseIrrf: liquidacao.retencao.baseIrrf,
      irrfRetido: liquidacao.retencao.irrfRetido,
      valorLiquido: liquidacao.retencao.valorLiquido,
    },
  });
});

const relatorioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000),
});

// GET /api/retencoes/relatorios/mensal?mes=&ano= - relatorio mensal de retencoes
router.get("/relatorios/mensal", requirePermissao("RETENCOES", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { mes, ano } = relatorioQuerySchema.parse(req.query);

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);

  const retencoes = await prisma.retencaoCalculo.findMany({
    where: {
      liquidacao: {
        data: { gte: inicio, lt: fim },
        empenho: { entidadeId, deletedAt: null },
        deletedAt: null,
      },
    },
    include: {
      credor: true,
      liquidacao: { include: { empenho: true } },
      naturezaServico: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const totais = retencoes.reduce(
    (acc, r) => ({
      valorBruto: acc.valorBruto + Number(r.valorBruto),
      inssRetido: acc.inssRetido + Number(r.inssRetido),
      irrfRetido: acc.irrfRetido + Number(r.irrfRetido),
      valorLiquido: acc.valorLiquido + Number(r.valorLiquido),
    }),
    { valorBruto: 0, inssRetido: 0, irrfRetido: 0, valorLiquido: 0 }
  );

  res.json({ periodo: { mes, ano }, totais, itens: retencoes });
});

export default router;
