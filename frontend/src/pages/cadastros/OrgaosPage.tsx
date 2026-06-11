import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Orgao, TipoOrgao, UnidadeOrcamentaria } from "@/types/cadastros";

const TIPO_ORGAO_LABELS: Record<TipoOrgao, string> = {
  ORGAO: "Orgao",
  SECRETARIA: "Secretaria",
  FUNDO: "Fundo",
  AUTARQUIA: "Autarquia",
  FUNDACAO: "Fundacao",
  PODER_LEGISLATIVO: "Poder Legislativo",
};

const NONE = "__none__";

const orgaoSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  nome: z.string().min(2, "Informe o nome"),
  tipo: z.enum(["ORGAO", "SECRETARIA", "FUNDO", "AUTARQUIA", "FUNDACAO", "PODER_LEGISLATIVO"]),
  orgaoSuperiorId: z.string().optional(),
  ativo: z.boolean().optional(),
});

type OrgaoFormValues = z.infer<typeof orgaoSchema>;

const ORGAO_DEFAULT: OrgaoFormValues = {
  codigo: "",
  nome: "",
  tipo: "SECRETARIA",
  orgaoSuperiorId: undefined,
  ativo: true,
};

const unidadeSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  nome: z.string().min(2, "Informe o nome"),
  orgaoId: z.string().min(1, "Selecione o orgao"),
  ativo: z.boolean().optional(),
});

type UnidadeFormValues = z.infer<typeof unidadeSchema>;

export default function OrgaosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [selectedOrgao, setSelectedOrgao] = useState<Orgao | null>(null);

  const [orgaoDialogOpen, setOrgaoDialogOpen] = useState(false);
  const [editingOrgao, setEditingOrgao] = useState<Orgao | null>(null);
  const [deletingOrgao, setDeletingOrgao] = useState<Orgao | null>(null);

  const [unidadeDialogOpen, setUnidadeDialogOpen] = useState(false);
  const [editingUnidade, setEditingUnidade] = useState<UnidadeOrcamentaria | null>(null);
  const [deletingUnidade, setDeletingUnidade] = useState<UnidadeOrcamentaria | null>(null);

  const podeCriar = hasPermissao("ORGAOS", "CRIAR");
  const podeEditar = hasPermissao("ORGAOS", "EDITAR");
  const podeExcluir = hasPermissao("ORGAOS", "EXCLUIR");

  const orgaosQuery = useQuery({
    queryKey: ["orgaos", search],
    queryFn: async () =>
      (await api.get<{ data: Orgao[] }>("/orgaos", { params: { q: search || undefined } })).data.data,
  });

  const unidadesQuery = useQuery({
    queryKey: ["unidades-orcamentarias", selectedOrgao?.id],
    queryFn: async () =>
      (
        await api.get<{ data: UnidadeOrcamentaria[] }>("/orgaos/unidades/listar", {
          params: { orgaoId: selectedOrgao?.id },
        })
      ).data.data,
    enabled: !!selectedOrgao,
  });

  const orgaoForm = useForm<OrgaoFormValues>({
    resolver: zodResolver(orgaoSchema),
    defaultValues: ORGAO_DEFAULT,
  });

  function openCreateOrgao() {
    setEditingOrgao(null);
    orgaoForm.reset(ORGAO_DEFAULT);
    setOrgaoDialogOpen(true);
  }

  function openEditOrgao(orgao: Orgao) {
    setEditingOrgao(orgao);
    orgaoForm.reset({
      codigo: orgao.codigo,
      nome: orgao.nome,
      tipo: orgao.tipo,
      orgaoSuperiorId: orgao.orgaoSuperiorId ?? undefined,
      ativo: orgao.ativo,
    });
    setOrgaoDialogOpen(true);
  }

  const saveOrgaoMutation = useMutation({
    mutationFn: async (values: OrgaoFormValues) => {
      const payload = { ...values, orgaoSuperiorId: values.orgaoSuperiorId || null };
      if (editingOrgao) return (await api.put(`/orgaos/${editingOrgao.id}`, payload)).data;
      return (await api.post("/orgaos", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgaos"] });
      toast({ title: editingOrgao ? "Orgao atualizado" : "Orgao criado" });
      setOrgaoDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteOrgaoMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/orgaos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgaos"] });
      toast({ title: "Orgao excluido" });
      setDeletingOrgao(null);
      if (selectedOrgao?.id === deletingOrgao?.id) setSelectedOrgao(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const unidadeForm = useForm<UnidadeFormValues>({
    resolver: zodResolver(unidadeSchema),
    defaultValues: { codigo: "", nome: "", orgaoId: "", ativo: true },
  });

  function openCreateUnidade() {
    if (!selectedOrgao) return;
    setEditingUnidade(null);
    unidadeForm.reset({ codigo: "", nome: "", orgaoId: selectedOrgao.id, ativo: true });
    setUnidadeDialogOpen(true);
  }

  function openEditUnidade(unidade: UnidadeOrcamentaria) {
    setEditingUnidade(unidade);
    unidadeForm.reset({ codigo: unidade.codigo, nome: unidade.nome, orgaoId: unidade.orgaoId, ativo: unidade.ativo });
    setUnidadeDialogOpen(true);
  }

  const saveUnidadeMutation = useMutation({
    mutationFn: async (values: UnidadeFormValues) => {
      if (editingUnidade) return (await api.put(`/orgaos/unidades/${editingUnidade.id}`, values)).data;
      return (await api.post("/orgaos/unidades", values)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unidades-orcamentarias"] });
      toast({ title: editingUnidade ? "Unidade atualizada" : "Unidade criada" });
      setUnidadeDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteUnidadeMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/orgaos/unidades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unidades-orcamentarias"] });
      toast({ title: "Unidade excluida" });
      setDeletingUnidade(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const orgaoColumns: DataTableColumn<Orgao>[] = [
    { header: "Codigo", cell: (o) => <span className="font-medium">{o.codigo}</span>, className: "w-24" },
    { header: "Nome", cell: (o) => o.nome },
    { header: "Tipo", cell: (o) => TIPO_ORGAO_LABELS[o.tipo], className: "w-44" },
    { header: "Orgao Superior", cell: (o) => o.orgaoSuperior?.nome ?? "-", className: "w-44" },
    {
      header: "Status",
      className: "w-24",
      cell: (o) => <Badge variant={o.ativo ? "success" : "secondary"}>{o.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (o) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditOrgao(o); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingOrgao(o); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const unidadeColumns: DataTableColumn<UnidadeOrcamentaria>[] = [
    { header: "Codigo", cell: (u) => <span className="font-medium">{u.codigo}</span>, className: "w-24" },
    { header: "Nome", cell: (u) => u.nome },
    {
      header: "Status",
      className: "w-24",
      cell: (u) => <Badge variant={u.ativo ? "success" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (u) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUnidade(u)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingUnidade(u)}>
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
        title="Orgaos e Unidades Orcamentarias"
        description="Estrutura organizacional da entidade: orgaos, secretarias, fundos, autarquias e suas unidades orcamentarias"
        actions={
          podeCriar && (
            <Button onClick={openCreateOrgao}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Orgao
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por codigo ou nome..." />
      </div>

      <Card className="overflow-auto">
        <DataTable
          columns={orgaoColumns}
          data={orgaosQuery.data ?? []}
          isLoading={orgaosQuery.isLoading}
          getRowId={(o) => o.id}
          onRowClick={(o) => setSelectedOrgao(o)}
        />
      </Card>

      {selectedOrgao && (
        <Card className="overflow-auto">
          <div className="p-3 pb-0">
            <PageHeader
              title={`Unidades Orcamentarias - ${selectedOrgao.nome}`}
              actions={
                podeCriar && (
                  <Button size="sm" onClick={openCreateUnidade}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nova Unidade
                  </Button>
                )
              }
            />
          </div>
          <DataTable
            columns={unidadeColumns}
            data={unidadesQuery.data ?? []}
            isLoading={unidadesQuery.isLoading}
            getRowId={(u) => u.id}
          />
        </Card>
      )}

      <Dialog open={orgaoDialogOpen} onOpenChange={setOrgaoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOrgao ? "Editar Orgao" : "Novo Orgao"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={orgaoForm.handleSubmit((values) => saveOrgaoMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codigo" htmlFor="codigo" error={orgaoForm.formState.errors.codigo?.message}>
                <Input id="codigo" {...orgaoForm.register("codigo")} />
              </Field>
              <Field label="Tipo" htmlFor="tipo">
                <Controller
                  control={orgaoForm.control}
                  name="tipo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoOrgao)}>
                      <SelectTrigger id="tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_ORGAO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <Field label="Nome" htmlFor="nome" error={orgaoForm.formState.errors.nome?.message}>
              <Input id="nome" {...orgaoForm.register("nome")} />
            </Field>
            <Field label="Orgao Superior" htmlFor="orgaoSuperiorId">
              <Controller
                control={orgaoForm.control}
                name="orgaoSuperiorId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                    <SelectTrigger id="orgaoSuperiorId">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {(orgaosQuery.data ?? [])
                        .filter((o) => o.id !== editingOrgao?.id)
                        .map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.codigo} - {o.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {editingOrgao && (
              <div className="flex items-center gap-2">
                <Controller
                  control={orgaoForm.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativoOrgao" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativoOrgao">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOrgaoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveOrgaoMutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={unidadeDialogOpen} onOpenChange={setUnidadeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingUnidade ? "Editar Unidade Orcamentaria" : "Nova Unidade Orcamentaria"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={unidadeForm.handleSubmit((values) => saveUnidadeMutation.mutate(values))}>
            <Field label="Codigo" htmlFor="codigoUnidade" error={unidadeForm.formState.errors.codigo?.message}>
              <Input id="codigoUnidade" {...unidadeForm.register("codigo")} />
            </Field>
            <Field label="Nome" htmlFor="nomeUnidade" error={unidadeForm.formState.errors.nome?.message}>
              <Input id="nomeUnidade" {...unidadeForm.register("nome")} />
            </Field>
            {editingUnidade && (
              <div className="flex items-center gap-2">
                <Controller
                  control={unidadeForm.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativoUnidade" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativoUnidade">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUnidadeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveUnidadeMutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingOrgao}
        onOpenChange={(open) => !open && setDeletingOrgao(null)}
        title="Excluir orgao"
        description={`Deseja realmente excluir o orgao "${deletingOrgao?.nome}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deletingOrgao && deleteOrgaoMutation.mutate(deletingOrgao.id)}
        loading={deleteOrgaoMutation.isPending}
        confirmLabel="Excluir"
      />

      <ConfirmDialog
        open={!!deletingUnidade}
        onOpenChange={(open) => !open && setDeletingUnidade(null)}
        title="Excluir unidade orcamentaria"
        description={`Deseja realmente excluir a unidade "${deletingUnidade?.nome}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deletingUnidade && deleteUnidadeMutation.mutate(deletingUnidade.id)}
        loading={deleteUnidadeMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
