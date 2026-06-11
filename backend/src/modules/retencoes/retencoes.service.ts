import { prisma } from "@/config/prisma";

export interface CalculoRetencaoResultado {
  baseInss: number;
  inssRetido: number;
  aliquotaInss: number;
  numeroDependentes: number;
  deducaoDependentes: number;
  baseIrrf: number;
  irrfRetido: number;
  aliquotaIrrf: number;
  valorLiquido: number;
}

interface CalcularRetencaoInput {
  entidadeId: string;
  valorBruto: number;
  dataReferencia: Date;
  numeroDependentes: number;
  naturezaServicoId?: string | null;
}

/**
 * Motor de calculo de retencoes tributarias (INSS/IRRF) para credores
 * Pessoa Fisica, conforme tabelas parametrizaveis por vigencia.
 *
 * - INSS: caso a Natureza do Servico tenha um percentual definido, aplica-se
 *   aliquota fixa (ex: 11% contribuinte individual) limitada ao teto
 *   previdenciario vigente. Caso contrario, aplica-se a tabela progressiva.
 * - IRRF: tabela progressiva, com deducao por dependente.
 */
export async function calcularRetencao({
  entidadeId,
  valorBruto,
  dataReferencia,
  numeroDependentes,
  naturezaServicoId,
}: CalcularRetencaoInput): Promise<CalculoRetencaoResultado> {
  const naturezaServico = naturezaServicoId
    ? await prisma.naturezaServico.findUnique({ where: { id: naturezaServicoId } })
    : null;

  const sujeitoInss = naturezaServico?.sujeitoInss ?? true;
  const sujeitoIrrf = naturezaServico?.sujeitoIrrf ?? true;

  // ---------------------------------------------------------------------
  // INSS
  // ---------------------------------------------------------------------
  let baseInss = 0;
  let inssRetido = 0;
  let aliquotaInss = 0;

  if (sujeitoInss) {
    baseInss = valorBruto;

    const faixasInss = await prisma.tabelaInssFaixa.findMany({
      where: {
        entidadeId,
        ativo: true,
        vigenciaInicio: { lte: dataReferencia },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dataReferencia } }],
      },
      orderBy: { faixaInicial: "asc" },
    });

    const tetoPrevidenciario = faixasInss.length
      ? Math.max(...faixasInss.map((f) => Number(f.tetoPrevidenciario)))
      : 0;

    if (naturezaServico) {
      aliquotaInss = Number(naturezaServico.percentualInss);
      inssRetido = baseInss * (aliquotaInss / 100);
    } else {
      const faixa = faixasInss.find(
        (f) => baseInss >= Number(f.faixaInicial) && (f.faixaFinal === null || baseInss <= Number(f.faixaFinal))
      );
      if (faixa) {
        aliquotaInss = Number(faixa.aliquota);
        inssRetido = baseInss * (aliquotaInss / 100) - Number(faixa.parcelaDeduzir);
      }
    }

    if (tetoPrevidenciario > 0 && inssRetido > tetoPrevidenciario) {
      inssRetido = tetoPrevidenciario;
    }
    if (inssRetido < 0) inssRetido = 0;
    inssRetido = round2(inssRetido);
  }

  // ---------------------------------------------------------------------
  // IRRF
  // ---------------------------------------------------------------------
  const deducaoFaixa = await prisma.tabelaIrrfDeducao.findFirst({
    where: {
      entidadeId,
      ativo: true,
      vigenciaInicio: { lte: dataReferencia },
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dataReferencia } }],
    },
    orderBy: { vigenciaInicio: "desc" },
  });

  const valorPorDependente = deducaoFaixa ? Number(deducaoFaixa.valorPorDependente) : 0;
  const deducaoDependentes = round2(numeroDependentes * valorPorDependente);

  let baseIrrf = 0;
  let irrfRetido = 0;
  let aliquotaIrrf = 0;

  if (sujeitoIrrf) {
    baseIrrf = round2(Math.max(0, valorBruto - inssRetido - deducaoDependentes));

    const faixasIrrf = await prisma.tabelaIrrfFaixa.findMany({
      where: {
        entidadeId,
        ativo: true,
        vigenciaInicio: { lte: dataReferencia },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dataReferencia } }],
      },
      orderBy: { baseInicial: "asc" },
    });

    const faixa = faixasIrrf.find(
      (f) => baseIrrf >= Number(f.baseInicial) && (f.baseFinal === null || baseIrrf <= Number(f.baseFinal))
    );

    if (faixa) {
      aliquotaIrrf = Number(faixa.aliquota);
      irrfRetido = baseIrrf * (aliquotaIrrf / 100) - Number(faixa.parcelaDeduzir);
    }
    if (irrfRetido < 0) irrfRetido = 0;
    irrfRetido = round2(irrfRetido);
  }

  const valorLiquido = round2(valorBruto - inssRetido - irrfRetido);

  return {
    baseInss: round2(baseInss),
    inssRetido,
    aliquotaInss,
    numeroDependentes,
    deducaoDependentes,
    baseIrrf,
    irrfRetido,
    aliquotaIrrf,
    valorLiquido,
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
