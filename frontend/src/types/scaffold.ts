import type { Credor } from "@/types/cadastros";

// ---------------------------------------------------------------------------
// Licitacoes
// ---------------------------------------------------------------------------

export type ModalidadeLicitacao =
  | "DISPENSA"
  | "INEXIGIBILIDADE"
  | "PREGAO"
  | "CONCORRENCIA"
  | "CREDENCIAMENTO"
  | "CONCURSO"
  | "LEILAO";

export type StatusLicitacao = "EM_ANDAMENTO" | "HOMOLOGADA" | "FRACASSADA" | "DESERTA" | "REVOGADA" | "ANULADA";

export interface LicitacaoItem {
  id: string;
  licitacaoId: string;
  item: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorEstimado: number;
  vencedorCredorId: string | null;
  vencedorCredor?: Credor | null;
  valorVencedor: number | null;
}

export interface Licitacao {
  id: string;
  exercicio: number;
  numero: string;
  modalidade: ModalidadeLicitacao;
  objeto: string;
  processo: string | null;
  dataAbertura: string;
  valorEstimado: number;
  valorHomologado: number;
  status: StatusLicitacao;
  itens?: LicitacaoItem[];
  contratos?: Contrato[];
}

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

export type StatusContrato = "VIGENTE" | "ENCERRADO" | "RESCINDIDO" | "SUSPENSO";
export type TipoAditivo = "PRAZO" | "VALOR" | "PRAZO_VALOR" | "QUALITATIVO";

export interface ContratoAditivo {
  id: string;
  contratoId: string;
  numero: number;
  tipo: TipoAditivo;
  data: string;
  valor: number | null;
  novaDataFim: string | null;
  descricao: string | null;
}

export interface Contrato {
  id: string;
  numero: string;
  exercicio: number;
  licitacaoId: string | null;
  licitacao?: Licitacao | null;
  credorId: string;
  credor?: Credor;
  objeto: string;
  dataInicio: string;
  dataFim: string;
  valor: number;
  valorAditivado: number;
  status: StatusContrato;
  aditivos?: ContratoAditivo[];
}

// ---------------------------------------------------------------------------
// Convenios
// ---------------------------------------------------------------------------

export type StatusConvenio = "EM_EXECUCAO" | "CONCLUIDO" | "CANCELADO" | "EM_PRESTACAO_CONTAS";

export interface Convenio {
  id: string;
  numero: string;
  exercicio: number;
  concedente: string | null;
  convenente: string | null;
  objeto: string;
  valorTotal: number;
  valorContrapartida: number;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: StatusConvenio;
}

// ---------------------------------------------------------------------------
// Almoxarifado
// ---------------------------------------------------------------------------

export type TipoMovimentoEstoque = "ENTRADA" | "SAIDA" | "TRANSFERENCIA" | "AJUSTE";

export interface MovimentoEstoque {
  id: string;
  materialId: string;
  tipo: TipoMovimentoEstoque;
  data: string;
  quantidade: number;
  valorUnitario: number;
  documento: string | null;
  origemModulo: string | null;
  observacao: string | null;
  createdAt: string;
}

export interface Material {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  categoria: string | null;
  estoqueAtual: number;
  estoqueMinimo: number;
  valorMedio: number;
  ativo: boolean;
  movimentos?: MovimentoEstoque[];
}

// ---------------------------------------------------------------------------
// Patrimonio
// ---------------------------------------------------------------------------

export type CategoriaBem = "MOVEL" | "IMOVEL" | "VEICULO" | "EQUIPAMENTO_TI" | "OUTROS";
export type StatusBem = "ATIVO" | "TRANSFERIDO" | "BAIXADO" | "EM_MANUTENCAO";
export type TipoMovimentoBem = "AQUISICAO" | "TRANSFERENCIA" | "BAIXA" | "DEPRECIACAO" | "REAVALIACAO";

export interface BemMovimentacao {
  id: string;
  bemId: string;
  tipo: TipoMovimentoBem;
  data: string;
  valor: number | null;
  localOrigem: string | null;
  localDestino: string | null;
  descricao: string | null;
  createdAt: string;
}

export interface Bem {
  id: string;
  numeroTombamento: string;
  descricao: string;
  categoria: CategoriaBem;
  dataAquisicao: string;
  valorAquisicao: number;
  valorAtual: number;
  vidaUtilAnos: number | null;
  taxaDepreciacaoAnual: number | null;
  localizacao: string | null;
  responsavelCredorId: string | null;
  responsavelCredor?: Credor | null;
  status: StatusBem;
  movimentacoes?: BemMovimentacao[];
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: string;
  entidadeId: string | null;
  usuarioId: string | null;
  usuario?: { id: string; nome: string; email: string } | null;
  acao: string;
  modulo: string;
  entidadeAfetada: string | null;
  registroId: string | null;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------

export type TipoSugestaoIA =
  | "CLASSIFICACAO_CONTABIL"
  | "FONTE_RECURSO"
  | "NATUREZA_DESPESA"
  | "INCONSISTENCIA"
  | "RETENCAO_TRIBUTARIA"
  | "PARECER_CONTROLE_INTERNO";

export type StatusSugestaoIA = "PENDENTE" | "ACEITA" | "REJEITADA";

export interface IaSugestao {
  id: string;
  modulo: string;
  registroId: string | null;
  tipo: TipoSugestaoIA;
  titulo: string;
  conteudo: string;
  dadosContexto: unknown;
  status: StatusSugestaoIA;
  usuarioId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Transparencia (portal publico)
// ---------------------------------------------------------------------------

export interface TransparenciaReceita {
  id: string;
  data: string;
  tipo: string;
  categoria: string;
  codigoReceita: string | null;
  descricao: string | null;
  valor: number;
}

export interface TransparenciaDespesa {
  id: string;
  numero: string;
  data: string;
  tipo: string;
  status: string;
  historico: string;
  valor: number;
  valorAnulado: number;
  valorLiquidado: number;
  valorPago: number;
  credor: { nome: string; cpfCnpj: string };
  dotacao: { funcao: string; subfuncao: string; elementoDespesa: string; fonteRecurso: { descricao: string } };
}

export interface TransparenciaLicitacao {
  id: string;
  numero: string;
  modalidade: ModalidadeLicitacao;
  objeto: string;
  dataAbertura: string;
  valorEstimado: number;
  valorHomologado: number;
  status: StatusLicitacao;
}

export interface TransparenciaContrato {
  id: string;
  numero: string;
  objeto: string;
  dataInicio: string;
  dataFim: string;
  valor: number;
  valorAditivado: number;
  status: StatusContrato;
  credor: { nome: string; cpfCnpj: string };
}
