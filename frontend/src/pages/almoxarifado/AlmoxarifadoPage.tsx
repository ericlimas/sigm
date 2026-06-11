import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowDownCircle, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime, formatNumber, toInputDate } from "@/lib/utils";
import type { Material, MovimentoEstoque, TipoMovimentoEstoque } from "@/types/scaffold";

const TODOS = "__todos__";

const TIPO_LABELS: Record<TipoMovimentoEstoque, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saida",
  TRANSFERENCIA: "Transferencia",
  AJUSTE: "Ajuste (definir saldo)",
};

const numberPreprocess = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

const materialSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  descricao: z.string().min(2, "Informe a descricao"),
  unidade: z.string().min(1, "Informe a unidade"),
  categoria: z.string().optional(),
  estoqueMinimo: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  ativo: z.boolean().optional(),
});

type MaterialFormValues = z.infer<typeof materialSchema>;

const DEFAULT_VALUES: MaterialFormValues = {
  codigo: "",
  descricao: "",
  unidade: "",
  categoria: "",
  estoqueMinimo: 0,
  ativo: true,
};

const movimentoSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA", "TRANSFERENCIA", "AJUSTE"]),
  data: z.string().min(1, "Informe a data"),
  quantidade: z.preprocess(numberPreprocess, z.number().positive("Informe uma quantidade maior que zero")),
  valorUnitario: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  documento: z.string().optional(),
  observacao: z.string().optional(),
});

type MovimentoFormValues = z.infer<typeof movimentoSchema>;

const MOVIMENTO_DEFAULT_VALUES: MovimentoFormValues = {
  tipo: "ENTRADA",
  data: toInputDate(new Date()),
  quantidade: 1,
  valorUnitario: 0,
  documento: "",
  observacao: "",
};

export default function AlmoxarifadoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [ativoFiltro, setAtivoFiltro] = useState(TODOS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [movimentosDialog, setMovimentosDialog] = useState<Material | null>(null);

  const podeCriar = hasPermissao("ALMOXARIFADO", "CRIAR");
  const podeEditar = hasPermissao("ALMOXARIFADO", "EDITAR");
  const podeExcluir = hasPermissao("ALMOXARIFADO", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["materiais", search, ativoFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Material>>("/almoxarifado/materiais", {
          params: {
            q: search || undefined,
            ativo: ativoFiltro !== TODOS ? ativoFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema) as Resolver<MaterialFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(material: Material) {
    setEditing(material);
    form.reset({
      codigo: material.codigo,
      descricao: material.descricao,
      unidade: material.unidade,
      categoria: material.categoria ?? "",
      estoqueMinimo: material.estoqueMinimo,
      ativo: material.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: MaterialFormValues) => {
      const payload = { ...values, categoria: values.categoria || null };
      if (editing) return (await api.put(`/almoxarifado/materiais/${editing.id}`, payload)).data;
      return (await api.post("/almoxarifado/materiais", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast({ title: editing ? "Material atualizado" : "Material criado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/almoxarifado/materiais/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast({ title: "Material excluido" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Material>[] = [
    { header: "Codigo", cell: (m) => <span className="font-mono">{m.codigo}</span>, className: "w-28" },
    { header: "Descricao", cell: (m) => <span className="font-medium">{m.descricao}</span> },
    { header: "Unidade", cell: (m) => m.unidade, className: "w-20" },
    { header: "Categoria", cell: (m) => m.categoria ?? "-", className: "w-36" },
    {
      header: "Estoque Atual",
      className: "w-32 text-right",
      cell: (m) => (
        <span className={`font-mono ${Number(m.estoqueAtual) < Number(m.estoqueMinimo) ? "text-destructive font-semibold" : ""}`}>
          {formatNumber(m.estoqueAtual, 4)}
        </span>
      ),
    },
    { header: "Estoque Minimo", cell: (m) => <span className="font-mono">{formatNumber(m.estoqueMinimo, 4)}</span>, className: "w-32 text-right" },
    { header: "Valor Medio", cell: (m) => <span className="font-mono">{formatCurrency(m.valorMedio)}</span>, className: "w-32 text-right" },
    {
      header: "Status",
      className: "w-24",
      cell: (m) => <Badge variant={m.ativo ? "success" : "secondary"}>{m.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-28 text-right",
      cell: (m) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMovimentosDialog(m)} title="Movimentar Estoque">
            <ArrowDownCircle className="h-3.5 w-3.5" />
          </Button>
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(m)}>
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
        title="Almoxarifado"
        description="Controle de materiais de consumo, estoque e movimentacoes"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Material
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por codigo ou descricao..." />
        <Select value={ativoFiltro} onValueChange={(v) => { setAtivoFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(m) => m.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Material" : "Novo Material"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Codigo" htmlFor="codigo" error={form.formState.errors.codigo?.message}>
                <Input id="codigo" {...form.register("codigo")} />
              </Field>
              <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message} className="col-span-2">
                <Input id="descricao" {...form.register("descricao")} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unidade" htmlFor="unidade" error={form.formState.errors.unidade?.message}>
                <Input id="unidade" placeholder="UN, CX, KG..." {...form.register("unidade")} />
              </Field>
              <Field label="Categoria" htmlFor="categoria" className="col-span-2">
                <Input id="categoria" {...form.register("categoria")} />
              </Field>
            </div>
            <Field label="Estoque Minimo" htmlFor="estoqueMinimo">
              <Input id="estoqueMinimo" type="number" step="0.0001" min="0" {...form.register("estoqueMinimo")} />
            </Field>
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir material"
        description={`Deseja realmente excluir o material "${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />

      {movimentosDialog && (
        <MovimentosDialog material={movimentosDialog} podeEditar={podeCriar} onClose={() => setMovimentosDialog(null)} />
      )}
    </div>
  );
}

interface MovimentosDialogProps {
  material: Material;
  podeEditar: boolean;
  onClose: () => void;
}

function MovimentosDialog({ material, podeEditar, onClose }: MovimentosDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const detalheQuery = useQuery({
    queryKey: ["material", material.id],
    queryFn: async () => (await api.get<Material>(`/almoxarifado/materiais/${material.id}`)).data,
  });

  const movimentos = detalheQuery.data?.movimentos ?? [];
  const atual = detalheQuery.data ?? material;

  const form = useForm<MovimentoFormValues>({
    resolver: zodResolver(movimentoSchema) as Resolver<MovimentoFormValues>,
    defaultValues: MOVIMENTO_DEFAULT_VALUES,
  });

  const tipo = form.watch("tipo");

  const saveMutation = useMutation({
    mutationFn: async (values: MovimentoFormValues) => {
      const payload = { ...values, documento: values.documento || null, observacao: values.observacao || null };
      return (await api.post(`/almoxarifado/materiais/${material.id}/movimentos`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material", material.id] });
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast({ title: "Movimentacao registrada" });
      form.reset(MOVIMENTO_DEFAULT_VALUES);
      setFormOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao registrar movimentacao", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<MovimentoEstoque>[] = [
    { header: "Data", cell: (m) => formatDateTime(m.createdAt), className: "w-40" },
    { header: "Tipo", cell: (m) => TIPO_LABELS[m.tipo], className: "w-32" },
    { header: "Quantidade", cell: (m) => <span className="font-mono">{formatNumber(m.quantidade, 4)}</span>, className: "w-28 text-right" },
    { header: "Valor Unitario", cell: (m) => <span className="font-mono">{formatCurrency(m.valorUnitario)}</span>, className: "w-32 text-right" },
    { header: "Documento", cell: (m) => m.documento ?? "-", className: "w-32" },
    { header: "Observacao", cell: (m) => m.observacao ?? "-" },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Movimentacoes - {material.codigo} {material.descricao}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Estoque Atual</p>
              <p className="font-mono font-medium">{formatNumber(atual.estoqueAtual, 4)} {material.unidade}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Estoque Minimo</p>
              <p className="font-mono font-medium">{formatNumber(atual.estoqueMinimo, 4)} {material.unidade}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Valor Medio</p>
              <p className="font-mono font-medium">{formatCurrency(atual.valorMedio)}</p>
            </div>
          </div>

          {Number(atual.estoqueAtual) < Number(atual.estoqueMinimo) && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Estoque atual abaixo do minimo definido. Considere providenciar reposicao.</span>
            </div>
          )}

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
                  <Field label="Tipo" htmlFor="tipoMovimento">
                    <Controller
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoMovimentoEstoque)}>
                          <SelectTrigger id="tipoMovimento">
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
                  <Field label="Data" htmlFor="dataMovimento" error={form.formState.errors.data?.message}>
                    <Input id="dataMovimento" type="date" {...form.register("data")} />
                  </Field>
                  <Field label={tipo === "AJUSTE" ? "Novo Saldo" : "Quantidade"} htmlFor="quantidade" error={form.formState.errors.quantidade?.message}>
                    <Input id="quantidade" type="number" step="0.0001" min="0" {...form.register("quantidade")} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Valor Unitario" htmlFor="valorUnitario">
                    <Input id="valorUnitario" type="number" step="0.0001" min="0" {...form.register("valorUnitario")} />
                  </Field>
                  <Field label="Documento" htmlFor="documento">
                    <Input id="documento" {...form.register("documento")} />
                  </Field>
                  <Field label="Observacao" htmlFor="observacao">
                    <Input id="observacao" {...form.register("observacao")} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>Registrar</Button>
                </div>
              </form>
            </Card>
          )}

          <DataTable columns={columns} data={movimentos} isLoading={detalheQuery.isLoading} getRowId={(m) => m.id} emptyMessage="Nenhuma movimentacao registrada." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
