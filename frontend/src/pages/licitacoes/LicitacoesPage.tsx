import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, ListTree } from "lucide-react";
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
import type { Licitacao, LicitacaoItem, ModalidadeLicitacao, StatusLicitacao } from "@/types/scaffold";

const TODOS = "__todos__";
const NONE = "__none__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const MODALIDADE_LABELS: Record<ModalidadeLicitacao, string> = {
  DISPENSA: "Dispensa",
  INEXIGIBILIDADE: "Inexigibilidade",
  PREGAO: "Pregao",
  CONCORRENCIA: "Concorrencia",
  CREDENCIAMENTO: "Credenciamento",
  CONCURSO: "Concurso",
  LEILAO: "Leilao",
};

const STATUS_LABELS: Record<StatusLicitacao, string> = {
  EM_ANDAMENTO: "Em Andamento",
  HOMOLOGADA: "Homologada",
  FRACASSADA: "Fracassada",
  DESERTA: "Deserta",
  REVOGADA: "Revogada",
  ANULADA: "Anulada",
};

const STATUS_VARIANT: Record<StatusLicitacao, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  EM_ANDAMENTO: "default",
  HOMOLOGADA: "success",
  FRACASSADA: "destructive",
  DESERTA: "warning",
  REVOGADA: "secondary",
  ANULADA: "destructive",
};

const numberPreprocess = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

const licitacaoSchema = z.object({
  exercicio: z.preprocess(numberPreprocess, z.number().int()),
  numero: z.string().min(1, "Informe o numero"),
  modalidade: z.enum(["DISPENSA", "INEXIGIBILIDADE", "PREGAO", "CONCORRENCIA", "CREDENCIAMENTO", "CONCURSO", "LEILAO"]),
  objeto: z.string().min(3, "Informe o objeto"),
  processo: z.string().optional(),
  dataAbertura: z.string().min(1, "Informe a data de abertura"),
  valorEstimado: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  valorHomologado: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  status: z.enum(["EM_ANDAMENTO", "HOMOLOGADA", "FRACASSADA", "DESERTA", "REVOGADA", "ANULADA"]),
});

type LicitacaoFormValues = z.infer<typeof licitacaoSchema>;

const DEFAULT_VALUES: LicitacaoFormValues = {
  exercicio: ANO_ATUAL,
  numero: "",
  modalidade: "PREGAO",
  objeto: "",
  processo: "",
  dataAbertura: toInputDate(new Date()),
  valorEstimado: 0,
  valorHomologado: 0,
  status: "EM_ANDAMENTO",
};

const itemSchema = z.object({
  item: z.preprocess(numberPreprocess, z.number().int().positive()),
  descricao: z.string().min(1, "Informe a descricao"),
  unidade: z.string().min(1, "Informe a unidade"),
  quantidade: z.preprocess(numberPreprocess, z.number().positive()),
  valorEstimado: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  vencedorCredorId: z.string().optional(),
  valorVencedor: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).optional()),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const ITEM_DEFAULT_VALUES: ItemFormValues = {
  item: 1,
  descricao: "",
  unidade: "",
  quantidade: 1,
  valorEstimado: 0,
  vencedorCredorId: undefined,
  valorVencedor: undefined,
};

export default function LicitacoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [exercicioFiltro, setExercicioFiltro] = useState(String(ANO_ATUAL));
  const [modalidadeFiltro, setModalidadeFiltro] = useState(TODOS);
  const [statusFiltro, setStatusFiltro] = useState(TODOS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Licitacao | null>(null);
  const [deleting, setDeleting] = useState<Licitacao | null>(null);
  const [itensDialog, setItensDialog] = useState<Licitacao | null>(null);

  const podeCriar = hasPermissao("LICITACOES", "CRIAR");
  const podeEditar = hasPermissao("LICITACOES", "EDITAR");
  const podeExcluir = hasPermissao("LICITACOES", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["licitacoes", search, exercicioFiltro, modalidadeFiltro, statusFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Licitacao>>("/licitacoes", {
          params: {
            q: search || undefined,
            exercicio: exercicioFiltro !== TODOS ? exercicioFiltro : undefined,
            modalidade: modalidadeFiltro !== TODOS ? modalidadeFiltro : undefined,
            status: statusFiltro !== TODOS ? statusFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const form = useForm<LicitacaoFormValues>({
    resolver: zodResolver(licitacaoSchema) as Resolver<LicitacaoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(licitacao: Licitacao) {
    setEditing(licitacao);
    form.reset({
      exercicio: licitacao.exercicio,
      numero: licitacao.numero,
      modalidade: licitacao.modalidade,
      objeto: licitacao.objeto,
      processo: licitacao.processo ?? "",
      dataAbertura: toInputDate(licitacao.dataAbertura),
      valorEstimado: licitacao.valorEstimado,
      valorHomologado: licitacao.valorHomologado,
      status: licitacao.status,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: LicitacaoFormValues) => {
      const payload = { ...values, processo: values.processo || null };
      if (editing) return (await api.put(`/licitacoes/${editing.id}`, payload)).data;
      return (await api.post("/licitacoes", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licitacoes"] });
      toast({ title: editing ? "Licitacao atualizada" : "Licitacao criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/licitacoes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licitacoes"] });
      toast({ title: "Licitacao excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Licitacao>[] = [
    { header: "Numero", cell: (l) => <span className="font-medium">{l.numero}</span>, className: "w-32" },
    { header: "Exercicio", cell: (l) => l.exercicio, className: "w-20" },
    { header: "Modalidade", cell: (l) => MODALIDADE_LABELS[l.modalidade], className: "w-40" },
    { header: "Objeto", cell: (l) => <span className="line-clamp-2">{l.objeto}</span> },
    { header: "Data Abertura", cell: (l) => formatDate(l.dataAbertura), className: "w-32" },
    { header: "Valor Estimado", cell: (l) => <span className="font-mono">{formatCurrency(l.valorEstimado)}</span>, className: "w-36 text-right" },
    { header: "Valor Homologado", cell: (l) => <span className="font-mono">{formatCurrency(l.valorHomologado)}</span>, className: "w-36 text-right" },
    {
      header: "Status",
      className: "w-32",
      cell: (l) => <Badge variant={STATUS_VARIANT[l.status]}>{STATUS_LABELS[l.status]}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-28 text-right",
      cell: (l) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setItensDialog(l)} title="Itens">
            <ListTree className="h-3.5 w-3.5" />
          </Button>
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(l)}>
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
        title="Licitacoes"
        description="Processos licitatorios conforme Lei 14.133/2021"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Licitacao
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por numero, objeto ou processo..." />
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
        <Select value={modalidadeFiltro} onValueChange={(v) => { setModalidadeFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as modalidades</SelectItem>
            {Object.entries(MODALIDADE_LABELS).map(([value, label]) => (
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
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(l) => l.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Licitacao" : "Nova Licitacao"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Exercicio" htmlFor="exercicio" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...form.register("exercicio")} />
              </Field>
              <Field label="Numero" htmlFor="numero" error={form.formState.errors.numero?.message} className="col-span-2">
                <Input id="numero" placeholder="Ex: 001/2026" {...form.register("numero")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Modalidade" htmlFor="modalidade">
                <Controller
                  control={form.control}
                  name="modalidade"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as ModalidadeLicitacao)}>
                      <SelectTrigger id="modalidade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODALIDADE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Processo Administrativo" htmlFor="processo">
                <Input id="processo" {...form.register("processo")} />
              </Field>
            </div>
            <Field label="Objeto" htmlFor="objeto" error={form.formState.errors.objeto?.message}>
              <Input id="objeto" {...form.register("objeto")} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Data de Abertura" htmlFor="dataAbertura" error={form.formState.errors.dataAbertura?.message}>
                <Input id="dataAbertura" type="date" {...form.register("dataAbertura")} />
              </Field>
              <Field label="Valor Estimado" htmlFor="valorEstimado">
                <Input id="valorEstimado" type="number" step="0.01" min="0" {...form.register("valorEstimado")} />
              </Field>
              <Field label="Valor Homologado" htmlFor="valorHomologado">
                <Input id="valorHomologado" type="number" step="0.01" min="0" {...form.register("valorHomologado")} />
              </Field>
            </div>
            <Field label="Status" htmlFor="status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as StatusLicitacao)}>
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
        title="Excluir licitacao"
        description={`Deseja realmente excluir a licitacao "${deleting?.numero}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />

      {itensDialog && (
        <ItensDialog
          licitacao={itensDialog}
          podeEditar={podeEditar}
          onClose={() => setItensDialog(null)}
        />
      )}
    </div>
  );
}

interface ItensDialogProps {
  licitacao: Licitacao;
  podeEditar: boolean;
  onClose: () => void;
}

function ItensDialog({ licitacao, podeEditar, onClose }: ItensDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<LicitacaoItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const detalheQuery = useQuery({
    queryKey: ["licitacao", licitacao.id],
    queryFn: async () => (await api.get<Licitacao>(`/licitacoes/${licitacao.id}`)).data,
  });

  const credoresQuery = useQuery({
    queryKey: ["credores-all"],
    queryFn: async () => (await api.get<PaginatedResponse<Credor>>("/credores", { params: { pageSize: 100 } })).data,
  });

  const itens = detalheQuery.data?.itens ?? [];

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema) as Resolver<ItemFormValues>,
    defaultValues: { ...ITEM_DEFAULT_VALUES, item: itens.length + 1 },
  });

  function openCreate() {
    setEditingItem(null);
    form.reset({ ...ITEM_DEFAULT_VALUES, item: itens.length + 1 });
    setFormOpen(true);
  }

  function openEdit(item: LicitacaoItem) {
    setEditingItem(item);
    form.reset({
      item: item.item,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorEstimado: item.valorEstimado,
      vencedorCredorId: item.vencedorCredorId ?? undefined,
      valorVencedor: item.valorVencedor ?? undefined,
    });
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ItemFormValues) => {
      const payload = {
        ...values,
        vencedorCredorId: values.vencedorCredorId || null,
        valorVencedor: values.valorVencedor ?? null,
      };
      if (editingItem) return (await api.put(`/licitacoes/itens/${editingItem.id}`, payload)).data;
      return (await api.post(`/licitacoes/${licitacao.id}/itens`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licitacao", licitacao.id] });
      queryClient.invalidateQueries({ queryKey: ["licitacoes"] });
      toast({ title: editingItem ? "Item atualizado" : "Item adicionado" });
      setFormOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar item", description: getErrorMessage(error), variant: "destructive" }),
  });

  const itemColumns: DataTableColumn<LicitacaoItem>[] = [
    { header: "Item", cell: (i) => i.item, className: "w-16" },
    { header: "Descricao", cell: (i) => i.descricao },
    { header: "Unidade", cell: (i) => i.unidade, className: "w-24" },
    { header: "Quantidade", cell: (i) => i.quantidade, className: "w-28 text-right" },
    { header: "Valor Estimado", cell: (i) => <span className="font-mono">{formatCurrency(i.valorEstimado)}</span>, className: "w-32 text-right" },
    { header: "Vencedor", cell: (i) => i.vencedorCredor?.nome ?? "-" },
    { header: "Valor Vencedor", cell: (i) => (i.valorVencedor != null ? <span className="font-mono">{formatCurrency(i.valorVencedor)}</span> : "-"), className: "w-32 text-right" },
    {
      header: "Acoes",
      className: "w-16 text-right",
      cell: (i) =>
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Itens da Licitacao {licitacao.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {podeEditar && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          )}

          {formOpen && (
            <Card className="space-y-3 p-3">
              <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="Item" htmlFor="item" error={form.formState.errors.item?.message}>
                    <Input id="item" type="number" {...form.register("item")} />
                  </Field>
                  <Field label="Unidade" htmlFor="unidade" error={form.formState.errors.unidade?.message}>
                    <Input id="unidade" {...form.register("unidade")} />
                  </Field>
                  <Field label="Quantidade" htmlFor="quantidade" error={form.formState.errors.quantidade?.message}>
                    <Input id="quantidade" type="number" step="0.0001" {...form.register("quantidade")} />
                  </Field>
                  <Field label="Valor Estimado" htmlFor="valorEstimadoItem">
                    <Input id="valorEstimadoItem" type="number" step="0.01" {...form.register("valorEstimado")} />
                  </Field>
                </div>
                <Field label="Descricao" htmlFor="descricaoItem" error={form.formState.errors.descricao?.message}>
                  <Input id="descricaoItem" {...form.register("descricao")} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Credor Vencedor" htmlFor="vencedorCredorId">
                    <Controller
                      control={form.control}
                      name="vencedorCredorId"
                      render={({ field }) => (
                        <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                          <SelectTrigger id="vencedorCredorId">
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
                  <Field label="Valor Vencedor" htmlFor="valorVencedor">
                    <Input id="valorVencedor" type="number" step="0.01" {...form.register("valorVencedor")} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>Salvar Item</Button>
                </div>
              </form>
            </Card>
          )}

          <DataTable columns={itemColumns} data={itens} isLoading={detalheQuery.isLoading} getRowId={(i) => i.id} emptyMessage="Nenhum item cadastrado." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
