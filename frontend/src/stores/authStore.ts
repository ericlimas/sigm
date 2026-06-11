import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  login: string;
  precisaTrocarSenha: boolean;
}

export interface EntidadeLogada {
  id: string;
  nome: string;
  tipo: string;
  municipio: string;
  uf: string;
}

export interface PerfilLogado {
  id: string;
  chave: string;
  nome: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioLogado | null;
  entidade: EntidadeLogada | null;
  perfil: PerfilLogado | null;
  permissoes: string[];
  setSession: (data: {
    accessToken: string;
    refreshToken: string;
    usuario: UsuarioLogado;
    entidade: EntidadeLogada;
    perfil: PerfilLogado;
    permissoes: string[];
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hasPermissao: (modulo: string, acao: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      entidade: null,
      perfil: null,
      permissoes: [],
      setSession: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          usuario: data.usuario,
          entidade: data.entidade,
          perfil: data.perfil,
          permissoes: data.permissoes,
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          usuario: null,
          entidade: null,
          perfil: null,
          permissoes: [],
        }),
      hasPermissao: (modulo, acao) => {
        const { perfil, permissoes } = get();
        if (perfil?.chave === "ADMINISTRADOR") return true;
        return permissoes.includes(`${modulo}:${acao}`);
      },
    }),
    { name: "sigm-auth" }
  )
);
