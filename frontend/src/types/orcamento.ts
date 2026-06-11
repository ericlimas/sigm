import type { FonteRecurso, Orgao, UnidadeOrcamentaria } from "./cadastros";

export type TipoAcaoPpa = "PROJETO" | "ATIVIDADE" | "OPERACAO_ESPECIAL";

export interface PpaAcao {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoAcaoPpa;
  metaFisica: string | null;
  unidadeMedida: string | null;
  programaId: string;
  ativo: boolean;
}

export interface PpaPrograma {
  id: string;
  codigo: string;
  nome: string;
  objetivo: string | null;
  ppaId: string;
  ativo: boolean;
  acoes?: PpaAcao[];
}

export interface Ppa {
  id: string;
  anoInicio: number;
  anoFim: number;
  lei: string | null;
  dataAprovacao: string | null;
  ativo: boolean;
  programas?: PpaPrograma[];
}

export interface LdoMetaFiscal {
  id: string;
  ano: number;
  descricao: string;
  valorPrevisto: number;
  ldoId: string;
}

export interface LdoPrioridade {
  id: string;
  ordem: number;
  descricao: string;
  ldoId: string;
}

export interface Ldo {
  id: string;
  exercicio: number;
  lei: string | null;
  dataAprovacao: string | null;
  ativo: boolean;
  metasFiscais?: LdoMetaFiscal[];
  prioridades?: LdoPrioridade[];
}

export type CategoriaReceita = "IPTU" | "ISS" | "ITBI" | "TAXAS" | "CONVENIO" | "TRANSFERENCIA" | "OUTRAS";

export interface ReceitaPrevista {
  id: string;
  codigoReceita: string;
  descricao: string;
  categoria: CategoriaReceita;
  valorPrevisto: number;
  valorAtualizado: number;
  loaId: string;
}

export interface Loa {
  id: string;
  exercicio: number;
  lei: string | null;
  dataAprovacao: string | null;
  valorTotalReceita: number;
  valorTotalDespesa: number;
  ativo: boolean;
  receitasPrevistas?: ReceitaPrevista[];
}

export interface Dotacao {
  id: string;
  loaId: string;
  exercicio: number;
  ficha: number;
  orgaoId: string;
  unidadeOrcamentariaId: string;
  funcao: string;
  subfuncao: string;
  programaId: string | null;
  acaoId: string | null;
  categoriaEconomica: string;
  grupoDespesa: string;
  modalidadeAplicacao: string;
  elementoDespesa: string;
  fonteRecursoId: string;
  valorInicial: number;
  valorAdicionado: number;
  valorReduzido: number;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
  valorAtualizado: number;
  saldoDisponivel: number;
  saldoReservado: number;
  saldoAPagar: number;
  ativo: boolean;
  orgao?: Orgao;
  unidadeOrcamentaria?: UnidadeOrcamentaria;
  fonteRecurso?: FonteRecurso;
  programa?: PpaPrograma | null;
  acao?: PpaAcao | null;
}

export type TipoCreditoAdicional = "SUPLEMENTAR" | "ESPECIAL" | "EXTRAORDINARIO";

export interface CreditoAdicional {
  id: string;
  exercicio: number;
  tipo: TipoCreditoAdicional;
  numero: string;
  decreto: string | null;
  data: string;
  dotacaoDestinoId: string;
  dotacaoOrigemId: string | null;
  fonteRecursoDescricao: string | null;
  valor: number;
  justificativa: string | null;
  dotacaoDestino?: Dotacao;
  dotacaoOrigem?: Dotacao | null;
}
