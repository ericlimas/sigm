import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Landmark,
  AlertTriangle,
  Handshake,
  ReceiptText,
  CircleDollarSign,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { nomeFuncao, MESES_ABREV } from "@/lib/funcoes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import KpiCard from "@/components/dashboard/KpiCard";
import type {
  DashboardResumo,
  LimitesLrf,
  IndicadorSecretaria,
  ReceitaDespesaMensal,
  DespesaPorFuncao,
} from "@/types/dashboard";

const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i);

export default function DashboardPage() {
  const { usuario, entidade } = useAuthStore();
  const [exercicio, setExercicio] = useState(ANO_ATUAL);

  const resumoQuery = useQuery({
    queryKey: ["dashboard", "resumo", exercicio],
    queryFn: async () => (await api.get<DashboardResumo>("/dashboard/resumo", { params: { exercicio } })).data,
  });

  const lrfQuery = useQuery({
    queryKey: ["dashboard", "limites-lrf", exercicio],
    queryFn: async () => (await api.get<LimitesLrf>("/dashboard/limites-lrf", { params: { exercicio } })).data,
    enabled: resumoQuery.isSuccess,
  });

  const secretariasQuery = useQuery({
    queryKey: ["dashboard", "indicadores-secretaria", exercicio],
    queryFn: async () =>
      (await api.get<IndicadorSecretaria[]>("/dashboard/indicadores-secretaria", { params: { exercicio } })).data,
    enabled: resumoQuery.isSuccess,
  });

  const mensalQuery = useQuery({
    queryKey: ["dashboard", "receita-despesa-mensal", exercicio],
    queryFn: async () =>
      (await api.get<ReceitaDespesaMensal[]>("/dashboard/graficos/receita-despesa-mensal", { params: { exercicio } }))
        .data,
    enabled: resumoQuery.isSuccess,
  });

  const funcaoQuery = useQuery({
    queryKey: ["dashboard", "despesa-por-funcao", exercicio],
    queryFn: async () =>
      (await api.get<DespesaPorFuncao[]>("/dashboard/graficos/despesa-por-funcao", { params: { exercicio } })).data,
    enabled: resumoQuery.isSuccess,
  });

  const resumo = resumoQuery.data;

  const mensalChartData =
    mensalQuery.data?.map((m) => ({
      mes: MESES_ABREV[m.mes],
      Receita: m.receitaArrecadada,
      Despesa: m.despesaEmpenhada,
    })) ?? [];

  const funcaoChartData =
    funcaoQuery.data?.map((f) => ({
      funcao: nomeFuncao(f.funcao),
      Empenhado: f.valorEmpenhado,
    })) ?? [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Dashboard Executivo</h1>
          <p className="text-xs text-muted-foreground">
            {usuario?.nome} - {entidade?.nome} ({entidade?.municipio}/{entidade?.uf})
          </p>
        </div>
        <Select value={String(exercicio)} onValueChange={(v) => setExercicio(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Exercicio" />
          </SelectTrigger>
          <SelectContent>
            {EXERCICIOS.map((ano) => (
              <SelectItem key={ano} value={String(ano)}>
                Exercicio {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {resumoQuery.isLoading && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Carregando indicadores...</CardContent>
        </Card>
      )}

      {resumoQuery.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Nao foi possivel carregar o dashboard
            </CardTitle>
            <CardDescription>{getErrorMessage(resumoQuery.error)}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              title="Receita Prevista"
              value={formatCurrency(resumo.receita.previsto)}
              subtitle={`Arrecadado: ${formatCurrency(resumo.receita.arrecadado)} (${formatNumber(resumo.receita.percentual, 1)}%)`}
              icon={TrendingUp}
              accent="success"
            />
            <KpiCard
              title="Despesa Fixada"
              value={formatCurrency(resumo.despesa.fixado)}
              subtitle={`Empenhado: ${formatNumber(resumo.despesa.percentualExecutado, 1)}%`}
              icon={TrendingDown}
              accent="primary"
            />
            <KpiCard
              title="Despesa Empenhada"
              value={formatCurrency(resumo.despesa.empenhado)}
              icon={ReceiptText}
              accent="primary"
            />
            <KpiCard
              title="Despesa Liquidada"
              value={formatCurrency(resumo.despesa.liquidado)}
              icon={ReceiptText}
              accent="primary"
            />
            <KpiCard
              title="Despesa Paga"
              value={formatCurrency(resumo.despesa.pago)}
              icon={CircleDollarSign}
              accent="primary"
            />
            <KpiCard
              title="Saldo Bancario"
              value={formatCurrency(resumo.saldoBancario)}
              icon={Landmark}
              accent="success"
            />
            <KpiCard
              title="Restos a Pagar"
              value={formatCurrency(resumo.restosAPagar.total)}
              subtitle={`${resumo.restosAPagar.quantidade} empenho(s)`}
              icon={Wallet}
              accent="warning"
            />
            <KpiCard
              title="Convenios em Execucao"
              value={String(resumo.convenios.emExecucao)}
              subtitle={`Total: ${formatCurrency(resumo.convenios.valorTotal)}`}
              icon={Handshake}
              accent="primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Receita x Despesa Mensal</CardTitle>
                <CardDescription>Arrecadacao de receitas e empenhos por mes ({exercicio})</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pl-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mensalChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatCurrency(v).replace("R$", "").trim()}
                      width={70}
                    />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Receita" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Despesa" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Despesa Empenhada por Funcao</CardTitle>
                <CardDescription>Distribuicao das dotacoes por funcao de governo ({exercicio})</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pl-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funcaoChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="funcao" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatCurrency(v).replace("R$", "").trim()}
                      width={70}
                    />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="Empenhado" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Limites Constitucionais e LRF</CardTitle>
                <CardDescription>Indicadores aproximados com base na execucao orcamentaria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {lrfQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {lrfQuery.data && (
                  <>
                    <LimiteRow
                      label="Despesa com Pessoal / RCL"
                      valor={lrfQuery.data.despesaComPessoal.valor}
                      percentual={lrfQuery.data.despesaComPessoal.percentualRcl}
                      limite={lrfQuery.data.despesaComPessoal.limiteLegal}
                      tipo="maximo"
                    />
                    <LimiteRow
                      label="Manutencao e Desenvolvimento do Ensino"
                      valor={lrfQuery.data.manutencaoEnsino.valor}
                      percentual={lrfQuery.data.manutencaoEnsino.percentualReceita}
                      limite={lrfQuery.data.manutencaoEnsino.limiteMinimoConstitucional}
                      tipo="minimo"
                    />
                    <LimiteRow
                      label="Acoes e Servicos Publicos de Saude"
                      valor={lrfQuery.data.acoesServicosSaude.valor}
                      percentual={lrfQuery.data.acoesServicosSaude.percentualReceita}
                      limite={lrfQuery.data.acoesServicosSaude.limiteMinimoConstitucional}
                      tipo="minimo"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Receita Corrente Liquida considerada: {formatCurrency(lrfQuery.data.receitaCorrenteLiquida)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Execucao Orcamentaria por Orgao</CardTitle>
                <CardDescription>Fixado, empenhado, liquidado e pago por orgao ({exercicio})</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table className="data-grid">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orgao</TableHead>
                      <TableHead className="text-right">Fixado</TableHead>
                      <TableHead className="text-right">Empenhado</TableHead>
                      <TableHead className="text-right">Liquidado</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">% Exec.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {secretariasQuery.data?.map((s) => (
                      <TableRow key={s.codigo}>
                        <TableCell>
                          <span className="font-medium">{s.codigo}</span> - {s.orgao}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(s.fixado)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.empenhado)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.liquidado)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.pago)}</TableCell>
                        <TableCell className="text-right">{formatNumber(s.percentualExecutado, 1)}%</TableCell>
                      </TableRow>
                    ))}
                    {secretariasQuery.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhuma dotacao encontrada para o exercicio.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

interface LimiteRowProps {
  label: string;
  valor: number;
  percentual: number;
  limite: number;
  tipo: "minimo" | "maximo";
}

function LimiteRow({ label, valor, percentual, limite, tipo }: LimiteRowProps) {
  const atendido = tipo === "minimo" ? percentual >= limite : percentual <= limite;
  const progresso = tipo === "minimo" ? Math.min((percentual / limite) * 100, 100) : Math.min(percentual, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className={atendido ? "text-success" : "text-destructive"}>
          {formatNumber(percentual, 2)}% ({tipo === "minimo" ? "min." : "max."} {formatNumber(limite, 0)}%)
        </span>
      </div>
      <Progress value={progresso} indicatorClassName={atendido ? "bg-success" : "bg-destructive"} />
      <p className="text-[11px] text-muted-foreground">{formatCurrency(valor)}</p>
    </div>
  );
}
