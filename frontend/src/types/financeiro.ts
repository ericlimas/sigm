import type { ContaContabil, FonteRecurso } from "./cadastros";
import type { ContaBancaria } from "./execucao";
import type { CategoriaReceita } from "./orcamento";

export type TipoMovimentoBancario = "CREDITO" | "DEBITO";
export type OrigemMovimentoBancario = "PAGAMENTO" | "RECEITA" | "TRANSFERENCIA" | "AJUSTE" | "MANUAL" | "ARQUIVO";
export type TipoArquivoImportacao = "OFX" | "CNAB240" | "CNAB400";
export type TipoReceita = "ORCAMENTARIA" | "EXTRAORCAMENTARIA";
export type TipoLancamentoContabil = "AUTOMATICO" | "MANUAL";
export type TipoPartidaContabil = "DEBITO" | "CREDITO";
export type StatusPeriodoContabil = "ABERTO" | "ENCERRADO";

export interface ConciliacaoBancaria {
  id: string;
  movimentoBancarioId: string;
  dataConciliacao: string;
  usuarioId: string;
  observacao: string | null;
}

export interface MovimentoBancario {
  id: string;
  contaBancariaId: string;
  contaBancaria?: ContaBancaria;
  data: string;
  tipo: TipoMovimentoBancario;
  historico: string;
  valor: number;
  origem: OrigemMovimentoBancario;
  conciliado: boolean;
  conciliacao?: ConciliacaoBancaria | null;
}

export interface ImportacaoArquivo {
  id: string;
  contaBancariaId: string;
  contaBancaria?: ContaBancaria;
  tipo: TipoArquivoImportacao;
  nomeArquivo: string;
  totalRegistros: number;
  totalConciliados: number;
  createdAt: string;
}

export interface ReceitaLancamento {
  id: string;
  entidadeId: string;
  exercicio: number;
  data: string;
  tipo: TipoReceita;
  categoria: CategoriaReceita;
  codigoReceita: string | null;
  descricao: string;
  documento: string | null;
  fonteRecursoId: string | null;
  fonteRecurso?: FonteRecurso | null;
  contaBancariaId: string;
  contaBancaria?: ContaBancaria;
  valor: number;
  movimentosBancarios?: MovimentoBancario[];
}

export interface LancamentoContabilPartida {
  id: string;
  lancamentoId: string;
  contaContabilId: string;
  contaContabil?: ContaContabil;
  tipo: TipoPartidaContabil;
  valor: number;
  historico: string | null;
}

export interface LancamentoContabil {
  id: string;
  entidadeId: string;
  exercicio: number;
  numero: number;
  data: string;
  historico: string;
  tipo: TipoLancamentoContabil;
  origemModulo: string | null;
  origemId: string | null;
  usuarioId: string;
  partidas: LancamentoContabilPartida[];
}

export interface PeriodoContabil {
  entidadeId: string;
  exercicio: number;
  mes: number;
  status: StatusPeriodoContabil;
  dataEncerramento: string | null;
  usuarioEncerramentoId?: string | null;
}
