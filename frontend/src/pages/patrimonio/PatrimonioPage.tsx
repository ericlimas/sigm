import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { Bem, BemMovimentacao, CategoriaBem, StatusBem, TipoMovimentoBem } from "@/types/scaffold";

const TODOS = "__todos__";
const NONE = "__none__";

const CATEGORIA_LABELS: Record<CategoriaBem, string> = {
  MOVEL: "Movel",
  IMOVEL: "Imovel",
  VEICULO: "Veiculo",
  EQUIPAMENTO_TI: "Equipamento de TI",
  OUTROS: "Outros",
};

const STATUS_LABELS: Record<StatusBem, string> = {
  ATIVO: "Ativo",
  TRANSFERIDO: "Transferido",
  BAIXADO: "Baixado",
  EM_MANUTENCAO: "Em Manutencao",
};

const STATUS_VARIANT: Record<StatusBem, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  ATIVO: "success",
  TRANSFERIDO: "default",
  BAIXADO: "destructive",
  EM_MANUTENCAO: "warning",
};

const TIPO_MOVIMENTACAO_LABELS: Record<TipoMovimentoBem, string> = {
  AQUISICAO: "Aquisicao",
  TRANSFERENCIA: "Transferencia",
  BAIXA: "Baixa",
  DEPRECIACAO: "Depreciacao",
  REAVALIACAO: "Reavaliacao",
};

const numberPreprocess = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));
const optionalNumberPreprocess = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

const bemSchema = z.object({
  numeroTombamento: z.string().min(1, "Informe o numero de tombamento"),
  descricao: z.string().min(2, "Informe a descricao"),
  categoria: z.enum(["MOVEL", "IMOVEL", "VEICULO", "EQUIPAMENTO_TI", "OUTROS"]),
  dataAquisicao: z.string().min(1, "Informe a data de aquisicao"),
  valorAquisicao: z.preprocess(numberPreprocess, z.number().positive("Informe um valor maior que zero")),
  vidaUtilAnos: z.preprocess(optionalNumberPreprocess, z.number().int().positive().optional()),
  taxaDepreciacaoAnual: z.preprocess(optionalNumberPreprocess, z.number().min(0).max(100).optional()),
  localizacao: z.string().optional(),
  responsavelCredorId: z.string().optional(),
  status: z.enum(["ATIVO", "TRANSFERIDO", "BAIXADO", "EM_MANUTENCAO"]),
});

type BemFormValues = z.infer<typeof bemSchema>;

const DEFAULT_VALUES: BemFormValues = {
  numeroTombamento: "",
  descricao: "",
  categoria: "MOVEL",
  dataAquisicao: toInputDate(new Date()),
  valorAquisicao: 0,
  vidaUtilAnos: undefined,
  taxaDepreciacaoAnual: undefined,
  localizacao: "",
  responsavelCredorId: undefined,
  status: "ATIVO",
};

const movimentacaoSchema = z.object({
  tipo: z.enum(["AQUISICAO", "TRANSFERENCIA", "BAIXA", "DEPRECIACAO", "REAVALIACAO"]),
  data: z.string().min(1, "Informe a data"),
  valor: z.preprocess(optionalNumberPreprocess, z.number().optional()),
  localOrigem: z.string().optional(),
  localDestino: z.string().optional(),
  descricao: z.string().optional(),
});

type MovimentacaoFormValues = z.infer<typeof movimentacaoSchema>;

const MOVIMENTACAO_DEFAULT_VALUES: MovimentacaoFormValues = {
  tipo: "TRANSFERENCIA",
  data: toInputDate(new Date()),
  valor: undefined,
  localOrigem: "",
  localDestino: "",
  descricao: "",
};

export default function PatrimonioPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(TODOS);
  const [statusFiltro, setStatusFiltro] = useState(TODOS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bem | null>(null);
  const [deleting, setDeleting] = useState<Bem | null>(null);
  const [movimentacoesDialog, setMovimentacoesDialog] = useState<Bem | null>(null);

  const podeCriar = hasPermissao("PATRIMONIO", "CRIAR");
  const podeEditar = hasPermissao("PATRIMONIO", "EDITAR");
  const podeExcluir = hasPermissao("PATRIMONIO", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["bens", search, categoriaFiltro, statusFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Bem>>("/patrimonio/bens", {
          params: {
            q: search || undefined,
            categoria: categoriaFiltro !== TODOS ? categoriaFiltro : undefined,
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

  const form = useForm<BemFormValues>({
    resolver: zodResolver(bemSchema) as Resolver<BemFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(bem: Bem) {
    setEditing(bem);
    form.reset({
      numeroTombamento: bem.numeroTombamento,
      descricao: bem.descricao,
      categoria: bem.categoria,
      dataAquisicao: toInputDate(bem.dataAquisicao),
      valorAquisicao: bem.valorAquisicao,
      vidaUtilAnos: bem.vidaUtilAnos ?? undefined,
      taxaDepreciacaoAnual: bem.taxaDepreciacaoAnual ?? undefined,
      localizacao: bem.localizacao ?? "",
      responsavelCredorId: bem.responsavelCredorId ?? undefined,
      status: bem.status,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: BemFormValues) => {
      const payload = {
        ...values,
        vidaUtilAnos: values.vidaUtilAnos ?? null,
        taxaDepreciacaoAnual: values.taxaDepreciacaoAnual ?? null,
        localizacao: values.localizacao || null,
        responsavelCredorId: values.responsavelCredorId || null,
      };
      if (editing) return (await api.put(`/patrimonio/bens/${editing.id}`, payload)).data;
      return (await api.post("/patrimonio/bens", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bens"] });
      toast({ title: editing ? "Bem atualizado" : "Bem cadastrado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/patrimonio/bens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bens"] });
      toast({ title: "Bem excluido" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Bem>[] = [
    { header: "Tombamento", cell: (b) => <span className="font-mono">{b.numeroTombamento}</span>, className: "w-32" },
    { header: "Descricao", cell: (b) => <span className="font-medium">{b.descricao}</span> },
    { header: "Categoria", cell: (b) => CATEGORIA_LABELS[b.categoria], className: "w-36" },
    { header: "Aquisicao", cell: (b) => formatDate(b.dataAquisicao), className: "w-28" },
    { header: "Valor Aquisicao", cell: (b) => <span className="font-mono">{formatCurrency(b.valorAquisicao)}</span>, className: "w-32 text-right" },
    { header: "Valor Atual", cell: (b) => <span className="font-mono">{formatCurrency(b.valorAtual)}</span>, className: "w-32 text-right" },
    { header: "Localizacao", cell: (b) => b.localizacao ?? "-", className: "w-36" },
    { header: "Responsavel", cell: (b) => b.responsavelCredor?.nome ?? "-" },
    {
      header: "Status",
      className: "w-32",
      cell: (b) => <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABELS[b.status]}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-28 text-right",
      cell: (b) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMovimentacoesDialog(b)} title="Movimentacoes">
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(b)}>
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
        title="Patrimonio"
        description="Bens moveis e imoveis, depreciacao e movimentacoes patrimoniais"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Bem
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por tombamento ou descricao..." />
        <Select value={categoriaFiltro} onValueChange={(v) => { setCategoriaFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as categorias</SelectItem>
            {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
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
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(b) => b.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Bem" : "Novo Bem"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Numero de Tombamento" htmlFor="numeroTombamento" error={form.formState.errors.numeroTombamento?.message}>
                <Input id="numeroTombamento" {...form.register("numeroTombamento")} />
              </Field>
              <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message} className="col-span-2">
                <Input id="descricao" {...form.register("descricao")} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Categoria" htmlFor="categoria">
                <Controller
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as CategoriaBem)}>
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
              <Field label="Data de Aquisicao" htmlFor="dataAquisicao" error={form.formState.errors.dataAquisicao?.message}>
                <Input id="dataAquisicao" type="date" {...form.register("dataAquisicao")} />
              </Field>
              <Field label="Valor de Aquisicao" htmlFor="valorAquisicao" error={form.formState.errors.valorAquisicao?.message}>
                <Input id="valorAquisicao" type="number" step="0.01" min="0" {...form.register("valorAquisicao")} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Vida Util (anos)" htmlFor="vidaUtilAnos">
                <Input id="vidaUtilAnos" type="number" min="1" {...form.register("vidaUtilAnos")} />
              </Field>
              <Field label="Taxa de Depreciacao Anual (%)" htmlFor="taxaDepreciacaoAnual">
                <Input id="taxaDepreciacaoAnual" type="number" step="0.01" min="0" max="100" {...form.register("taxaDepreciacaoAnual")} />
              </Field>
              <Field label="Status" htmlFor="status">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as StatusBem)}>
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
              <Field label="Localizacao" htmlFor="localizacao">
                <Input id="localizacao" {...form.register("localizacao")} />
              </Field>
              <Field label="Responsavel" htmlFor="responsavelCredorId">
                <Controller
                  control={form.control}
                  name="responsavelCredorId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                      <SelectTrigger id="responsavelCredorId">
                        <SelectValue placeholder="Nao definido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nao definido</SelectItem>
                        {credoresQuery.data?.data.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
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
        title="Excluir bem"
        description={`Deseja realmente excluir o bem "${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />

      {movimentacoesDialog && (
        <MovimentacoesDialog bem={movimentacoesDialog} podeEditar={podeEditar} onClose={() => setMovimentacoesDialog(null)} />
      )}
    </div>
  );
}

interface MovimentacoesDialogProps {
  bem: Bem;
  podeEditar: boolean;
  onClose: () => void;
}

function MovimentacoesDialog({ bem, podeEditar, onClose }: MovimentacoesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const detalheQuery = useQuery({
    queryKey: ["bem", bem.id],
    queryFn: async () => (await api.get<Bem>(`/patrimonio/bens/${bem.id}`)).data,
  });

  const movimentacoes = detalheQuery.data?.movimentacoes ?? [];
  const atual = detalheQuery.data ?? bem;

  const form = useForm<MovimentacaoFormValues>({
    resolver: zodResolver(movimentacaoSchema) as Resolver<MovimentacaoFormValues>,
    defaultValues: MOVIMENTACAO_DEFAULT_VALUES,
  });

  const tipo = form.watch("tipo");

  const saveMutation = useMutation({
    mutationFn: async (values: MovimentacaoFormValues) => {
      const payload = {
        ...values,
        valor: values.valor ?? null,
        localOrigem: values.localOrigem || null,
        localDestino: values.localDestino || null,
        descricao: values.descricao || null,
      };
      return (await api.post(`/patrimonio/bens/${bem.id}/movimentacoes`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bem", bem.id] });
      queryClient.invalidateQueries({ queryKey: ["bens"] });
      toast({ title: "Movimentacao registrada" });
      form.reset(MOVIMENTACAO_DEFAULT_VALUES);
      setFormOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao registrar movimentacao", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<BemMovimentacao>[] = [
    { header: "Data", cell: (m) => formatDate(m.data), className: "w-28" },
    { header: "Tipo", cell: (m) => TIPO_MOVIMENTACAO_LABELS[m.tipo], className: "w-32" },
    { header: "Valor", cell: (m) => (m.valor != null ? <span className="font-mono">{formatCurrency(m.valor)}</span> : "-"), className: "w-32 text-right" },
    { header: "Origem", cell: (m) => m.localOrigem ?? "-", className: "w-32" },
    { header: "Destino", cell: (m) => m.localDestino ?? "-", className: "w-32" },
    { header: "Descricao", cell: (m) => m.descricao ?? "-" },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Movimentacoes - {bem.numeroTombamento} {bem.descricao}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{STATUS_LABELS[atual.status]}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Valor de Aquisicao</p>
              <p className="font-mono font-medium">{formatCurrency(atual.valorAquisicao)}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Valor Atual</p>
              <p className="font-mono font-medium">{formatCurrency(atual.valorAtual)}</p>
            </div>
          </div>

          {podeEditar && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Registrar Movimentacao
              </Button>
            </div>
          )}

          {formOpen && (
            <Card className="space-y-3 p-3">
              <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tipo" htmlFor="tipoMovimentacao">
                    <Controller
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoMovimentoBem)}>
                          <SelectTrigger id="tipoMovimentacao">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_MOVIMENTACAO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field label="Data" htmlFor="dataMovimentacao" error={form.formState.errors.data?.message}>
                    <Input id="dataMovimentacao" type="date" {...form.register("data")} />
                  </Field>
                  <Field label={tipo === "DEPRECIACAO" ? "Valor a Depreciar" : "Valor"} htmlFor="valorMovimentacao">
                    <Input id="valorMovimentacao" type="number" step="0.01" {...form.register("valor")} />
                  </Field>
                </div>
                {tipo === "TRANSFERENCIA" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Local de Origem" htmlFor="localOrigem">
                      <Input id="localOrigem" {...form.register("localOrigem")} />
                    </Field>
                    <Field label="Local de Destino" htmlFor="localDestino">
                      <Input id="localDestino" {...form.register("localDestino")} />
                    </Field>
                  </div>
                )}
                <Field label="Descricao" htmlFor="descricaoMovimentacao">
                  <Input id="descricaoMovimentacao" {...form.register("descricao")} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>Registrar</Button>
                </div>
              </form>
            </Card>
          )}

          <DataTable columns={columns} data={movimentacoes} isLoading={detalheQuery.isLoading} getRowId={(m) => m.id} emptyMessage="Nenhuma movimentacao registrada." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
