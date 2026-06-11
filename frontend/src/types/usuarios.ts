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
