import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Ban, Printer, AlertTriangle } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatValorAsterisco } from "@/lib/utils";
import { LARGURA_DOC, centralizar, linhasResponsavel, buildCabecalhoNotaEmpenho, imprimirDocumento, type NotaEmpenhoCabecalho } from "@/lib/notaEmpenho";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ContaBancaria, FormaPagamento, Liquidacao, Pagamento } from "@/types/execucao";

const NONE = "__none__";
const TODOS = "__todos__";

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDENTE: "warning",
  PAGO: "success",
  CANCELADO: "destructive",
};

const FORMA_LABELS: Record<FormaPagamento, string> = {
  PIX: "PIX",
  TED: "TED",
  DOC: "DOC",
  CHEQUE: "Cheque",
  DINHEIRO: "Dinheiro",
  CNAB: "CNAB",
};

const pagamentoSchema = z.object({
  liquidacaoId: z.string().min(1, "Selecione a liquidacao"),
  data: z.string().min(1, "Informe a data"),
  valor: z.preprocess((v) => Number(v), z.number().positive("Informe um valor maior que zero")),
  formaPagamento: z.enum(["PIX", "TED", "DOC", "CHEQUE", "DINHEIRO", "CNAB"]),
  contaBancariaId: z.string().min(1, "Selecione a conta"),
  numeroOrdemPagamento: z.string().optional(),
});
type PagamentoFormValues = z.infer<typeof pagamentoSchema>;

const DEFAULT_VALUES: PagamentoFormValues = {
  liquidacaoId: "",
  data: new Date().toISOString().substring(0, 10),
  valor: 0,
  formaPagamento: "PIX",
  contaBancariaId: "",
  numeroOrdemPagamento: "",
};

const cancelarSchema = z.object({
  justificativa: z.string().min(3, "Informe a justificativa"),
});
type CancelarFormValues = z.infer<typeof cancelarSchema>;

function valorAPagarLiquidacao(liquidacao: Liquidacao): number {
  return liquidacao.retencao ? Number(liquidacao.retencao.valorLiquido) : Number(liquidacao.valor);
}

function saldoAPagar(liquidacao: Liquidacao): number {
  const pago = (liquidacao.pagamentos ?? [])
    .filter((p) => p.status === "PAGO")
    .reduce((acc, p) => acc + Number(p.valor), 0);
  return round2(valorAPagarLiquidacao(liquidacao) - pago);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface PagamentoImprimirData extends NotaEmpenhoCabecalho {
  liquidacao: { numero: number; data: string; valor: number };
  pagamento: {
    data: string;
    valor: number;
    valorExtenso: string;
    formaPagamento: FormaPagamento;
    numeroOrdemPagamento: string | null;
  };
  contaBancaria: { descricao: string; banco: string | null; conta: string | null } | null;
  usuarioLogado: string;
}

function buildNotaPagamentoTexto(d: PagamentoImprimirData): string {
  const linhaSep = "-".repeat(LARGURA_DOC);
  const linhas = buildCabecalhoNotaEmpenho(d);

  linhas.push(linhaSep);
  linhas.push(
    `A liquidação Nº ${String(d.liquidacao.numero).padStart(3, "0")}, no valor R$ ${formatValorAsterisco(d.liquidacao.valor)}, da despesa a que se refere a presente`
  );
  linhas.push("NOTA DE EMPENHO, foi procedida com base no documento apresentado, onde demonstra a entrega");
  linhas.push("do material ou efetivação do serviço prestado.");
  linhas.push(`Data: ${formatDate(d.liquidacao.data)}    Assinatura: _____________________________________________`);
  linhas.push(`Data p/ Pagto: ${formatDate(d.pagamento.data)}`);

  linhas.push(linhaSep);
  linhas.push("Face a liquidação acima autorizo o pagamento desta importância ao favorecido.");
  linhas.push(`Data: ${formatDate(d.pagamento.data)}    Ord. Pagto: ${d.pagamento.numeroOrdemPagamento || "___________________________________"}`);
  linhas.push(...linhasResponsavel(d.entidade.diretorFinanceiro, "CPF"));

  linhas.push(linhaSep);
  linhas.push(`Recebi(emos) a importância de R$ ${formatValorAsterisco(d.pagamento.valor)},`);
  linhas.push(`${d.pagamento.valorExtenso}.`);
  linhas.push("referente a despesa acima mencionada, da qual é dada plena quitação.");
  linhas.push("");
  linhas.push("___/___/_____      ____________________      ________________________________________");
  linhas.push("    Data               Identidade/CPF/CGC         Assinatura do Credor ou seu Procurador");

  linhas.push(linhaSep);
  linhas.push(centralizar("R E C U R S O"));
  const banco = d.contaBancaria ? `${d.contaBancaria.banco ?? "-"} - ${d.contaBancaria.descricao}` : "-";
  const conta = d.contaBancaria?.conta ?? "-";
  const cheque = d.pagamento.formaPagamento === "CHEQUE" ? d.pagamento.numeroOrdemPagamento ?? "-" : "-";
  linhas.push(`BANCO: ${banco}    CONTA: ${conta}    CHEQUE: ${cheque}    DATA: ${formatDate(d.pagamento.data)}`);

  linhas.push(linhaSep);
  linhas.push(`Usuário: ${d.usuarioLogado}`);

  return linhas.join("\n");
}

export default function PagamentosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("PAGAMENTOS", "CRIAR");
  const podeCancelar = hasPermissao("PAGAMENTOS", "CANCELAR");

  const [status, setStatus] = useState<string>(TODOS);
  const [formaPagamento, setFormaPagamento] = useState<string>(TODOS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["pagamentos", status, formaPagamento, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Pagamento>>("/pagamentos", {
          params: {
            status: status === TODOS ? undefined : status,
            formaPagamento: formaPagamento === TODOS ? undefined : formaPagamento,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const detailQuery = useQuery({
    queryKey: ["pagamento", detailId],
    queryFn: async () => (await api.get<Pagamento>(`/pagamentos/${detailId}`)).data,
    enabled: !!detailId,
  });

  const printQuery = useQuery({
    queryKey: ["pagamento-imprimir", detailId],
    queryFn: async () => (await api.get(`/pagamentos/${detailId}/imprimir`)).data,
    enabled: !!detailId && printOpen,
  });

  const liquidacoesQuery = useQuery({
    queryKey: ["liquidacoes", "select-pagamento"],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Liquidacao>>("/liquidacoes", {
          params: { status: "LIQUIDADA", pageSize: 200 },
        })
      ).data.data.filter((l) => saldoAPagar(l) > 0),
    enabled: dialogOpen,
  });

  const contasQuery = useQuery({
    queryKey: ["tesouraria", "contas", "select"],
    queryFn: async () => (await api.get<ContaBancaria[]>("/tesouraria/contas", { params: { ativo: true } })).data,
    enabled: dialogOpen,
  });

  const form = useForm<PagamentoFormValues>({
    resolver: zodResolver(pagamentoSchema) as Resolver<PagamentoFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  const liquidacaoIdSelecionada = form.watch("liquidacaoId");
  const liquidacaoSelecionada = liquidacoesQuery.data?.find((l) => l.id === liquidacaoIdSelecionada);
  const bloqueadoPorRetencao =
    !!liquidacaoSelecionada &&
    liquidacaoSelecionada.empenho?.credor?.tipoPessoa === "FISICA" &&
    !liquidacaoSelecionada.retencao;

  useEffect(() => {
    if (!liquidacaoSelecionada) return;
    form.setValue("valor", Math.max(0, saldoAPagar(liquidacaoSelecionada)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidacaoIdSelecionada]);

  function openCreate() {
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async (values: PagamentoFormValues) => {
      const payload = { ...values, numeroOrdemPagamento: values.numeroOrdemPagamento || null };
      return (await api.post("/pagamentos", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacoes"] });
      queryClient.invalidateQueries({ queryKey: ["empenhos"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria"] });
      toast({ title: "Pagamento registrado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const cancelarForm = useForm<CancelarFormValues>({
    resolver: zodResolver(cancelarSchema) as Resolver<CancelarFormValues>,
    defaultValues: { justificativa: "" },
  });

  const cancelarMutation = useMutation({
    mutationFn: async (values: CancelarFormValues) => (await api.post(`/pagamentos/${detailId}/cancelar`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamento", detailId] });
      queryClient.invalidateQueries({ queryKey: ["liquidacoes"] });
      queryClient.invalidateQueries({ queryKey: ["empenhos"] });
      queryClient.invalidateQueries({ queryKey: ["tesouraria"] });
      toast({ title: "Pagamento cancelado" });
      setCancelarOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao cancelar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Pagamento>[] = [
    { header: "Numero", cell: (p) => <span className="font-medium">{p.numero}</span>, className: "w-20" },
    {
      header: "Liquidacao",
      cell: (p) => (p.liquidacao ? `${p.liquidacao.numero} (Emp. ${p.liquidacao.empenho?.numero}/${p.liquidacao.empenho?.exercicio})` : "-"),
    },
    { header: "Credor", cell: (p) => p.liquidacao?.empenho?.credor?.nome ?? "-" },
    { header: "Data", cell: (p) => formatDate(p.data), className: "w-28" },
    { header: "Valor", cell: (p) => formatCurrency(p.valor), className: "w-32 text-right" },
    { header: "Forma", cell: (p) => FORMA_LABELS[p.formaPagamento], className: "w-24" },
    {
      header: "Status",
      className: "w-28",
      cell: (p) => <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABELS[p.status]}</Badge>,
    },
  ];

  const pagamento = detailQuery.data;
  const podeCancelarAtual = pagamento?.status === "PAGO";

  let textoImpressao: string | null = null;
  let erroImpressao: string | null = null;
  if (printQuery.data) {
    try {
      textoImpressao = buildNotaPagamentoTexto(printQuery.data as PagamentoImprimirData);
    } catch {
      erroImpressao = "Nao foi possivel montar o documento de impressao. O sistema pode estar em atualizacao, tente novamente em instantes.";
    }
  }

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Pagamentos"
        description="Quitacao financeira das despesas liquidadas"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Pagamento
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
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
        <Select value={formaPagamento} onValueChange={(v) => { setFormaPagamento(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Forma de Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as formas</SelectItem>
            {Object.entries(FORMA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(p) => p.id} onRowClick={(p) => setDetailId(p.id)} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      {/* Dialog: novo pagamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Pagamento</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
            <Field label="Liquidacao" htmlFor="liquidacaoId" error={form.formState.errors.liquidacaoId?.message}>
              <Controller
                control={form.control}
                name="liquidacaoId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="liquidacaoId">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} disabled>Selecione</SelectItem>
                      {(liquidacoesQuery.data ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          Liq. {l.numero} - {l.empenho?.credor?.nome} (saldo {formatCurrency(saldoAPagar(l))})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {bloqueadoPorRetencao && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Este credor e Pessoa Fisica e ainda nao possui retencao de INSS/IRRF calculada para esta liquidacao.
                  Acesse a tela de Retencoes para calcular antes de registrar o pagamento.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Field label="Data" htmlFor="data" error={form.formState.errors.data?.message}>
                <Input id="data" type="date" {...form.register("data")} />
              </Field>
              <Field label="Valor" htmlFor="valor" error={form.formState.errors.valor?.message}>
                <Input id="valor" type="number" step="0.01" min={0} {...form.register("valor")} />
              </Field>
              <Field label="Forma de Pagamento" htmlFor="formaPagamento">
                <Controller
                  control={form.control}
                  name="formaPagamento"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as FormaPagamento)}>
                      <SelectTrigger id="formaPagamento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMA_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Conta Bancaria" htmlFor="contaBancariaId" error={form.formState.errors.contaBancariaId?.message}>
                <Controller
                  control={form.control}
                  name="contaBancariaId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger id="contaBancariaId">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} disabled>Selecione</SelectItem>
                        {(contasQuery.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.descricao} {c.banco ? `- ${c.banco}` : ""} (saldo {formatCurrency(c.saldoAtual ?? c.saldoInicial)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Ordem de Pagamento (OB)" htmlFor="numeroOrdemPagamento">
                <Input id="numeroOrdemPagamento" {...form.register("numeroOrdemPagamento")} />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || bloqueadoPorRetencao}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: detalhe */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pagamento {pagamento?.numero}</DialogTitle>
          </DialogHeader>

          {pagamento && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Liquidacao: </span>{pagamento.liquidacao?.numero}</div>
                <div><span className="text-muted-foreground">Credor: </span>{pagamento.liquidacao?.empenho?.credor?.nome}</div>
                <div><span className="text-muted-foreground">Data: </span>{formatDate(pagamento.data)}</div>
                <div><span className="text-muted-foreground">Valor: </span>{formatCurrency(pagamento.valor)}</div>
                <div><span className="text-muted-foreground">Forma: </span>{FORMA_LABELS[pagamento.formaPagamento]}</div>
                <div><span className="text-muted-foreground">Conta: </span>{pagamento.contaBancaria?.descricao ?? "-"}</div>
                <div><span className="text-muted-foreground">OB: </span>{pagamento.numeroOrdemPagamento ?? "-"}</div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant={STATUS_VARIANT[pagamento.status]}>{STATUS_LABELS[pagamento.status]}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Imprimir Comprovante
                </Button>
                {podeCancelar && podeCancelarAtual && (
                  <Button size="sm" variant="outline" onClick={() => { cancelarForm.reset({ justificativa: "" }); setCancelarOpen(true); }}>
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Cancelar Pagamento
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: cancelar */}
      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Pagamento</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={cancelarForm.handleSubmit((values) => cancelarMutation.mutate(values))}>
            <Field label="Justificativa" htmlFor="justificativaCancelamento" error={cancelarForm.formState.errors.justificativa?.message}>
              <Textarea id="justificativaCancelamento" rows={3} {...cancelarForm.register("justificativa")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancelarOpen(false)}>Voltar</Button>
              <Button type="submit" variant="destructive" disabled={cancelarMutation.isPending}>Confirmar Cancelamento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: impressao */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nota de Empenho</DialogTitle>
          </DialogHeader>
          {printQuery.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Carregando dados para impressao...</p>
          )}
          {printQuery.isError && (
            <p className="p-4 text-sm text-destructive">{getErrorMessage(printQuery.error)}</p>
          )}
          {erroImpressao && <p className="p-4 text-sm text-destructive">{erroImpressao}</p>}
          {textoImpressao && (
            <pre className="overflow-x-auto whitespace-pre rounded-md border bg-white p-4 font-mono text-[11px] leading-[1.5] text-black">
              {textoImpressao}
            </pre>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPrintOpen(false)}>Fechar</Button>
            <Button
              type="button"
              onClick={() => textoImpressao && imprimirDocumento("Nota de Empenho", textoImpressao)}
              disabled={!textoImpressao}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
