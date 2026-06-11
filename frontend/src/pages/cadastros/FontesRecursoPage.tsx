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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FonteRecurso } from "@/types/cadastros";

const fonteSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  descricao: z.string().min(2, "Informe a descricao"),
  especificacao: z.string().optional(),
  exercicio: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().optional()
  ),
  ativo: z.boolean().optional(),
});

type FonteFormValues = z.infer<typeof fonteSchema>;

const DEFAULT_VALUES: FonteFormValues = {
  codigo: "",
  descricao: "",
  especificacao: "",
  exercicio: undefined,
  ativo: true,
};

export default function FontesRecursoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FonteRecurso | null>(null);
  const [deleting, setDeleting] = useState<FonteRecurso | null>(null);

  const podeCriar = hasPermissao("FONTES_RECURSO", "CRIAR");
  const podeEditar = hasPermissao("FONTES_RECURSO", "EDITAR");
  const podeExcluir = hasPermissao("FONTES_RECURSO", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["fontes-recurso", search],
    queryFn: async () =>
      (await api.get<{ data: FonteRecurso[] }>("/fontes-recurso", { params: { q: search || undefined } })).data.data,
  });

  const form = useForm<FonteFormValues>({
    resolver: zodResolver(fonteSchema) as Resolver<FonteFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(fonte: FonteRecurso) {
    setEditing(fonte);
    form.reset({
      codigo: fonte.codigo,
      descricao: fonte.descricao,
      especificacao: fonte.especificacao ?? "",
      exercicio: fonte.exercicio ?? undefined,
      ativo: fonte.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FonteFormValues) => {
      const payload = { ...values, especificacao: values.especificacao || null };
      if (editing) {
        return (await api.put(`/fontes-recurso/${editing.id}`, payload)).data;
      }
      return (await api.post("/fontes-recurso", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fontes-recurso"] });
      toast({ title: editing ? "Fonte de recurso atualizada" : "Fonte de recurso criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/fontes-recurso/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fontes-recurso"] });
      toast({ title: "Fonte de recurso excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<FonteRecurso>[] = [
    { header: "Codigo", cell: (f) => <span className="font-medium">{f.codigo}</span>, className: "w-28" },
    { header: "Descricao", cell: (f) => f.descricao },
    { header: "Especificacao", cell: (f) => f.especificacao ?? "-" },
    { header: "Exercicio", cell: (f) => f.exercicio ?? "-", className: "w-24" },
    {
      header: "Status",
      className: "w-24",
      cell: (f) => <Badge variant={f.ativo ? "success" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (f) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(f)}>
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
        title="Fontes de Recurso"
        description="Cadastro de fontes de recurso utilizadas na vinculacao orcamentaria e financeira"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Fonte
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por codigo ou descricao..." />
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data ?? []} isLoading={listQuery.isLoading} getRowId={(f) => f.id} />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Fonte de Recurso" : "Nova Fonte de Recurso"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codigo" htmlFor="codigo" error={form.formState.errors.codigo?.message}>
                <Input id="codigo" {...form.register("codigo")} />
              </Field>
              <Field label="Exercicio" htmlFor="exercicio" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...form.register("exercicio")} />
              </Field>
            </div>
            <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message}>
              <Input id="descricao" {...form.register("descricao")} />
            </Field>
            <Field label="Especificacao" htmlFor="especificacao">
              <Input id="especificacao" {...form.register("especificacao")} />
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
        title="Excluir fonte de recurso"
        description={`Deseja realmente excluir a fonte "${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
