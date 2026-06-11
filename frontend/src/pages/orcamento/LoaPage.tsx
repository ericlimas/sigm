import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CategoriaReceita, Loa, ReceitaPrevista } from "@/types/orcamento";

const CATEGORIA_LABELS: Record<CategoriaReceita, string> = {
  IPTU: "IPTU",
  ISS: "ISS",
  ITBI: "ITBI",
  TAXAS: "Taxas",
  CONVENIO: "Convenio",
  TRANSFERENCIA: "Transferencia",
  OUTRAS: "Outras",
};

const loaSchema = z.object({
  exercicio: z.preprocess((v) => Number(v), z.number().int().min(2000)),
  lei: z.string().optional(),
  dataAprovacao: z.string().optional(),
  ativo: z.boolean().optional(),
});
type LoaFormValues = z.infer<typeof loaSchema>;

const receitaSchema = z.object({
  codigoReceita: z.string().min(1, "Informe o codigo"),
  descricao: z.string().min(2, "Informe a descricao"),
  categoria: z.enum(["IPTU", "ISS", "ITBI", "TAXAS", "CONVENIO", "TRANSFERENCIA", "OUTRAS"]),
  valorPrevisto: z.preprocess((v) => Number(v), z.number().positive("Informe um valor maior que zero")),
});
type ReceitaFormValues = z.infer<typeof receitaSchema>;

export default function LoaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("ORCAMENTO", "CRIAR");
  const podeEditar = hasPermissao("ORCAMENTO", "EDITAR");

  const [selectedLoaId, setSelectedLoaId] = useState<string | null>(null);
  const [loaDialogOpen, setLoaDialogOpen] = useState(false);
  const [editingLoa, setEditingLoa] = useState<Loa | null>(null);
  const [receitaDialogOpen, setReceitaDialogOpen] = useState(false);
  const [editingReceita, setEditingReceita] = useState<ReceitaPrevista | null>(null);

  const loasQuery = useQuery({
    queryKey: ["loas"],
    queryFn: async () => (await api.get<{ data: Loa[] }>("/orcamento/loa")).data.data,
  });

  const loaDetailQuery = useQuery({
    queryKey: ["loa", selectedLoaId],
    queryFn: async () => (await api.get<Loa>(`/orcamento/loa/${selectedLoaId}`)).data,
    enabled: !!selectedLoaId,
  });

  const loaForm = useForm<LoaFormValues>({
    resolver: zodResolver(loaSchema) as Resolver<LoaFormValues>,
    defaultValues: { exercicio: new Date().getFullYear(), lei: "", dataAprovacao: "", ativo: true },
  });

  function openCreateLoa() {
    setEditingLoa(null);
    loaForm.reset({ exercicio: new Date().getFullYear(), lei: "", dataAprovacao: "", ativo: true });
    setLoaDialogOpen(true);
  }

  function openEditLoa(loa: Loa) {
    setEditingLoa(loa);
    loaForm.reset({
      exercicio: loa.exercicio,
      lei: loa.lei ?? "",
      dataAprovacao: loa.dataAprovacao ? loa.dataAprovacao.substring(0, 10) : "",
      ativo: loa.ativo,
    });
    setLoaDialogOpen(true);
  }

  const saveLoaMutation = useMutation({
    mutationFn: async (values: LoaFormValues) => {
      const payload = { ...values, lei: values.lei || null, dataAprovacao: values.dataAprovacao || null };
      if (editingLoa) return (await api.put(`/orcamento/loa/${editingLoa.id}`, payload)).data;
      return (await api.post("/orcamento/loa", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loas"] });
      toast({ title: editingLoa ? "LOA atualizada" : "LOA criada" });
      setLoaDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const receitaForm = useForm<ReceitaFormValues>({
    resolver: zodResolver(receitaSchema) as Resolver<ReceitaFormValues>,
    defaultValues: { codigoReceita: "", descricao: "", categoria: "OUTRAS", valorPrevisto: 0 },
  });

  function openCreateReceita() {
    setEditingReceita(null);
    receitaForm.reset({ codigoReceita: "", descricao: "", categoria: "OUTRAS", valorPrevisto: 0 });
    setReceitaDialogOpen(true);
  }

  function openEditReceita(receita: ReceitaPrevista) {
    setEditingReceita(receita);
    receitaForm.reset({
      codigoReceita: receita.codigoReceita,
      descricao: receita.descricao,
      categoria: receita.categoria,
      valorPrevisto: receita.valorPrevisto,
    });
    setReceitaDialogOpen(true);
  }

  const saveReceitaMutation = useMutation({
    mutationFn: async (values: ReceitaFormValues) => {
      if (editingReceita) return (await api.put(`/orcamento/loa/receitas-previstas/${editingReceita.id}`, values)).data;
      return (await api.post(`/orcamento/loa/${selectedLoaId}/receitas-previstas`, values)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loa", selectedLoaId] });
      queryClient.invalidateQueries({ queryKey: ["loas"] });
      toast({ title: editingReceita ? "Receita prevista atualizada" : "Receita prevista criada" });
      setReceitaDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const loaColumns: DataTableColumn<Loa>[] = [
    { header: "Exercicio", cell: (l) => <span className="font-medium">{l.exercicio}</span>, className: "w-24" },
    { header: "Lei", cell: (l) => l.lei ?? "-" },
    { header: "Data Aprovacao", cell: (l) => formatDate(l.dataAprovacao), className: "w-36" },
    { header: "Receita Total", cell: (l) => formatCurrency(l.valorTotalReceita), className: "w-40 text-right" },
    { header: "Despesa Total", cell: (l) => formatCurrency(l.valorTotalDespesa), className: "w-40 text-right" },
    {
      header: "Status",
      className: "w-24",
      cell: (l) => <Badge variant={l.ativo ? "success" : "secondary"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "",
      className: "w-16 text-right",
      cell: (l) => (
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditLoa(l); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      ),
    },
  ];

  const receitaColumns: DataTableColumn<ReceitaPrevista>[] = [
    { header: "Codigo", cell: (r) => <span className="font-medium">{r.codigoReceita}</span>, className: "w-28" },
    { header: "Descricao", cell: (r) => r.descricao },
    { header: "Categoria", cell: (r) => CATEGORIA_LABELS[r.categoria], className: "w-32" },
    { header: "Valor Previsto", cell: (r) => formatCurrency(r.valorPrevisto), className: "w-40 text-right" },
    { header: "Valor Atualizado", cell: (r) => formatCurrency(r.valorAtualizado), className: "w-40 text-right" },
    {
      header: "",
      className: "w-16 text-right",
      cell: (r) => (
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditReceita(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      ),
    },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Lei Orcamentaria Anual (LOA)"
        description="Orcamento anual: receitas previstas e dotacoes de despesa"
        actions={
          podeCriar && (
            <Button onClick={openCreateLoa}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova LOA
            </Button>
          )
        }
      />

      <Card className="overflow-auto">
        <DataTable
          columns={loaColumns}
          data={loasQuery.data ?? []}
          isLoading={loasQuery.isLoading}
          getRowId={(l) => l.id}
          onRowClick={(l) => setSelectedLoaId(l.id)}
        />
      </Card>

      {selectedLoaId && (
        <Card className="overflow-auto">
          <div className="p-3 pb-0">
            <PageHeader
              title={`Receitas Previstas - LOA ${loaDetailQuery.data?.exercicio ?? ""}`}
              actions={
                podeCriar && (
                  <Button size="sm" onClick={openCreateReceita}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nova Receita
                  </Button>
                )
              }
            />
          </div>
          <DataTable
            columns={receitaColumns}
            data={loaDetailQuery.data?.receitasPrevistas ?? []}
            isLoading={loaDetailQuery.isLoading}
            getRowId={(r) => r.id}
            emptyMessage="Nenhuma receita prevista cadastrada"
          />
        </Card>
      )}

      <Dialog open={loaDialogOpen} onOpenChange={setLoaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLoa ? "Editar LOA" : "Nova LOA"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={loaForm.handleSubmit((values) => saveLoaMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Exercicio" htmlFor="exercicio" error={loaForm.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...loaForm.register("exercicio")} />
              </Field>
              <Field label="Data Aprovacao" htmlFor="dataAprovacao">
                <Input id="dataAprovacao" type="date" {...loaForm.register("dataAprovacao")} />
              </Field>
            </div>
            <Field label="Lei" htmlFor="lei">
              <Input id="lei" {...loaForm.register("lei")} />
            </Field>
            {editingLoa && (
              <div className="flex items-center gap-2">
                <Controller control={loaForm.control} name="ativo" render={({ field }) => <Switch id="ativoLoa" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="ativoLoa">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoaDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveLoaMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={receitaDialogOpen} onOpenChange={setReceitaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingReceita ? "Editar Receita Prevista" : "Nova Receita Prevista"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={receitaForm.handleSubmit((values) => saveReceitaMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codigo da Receita" htmlFor="codigoReceita" error={receitaForm.formState.errors.codigoReceita?.message}>
                <Input id="codigoReceita" {...receitaForm.register("codigoReceita")} />
              </Field>
              <Field label="Categoria" htmlFor="categoria">
                <Controller
                  control={receitaForm.control}
                  name="categoria"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as CategoriaReceita)}>
                      <SelectTrigger id="categoria">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <Field label="Descricao" htmlFor="descricaoReceita" error={receitaForm.formState.errors.descricao?.message}>
              <Input id="descricaoReceita" {...receitaForm.register("descricao")} />
            </Field>
            <Field label="Valor Previsto" htmlFor="valorPrevisto" error={receitaForm.formState.errors.valorPrevisto?.message}>
              <Input id="valorPrevisto" type="number" step="0.01" min={0} {...receitaForm.register("valorPrevisto")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReceitaDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveReceitaMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
