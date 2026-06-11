export type TipoPessoa = "FISICA" | "JURIDICA";
export type ClassificacaoCredor = "SERVIDOR" | "AUTONOMO" | "FORNECEDOR" | "PRESTADOR_SERVICO" | "OUTROS";
export type TipoContaBancaria = "CORRENTE" | "POUPANCA" | "PAGAMENTO";

export interface Credor {
  id: string;
  tipoPessoa: TipoPessoa;
  cpfCnpj: string;
  nome: string;
  nomeFantasia: string | null;
  classificacao: ClassificacaoCredor;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipoConta: TipoContaBancaria | null;
  chavePix: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  regimeTributario: string | null;
  dataNascimento: string | null;
  numeroDependentes: number;
  ativo: boolean;
}

export type TipoOrgao = "ORGAO" | "SECRETARIA" | "FUNDO" | "AUTARQUIA" | "FUNDACAO" | "PODER_LEGISLATIVO";

export interface UnidadeOrcamentaria {
  id: string;
  codigo: string;
  nome: string;
  orgaoId: string;
  ativo: boolean;
  orgao?: Orgao;
}

export interface Orgao {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoOrgao;
  orgaoSuperiorId: string | null;
  orgaoSuperior?: Orgao | null;
  unidadesOrcamentarias?: UnidadeOrcamentaria[];
  ativo: boolean;
}

export interface FonteRecurso {
  id: string;
  codigo: string;
  descricao: string;
  especificacao: string | null;
  exercicio: number | null;
  ativo: boolean;
}

export type NaturezaContaContabil =
  | "ATIVO"
  | "PASSIVO"
  | "PATRIMONIO_LIQUIDO"
  | "VPA"
  | "VPD"
  | "CONTROLE_DEVEDOR"
  | "CONTROLE_CREDOR"
  | "ORCAMENTARIA_RECEITA"
  | "ORCAMENTARIA_DESPESA";

export interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
  natureza: NaturezaContaContabil;
  classe: number;
  nivel: number;
  contaPaiId: string | null;
  aceitaLancamento: boolean;
  ativo: boolean;
  filhos?: ContaContabil[];
}

export interface NaturezaServico {
  id: string;
  codigo: string;
  descricao: string;
  codigoReceita: string | null;
  contaContabilId: string | null;
  contaContabil?: ContaContabil | null;
  percentualInss: number;
  sujeitoInss: boolean;
  sujeitoIrrf: boolean;
  ativo: boolean;
}
