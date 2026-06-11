export interface DashboardResumo {
  exercicio: number;
  receita: { previsto: number; arrecadado: number; percentual: number };
  despesa: {
    fixado: number;
    empenhado: number;
    liquidado: number;
    pago: number;
    percentualExecutado: number;
  };
  saldoBancario: number;
  restosAPagar: { total: number; quantidade: number };
  convenios: { total: number; emExecucao: number; valorTotal: number };
}

export interface LimitesLrf {
  exercicio: number;
  receitaCorrenteLiquida: number;
  despesaComPessoal: { valor: number; percentualRcl: number; limiteLegal: number };
  manutencaoEnsino: { valor: number; percentualReceita: number; limiteMinimoConstitucional: number };
  acoesServicosSaude: { valor: number; percentualReceita: number; limiteMinimoConstitucional: number };
}

export interface IndicadorSecretaria {
  orgao: string;
  codigo: string;
  fixado: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  percentualExecutado: number;
}

export interface ReceitaDespesaMensal {
  mes: number;
  receitaArrecadada: number;
  despesaEmpenhada: number;
}

export interface DespesaPorFuncao {
  funcao: string;
  valorEmpenhado: number;
}
