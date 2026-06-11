import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, FileStack } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import SearchInput from "@/components/shared/SearchInput";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import type { Credor } from "@/types/cadastros";
import type { Contrato, ContratoAditivo, Licitacao, StatusContrato, TipoAditivo } from "@/types/scaffold";

const TODOS = "__todos__";
const NONE = "__none__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const STATUS_LABELS: Record<StatusContrato, string> = {
  VIGENTE: "Vigente",
  ENCERRADO: "Encerrado",
  RESCINDIDO: "Rescindido",
  SUSPENSO: "Suspenso",
};

const STATUS_VARIANT: Record<StatusContrato, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  VIGENTE: "success",
  ENCERRADO: "secondary",
  RESCINDIDO: "destructive",
  SUSPENSO: "warning",
};

const TIPO_ADITIVO_LABELS: Record<TipoAditivo, string> = {
  PRAZO: "Prazo",
  VALOR: "Valor",
  PRAZO_VALOR: "Prazo e Valor",
  QUALITATIVO: "Qualitativo",
};

const numberPreprocess = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

const contratoSchema = z.object({
  numero: z.string().min(1, "Informe o numero"),
  exercicio: z.preprocess(numberPreprocess, z.number().int()),
  licitacaoId: z.string().optional(),
  credorId: z.string().min(1, "Selecione o credor"),
  objeto: z.string().min(3, "Informe o objeto"),
  dataInicio: z.string().min(1, "Informe a data de inicio"),
  dataFim: z.string().min(1, "Informe a data de fim"),
  valor: z.preprocess(numberPreprocess, z.number().positive("Informe um valor maior que zero")),
  status: z.enum(["VIGENTE", "ENCERRADO", "RESCINDIDO", "SUSPENSO"]),
});

type ContratoFormValues = z.infer<typeof contratoSchema>;

const DEFAULT_VALUES: ContratoFormValues = {
  numero: "",
  exercicio: ANO_ATUAL,
  licitacaoId: undefined,
  credorId: "",
  objeto: "",
  dataInicio: toInputDate(new Date()),
  dataFim: toInputDate(new Date()),
  valor: 0,
  status: "VIGENTE",
};

const aditivoSchema = z.object({
  tipo: z.enum(["PRAZO", "VALOR", "PRAZO_VALOR", "QUALITATIVO"]),
  data: z.string().min(1, "Informe a data"),
  valor: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).optional()),
  novaDataFim: z.string().optional(),
  descricao: z.string().optional(),
});

type AditivoFormValues = z.infer<typeof aditivoSchema>;

const ADITIVO_DEFAULT_VALUES: AditivoFormValues = {
  tipo: "PRAZO",
  data: toInputDate(new Date()),
  valor: undefined,
  novaDataFim: "",
  descricao: "",
};

export default function ContratosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [exercicioFiltro, setExercicioFiltro] = useState(String(ANO_ATUAL));
  const [statusFiltro, setStatusFiltro] = useState(TODOS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [deleting, setDeleting] = useState<Contrato | null>(null);
  const [aditivosDialog, setAditivosDialog] = useState<Contrato | null>(null);

  const podeCriar = hasPermissao("CONTRATOS", "CRIAR");
  const podeEditar = hasPermissao("CONTRATOS", "EDITAR");
  const podeExcluir = hasPermissao("CONTRATOS", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["contratos", search, exercicioFiltro, statusFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Contrato>>("/contratos", {
          params: {
            q: search || undefined,
            exercicio: exercicioFiltro !== TODOS ? exercicioFiltro : undefined,
            status: statusFiltro !== TODOS ? statusFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const credoresQuery = useQuery({
    queryKey: ["credores-all"],
    queryFn: async () => (await api.get<PaginatedResponse<Credor>>("/credores", { params: { pageSize: 100 } })).data,
  });

  const licitacoesQuery = useQuery({
    queryKey: ["licitacoes-all"],
    queryFn: async () => (await api.get<PaginatedResponse<Licitacao>>("/licitacoes", { params: { pageSize: 100 } })).data,
  });

  const form = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema) as Resolver<ContratoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(contrato: Contrato) {
    setEditing(contrato);
    form.reset({
      numero: contrato.numero,
      exercicio: contrato.exercicio,
      licitacaoId: contrato.licitacaoId ?? undefined,
      credorId: contrato.credorId,
      objeto: contrato.objeto,
      dataInicio: toInputDate(contrato.dataInicio),
      dataFim: toInputDate(contrato.dataFim),
      valor: contrato.valor,
      status: contrato.status,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ContratoFormValues) => {
      const payload = { ...values, licitacaoId: values.licitacaoId || null };
      if (editing) return (await api.put(`/contratos/${editing.id}`, payload)).data;
      return (await api.post("/contratos", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      toast({ title: editing ? "Contrato atualizado" : "Contrato criado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/contratos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      toast({ title: "Contrato excluido" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Contrato>[] = [
    { header: "Numero", cell: (c) => <span className="font-medium">{c.numero}</span>, className: "w-28" },
    { header: "Exercicio", cell: (c) => c.exercicio, className: "w-20" },
    { header: "Credor", cell: (c) => c.credor?.nome ?? "-" },
    { header: "Objeto", cell: (c) => <span className="line-clamp-2">{c.objeto}</span> },
    { header: "Vigencia", cell: (c) => `${formatDate(c.dataInicio)} a ${formatDate(c.dataFim)}`, className: "w-44" },
    { header: "Valor", cell: (c) => <span className="font-mono">{formatCurrency(c.valor)}</span>, className: "w-32 text-right" },
    { header: "Aditivado", cell: (c) => <span className="font-mono">{formatCurrency(c.valorAditivado)}</span>, className: "w-32 text-right" },
    {
      header: "Status",
      className: "w-28",
      cell: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABELS[c.status]}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-28 text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAditivosDialog(c)} title="Termos Aditivos">
            <FileStack className="h-3.5 w-3.5" />
          </Button>
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
        title="Contratos"
        description="Contratos administrativos vinculados a licitacoes ou credores"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Contrato
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por numero ou objeto..." />
        <Select value={exercicioFiltro} onValueChange={(v) => { setExercicioFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Exercicio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {EXERCICIOS.map((ano) => (
              <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={(v) => { setStatusFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(c) => c.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Numero" htmlFor="numero" error={form.formState.errors.numero?.message}>
                <Input id="numero" placeholder="Ex: 010/2026" {...form.register("numero")} />
              </Field>
              <Field label="Exercicio" htmlFor="exercicio" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...form.register("exercicio")} />
              </Field>
              <Field label="Status" htmlFor="status">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as StatusContrato)}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Credor" htmlFor="credorId" error={form.formState.errors.credorId?.message}>
                <Controller
                  control={form.control}
                  name="credorId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="credorId">
                        <SelectValue placeholder="Selecione o credor" />
                      </SelectTrigger>
                      <SelectContent>
                        {credoresQuery.data?.data.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Licitacao Vinculada" htmlFor="licitacaoId">
                <Controller
                  control={form.control}
                  name="licitacaoId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                      <SelectTrigger id="licitacaoId">
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                        {licitacoesQuery.data?.data.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.numero} - {l.objeto.slice(0, 40)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <Field label="Objeto" htmlFor="objeto" error={form.formState.errors.objeto?.message}>
              <Input id="objeto" {...form.register("objeto")} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Data de Inicio" htmlFor="dataInicio" error={form.formState.errors.dataInicio?.message}>
                <Input id="dataInicio" type="date" {...form.register("dataInicio")} />
              </Field>
              <Field label="Data de Fim" htmlFor="dataFim" error={form.formState.errors.dataFim?.message}>
                <Input id="dataFim" type="date" {...form.register("dataFim")} />
              </Field>
              <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
                <Input id="valor" type="number" step="0.01" min="0" {...form.register("valor")} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir contrato"
        description={`Deseja realmente excluir o contrato "${deleting?.numero}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />

      {aditivosDialog && (
        <AditivosDialog contrato={aditivosDialog} podeEditar={podeEditar} onClose={() => setAditivosDialog(null)} />
      )}
    </div>
  );
}

interface AditivosDialogProps {
  contrato: Contrato;
  podeEditar: boolean;
  onClose: () => void;
}

function AditivosDialog({ contrato, podeEditar, onClose }: AditivosDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const detalheQuery = useQuery({
    queryKey: ["contrato", contrato.id],
    queryFn: async () => (await api.get<Contrato>(`/contratos/${contrato.id}`)).data,
  });

  const aditivos = detalheQuery.data?.aditivos ?? [];

  const form = useForm<AditivoFormValues>({
    resolver: zodResolver(aditivoSchema) as Resolver<AditivoFormValues>,
    defaultValues: ADITIVO_DEFAULT_VALUES,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: AditivoFormValues) => {
      const payload = {
        ...values,
        valor: values.valor ?? null,
        novaDataFim: values.novaDataFim || null,
        descricao: values.descricao || null,
      };
      return (await api.post(`/contratos/${contrato.id}/aditivos`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrato", contrato.id] });
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      toast({ title: "Termo aditivo adicionado" });
      form.reset(ADITIVO_DEFAULT_VALUES);
      setFormOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar aditivo", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<ContratoAditivo>[] = [
    { header: "No", cell: (a) => a.numero, className: "w-12" },
    { header: "Tipo", cell: (a) => TIPO_ADITIVO_LABELS[a.tipo], className: "w-32" },
    { header: "Data", cell: (a) => formatDate(a.data), className: "w-28" },
    { header: "Valor", cell: (a) => (a.valor != null ? <span className="font-mono">{formatCurrency(a.valor)}</span> : "-"), className: "w-32 text-right" },
    { header: "Nova Data Fim", cell: (a) => (a.novaDataFim ? formatDate(a.novaDataFim) : "-"), className: "w-28" },
    { header: "Descricao", cell: (a) => a.descricao ?? "-" },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Termos Aditivos - Contrato {contrato.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {podeEditar && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo Aditivo
              </Button>
            </div>
          )}

          {formOpen && (
            <Card className="space-y-3 p-3">
              <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tipo" htmlFor="tipoAditivo">
                    <Controller
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoAditivo)}>
                          <SelectTrigger id="tipoAditivo">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_ADITIVO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field label="Data" htmlFor="dataAditivo" error={form.formState.errors.data?.message}>
                    <Input id="dataAditivo" type="date" {...form.register("data")} />
                  </Field>
                  <Field label="Nova Data Fim" htmlFor="novaDataFim">
                    <Input id="novaDataFim" type="date" {...form.register("novaDataFim")} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor (acrescimo/decrescimo)" htmlFor="valorAditivo">
                    <Input id="valorAditivo" type="number" step="0.01" {...form.register("valor")} />
                  </Field>
                  <Field label="Descricao" htmlFor="descricaoAditivo">
                    <Input id="descricaoAditivo" {...form.register("descricao")} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>Salvar Aditivo</Button>
                </div>
              </form>
            </Card>
          )}

          <DataTable columns={columns} data={aditivos} isLoading={detalheQuery.isLoading} getRowId={(a) => a.id} emptyMessage="Nenhum termo aditivo registrado." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
