import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import SearchInput from "@/components/shared/SearchInput";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import type { LancamentoContabil, LancamentoContabilPartida, PeriodoContabil, TipoPartidaContabil } from "@/types/financeiro";
import type { ContaContabil } from "@/types/cadastros";

const TODOS = "__todos__";
const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];
const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const partidaSchema = z.object({
  contaContabilId: z.string().min(1, "Selecione a conta"),
  tipo: z.enum(["DEBITO", "CREDITO"]),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor positivo")),
  historico: z.string().optional(),
});

const lancamentoSchema = z.object({
  exercicio: z.preprocess((v) => Number(v), z.number().int()),
  data: z.string().min(1, "Informe a data"),
  historico: z.string().min(3, "Informe o historico"),
  partidas: z.array(partidaSchema).min(2, "Informe ao menos 2 partidas"),
});

type LancamentoFormValues = z.infer<typeof lancamentoSchema>;

const DEFAULT_VALUES: LancamentoFormValues = {
  exercicio: ANO_ATUAL,
  data: toInputDate(new Date()),
  historico: "",
  partidas: [
    { contaContabilId: "", tipo: "DEBITO", valor: 0, historico: "" },
    { contaContabilId: "", tipo: "CREDITO", valor: 0, historico: "" },
  ],
};

const estornoSchema = z.object({ justificativa: z.string().min(3, "Informe a justificativa (minimo 3 caracteres)") });
type EstornoFormValues = z.infer<typeof estornoSchema>;

// ---------------------------------------------------------------------------
// Relatorios - tipos de resposta
// ---------------------------------------------------------------------------

interface RelatorioDiario {
  documento: string;
  periodo: { exercicio: number; mes: number };
  lancamentos: LancamentoContabil[];
}

interface RazaoMovimento {
  data: string;
  numero: number;
  historico: string;
  tipo: TipoPartidaContabil;
  valor: number;
  saldo: number;
}

interface RelatorioRazao {
  documento: string;
  conta: { codigo: string; descricao: string; natureza: string };
  periodo: { exercicio: number; mes: number };
  saldoAnterior: number;
  movimentos: RazaoMovimento[];
  saldoAtual: number;
}

interface BalanceteItem {
  codigo: string;
  descricao: string;
  natureza: string;
  saldoAnterior: number;
  debitoPeriodo: number;
  creditoPeriodo: number;
  saldoAtual: number;
}

interface RelatorioBalancete {
  documento: string;
  periodo: { exercicio: number; mes: number };
  itens: BalanceteItem[];
  totais: { debitoPeriodo: number; creditoPeriodo: number };
}

interface ContaSaldo {
  codigo: string;
  descricao: string;
  saldo: number;
}

interface RelatorioBalancoPatrimonial {
  documento: string;
  periodo: { exercicio: number; mes: number };
  ativo: { contas: ContaSaldo[]; total: number };
  passivo: { contas: ContaSaldo[]; total: number };
  patrimonioLiquido: { contas: ContaSaldo[]; total: number };
  totalPassivoMaisPL: number;
}

interface ContaValor {
  codigo: string;
  descricao: string;
  valor: number;
}

interface RelatorioDvp {
  documento: string;
  periodo: { exercicio: number; mesReferencia: number };
  variacoesAumentativas: { contas: ContaValor[]; total: number };
  variacoesDiminutivas: { contas: ContaValor[]; total: number };
  resultadoPatrimonial: number;
}

interface RelatorioBalancoOrcamentario {
  documento: string;
  exercicio: number;
  receita: { previsto: number; arrecadado: number; saldo: number };
  despesa: { fixado: number; empenhado: number; liquidado: number; pago: number; saldoDotacao: number };
  resultadoExecucaoOrcamentaria: number;
}

interface FluxoCategoria {
  ingressos: number;
  desembolsos: number;
}

interface RelatorioDfc {
  documento: string;
  periodo: { exercicio: number; mes: number };
  fluxoOperacional: FluxoCategoria;
  fluxoInvestimento: FluxoCategoria;
  fluxoFinanciamento: FluxoCategoria;
  geracaoLiquidaCaixa: number;
}

const TIPOS_RELATORIO = [
  { value: "diario", label: "Livro Diario" },
  { value: "razao", label: "Livro Razao" },
  { value: "balancete", label: "Balancete de Verificacao" },
  { value: "balanco-patrimonial", label: "Balanco Patrimonial" },
  { value: "dvp", label: "Demonstrativo das Variacoes Patrimoniais" },
  { value: "balanco-orcamentario", label: "Balanco Orcamentario" },
  { value: "dfc", label: "Demonstrativo dos Fluxos de Caixa" },
];

export default function ContabilPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("CONTABIL", "CRIAR");
  const podeEstornar = hasPermissao("CONTABIL", "ESTORNAR");
  const podeEncerrar = hasPermissao("CONTABIL", "ENCERRAR");

  const contasContabeisQuery = useQuery({
    queryKey: ["plano-contas-lancamento"],
    queryFn: async () => (await api.get<{ data: ContaContabil[] }>("/plano-contas", { params: { aceitaLancamento: true } })).data.data,
  });

  return (
    <div className="space-y-3 p-4">
      <PageHeader title="Contabilidade" description="Lancamentos contabeis (PCASP), encerramento de periodos e relatorios contabeis e orcamentarios" />

      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lancamentos</TabsTrigger>
          <TabsTrigger value="periodos">Periodos</TabsTrigger>
          <TabsTrigger value="relatorios">Relatorios</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-3">
          <LancamentosTab
            contasContabeis={contasContabeisQuery.data ?? []}
            podeCriar={podeCriar}
            podeEstornar={podeEstornar}
          />
        </TabsContent>

        <TabsContent value="periodos" className="space-y-3">
          <PeriodosTab podeEncerrar={podeEncerrar} />
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-3">
          <RelatoriosTab contasContabeis={contasContabeisQuery.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );

  function PeriodosTab({ podeEncerrar }: { podeEncerrar: boolean }) {
    const [exercicio, setExercicio] = useState<number>(ANO_ATUAL);

    const periodosQuery = useQuery({
      queryKey: ["contabil-periodos", exercicio],
      queryFn: async () => (await api.get<PeriodoContabil[]>("/contabil/periodos", { params: { exercicio } })).data,
    });

    const encerrarMutation = useMutation({
      mutationFn: async (mes: number) => (await api.post("/contabil/periodos/encerrar", { exercicio, mes })).data,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["contabil-periodos"] });
        toast({ title: "Periodo encerrado" });
      },
      onError: (error) => toast({ title: "Erro ao encerrar periodo", description: getErrorMessage(error), variant: "destructive" }),
    });

    const reabrirMutation = useMutation({
      mutationFn: async (mes: number) => (await api.post("/contabil/periodos/reabrir", { exercicio, mes })).data,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["contabil-periodos"] });
        toast({ title: "Periodo reaberto" });
      },
      onError: (error) => toast({ title: "Erro ao reabrir periodo", description: getErrorMessage(error), variant: "destructive" }),
    });

    return (
      <div className="space-y-3">
        <Select value={String(exercicio)} onValueChange={(v) => setExercicio(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Exercicio" />
          </SelectTrigger>
          <SelectContent>
            {EXERCICIOS.map((ano) => (
              <SelectItem key={ano} value={String(ano)}>
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(periodosQuery.data ?? []).map((periodo) => (
            <Card key={periodo.mes} className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{MESES[periodo.mes - 1]}</span>
                <Badge variant={periodo.status === "ENCERRADO" ? "secondary" : "success"}>
                  {periodo.status === "ENCERRADO" ? "Encerrado" : "Aberto"}
                </Badge>
              </div>
              {periodo.dataEncerramento && (
                <p className="text-xs text-muted-foreground">Encerrado em {formatDate(periodo.dataEncerramento)}</p>
              )}
              {podeEncerrar && (
                <div className="flex justify-end">
                  {periodo.status === "ENCERRADO" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reabrirMutation.mutate(periodo.mes)}
                      disabled={reabrirMutation.isPending}
                    >
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                      Reabrir
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => encerrarMutation.mutate(periodo.mes)}
                      disabled={encerrarMutation.isPending}
                    >
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      Encerrar
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  function RelatoriosTab({ contasContabeis }: { contasContabeis: ContaContabil[] }) {
    const [tipoRelatorio, setTipoRelatorio] = useState("diario");
    const [exercicio, setExercicio] = useState(String(ANO_ATUAL));
    const [mes, setMes] = useState(String(new Date().getMonth() + 1));
    const [contaContabilId, setContaContabilId] = useState("");

    const diarioQuery = useQuery({
      queryKey: ["contabil-relatorio-diario", exercicio, mes],
      queryFn: async () => (await api.get<RelatorioDiario>("/contabil/relatorios/diario", { params: { exercicio, mes } })).data,
      enabled: false,
    });

    const razaoQuery = useQuery({
      queryKey: ["contabil-relatorio-razao", exercicio, mes, contaContabilId],
      queryFn: async () =>
        (await api.get<RelatorioRazao>("/contabil/relatorios/razao", { params: { exercicio, mes, contaContabilId } })).data,
      enabled: false,
    });

    const balanceteQuery = useQuery({
      queryKey: ["contabil-relatorio-balancete", exercicio, mes],
      queryFn: async () => (await api.get<RelatorioBalancete>("/contabil/relatorios/balancete", { params: { exercicio, mes } })).data,
      enabled: false,
    });

    const balancoPatrimonialQuery = useQuery({
      queryKey: ["contabil-relatorio-balanco-patrimonial", exercicio, mes],
      queryFn: async () =>
        (await api.get<RelatorioBalancoPatrimonial>("/contabil/relatorios/balanco-patrimonial", { params: { exercicio, mes } })).data,
      enabled: false,
    });

    const dvpQuery = useQuery({
      queryKey: ["contabil-relatorio-dvp", exercicio, mes],
      queryFn: async () => (await api.get<RelatorioDvp>("/contabil/relatorios/dvp", { params: { exercicio, mes } })).data,
      enabled: false,
    });

    const balancoOrcamentarioQuery = useQuery({
      queryKey: ["contabil-relatorio-balanco-orcamentario", exercicio],
      queryFn: async () =>
        (await api.get<RelatorioBalancoOrcamentario>("/contabil/relatorios/balanco-orcamentario", { params: { exercicio } })).data,
      enabled: false,
    });

    const dfcQuery = useQuery({
      queryKey: ["contabil-relatorio-dfc", exercicio, mes],
      queryFn: async () => (await api.get<RelatorioDfc>("/contabil/relatorios/dfc", { params: { exercicio, mes } })).data,
      enabled: false,
    });

    function gerar() {
      if (tipoRelatorio === "diario") diarioQuery.refetch();
      else if (tipoRelatorio === "razao") {
        if (!contaContabilId) {
          toast({ title: "Selecione a conta contabil", variant: "destructive" });
          return;
        }
        razaoQuery.refetch();
      } else if (tipoRelatorio === "balancete") balanceteQuery.refetch();
      else if (tipoRelatorio === "balanco-patrimonial") balancoPatrimonialQuery.refetch();
      else if (tipoRelatorio === "dvp") dvpQuery.refetch();
      else if (tipoRelatorio === "balanco-orcamentario") balancoOrcamentarioQuery.refetch();
      else if (tipoRelatorio === "dfc") dfcQuery.refetch();
    }

    return (
      <div className="space-y-3">
        <Card className="space-y-3 p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Relatorio" htmlFor="tipoRelatorio" className="w-72">
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger id="tipoRelatorio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_RELATORIO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Exercicio" htmlFor="relExercicio" className="w-32">
              <Select value={exercicio} onValueChange={setExercicio}>
                <SelectTrigger id="relExercicio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXERCICIOS.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {tipoRelatorio !== "balanco-orcamentario" && (
              <Field label="Mes" htmlFor="relMes" className="w-44">
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger id="relMes">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((nome, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {tipoRelatorio === "razao" && (
              <Field label="Conta Contabil" htmlFor="relConta" className="w-72">
                <Select value={contaContabilId} onValueChange={setContaContabilId}>
                  <SelectTrigger id="relConta">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasContabeis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Button onClick={gerar}>Gerar</Button>
            <Button variant="outline" onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        </Card>

        {tipoRelatorio === "diario" && diarioQuery.data && (
          <Card className="space-y-3 p-4">
            <h3 className="text-center font-semibold">{diarioQuery.data.documento}</h3>
            {diarioQuery.data.lancamentos.map((l) => (
              <div key={l.id} className="space-y-1 rounded-md border p-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>
                    Lancamento {l.numero}/{l.exercicio} - {formatDate(l.data)}
                  </span>
                  <span>{l.historico}</span>
                </div>
                <DataTable
                  columns={
                    [
                      { header: "Conta", cell: (p: LancamentoContabilPartida) => `${p.contaContabil?.codigo ?? ""} - ${p.contaContabil?.descricao ?? ""}` },
                      { header: "Tipo", className: "w-24", cell: (p: LancamentoContabilPartida) => (p.tipo === "DEBITO" ? "Debito" : "Credito") },
                      { header: "Valor", className: "w-32 text-right", cell: (p: LancamentoContabilPartida) => <span className="font-mono">{formatCurrency(p.valor)}</span> },
                    ] as DataTableColumn<LancamentoContabilPartida>[]
                  }
                  data={l.partidas}
                  getRowId={(p) => p.id}
                />
              </div>
            ))}
            {diarioQuery.data.lancamentos.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lancamento no periodo.</p>
            )}
          </Card>
        )}

        {tipoRelatorio === "razao" && razaoQuery.data && (
          <Card className="space-y-3 p-4">
            <h3 className="text-center font-semibold">{razaoQuery.data.documento}</h3>
            <p className="text-center text-sm text-muted-foreground">
              {razaoQuery.data.conta.codigo} - {razaoQuery.data.conta.descricao}
            </p>
            <p className="text-sm">Saldo Anterior: <span className="font-mono font-medium">{formatCurrency(razaoQuery.data.saldoAnterior)}</span></p>
            <DataTable
              columns={
                [
                  { header: "Data", className: "w-28", cell: (m: RazaoMovimento) => formatDate(m.data) },
                  { header: "Numero", className: "w-20", cell: (m: RazaoMovimento) => m.numero },
                  { header: "Historico", cell: (m: RazaoMovimento) => m.historico },
                  { header: "Tipo", className: "w-24", cell: (m: RazaoMovimento) => (m.tipo === "DEBITO" ? "Debito" : "Credito") },
                  { header: "Valor", className: "w-32 text-right", cell: (m: RazaoMovimento) => <span className="font-mono">{formatCurrency(m.valor)}</span> },
                  { header: "Saldo", className: "w-32 text-right", cell: (m: RazaoMovimento) => <span className="font-mono">{formatCurrency(m.saldo)}</span> },
                ] as DataTableColumn<RazaoMovimento>[]
              }
              data={razaoQuery.data.movimentos}
              getRowId={(m) => `${m.numero}-${m.data}-${m.valor}`}
            />
            <p className="text-right text-sm font-semibold">Saldo Atual: {formatCurrency(razaoQuery.data.saldoAtual)}</p>
          </Card>
        )}

        {tipoRelatorio === "balancete" && balanceteQuery.data && (
          <Card className="space-y-3 p-4">
            <h3 className="text-center font-semibold">{balanceteQuery.data.documento}</h3>
            <DataTable
              columns={
                [
                  { header: "Codigo", className: "w-28", cell: (i: BalanceteItem) => i.codigo },
                  { header: "Descricao", cell: (i: BalanceteItem) => i.descricao },
                  { header: "Saldo Anterior", className: "w-32 text-right", cell: (i: BalanceteItem) => <span className="font-mono">{formatCurrency(i.saldoAnterior)}</span> },
                  { header: "Debito", className: "w-32 text-right", cell: (i: BalanceteItem) => <span className="font-mono">{formatCurrency(i.debitoPeriodo)}</span> },
                  { header: "Credito", className: "w-32 text-right", cell: (i: BalanceteItem) => <span className="font-mono">{formatCurrency(i.creditoPeriodo)}</span> },
                  { header: "Saldo Atual", className: "w-32 text-right", cell: (i: BalanceteItem) => <span className="font-mono">{formatCurrency(i.saldoAtual)}</span> },
                ] as DataTableColumn<BalanceteItem>[]
              }
              data={balanceteQuery.data.itens}
              getRowId={(i) => i.codigo}
            />
            <div className="flex justify-end gap-6 text-sm font-semibold">
              <span>Total Debito: {formatCurrency(balanceteQuery.data.totais.debitoPeriodo)}</span>
              <span>Total Credito: {formatCurrency(balanceteQuery.data.totais.creditoPeriodo)}</span>
            </div>
          </Card>
        )}

        {tipoRelatorio === "balanco-patrimonial" && balancoPatrimonialQuery.data && (
          <Card className="space-y-4 p-4">
            <h3 className="text-center font-semibold">{balancoPatrimonialQuery.data.documento}</h3>
            <BalancoGrupo titulo="Ativo" grupo={balancoPatrimonialQuery.data.ativo} />
            <BalancoGrupo titulo="Passivo" grupo={balancoPatrimonialQuery.data.passivo} />
            <BalancoGrupo titulo="Patrimonio Liquido" grupo={balancoPatrimonialQuery.data.patrimonioLiquido} />
            <p className="text-right text-sm font-semibold">
              Total Passivo + Patrimonio Liquido: {formatCurrency(balancoPatrimonialQuery.data.totalPassivoMaisPL)}
            </p>
          </Card>
        )}

        {tipoRelatorio === "dvp" && dvpQuery.data && (
          <Card className="space-y-4 p-4">
            <h3 className="text-center font-semibold">{dvpQuery.data.documento}</h3>
            <DvpGrupo titulo="Variacoes Patrimoniais Aumentativas" grupo={dvpQuery.data.variacoesAumentativas} />
            <DvpGrupo titulo="Variacoes Patrimoniais Diminutivas" grupo={dvpQuery.data.variacoesDiminutivas} />
            <p className="text-right text-sm font-semibold">Resultado Patrimonial: {formatCurrency(dvpQuery.data.resultadoPatrimonial)}</p>
          </Card>
        )}

        {tipoRelatorio === "balanco-orcamentario" && balancoOrcamentarioQuery.data && (
          <Card className="space-y-4 p-4">
            <h3 className="text-center font-semibold">{balancoOrcamentarioQuery.data.documento}</h3>
            <div>
              <h4 className="mb-1 text-sm font-semibold">Receita</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Previsto</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.receita.previsto)}</p></div>
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Arrecadado</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.receita.arrecadado)}</p></div>
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Saldo</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.receita.saldo)}</p></div>
              </div>
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold">Despesa</h4>
              <div className="grid grid-cols-5 gap-3 text-sm">
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Fixado</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.despesa.fixado)}</p></div>
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Empenhado</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.despesa.empenhado)}</p></div>
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Liquidado</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.despesa.liquidado)}</p></div>
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Pago</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.despesa.pago)}</p></div>
                <div className="rounded-md border p-2"><p className="text-muted-foreground">Saldo Dotacao</p><p className="font-mono font-medium">{formatCurrency(balancoOrcamentarioQuery.data.despesa.saldoDotacao)}</p></div>
              </div>
            </div>
            <p className="text-right text-sm font-semibold">
              Resultado da Execucao Orcamentaria: {formatCurrency(balancoOrcamentarioQuery.data.resultadoExecucaoOrcamentaria)}
            </p>
          </Card>
        )}

        {tipoRelatorio === "dfc" && dfcQuery.data && (
          <Card className="space-y-4 p-4">
            <h3 className="text-center font-semibold">{dfcQuery.data.documento}</h3>
            <FluxoCategoriaCard titulo="Fluxo Operacional" categoria={dfcQuery.data.fluxoOperacional} />
            <FluxoCategoriaCard titulo="Fluxo de Investimento" categoria={dfcQuery.data.fluxoInvestimento} />
            <FluxoCategoriaCard titulo="Fluxo de Financiamento" categoria={dfcQuery.data.fluxoFinanciamento} />
            <p className="text-right text-sm font-semibold">Geracao Liquida de Caixa: {formatCurrency(dfcQuery.data.geracaoLiquidaCaixa)}</p>
          </Card>
        )}
      </div>
    );
  }

  function BalancoGrupo({ titulo, grupo }: { titulo: string; grupo: { contas: ContaSaldo[]; total: number } }) {
    return (
      <div>
        <h4 className="mb-1 text-sm font-semibold">{titulo}</h4>
        <DataTable
          columns={
            [
              { header: "Codigo", className: "w-28", cell: (c: ContaSaldo) => c.codigo },
              { header: "Descricao", cell: (c: ContaSaldo) => c.descricao },
              { header: "Saldo", className: "w-32 text-right", cell: (c: ContaSaldo) => <span className="font-mono">{formatCurrency(c.saldo)}</span> },
            ] as DataTableColumn<ContaSaldo>[]
          }
          data={grupo.contas}
          getRowId={(c) => c.codigo}
          emptyMessage="Sem saldos."
        />
        <p className="mt-1 text-right text-sm font-semibold">Total {titulo}: {formatCurrency(grupo.total)}</p>
      </div>
    );
  }

  function DvpGrupo({ titulo, grupo }: { titulo: string; grupo: { contas: ContaValor[]; total: number } }) {
    return (
      <div>
        <h4 className="mb-1 text-sm font-semibold">{titulo}</h4>
        <DataTable
          columns={
            [
              { header: "Codigo", className: "w-28", cell: (c: ContaValor) => c.codigo },
              { header: "Descricao", cell: (c: ContaValor) => c.descricao },
              { header: "Valor", className: "w-32 text-right", cell: (c: ContaValor) => <span className="font-mono">{formatCurrency(c.valor)}</span> },
            ] as DataTableColumn<ContaValor>[]
          }
          data={grupo.contas}
          getRowId={(c) => c.codigo}
          emptyMessage="Sem valores."
        />
        <p className="mt-1 text-right text-sm font-semibold">Total: {formatCurrency(grupo.total)}</p>
      </div>
    );
  }

  function FluxoCategoriaCard({ titulo, categoria }: { titulo: string; categoria: FluxoCategoria }) {
    return (
      <div>
        <h4 className="mb-1 text-sm font-semibold">{titulo}</h4>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border p-2"><p className="text-muted-foreground">Ingressos</p><p className="font-mono font-medium text-green-700">{formatCurrency(categoria.ingressos)}</p></div>
          <div className="rounded-md border p-2"><p className="text-muted-foreground">Desembolsos</p><p className="font-mono font-medium text-red-700">{formatCurrency(categoria.desembolsos)}</p></div>
          <div className="rounded-md border p-2"><p className="text-muted-foreground">Liquido</p><p className="font-mono font-medium">{formatCurrency(categoria.ingressos - categoria.desembolsos)}</p></div>
        </div>
      </div>
    );
  }

  function LancamentosTab({
    contasContabeis,
    podeCriar,
    podeEstornar,
  }: {
    contasContabeis: ContaContabil[];
    podeCriar: boolean;
    podeEstornar: boolean;
  }) {
    const [exercicio, setExercicio] = useState<string>(TODOS);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [detalhe, setDetalhe] = useState<LancamentoContabil | null>(null);
    const [estornando, setEstornando] = useState<LancamentoContabil | null>(null);

    const listQuery = useQuery({
      queryKey: ["contabil-lancamentos", exercicio, search, page],
      queryFn: async () =>
        (
          await api.get<PaginatedResponse<LancamentoContabil>>("/contabil/lancamentos", {
            params: {
              exercicio: exercicio !== TODOS ? exercicio : undefined,
              q: search || undefined,
              page,
              pageSize: 20,
            },
          })
        ).data,
    });

    const form = useForm<LancamentoFormValues>({
      resolver: zodResolver(lancamentoSchema) as Resolver<LancamentoFormValues>,
      defaultValues: DEFAULT_VALUES,
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "partidas" });
    const partidas = form.watch("partidas");
    const totalDebito = partidas.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const totalCredito = partidas.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const balanceado = Math.abs(totalDebito - totalCredito) < 0.01;

    const estornoForm = useForm<EstornoFormValues>({
      resolver: zodResolver(estornoSchema) as Resolver<EstornoFormValues>,
      defaultValues: { justificativa: "" },
    });

    function openCreate() {
      form.reset(DEFAULT_VALUES);
      setDialogOpen(true);
    }

    const saveMutation = useMutation({
      mutationFn: async (values: LancamentoFormValues) => (await api.post("/contabil/lancamentos", values)).data,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["contabil-lancamentos"] });
        toast({ title: "Lancamento contabil registrado" });
        setDialogOpen(false);
      },
      onError: (error) => toast({ title: "Erro ao registrar lancamento", description: getErrorMessage(error), variant: "destructive" }),
    });

    const estornarMutation = useMutation({
      mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) =>
        (await api.post(`/contabil/lancamentos/${id}/estornar`, { justificativa })).data,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["contabil-lancamentos"] });
        toast({ title: "Lancamento estornado" });
        setEstornando(null);
        setDetalhe(null);
      },
      onError: (error) => toast({ title: "Erro ao estornar", description: getErrorMessage(error), variant: "destructive" }),
    });

    function onSubmit(values: LancamentoFormValues) {
      const debito = values.partidas.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + p.valor, 0);
      const credito = values.partidas.filter((p) => p.tipo === "CREDITO").reduce((acc, p) => acc + p.valor, 0);
      if (Math.abs(debito - credito) > 0.01) {
        toast({ title: "Lancamento nao balanceado", description: "O somatorio dos debitos deve ser igual ao dos creditos.", variant: "destructive" });
        return;
      }
      saveMutation.mutate(values);
    }

    const columns: DataTableColumn<LancamentoContabil>[] = [
      { header: "Numero", className: "w-24", cell: (l) => `${l.numero}/${l.exercicio}` },
      { header: "Data", className: "w-28", cell: (l) => formatDate(l.data) },
      { header: "Historico", cell: (l) => l.historico },
      { header: "Origem", className: "w-32", cell: (l) => l.origemModulo ?? (l.tipo === "MANUAL" ? "Manual" : "Automatico") },
      {
        header: "Valor",
        className: "w-32 text-right",
        cell: (l) => (
          <span className="font-mono">{formatCurrency(l.partidas.filter((p) => p.tipo === "DEBITO").reduce((acc, p) => acc + Number(p.valor), 0))}</span>
        ),
      },
    ];

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={exercicio} onValueChange={(v) => { setExercicio(v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Exercicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {EXERCICIOS.map((ano) => (
                  <SelectItem key={ano} value={String(ano)}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por historico..." />
          </div>
          {podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Lancamento
            </Button>
          )}
        </div>

        <Card className="overflow-auto">
          <DataTable
            columns={columns}
            data={listQuery.data?.data ?? []}
            isLoading={listQuery.isLoading}
            getRowId={(l) => l.id}
            onRowClick={(l) => setDetalhe(l)}
          />
          {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Novo Lancamento Contabil</DialogTitle>
            </DialogHeader>
            <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Exercicio" htmlFor="exercicio">
                  <Controller
                    control={form.control}
                    name="exercicio"
                    render={({ field }) => (
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger id="exercicio">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXERCICIOS.map((ano) => (
                            <SelectItem key={ano} value={String(ano)}>
                              {ano}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                  <Input id="data" type="date" {...form.register("data")} />
                </Field>
                <Field label="Historico" htmlFor="historico" className="col-span-1" error={form.formState.errors.historico?.message}>
                  <Input id="historico" {...form.register("historico")} />
                </Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Partidas (Debito / Credito)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ contaContabilId: "", tipo: "DEBITO", valor: 0, historico: "" })}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar Partida
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 items-start gap-2 rounded-md border p-2">
                    <div className="col-span-5">
                      <Controller
                        control={form.control}
                        name={`partidas.${index}.contaContabilId`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Conta contabil" />
                            </SelectTrigger>
                            <SelectContent>
                              {contasContabeis.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.codigo} - {c.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.partidas?.[index]?.contaContabilId && (
                        <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.partidas[index]?.contaContabilId?.message}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Controller
                        control={form.control}
                        name={`partidas.${index}.tipo`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={(v) => f.onChange(v as TipoPartidaContabil)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DEBITO">Debito</SelectItem>
                              <SelectItem value="CREDITO">Credito</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" step="0.01" min="0.01" placeholder="Valor" {...form.register(`partidas.${index}.valor`)} />
                    </div>
                    <div className="col-span-2">
                      <Input placeholder="Historico (opcional)" {...form.register(`partidas.${index}.historico`)} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {form.formState.errors.partidas?.message && (
                  <p className="text-[11px] text-destructive">{form.formState.errors.partidas.message}</p>
                )}

                <div className={`flex justify-end gap-6 rounded-md border p-2 text-sm font-medium ${balanceado ? "" : "border-destructive text-destructive"}`}>
                  <span>Total Debito: {formatCurrency(totalDebito)}</span>
                  <span>Total Credito: {formatCurrency(totalCredito)}</span>
                  <span>{balanceado ? "Balanceado" : "Diferenca: " + formatCurrency(Math.abs(totalDebito - totalCredito))}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending || !balanceado}>
                  Registrar Lancamento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Lancamento {detalhe?.numero}/{detalhe?.exercicio}
              </DialogTitle>
            </DialogHeader>
            {detalhe && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-muted-foreground">Data</p><p>{formatDate(detalhe.data)}</p></div>
                  <div className="col-span-2"><p className="text-muted-foreground">Historico</p><p>{detalhe.historico}</p></div>
                </div>
                <DataTable
                  columns={
                    [
                      { header: "Conta", cell: (p: LancamentoContabilPartida) => `${p.contaContabil?.codigo ?? ""} - ${p.contaContabil?.descricao ?? ""}` },
                      { header: "Tipo", className: "w-24", cell: (p: LancamentoContabilPartida) => (p.tipo === "DEBITO" ? "Debito" : "Credito") },
                      { header: "Historico", cell: (p: LancamentoContabilPartida) => p.historico ?? "-" },
                      { header: "Valor", className: "w-32 text-right", cell: (p: LancamentoContabilPartida) => <span className="font-mono">{formatCurrency(p.valor)}</span> },
                    ] as DataTableColumn<LancamentoContabilPartida>[]
                  }
                  data={detalhe.partidas}
                  getRowId={(p) => p.id}
                />
                {podeEstornar && detalhe.origemModulo !== "ESTORNO" && (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => { estornoForm.reset({ justificativa: "" }); setEstornando(detalhe); }}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Estornar Lancamento
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!estornando} onOpenChange={(open) => !open && setEstornando(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Estornar Lancamento</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={estornoForm.handleSubmit((values) => estornando && estornarMutation.mutate({ id: estornando.id, justificativa: values.justificativa }))}
            >
              <Field label="Justificativa" htmlFor="justificativa" error={estornoForm.formState.errors.justificativa?.message}>
                <Textarea id="justificativa" rows={3} {...estornoForm.register("justificativa")} />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEstornando(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={estornarMutation.isPending}>
                  Confirmar Estorno
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}
