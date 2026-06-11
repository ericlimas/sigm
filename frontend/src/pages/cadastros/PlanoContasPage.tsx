import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
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
import { cn } from "@/lib/utils";
import type { ContaContabil, NaturezaContaContabil } from "@/types/cadastros";

const NATUREZA_LABELS: Record<NaturezaContaContabil, string> = {
  ATIVO: "Ativo",
  PASSIVO: "Passivo",
  PATRIMONIO_LIQUIDO: "Patrimonio Liquido",
  VPA: "VPA",
  VPD: "VPD",
  CONTROLE_DEVEDOR: "Controle Devedor",
  CONTROLE_CREDOR: "Controle Credor",
  ORCAMENTARIA_RECEITA: "Orcamentaria Receita",
  ORCAMENTARIA_DESPESA: "Orcamentaria Despesa",
};

const NONE = "__none__";

const contaSchema = z.object({
  codigo: z.string().min(1, "Informe o codigo"),
  descricao: z.string().min(2, "Informe a descricao"),
  natureza: z.enum([
    "ATIVO",
    "PASSIVO",
    "PATRIMONIO_LIQUIDO",
    "VPA",
    "VPD",
    "CONTROLE_DEVEDOR",
    "CONTROLE_CREDOR",
    "ORCAMENTARIA_RECEITA",
    "ORCAMENTARIA_DESPESA",
  ]),
  classe: z.preprocess((v) => Number(v), z.number().int().min(1).max(8)),
  nivel: z.preprocess((v) => Number(v), z.number().int().min(1)),
  contaPaiId: z.string().optional(),
  aceitaLancamento: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

type ContaFormValues = z.infer<typeof contaSchema>;

const DEFAULT_VALUES: ContaFormValues = {
  codigo: "",
  descricao: "",
  natureza: "ATIVO",
  classe: 1,
  nivel: 1,
  contaPaiId: undefined,
  aceitaLancamento: false,
  ativo: true,
};

function flattenContas(contas: ContaContabil[], depth = 0): { conta: ContaContabil; depth: number }[] {
  const result: { conta: ContaContabil; depth: number }[] = [];
  for (const conta of contas) {
    result.push({ conta, depth });
    if (conta.filhos?.length) result.push(...flattenContas(conta.filhos, depth + 1));
  }
  return result;
}

interface ContaRowProps {
  conta: ContaContabil;
  depth: number;
  podeEditar: boolean;
  podeExcluir: boolean;
  onEdit: (conta: ContaContabil) => void;
  onDelete: (conta: ContaContabil) => void;
  onAddChild: (conta: ContaContabil) => void;
  podeCriar: boolean;
}

function ContaRow({ conta, depth, podeEditar, podeExcluir, onEdit, onDelete, onAddChild, podeCriar }: ContaRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = !!conta.filhos?.length;

  return (
    <>
      <div className="flex items-center gap-1 border-b py-1.5 pr-2 text-xs hover:bg-secondary/50" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
        {hasChildren ? (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="flex h-5 w-5 items-center justify-center text-muted-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block h-5 w-5" />
        )}
        <span className="w-28 shrink-0 font-mono font-medium">{conta.codigo}</span>
        <span className="flex-1 truncate">{conta.descricao}</span>
        <Badge variant="outline" className="w-40 shrink-0 justify-center text-center">
          {NATUREZA_LABELS[conta.natureza]}
        </Badge>
        <span className="w-16 shrink-0 text-center text-muted-foreground">Classe {conta.classe}</span>
        <span className="w-24 shrink-0 text-center">
          {conta.aceitaLancamento ? <Badge variant="success">Lancamento</Badge> : <span className="text-muted-foreground">Sintetica</span>}
        </span>
        <span className="w-20 shrink-0 text-center">
          <Badge variant={conta.ativo ? "success" : "secondary"}>{conta.ativo ? "Ativo" : "Inativo"}</Badge>
        </span>
        <div className="flex w-28 shrink-0 justify-end gap-1">
          {podeCriar && (
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Adicionar conta filha" onClick={() => onAddChild(conta)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(conta)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(conta)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {conta.filhos!.map((filho) => (
            <ContaRow
              key={filho.id}
              conta={filho}
              depth={depth + 1}
              podeEditar={podeEditar}
              podeExcluir={podeExcluir}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              podeCriar={podeCriar}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function PlanoContasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaContabil | null>(null);
  const [deleting, setDeleting] = useState<ContaContabil | null>(null);

  const podeCriar = hasPermissao("PLANO_CONTAS", "CRIAR");
  const podeEditar = hasPermissao("PLANO_CONTAS", "EDITAR");
  const podeExcluir = hasPermissao("PLANO_CONTAS", "EXCLUIR");

  const treeQuery = useQuery({
    queryKey: ["plano-contas", "arvore", search],
    queryFn: async () =>
      (
        await api.get<{ data: ContaContabil[] }>("/plano-contas", {
          params: { arvore: "true", q: search || undefined },
        })
      ).data.data,
  });

  const flatOptions = flattenContas(treeQuery.data ?? []);

  const form = useForm<ContaFormValues>({
    resolver: zodResolver(contaSchema) as unknown as Resolver<ContaFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openCreateChild(pai: ContaContabil) {
    setEditing(null);
    form.reset({ ...DEFAULT_VALUES, contaPaiId: pai.id, classe: pai.classe, nivel: pai.nivel + 1, natureza: pai.natureza });
    setDialogOpen(true);
  }

  function openEdit(conta: ContaContabil) {
    setEditing(conta);
    form.reset({
      codigo: conta.codigo,
      descricao: conta.descricao,
      natureza: conta.natureza,
      classe: conta.classe,
      nivel: conta.nivel,
      contaPaiId: conta.contaPaiId ?? undefined,
      aceitaLancamento: conta.aceitaLancamento,
      ativo: conta.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ContaFormValues) => {
      const payload = { ...values, contaPaiId: values.contaPaiId || null };
      if (editing) return (await api.put(`/plano-contas/${editing.id}`, payload)).data;
      return (await api.post("/plano-contas", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-contas"] });
      toast({ title: editing ? "Conta contabil atualizada" : "Conta contabil criada" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/plano-contas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-contas"] });
      toast({ title: "Conta contabil excluida" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Plano de Contas (PCASP)"
        description="Plano de Contas Aplicado ao Setor Publico - estrutura hierarquica de contas contabeis"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Conta
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por codigo ou descricao..." />
      </div>

      <Card className="overflow-auto">
        <div className="flex items-center gap-1 border-b bg-secondary/50 py-1.5 pr-2 text-[11px] font-semibold uppercase text-muted-foreground" style={{ paddingLeft: "8px" }}>
          <span className="w-5" />
          <span className="w-28 shrink-0">Codigo</span>
          <span className="flex-1">Descricao</span>
          <span className="w-40 shrink-0 text-center">Natureza</span>
          <span className="w-16 shrink-0 text-center">Classe</span>
          <span className="w-24 shrink-0 text-center">Tipo</span>
          <span className="w-20 shrink-0 text-center">Status</span>
          <span className="w-28 shrink-0 text-right">Acoes</span>
        </div>
        {treeQuery.isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (treeQuery.data?.length ?? 0) === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta encontrada</div>
        ) : (
          treeQuery.data!.map((conta) => (
            <ContaRow
              key={conta.id}
              conta={conta}
              depth={0}
              podeEditar={podeEditar}
              podeExcluir={podeExcluir}
              podeCriar={podeCriar}
              onEdit={openEdit}
              onDelete={setDeleting}
              onAddChild={openCreateChild}
            />
          ))
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Conta Contabil" : "Nova Conta Contabil"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codigo" htmlFor="codigo" error={form.formState.errors.codigo?.message}>
                <Input id="codigo" {...form.register("codigo")} />
              </Field>
              <Field label="Natureza" htmlFor="natureza">
                <Controller
                  control={form.control}
                  name="natureza"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as NaturezaContaContabil)}>
                      <SelectTrigger id="natureza">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NATUREZA_LABELS).map(([value, label]) => (
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
            <Field label="Descricao" htmlFor="descricao" error={form.formState.errors.descricao?.message}>
              <Input id="descricao" {...form.register("descricao")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Classe (1-8)" htmlFor="classe" error={form.formState.errors.classe?.message}>
                <Input id="classe" type="number" min={1} max={8} {...form.register("classe")} />
              </Field>
              <Field label="Nivel" htmlFor="nivel" error={form.formState.errors.nivel?.message}>
                <Input id="nivel" type="number" min={1} {...form.register("nivel")} />
              </Field>
            </div>
            <Field label="Conta Pai" htmlFor="contaPaiId">
              <Controller
                control={form.control}
                name="contaPaiId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                    <SelectTrigger id="contaPaiId">
                      <SelectValue placeholder="Nenhuma (conta raiz)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma (conta raiz)</SelectItem>
                      {flatOptions
                        .filter(({ conta }) => conta.id !== editing?.id)
                        .map(({ conta, depth }) => (
                          <SelectItem key={conta.id} value={conta.id}>
                            {"  ".repeat(depth)}
                            {conta.codigo} - {conta.descricao}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="aceitaLancamento"
                  render={({ field }) => <Switch id="aceitaLancamento" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="aceitaLancamento" className={cn(!form.watch("aceitaLancamento") && "text-muted-foreground")}>
                  Aceita lancamento (conta analitica)
                </Label>
              </div>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="ativo"
                  render={({ field }) => <Switch id="ativo" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir conta contabil"
        description={`Deseja realmente excluir a conta "${deleting?.codigo} - ${deleting?.descricao}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
