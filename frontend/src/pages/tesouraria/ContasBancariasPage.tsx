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
import { formatCurrency } from "@/lib/utils";
import type { ContaBancaria, TipoConta } from "@/types/execucao";
import type { FonteRecurso } from "@/types/cadastros";

const TIPO_LABELS: Record<TipoConta, string> = {
  CAIXA: "Caixa",
  BANCO: "Banco",
  APLICACAO: "Aplicacao Financeira",
};

const NONE = "__none__";

const contaSchema = z.object({
  tipo: z.enum(["CAIXA", "BANCO", "APLICACAO"]),
  descricao: z.string().min(2, "Informe a descricao"),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  fonteRecursoId: z.string().optional(),
  saldoInicial: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number()),
  ativo: z.boolean().optional(),
});

type ContaFormValues = z.infer<typeof contaSchema>;

const DEFAULT_VALUES: ContaFormValues = {
  tipo: "BANCO",
  descricao: "",
  banco: "",
  agencia: "",
  conta: "",
  fonteRecursoId: undefined,
  saldoInicial: 0,
  ativo: true,
};

export default function ContasBancariasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [deleting, setDeleting] = useState<ContaBancaria | null>(null);

  const podeCriar = hasPermissao("TESOURARIA", "CRIAR");
  const podeEditar = hasPermissao("TESOURARIA", "EDITAR");
  const podeExcluir = hasPermissao("TESOURARIA", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["tesouraria-contas"],
    queryFn: async () => (await api.get<ContaBancaria[]>("/tesouraria/contas")).data,
  });

  const fontesQuery = useQuery({
    queryKey: ["fontes-recurso-all"],
    queryFn: async () => (await api.get<{ data: FonteRecurso[] }>("/fontes-recurso", { params: { ativo: true } })).data.data,
  });

  const form = useForm<ContaFormValues>({
    resolver: zodResolver(contaSchema) as Resolver<ContaFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(conta: ContaBancaria) {
    setEditing(conta);
    form.reset({
      tipo: conta.tipo,
      descricao: conta.descricao,
      banco: conta.banco ?? "",
      agencia: conta.agencia ?? "",
      conta: conta.conta ?? "",
      fonteRecursoId: conta.fonteRecursoId ?? undefined,
      saldoInicial: Number(conta.saldoInicial),
      ativo: conta.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ContaFormValues) => {
      const payload = {
        ...values,
        banco: values.banco || null,
        agencia: values.agencia || null,
        conta: values.conta || null,
        fonteRecursoId: values.fonteRecursoId || null,
      };
      if (editing) {
        return (await api.put(`/tesouraria/contas/${editing.id}`, payload)).data;
      }
      return (await api.post("/tesouraria/contas", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] });
      toast({ title: editing ? "Conta atualizada" : "Conta criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tesouraria/contas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] });
      toast({ title: "Conta excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<ContaBancaria>[] = [
    { header: "Descricao", cell: (c) => <span className="font-medium">{c.descricao}</span> },
    { header: "Tipo", className: "w-36", cell: (c) => <Badge variant="outline">{TIPO_LABELS[c.tipo]}</Badge> },
    {
      header: "Banco/Agencia/Conta",
      className: "w-48",
      cell: (c) => (c.banco ? `${c.banco} / ${c.agencia ?? "-"} / ${c.conta ?? "-"}` : "-"),
    },
    { header: "Fonte de Recurso", cell: (c) => c.fonteRecurso?.descricao ?? "-" },
    {
      header: "Saldo Inicial",
      className: "w-32 text-right",
      cell: (c) => <span className="font-mono">{formatCurrency(c.saldoInicial)}</span>,
    },
    {
      header: "Saldo Atual",
      className: "w-32 text-right",
      cell: (c) => <span className="font-mono font-medium">{formatCurrency(c.saldoAtual ?? c.saldoInicial)}</span>,
    },
    {
      header: "Status",
      className: "w-24",
      cell: (c) => <Badge variant={c.ativo ? "success" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(c)}>
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
        title="Contas Bancarias"
        description="Cadastro de contas correntes, caixa e aplicacoes financeiras utilizadas pela tesouraria"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Conta
            </Button>
          )
        }
      />

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data ?? []} isLoading={listQuery.isLoading} getRowId={(c) => c.id} />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Conta Bancaria" : "Nova Conta Bancaria"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo" htmlFor="tipo">
                <Controller
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoConta)}>
                      <SelectTrigger id="tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message}>
                <Input id="descricao" {...form.register("descricao")} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Banco" htmlFor="banco">
                <Input id="banco" {...form.register("banco")} />
              </Field>
              <Field label="Agencia" htmlFor="agencia">
                <Input id="agencia" {...form.register("agencia")} />
              </Field>
              <Field label="Conta" htmlFor="conta">
                <Input id="conta" {...form.register("conta")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fonte de Recurso" htmlFor="fonteRecursoId">
                <Controller
                  control={form.control}
                  name="fonteRecursoId"
                  render={({ field }) => (
                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                      <SelectTrigger id="fonteRecursoId">
                        <SelectValue placeholder="Nao vinculada" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nao vinculada</SelectItem>
                        {fontesQuery.data?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.codigo} - {f.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Saldo Inicial" htmlFor="saldoInicial" error={form.formState.errors.saldoInicial?.message}>
                <Input id="saldoInicial" type="number" step="0.01" {...form.register("saldoInicial")} />
              </Field>
            </div>

            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativo" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativo">Ativa</Label>
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
        title="Excluir conta bancaria"
        description={`Deseja realmente excluir a conta "${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
