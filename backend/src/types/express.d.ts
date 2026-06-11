import "express";

export interface AuthContext {
  usuarioId: string;
  nome: string;
  email: string;
  entidadeId: string;
  entidadeNome: string;
  perfilId: string;
  perfilChave: string;
  permissoes: string[];
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}
