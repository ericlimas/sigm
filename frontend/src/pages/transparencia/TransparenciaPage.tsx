import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCpfCnpj, formatDate } from "@/lib/utils";
import type {
  ModalidadeLicitacao,
  StatusContrato,
  StatusLicitacao,
  TransparenciaContrato,
  TransparenciaDespesa,
  TransparenciaLicitacao,
  TransparenciaReceita,
} from "@/types/scaffold";

const ANO_ATUAL = new Date().getFullYear();
const EXERCICIOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

interface EntidadePublica {
  id: string;
  tipo: string;
  nome: string;
  cnpj: string;
  municipio: string;
  uf: string;
  brasao: string | null;
}

const STATUS_LICITACAO_LABELS: Record<StatusLicitacao, string> = {
  EM_ANDAMENTO: "Em Andamento",
  HOMOLOGADA: "Homologada",
  FRACASSADA: "Fracassada",
  DESERTA: "Deserta",
  REVOGADA: "Revogada",
  ANULADA: "Anulada",
};

const MODALIDADE_LABELS: Record<ModalidadeLicitacao, string> = {
  DISPENSA: "Dispensa",
  INEXIGIBILIDADE: "Inexigibilidade",
  PREGAO: "Pregao",
  CONCORRENCIA: "Concorrencia",
  CREDENCIAMENTO: "Credenciamento",
  CONCURSO: "Concurso",
  LEILAO: "Leilao",
};

const STATUS_CONTRATO_LABELS: Record<StatusContrato, string> = {
  VIGENTE: "Vigente",
  ENCERRADO: "Encerrado",
  RESCINDIDO: "Rescindido",
  SUSPENSO: "Suspenso",
};

export default function TransparenciaPage() {
  const entidadeLogada = useAuthStore((s) => s.entidade);
  const [exercicio, setExercicio] = useState(String(ANO_ATUAL));
  const [pageReceitas, setPageReceitas] = useState(1);
  const [pageDespesas, setPageDespesas] = useState(1);
  const [pageLicitacoes, setPageLicitacoes] = useState(1);
  const [pageContratos, setPageContratos] = useState(1);

  const entidadesQuery = useQuery({
    queryKey: ["transparencia-entidades"],
    queryFn: async () => (await api.get<EntidadePublica[]>("/transparencia/entidades")).data,
  });

  const entidade = entidadesQuery.data?.find((e) => e.id === entidadeLogada?.id);
  const cnpj = entidade?.cnpj;

  const receitasQuery = useQuery({
    queryKey: ["transparencia-receitas", cnpj, exercicio, pageReceitas],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<TransparenciaReceita>>(`/transparencia/${cnpj}/receitas`, {
          params: { exercicio, page: pageReceitas, pageSize: 20 },
        })
      ).data,
    enabled: !!cnpj,
  });

  const despesasQuery = useQuery({
    queryKey: ["transparencia-despesas", cnpj, exercicio, pageDespesas],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<TransparenciaDespesa>>(`/transparencia/${cnpj}/despesas`, {
          params: { exercicio, page: pageDespesas, pageSize: 20 },
        })
      ).data,
    enabled: !!cnpj,
  });

  const licitacoesQuery = useQuery({
    queryKey: ["transparencia-licitacoes", cnpj, exercicio, pageLicitacoes],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<TransparenciaLicitacao>>(`/transparencia/${cnpj}/licitacoes`, {
          params: { exercicio, page: pageLicitacoes, pageSize: 20 },
        })
      ).data,
    enabled: !!cnpj,
  });

  const contratosQuery = useQuery({
    queryKey: ["transparencia-contratos", cnpj, exercicio, pageContratos],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<TransparenciaContrato>>(`/transparencia/${cnpj}/contratos`, {
          params: { exercicio, page: pageContratos, pageSize: 20 },
        })
      ).data,
    enabled: !!cnpj,
  });

  const receitasColumns: DataTableColumn<TransparenciaReceita>[] = [
    { header: "Data", cell: (r) => formatDate(r.data), className: "w-28" },
    { header: "Tipo", cell: (r) => r.tipo, className: "w-32" },
    { header: "Categoria", cell: (r) => r.categoria },
    { header: "Codigo", cell: (r) => r.codigoReceita ?? "-", className: "w-28" },
    { header: "Descricao", cell: (r) => r.descricao ?? "-" },
    { header: "Valor", cell: (r) => <span className="font-mono">{formatCurrency(r.valor)}</span>, className: "w-32 text-right" },
  ];

  const despesasColumns: DataTableColumn<TransparenciaDespesa>[] = [
    { header: "Empenho", cell: (d) => <span className="font-mono">{d.numero}</span>, className: "w-28" },
    { header: "Data", cell: (d) => formatDate(d.data), className: "w-28" },
    { header: "Credor", cell: (d) => d.credor.nome },
    { header: "CPF/CNPJ", cell: (d) => formatCpfCnpj(d.credor.cpfCnpj), className: "w-40" },
    { header: "Funcao", cell: (d) => d.dotacao.funcao, className: "w-32" },
    { header: "Fonte de Recurso", cell: (d) => d.dotacao.fonteRecurso.descricao, className: "w-40" },
    { header: "Status", cell: (d) => d.status, className: "w-28" },
    { header: "Empenhado", cell: (d) => <span className="font-mono">{formatCurrency(d.valor)}</span>, className: "w-28 text-right" },
    { header: "Liquidado", cell: (d) => <span className="font-mono">{formatCurrency(d.valorLiquidado)}</span>, className: "w-28 text-right" },
    { header: "Pago", cell: (d) => <span className="font-mono">{formatCurrency(d.valorPago)}</span>, className: "w-28 text-right" },
  ];

  const licitacoesColumns: DataTableColumn<TransparenciaLicitacao>[] = [
    { header: "Numero", cell: (l) => <span className="font-medium">{l.numero}</span>, className: "w-28" },
    { header: "Modalidade", cell: (l) => MODALIDADE_LABELS[l.modalidade], className: "w-36" },
    { header: "Objeto", cell: (l) => <span className="line-clamp-2">{l.objeto}</span> },
    { header: "Abertura", cell: (l) => formatDate(l.dataAbertura), className: "w-28" },
    { header: "Valor Estimado", cell: (l) => <span className="font-mono">{formatCurrency(l.valorEstimado)}</span>, className: "w-32 text-right" },
    { header: "Valor Homologado", cell: (l) => <span className="font-mono">{formatCurrency(l.valorHomologado)}</span>, className: "w-32 text-right" },
    { header: "Status", cell: (l) => <Badge>{STATUS_LICITACAO_LABELS[l.status]}</Badge>, className: "w-32" },
  ];

  const contratosColumns: DataTableColumn<TransparenciaContrato>[] = [
    { header: "Numero", cell: (c) => <span className="font-medium">{c.numero}</span>, className: "w-28" },
    { header: "Credor", cell: (c) => c.credor.nome },
    { header: "CPF/CNPJ", cell: (c) => formatCpfCnpj(c.credor.cpfCnpj), className: "w-40" },
    { header: "Objeto", cell: (c) => <span className="line-clamp-2">{c.objeto}</span> },
    { header: "Vigencia", cell: (c) => `${formatDate(c.dataInicio)} a ${formatDate(c.dataFim)}`, className: "w-44" },
    { header: "Valor", cell: (c) => <span className="font-mono">{formatCurrency(c.valor)}</span>, className: "w-28 text-right" },
    { header: "Valor Aditivado", cell: (c) => <span className="font-mono">{formatCurrency(c.valorAditivado)}</span>, className: "w-28 text-right" },
    { header: "Status", cell: (c) => <Badge>{STATUS_CONTRATO_LABELS[c.status]}</Badge>, className: "w-28" },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Portal da Transparencia"
        description="Pre-visualizacao das informacoes publicadas no portal da transparencia (Lei 12.527/2011)"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={exercicio} onValueChange={(v) => { setExercicio(v); setPageReceitas(1); setPageDespesas(1); setPageLicitacoes(1); setPageContratos(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Exercicio" />
          </SelectTrigger>
          <SelectContent>
            {EXERCICIOS.map((ano) => (
              <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {entidade && (
          <span className="text-sm text-muted-foreground">
            {entidade.nome} - CNPJ {formatCpfCnpj(entidade.cnpj)} - {entidade.municipio}/{entidade.uf}
          </span>
        )}
      </div>

      <Tabs defaultValue="receitas">
        <TabsList>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="licitacoes">Licitacoes</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="receitas">
          <Card className="overflow-auto">
            <DataTable columns={receitasColumns} data={receitasQuery.data?.data ?? []} isLoading={receitasQuery.isLoading} getRowId={(r) => r.id} />
            {receitasQuery.data && <PaginationBar meta={receitasQuery.data.meta} onPageChange={setPageReceitas} />}
          </Card>
        </TabsContent>

        <TabsContent value="despesas">
          <Card className="overflow-auto">
            <DataTable columns={despesasColumns} data={despesasQuery.data?.data ?? []} isLoading={despesasQuery.isLoading} getRowId={(d) => d.id} />
            {despesasQuery.data && <PaginationBar meta={despesasQuery.data.meta} onPageChange={setPageDespesas} />}
          </Card>
        </TabsContent>

        <TabsContent value="licitacoes">
          <Card className="overflow-auto">
            <DataTable columns={licitacoesColumns} data={licitacoesQuery.data?.data ?? []} isLoading={licitacoesQuery.isLoading} getRowId={(l) => l.id} />
            {licitacoesQuery.data && <PaginationBar meta={licitacoesQuery.data.meta} onPageChange={setPageLicitacoes} />}
          </Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card className="overflow-auto">
            <DataTable columns={contratosColumns} data={contratosQuery.data?.data ?? []} isLoading={contratosQuery.isLoading} getRowId={(c) => c.id} />
            {contratosQuery.data && <PaginationBar meta={contratosQuery.data.meta} onPageChange={setPageContratos} />}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
