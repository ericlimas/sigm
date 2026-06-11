import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import type { ContaBancaria } from "@/types/execucao";
import type { MovimentoBancario } from "@/types/financeiro";

interface BoletimDiario {
  documento: string;
  contaBancaria: string;
  data: string;
  saldoAnterior: number;
  totalCreditos: number;
  totalDebitos: number;
  saldoAtual: number;
  movimentos: MovimentoBancario[];
}

interface FluxoDia {
  data: string;
  creditos: number;
  debitos: number;
}

interface FluxoCaixa {
  periodo: { dataInicio: string; dataFim: string };
  fluxo: FluxoDia[];
}

interface DisponibilidadeItem {
  contaBancariaId: string;
  descricao: string;
  tipo: string;
  fonteRecurso: string | null;
  saldoAtual: number;
}

interface Disponibilidade {
  disponibilidade: DisponibilidadeItem[];
  totalGeral: number;
}

export default function RelatoriosTesourariaPage() {
  const hasPermissao = useAuthStore((s) => s.hasPermissao);
  const podeVisualizar = hasPermissao("TESOURARIA", "VISUALIZAR");

  const contasQuery = useQuery({
    queryKey: ["tesouraria-contas"],
    queryFn: async () => (await api.get<ContaBancaria[]>("/tesouraria/contas")).data,
  });

  // Boletim diario
  const [contaBoletim, setContaBoletim] = useState("");
  const [dataBoletim, setDataBoletim] = useState(toInputDate(new Date()));
  const boletimQuery = useQuery({
    queryKey: ["tesouraria-boletim", contaBoletim, dataBoletim],
    queryFn: async () =>
      (
        await api.get<BoletimDiario>("/tesouraria/relatorios/boletim-diario", {
          params: { contaBancariaId: contaBoletim, data: dataBoletim },
        })
      ).data,
    enabled: false,
  });

  // Fluxo de caixa
  const [contaFluxo, setContaFluxo] = useState<string>("");
  const hoje = toInputDate(new Date());
  const [dataInicioFluxo, setDataInicioFluxo] = useState(hoje);
  const [dataFimFluxo, setDataFimFluxo] = useState(hoje);
  const fluxoQuery = useQuery({
    queryKey: ["tesouraria-fluxo", contaFluxo, dataInicioFluxo, dataFimFluxo],
    queryFn: async () =>
      (
        await api.get<FluxoCaixa>("/tesouraria/relatorios/fluxo", {
          params: { contaBancariaId: contaFluxo || undefined, dataInicio: dataInicioFluxo, dataFim: dataFimFluxo },
        })
      ).data,
    enabled: false,
  });

  // Disponibilidade
  const disponibilidadeQuery = useQuery({
    queryKey: ["tesouraria-disponibilidade"],
    queryFn: async () => (await api.get<Disponibilidade>("/tesouraria/relatorios/disponibilidade")).data,
    enabled: podeVisualizar,
  });

  return (
    <div className="space-y-3 p-4">
      <PageHeader title="Relatorios de Tesouraria" description="Boletim diario de caixa, fluxo de caixa e disponibilidade financeira" />

      <Tabs defaultValue="boletim">
        <TabsList>
          <TabsTrigger value="boletim">Boletim Diario</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
        </TabsList>

        <TabsContent value="boletim" className="space-y-3">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Conta Bancaria" htmlFor="contaBoletim" className="w-64">
                <Select value={contaBoletim} onValueChange={setContaBoletim}>
                  <SelectTrigger id="contaBoletim">
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
              <Field label="Data" htmlFor="dataBoletim" className="w-44">
                <Input id="dataBoletim" type="date" value={dataBoletim} onChange={(e) => setDataBoletim(e.target.value)} />
              </Field>
              <Button disabled={!contaBoletim} onClick={() => boletimQuery.refetch()}>
                Gerar
              </Button>
            </div>

            {boletimQuery.data && (
              <div className="space-y-3 print:p-4" id="boletim-resultado">
                <div className="text-center">
                  <h3 className="font-semibold">{boletimQuery.data.documento}</h3>
                  <p className="text-sm text-muted-foreground">
                    {boletimQuery.data.contaBancaria} - {formatDate(boletimQuery.data.data)}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Saldo Anterior</p>
                    <p className="font-mono font-medium">{formatCurrency(boletimQuery.data.saldoAnterior)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Total Creditos</p>
                    <p className="font-mono font-medium text-green-700">{formatCurrency(boletimQuery.data.totalCreditos)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Total Debitos</p>
                    <p className="font-mono font-medium text-red-700">{formatCurrency(boletimQuery.data.totalDebitos)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Saldo Atual</p>
                    <p className="font-mono font-medium">{formatCurrency(boletimQuery.data.saldoAtual)}</p>
                  </div>
                </div>
                <DataTable
                  columns={
                    [
                      { header: "Historico", cell: (m: MovimentoBancario) => m.historico },
                      { header: "Tipo", className: "w-24", cell: (m: MovimentoBancario) => (m.tipo === "CREDITO" ? "Credito" : "Debito") },
                      { header: "Valor", className: "w-32 text-right", cell: (m: MovimentoBancario) => <span className="font-mono">{formatCurrency(m.valor)}</span> },
                    ] as DataTableColumn<MovimentoBancario>[]
                  }
                  data={boletimQuery.data.movimentos}
                  getRowId={(m) => m.id}
                  emptyMessage="Nenhuma movimentacao no dia."
                />
                <div className="flex justify-end print:hidden">
                  <Button variant="outline" onClick={() => window.print()}>
                    Imprimir
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="fluxo" className="space-y-3">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Conta Bancaria (opcional)" htmlFor="contaFluxo" className="w-64">
                <Select value={contaFluxo || "__todas__"} onValueChange={(v) => setContaFluxo(v === "__todas__" ? "" : v)}>
                  <SelectTrigger id="contaFluxo">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todas__">Todas as contas</SelectItem>
                    {contasQuery.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data Inicio" htmlFor="dataInicioFluxo" className="w-44">
                <Input id="dataInicioFluxo" type="date" value={dataInicioFluxo} onChange={(e) => setDataInicioFluxo(e.target.value)} />
              </Field>
              <Field label="Data Fim" htmlFor="dataFimFluxo" className="w-44">
                <Input id="dataFimFluxo" type="date" value={dataFimFluxo} onChange={(e) => setDataFimFluxo(e.target.value)} />
              </Field>
              <Button onClick={() => fluxoQuery.refetch()}>Gerar</Button>
            </div>

            {fluxoQuery.data && (
              <DataTable
                columns={
                  [
                    { header: "Data", className: "w-32", cell: (f: FluxoDia) => formatDate(f.data) },
                    { header: "Creditos", className: "w-36 text-right", cell: (f: FluxoDia) => <span className="font-mono text-green-700">{formatCurrency(f.creditos)}</span> },
                    { header: "Debitos", className: "w-36 text-right", cell: (f: FluxoDia) => <span className="font-mono text-red-700">{formatCurrency(f.debitos)}</span> },
                    { header: "Saldo do Dia", className: "w-36 text-right", cell: (f: FluxoDia) => <span className="font-mono font-medium">{formatCurrency(f.creditos - f.debitos)}</span> },
                  ] as DataTableColumn<FluxoDia>[]
                }
                data={fluxoQuery.data.fluxo}
                getRowId={(f) => f.data}
                emptyMessage="Nenhuma movimentacao no periodo."
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="disponibilidade" className="space-y-3">
          <Card className="overflow-auto">
            <DataTable
              columns={
                [
                  { header: "Conta", cell: (d: DisponibilidadeItem) => d.descricao },
                  { header: "Tipo", className: "w-32", cell: (d: DisponibilidadeItem) => d.tipo },
                  { header: "Fonte de Recurso", cell: (d: DisponibilidadeItem) => d.fonteRecurso ?? "-" },
                  { header: "Saldo Atual", className: "w-40 text-right", cell: (d: DisponibilidadeItem) => <span className="font-mono font-medium">{formatCurrency(d.saldoAtual)}</span> },
                ] as DataTableColumn<DisponibilidadeItem>[]
              }
              data={disponibilidadeQuery.data?.disponibilidade ?? []}
              isLoading={disponibilidadeQuery.isLoading}
              getRowId={(d) => d.contaBancariaId}
            />
            {disponibilidadeQuery.data && (
              <div className="flex justify-end border-t p-2 text-sm font-semibold">
                Total Geral: {formatCurrency(disponibilidadeQuery.data.totalGeral)}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
