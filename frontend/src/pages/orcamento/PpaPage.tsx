import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Ppa, PpaAcao, PpaPrograma, TipoAcaoPpa } from "@/types/orcamento";

const TIPO_ACAO_LABELS: Record<TipoAcaoPpa, string> = {
  PROJETO: "Projeto",
  ATIVIDADE: "Atividade",
  OPERACAO_ESPECIAL: "Operacao Especial",
};

const ppaSchema = z.object({
  anoInicio: z.preprocess((v) => Number(v), z.number().int().min(2000)),
  anoFim: z.preprocess((v) => Number(v), z.number().int().min(2000)),
  lei: z.string().optional(),
  dataAprovacao: z.string().optional(),
  ativo: z.boolean().optional(),
});
type PpaFormValues = z.infer<typeof ppaSchema>;

const programaSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  nome: z.string().min(2, "Informe o nome"),
  objetivo: z.string().optional(),
  ativo: z.boolean().optional(),
});
type ProgramaFormValues = z.infer<typeof programaSchema>;

const acaoSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  nome: z.string().min(2, "Informe o nome"),
  tipo: z.enum(["PROJETO", "ATIVIDADE", "OPERACAO_ESPECIAL"]),
  metaFisica: z.string().optional(),
  unidadeMedida: z.string().optional(),
  ativo: z.boolean().optional(),
});
type AcaoFormValues = z.infer<typeof acaoSchema>;

export default function PpaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const podeCriar = hasPermissao("ORCAMENTO", "CRIAR");
  const podeEditar = hasPermissao("ORCAMENTO", "EDITAR");

  const [selectedPpa, setSelectedPpa] = useState<Ppa | null>(null);
  const [selectedPrograma, setSelectedPrograma] = useState<PpaPrograma | null>(null);

  const [ppaDialogOpen, setPpaDialogOpen] = useState(false);
  const [editingPpa, setEditingPpa] = useState<Ppa | null>(null);

  const [programaDialogOpen, setProgramaDialogOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<PpaPrograma | null>(null);

  const [acaoDialogOpen, setAcaoDialogOpen] = useState(false);
  const [editingAcao, setEditingAcao] = useState<PpaAcao | null>(null);

  const ppasQuery = useQuery({
    queryKey: ["ppas"],
    queryFn: async () => (await api.get<{ data: Ppa[] }>("/orcamento/ppa")).data.data,
  });

  // mantem a selecao sincronizada com os dados atualizados
  const currentPpa = ppasQuery.data?.find((p) => p.id === selectedPpa?.id) ?? null;
  const currentPrograma = currentPpa?.programas?.find((p) => p.id === selectedPrograma?.id) ?? null;

  const ppaForm = useForm<PpaFormValues>({
    resolver: zodResolver(ppaSchema) as Resolver<PpaFormValues>,
    defaultValues: { anoInicio: new Date().getFullYear(), anoFim: new Date().getFullYear() + 3, lei: "", dataAprovacao: "", ativo: true },
  });

  function openCreatePpa() {
    setEditingPpa(null);
    ppaForm.reset({ anoInicio: new Date().getFullYear(), anoFim: new Date().getFullYear() + 3, lei: "", dataAprovacao: "", ativo: true });
    setPpaDialogOpen(true);
  }

  function openEditPpa(ppa: Ppa) {
    setEditingPpa(ppa);
    ppaForm.reset({
      anoInicio: ppa.anoInicio,
      anoFim: ppa.anoFim,
      lei: ppa.lei ?? "",
      dataAprovacao: ppa.dataAprovacao ? ppa.dataAprovacao.substring(0, 10) : "",
      ativo: ppa.ativo,
    });
    setPpaDialogOpen(true);
  }

  const savePpaMutation = useMutation({
    mutationFn: async (values: PpaFormValues) => {
      const payload = { ...values, lei: values.lei || null, dataAprovacao: values.dataAprovacao || null };
      if (editingPpa) return (await api.put(`/orcamento/ppa/${editingPpa.id}`, payload)).data;
      return (await api.post("/orcamento/ppa", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppas"] });
      toast({ title: editingPpa ? "PPA atualizado" : "PPA criado" });
      setPpaDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const programaForm = useForm<ProgramaFormValues>({
    resolver: zodResolver(programaSchema),
    defaultValues: { codigo: "", nome: "", objetivo: "", ativo: true },
  });

  function openCreatePrograma() {
    setEditingPrograma(null);
    programaForm.reset({ codigo: "", nome: "", objetivo: "", ativo: true });
    setProgramaDialogOpen(true);
  }

  function openEditPrograma(programa: PpaPrograma) {
    setEditingPrograma(programa);
    programaForm.reset({ codigo: programa.codigo, nome: programa.nome, objetivo: programa.objetivo ?? "", ativo: programa.ativo });
    setProgramaDialogOpen(true);
  }

  const saveProgramaMutation = useMutation({
    mutationFn: async (values: ProgramaFormValues) => {
      const payload = { ...values, objetivo: values.objetivo || null };
      if (editingPrograma) return (await api.put(`/orcamento/ppa/programas/${editingPrograma.id}`, payload)).data;
      return (await api.post(`/orcamento/ppa/${selectedPpa?.id}/programas`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppas"] });
      toast({ title: editingPrograma ? "Programa atualizado" : "Programa criado" });
      setProgramaDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const acaoForm = useForm<AcaoFormValues>({
    resolver: zodResolver(acaoSchema),
    defaultValues: { codigo: "", nome: "", tipo: "ATIVIDADE", metaFisica: "", unidadeMedida: "", ativo: true },
  });

  function openCreateAcao() {
    setEditingAcao(null);
    acaoForm.reset({ codigo: "", nome: "", tipo: "ATIVIDADE", metaFisica: "", unidadeMedida: "", ativo: true });
    setAcaoDialogOpen(true);
  }

  function openEditAcao(acao: PpaAcao) {
    setEditingAcao(acao);
    acaoForm.reset({
      codigo: acao.codigo,
      nome: acao.nome,
      tipo: acao.tipo,
      metaFisica: acao.metaFisica ?? "",
      unidadeMedida: acao.unidadeMedida ?? "",
      ativo: acao.ativo,
    });
    setAcaoDialogOpen(true);
  }

  const saveAcaoMutation = useMutation({
    mutationFn: async (values: AcaoFormValues) => {
      const payload = { ...values, metaFisica: values.metaFisica || null, unidadeMedida: values.unidadeMedida || null };
      if (editingAcao) return (await api.put(`/orcamento/ppa/acoes/${editingAcao.id}`, payload)).data;
      return (await api.post(`/orcamento/ppa/programas/${selectedPrograma?.id}/acoes`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppas"] });
      toast({ title: editingAcao ? "Acao atualizada" : "Acao criada" });
      setAcaoDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const ppaColumns: DataTableColumn<Ppa>[] = [
    { header: "Periodo", cell: (p) => <span className="font-medium">{p.anoInicio} - {p.anoFim}</span>, className: "w-32" },
    { header: "Lei", cell: (p) => p.lei ?? "-" },
    { header: "Data Aprovacao", cell: (p) => (p.dataAprovacao ? new Date(p.dataAprovacao).toLocaleDateString("pt-BR") : "-"), className: "w-36" },
    { header: "Programas", cell: (p) => p.programas?.length ?? 0, className: "w-24 text-center" },
    {
      header: "Status",
      className: "w-24",
      cell: (p) => <Badge variant={p.ativo ? "success" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-16 text-right",
      cell: (p) => (
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditPpa(p); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      ),
    },
  ];

  const programaColumns: DataTableColumn<PpaPrograma>[] = [
    { header: "Codigo", cell: (p) => <span className="font-medium">{p.codigo}</span>, className: "w-24" },
    { header: "Nome", cell: (p) => p.nome },
    { header: "Objetivo", cell: (p) => p.objetivo ?? "-" },
    { header: "Acoes (qtd)", cell: (p) => p.acoes?.length ?? 0, className: "w-24 text-center" },
    {
      header: "Status",
      className: "w-24",
      cell: (p) => <Badge variant={p.ativo ? "success" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "",
      className: "w-16 text-right",
      cell: (p) => (
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditPrograma(p); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      ),
    },
  ];

  const acaoColumns: DataTableColumn<PpaAcao>[] = [
    { header: "Codigo", cell: (a) => <span className="font-medium">{a.codigo}</span>, className: "w-24" },
    { header: "Nome", cell: (a) => a.nome },
    { header: "Tipo", cell: (a) => TIPO_ACAO_LABELS[a.tipo], className: "w-40" },
    { header: "Meta Fisica", cell: (a) => a.metaFisica ?? "-", className: "w-32" },
    { header: "Unidade", cell: (a) => a.unidadeMedida ?? "-", className: "w-24" },
    {
      header: "Status",
      className: "w-24",
      cell: (a) => <Badge variant={a.ativo ? "success" : "secondary"}>{a.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "",
      className: "w-16 text-right",
      cell: (a) => (
        podeEditar && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAcao(a)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      ),
    },
  ];

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Plano Plurianual (PPA)"
        description="Planejamento de medio prazo: programas e acoes governamentais por quadrienio"
        actions={
          podeCriar && (
            <Button onClick={openCreatePpa}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo PPA
            </Button>
          )
        }
      />

      <Card className="overflow-auto">
        <DataTable
          columns={ppaColumns}
          data={ppasQuery.data ?? []}
          isLoading={ppasQuery.isLoading}
          getRowId={(p) => p.id}
          onRowClick={(p) => { setSelectedPpa(p); setSelectedPrograma(null); }}
        />
      </Card>

      {currentPpa && (
        <Card className="overflow-auto">
          <div className="p-3 pb-0">
            <PageHeader
              title={`Programas - PPA ${currentPpa.anoInicio}-${currentPpa.anoFim}`}
              actions={
                podeCriar && (
                  <Button size="sm" onClick={openCreatePrograma}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Novo Programa
                  </Button>
                )
              }
            />
          </div>
          <DataTable
            columns={programaColumns}
            data={currentPpa.programas ?? []}
            getRowId={(p) => p.id}
            onRowClick={(p) => setSelectedPrograma(p)}
            emptyMessage="Nenhum programa cadastrado"
          />
        </Card>
      )}

      {currentPrograma && (
        <Card className="overflow-auto">
          <div className="p-3 pb-0">
            <PageHeader
              title={`Acoes - ${currentPrograma.codigo} ${currentPrograma.nome}`}
              actions={
                podeCriar && (
                  <Button size="sm" onClick={openCreateAcao}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nova Acao
                  </Button>
                )
              }
            />
          </div>
          <DataTable columns={acaoColumns} data={currentPrograma.acoes ?? []} getRowId={(a) => a.id} emptyMessage="Nenhuma acao cadastrada" />
        </Card>
      )}

      <Dialog open={ppaDialogOpen} onOpenChange={setPpaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPpa ? "Editar PPA" : "Novo PPA"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={ppaForm.handleSubmit((values) => savePpaMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ano Inicio" htmlFor="anoInicio" error={ppaForm.formState.errors.anoInicio?.message}>
                <Input id="anoInicio" type="number" {...ppaForm.register("anoInicio")} />
              </Field>
              <Field label="Ano Fim" htmlFor="anoFim" error={ppaForm.formState.errors.anoFim?.message}>
                <Input id="anoFim" type="number" {...ppaForm.register("anoFim")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lei" htmlFor="lei">
                <Input id="lei" {...ppaForm.register("lei")} />
              </Field>
              <Field label="Data Aprovacao" htmlFor="dataAprovacao">
                <Input id="dataAprovacao" type="date" {...ppaForm.register("dataAprovacao")} />
              </Field>
            </div>
            {editingPpa && (
              <div className="flex items-center gap-2">
                <Controller control={ppaForm.control} name="ativo" render={({ field }) => <Switch id="ativoPpa" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="ativoPpa">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPpaDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savePpaMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={programaDialogOpen} onOpenChange={setProgramaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPrograma ? "Editar Programa" : "Novo Programa"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={programaForm.handleSubmit((values) => saveProgramaMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Codigo" htmlFor="codigoPrograma" error={programaForm.formState.errors.codigo?.message}>
                <Input id="codigoPrograma" {...programaForm.register("codigo")} />
              </Field>
              <Field label="Nome" htmlFor="nomePrograma" className="col-span-2" error={programaForm.formState.errors.nome?.message}>
                <Input id="nomePrograma" {...programaForm.register("nome")} />
              </Field>
            </div>
            <Field label="Objetivo" htmlFor="objetivo">
              <Textarea id="objetivo" rows={3} {...programaForm.register("objetivo")} />
            </Field>
            {editingPrograma && (
              <div className="flex items-center gap-2">
                <Controller control={programaForm.control} name="ativo" render={({ field }) => <Switch id="ativoPrograma" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="ativoPrograma">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProgramaDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveProgramaMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={acaoDialogOpen} onOpenChange={setAcaoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAcao ? "Editar Acao" : "Nova Acao"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={acaoForm.handleSubmit((values) => saveAcaoMutation.mutate(values))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Codigo" htmlFor="codigoAcao" error={acaoForm.formState.errors.codigo?.message}>
                <Input id="codigoAcao" {...acaoForm.register("codigo")} />
              </Field>
              <Field label="Nome" htmlFor="nomeAcao" className="col-span-2" error={acaoForm.formState.errors.nome?.message}>
                <Input id="nomeAcao" {...acaoForm.register("nome")} />
              </Field>
            </div>
            <Field label="Tipo" htmlFor="tipoAcao">
              <Controller
                control={acaoForm.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoAcaoPpa)}>
                    <SelectTrigger id="tipoAcao">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_ACAO_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meta Fisica" htmlFor="metaFisica">
                <Input id="metaFisica" {...acaoForm.register("metaFisica")} />
              </Field>
              <Field label="Unidade de Medida" htmlFor="unidadeMedida">
                <Input id="unidadeMedida" {...acaoForm.register("unidadeMedida")} />
              </Field>
            </div>
            {editingAcao && (
              <div className="flex items-center gap-2">
                <Controller control={acaoForm.control} name="ativo" render={({ field }) => <Switch id="ativoAcao" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="ativoAcao">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAcaoDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveAcaoMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
