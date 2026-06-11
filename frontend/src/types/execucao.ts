import type { Credor, FonteRecurso } from "./cadastros";
import type { Dotacao } from "./orcamento";

export type TipoEmpenho = "ORDINARIO" | "GLOBAL" | "ESTIMATIVO";
export type StatusEmpenho = "NORMAL" | "ANULADO" | "ESTORNADO";
export type TipoMovimentoEmpenho = "REFORCO" | "ANULACAO" | "ESTORNO";
export type StatusLiquidacao = "PENDENTE" | "LIQUIDADA" | "ANULADA";
export type FormaPagamento = "PIX" | "TED" | "DOC" | "CHEQUE" | "DINHEIRO" | "CNAB";
export type StatusPagamento = "PENDENTE" | "PAGO" | "CANCELADO";
export type TipoConta = "CAIXA" | "BANCO" | "APLICACAO";

export interface EmpenhoMovimento {
  id: string;
  empenhoId: string;
  tipo: TipoMovimentoEmpenho;
  valor: number;
  data: string;
  justificativa: string;
  usuarioId: string;
  createdAt: string;
}

export interface RetencaoHistorico {
  id: string;
  retencaoId: string;
  campoAlterado: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  justificativa: string;
  usuarioId: string;
  createdAt: string;
}

export interface TabelaInssFaixa {
  id: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  faixaInicial: number;
  faixaFinal: number | null;
  aliquota: number;
  parcelaDeduzir: number;
  tetoPrevidenciario: number;
  ativo: boolean;
}

export interface TabelaIrrfFaixa {
  id: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  baseInicial: number;
  baseFinal: number | null;
  aliquota: number;
  parcelaDeduzir: number;
  ativo: boolean;
}

export interface TabelaIrrfDeducao {
  id: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  valorPorDependente: number;
  limiteFaixa1: number | null;
  reducaoMaxima: number | null;
  limiteFaixa2: number | null;
  constanteReducao: number | null;
  coeficienteReducao: number | null;
  ativo: boolean;
}

export interface RetencaoCalculo {
  id: string;
  liquidacaoId: string;
  credorId: string;
  naturezaServicoId: string | null;
  valorBruto: number;
  baseInss: number;
  inssRetido: number;
  aliquotaInss: number;
  numeroDependentes: number;
  deducaoDependentes: number;
  baseIrrf: number;
  irrfRetido: number;
  aliquotaIrrf: number;
  valorLiquido: number;
  calculoManual: boolean;
  justificativaAjuste: string | null;
  ajustadoPorId: string | null;
  historico?: RetencaoHistorico[];
}

export interface ContaBancaria {
  id: string;
  tipo: TipoConta;
  descricao: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  fonteRecursoId: string | null;
  fonteRecurso?: FonteRecurso | null;
  saldoInicial: number;
  saldoAtual?: number;
  ativo: boolean;
}

export interface Pagamento {
  id: string;
  liquidacaoId: string;
  numero: number;
  data: string;
  valor: number;
  formaPagamento: FormaPagamento;
  contaBancariaId: string;
  contaBancaria?: ContaBancaria;
  numeroOrdemPagamento: string | null;
  status: StatusPagamento;
  comprovanteUrl: string | null;
  liquidacao?: Liquidacao;
}

export interface Liquidacao {
  id: string;
  empenhoId: string;
  numero: number;
  data: string;
  documento: string | null;
  tipoDocumento: string | null;
  contratoId: string | null;
  historico: string;
  valor: number;
  status: StatusLiquidacao;
  empenho?: Empenho;
  retencao?: RetencaoCalculo | null;
  pagamentos?: Pagamento[];
}

export interface Empenho {
  id: string;
  entidadeId: string;
  exercicio: number;
  numero: number;
  tipo: TipoEmpenho;
  data: string;
  credorId: string;
  credor?: Credor;
  dotacaoId: string;
  dotacao?: Dotacao;
  processo: string | null;
  historico: string;
  valor: number;
  valorAnulado: number;
  valorLiquidado: number;
  valorPago: number;
  status: StatusEmpenho;
  restoAPagar: boolean;
  exercicioRestoAPagar: number | null;
  saldoNaoLiquidado?: number;
  movimentos?: EmpenhoMovimento[];
  liquidacoes?: Liquidacao[];
}
