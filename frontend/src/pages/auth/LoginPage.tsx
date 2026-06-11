import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface EntidadeOption {
  id: string;
  nome: string;
  tipo: string;
  municipio: string;
  uf: string;
  perfil: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const setSession = useAuthStore((s) => s.setSession);

  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [entidades, setEntidades] = useState<EntidadeOption[] | null>(null);
  const [entidadeId, setEntidadeId] = useState("");

  async function efetuarLogin(payload: { login: string; senha: string; entidadeId?: string }) {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", payload);

      if (data.requiresEntidadeSelection) {
        setEntidades(data.entidades);
        return;
      }

      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        usuario: data.usuario,
        entidade: data.entidade,
        perfil: data.perfil,
        permissoes: data.permissoes,
      });

      if (data.usuario.precisaTrocarSenha) {
        toast({
          title: "Troca de senha obrigatoria",
          description: "Por seguranca, altere sua senha no menu do usuario.",
        });
      }

      navigate("/", { replace: true });
    } catch (error) {
      toast({ title: "Falha no login", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmitCredenciais(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !senha) return;
    efetuarLogin({ login: login.trim(), senha });
  }

  function handleSubmitEntidade(e: React.FormEvent) {
    e.preventDefault();
    if (!entidadeId) return;
    efetuarLogin({ login: login.trim(), senha, entidadeId });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <img
            src="/logo-sindicato.png"
            alt="Sindicato dos Produtores Rurais Janaúba"
            className="mx-auto mb-2 h-14 w-auto object-contain"
          />
          <CardTitle className="text-xl">Financeiro</CardTitle>
          <CardDescription>Sindicato dos Produtores Rurais Janaúba</CardDescription>
        </CardHeader>
        <CardContent>
          {!entidades ? (
            <form className="space-y-4" onSubmit={handleSubmitCredenciais}>
              <div className="space-y-1.5">
                <Label htmlFor="login">Usuario</Label>
                <Input
                  id="login"
                  placeholder="login ou e-mail"
                  autoComplete="username"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmitEntidade}>
              <p className="text-xs text-muted-foreground">
                Seu usuario possui acesso a mais de uma entidade. Selecione com qual deseja trabalhar:
              </p>
              <div className="space-y-1.5">
                {entidades.map((ent) => (
                  <label
                    key={ent.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-sm transition-colors hover:bg-accent/10 ${
                      entidadeId === ent.id ? "border-primary bg-accent/10" : "border-border"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{ent.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ent.municipio}/{ent.uf} - {ent.perfil}
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="entidade"
                      value={ent.id}
                      checked={entidadeId === ent.id}
                      onChange={() => setEntidadeId(ent.id)}
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEntidades(null)}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || !entidadeId}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
