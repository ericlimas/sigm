import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calculator, FileText, Pencil, Printer } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatCpfCnpj, formatDate, formatDateTime } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Liquidacao, RetencaoHistorico } from "@/types/execucao";
import type { NaturezaServico } from "@/types/cadastros";

const NONE = "__none__";
const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];
const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const calcularSchema = z.object({
  naturezaServicoId: z.string().optional(),
  numeroDependentes: z.coerce.number().int().min(0).optional(),
});
type CalcularFormValues = z.infer<typeof calcularSchema>;

const ajusteSchema = z.object({
  inssRetido: z.coerce.number().min(0).optional(),
  irrfRetido: z.coerce.number().min(0).optional(),
  numeroDependentes: z.coerce.number().int().min(0).optional(),
  deducaoDependentes: z.coerce.number().min(0).optional(),
  baseIrrf: z.coerce.number().min(0).optional(),
  justificativa: z.string().min(10, "Informe uma justificativa detalhada (minimo 10 caracteres)"),
});
type AjusteFormValues = z.infer<typeof ajusteSchema>;

interface RetencaoDetalhe {
  credor: { id: string; nome: string; tipoPessoa: string; numeroDependentes: number };
  retencao: {
    id: string;
    valorBruto: number;
    baseInss: number;
    inssRetido: number;
    aliquotaInss: number;
    numeroDependentes: number;
    deducaoDependentes: number;
    baseIrrf: number;
    irrfRetido: number;
    aliquotaIrrf: number;
    valorLiquido: number;
    calculoManual: boolean;
    justificativaAjuste: string | null;
    historico?: RetencaoHistorico[];
  } | null;
  obrigatorio: boolean;
}

export default function RetencoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCalcular = hasPermissao("RETENCOES", "CALCULAR");
  const podeAjustar = hasPermissao("RETENCOES", "AJUSTAR");

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calcularOpen, setCalcularOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [demonstrativoOpen, setDemonstrativoOpen] = useState(false);

  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(ANO_ATUAL));

  const liquidacoesQuery = useQuery({
    queryKey: ["liquidacoes", "pf"],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Liquidacao>>("/liquidacoes", { params: { pageSize: 200 } })
      ).data.data.filter((l) => l.empenho?.credor?.tipoPessoa === "FISICA"),
  });

  const itens = useMemo(() => {
    const data = liquidacoesQuery.data ?? [];
    if (!search) return data;
    const term = search.toLowerCase();
    return data.filter(
      (l) =>
        l.empenho?.credor?.nome?.toLowerCase().includes(term) ||
        String(l.numero).includes(term) ||
        String(l.empenho?.numero).includes(term)
    );
  }, [liquidacoesQuery.data, search]);

  const detalheQuery = useQuery({
    queryKey: ["retencao", selectedId],
    queryFn: async () => (await api.get<RetencaoDetalhe>(`/retencoes/${selectedId}`)).data,
    enabled: !!selectedId,
  });

  const naturezasQuery = useQuery({
    queryKey: ["naturezas-servico", "select"],
    queryFn: async () => (await api.get<{ data: NaturezaServico[] }>("/naturezas-servico")).data.data,
    enabled: calcularOpen,
  });

  const demonstrativoQuery = useQuery({
    queryKey: ["retencao-demonstrativo", selectedId],
    queryFn: async () => (await api.get(`/retencoes/${selectedId}/demonstrativo`)).data,
    enabled: !!selectedId && demonstrativoOpen,
  });

  const relatorioQuery = useQuery({
    queryKey: ["retencoes-relatorio", mes, ano],
    queryFn: async () => (await api.get("/retencoes/relatorios/mensal", { params: { mes, ano } })).data,
  });

  const calcularForm = useForm<CalcularFormValues>({
    resolver: zodResolver(calcularSchema) as Resolver<CalcularFormValues>,
    defaultValues: { naturezaServicoId: "", numeroDependentes: 0 },
  });

  function openCalcular() {
    calcularForm.reset({
      naturezaServicoId: "",
      numeroDependentes: detalheQuery.data?.credor.numeroDependentes ?? 0,
    });
    setCalcularOpen(true);
  }

  const calcularMutation = useMutation({
    mutationFn: async (values: CalcularFormValues) => {
      const payload = {
        naturezaServicoId: values.naturezaServicoId || null,
        numeroDependentes: values.numeroDependentes,
      };
      return (await api.post(`/retencoes/${selectedId}/calcular`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retencao", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["liquidacoes", "pf"] });
      toast({ title: "Retencao calculada" });
      setCalcularOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao calcular", description: getErrorMessage(error), variant: "destructive" }),
  });

  const ajusteForm = useForm<AjusteFormValues>({
    resolver: zodResolver(ajusteSchema) as Resolver<AjusteFormValues>,
    defaultValues: { inssRetido: 0, irrfRetido: 0, numeroDependentes: 0, deducaoDependentes: 0, baseIrrf: 0, justificativa: "" },
  });

  function openAjuste() {
    const r = detalheQuery.data?.retencao;
    ajusteForm.reset({
      inssRetido: Number(r?.inssRetido ?? 0),
      irrfRetido: Number(r?.irrfRetido ?? 0),
      numeroDependentes: Number(r?.numeroDependentes ?? 0),
      deducaoDependentes: Number(r?.deducaoDependentes ?? 0),
      baseIrrf: Number(r?.baseIrrf ?? 0),
      justificativa: "",
    });
    setAjusteOpen(true);
  }

  const ajusteMutation = useMutation({
    mutationFn: async (values: AjusteFormValues) => (await api.put(`/retencoes/${selectedId}`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retencao", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["liquidacoes", "pf"] });
      toast({ title: "Retencao ajustada" });
      setAjusteOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao ajustar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Liquidacao>[] = [
    { header: "Liquidacao", cell: (l) => <span className="font-medium">{l.numero}</span>, className: "w-24" },
    {
      header: "Empenho",
      cell: (l) => (l.empenho ? `${l.empenho.numero}/${l.empenho.exercicio}` : "-"),
      className: "w-28",
    },
    { header: "Credor", cell: (l) => l.empenho?.credor?.nome ?? "-" },
    { header: "Data", cell: (l) => formatDate(l.data), className: "w-28" },
    { header: "Valor", cell: (l) => formatCurrency(l.valor), className: "w-32 text-right" },
    {
      header: "Retencao",
      className: "w-32",
      cell: (l) =>
        l.retencao ? (
          <Badge variant={l.retencao.calculoManual ? "warning" : "success"}>
            {l.retencao.calculoManual ? "Ajuste Manual" : "Calculada"}
          </Badge>
        ) : (
          <Badge variant="destructive">Pendente</Badge>
        ),
    },
  ];

  const detalhe = detalheQuery.data;
  const retencao = detalhe?.retencao;
  const d = demonstrativoQuery.data;

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Retencoes (INSS/IRRF)"
        description="Calculo e ajuste de retencoes tributarias para credores Pessoa Fisica"
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por credor ou numero..." className="w-72" />

      <Card className="overflow-auto">
        <DataTable columns={columns} data={itens} isLoading={liquidacoesQuery.isLoading} getRowId={(l) => l.id} onRowClick={(l) => setSelectedId(l.id)} />
      </Card>

      {selectedId && detalhe && (
        <Card className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{detalhe.credor.nome}</p>
              <p className="text-xs text-muted-foreground">Dependentes cadastrados: {detalhe.credor.numeroDependentes}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {podeCalcular && (
                <Button size="sm" variant="outline" onClick={openCalcular}>
                  <Calculator className="mr-1.5 h-3.5 w-3.5" />
                  Calcular
                </Button>
              )}
              {podeAjustar && retencao && (
                <Button size="sm" variant="outline" onClick={openAjuste}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Ajustar Manualmente
                </Button>
              )}
              {retencao && (
                <Button size="sm" variant="outline" onClick={() => setDemonstrativoOpen(true)}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Demonstrativo
                </Button>
              )}
            </div>
          </div>

          {retencao ? (
            <>
              <div className="grid grid-cols-3 gap-3 rounded-md border p-2 text-center text-sm sm:grid-cols-6">
                <div><div className="text-xs text-muted-foreground">Valor Bruto</div><div className="font-semibold">{formatCurrency(retencao.valorBruto)}</div></div>
                <div><div className="text-xs text-muted-foreground">Base INSS</div><div className="font-semibold">{formatCurrency(retencao.baseInss)}</div></div>
                <div><div className="text-xs text-muted-foreground">INSS Retido ({Number(retencao.aliquotaInss)}%)</div><div className="font-semibold">{formatCurrency(retencao.inssRetido)}</div></div>
                <div><div className="text-xs text-muted-foreground">Base IRRF</div><div className="font-semibold">{formatCurrency(retencao.baseIrrf)}</div></div>
                <div><div className="text-xs text-muted-foreground">IRRF Retido ({Number(retencao.aliquotaIrrf)}%)</div><div className="font-semibold">{formatCurrency(retencao.irrfRetido)}</div></div>
                <div><div className="text-xs text-muted-foreground">Valor Liquido</div><div className="font-semibold">{formatCurrency(retencao.valorLiquido)}</div></div>
              </div>

              {retencao.calculoManual && (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800">
                  <strong>Ajuste manual: </strong>{retencao.justificativaAjuste}
                </div>
              )}

              {!!retencao.historico?.length && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Historico de Alteracoes</p>
                  <DataTable
                    columns={[
                      { header: "Data", cell: (h) => formatDateTime(h.createdAt), className: "w-40" },
                      { header: "Campo", cell: (h) => h.campoAlterado, className: "w-32" },
                      { header: "De", cell: (h) => h.valorAnterior ?? "-", className: "w-24" },
                      { header: "Para", cell: (h) => h.valorNovo ?? "-", className: "w-24" },
                      { header: "Justificativa", cell: (h) => h.justificativa },
                    ]}
                    data={retencao.historico}
                    getRowId={(h) => h.id}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Retencao ainda nao calculada para esta liquidacao.</p>
          )}
        </Card>
      )}

      <Card className="space-y-3 p-3">
        <PageHeader title="Relatorio Mensal de Retencoes" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((label, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={[
            { header: "Credor", cell: (r: any) => r.credor?.nome ?? "-" },
            { header: "Liquidacao", cell: (r: any) => r.liquidacao?.numero ?? "-", className: "w-24" },
            { header: "Empenho", cell: (r: any) => (r.liquidacao?.empenho ? `${r.liquidacao.empenho.numero}/${r.liquidacao.empenho.exercicio}` : "-"), className: "w-28" },
            { header: "Valor Bruto", cell: (r: any) => formatCurrency(r.valorBruto), className: "w-32 text-right" },
            { header: "INSS", cell: (r: any) => formatCurrency(r.inssRetido), className: "w-28 text-right" },
            { header: "IRRF", cell: (r: any) => formatCurrency(r.irrfRetido), className: "w-28 text-right" },
            { header: "Liquido", cell: (r: any) => formatCurrency(r.valorLiquido), className: "w-32 text-right" },
          ]}
          data={relatorioQuery.data?.itens ?? []}
          isLoading={relatorioQuery.isLoading}
          getRowId={(r: any) => r.id}
          emptyMessage="Nenhuma retencao no periodo"
        />

        {relatorioQuery.data && (
          <div className="grid grid-cols-4 gap-3 rounded-md border p-2 text-center text-sm">
            <div><div className="text-xs text-muted-foreground">Total Bruto</div><div className="font-semibold">{formatCurrency(relatorioQuery.data.totais.valorBruto)}</div></div>
            <div><div className="text-xs text-muted-foreground">Total INSS</div><div className="font-semibold">{formatCurrency(relatorioQuery.data.totais.inssRetido)}</div></div>
            <div><div className="text-xs text-muted-foreground">Total IRRF</div><div className="font-semibold">{formatCurrency(relatorioQuery.data.totais.irrfRetido)}</div></div>
            <div><div className="text-xs text-muted-foreground">Total Liquido</div><div className="font-semibold">{formatCurrency(relatorioQuery.data.totais.valorLiquido)}</div></div>
          </div>
        )}
      </Card>

      {/* Dialog: calcular */}
      <Dialog open={calcularOpen} onOpenChange={setCalcularOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calcular Retencao</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={calcularForm.handleSubmit((values) => calcularMutation.mutate(values))}>
            <Field label="Natureza do Servico" htmlFor="naturezaServicoId">
              <Controller
                control={calcularForm.control}
                name="naturezaServicoId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="naturezaServicoId">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {(naturezasQuery.data ?? []).map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.codigo} - {n.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Numero de Dependentes" htmlFor="numeroDependentes" error={calcularForm.formState.errors.numeroDependentes?.message}>
              <Input id="numeroDependentes" type="number" min={0} {...calcularForm.register("numeroDependentes")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCalcularOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={calcularMutation.isPending}>Calcular</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: ajuste manual */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Retencao</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={ajusteForm.handleSubmit((values) => ajusteMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="INSS Retido" htmlFor="inssRetido" error={ajusteForm.formState.errors.inssRetido?.message}>
                <Input id="inssRetido" type="number" step="0.01" min={0} {...ajusteForm.register("inssRetido")} />
              </Field>
              <Field label="IRRF Retido" htmlFor="irrfRetido" error={ajusteForm.formState.errors.irrfRetido?.message}>
                <Input id="irrfRetido" type="number" step="0.01" min={0} {...ajusteForm.register("irrfRetido")} />
              </Field>
              <Field label="Base IRRF" htmlFor="baseIrrf" error={ajusteForm.formState.errors.baseIrrf?.message}>
                <Input id="baseIrrf" type="number" step="0.01" min={0} {...ajusteForm.register("baseIrrf")} />
              </Field>
              <Field label="Numero de Dependentes" htmlFor="numeroDependentesAjuste" error={ajusteForm.formState.errors.numeroDependentes?.message}>
                <Input id="numeroDependentesAjuste" type="number" min={0} {...ajusteForm.register("numeroDependentes")} />
              </Field>
              <Field label="Deducao Dependentes" htmlFor="deducaoDependentes" error={ajusteForm.formState.errors.deducaoDependentes?.message}>
                <Input id="deducaoDependentes" type="number" step="0.01" min={0} {...ajusteForm.register("deducaoDependentes")} />
              </Field>
            </div>
            <Field label="Justificativa" htmlFor="justificativaAjuste" error={ajusteForm.formState.errors.justificativa?.message}>
              <Textarea id="justificativaAjuste" rows={3} {...ajusteForm.register("justificativa")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={ajusteMutation.isPending}>Salvar Ajuste</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: demonstrativo */}
      <Dialog open={demonstrativoOpen} onOpenChange={setDemonstrativoOpen}>
        <DialogContent className="max-w-lg print:max-w-none">
          <DialogHeader>
            <DialogTitle>Demonstrativo de Retencao</DialogTitle>
          </DialogHeader>
          {d && (
            <div className="space-y-2 text-sm">
              <p className="text-center text-base font-semibold">{d.documento}</p>
              <p><strong>Credor:</strong> {d.credor?.nome} - {formatCpfCnpj(d.credor?.cpfCnpj ?? "")}</p>
              <p><strong>Empenho:</strong> {d.referencia?.empenho} <strong>Liquidacao:</strong> {d.referencia?.liquidacao}</p>
              <p><strong>Data:</strong> {formatDate(d.referencia?.data)}</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div><div className="text-xs text-muted-foreground">Valor Bruto</div><div className="font-semibold">{formatCurrency(d.valores?.valorBruto)}</div></div>
                <div><div className="text-xs text-muted-foreground">INSS Retido</div><div className="font-semibold">{formatCurrency(d.valores?.inssRetido)}</div></div>
                <div><div className="text-xs text-muted-foreground">Base IRRF</div><div className="font-semibold">{formatCurrency(d.valores?.baseIrrf)}</div></div>
                <div><div className="text-xs text-muted-foreground">IRRF Retido</div><div className="font-semibold">{formatCurrency(d.valores?.irrfRetido)}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Valor Liquido</div><div className="font-semibold">{formatCurrency(d.valores?.valorLiquido)}</div></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDemonstrativoOpen(false)}>Fechar</Button>
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
