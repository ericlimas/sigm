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
import type { ContaContabil, NaturezaServico } from "@/types/cadastros";

const NONE = "__none__";

const naturezaSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  descricao: z.string().min(2, "Informe a descricao"),
  codigoReceita: z.string().optional(),
  contaContabilId: z.string().optional(),
  percentualInss: z.preprocess((v) => (v === "" || v === undefined ? 11 : Number(v)), z.number().min(0).max(100)),
  sujeitoInss: z.boolean().optional(),
  sujeitoIrrf: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

type NaturezaFormValues = z.infer<typeof naturezaSchema>;

const DEFAULT_VALUES: NaturezaFormValues = {
  codigo: "",
  descricao: "",
  codigoReceita: "",
  contaContabilId: undefined,
  percentualInss: 11,
  sujeitoInss: true,
  sujeitoIrrf: true,
  ativo: true,
};

export default function NaturezasServicoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NaturezaServico | null>(null);
  const [deleting, setDeleting] = useState<NaturezaServico | null>(null);

  const podeCriar = hasPermissao("RETENCOES", "CRIAR");
  const podeEditar = hasPermissao("RETENCOES", "EDITAR");
  const podeExcluir = hasPermissao("RETENCOES", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["naturezas-servico"],
    queryFn: async () => (await api.get<{ data: NaturezaServico[] }>("/naturezas-servico")).data.data,
  });

  const contasQuery = useQuery({
    queryKey: ["plano-contas", "vpd-lancamento"],
    queryFn: async () =>
      (
        await api.get<{ data: ContaContabil[] }>("/plano-contas", {
          params: { aceitaLancamento: "true" },
        })
      ).data.data,
  });

  const filtered = (listQuery.data ?? []).filter((n) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return n.codigo.toLowerCase().includes(term) || n.descricao.toLowerCase().includes(term);
  });

  const form = useForm<NaturezaFormValues>({
    resolver: zodResolver(naturezaSchema) as Resolver<NaturezaFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(natureza: NaturezaServico) {
    setEditing(natureza);
    form.reset({
      codigo: natureza.codigo,
      descricao: natureza.descricao,
      codigoReceita: natureza.codigoReceita ?? "",
      contaContabilId: natureza.contaContabilId ?? undefined,
      percentualInss: natureza.percentualInss,
      sujeitoInss: natureza.sujeitoInss,
      sujeitoIrrf: natureza.sujeitoIrrf,
      ativo: natureza.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: NaturezaFormValues) => {
      const payload = {
        ...values,
        codigoReceita: values.codigoReceita || null,
        contaContabilId: values.contaContabilId || null,
      };
      if (editing) return (await api.put(`/naturezas-servico/${editing.id}`, payload)).data;
      return (await api.post("/naturezas-servico", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naturezas-servico"] });
      toast({ title: editing ? "Natureza de servico atualizada" : "Natureza de servico criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/naturezas-servico/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naturezas-servico"] });
      toast({ title: "Natureza de servico excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<NaturezaServico>[] = [
    { header: "Codigo", cell: (n) => <span className="font-medium">{n.codigo}</span>, className: "w-24" },
    { header: "Descricao", cell: (n) => n.descricao },
    { header: "Conta Contabil", cell: (n) => (n.contaContabil ? `${n.contaContabil.codigo} - ${n.contaContabil.descricao}` : "-") },
    { header: "Cod. Receita", cell: (n) => n.codigoReceita ?? "-", className: "w-28" },
    { header: "% INSS", cell: (n) => `${n.percentualInss}%`, className: "w-20 text-right" },
    {
      header: "Retencoes",
      className: "w-32",
      cell: (n) => (
        <div className="flex gap-1">
          {n.sujeitoInss && <Badge variant="outline">INSS</Badge>}
          {n.sujeitoIrrf && <Badge variant="outline">IRRF</Badge>}
        </div>
      ),
    },
    {
      header: "Status",
      className: "w-24",
      cell: (n) => <Badge variant={n.ativo ? "success" : "secondary"}>{n.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (n) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(n)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(n)}>
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
        title="Naturezas de Servico"
        description="Naturezas de servico utilizadas para retencoes de INSS e IRRF sobre pagamentos a autonomos e prestadores"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Natureza
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por codigo ou descricao..." />
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={filtered} isLoading={listQuery.isLoading} getRowId={(n) => n.id} />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Natureza de Servico" : "Nova Natureza de Servico"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codigo" htmlFor="codigo" error={form.formState.errors.codigo?.message}>
                <Input id="codigo" {...form.register("codigo")} />
              </Field>
              <Field label="Codigo Receita (EFD-Reinf)" htmlFor="codigoReceita">
                <Input id="codigoReceita" {...form.register("codigoReceita")} />
              </Field>
            </div>
            <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message}>
              <Input id="descricao" {...form.register("descricao")} />
            </Field>
            <Field label="Conta Contabil (VPD)" htmlFor="contaContabilId">
              <Controller
                control={form.control}
                name="contaContabilId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                    <SelectTrigger id="contaContabilId">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {(contasQuery.data ?? []).map((conta) => (
                        <SelectItem key={conta.id} value={conta.id}>
                          {conta.codigo} - {conta.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Percentual INSS (%)" htmlFor="percentualInss" error={form.formState.errors.percentualInss?.message}>
              <Input id="percentualInss" type="number" step="0.01" min={0} max={100} {...form.register("percentualInss")} />
            </Field>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="sujeitoInss"
                  render={({ field }) => <Switch id="sujeitoInss" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="sujeitoInss">Sujeito a INSS</Label>
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="sujeitoIrrf"
                  render={({ field }) => <Switch id="sujeitoIrrf" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="sujeitoIrrf">Sujeito a IRRF</Label>
              </div>
            </div>
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
        title="Excluir natureza de servico"
        description={`Deseja realmente excluir a natureza "${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
