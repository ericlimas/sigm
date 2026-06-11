import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import type { ContaBancaria, TipoConta } from "@/types/execucao";
import type { ImportacaoArquivo, MovimentoBancario, OrigemMovimentoBancario, TipoMovimentoBancario } from "@/types/financeiro";

const TODOS = "__todos__";

const TIPO_LABELS: Record<TipoMovimentoBancario, string> = {
  CREDITO: "Credito",
  DEBITO: "Debito",
};

const ORIGEM_LABELS: Record<OrigemMovimentoBancario, string> = {
  PAGAMENTO: "Pagamento",
  RECEITA: "Receita",
  TRANSFERENCIA: "Transferencia",
  AJUSTE: "Ajuste",
  MANUAL: "Manual",
  ARQUIVO: "Arquivo Importado",
};

const movimentoSchema = z.object({
  contaBancariaId: z.string().min(1, "Selecione a conta"),
  data: z.string().min(1, "Informe a data"),
  tipo: z.enum(["CREDITO", "DEBITO"]),
  historico: z.string().min(2, "Informe o historico"),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor positivo")),
  origem: z.enum(["TRANSFERENCIA", "AJUSTE", "MANUAL"]),
});

type MovimentoFormValues = z.infer<typeof movimentoSchema>;

const DEFAULT_VALUES: MovimentoFormValues = {
  contaBancariaId: "",
  data: toInputDate(new Date()),
  tipo: "CREDITO",
  historico: "",
  valor: 0,
  origem: "MANUAL",
};

export default function MovimentosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contaFiltro, setContaFiltro] = useState<string>(TODOS);
  const [tipoFiltro, setTipoFiltro] = useState<string>(TODOS);
  const [origemFiltro, setOrigemFiltro] = useState<string>(TODOS);
  const [conciliadoFiltro, setConciliadoFiltro] = useState<string>(TODOS);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<MovimentoBancario | null>(null);
  const [contaImportacao, setContaImportacao] = useState<string>("");

  const podeCriar = hasPermissao("TESOURARIA", "CRIAR");
  const podeExcluir = hasPermissao("TESOURARIA", "EXCLUIR");
  const podeConciliar = hasPermissao("TESOURARIA", "CONCILIAR");

  const contasQuery = useQuery({
    queryKey: ["tesouraria-contas"],
    queryFn: async () => (await api.get<ContaBancaria[]>("/tesouraria/contas")).data,
  });

  const listQuery = useQuery({
    queryKey: ["tesouraria-movimentos", contaFiltro, tipoFiltro, origemFiltro, conciliadoFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<MovimentoBancario>>("/tesouraria/movimentos", {
          params: {
            contaBancariaId: contaFiltro !== TODOS ? contaFiltro : undefined,
            tipo: tipoFiltro !== TODOS ? tipoFiltro : undefined,
            origem: origemFiltro !== TODOS ? origemFiltro : undefined,
            conciliado: conciliadoFiltro !== TODOS ? conciliadoFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const importacoesQuery = useQuery({
    queryKey: ["tesouraria-importacoes"],
    queryFn: async () => (await api.get<ImportacaoArquivo[]>("/tesouraria/importacoes")).data,
  });

  const form = useForm<MovimentoFormValues>({
    resolver: zodResolver(movimentoSchema) as Resolver<MovimentoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: MovimentoFormValues) => (await api.post("/tesouraria/movimentos", values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] });
      toast({ title: "Movimento lancado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao lancar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tesouraria/movimentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] });
      toast({ title: "Movimento excluido" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const conciliarMutation = useMutation({
    mutationFn: async ({ id, conciliar }: { id: string; conciliar: boolean }) =>
      api.post(`/tesouraria/movimentos/${id}/${conciliar ? "conciliar" : "desconciliar"}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-movimentos"] });
      toast({ title: "Conciliacao atualizada" });
    },
    onError: (error) => toast({ title: "Erro ao conciliar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const importarMutation = useMutation({
    mutationFn: async ({ contaBancariaId, nomeArquivo, conteudo }: { contaBancariaId: string; nomeArquivo: string; conteudo: string }) =>
      (await api.post("/tesouraria/importacoes", { contaBancariaId, nomeArquivo, conteudo })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-importacoes"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria-movimentos"] });
      toast({ title: "Arquivo importado com sucesso" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error) => toast({ title: "Erro ao importar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const conciliarAutoMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/tesouraria/importacoes/${id}/conciliar-automatico`)).data,
    onSuccess: (data: { totalImportados: number; conciliados: number }) => {
      queryClient.invalidateQueries({ queryKey: ["tesouraria-movimentos"] });
      toast({ title: "Conciliacao automatica concluida", description: `${data.conciliados} de ${data.totalImportados} lancamentos conciliados.` });
    },
    onError: (error) => toast({ title: "Erro ao conciliar", description: getErrorMessage(error), variant: "destructive" }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contaImportacao) {
      if (!contaImportacao) toast({ title: "Selecione a conta de destino antes de importar", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const conteudo = String(reader.result ?? "");
      importarMutation.mutate({ contaBancariaId: contaImportacao, nomeArquivo: file.name, conteudo });
    };
    reader.readAsText(file);
  }

  const columns: DataTableColumn<MovimentoBancario>[] = [
    { header: "Data", className: "w-24", cell: (m) => formatDate(m.data) },
    { header: "Conta", cell: (m) => m.contaBancaria?.descricao ?? "-" },
    { header: "Historico", cell: (m) => m.historico },
    {
      header: "Tipo",
      className: "w-24",
      cell: (m) => <Badge variant={m.tipo === "CREDITO" ? "success" : "destructive"}>{TIPO_LABELS[m.tipo]}</Badge>,
    },
    { header: "Origem", className: "w-32", cell: (m) => ORIGEM_LABELS[m.origem] },
    { header: "Valor", className: "w-32 text-right", cell: (m) => <span className="font-mono">{formatCurrency(m.valor)}</span> },
    {
      header: "Conciliado",
      className: "w-28",
      cell: (m) => <Badge variant={m.conciliado ? "success" : "secondary"}>{m.conciliado ? "Sim" : "Nao"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-28 text-right",
      cell: (m) => (
        <div className="flex justify-end gap-1">
          {podeConciliar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={m.conciliado ? "Desconciliar" : "Conciliar"}
              onClick={() => conciliarMutation.mutate({ id: m.id, conciliar: !m.conciliado })}
            >
              {m.conciliado ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          {podeExcluir && (m.origem === "MANUAL" || m.origem === "AJUSTE") && (
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
        title="Movimentacoes Bancarias"
        description="Lancamentos manuais, conciliacao bancaria e importacao de extratos OFX/CNAB"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Lancamento
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={contaFiltro} onValueChange={(v) => { setContaFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as contas</SelectItem>
            {contasQuery.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.descricao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={(v) => { setTipoFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-36">
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
        <Select value={origemFiltro} onValueChange={(v) => { setOrigemFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as origens</SelectItem>
            {Object.entries(ORIGEM_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={conciliadoFiltro} onValueChange={(v) => { setConciliadoFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Conciliacao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Conciliados e nao</SelectItem>
            <SelectItem value="true">Conciliados</SelectItem>
            <SelectItem value="false">Nao conciliados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(m) => m.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Importacao de Extratos (OFX/CNAB)</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Conta de Destino" htmlFor="contaImportacao" className="w-64">
            <Select value={contaImportacao} onValueChange={setContaImportacao}>
              <SelectTrigger id="contaImportacao">
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
          </Field>
          <div>
            <input ref={fileInputRef} type="file" accept=".ofx,.txt,.ret,.rem" className="hidden" onChange={handleFileChange} />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importarMutation.isPending}>
              <Upload className="mr-1.5 h-4 w-4" />
              Selecionar Arquivo
            </Button>
          </div>
        </div>

        <DataTable
          columns={[
            { header: "Arquivo", cell: (i: ImportacaoArquivo) => i.nomeArquivo },
            { header: "Conta", cell: (i: ImportacaoArquivo) => i.contaBancaria?.descricao ?? "-" },
            { header: "Tipo", className: "w-24", cell: (i: ImportacaoArquivo) => i.tipo },
            { header: "Registros", className: "w-24 text-right", cell: (i: ImportacaoArquivo) => i.totalRegistros },
            { header: "Conciliados", className: "w-28 text-right", cell: (i: ImportacaoArquivo) => i.totalConciliados },
            { header: "Data", className: "w-40", cell: (i: ImportacaoArquivo) => formatDate(i.createdAt) },
            {
              header: "Acoes",
              className: "w-44 text-right",
              cell: (i: ImportacaoArquivo) =>
                podeConciliar && (
                  <Button variant="outline" size="sm" onClick={() => conciliarAutoMutation.mutate(i.id)} disabled={conciliarAutoMutation.isPending}>
                    Conciliar Automatico
                  </Button>
                ),
            },
          ]}
          data={importacoesQuery.data ?? []}
          isLoading={importacoesQuery.isLoading}
          getRowId={(i) => i.id}
          emptyMessage="Nenhuma importacao realizada."
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lancamento Bancario</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <Field label="Conta Bancaria" htmlFor="contaBancariaId" error={form.formState.errors.contaBancariaId?.message}>
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

            <div className="grid grid-cols-3 gap-3">
              <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                <Input id="data" type="date" {...form.register("data")} />
              </Field>
              <Field label="Tipo" htmlFor="tipo">
                <Controller
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoMovimentoBancario)}>
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
              <Field label="Origem" htmlFor="origem">
                <Controller
                  control={form.control}
                  name="origem"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as "TRANSFERENCIA" | "AJUSTE" | "MANUAL")}>
                      <SelectTrigger id="origem">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANUAL">Manual</SelectItem>
                        <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                        <SelectItem value="AJUSTE">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field label="Historico" htmlFor="historico" error={form.formState.errors.historico?.message}>
              <Input id="historico" {...form.register("historico")} />
            </Field>

            <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
              <Input id="valor" type="number" step="0.01" min="0.01" {...form.register("valor")} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Lancar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir lancamento"
        description={`Deseja realmente excluir o lancamento "${deleting?.historico}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
