import { formatDate, formatValorAsterisco } from "@/lib/utils";
import type { TipoEmpenho } from "@/types/execucao";

export const LARGURA_DOC = 81;

export const TIPO_LABELS: Record<TipoEmpenho, string> = {
  ORDINARIO: "Ordinario",
  GLOBAL: "Global",
  ESTIMATIVO: "Estimativo",
};

export interface ResponsavelImprimir {
  nome: string | null;
  cpf?: string | null;
  documento?: string | null;
  cargo: string | null;
}

export interface SaldoDotacaoImprimir {
  saldoAnterior: number;
  valorEmpenhado: number;
  saldoAtual: number;
  totalEmpenhado: number;
  valorLiquidado: number;
  desconto: number;
  valorLiquido: number;
  saldoALiquidar: number;
  valorALiquidar: number;
}

export interface NotaEmpenhoCabecalho {
  numero: string;
  exercicio: number;
  tipo: TipoEmpenho;
  data: string;
  entidade: {
    nome: string;
    municipio: string;
    uf: string;
    ordenador: ResponsavelImprimir;
    contador: ResponsavelImprimir;
    diretorFinanceiro: ResponsavelImprimir;
  };
  credor: {
    nome: string;
    cpfCnpj: string;
    inscricaoEstadual: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    municipio: string | null;
    uf: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
  };
  dotacao: {
    ficha: number;
    orgaoCodigo: string;
    orgao: string;
    unidadeCodigo: string;
    unidade: string;
    funcao: string;
    subfuncao: string;
    programaCodigo?: string | null;
    programa?: string | null;
    acaoCodigo?: string | null;
    acao?: string | null;
    elementoDespesa: string;
    fonteRecurso: string;
  };
  processo: string | null;
  historico: string;
  valorLiquido: number;
  valorExtenso: string;
  saldoDotacao: SaldoDotacaoImprimir;
}

export function centralizar(texto: string, largura = LARGURA_DOC): string {
  if (texto.length >= largura) return texto;
  const espacos = largura - texto.length;
  return " ".repeat(Math.floor(espacos / 2)) + texto;
}

export function alinharDireita(texto: string, largura = LARGURA_DOC): string {
  if (texto.length >= largura) return texto;
  return " ".repeat(largura - texto.length) + texto;
}

export function campo(label: string, valor: string, largura = 17): string {
  const rotulo = label.length >= largura ? label : label.padEnd(largura, ".");
  return `${rotulo}: ${valor}`;
}

/** Linha com duas colunas "label..: valor" lado a lado, usada no resumo do saldo da dotacao */
export function linhaSaldo(labelEsq: string, valorEsq: number, labelDir: string, valorDir: number): string {
  const esq = campo(labelEsq, formatValorAsterisco(valorEsq, 12), 17);
  const dir = campo(labelDir, formatValorAsterisco(valorDir, 12), 17);
  return `${esq} : ${dir}`;
}

/** Linha com nome + documento/cargo de um responsavel, alinhados a direita (assinatura) */
export function linhasResponsavel(responsavel: ResponsavelImprimir, labelDocumento: "CPF" | "CRC"): string[] {
  if (!responsavel.nome) return [];
  const documento = responsavel.cpf ?? responsavel.documento;
  const linhas = [alinharDireita(responsavel.nome)];
  const detalhe = [documento ? `${labelDocumento}: ${documento}` : null, responsavel.cargo].filter(Boolean).join(" / ");
  if (detalhe) linhas.push(alinharDireita(detalhe));
  return linhas;
}

/** Abre uma janela separada apenas com o texto e aciona a impressao (evita conflitos de CSS/print com a SPA) */
export function imprimirDocumento(titulo: string, texto: string): void {
  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) return;

  const conteudo = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${titulo}</title>
<style>
  body { margin: 16px; font-family: "Courier New", Courier, monospace; font-size: 11px; line-height: 1.5; white-space: pre; color: #000; background: #fff; }
</style>
</head>
<body>${conteudo}</body>
</html>`);
  janela.document.close();
  janela.focus();
  janela.print();
}

/**
 * Monta as linhas comuns da Nota de Empenho: cabecalho, dados orcamentarios,
 * credor, valor empenhado, assinatura do ordenador e saldo da dotacao com
 * assinatura do contador. Usado tanto na impressao da Nota de Empenho quanto
 * no comprovante de pagamento (que adiciona as secoes de liquidacao/quitacao).
 */
export function buildCabecalhoNotaEmpenho(d: NotaEmpenhoCabecalho): string[] {
  const linhaSep = "-".repeat(LARGURA_DOC);
  const endereco = [d.credor.logradouro, d.credor.numero ? `Nº ${d.credor.numero}` : null, d.credor.complemento]
    .filter(Boolean)
    .join(", ");

  const classifOrcamentaria = [d.dotacao.funcao, d.dotacao.subfuncao, d.dotacao.programaCodigo, d.dotacao.acaoCodigo]
    .filter(Boolean)
    .join(".");
  const classifDescricao = d.dotacao.programa ?? d.dotacao.acao ?? "-";
  const saldo = d.saldoDotacao;

  const linhas: string[] = [];
  linhas.push(centralizar(d.entidade.nome.toUpperCase()));
  linhas.push("");
  linhas.push(centralizar(`NOTA DE EMPENHO Nº ${d.numero}`));
  linhas.push("");
  linhas.push("O ordenador da despesa, para efeito da execução orçamentária, determina que");
  linhas.push("seja empenhada neste exercício a importância abaixo discriminada.");
  linhas.push("");
  linhas.push(`Orçamento de: ${d.exercicio}    Tipo: ${TIPO_LABELS[d.tipo]}    Data: ${formatDate(d.data)}    Ficha: ${String(d.dotacao.ficha).padStart(6, "0")}`);
  linhas.push(linhaSep);
  linhas.push(campo("Órgão", `${d.dotacao.orgaoCodigo} - ${d.dotacao.orgao}`, 21));
  linhas.push(campo("Unidade", `${d.dotacao.unidadeCodigo} - ${d.dotacao.unidade}`, 21));
  linhas.push(campo("Classif. Orçamentária", `${classifOrcamentaria} - ${classifDescricao}`, 21));
  linhas.push(campo("Elemento da Despesa", d.dotacao.elementoDespesa, 21));
  linhas.push(campo("Fonte de Recurso", d.dotacao.fonteRecurso, 21));
  linhas.push(linhaSep);
  linhas.push(`Credor...: ${d.credor.nome}`);
  if (endereco) linhas.push(`Endereço.: ${endereco}    Bairro: ${d.credor.bairro ?? "-"}    CEP: ${d.credor.cep ?? "-"}`);
  linhas.push(`Cidade...: ${d.credor.municipio ?? "-"} - ${d.credor.uf ?? "-"}    CNPJ/CPF: ${d.credor.cpfCnpj}`);
  if (d.credor.banco) linhas.push(`Banco ...: ${d.credor.banco}    Agência..: ${d.credor.agencia ?? "-"}    Conta ..: ${d.credor.conta ?? "-"}`);
  linhas.push(linhaSep);
  linhas.push(`Pela presente fica empenhada a importância de R$ ${formatValorAsterisco(d.valorLiquido)}`);
  linhas.push(`${d.valorExtenso}.`);
  linhas.push(`Hist.: ${d.historico}`);
  linhas.push("");
  linhas.push(`Licitação.: Não se Aplica            Processo Nº.: ${d.processo ?? "-"}`);
  linhas.push("");
  linhas.push(`Data: ${formatDate(d.data)}    Presidente: ____________________________________`);
  linhas.push(...linhasResponsavel(d.entidade.ordenador, "CPF"));
  linhas.push(linhaSep);
  linhas.push(centralizar("Sendo o saldo da dotação orçamentária o abaixo demonstrado:"));
  linhas.push("");
  linhas.push(linhaSaldo("SALDO ANTERIOR", saldo.saldoAnterior, "VALOR LIQUIDADO", saldo.valorLiquidado));
  linhas.push(linhaSaldo("VALOR EMPENHADO", saldo.valorEmpenhado, "DESCONTO", saldo.desconto));
  linhas.push(linhaSaldo("SALDO ATUAL", saldo.saldoAtual, "VALOR LIQUIDO", saldo.valorLiquido));
  linhas.push(linhaSaldo("TOTAL EMPENHADO", saldo.totalEmpenhado, "SALDO A LIQUIDAR", saldo.saldoALiquidar));
  linhas.push(campo("VALOR A LIQUIDAR", formatValorAsterisco(saldo.valorALiquidar, 12), 17));
  linhas.push("");
  linhas.push(`Data: ${formatDate(d.data)}    Contador(a)/Contabilista: ________________________________`);
  linhas.push(...linhasResponsavel(d.entidade.contador, "CRC"));

  return linhas;
}
