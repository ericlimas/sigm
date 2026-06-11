import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { getPagination, buildPaginatedResponse } from "@/utils/pagination";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

router.get("/", requirePermissao("IA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const pagination = getPagination(req);
  const { modulo, status, tipo } = req.query;

  const where = {
    entidadeId,
    ...(modulo ? { modulo: String(modulo) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.iaSugestao.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
    prisma.iaSugestao.count({ where }),
  ]);

  res.json(buildPaginatedResponse(data, total, pagination));
});

router.get("/:id", requirePermissao("IA", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const sugestao = await prisma.iaSugestao.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!sugestao) throw AppError.notFound("Sugestao nao encontrada");
  res.json(sugestao);
});

const statusSchema = z.object({ status: z.enum(["ACEITA", "REJEITADA"]) });

router.put("/:id/status", requirePermissao("IA", "AVALIAR"), async (req, res) => {
  const { entidadeId, usuarioId } = req.authContext!;
  const { status } = statusSchema.parse(req.body);

  const sugestao = await prisma.iaSugestao.findFirst({ where: { id: req.params.id, entidadeId } });
  if (!sugestao) throw AppError.notFound("Sugestao nao encontrada");

  const atualizada = await prisma.iaSugestao.update({ where: { id: sugestao.id }, data: { status, usuarioId } });

  await registrarAuditoria({
    req,
    acao: "AVALIACAO_SUGESTAO_IA",
    modulo: "IA",
    entidadeAfetada: "ia_sugestoes",
    registroId: atualizada.id,
    dadosAnteriores: { status: sugestao.status },
    dadosNovos: { status: atualizada.status },
  });

  res.json(atualizada);
});

// POST /gerar/classificacao-contabil - sugere conta contabil com base em palavras-chave do historico
const classificacaoSchema = z.object({
  modulo: z.string().min(1),
  registroId: z.string().optional().nullable(),
  descricao: z.string().min(3),
});

router.post("/gerar/classificacao-contabil", requirePermissao("IA", "GERAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = classificacaoSchema.parse(req.body);

  const contas = await prisma.contaContabil.findMany({ where: { entidadeId, deletedAt: null, aceitaLancamento: true } });

  const palavras = data.descricao
    .toLowerCase()
    .split(/[^a-zà-ú0-9]+/i)
    .filter((p) => p.length > 3);

  const ranking = contas
    .map((conta) => {
      const descricaoConta = conta.descricao.toLowerCase();
      const pontos = palavras.filter((p) => descricaoConta.includes(p)).length;
      return { conta, pontos };
    })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 3);

  if (ranking.length === 0) {
    throw AppError.badRequest("Nao foi possivel identificar contas contabeis compativeis com a descricao informada");
  }

  const sugestao = await prisma.iaSugestao.create({
    data: {
      entidadeId,
      modulo: data.modulo,
      registroId: data.registroId,
      tipo: "CLASSIFICACAO_CONTABIL",
      titulo: "Sugestao de classificacao contabil (PCASP)",
      conteudo:
        `Com base no historico "${data.descricao}", as contas contabeis mais compativeis sao:\n\n` +
        ranking.map((r) => `- **${r.conta.codigo}** - ${r.conta.descricao}`).join("\n"),
      dadosContexto: { descricao: data.descricao, ranking: ranking.map((r) => ({ contaId: r.conta.id, codigo: r.conta.codigo, pontos: r.pontos })) },
    },
  });

  res.status(201).json(sugestao);
});

// POST /gerar/inconsistencias - varre a base em busca de inconsistencias comuns
router.post("/gerar/inconsistencias", requirePermissao("IA", "GERAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const sugestoesGeradas: { titulo: string; conteudo: string; registroId?: string }[] = [];

  // 1. Liquidacoes de credores Pessoa Fisica sem calculo de retencao
  const liquidacoesSemRetencao = await prisma.liquidacao.findMany({
    where: {
      deletedAt: null,
      status: "LIQUIDADA",
      retencao: null,
      empenho: { entidadeId, deletedAt: null, credor: { tipoPessoa: "FISICA" } },
    },
    include: { empenho: { include: { credor: true } } },
    take: 50,
  });

  for (const liq of liquidacoesSemRetencao) {
    sugestoesGeradas.push({
      titulo: "Retencao tributaria pendente de calculo",
      conteudo: `A liquidacao numero ${liq.numero} do empenho ${liq.empenho.numero}, do credor pessoa fisica ${liq.empenho.credor.nome}, ainda nao possui calculo de retencao (INSS/IRRF). E necessario calcular as retencoes obrigatorias antes do pagamento.`,
      registroId: liq.id,
    });
  }

  // 2. Dotacoes com saldo disponivel negativo (excesso de empenho)
  const dotacoes = await prisma.dotacao.findMany({ where: { entidadeId, deletedAt: null } });
  for (const dot of dotacoes) {
    const saldoDisponivel =
      Number(dot.valorInicial) + Number(dot.valorAdicionado) - Number(dot.valorReduzido) - Number(dot.valorEmpenhado);
    if (saldoDisponivel < 0) {
      sugestoesGeradas.push({
        titulo: "Dotacao orcamentaria com saldo negativo",
        conteudo: `A dotacao ficha ${dot.ficha} (exercicio ${dot.exercicio}) apresenta saldo disponivel negativo de ${saldoDisponivel.toFixed(2)}. Recomenda-se a abertura de credito adicional ou revisao dos empenhos vinculados.`,
        registroId: dot.id,
      });
    }
  }

  // 3. Pagamentos sem comprovante anexado
  const pagamentosSemComprovante = await prisma.pagamento.findMany({
    where: { deletedAt: null, status: "PAGO", comprovanteUrl: null, liquidacao: { empenho: { entidadeId, deletedAt: null } } },
    take: 50,
  });
  for (const pag of pagamentosSemComprovante) {
    sugestoesGeradas.push({
      titulo: "Pagamento sem comprovante anexado",
      conteudo: `O pagamento numero ${pag.numero}, no valor de ${Number(pag.valor).toFixed(2)}, ainda nao possui comprovante de pagamento anexado.`,
      registroId: pag.id,
    });
  }

  const criadas = await prisma.$transaction(
    sugestoesGeradas.map((s) =>
      prisma.iaSugestao.create({
        data: {
          entidadeId,
          modulo: "CONTROLE_INTERNO",
          registroId: s.registroId,
          tipo: "INCONSISTENCIA",
          titulo: s.titulo,
          conteudo: s.conteudo,
        },
      })
    )
  );

  await registrarAuditoria({
    req,
    acao: "GERACAO_SUGESTOES_IA",
    modulo: "IA",
    entidadeAfetada: "ia_sugestoes",
    dadosNovos: { total: criadas.length },
  });

  res.status(201).json({ total: criadas.length, sugestoes: criadas });
});

export default router;
