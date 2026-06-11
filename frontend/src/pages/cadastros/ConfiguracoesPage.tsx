import { useEffect, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatNumber, toInputDate } from "@/lib/utils";
import type { EntidadeConfiguracao } from "@/types/usuarios";
import type { TabelaInssFaixa, TabelaIrrfFaixa, TabelaIrrfDeducao } from "@/types/execucao";

const DEFAULT_VALUES: EntidadeConfiguracao = {
  ordenadorNome: "",
  ordenadorCpf: "",
  ordenadorCargo: "",
  contadorNome: "",
  contadorDocumento: "",
  contadorCargo: "",
  diretorFinanceiroNome: "",
  diretorFinanceiroCpf: "",
  diretorFinanceiroCargo: "",
};

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Configuracoes"
        description="Responsaveis impressos na Nota de Empenho (Presidente, Contador e Tesoureiro) e tabelas de retencao de INSS/IRRF de pessoas fisicas"
      />

      <Tabs defaultValue="responsaveis">
        <TabsList>
          <TabsTrigger value="responsaveis">Responsaveis</TabsTrigger>
          <TabsTrigger value="tabelas">Tabelas INSS/IRRF</TabsTrigger>
        </TabsList>

        <TabsContent value="responsaveis">
          <ResponsaveisTab />
        </TabsContent>

        <TabsContent value="tabelas" className="space-y-3">
          <TabelaInssCard />
          <TabelaIrrfCard />
          <TabelaIrrfDeducaoCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResponsaveisTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);
  const podeEditar = hasPermissao("USUARIOS", "EDITAR");

  const configQuery = useQuery({
    queryKey: ["entidade", "configuracao"],
    queryFn: async () => (await api.get<EntidadeConfiguracao>("/entidade/configuracao")).data,
  });

  const form = useForm<EntidadeConfiguracao>({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (configQuery.data) {
      form.reset({
        ordenadorNome: configQuery.data.ordenadorNome ?? "",
        ordenadorCpf: configQuery.data.ordenadorCpf ?? "",
        ordenadorCargo: configQuery.data.ordenadorCargo ?? "",
        contadorNome: configQuery.data.contadorNome ?? "",
        contadorDocumento: configQuery.data.contadorDocumento ?? "",
        contadorCargo: configQuery.data.contadorCargo ?? "",
        diretorFinanceiroNome: configQuery.data.diretorFinanceiroNome ?? "",
        diretorFinanceiroCpf: configQuery.data.diretorFinanceiroCpf ?? "",
        diretorFinanceiroCargo: configQuery.data.diretorFinanceiroCargo ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (values: EntidadeConfiguracao) => (await api.put("/entidade/configuracao", values)).data,
    onSuccess: (data: EntidadeConfiguracao) => {
      queryClient.setQueryData(["entidade", "configuracao"], data);
      toast({ title: "Configuracoes salvas" });
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  return (
    <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Presidente</CardTitle>
          <CardDescription>Responsavel que autoriza a emissao do empenho</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Nome" htmlFor="ordenadorNome">
            <Input id="ordenadorNome" disabled={!podeEditar} {...form.register("ordenadorNome")} />
          </Field>
          <Field label="CPF" htmlFor="ordenadorCpf">
            <Input id="ordenadorCpf" disabled={!podeEditar} {...form.register("ordenadorCpf")} />
          </Field>
          <Field label="Cargo" htmlFor="ordenadorCargo">
            <Input id="ordenadorCargo" placeholder="Ex: Presidente" disabled={!podeEditar} {...form.register("ordenadorCargo")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contador(a)/Contabilista</CardTitle>
          <CardDescription>Responsavel pela contabilizacao do saldo da dotacao</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Nome" htmlFor="contadorNome">
            <Input id="contadorNome" disabled={!podeEditar} {...form.register("contadorNome")} />
          </Field>
          <Field label="CRC" htmlFor="contadorDocumento">
            <Input id="contadorDocumento" placeholder="Ex: 59512/O-9" disabled={!podeEditar} {...form.register("contadorDocumento")} />
          </Field>
          <Field label="Cargo" htmlFor="contadorCargo">
            <Input id="contadorCargo" placeholder="Ex: Contador" disabled={!podeEditar} {...form.register("contadorCargo")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tesoureiro</CardTitle>
          <CardDescription>Responsavel financeiro do sindicato</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Nome" htmlFor="diretorFinanceiroNome">
            <Input id="diretorFinanceiroNome" disabled={!podeEditar} {...form.register("diretorFinanceiroNome")} />
          </Field>
          <Field label="CPF" htmlFor="diretorFinanceiroCpf">
            <Input id="diretorFinanceiroCpf" disabled={!podeEditar} {...form.register("diretorFinanceiroCpf")} />
          </Field>
          <Field label="Cargo" htmlFor="diretorFinanceiroCargo">
            <Input id="diretorFinanceiroCargo" placeholder="Ex: Tesoureiro" disabled={!podeEditar} {...form.register("diretorFinanceiroCargo")} />
          </Field>
        </CardContent>
      </Card>

      {podeEditar && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending || configQuery.isLoading}>
            Salvar
          </Button>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// TABELA INSS
// ---------------------------------------------------------------------------

const inssFaixaSchema = z.object({
  vigenciaInicio: z.string().min(1, "Informe a vigencia"),
  vigenciaFim: z.string().optional(),
  faixaInicial: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0)),
  faixaFinal: z.string().optional(),
  aliquota: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0).max(100)),
  parcelaDeduzir: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0)),
  tetoPrevidenciario: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0)),
  ativo: z.boolean().optional(),
});

type InssFaixaFormValues = z.infer<typeof inssFaixaSchema>;

const DEFAULT_INSS_VALUES: InssFaixaFormValues = {
  vigenciaInicio: "",
  vigenciaFim: "",
  faixaInicial: 0,
  faixaFinal: "",
  aliquota: 0,
  parcelaDeduzir: 0,
  tetoPrevidenciario: 0,
  ativo: true,
};

function TabelaInssCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("RETENCOES", "CRIAR");
  const podeEditar = hasPermissao("RETENCOES", "EDITAR");
  const podeExcluir = hasPermissao("RETENCOES", "EXCLUIR");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TabelaInssFaixa | null>(null);
  const [deleting, setDeleting] = useState<TabelaInssFaixa | null>(null);

  const listQuery = useQuery({
    queryKey: ["tabelas-tributarias", "inss"],
    queryFn: async () => (await api.get<{ data: TabelaInssFaixa[] }>("/tabelas-tributarias/inss")).data.data,
  });

  const form = useForm<InssFaixaFormValues>({
    resolver: zodResolver(inssFaixaSchema) as Resolver<InssFaixaFormValues>,
    defaultValues: DEFAULT_INSS_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_INSS_VALUES);
    setDialogOpen(true);
  }

  function openEdit(faixa: TabelaInssFaixa) {
    setEditing(faixa);
    form.reset({
      vigenciaInicio: toInputDate(faixa.vigenciaInicio),
      vigenciaFim: toInputDate(faixa.vigenciaFim),
      faixaInicial: faixa.faixaInicial,
      faixaFinal: faixa.faixaFinal != null ? String(faixa.faixaFinal) : "",
      aliquota: faixa.aliquota,
      parcelaDeduzir: faixa.parcelaDeduzir,
      tetoPrevidenciario: faixa.tetoPrevidenciario,
      ativo: faixa.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: InssFaixaFormValues) => {
      const payload = {
        ...values,
        vigenciaFim: values.vigenciaFim || null,
        faixaFinal: values.faixaFinal === "" || values.faixaFinal === undefined ? null : Number(values.faixaFinal),
      };
      if (editing) return (await api.put(`/tabelas-tributarias/inss/${editing.id}`, payload)).data;
      return (await api.post("/tabelas-tributarias/inss", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-tributarias", "inss"] });
      toast({ title: editing ? "Faixa de INSS atualizada" : "Faixa de INSS criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tabelas-tributarias/inss/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-tributarias", "inss"] });
      toast({ title: "Faixa de INSS excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<TabelaInssFaixa>[] = [
    {
      header: "Vigencia",
      cell: (f) => `${formatDate(f.vigenciaInicio)} a ${f.vigenciaFim ? formatDate(f.vigenciaFim) : "atual"}`,
    },
    {
      header: "Faixa salarial",
      cell: (f) => `${formatCurrency(f.faixaInicial)} a ${f.faixaFinal != null ? formatCurrency(f.faixaFinal) : "sem teto"}`,
    },
    { header: "Aliquota", className: "w-24 text-right", cell: (f) => `${formatNumber(f.aliquota)}%` },
    { header: "Parcela a deduzir", className: "w-32 text-right", cell: (f) => formatCurrency(f.parcelaDeduzir) },
    { header: "Teto previdenciario", className: "w-32 text-right", cell: (f) => formatCurrency(f.tetoPrevidenciario) },
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">Tabela INSS - Pessoa Fisica</CardTitle>
          <CardDescription>Faixas progressivas de contribuicao previdenciaria por vigencia</CardDescription>
        </div>
        {podeCriar && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Faixa
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <DataTable columns={columns} data={listQuery.data ?? []} isLoading={listQuery.isLoading} getRowId={(f) => f.id} />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Faixa de INSS" : "Nova Faixa de INSS"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vigencia inicio" htmlFor="vigenciaInicio" error={form.formState.errors.vigenciaInicio?.message}>
                <Input id="vigenciaInicio" type="date" {...form.register("vigenciaInicio")} />
              </Field>
              <Field label="Vigencia fim" htmlFor="vigenciaFim">
                <Input id="vigenciaFim" type="date" {...form.register("vigenciaFim")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faixa inicial (R$)" htmlFor="faixaInicial" error={form.formState.errors.faixaInicial?.message}>
                <Input id="faixaInicial" type="number" step="0.01" min={0} {...form.register("faixaInicial")} />
              </Field>
              <Field label="Faixa final (R$, vazio = sem teto)" htmlFor="faixaFinal">
                <Input id="faixaFinal" type="number" step="0.01" min={0} {...form.register("faixaFinal")} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Aliquota (%)" htmlFor="aliquota" error={form.formState.errors.aliquota?.message}>
                <Input id="aliquota" type="number" step="0.01" min={0} max={100} {...form.register("aliquota")} />
              </Field>
              <Field label="Parcela a deduzir (R$)" htmlFor="parcelaDeduzir">
                <Input id="parcelaDeduzir" type="number" step="0.01" min={0} {...form.register("parcelaDeduzir")} />
              </Field>
              <Field label="Teto previdenciario (R$)" htmlFor="tetoPrevidenciario" error={form.formState.errors.tetoPrevidenciario?.message}>
                <Input id="tetoPrevidenciario" type="number" step="0.01" min={0} {...form.register("tetoPrevidenciario")} />
              </Field>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativo-inss" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativo-inss">Ativo</Label>
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
        title="Excluir faixa de INSS"
        description="Deseja realmente excluir esta faixa de INSS? Esta acao nao pode ser desfeita."
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TABELA IRRF
// ---------------------------------------------------------------------------

const irrfFaixaSchema = z.object({
  vigenciaInicio: z.string().min(1, "Informe a vigencia"),
  vigenciaFim: z.string().optional(),
  baseInicial: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0)),
  baseFinal: z.string().optional(),
  aliquota: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0).max(100)),
  parcelaDeduzir: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0)),
  ativo: z.boolean().optional(),
});

type IrrfFaixaFormValues = z.infer<typeof irrfFaixaSchema>;

const DEFAULT_IRRF_VALUES: IrrfFaixaFormValues = {
  vigenciaInicio: "",
  vigenciaFim: "",
  baseInicial: 0,
  baseFinal: "",
  aliquota: 0,
  parcelaDeduzir: 0,
  ativo: true,
};

function TabelaIrrfCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("RETENCOES", "CRIAR");
  const podeEditar = hasPermissao("RETENCOES", "EDITAR");
  const podeExcluir = hasPermissao("RETENCOES", "EXCLUIR");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TabelaIrrfFaixa | null>(null);
  const [deleting, setDeleting] = useState<TabelaIrrfFaixa | null>(null);

  const listQuery = useQuery({
    queryKey: ["tabelas-tributarias", "irrf"],
    queryFn: async () => (await api.get<{ data: TabelaIrrfFaixa[] }>("/tabelas-tributarias/irrf")).data.data,
  });

  const form = useForm<IrrfFaixaFormValues>({
    resolver: zodResolver(irrfFaixaSchema) as Resolver<IrrfFaixaFormValues>,
    defaultValues: DEFAULT_IRRF_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_IRRF_VALUES);
    setDialogOpen(true);
  }

  function openEdit(faixa: TabelaIrrfFaixa) {
    setEditing(faixa);
    form.reset({
      vigenciaInicio: toInputDate(faixa.vigenciaInicio),
      vigenciaFim: toInputDate(faixa.vigenciaFim),
      baseInicial: faixa.baseInicial,
      baseFinal: faixa.baseFinal != null ? String(faixa.baseFinal) : "",
      aliquota: faixa.aliquota,
      parcelaDeduzir: faixa.parcelaDeduzir,
      ativo: faixa.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: IrrfFaixaFormValues) => {
      const payload = {
        ...values,
        vigenciaFim: values.vigenciaFim || null,
        baseFinal: values.baseFinal === "" || values.baseFinal === undefined ? null : Number(values.baseFinal),
      };
      if (editing) return (await api.put(`/tabelas-tributarias/irrf/${editing.id}`, payload)).data;
      return (await api.post("/tabelas-tributarias/irrf", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-tributarias", "irrf"] });
      toast({ title: editing ? "Faixa de IRRF atualizada" : "Faixa de IRRF criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tabelas-tributarias/irrf/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-tributarias", "irrf"] });
      toast({ title: "Faixa de IRRF excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<TabelaIrrfFaixa>[] = [
    {
      header: "Vigencia",
      cell: (f) => `${formatDate(f.vigenciaInicio)} a ${f.vigenciaFim ? formatDate(f.vigenciaFim) : "atual"}`,
    },
    {
      header: "Base de calculo",
      cell: (f) => `${formatCurrency(f.baseInicial)} a ${f.baseFinal != null ? formatCurrency(f.baseFinal) : "sem limite"}`,
    },
    { header: "Aliquota", className: "w-24 text-right", cell: (f) => `${formatNumber(f.aliquota)}%` },
    { header: "Parcela a deduzir", className: "w-32 text-right", cell: (f) => formatCurrency(f.parcelaDeduzir) },
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">Tabela IRRF - Pessoa Fisica</CardTitle>
          <CardDescription>Faixas progressivas do imposto de renda retido na fonte por vigencia</CardDescription>
        </div>
        {podeCriar && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Faixa
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <DataTable columns={columns} data={listQuery.data ?? []} isLoading={listQuery.isLoading} getRowId={(f) => f.id} />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Faixa de IRRF" : "Nova Faixa de IRRF"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vigencia inicio" htmlFor="vigenciaInicioIrrf" error={form.formState.errors.vigenciaInicio?.message}>
                <Input id="vigenciaInicioIrrf" type="date" {...form.register("vigenciaInicio")} />
              </Field>
              <Field label="Vigencia fim" htmlFor="vigenciaFimIrrf">
                <Input id="vigenciaFimIrrf" type="date" {...form.register("vigenciaFim")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Base inicial (R$)" htmlFor="baseInicial" error={form.formState.errors.baseInicial?.message}>
                <Input id="baseInicial" type="number" step="0.01" min={0} {...form.register("baseInicial")} />
              </Field>
              <Field label="Base final (R$, vazio = sem limite)" htmlFor="baseFinal">
                <Input id="baseFinal" type="number" step="0.01" min={0} {...form.register("baseFinal")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aliquota (%)" htmlFor="aliquotaIrrf" error={form.formState.errors.aliquota?.message}>
                <Input id="aliquotaIrrf" type="number" step="0.01" min={0} max={100} {...form.register("aliquota")} />
              </Field>
              <Field label="Parcela a deduzir (R$)" htmlFor="parcelaDeduzirIrrf">
                <Input id="parcelaDeduzirIrrf" type="number" step="0.01" min={0} {...form.register("parcelaDeduzir")} />
              </Field>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativo-irrf" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativo-irrf">Ativo</Label>
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
        title="Excluir faixa de IRRF"
        description="Deseja realmente excluir esta faixa de IRRF? Esta acao nao pode ser desfeita."
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DEDUCAO POR DEPENDENTE (IRRF)
// ---------------------------------------------------------------------------

const irrfDeducaoSchema = z.object({
  vigenciaInicio: z.string().min(1, "Informe a vigencia"),
  vigenciaFim: z.string().optional(),
  valorPorDependente: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().min(0)),
  limiteFaixa1: z.string().optional(),
  reducaoMaxima: z.string().optional(),
  limiteFaixa2: z.string().optional(),
  constanteReducao: z.string().optional(),
  coeficienteReducao: z.string().optional(),
  ativo: z.boolean().optional(),
});

type IrrfDeducaoFormValues = z.infer<typeof irrfDeducaoSchema>;

const DEFAULT_DEDUCAO_VALUES: IrrfDeducaoFormValues = {
  vigenciaInicio: "",
  vigenciaFim: "",
  valorPorDependente: 0,
  limiteFaixa1: "",
  reducaoMaxima: "",
  limiteFaixa2: "",
  constanteReducao: "",
  coeficienteReducao: "",
  ativo: true,
};

function numeroOuNulo(value: string | undefined): number | null {
  return value === "" || value === undefined ? null : Number(value);
}

function TabelaIrrfDeducaoCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("RETENCOES", "CRIAR");
  const podeEditar = hasPermissao("RETENCOES", "EDITAR");
  const podeExcluir = hasPermissao("RETENCOES", "EXCLUIR");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TabelaIrrfDeducao | null>(null);
  const [deleting, setDeleting] = useState<TabelaIrrfDeducao | null>(null);

  const listQuery = useQuery({
    queryKey: ["tabelas-tributarias", "irrf-deducoes"],
    queryFn: async () => (await api.get<{ data: TabelaIrrfDeducao[] }>("/tabelas-tributarias/irrf-deducoes")).data.data,
  });

  const form = useForm<IrrfDeducaoFormValues>({
    resolver: zodResolver(irrfDeducaoSchema) as Resolver<IrrfDeducaoFormValues>,
    defaultValues: DEFAULT_DEDUCAO_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_DEDUCAO_VALUES);
    setDialogOpen(true);
  }

  function openEdit(deducao: TabelaIrrfDeducao) {
    setEditing(deducao);
    form.reset({
      vigenciaInicio: toInputDate(deducao.vigenciaInicio),
      vigenciaFim: toInputDate(deducao.vigenciaFim),
      valorPorDependente: deducao.valorPorDependente,
      limiteFaixa1: deducao.limiteFaixa1 != null ? String(deducao.limiteFaixa1) : "",
      reducaoMaxima: deducao.reducaoMaxima != null ? String(deducao.reducaoMaxima) : "",
      limiteFaixa2: deducao.limiteFaixa2 != null ? String(deducao.limiteFaixa2) : "",
      constanteReducao: deducao.constanteReducao != null ? String(deducao.constanteReducao) : "",
      coeficienteReducao: deducao.coeficienteReducao != null ? String(deducao.coeficienteReducao) : "",
      ativo: deducao.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: IrrfDeducaoFormValues) => {
      const payload = {
        ...values,
        vigenciaFim: values.vigenciaFim || null,
        limiteFaixa1: numeroOuNulo(values.limiteFaixa1),
        reducaoMaxima: numeroOuNulo(values.reducaoMaxima),
        limiteFaixa2: numeroOuNulo(values.limiteFaixa2),
        constanteReducao: numeroOuNulo(values.constanteReducao),
        coeficienteReducao: numeroOuNulo(values.coeficienteReducao),
      };
      if (editing) return (await api.put(`/tabelas-tributarias/irrf-deducoes/${editing.id}`, payload)).data;
      return (await api.post("/tabelas-tributarias/irrf-deducoes", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-tributarias", "irrf-deducoes"] });
      toast({ title: editing ? "Deducao atualizada" : "Deducao criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tabelas-tributarias/irrf-deducoes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-tributarias", "irrf-deducoes"] });
      toast({ title: "Deducao excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<TabelaIrrfDeducao>[] = [
    {
      header: "Vigencia",
      cell: (d) => `${formatDate(d.vigenciaInicio)} a ${d.vigenciaFim ? formatDate(d.vigenciaFim) : "atual"}`,
    },
    { header: "Valor por dependente", className: "w-40 text-right", cell: (d) => formatCurrency(d.valorPorDependente) },
    {
      header: "Status",
      className: "w-24",
      cell: (d) => <Badge variant={d.ativo ? "success" : "secondary"}>{d.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (d) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(d)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">Deducao por Dependente (IRRF)</CardTitle>
          <CardDescription>Valor deduzido da base de calculo do IRRF por dependente</CardDescription>
        </div>
        {podeCriar && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Deducao
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <DataTable columns={columns} data={listQuery.data ?? []} isLoading={listQuery.isLoading} getRowId={(d) => d.id} />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Deducao por Dependente" : "Nova Deducao por Dependente"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vigencia inicio" htmlFor="vigenciaInicioDed" error={form.formState.errors.vigenciaInicio?.message}>
                <Input id="vigenciaInicioDed" type="date" {...form.register("vigenciaInicio")} />
              </Field>
              <Field label="Vigencia fim" htmlFor="vigenciaFimDed">
                <Input id="vigenciaFimDed" type="date" {...form.register("vigenciaFim")} />
              </Field>
            </div>
            <Field label="Valor por dependente (R$)" htmlFor="valorPorDependente" error={form.formState.errors.valorPorDependente?.message}>
              <Input id="valorPorDependente" type="number" step="0.01" min={0} {...form.register("valorPorDependente")} />
            </Field>
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Reducao do imposto (Lei 15.270/2025)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Limite faixa 1 (R$)" htmlFor="limiteFaixa1">
                  <Input id="limiteFaixa1" type="number" step="0.01" min={0} {...form.register("limiteFaixa1")} />
                </Field>
                <Field label="Reducao maxima (R$)" htmlFor="reducaoMaxima">
                  <Input id="reducaoMaxima" type="number" step="0.01" min={0} {...form.register("reducaoMaxima")} />
                </Field>
                <Field label="Limite faixa 2 (R$)" htmlFor="limiteFaixa2">
                  <Input id="limiteFaixa2" type="number" step="0.01" min={0} {...form.register("limiteFaixa2")} />
                </Field>
                <Field label="Constante da reducao (R$)" htmlFor="constanteReducao">
                  <Input id="constanteReducao" type="number" step="0.01" min={0} {...form.register("constanteReducao")} />
                </Field>
                <Field label="Coeficiente da reducao" htmlFor="coeficienteReducao">
                  <Input id="coeficienteReducao" type="number" step="0.000001" min={0} {...form.register("coeficienteReducao")} />
                </Field>
              </div>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativo-deducao" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativo-deducao">Ativo</Label>
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
        title="Excluir deducao"
        description="Deseja realmente excluir esta deducao por dependente? Esta acao nao pode ser desfeita."
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </Card>
  );
}
