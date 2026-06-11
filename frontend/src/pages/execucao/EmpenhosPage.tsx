import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Printer, RotateCcw, TrendingUp, Ban } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateExtenso, formatValorAsterisco, nomeEstado } from "@/lib/utils";
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
import type { Credor } from "@/types/cadastros";
import type { Dotacao } from "@/types/orcamento";
import type { Empenho, TipoEmpenho, TipoMovimentoEmpenho } from "@/types/execucao";

const NONE = "__none__";
const TODOS = "__todos__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const TIPO_LABELS: Record<TipoEmpenho, string> = {
  ORDINARIO: "Ordinario",
  GLOBAL: "Global",
  ESTIMATIVO: "Estimativo",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  NORMAL: "success",
  ANULADO: "warning",
  ESTORNADO: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  ANULADO: "Anulado",
  ESTORNADO: "Estornado",
};

const MOVIMENTO_LABELS: Record<TipoMovimentoEmpenho, string> = {
  REFORCO: "Reforco",
  ANULACAO: "Anulacao",
  ESTORNO: "Estorno",
};

const LARGURA_DOC = 81;

interface EmpenhoImprimirData {
  numero: string;
  exercicio: number;
  tipo: TipoEmpenho;
  data: string;
  entidade: { nome: string; municipio: string; uf: string };
  credor: {
    nome: string;
    cpfCnpj: string;
    inscricaoEstadual: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    municipio: string | null;
    uf: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
  };
  dotacao: {
    ficha: number;
    orgao: string;
    unidade: string;
    funcao: string;
    subfuncao: string;
    programa?: string | null;
    acao?: string | null;
    elementoDespesa: string;
    fonteRecurso: string;
  };
  historico: string;
  valor: number;
  valorAnulado: number;
  valorLiquido: number;
  valorExtenso: string;
  descontos: number;
  usuarioLogado: string;
}

function centralizar(texto: string, largura = LARGURA_DOC): string {
  if (texto.length >= largura) return texto;
  const espacos = largura - texto.length;
  return " ".repeat(Math.floor(espacos / 2)) + texto;
}

function campo(label: string, valor: string, largura = 17): string {
  const rotulo = label.length >= largura ? label : label.padEnd(largura, ".");
  return `${rotulo}: ${valor}`;
}

function buildOrdemPagamentoTexto(d: EmpenhoImprimirData): string {
  const linhaSep = "-".repeat(LARGURA_DOC);
  const endereco = [d.credor.logradouro, d.credor.numero ? `Nº ${d.credor.numero}` : null, d.credor.complemento]
    .filter(Boolean)
    .join(", ");

  const linhas: string[] = [];
  linhas.push(centralizar(d.entidade.nome.toUpperCase()));
  linhas.push(centralizar(`ESTADO DE ${nomeEstado(d.entidade.uf).toUpperCase()}`));
  linhas.push(centralizar(`ORDEM DE PAGAMENTO Nº ${d.numero}`));
  linhas.push(centralizar(`EMPENHO ${TIPO_LABELS[d.tipo].toUpperCase()} - DESPESA ORCAMENTARIA`));
  linhas.push(` Exercício de: ${d.exercicio}    Data: ${formatDate(d.data)}    Ficha: ${String(d.dotacao.ficha).padStart(6, "0")}`);
  linhas.push(linhaSep);
  linhas.push(campo("Órgão", d.dotacao.orgao));
  linhas.push(campo("Unidade", d.dotacao.unidade));
  linhas.push(campo("Função/Subfunção", `${d.dotacao.funcao} / ${d.dotacao.subfuncao}`));
  if (d.dotacao.programa || d.dotacao.acao) {
    linhas.push(campo("Programa/Ação", `${d.dotacao.programa ?? "-"} / ${d.dotacao.acao ?? "-"}`));
  }
  linhas.push(campo("Elemento Despesa", d.dotacao.elementoDespesa));
  linhas.push(campo("Fonte de Recurso", d.dotacao.fonteRecurso));
  linhas.push("");
  linhas.push(" Fica o Serviço de Finanças autorizado a pagar a importância de");
  linhas.push(`R$ ${formatValorAsterisco(d.valorLiquido)} ,${d.valorExtenso}.`);
  linhas.push("ao Credor abaixo mencionado.");
  linhas.push(`Credor...: ${d.credor.nome}`);
  if (endereco) linhas.push(`Endereço.: ${endereco}    Bairro: ${d.credor.bairro ?? "-"}    CEP: ${d.credor.cep ?? "-"}`);
  linhas.push(`Cidade...: ${d.credor.municipio ?? "-"}    Est: ${d.credor.uf ?? "-"}`);
  linhas.push(`Insc. Est: ${d.credor.inscricaoEstadual ?? "-"}    CGC/CPF: ${d.credor.cpfCnpj}`);
  if (d.credor.banco) linhas.push(`Banco ...: ${d.credor.banco}    Agência..: ${d.credor.agencia ?? "-"}    Conta ..: ${d.credor.conta ?? "-"}`);
  linhas.push(`Hist.: ${d.historico}`);
  linhas.push(`VALOR DA ORDEM DE PAGAMENTO: ${formatValorAsterisco(d.valor)}`);
  linhas.push(`DESCONTOS .................: ${formatValorAsterisco(d.descontos)}`);
  linhas.push(`VALOR LÍQUIDO .............: ${formatValorAsterisco(d.valorLiquido)}`);
  linhas.push("");
  linhas.push(" Contador(a)/Contabilista: _______________________________");
  linhas.push("");
  linhas.push(`Pague-se ${d.entidade.nome}, ${formatDateExtenso(d.data)}.`);
  linhas.push(" Ordenador da Despesa: ____________________________________________");
  linhas.push(linhaSep);
  linhas.push(centralizar("Q U I T A Ç Ã O"));
  linhas.push(`Recebi(emos) do(a) ${d.entidade.nome}, a importância de`);
  linhas.push(`R$ ${formatValorAsterisco(d.valorLiquido)} ,${d.valorExtenso}`);
  linhas.push("referente a Ordem de Pagamento acima mencionada, da qual é dada plena quitação.");
  linhas.push("___/___/_____   __________________   ______________________________________");
  linhas.push("    Data         Identidade/CPF/CGC      Assinatura do Credor ou seu Procurador");
  linhas.push(linhaSep);
  linhas.push(`BANCO: ${d.credor.banco ?? "-"}    CONTA: ${d.credor.conta ?? "-"}    CHEQUE:`);
  linhas.push(linhaSep);
  linhas.push("Data: ___/___/____    Tesoureiro: ____________________________________________");
  linhas.push(`Usuário: ${d.usuarioLogado}`);

  return linhas.join("\n");
}

const empenhoSchema = z.object({
  exercicio: z.preprocess((v) => Number(v), z.number().int()),
  tipo: z.enum(["ORDINARIO", "GLOBAL", "ESTIMATIVO"]),
  data: z.string().min(1, "Informe a data"),
  credorId: z.string().min(1, "Selecione o credor"),
  dotacaoId: z.string().min(1, "Selecione a dotacao"),
  processo: z.string().optional(),
  historico: z.string().min(3, "Informe o historico"),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor maior que zero")),
});
type EmpenhoFormValues = z.infer<typeof empenhoSchema>;

const DEFAULT_VALUES: EmpenhoFormValues = {
  exercicio: ANO_ATUAL,
  tipo: "ORDINARIO",
  data: new Date().toISOString().substring(0, 10),
  credorId: "",
  dotacaoId: "",
  processo: "",
  historico: "",
  valor: 0,
};

const movimentoSchema = z.object({
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor maior que zero")),
  justificativa: z.string().min(3, "Informe a justificativa"),
});
type MovimentoFormValues = z.infer<typeof movimentoSchema>;

const estornoSchema = z.object({
  justificativa: z.string().min(3, "Informe a justificativa"),
});
type EstornoFormValues = z.infer<typeof estornoSchema>;

export default function EmpenhosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("EMPENHOS", "CRIAR");
  const podeReforcar = hasPermissao("EMPENHOS", "REFORCAR");
  const podeAnular = hasPermissao("EMPENHOS", "ANULAR");
  const podeEstornar = hasPermissao("EMPENHOS", "ESTORNAR");

  const [exercicio, setExercicio] = useState<string>(String(ANO_ATUAL));
  const [status, setStatus] = useState<string>(TODOS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [movimentoTipo, setMovimentoTipo] = useState<TipoMovimentoEmpenho | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["empenhos", exercicio, status, search, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Empenho>>("/empenhos", {
          params: {
            exercicio: exercicio || undefined,
            status: status === TODOS ? undefined : status,
            q: search || undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const detailQuery = useQuery({
    queryKey: ["empenho", detailId],
    queryFn: async () => (await api.get<Empenho>(`/empenhos/${detailId}`)).data,
    enabled: !!detailId,
  });

  const printQuery = useQuery({
    queryKey: ["empenho-imprimir", detailId],
    queryFn: async () => (await api.get(`/empenhos/${detailId}/imprimir`)).data,
    enabled: !!detailId && printOpen,
  });

  const credoresQuery = useQuery({
    queryKey: ["credores", "select"],
    queryFn: async () =>
      (await api.get<PaginatedResponse<Credor>>("/credores", { params: { ativo: true, pageSize: 200 } })).data.data,
    enabled: dialogOpen,
  });

  const form = useForm<EmpenhoFormValues>({
    resolver: zodResolver(empenhoSchema) as Resolver<EmpenhoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  const exercicioForm = form.watch("exercicio");

  const dotacoesQuery = useQuery({
    queryKey: ["dotacoes", "select", exercicioForm],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Dotacao>>("/orcamento/dotacoes", {
          params: { exercicio: exercicioForm, pageSize: 200 },
        })
      ).data.data,
    enabled: dialogOpen,
  });

  function openCreate() {
    form.reset({ ...DEFAULT_VALUES, exercicio: Number(exercicio) || ANO_ATUAL });
    setDialogOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async (values: EmpenhoFormValues) => {
      const payload = { ...values, processo: values.processo || null };
      return (await api.post("/empenhos", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empenhos"] });
      queryClient.invalidateQueries({ queryKey: ["dotacoes"] });
      toast({ title: "Empenho registrado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const movForm = useForm<MovimentoFormValues>({
    resolver: zodResolver(movimentoSchema) as Resolver<MovimentoFormValues>,
    defaultValues: { valor: 0, justificativa: "" },
  });

  const estornoForm = useForm<EstornoFormValues>({
    resolver: zodResolver(estornoSchema) as Resolver<EstornoFormValues>,
    defaultValues: { justificativa: "" },
  });

  function openMovimento(tipo: TipoMovimentoEmpenho) {
    movForm.reset({ valor: 0, justificativa: "" });
    estornoForm.reset({ justificativa: "" });
    setMovimentoTipo(tipo);
  }

  const movimentoMutation = useMutation({
    mutationFn: async (values: { valor?: number; justificativa: string }) => {
      const acao = movimentoTipo === "REFORCO" ? "reforco" : movimentoTipo === "ANULACAO" ? "anulacao" : "estorno";
      return (await api.post(`/empenhos/${detailId}/${acao}`, values)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empenhos"] });
      queryClient.invalidateQueries({ queryKey: ["empenho", detailId] });
      queryClient.invalidateQueries({ queryKey: ["dotacoes"] });
      toast({ title: "Movimento registrado" });
      setMovimentoTipo(null);
    },
    onError: (error) => toast({ title: "Erro ao registrar movimento", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Empenho>[] = [
    { header: "Nº/Exercicio", cell: (e) => <span className="font-medium">{e.numero}/{e.exercicio}</span>, className: "w-28" },
    { header: "Data", cell: (e) => formatDate(e.data), className: "w-28" },
    { header: "Credor", cell: (e) => e.credor?.nome ?? "-" },
    {
      header: "Dotacao",
      cell: (e) => (e.dotacao ? `Ficha ${e.dotacao.ficha} - ${e.dotacao.elementoDespesa}` : "-"),
    },
    { header: "Tipo", cell: (e) => <Badge variant="outline">{TIPO_LABELS[e.tipo]}</Badge>, className: "w-28" },
    { header: "Valor", cell: (e) => formatCurrency(e.valor), className: "w-32 text-right" },
    { header: "Saldo Nao Liquidado", cell: (e) => formatCurrency(e.saldoNaoLiquidado), className: "w-36 text-right" },
    {
      header: "Status",
      className: "w-28",
      cell: (e) => <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABELS[e.status]}</Badge>,
    },
  ];

  const empenho = detailQuery.data;
  const podeMovimentar = empenho?.status === "NORMAL";

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Empenhos"
        description="Emissao de notas de empenho e controle de reforco, anulacao e estorno"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Empenho
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
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por historico, processo ou credor..." className="w-72" />
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(e) => e.id} onRowClick={(e) => setDetailId(e.id)} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      {/* Dialog: novo empenho */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Empenho</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Exercicio" htmlFor="exercicio" error={form.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...form.register("exercicio")} />
              </Field>
              <Field label="Tipo" htmlFor="tipo">
                <Controller
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoEmpenho)}>
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
              <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                <Input id="data" type="date" {...form.register("data")} />
              </Field>
            </div>

            <Field label="Credor" htmlFor="credorId" error={form.formState.errors.credorId?.message}>
              <Controller
                control={form.control}
                name="credorId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="credorId">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} disabled>Selecione</SelectItem>
                      {(credoresQuery.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} - {c.cpfCnpj}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Dotacao" htmlFor="dotacaoId" error={form.formState.errors.dotacaoId?.message}>
              <Controller
                control={form.control}
                name="dotacaoId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="dotacaoId">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} disabled>Selecione</SelectItem>
                      {(dotacoesQuery.data ?? []).map((d) => (
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
              <Field label="Processo" htmlFor="processo">
                <Input id="processo" {...form.register("processo")} />
              </Field>
              <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
                <Input id="valor" type="number" step="0.01" min={0} {...form.register("valor")} />
              </Field>
            </div>

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

      {/* Dialog: detalhe do empenho */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Nota de Empenho {empenho ? `${empenho.numero}/${empenho.exercicio}` : ""}
            </DialogTitle>
          </DialogHeader>

          {empenho && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Credor: </span>{empenho.credor?.nome}</div>
                <div><span className="text-muted-foreground">Data: </span>{formatDate(empenho.data)}</div>
                <div><span className="text-muted-foreground">Dotacao: </span>Ficha {empenho.dotacao?.ficha} - {empenho.dotacao?.elementoDespesa}</div>
                <div><span className="text-muted-foreground">Processo: </span>{empenho.processo ?? "-"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Historico: </span>{empenho.historico}</div>
              </div>

              <div className="grid grid-cols-4 gap-3 rounded-md border p-2 text-center text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Valor</div>
                  <div className="font-semibold">{formatCurrency(empenho.valor)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Anulado</div>
                  <div className="font-semibold">{formatCurrency(empenho.valorAnulado)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Liquidado</div>
                  <div className="font-semibold">{formatCurrency(empenho.valorLiquidado)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Pago</div>
                  <div className="font-semibold">{formatCurrency(empenho.valorPago)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {podeReforcar && podeMovimentar && (
                  <Button size="sm" variant="outline" onClick={() => openMovimento("REFORCO")}>
                    <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                    Reforco
                  </Button>
                )}
                {podeAnular && podeMovimentar && (
                  <Button size="sm" variant="outline" onClick={() => openMovimento("ANULACAO")}>
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Anulacao
                  </Button>
                )}
                {podeEstornar && podeMovimentar && Number(empenho.valorLiquidado) === 0 && (
                  <Button size="sm" variant="outline" onClick={() => openMovimento("ESTORNO")}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Estorno
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Imprimir
                </Button>
              </div>

              {!!empenho.movimentos?.length && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Movimentos</p>
                  <DataTable
                    columns={[
                      { header: "Tipo", cell: (m) => MOVIMENTO_LABELS[m.tipo], className: "w-28" },
                      { header: "Data", cell: (m) => formatDate(m.data), className: "w-28" },
                      { header: "Valor", cell: (m) => formatCurrency(m.valor), className: "w-32 text-right" },
                      { header: "Justificativa", cell: (m) => m.justificativa },
                    ]}
                    data={empenho.movimentos}
                    getRowId={(m) => m.id}
                  />
                </div>
              )}

              {!!empenho.liquidacoes?.length && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Liquidacoes</p>
                  <DataTable
                    columns={[
                      { header: "Numero", cell: (l) => l.numero, className: "w-20" },
                      { header: "Data", cell: (l) => formatDate(l.data), className: "w-28" },
                      { header: "Documento", cell: (l) => l.documento ?? "-" },
                      { header: "Valor", cell: (l) => formatCurrency(l.valor), className: "w-32 text-right" },
                      { header: "Status", cell: (l) => l.status, className: "w-28" },
                    ]}
                    data={empenho.liquidacoes}
                    getRowId={(l) => l.id}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: movimento (reforco/anulacao/estorno) */}
      <Dialog open={!!movimentoTipo} onOpenChange={(open) => !open && setMovimentoTipo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{movimentoTipo ? MOVIMENTO_LABELS[movimentoTipo] : ""}</DialogTitle>
          </DialogHeader>
          {movimentoTipo === "ESTORNO" ? (
            <form className="space-y-3" onSubmit={estornoForm.handleSubmit((values) => movimentoMutation.mutate(values))}>
              <Field label="Justificativa" htmlFor="justificativaEstorno" error={estornoForm.formState.errors.justificativa?.message}>
                <Textarea id="justificativaEstorno" rows={3} {...estornoForm.register("justificativa")} />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMovimentoTipo(null)}>Cancelar</Button>
                <Button type="submit" variant="destructive" disabled={movimentoMutation.isPending}>Confirmar Estorno</Button>
              </DialogFooter>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={movForm.handleSubmit((values) => movimentoMutation.mutate(values))}>
              <Field label="Valor" htmlFor="valorMov" error={movForm.formState.errors.valor?.message}>
                <Input id="valorMov" type="number" step="0.01" min={0} {...movForm.register("valor")} />
              </Field>
              <Field label="Justificativa" htmlFor="justificativaMov" error={movForm.formState.errors.justificativa?.message}>
                <Textarea id="justificativaMov" rows={3} {...movForm.register("justificativa")} />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMovimentoTipo(null)}>Cancelar</Button>
                <Button type="submit" disabled={movimentoMutation.isPending}>Confirmar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: impressao */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-3xl print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Ordem de Pagamento</DialogTitle>
          </DialogHeader>
          {printQuery.data && (
            <pre className="overflow-x-auto whitespace-pre rounded-md border bg-white p-4 font-mono text-[11px] leading-[1.5] text-black print:border-none print:p-0">
              {buildOrdemPagamentoTexto(printQuery.data as EmpenhoImprimirData)}
            </pre>
          )}
          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setPrintOpen(false)}>Fechar</Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
