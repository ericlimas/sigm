import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { api, type PaginatedResponse } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import SearchInput from "@/components/shared/SearchInput";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/types/scaffold";

const ACAO_VARIANT: Record<string, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "destructive",
};

export default function AuditoriaPage() {
  const [search, setSearch] = useState("");
  const [modulo, setModulo] = useState("");
  const [acao, setAcao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [detalhe, setDetalhe] = useState<AuditLog | null>(null);

  const listQuery = useQuery({
    queryKey: ["auditoria", search, modulo, acao, dataInicio, dataFim, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<AuditLog>>("/auditoria", {
          params: {
            q: search || undefined,
            modulo: modulo || undefined,
            acao: acao || undefined,
            dataInicio: dataInicio || undefined,
            dataFim: dataFim || undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const columns: DataTableColumn<AuditLog>[] = [
    { header: "Data/Hora", cell: (l) => formatDateTime(l.createdAt), className: "w-44" },
    { header: "Usuario", cell: (l) => l.usuario?.nome ?? "-" },
    { header: "Modulo", cell: (l) => l.modulo, className: "w-36" },
    {
      header: "Acao",
      className: "w-28",
      cell: (l) => <Badge variant={ACAO_VARIANT[l.acao] ?? "default"}>{l.acao}</Badge>,
    },
    { header: "Registro Afetado", cell: (l) => l.entidadeAfetada ?? "-", className: "w-40" },
    { header: "IP", cell: (l) => l.ip ?? "-", className: "w-32" },
    {
      header: "Acoes",
      className: "w-20 text-right",
      cell: (l) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetalhe(l)} title="Ver detalhes">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader title="Auditoria" description="Trilha de auditoria de todas as alteracoes realizadas no sistema" />

      <div className="flex flex-wrap items-end gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por modulo, acao ou registro..." />
        <Field label="Modulo" htmlFor="modulo" className="w-40">
          <Input id="modulo" value={modulo} onChange={(e) => { setModulo(e.target.value); setPage(1); }} placeholder="Ex: CONTRATOS" />
        </Field>
        <Field label="Acao" htmlFor="acao" className="w-32">
          <Input id="acao" value={acao} onChange={(e) => { setAcao(e.target.value); setPage(1); }} placeholder="Ex: UPDATE" />
        </Field>
        <Field label="Data Inicio" htmlFor="dataInicio" className="w-40">
          <Input id="dataInicio" type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Data Fim" htmlFor="dataFim" className="w-40">
          <Input id="dataFim" type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(1); }} />
        </Field>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(l) => l.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro de Auditoria</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{formatDateTime(detalhe.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium">{detalhe.usuario?.nome ?? "-"} {detalhe.usuario?.email ? `(${detalhe.usuario.email})` : ""}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modulo</p>
                  <p className="font-medium">{detalhe.modulo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Acao</p>
                  <p className="font-medium"><Badge variant={ACAO_VARIANT[detalhe.acao] ?? "default"}>{detalhe.acao}</Badge></p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registro Afetado</p>
                  <p className="font-medium">{detalhe.entidadeAfetada ?? "-"} {detalhe.registroId ? `#${detalhe.registroId}` : ""}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP / User Agent</p>
                  <p className="font-medium truncate">{detalhe.ip ?? "-"} - {detalhe.userAgent ?? "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-muted-foreground">Dados Anteriores</p>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-2 text-xs">
                    {detalhe.dadosAnteriores ? JSON.stringify(detalhe.dadosAnteriores, null, 2) : "-"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Dados Novos</p>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-2 text-xs">
                    {detalhe.dadosNovos ? JSON.stringify(detalhe.dadosNovos, null, 2) : "-"}
                  </pre>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalhe(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
