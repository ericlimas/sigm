import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Ldo, LdoMetaFiscal, LdoPrioridade } from "@/types/orcamento";

const ldoSchema = z.object({
  exercicio: z.preprocess((v) => Number(v), z.number().int().min(2000)),
  lei: z.string().optional(),
  dataAprovacao: z.string().optional(),
  ativo: z.boolean().optional(),
});
type LdoFormValues = z.infer<typeof ldoSchema>;

const metaSchema = z.object({
  ano: z.preprocess((v) => Number(v), z.number().int().min(2000)),
  descricao: z.string().min(2, "Informe a descricao"),
  valorPrevisto: z.preprocess((v) => Number(v), z.number()),
});
type MetaFormValues = z.infer<typeof metaSchema>;

const prioridadeSchema = z.object({
  ordem: z.preprocess((v) => Number(v), z.number().int().min(1)),
  descricao: z.string().min(2, "Informe a descricao"),
});
type PrioridadeFormValues = z.infer<typeof prioridadeSchema>;

export default function LdoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("ORCAMENTO", "CRIAR");
  const podeEditar = hasPermissao("ORCAMENTO", "EDITAR");

  const [selectedLdo, setSelectedLdo] = useState<Ldo | null>(null);
  const [ldoDialogOpen, setLdoDialogOpen] = useState(false);
  const [editingLdo, setEditingLdo] = useState<Ldo | null>(null);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [prioridadeDialogOpen, setPrioridadeDialogOpen] = useState(false);

  const ldosQuery = useQuery({
    queryKey: ["ldos"],
    queryFn: async () => (await api.get<{ data: Ldo[] }>("/orcamento/ldo")).data.data,
  });

  const currentLdo = ldosQuery.data?.find((l) => l.id === selectedLdo?.id) ?? null;

  const ldoForm = useForm<LdoFormValues>({
    resolver: zodResolver(ldoSchema) as Resolver<LdoFormValues>,
    defaultValues: { exercicio: new Date().getFullYear(), lei: "", dataAprovacao: "", ativo: true },
  });

  function openCreateLdo() {
    setEditingLdo(null);
    ldoForm.reset({ exercicio: new Date().getFullYear(), lei: "", dataAprovacao: "", ativo: true });
    setLdoDialogOpen(true);
  }

  function openEditLdo(ldo: Ldo) {
    setEditingLdo(ldo);
    ldoForm.reset({
      exercicio: ldo.exercicio,
      lei: ldo.lei ?? "",
      dataAprovacao: ldo.dataAprovacao ? ldo.dataAprovacao.substring(0, 10) : "",
      ativo: ldo.ativo,
    });
    setLdoDialogOpen(true);
  }

  const saveLdoMutation = useMutation({
    mutationFn: async (values: LdoFormValues) => {
      const payload = { ...values, lei: values.lei || null, dataAprovacao: values.dataAprovacao || null };
      if (editingLdo) return (await api.put(`/orcamento/ldo/${editingLdo.id}`, payload)).data;
      return (await api.post("/orcamento/ldo", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ldos"] });
      toast({ title: editingLdo ? "LDO atualizada" : "LDO criada" });
      setLdoDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const metaForm = useForm<MetaFormValues>({
    resolver: zodResolver(metaSchema) as Resolver<MetaFormValues>,
    defaultValues: { ano: new Date().getFullYear(), descricao: "", valorPrevisto: 0 },
  });

  const saveMetaMutation = useMutation({
    mutationFn: async (values: MetaFormValues) => (await api.post(`/orcamento/ldo/${selectedLdo?.id}/metas-fiscais`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ldos"] });
      toast({ title: "Meta fiscal adicionada" });
      setMetaDialogOpen(false);
      metaForm.reset({ ano: new Date().getFullYear(), descricao: "", valorPrevisto: 0 });
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const prioridadeForm = useForm<PrioridadeFormValues>({
    resolver: zodResolver(prioridadeSchema) as Resolver<PrioridadeFormValues>,
    defaultValues: { ordem: 1, descricao: "" },
  });

  const savePrioridadeMutation = useMutation({
    mutationFn: async (values: PrioridadeFormValues) => (await api.post(`/orcamento/ldo/${selectedLdo?.id}/prioridades`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ldos"] });
      toast({ title: "Prioridade adicionada" });
      setPrioridadeDialogOpen(false);
      prioridadeForm.reset({ ordem: 1, descricao: "" });
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const ldoColumns: DataTableColumn<Ldo>[] = [
    { header: "Exercicio", cell: (l) => <span className="font-medium">{l.exercicio}</span>, className: "w-24" },
    { header: "Lei", cell: (l) => l.lei ?? "-" },
    { header: "Data Aprovacao", cell: (l) => formatDate(l.dataAprovacao), className: "w-36" },
    { header: "Metas Fiscais", cell: (l) => l.metasFiscais?.length ?? 0, className: "w-28 text-center" },
    { header: "Prioridades", cell: (l) => l.prioridades?.length ?? 0, className: "w-28 text-center" },
    {
      header: "Status",
      className: "w-24",
      cell: (l) => <Badge variant={l.ativo ? "success" : "secondary"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "",
      className: "w-16 text-right",
      cell: (l) => (
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditLdo(l); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      ),
    },
  ];

  const metaColumns: DataTableColumn<LdoMetaFiscal>[] = [
    { header: "Ano", cell: (m) => m.ano, className: "w-20" },
    { header: "Descricao", cell: (m) => m.descricao },
    { header: "Valor Previsto", cell: (m) => formatCurrency(m.valorPrevisto), className: "w-40 text-right" },
  ];

  const prioridadeColumns: DataTableColumn<LdoPrioridade>[] = [
    { header: "Ordem", cell: (p) => p.ordem, className: "w-20" },
    { header: "Descricao", cell: (p) => p.descricao },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Lei de Diretrizes Orcamentarias (LDO)"
        description="Metas fiscais e prioridades de governo para o exercicio"
        actions={
          podeCriar && (
            <Button onClick={openCreateLdo}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova LDO
            </Button>
          )
        }
      />

      <Card className="overflow-auto">
        <DataTable columns={ldoColumns} data={ldosQuery.data ?? []} isLoading={ldosQuery.isLoading} getRowId={(l) => l.id} onRowClick={setSelectedLdo} />
      </Card>

      {currentLdo && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="overflow-auto">
            <div className="p-3 pb-0">
              <PageHeader
                title={`Metas Fiscais - LDO ${currentLdo.exercicio}`}
                actions={
                  podeCriar && (
                    <Button size="sm" onClick={() => setMetaDialogOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Nova Meta
                    </Button>
                  )
                }
              />
            </div>
            <DataTable columns={metaColumns} data={currentLdo.metasFiscais ?? []} getRowId={(m) => m.id} emptyMessage="Nenhuma meta fiscal cadastrada" />
          </Card>

          <Card className="overflow-auto">
            <div className="p-3 pb-0">
              <PageHeader
                title="Prioridades"
                actions={
                  podeCriar && (
                    <Button size="sm" onClick={() => setPrioridadeDialogOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Nova Prioridade
                    </Button>
                  )
                }
              />
            </div>
            <DataTable columns={prioridadeColumns} data={currentLdo.prioridades ?? []} getRowId={(p) => p.id} emptyMessage="Nenhuma prioridade cadastrada" />
          </Card>
        </div>
      )}

      <Dialog open={ldoDialogOpen} onOpenChange={setLdoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLdo ? "Editar LDO" : "Nova LDO"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={ldoForm.handleSubmit((values) => saveLdoMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Exercicio" htmlFor="exercicio" error={ldoForm.formState.errors.exercicio?.message}>
                <Input id="exercicio" type="number" {...ldoForm.register("exercicio")} />
              </Field>
              <Field label="Data Aprovacao" htmlFor="dataAprovacao">
                <Input id="dataAprovacao" type="date" {...ldoForm.register("dataAprovacao")} />
              </Field>
            </div>
            <Field label="Lei" htmlFor="lei">
              <Input id="lei" {...ldoForm.register("lei")} />
            </Field>
            {editingLdo && (
              <div className="flex items-center gap-2">
                <Controller control={ldoForm.control} name="ativo" render={({ field }) => <Switch id="ativoLdo" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="ativoLdo">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLdoDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveLdoMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Meta Fiscal</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={metaForm.handleSubmit((values) => saveMetaMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ano" htmlFor="ano" error={metaForm.formState.errors.ano?.message}>
                <Input id="ano" type="number" {...metaForm.register("ano")} />
              </Field>
              <Field label="Valor Previsto" htmlFor="valorPrevisto" error={metaForm.formState.errors.valorPrevisto?.message}>
                <Input id="valorPrevisto" type="number" step="0.01" {...metaForm.register("valorPrevisto")} />
              </Field>
            </div>
            <Field label="Descricao" htmlFor="descricaoMeta" error={metaForm.formState.errors.descricao?.message}>
              <Input id="descricaoMeta" {...metaForm.register("descricao")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMetaDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMetaMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={prioridadeDialogOpen} onOpenChange={setPrioridadeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Prioridade</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={prioridadeForm.handleSubmit((values) => savePrioridadeMutation.mutate(values))}>
            <Field label="Ordem" htmlFor="ordem" error={prioridadeForm.formState.errors.ordem?.message}>
              <Input id="ordem" type="number" min={1} {...prioridadeForm.register("ordem")} />
            </Field>
            <Field label="Descricao" htmlFor="descricaoPrioridade" error={prioridadeForm.formState.errors.descricao?.message}>
              <Input id="descricaoPrioridade" {...prioridadeForm.register("descricao")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPrioridadeDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savePrioridadeMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
