import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PerfilOption, UsuarioListItem } from "@/types/usuarios";

const usuarioSchema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  email: z.string().email("Informe um e-mail valido"),
  login: z.string().min(3, "Minimo 3 caracteres"),
  senha: z.string().optional(),
  perfilId: z.string().min(1, "Selecione um perfil"),
  ativo: z.boolean().optional(),
});

type UsuarioFormValues = z.infer<typeof usuarioSchema>;

const DEFAULT_VALUES: UsuarioFormValues = {
  nome: "",
  email: "",
  login: "",
  senha: "",
  perfilId: "",
  ativo: true,
};

export default function UsuariosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioListItem | null>(null);
  const [deleting, setDeleting] = useState<UsuarioListItem | null>(null);

  const podeCriar = hasPermissao("USUARIOS", "CRIAR");
  const podeEditar = hasPermissao("USUARIOS", "EDITAR");
  const podeExcluir = hasPermissao("USUARIOS", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get<{ data: UsuarioListItem[] }>("/usuarios")).data.data,
  });

  const perfisQuery = useQuery({
    queryKey: ["usuarios", "perfis"],
    queryFn: async () => (await api.get<{ data: PerfilOption[] }>("/usuarios/perfis")).data.data,
  });

  const usuarios = (listQuery.data ?? []).filter((u) => {
    const termo = search.trim().toLowerCase();
    if (!termo) return true;
    return (
      u.nome.toLowerCase().includes(termo) ||
      u.login.toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo)
    );
  });

  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioSchema) as Resolver<UsuarioFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.clearErrors();
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(usuario: UsuarioListItem) {
    setEditing(usuario);
    form.clearErrors();
    form.reset({
      nome: usuario.nome,
      email: usuario.email,
      login: usuario.login,
      senha: "",
      perfilId: usuario.perfilId,
      ativo: usuario.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: UsuarioFormValues) => {
      const payload: Record<string, unknown> = {
        nome: values.nome,
        email: values.email,
        login: values.login,
        perfilId: values.perfilId,
        ativo: values.ativo,
      };
      if (values.senha) payload.senha = values.senha;

      if (editing) {
        return (await api.put(`/usuarios/${editing.id}`, payload)).data;
      }
      return (await api.post("/usuarios", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({ title: editing ? "Usuario atualizado" : "Usuario criado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({ title: "Usuario desativado" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao desativar", description: getErrorMessage(error), variant: "destructive" }),
  });

  function onSubmit(values: UsuarioFormValues) {
    if (!editing && (!values.senha || values.senha.length < 6)) {
      form.setError("senha", { message: "Informe uma senha com no minimo 6 caracteres" });
      return;
    }
    if (values.senha && values.senha.length > 0 && values.senha.length < 6) {
      form.setError("senha", { message: "Minimo 6 caracteres" });
      return;
    }
    saveMutation.mutate(values);
  }

  const columns: DataTableColumn<UsuarioListItem>[] = [
    { header: "Nome", cell: (u) => <span className="font-medium">{u.nome}</span> },
    { header: "Login", cell: (u) => u.login, className: "w-32" },
    { header: "E-mail", cell: (u) => u.email },
    { header: "Perfil", cell: (u) => u.perfilNome, className: "w-44" },
    {
      header: "Status",
      className: "w-24",
      cell: (u) => <Badge variant={u.ativo ? "success" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (u) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && u.ativo && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(u)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Usuarios"
        description="Cadastro de usuarios com acesso ao sistema e seus perfis de permissao"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Usuario
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, login ou e-mail..." />
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={usuarios} isLoading={listQuery.isLoading} getRowId={(u) => u.id} />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Usuario" : "Novo Usuario"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Nome" htmlFor="nome" error={form.formState.errors.nome?.message}>
              <Input id="nome" {...form.register("nome")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Login" htmlFor="login" error={form.formState.errors.login?.message}>
                <Input id="login" {...form.register("login")} />
              </Field>
              <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
                <Input id="email" type="email" {...form.register("email")} />
              </Field>
            </div>
            <Field
              label={editing ? "Nova senha" : "Senha"}
              htmlFor="senha"
              error={form.formState.errors.senha?.message}
            >
              <Input
                id="senha"
                type="password"
                placeholder={editing ? "Deixe em branco para manter a atual" : ""}
                {...form.register("senha")}
              />
            </Field>
            <Field label="Perfil" htmlFor="perfilId" error={form.formState.errors.perfilId?.message}>
              <Controller
                control={form.control}
                name="perfilId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="perfilId">
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {(perfisQuery.data ?? []).map((perfil) => (
                        <SelectItem key={perfil.id} value={perfil.id}>
                          {perfil.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativo" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Desativar usuario"
        description={`Deseja realmente desativar o acesso de "${deleting?.nome}"? O usuario nao podera mais entrar no sistema.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Desativar"
      />
    </div>
  );
}
