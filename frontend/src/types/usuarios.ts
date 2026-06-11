export interface UsuarioListItem {
  id: string;
  nome: string;
  email: string;
  login: string;
  ativo: boolean;
  precisaTrocarSenha: boolean;
  ultimoLogin: string | null;
  perfilId: string;
  perfilNome: string;
}

export interface PerfilOption {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
}

export interface EntidadeConfiguracao {
  nome: string;
  municipio: string;
  uf: string;
  ordenadorNome: string | null;
  ordenadorCpf: string | null;
  ordenadorCargo: string | null;
  contadorNome: string | null;
  contadorDocumento: string | null;
  contadorCargo: string | null;
  diretorFinanceiroNome: string | null;
  diretorFinanceiroCpf: string | null;
  diretorFinanceiroCargo: string | null;
}
