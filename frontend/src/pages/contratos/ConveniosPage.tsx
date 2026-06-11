import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import type { Convenio, StatusConvenio } from "@/types/scaffold";

const TODOS = "__todos__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const STATUS_LABELS: Record<StatusConvenio, string> = {
  EM_EXECUCAO: "Em Execucao",
  CONCLUIDO: "Concluido",
  CANCELADO: "Cancelado",
  EM_PRESTACAO_CONTAS: "Em Prestacao de Contas",
};

const STATUS_VARIANT: Record<StatusConvenio, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  EM_EXECUCAO: "default",
  CONCLUIDO: "success",
  CANCELADO: "destructive",
  EM_PRESTACAO_CONTAS: "warning",
};

const numberPreprocess = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

const convenioSchema = z.object({
  numero: z.string().min(1, "Informe o numero"),
  exercicio: z.preprocess(numberPreprocess, z.number().int()),
  concedente: z.string().optional(),
  convenente: z.string().optional(),
  objeto: z.string().min(3, "Informe o objeto"),
  valorTotal: z.preprocess(numberPreprocess, z.number().positive("Informe um valor maior que zero")),
  valorContrapartida: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  vigenciaInicio: z.string().min(1, "Informe a data de inicio"),
  vigenciaFim: z.string().min(1, "Informe a data de fim"),
  status: z.enum(["EM_EXECUCAO", "CONCLUIDO", "CANCELADO", "EM_PRESTACAO_CONTAS"]),
});

type ConvenioFormValues = z.infer<typeof convenioSchema>;

const DEFAULT_VALUES: ConvenioFormValues = {
  numero: "",
  exercicio: ANO_ATUAL,
  concedente: "",
  convenente: "",
  objeto: "",
  valorTotal: 0,
  valorContrapartida: 0,
  vigenciaInicio: toInputDate(new Date()),
  vigenciaFim: toInputDate(new Date()),
  status: "EM_EXECUCAO",
};

export default function ConveniosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [exercicioFiltro, setExercicioFiltro] = useState(String(ANO_ATUAL));
  const [statusFiltro, setStatusFiltro] = useState(TODOS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Convenio | null>(null);
  const [deleting, setDeleting] = useState<Convenio | null>(null);

  const podeCriar = hasPermissao("CONVENIOS", "CRIAR");
  const podeEditar = hasPermissao("CONVENIOS", "EDITAR");
  const podeExcluir = hasPermissao("CONVENIOS", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["convenios", search, exercicioFiltro, statusFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Convenio>>("/convenios", {
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

  const form = useForm<ConvenioFormValues>({
    resolver: zodResolver(convenioSchema) as Resolver<ConvenioFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(convenio: Convenio) {
    setEditing(convenio);
    form.reset({
      numero: convenio.numero,
      exercicio: convenio.exercicio,
      concedente: convenio.concedente ?? "",
      convenente: convenio.convenente ?? "",
      objeto: convenio.objeto,
      valorTotal: convenio.valorTotal,
      valorContrapartida: convenio.valorContrapartida,
      vigenciaInicio: toInputDate(convenio.vigenciaInicio),
      vigenciaFim: toInputDate(convenio.vigenciaFim),
      status: convenio.status,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ConvenioFormValues) => {
      const payload = {
        ...values,
        concedente: values.concedente || null,
        convenente: values.convenente || null,
      };
      if (editing) return (await api.put(`/convenios/${editing.id}`, payload)).data;
      return (await api.post("/convenios", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convenios"] });
      toast({ title: editing ? "Convenio atualizado" : "Convenio criado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/convenios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convenios"] });
      toast({ title: "Convenio excluido" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Convenio>[] = [
    { header: "Numero", cell: (c) => <span className="font-medium">{c.numero}</span>, className: "w-28" },
    { header: "Exercicio", cell: (c) => c.exercicio, className: "w-20" },
    { header: "Concedente", cell: (c) => c.concedente ?? "-" },
    { header: "Convenente", cell: (c) => c.convenente ?? "-" },
    { header: "Objeto", cell: (c) => <span className="line-clamp-2">{c.objeto}</span> },
    { header: "Vigencia", cell: (c) => `${formatDate(c.vigenciaInicio)} a ${formatDate(c.vigenciaFim)}`, className: "w-44" },
    { header: "Valor Total", cell: (c) => <span className="font-mono">{formatCurrency(c.valorTotal)}</span>, className: "w-32 text-right" },
    { header: "Contrapartida", cell: (c) => <span className="font-mono">{formatCurrency(c.valorContrapartida)}</span>, className: "w-32 text-right" },
    {
      header: "Status",
      className: "w-40",
      cell: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABELS[c.status]}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-20 text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
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
        title="Convenios"
        description="Convenios firmados com a Uniao, Estado ou outras entidades"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Convenio
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por numero, objeto, concedente ou convenente..." />
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
          <SelectTrigger className="w-52">
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
            <DialogTitle>{editing ? "Editar Convenio" : "Novo Convenio"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Numero" htmlFor="numero" error={form.formState.errors.numero?.message}>
                <Input id="numero" placeholder="Ex: 015/2026" {...form.register("numero")} />
              </Field>
              <Field label="Exercicio" htmlFor="exercicio" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...form.register("exercicio")} />
              </Field>
              <Field label="Status" htmlFor="status">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as StatusConvenio)}>
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
              <Field label="Concedente" htmlFor="concedente">
                <Input id="concedente" {...form.register("concedente")} />
              </Field>
              <Field label="Convenente" htmlFor="convenente">
                <Input id="convenente" {...form.register("convenente")} />
              </Field>
            </div>
            <Field label="Objeto" htmlFor="objeto" error={form.formState.errors.objeto?.message}>
              <Input id="objeto" {...form.register("objeto")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor Total" htmlFor="valorTotal" error={form.formState.errors.valorTotal?.message}>
                <Input id="valorTotal" type="number" step="0.01" min="0" {...form.register("valorTotal")} />
              </Field>
              <Field label="Valor de Contrapartida" htmlFor="valorContrapartida">
                <Input id="valorContrapartida" type="number" step="0.01" min="0" {...form.register("valorContrapartida")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vigencia - Inicio" htmlFor="vigenciaInicio" error={form.formState.errors.vigenciaInicio?.message}>
                <Input id="vigenciaInicio" type="date" {...form.register("vigenciaInicio")} />
              </Field>
              <Field label="Vigencia - Fim" htmlFor="vigenciaFim" error={form.formState.errors.vigenciaFim?.message}>
                <Input id="vigenciaFim" type="date" {...form.register("vigenciaFim")} />
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
        title="Excluir convenio"
        description={`Deseja realmente excluir o convenio "${deleting?.numero}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
