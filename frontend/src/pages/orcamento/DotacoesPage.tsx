import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FonteRecurso, Orgao, UnidadeOrcamentaria } from "@/types/cadastros";
import type { Dotacao, Loa, Ppa, PpaAcao, PpaPrograma } from "@/types/orcamento";

const NONE = "__none__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const dotacaoSchema = z.object({
  loaId: z.string().min(1, "Selecione a LOA"),
  exercicio: z.preprocess((v) => Number(v), z.number().int()),
  ficha: z.preprocess((v) => Number(v), z.number().int().min(1, "Informe a ficha")),
  orgaoId: z.string().min(1, "Selecione o orgao"),
  unidadeOrcamentariaId: z.string().min(1, "Selecione a unidade"),
  funcao: z.string().min(1, "Informe a funcao"),
  subfuncao: z.string().min(1, "Informe a subfuncao"),
  programaId: z.string().optional(),
  acaoId: z.string().optional(),
  categoriaEconomica: z.string().min(1, "Informe a categoria economica"),
  grupoDespesa: z.string().min(1, "Informe o grupo de despesa"),
  modalidadeAplicacao: z.string().min(1, "Informe a modalidade de aplicacao"),
  elementoDespesa: z.string().min(1, "Informe o elemento de despesa"),
  fonteRecursoId: z.string().min(1, "Selecione a fonte de recurso"),
  valorInicial: z.preprocess((v) => Number(v), z.number().min(0)),
});
type DotacaoFormValues = z.infer<typeof dotacaoSchema>;

const DEFAULT_VALUES: DotacaoFormValues = {
  loaId: "",
  exercicio: ANO_ATUAL,
  ficha: 1,
  orgaoId: "",
  unidadeOrcamentariaId: "",
  funcao: "",
  subfuncao: "",
  programaId: undefined,
  acaoId: undefined,
  categoriaEconomica: "",
  grupoDespesa: "",
  modalidadeAplicacao: "",
  elementoDespesa: "",
  fonteRecursoId: "",
  valorInicial: 0,
};

export default function DotacoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [exercicio, setExercicio] = useState<string>(String(ANO_ATUAL));
  const [orgaoFiltro, setOrgaoFiltro] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dotacao | null>(null);
  const [deleting, setDeleting] = useState<Dotacao | null>(null);

  const podeCriar = hasPermissao("ORCAMENTO", "CRIAR");
  const podeEditar = hasPermissao("ORCAMENTO", "EDITAR");
  const podeExcluir = hasPermissao("ORCAMENTO", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["dotacoes", exercicio, orgaoFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Dotacao>>("/orcamento/dotacoes", {
          params: {
            exercicio: exercicio || undefined,
            orgaoId: orgaoFiltro !== "ALL" ? orgaoFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const orgaosQuery = useQuery({
    queryKey: ["orgaos", "all"],
    queryFn: async () => (await api.get<{ data: Orgao[] }>("/orgaos")).data.data,
  });

  const fontesQuery = useQuery({
    queryKey: ["fontes-recurso", "all"],
    queryFn: async () => (await api.get<{ data: FonteRecurso[] }>("/fontes-recurso")).data.data,
  });

  const loasQuery = useQuery({
    queryKey: ["loas"],
    queryFn: async () => (await api.get<{ data: Loa[] }>("/orcamento/loa")).data.data,
  });

  const ppasQuery = useQuery({
    queryKey: ["ppas"],
    queryFn: async () => (await api.get<{ data: Ppa[] }>("/orcamento/ppa")).data.data,
    enabled: dialogOpen,
  });

  const programas: PpaPrograma[] = (ppasQuery.data ?? []).flatMap((p) => p.programas ?? []);

  const form = useForm<DotacaoFormValues>({
    resolver: zodResolver(dotacaoSchema) as Resolver<DotacaoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  const orgaoSelecionado = form.watch("orgaoId");
  const programaSelecionado = form.watch("programaId");

  const unidadesQuery = useQuery({
    queryKey: ["unidades-orcamentarias", orgaoSelecionado],
    queryFn: async () =>
      (
        await api.get<{ data: UnidadeOrcamentaria[] }>("/orgaos/unidades/listar", {
          params: { orgaoId: orgaoSelecionado },
        })
      ).data.data,
    enabled: !!orgaoSelecionado && dialogOpen,
  });

  const acoesDisponiveis: PpaAcao[] = programas.find((p) => p.id === programaSelecionado)?.acoes ?? [];

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(dotacao: Dotacao) {
    setEditing(dotacao);
    form.reset({
      loaId: dotacao.loaId,
      exercicio: dotacao.exercicio,
      ficha: dotacao.ficha,
      orgaoId: dotacao.orgaoId,
      unidadeOrcamentariaId: dotacao.unidadeOrcamentariaId,
      funcao: dotacao.funcao,
      subfuncao: dotacao.subfuncao,
      programaId: dotacao.programaId ?? undefined,
      acaoId: dotacao.acaoId ?? undefined,
      categoriaEconomica: dotacao.categoriaEconomica,
      grupoDespesa: dotacao.grupoDespesa,
      modalidadeAplicacao: dotacao.modalidadeAplicacao,
      elementoDespesa: dotacao.elementoDespesa,
      fonteRecursoId: dotacao.fonteRecursoId,
      valorInicial: dotacao.valorInicial,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: DotacaoFormValues) => {
      const payload = { ...values, programaId: values.programaId || null, acaoId: values.acaoId || null };
      if (editing) return (await api.put(`/orcamento/dotacoes/${editing.id}`, payload)).data;
      return (await api.post("/orcamento/dotacoes", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dotacoes"] });
      toast({ title: editing ? "Dotacao atualizada" : "Dotacao criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/orcamento/dotacoes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dotacoes"] });
      toast({ title: "Dotacao excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Dotacao>[] = [
    { header: "Ficha", cell: (d) => <span className="font-medium">{d.ficha}</span>, className: "w-16" },
    { header: "Orgao", cell: (d) => d.orgao?.nome ?? "-" },
    { header: "Unidade", cell: (d) => d.unidadeOrcamentaria?.nome ?? "-" },
    { header: "Funcao/Subfuncao", cell: (d) => `${d.funcao}/${d.subfuncao}`, className: "w-32" },
    { header: "Elemento Despesa", cell: (d) => d.elementoDespesa, className: "w-32" },
    { header: "Fonte", cell: (d) => d.fonteRecurso?.codigo ?? "-", className: "w-20" },
    { header: "Valor Atualizado", cell: (d) => formatCurrency(d.valorAtualizado), className: "w-36 text-right" },
    {
      header: "Saldo Disponivel",
      className: "w-36 text-right",
      cell: (d) => (
        <span className={d.saldoDisponivel < 0 ? "font-medium text-destructive" : "font-medium text-emerald-600"}>
          {formatCurrency(d.saldoDisponivel)}
        </span>
      ),
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
    <div className="space-y-3 p-4">
      <PageHeader
        title="Dotacoes Orcamentarias"
        description="Fichas de dotacao orcamentaria por orgao, unidade, funcao, programa e fonte de recurso"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Dotacao
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
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
        <Select value={orgaoFiltro} onValueChange={(v) => { setOrgaoFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Orgao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os orgaos</SelectItem>
            {(orgaosQuery.data ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(d) => d.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Dotacao Orcamentaria" : "Nova Dotacao Orcamentaria"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="LOA" htmlFor="loaId" error={form.formState.errors.loaId?.message}>
                <Controller
                  control={form.control}
                  name="loaId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => {
                        field.onChange(v === NONE ? "" : v);
                        const loa = (loasQuery.data ?? []).find((l) => l.id === v);
                        if (loa) form.setValue("exercicio", loa.exercicio);
                      }}
                    >
                      <SelectTrigger id="loaId">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} disabled>Selecione</SelectItem>
                        {(loasQuery.data ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.id}>LOA {l.exercicio}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Exercicio" htmlFor="exercicioForm" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicioForm" type="number" {...form.register("exercicio")} />
              </Field>
              <Field label="Ficha" htmlFor="ficha" error={form.formState.errors.ficha?.message}>
                <Input id="ficha" type="number" min={1} {...form.register("ficha")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Orgao" htmlFor="orgaoId" error={form.formState.errors.orgaoId?.message}>
                <Controller
                  control={form.control}
                  name="orgaoId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => {
                        field.onChange(v === NONE ? "" : v);
                        form.setValue("unidadeOrcamentariaId", "");
                      }}
                    >
                      <SelectTrigger id="orgaoId">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} disabled>Selecione</SelectItem>
                        {(orgaosQuery.data ?? []).map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Unidade Orcamentaria" htmlFor="unidadeOrcamentariaId" error={form.formState.errors.unidadeOrcamentariaId?.message}>
                <Controller
                  control={form.control}
                  name="unidadeOrcamentariaId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger id="unidadeOrcamentariaId">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} disabled>Selecione</SelectItem>
                        {(unidadesQuery.data ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.codigo} - {u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Funcao" htmlFor="funcao" error={form.formState.errors.funcao?.message}>
                <Input id="funcao" placeholder="Ex: 04" {...form.register("funcao")} />
              </Field>
              <Field label="Subfuncao" htmlFor="subfuncao" error={form.formState.errors.subfuncao?.message}>
                <Input id="subfuncao" placeholder="Ex: 122" {...form.register("subfuncao")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Programa (PPA)" htmlFor="programaId">
                <Controller
                  control={form.control}
                  name="programaId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => {
                        field.onChange(v === NONE ? undefined : v);
                        form.setValue("acaoId", undefined);
                      }}
                    >
                      <SelectTrigger id="programaId">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhum</SelectItem>
                        {programas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Acao (PPA)" htmlFor="acaoId">
                <Controller
                  control={form.control}
                  name="acaoId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                      <SelectTrigger id="acaoId">
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                        {acoesDisponiveis.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.codigo} - {a.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Categoria Economica" htmlFor="categoriaEconomica" error={form.formState.errors.categoriaEconomica?.message}>
                <Input id="categoriaEconomica" placeholder="Ex: 3" {...form.register("categoriaEconomica")} />
              </Field>
              <Field label="Grupo de Despesa" htmlFor="grupoDespesa" error={form.formState.errors.grupoDespesa?.message}>
                <Input id="grupoDespesa" placeholder="Ex: 3.3" {...form.register("grupoDespesa")} />
              </Field>
              <Field label="Modalidade Aplicacao" htmlFor="modalidadeAplicacao" error={form.formState.errors.modalidadeAplicacao?.message}>
                <Input id="modalidadeAplicacao" placeholder="Ex: 90" {...form.register("modalidadeAplicacao")} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Elemento de Despesa" htmlFor="elementoDespesa" error={form.formState.errors.elementoDespesa?.message}>
                <Input id="elementoDespesa" placeholder="Ex: 3.3.90.30" {...form.register("elementoDespesa")} />
              </Field>
              <Field label="Fonte de Recurso" htmlFor="fonteRecursoId" error={form.formState.errors.fonteRecursoId?.message}>
                <Controller
                  control={form.control}
                  name="fonteRecursoId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger id="fonteRecursoId">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} disabled>Selecione</SelectItem>
                        {(fontesQuery.data ?? []).map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.codigo} - {f.descricao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Valor Inicial" htmlFor="valorInicial" error={form.formState.errors.valorInicial?.message}>
                <Input id="valorInicial" type="number" step="0.01" min={0} disabled={!!editing} {...form.register("valorInicial")} />
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
        title="Excluir dotacao"
        description={`Deseja realmente excluir a dotacao ficha ${deleting?.ficha}? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
