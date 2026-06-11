import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { AppError } from "@/utils/AppError";
import { registrarAuditoria } from "@/utils/audit";
import { requirePermissao } from "@/middleware/rbac";

const router = Router();

const contaSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  natureza: z.enum([
    "ATIVO",
    "PASSIVO",
    "PATRIMONIO_LIQUIDO",
    "VPA",
    "VPD",
    "CONTROLE_DEVEDOR",
    "CONTROLE_CREDOR",
    "ORCAMENTARIA_RECEITA",
    "ORCAMENTARIA_DESPESA",
  ]),
  classe: z.coerce.number().int().min(1).max(8),
  nivel: z.coerce.number().int().min(1),
  contaPaiId: z.string().uuid().optional().nullable(),
  aceitaLancamento: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

// GET /api/plano-contas?arvore=true -> retorna estrutura hierarquica completa do PCASP
router.get("/", requirePermissao("PLANO_CONTAS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const { q, classe, aceitaLancamento, arvore } = req.query;

  const contas = await prisma.contaContabil.findMany({
    where: {
      entidadeId,
      deletedAt: null,
      ...(classe ? { classe: Number(classe) } : {}),
      ...(aceitaLancamento !== undefined ? { aceitaLancamento: aceitaLancamento === "true" } : {}),
      ...(q
        ? {
            OR: [
              { descricao: { contains: String(q), mode: "insensitive" as const } },
              { codigo: { contains: String(q) } },
            ],
          }
        : {}),
    },
    orderBy: { codigo: "asc" },
  });

  if (arvore === "true") {
    const map = new Map(contas.map((c) => [c.id, { ...c, filhos: [] as unknown[] }]));
    const raiz: unknown[] = [];
    for (const conta of map.values()) {
      if (conta.contaPaiId && map.has(conta.contaPaiId)) {
        (map.get(conta.contaPaiId)!.filhos as unknown[]).push(conta);
      } else {
        raiz.push(conta);
      }
    }
    return res.json({ data: raiz });
  }

  res.json({ data: contas });
});

router.get("/:id", requirePermissao("PLANO_CONTAS", "VISUALIZAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const conta = await prisma.contaContabil.findFirst({
    where: { id: req.params.id, entidadeId, deletedAt: null },
  });
  if (!conta) throw AppError.notFound("Conta contabil nao encontrada");
  res.json(conta);
});

router.post("/", requirePermissao("PLANO_CONTAS", "CRIAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = contaSchema.parse(req.body);

  const conta = await prisma.contaContabil.create({ data: { ...data, entidadeId } });

  await registrarAuditoria({
    req,
    acao: "CREATE",
    modulo: "PLANO_CONTAS",
    entidadeAfetada: "plano_contas",
    registroId: conta.id,
    dadosNovos: conta,
  });

  res.status(201).json(conta);
});

router.put("/:id", requirePermissao("PLANO_CONTAS", "EDITAR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const data = contaSchema.partial().parse(req.body);

  const atual = await prisma.contaContabil.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Conta contabil nao encontrada");

  const conta = await prisma.contaContabil.update({ where: { id: atual.id }, data });

  await registrarAuditoria({
    req,
    acao: "UPDATE",
    modulo: "PLANO_CONTAS",
    entidadeAfetada: "plano_contas",
    registroId: conta.id,
    dadosAnteriores: atual,
    dadosNovos: conta,
  });

  res.json(conta);
});

router.delete("/:id", requirePermissao("PLANO_CONTAS", "EXCLUIR"), async (req, res) => {
  const { entidadeId } = req.authContext!;
  const atual = await prisma.contaContabil.findFirst({ where: { id: req.params.id, entidadeId, deletedAt: null } });
  if (!atual) throw AppError.notFound("Conta contabil nao encontrada");

  const conta = await prisma.contaContabil.update({
    where: { id: atual.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await registrarAuditoria({
    req,
    acao: "DELETE",
    modulo: "PLANO_CONTAS",
    entidadeAfetada: "plano_contas",
    registroId: conta.id,
    dadosAnteriores: atual,
  });

  res.status(204).send();
});

export default router;
