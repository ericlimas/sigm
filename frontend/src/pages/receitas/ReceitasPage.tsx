import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, formatNumber, toInputDate } from "@/lib/utils";
import type { ContaBancaria } from "@/types/execucao";
import type { ReceitaLancamento, TipoReceita } from "@/types/financeiro";
import type { CategoriaReceita } from "@/types/orcamento";
import type { FonteRecurso } from "@/types/cadastros";

const NONE = "__none__";
const TODOS = "__todos__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const TIPO_LABELS: Record<TipoReceita, string> = {
  ORCAMENTARIA: "Orcamentaria",
  EXTRAORCAMENTARIA: "Extraorcamentaria",
};

const CATEGORIA_LABELS: Record<CategoriaReceita, string> = {
  IPTU: "IPTU",
  ISS: "ISS",
  ITBI: "ITBI",
  TAXAS: "Taxas",
  CONVENIO: "Convenio",
  TRANSFERENCIA: "Transferencia",
  OUTRAS: "Outras",
};

const receitaSchema = z.object({
  exercicio: z.preprocess((v) => Number(v), z.number().int()),
  data: z.string().min(1, "Informe a data"),
  tipo: z.enum(["ORCAMENTARIA", "EXTRAORCAMENTARIA"]),
  categoria: z.enum(["IPTU", "ISS", "ITBI", "TAXAS", "CONVENIO", "TRANSFERENCIA", "OUTRAS"]),
  codigoReceita: z.string().optional(),
  descricao: z.string().min(2, "Informe a descricao"),
  documento: z.string().optional(),
  fonteRecursoId: z.string().optional(),
  contaBancariaId: z.string().min(1, "Selecione a conta"),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor positivo")),
});

type ReceitaFormValues = z.infer<typeof receitaSchema>;

const DEFAULT_VALUES: ReceitaFormValues = {
  exercicio: ANO_ATUAL,
  data: toInputDate(new Date()),
  tipo: "ORCAMENTARIA",
  categoria: "OUTRAS",
  codigoReceita: "",
  descricao: "",
  documento: "",
  fonteRecursoId: undefined,
  contaBancariaId: "",
  valor: 0,
};

interface PrevistoArrecadadoItem {
  codigoReceita: string | null;
  descricao: string;
  categoria: CategoriaReceita;
  valorPrevisto: number;
  valorArrecadado: number;
  percentualArrecadado: number;
  saldo: number;
}

interface PrevistoArrecadado {
  exercicio: number;
  itens: PrevistoArrecadadoItem[];
  totais: { valorPrevisto: number; valorArrecadado: number };
}

export default function ReceitasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("RECEITAS", "CRIAR");
  const podeExcluir = hasPermissao("RECEITAS", "EXCLUIR");

  const [exercicio, setExercicio] = useState<string>(String(ANO_ATUAL));
  const [tipoFiltro, setTipoFiltro] = useState<string>(TODOS);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(TODOS);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ReceitaLancamento | null>(null);

  const [exercicioRelatorio, setExercicioRelatorio] = useState<string>(String(ANO_ATUAL));

  const contasQuery = useQuery({
    queryKey: ["tesouraria-contas"],
    queryFn: async () => (await api.get<ContaBancaria[]>("/tesouraria/contas")).data,
  });

  const fontesQuery = useQuery({
    queryKey: ["fontes-recurso-all"],
    queryFn: async () => (await api.get<{ data: FonteRecurso[] }>("/fontes-recurso", { params: { ativo: true } })).data.data,
  });

  const listQuery = useQuery({
    queryKey: ["receitas", exercicio, tipoFiltro, categoriaFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<ReceitaLancamento>>("/receitas", {
          params: {
            exercicio,
            tipo: tipoFiltro !== TODOS ? tipoFiltro : undefined,
            categoria: categoriaFiltro !== TODOS ? categoriaFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const previstoQuery = useQuery({
    queryKey: ["receitas-previsto-arrecadado", exercicioRelatorio],
    queryFn: async () =>
      (await api.get<PrevistoArrecadado>("/receitas/relatorios/previsto-arrecadado", { params: { exercicio: exercicioRelatorio } })).data,
  });

  const form = useForm<ReceitaFormValues>({
    resolver: zodResolver(receitaSchema) as Resolver<ReceitaFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    form.reset({ ...DEFAULT_VALUES, exercicio: Number(exercicio) });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ReceitaFormValues) => {
      const payload = {
        ...values,
        codigoReceita: values.codigoReceita || null,
        documento: values.documento || null,
        fonteRecursoId: values.fonteRecursoId || null,
      };
      return (await api.post("/receitas", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-previsto-arrecadado"] });
      toast({ title: "Receita lancada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao lancar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/receitas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-previsto-arrecadado"] });
      toast({ title: "Receita excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<ReceitaLancamento>[] = [
    { header: "Data", className: "w-24", cell: (r) => formatDate(r.data) },
    { header: "Descricao", cell: (r) => r.descricao },
    { header: "Codigo", className: "w-24", cell: (r) => r.codigoReceita ?? "-" },
    { header: "Categoria", className: "w-32", cell: (r) => <Badge variant="outline">{CATEGORIA_LABELS[r.categoria]}</Badge> },
    { header: "Tipo", className: "w-36", cell: (r) => TIPO_LABELS[r.tipo] },
    { header: "Conta", cell: (r) => r.contaBancaria?.descricao ?? "-" },
    { header: "Valor", className: "w-32 text-right", cell: (r) => <span className="font-mono font-medium">{formatCurrency(r.valor)}</span> },
    {
      header: "Acoes",
      className: "w-20 text-right",
      cell: (r) =>
        podeExcluir && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader title="Receitas" description="Lancamentos de receitas orcamentarias e extraorcamentarias e acompanhamento da arrecadacao" />

      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lancamentos</TabsTrigger>
          <TabsTrigger value="previsto">Previsto x Arrecadado</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={exercicio} onValueChange={(v) => { setExercicio(v); setPage(1); }}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Exercicio" />
                </SelectTrigger>
                <SelectContent>
                  {EXERCICIOS.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFiltro} onValueChange={(v) => { setTipoFiltro(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoriaFiltro} onValueChange={(v) => { setCategoriaFiltro(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas as categorias</SelectItem>
                  {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {podeCriar && (
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nova Receita
              </Button>
            )}
          </div>

          <Card className="overflow-auto">
            <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(r) => r.id} />
            {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
          </Card>
        </TabsContent>

        <TabsContent value="previsto" className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={exercicioRelatorio} onValueChange={setExercicioRelatorio}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Exercicio" />
              </SelectTrigger>
              <SelectContent>
                {EXERCICIOS.map((ano) => (
                  <SelectItem key={ano} value={String(ano)}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-auto">
            <DataTable
              columns={
                [
                  { header: "Codigo", className: "w-24", cell: (i: PrevistoArrecadadoItem) => i.codigoReceita ?? "-" },
                  { header: "Descricao", cell: (i: PrevistoArrecadadoItem) => i.descricao },
                  { header: "Categoria", className: "w-32", cell: (i: PrevistoArrecadadoItem) => CATEGORIA_LABELS[i.categoria] },
                  { header: "Previsto", className: "w-32 text-right", cell: (i: PrevistoArrecadadoItem) => <span className="font-mono">{formatCurrency(i.valorPrevisto)}</span> },
                  { header: "Arrecadado", className: "w-32 text-right", cell: (i: PrevistoArrecadadoItem) => <span className="font-mono">{formatCurrency(i.valorArrecadado)}</span> },
                  { header: "% Arrecadado", className: "w-28 text-right", cell: (i: PrevistoArrecadadoItem) => `${formatNumber(i.percentualArrecadado)}%` },
                  { header: "Saldo", className: "w-32 text-right", cell: (i: PrevistoArrecadadoItem) => <span className="font-mono">{formatCurrency(i.saldo)}</span> },
                ] as DataTableColumn<PrevistoArrecadadoItem>[]
              }
              data={previstoQuery.data?.itens ?? []}
              isLoading={previstoQuery.isLoading}
              getRowId={(i) => i.codigoReceita ?? i.descricao}
              emptyMessage="LOA nao encontrada para o exercicio selecionado."
            />
            {previstoQuery.data && (
              <div className="flex justify-end gap-6 border-t p-2 text-sm font-semibold">
                <span>Total Previsto: {formatCurrency(previstoQuery.data.totais.valorPrevisto)}</span>
                <span>Total Arrecadado: {formatCurrency(previstoQuery.data.totais.valorArrecadado)}</span>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Receita</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Exercicio" htmlFor="exercicio">
                <Controller
                  control={form.control}
                  name="exercicio"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger id="exercicio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCICIOS.map((ano) => (
                          <SelectItem key={ano} value={String(ano)}>
                            {ano}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                <Input id="data" type="date" {...form.register("data")} />
              </Field>
              <Field label="Tipo" htmlFor="tipo">
                <Controller
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoReceita)}>
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Categoria" htmlFor="categoria">
                <Controller
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as CategoriaReceita)}>
                      <SelectTrigger id="categoria">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Codigo da Receita" htmlFor="codigoReceita">
                <Input id="codigoReceita" {...form.register("codigoReceita")} />
              </Field>
              <Field label="Documento" htmlFor="documento">
                <Input id="documento" {...form.register("documento")} />
              </Field>
            </div>

            <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message}>
              <Input id="descricao" {...form.register("descricao")} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Conta Bancaria" htmlFor="contaBancariaId" className="col-span-2" error={form.formState.errors.contaBancariaId?.message}>
                <Controller
                  control={form.control}
                  name="contaBancariaId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="contaBancariaId">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contasQuery.data?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
                <Input id="valor" type="number" step="0.01" min="0.01" {...form.register("valor")} />
              </Field>
            </div>

            <Field label="Fonte de Recurso" htmlFor="fonteRecursoId">
              <Controller
                control={form.control}
                name="fonteRecursoId"
                render={({ field }) => (
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                    <SelectTrigger id="fonteRecursoId">
                      <SelectValue placeholder="Nao informada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nao informada</SelectItem>
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
        title="Excluir lancamento de receita"
        description={`Deseja realmente excluir a receita "${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
