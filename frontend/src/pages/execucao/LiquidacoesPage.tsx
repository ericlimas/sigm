import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Ban } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import SearchInput from "@/components/shared/SearchInput";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Empenho, Liquidacao } from "@/types/execucao";

const NONE = "__none__";
const TODOS = "__todos__";

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  LIQUIDADA: "Liquidada",
  ANULADA: "Anulada",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDENTE: "warning",
  LIQUIDADA: "success",
  ANULADA: "destructive",
};

const PAGAMENTO_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const PAGAMENTO_STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDENTE: "warning",
  PAGO: "success",
  CANCELADO: "destructive",
};

const liquidacaoSchema = z.object({
  empenhoId: z.string().min(1, "Selecione o empenho"),
  data: z.string().min(1, "Informe a data"),
  documento: z.string().optional(),
  tipoDocumento: z.string().optional(),
  historico: z.string().min(3, "Informe o historico"),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor maior que zero")),
});
type LiquidacaoFormValues = z.infer<typeof liquidacaoSchema>;

const DEFAULT_VALUES: LiquidacaoFormValues = {
  empenhoId: "",
  data: new Date().toISOString().substring(0, 10),
  documento: "",
  tipoDocumento: "",
  historico: "",
  valor: 0,
};

const anularSchema = z.object({
  justificativa: z.string().min(3, "Informe a justificativa"),
});
type AnularFormValues = z.infer<typeof anularSchema>;

export default function LiquidacoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("LIQUIDACOES", "CRIAR");
  const podeAnular = hasPermissao("LIQUIDACOES", "ANULAR");

  const [status, setStatus] = useState<string>(TODOS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [anularOpen, setAnularOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["liquidacoes", status, search, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Liquidacao>>("/liquidacoes", {
          params: { status: status === TODOS ? undefined : status, q: search || undefined, page, pageSize: 20 },
        })
      ).data,
  });

  const detailQuery = useQuery({
    queryKey: ["liquidacao", detailId],
    queryFn: async () => (await api.get<Liquidacao>(`/liquidacoes/${detailId}`)).data,
    enabled: !!detailId,
  });

  const empenhosQuery = useQuery({
    queryKey: ["empenhos", "select-liquidacao"],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Empenho>>("/empenhos", {
          params: { status: "NORMAL", pageSize: 200 },
        })
      ).data.data.filter((e) => Number(e.saldoNaoLiquidado ?? 0) > 0),
    enabled: dialogOpen,
  });

  const form = useForm<LiquidacaoFormValues>({
    resolver: zodResolver(liquidacaoSchema) as Resolver<LiquidacaoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async (values: LiquidacaoFormValues) => {
      const payload = {
        ...values,
        documento: values.documento || null,
        tipoDocumento: values.tipoDocumento || null,
      };
      return (await api.post("/liquidacoes", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liquidacoes"] });
      queryClient.invalidateQueries({ queryKey: ["empenhos"] });
      toast({ title: "Liquidacao registrada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const anularForm = useForm<AnularFormValues>({
    resolver: zodResolver(anularSchema) as Resolver<AnularFormValues>,
    defaultValues: { justificativa: "" },
  });

  const anularMutation = useMutation({
    mutationFn: async (values: AnularFormValues) => (await api.post(`/liquidacoes/${detailId}/anular`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liquidacoes"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacao", detailId] });
      queryClient.invalidateQueries({ queryKey: ["empenhos"] });
      toast({ title: "Liquidacao anulada" });
      setAnularOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao anular", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Liquidacao>[] = [
    { header: "Numero", cell: (l) => <span className="font-medium">{l.numero}</span>, className: "w-20" },
    {
      header: "Empenho",
      cell: (l) => (l.empenho ? `${l.empenho.numero}/${l.empenho.exercicio}` : "-"),
      className: "w-28",
    },
    { header: "Credor", cell: (l) => l.empenho?.credor?.nome ?? "-" },
    { header: "Data", cell: (l) => formatDate(l.data), className: "w-28" },
    { header: "Documento", cell: (l) => l.documento ?? "-", className: "w-32" },
    { header: "Valor", cell: (l) => formatCurrency(l.valor), className: "w-32 text-right" },
    {
      header: "Status",
      className: "w-28",
      cell: (l) => <Badge variant={STATUS_VARIANT[l.status]}>{STATUS_LABELS[l.status]}</Badge>,
    },
  ];

  const liquidacao = detailQuery.data;
  const podeAnularAtual = liquidacao?.status === "LIQUIDADA" && !(liquidacao.pagamentos ?? []).some((p) => p.status === "PAGO");

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Liquidacoes"
        description="Atesto da despesa empenhada apos verificacao do direito do credor"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Liquidacao
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por historico ou documento..." className="w-72" />
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(l) => l.id} onRowClick={(l) => setDetailId(l.id)} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      {/* Dialog: nova liquidacao */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Liquidacao</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
            <Field label="Empenho" htmlFor="empenhoId" error={form.formState.errors.empenhoId?.message}>
              <Controller
                control={form.control}
                name="empenhoId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="empenhoId">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} disabled>Selecione</SelectItem>
                      {(empenhosQuery.data ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.numero}/{e.exercicio} - {e.credor?.nome} (saldo {formatCurrency(e.saldoNaoLiquidado)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                <Input id="data" type="date" {...form.register("data")} />
              </Field>
              <Field label="Documento" htmlFor="documento">
                <Input id="documento" {...form.register("documento")} />
              </Field>
              <Field label="Tipo Documento" htmlFor="tipoDocumento">
                <Input id="tipoDocumento" {...form.register("tipoDocumento")} />
              </Field>
            </div>

            <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
              <Input id="valor" type="number" step="0.01" min={0} {...form.register("valor")} />
            </Field>

            <Field label="Historico" htmlFor="historico" error={form.formState.errors.historico?.message}>
              <Textarea id="historico" rows={3} {...form.register("historico")} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: detalhe */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Liquidacao {liquidacao?.numero}</DialogTitle>
          </DialogHeader>

          {liquidacao && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Empenho: </span>{liquidacao.empenho?.numero}/{liquidacao.empenho?.exercicio}</div>
                <div><span className="text-muted-foreground">Credor: </span>{liquidacao.empenho?.credor?.nome}</div>
                <div><span className="text-muted-foreground">Data: </span>{formatDate(liquidacao.data)}</div>
                <div><span className="text-muted-foreground">Documento: </span>{liquidacao.documento ?? "-"} {liquidacao.tipoDocumento ? `(${liquidacao.tipoDocumento})` : ""}</div>
                <div><span className="text-muted-foreground">Valor: </span>{formatCurrency(liquidacao.valor)}</div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant={STATUS_VARIANT[liquidacao.status]}>{STATUS_LABELS[liquidacao.status]}</Badge>
                </div>
                <div className="col-span-2"><span className="text-muted-foreground">Historico: </span>{liquidacao.historico}</div>
              </div>

              {liquidacao.retencao && (
                <div className="rounded-md border p-2 text-sm">
                  <p className="mb-1 font-medium">Retencao Tributaria (PF)</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-xs text-muted-foreground">INSS</div><div className="font-semibold">{formatCurrency(liquidacao.retencao.inssRetido)}</div></div>
                    <div><div className="text-xs text-muted-foreground">IRRF</div><div className="font-semibold">{formatCurrency(liquidacao.retencao.irrfRetido)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Liquido</div><div className="font-semibold">{formatCurrency(liquidacao.retencao.valorLiquido)}</div></div>
                  </div>
                </div>
              )}

              {podeAnular && podeAnularAtual && (
                <Button size="sm" variant="outline" onClick={() => { anularForm.reset({ justificativa: "" }); setAnularOpen(true); }}>
                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                  Anular Liquidacao
                </Button>
              )}

              {!!liquidacao.pagamentos?.length && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Pagamentos</p>
                  <DataTable
                    columns={[
                      { header: "Numero", cell: (p) => p.numero, className: "w-20" },
                      { header: "Data", cell: (p) => formatDate(p.data), className: "w-28" },
                      { header: "Valor", cell: (p) => formatCurrency(p.valor), className: "w-32 text-right" },
                      { header: "Forma", cell: (p) => p.formaPagamento, className: "w-24" },
                      {
                        header: "Status",
                        className: "w-28",
                        cell: (p) => <Badge variant={PAGAMENTO_STATUS_VARIANT[p.status]}>{PAGAMENTO_STATUS_LABELS[p.status]}</Badge>,
                      },
                    ]}
                    data={liquidacao.pagamentos}
                    getRowId={(p) => p.id}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: anular */}
      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anular Liquidacao</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={anularForm.handleSubmit((values) => anularMutation.mutate(values))}>
            <Field label="Justificativa" htmlFor="justificativaAnulacao" error={anularForm.formState.errors.justificativa?.message}>
              <Textarea id="justificativaAnulacao" rows={3} {...anularForm.register("justificativa")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAnularOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={anularMutation.isPending}>Confirmar Anulacao</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
