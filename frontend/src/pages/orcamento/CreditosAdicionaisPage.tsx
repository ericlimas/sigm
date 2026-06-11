import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CreditoAdicional, Dotacao, TipoCreditoAdicional } from "@/types/orcamento";

const NONE = "__none__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const TIPO_LABELS: Record<TipoCreditoAdicional, string> = {
  SUPLEMENTAR: "Suplementar",
  ESPECIAL: "Especial",
  EXTRAORDINARIO: "Extraordinario",
};

const creditoSchema = z.object({
  exercicio: z.preprocess((v) => Number(v), z.number().int()),
  tipo: z.enum(["SUPLEMENTAR", "ESPECIAL", "EXTRAORDINARIO"]),
  numero: z.string().min(1, "Informe o numero"),
  decreto: z.string().optional(),
  data: z.string().min(1, "Informe a data"),
  dotacaoDestinoId: z.string().min(1, "Selecione a dotacao de destino"),
  dotacaoOrigemId: z.string().optional(),
  fonteRecursoDescricao: z.string().optional(),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor maior que zero")),
  justificativa: z.string().optional(),
});
type CreditoFormValues = z.infer<typeof creditoSchema>;

const DEFAULT_VALUES: CreditoFormValues = {
  exercicio: ANO_ATUAL,
  tipo: "SUPLEMENTAR",
  numero: "",
  decreto: "",
  data: new Date().toISOString().substring(0, 10),
  dotacaoDestinoId: "",
  dotacaoOrigemId: undefined,
  fonteRecursoDescricao: "",
  valor: 0,
  justificativa: "",
};

export default function CreditosAdicionaisPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [exercicio, setExercicio] = useState<string>(String(ANO_ATUAL));
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const podeCriar = hasPermissao("ORCAMENTO", "CRIAR");

  const listQuery = useQuery({
    queryKey: ["creditos-adicionais", exercicio, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<CreditoAdicional>>("/orcamento/creditos-adicionais", {
          params: { exercicio: exercicio || undefined, page, pageSize: 20 },
        })
      ).data,
  });

  const dotacoesQuery = useQuery({
    queryKey: ["dotacoes", "select", exercicio],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Dotacao>>("/orcamento/dotacoes", {
          params: { exercicio: exercicio || undefined, pageSize: 200 },
        })
      ).data.data,
    enabled: dialogOpen,
  });

  const form = useForm<CreditoFormValues>({
    resolver: zodResolver(creditoSchema) as Resolver<CreditoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    form.reset({ ...DEFAULT_VALUES, exercicio: Number(exercicio) || ANO_ATUAL });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CreditoFormValues) => {
      const payload = {
        ...values,
        decreto: values.decreto || null,
        dotacaoOrigemId: values.dotacaoOrigemId || null,
        fonteRecursoDescricao: values.fonteRecursoDescricao || null,
        justificativa: values.justificativa || null,
      };
      return (await api.post("/orcamento/creditos-adicionais", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos-adicionais"] });
      queryClient.invalidateQueries({ queryKey: ["dotacoes"] });
      toast({ title: "Credito adicional registrado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<CreditoAdicional>[] = [
    { header: "Exercicio", cell: (c) => c.exercicio, className: "w-20" },
    { header: "Tipo", cell: (c) => <Badge variant="outline">{TIPO_LABELS[c.tipo]}</Badge>, className: "w-32" },
    { header: "Numero", cell: (c) => c.numero, className: "w-28" },
    { header: "Data", cell: (c) => formatDate(c.data), className: "w-28" },
    {
      header: "Dotacao Destino",
      cell: (c) => (c.dotacaoDestino ? `Ficha ${c.dotacaoDestino.ficha} - ${c.dotacaoDestino.unidadeOrcamentaria?.nome ?? ""}` : "-"),
    },
    {
      header: "Dotacao Origem",
      cell: (c) => (c.dotacaoOrigem ? `Ficha ${c.dotacaoOrigem.ficha} - ${c.dotacaoOrigem.unidadeOrcamentaria?.nome ?? ""}` : "-"),
    },
    { header: "Valor", cell: (c) => formatCurrency(c.valor), className: "w-36 text-right" },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Creditos Adicionais"
        description="Creditos suplementares, especiais e extraordinarios que alteram dotacoes orcamentarias"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Credito Adicional
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <Select value={exercicio} onValueChange={(v) => { setExercicio(v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Exercicio" />
          </SelectTrigger>
          <SelectContent>
            {EXERCICIOS.map((ano) => (
              <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(c) => c.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Credito Adicional</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Exercicio" htmlFor="exercicio" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...form.register("exercicio")} />
              </Field>
              <Field label="Tipo" htmlFor="tipo">
                <Controller
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoCreditoAdicional)}>
                      <SelectTrigger id="tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Numero" htmlFor="numero" error={form.formState.errors.numero?.message}>
                <Input id="numero" {...form.register("numero")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Decreto" htmlFor="decreto">
                <Input id="decreto" {...form.register("decreto")} />
              </Field>
              <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                <Input id="data" type="date" {...form.register("data")} />
              </Field>
            </div>
            <Field label="Dotacao de Destino (recebe o credito)" htmlFor="dotacaoDestinoId" error={form.formState.errors.dotacaoDestinoId?.message}>
              <Controller
                control={form.control}
                name="dotacaoDestinoId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="dotacaoDestinoId">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} disabled>Selecione</SelectItem>
                      {(dotacoesQuery.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          Ficha {d.ficha} - {d.unidadeOrcamentaria?.nome} - {d.elementoDespesa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Dotacao de Origem (anulacao - opcional)" htmlFor="dotacaoOrigemId">
              <Controller
                control={form.control}
                name="dotacaoOrigemId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                    <SelectTrigger id="dotacaoOrigemId">
                      <SelectValue placeholder="Nenhuma (recurso novo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma (recurso novo)</SelectItem>
                      {(dotacoesQuery.data ?? [])
                        .filter((d) => d.id !== form.watch("dotacaoDestinoId"))
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            Ficha {d.ficha} - {d.unidadeOrcamentaria?.nome} - {d.elementoDespesa} (saldo {formatCurrency(d.saldoDisponivel)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
                <Input id="valor" type="number" step="0.01" min={0} {...form.register("valor")} />
              </Field>
              <Field label="Fonte de Recurso (descricao livre)" htmlFor="fonteRecursoDescricao">
                <Input id="fonteRecursoDescricao" placeholder="Ex: Superavit financeiro" {...form.register("fonteRecursoDescricao")} />
              </Field>
            </div>
            <Field label="Justificativa" htmlFor="justificativa">
              <Textarea id="justificativa" rows={3} {...form.register("justificativa")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
