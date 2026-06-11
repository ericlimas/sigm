import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Eye, Sparkles, X } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import type { IaSugestao, StatusSugestaoIA, TipoSugestaoIA } from "@/types/scaffold";

const TODOS = "__todos__";

const TIPO_LABELS: Record<TipoSugestaoIA, string> = {
  CLASSIFICACAO_CONTABIL: "Classificacao Contabil",
  FONTE_RECURSO: "Fonte de Recurso",
  NATUREZA_DESPESA: "Natureza de Despesa",
  INCONSISTENCIA: "Inconsistencia",
  RETENCAO_TRIBUTARIA: "Retencao Tributaria",
  PARECER_CONTROLE_INTERNO: "Parecer de Controle Interno",
};

const STATUS_LABELS: Record<StatusSugestaoIA, string> = {
  PENDENTE: "Pendente",
  ACEITA: "Aceita",
  REJEITADA: "Rejeitada",
};

const STATUS_VARIANT: Record<StatusSugestaoIA, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  PENDENTE: "warning",
  ACEITA: "success",
  REJEITADA: "destructive",
};

const classificacaoSchema = z.object({
  modulo: z.string().min(1, "Informe o modulo"),
  registroId: z.string().optional(),
  descricao: z.string().min(3, "Descreva o historico do lancamento"),
});

type ClassificacaoFormValues = z.infer<typeof classificacaoSchema>;

const CLASSIFICACAO_DEFAULT_VALUES: ClassificacaoFormValues = {
  modulo: "",
  registroId: "",
  descricao: "",
};

export default function IaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [moduloFiltro, setModuloFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState(TODOS);
  const [tipoFiltro, setTipoFiltro] = useState(TODOS);
  const [page, setPage] = useState(1);
  const [detalhe, setDetalhe] = useState<IaSugestao | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const podeAvaliar = hasPermissao("IA", "AVALIAR");
  const podeGerar = hasPermissao("IA", "GERAR");

  const listQuery = useQuery({
    queryKey: ["ia-sugestoes", moduloFiltro, statusFiltro, tipoFiltro, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<IaSugestao>>("/ia", {
          params: {
            modulo: moduloFiltro || undefined,
            status: statusFiltro !== TODOS ? statusFiltro : undefined,
            tipo: tipoFiltro !== TODOS ? tipoFiltro : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const form = useForm<ClassificacaoFormValues>({
    resolver: zodResolver(classificacaoSchema) as Resolver<ClassificacaoFormValues>,
    defaultValues: CLASSIFICACAO_DEFAULT_VALUES,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ACEITA" | "REJEITADA" }) =>
      (await api.put(`/ia/${id}/status`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ia-sugestoes"] });
      toast({ title: "Status atualizado" });
      setDetalhe(null);
    },
    onError: (error) => toast({ title: "Erro ao atualizar status", description: getErrorMessage(error), variant: "destructive" }),
  });

  const inconsistenciasMutation = useMutation({
    mutationFn: async () => (await api.post<{ total: number }>("/ia/gerar/inconsistencias")).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ia-sugestoes"] });
      toast({ title: "Analise concluida", description: `${data.total} sugestao(oes) gerada(s)` });
    },
    onError: (error) => toast({ title: "Erro ao gerar sugestoes", description: getErrorMessage(error), variant: "destructive" }),
  });

  const classificacaoMutation = useMutation({
    mutationFn: async (values: ClassificacaoFormValues) =>
      (
        await api.post("/ia/gerar/classificacao-contabil", {
          ...values,
          registroId: values.registroId || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ia-sugestoes"] });
      toast({ title: "Sugestao de classificacao gerada" });
      form.reset(CLASSIFICACAO_DEFAULT_VALUES);
      setFormOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao gerar sugestao", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<IaSugestao>[] = [
    { header: "Data", cell: (s) => formatDateTime(s.createdAt), className: "w-44" },
    { header: "Modulo", cell: (s) => s.modulo, className: "w-36" },
    { header: "Tipo", cell: (s) => TIPO_LABELS[s.tipo], className: "w-44" },
    { header: "Titulo", cell: (s) => <span className="line-clamp-2 font-medium">{s.titulo}</span> },
    {
      header: "Status",
      className: "w-28",
      cell: (s) => <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABELS[s.status]}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-32 text-right",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetalhe(s)} title="Ver detalhes">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {podeAvaliar && s.status === "PENDENTE" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600"
                title="Aceitar"
                onClick={() => statusMutation.mutate({ id: s.id, status: "ACEITA" })}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                title="Rejeitar"
                onClick={() => statusMutation.mutate({ id: s.id, status: "REJEITADA" })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Inteligencia Artificial"
        description="Sugestoes de classificacao contabil e deteccao de inconsistencias"
        actions={
          podeGerar && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFormOpen((v) => !v)}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Sugerir Classificacao
              </Button>
              <Button onClick={() => inconsistenciasMutation.mutate()} disabled={inconsistenciasMutation.isPending}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Detectar Inconsistencias
              </Button>
            </div>
          )
        }
      />

      {formOpen && (
        <Card className="space-y-3 p-3">
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => classificacaoMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Modulo" htmlFor="modulo" error={form.formState.errors.modulo?.message}>
                <Input id="modulo" placeholder="Ex: EMPENHO" {...form.register("modulo")} />
              </Field>
              <Field label="Registro (opcional)" htmlFor="registroId">
                <Input id="registroId" placeholder="ID do registro relacionado" {...form.register("registroId")} />
              </Field>
            </div>
            <Field label="Historico / Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message}>
              <Textarea id="descricao" rows={3} placeholder="Descreva o historico do lancamento para sugestao de conta contabil..." {...form.register("descricao")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={classificacaoMutation.isPending}>Gerar Sugestao</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Modulo" htmlFor="moduloFiltro" className="w-44">
          <Input id="moduloFiltro" value={moduloFiltro} onChange={(e) => { setModuloFiltro(e.target.value); setPage(1); }} placeholder="Ex: EMPENHO" />
        </Field>
        <Select value={tipoFiltro} onValueChange={(v) => { setTipoFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={(v) => { setStatusFiltro(v); setPage(1); }}>
          <SelectTrigger className="w-44">
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
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(s) => s.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detalhe?.titulo}</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[detalhe.status]}>{STATUS_LABELS[detalhe.status]}</Badge>
                <Badge variant="outline">{TIPO_LABELS[detalhe.tipo]}</Badge>
                <span className="text-muted-foreground">{detalhe.modulo} - {formatDateTime(detalhe.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap rounded-md border bg-muted p-3">{detalhe.conteudo}</p>
            </div>
          )}
          <DialogFooter>
            {podeAvaliar && detalhe?.status === "PENDENTE" && (
              <>
                <Button variant="destructive" onClick={() => detalhe && statusMutation.mutate({ id: detalhe.id, status: "REJEITADA" })} disabled={statusMutation.isPending}>
                  Rejeitar
                </Button>
                <Button onClick={() => detalhe && statusMutation.mutate({ id: detalhe.id, status: "ACEITA" })} disabled={statusMutation.isPending}>
                  Aceitar
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDetalhe(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
