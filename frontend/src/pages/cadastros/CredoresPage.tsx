import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage, type PaginatedResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataTableColumn } from "@/components/shared/DataTable";
import PaginationBar from "@/components/shared/PaginationBar";
import SearchInput from "@/components/shared/SearchInput";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ClassificacaoCredor, Credor, TipoContaBancaria, TipoPessoa } from "@/types/cadastros";

const CLASSIFICACAO_LABELS: Record<ClassificacaoCredor, string> = {
  SERVIDOR: "Servidor",
  AUTONOMO: "Autonomo",
  FORNECEDOR: "Fornecedor",
  PRESTADOR_SERVICO: "Prestador de Servico",
  OUTROS: "Outros",
};

const TIPO_CONTA_LABELS: Record<TipoContaBancaria, string> = {
  CORRENTE: "Conta Corrente",
  POUPANCA: "Poupanca",
  PAGAMENTO: "Conta Pagamento",
};

const credorSchema = z.object({
  tipoPessoa: z.enum(["FISICA", "JURIDICA"]),
  cpfCnpj: z.string().min(11, "Informe um CPF/CNPJ valido").max(18),
  nome: z.string().min(2, "Informe o nome"),
  nomeFantasia: z.string().optional(),
  classificacao: z.enum(["SERVIDOR", "AUTONOMO", "FORNECEDOR", "PRESTADOR_SERVICO", "OUTROS"]),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().max(2).optional(),
  telefone: z.string().optional(),
  email: z.string().email("Email invalido").optional().or(z.literal("")),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipoConta: z.enum(["CORRENTE", "POUPANCA", "PAGAMENTO"]).optional(),
  chavePix: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  inscricaoMunicipal: z.string().optional(),
  regimeTributario: z.string().optional(),
  dataNascimento: z.string().optional(),
  numeroDependentes: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  ativo: z.boolean().optional(),
});

type CredorFormValues = z.infer<typeof credorSchema>;

const DEFAULT_VALUES: CredorFormValues = {
  tipoPessoa: "FISICA",
  cpfCnpj: "",
  nome: "",
  nomeFantasia: "",
  classificacao: "FORNECEDOR",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "",
  telefone: "",
  email: "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: undefined,
  chavePix: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  regimeTributario: "",
  dataNascimento: "",
  numeroDependentes: 0,
  ativo: true,
};

const NONE = "__none__";

export default function CredoresPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);

  const [search, setSearch] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<string>("ALL");
  const [classificacao, setClassificacao] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Credor | null>(null);
  const [deleting, setDeleting] = useState<Credor | null>(null);

  const podeCriar = hasPermissao("CREDORES", "CRIAR");
  const podeEditar = hasPermissao("CREDORES", "EDITAR");
  const podeExcluir = hasPermissao("CREDORES", "EXCLUIR");

  const listQuery = useQuery({
    queryKey: ["credores", search, tipoPessoa, classificacao, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Credor>>("/credores", {
          params: {
            q: search || undefined,
            tipoPessoa: tipoPessoa !== "ALL" ? tipoPessoa : undefined,
            classificacao: classificacao !== "ALL" ? classificacao : undefined,
            page,
            pageSize: 20,
          },
        })
      ).data,
  });

  const form = useForm<CredorFormValues>({
    resolver: zodResolver(credorSchema) as Resolver<CredorFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  const tipoPessoaForm = form.watch("tipoPessoa");

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  }

  function openEdit(credor: Credor) {
    setEditing(credor);
    form.reset({
      tipoPessoa: credor.tipoPessoa,
      cpfCnpj: credor.cpfCnpj,
      nome: credor.nome,
      nomeFantasia: credor.nomeFantasia ?? "",
      classificacao: credor.classificacao,
      logradouro: credor.logradouro ?? "",
      numero: credor.numero ?? "",
      complemento: credor.complemento ?? "",
      bairro: credor.bairro ?? "",
      cep: credor.cep ?? "",
      municipio: credor.municipio ?? "",
      uf: credor.uf ?? "",
      telefone: credor.telefone ?? "",
      email: credor.email ?? "",
      banco: credor.banco ?? "",
      agencia: credor.agencia ?? "",
      conta: credor.conta ?? "",
      tipoConta: credor.tipoConta ?? undefined,
      chavePix: credor.chavePix ?? "",
      inscricaoEstadual: credor.inscricaoEstadual ?? "",
      inscricaoMunicipal: credor.inscricaoMunicipal ?? "",
      regimeTributario: credor.regimeTributario ?? "",
      dataNascimento: credor.dataNascimento ? credor.dataNascimento.substring(0, 10) : "",
      numeroDependentes: credor.numeroDependentes ?? 0,
      ativo: credor.ativo,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CredorFormValues) => {
      const payload = {
        ...values,
        nomeFantasia: values.nomeFantasia || null,
        logradouro: values.logradouro || null,
        numero: values.numero || null,
        complemento: values.complemento || null,
        bairro: values.bairro || null,
        cep: values.cep || null,
        municipio: values.municipio || null,
        uf: values.uf || null,
        telefone: values.telefone || null,
        email: values.email || "",
        banco: values.banco || null,
        agencia: values.agencia || null,
        conta: values.conta || null,
        tipoConta: values.tipoConta || null,
        chavePix: values.chavePix || null,
        inscricaoEstadual: values.inscricaoEstadual || null,
        inscricaoMunicipal: values.inscricaoMunicipal || null,
        regimeTributario: values.regimeTributario || null,
        dataNascimento: values.dataNascimento || null,
      };
      if (editing) {
        return (await api.put(`/credores/${editing.id}`, payload)).data;
      }
      return (await api.post("/credores", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credores"] });
      toast({ title: editing ? "Credor atualizado" : "Credor criado" });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/credores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credores"] });
      toast({ title: "Credor excluido" });
      setDeleting(null);
    },
    onError: (error) => toast({ title: "Erro ao excluir", description: getErrorMessage(error), variant: "destructive" }),
  });

  const columns: DataTableColumn<Credor>[] = [
    { header: "Nome", cell: (c) => <span className="font-medium">{c.nome}</span> },
    { header: "CPF/CNPJ", cell: (c) => c.cpfCnpj, className: "w-36" },
    {
      header: "Tipo",
      className: "w-20",
      cell: (c) => <Badge variant="outline">{c.tipoPessoa === "FISICA" ? "PF" : "PJ"}</Badge>,
    },
    { header: "Classificacao", cell: (c) => CLASSIFICACAO_LABELS[c.classificacao], className: "w-44" },
    { header: "Municipio/UF", cell: (c) => (c.municipio ? `${c.municipio}/${c.uf ?? "-"}` : "-"), className: "w-36" },
    { header: "Telefone", cell: (c) => c.telefone ?? "-", className: "w-32" },
    {
      header: "Status",
      className: "w-24",
      cell: (c) => <Badge variant={c.ativo ? "success" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      header: "Acoes",
      className: "w-24 text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          {podeEditar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(c)}>
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
        title="Credores"
        description="Cadastro de fornecedores, prestadores de servico, servidores e demais credores"
        actions={
          podeCriar && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Credor
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por nome ou CPF/CNPJ..." />
        <Select value={tipoPessoa} onValueChange={(v) => { setTipoPessoa(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo de pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="FISICA">Pessoa Fisica</SelectItem>
            <SelectItem value="JURIDICA">Pessoa Juridica</SelectItem>
          </SelectContent>
        </Select>
        <Select value={classificacao} onValueChange={(v) => { setClassificacao(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Classificacao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as classificacoes</SelectItem>
            {Object.entries(CLASSIFICACAO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-auto">
        <DataTable columns={columns} data={listQuery.data?.data ?? []} isLoading={listQuery.isLoading} getRowId={(c) => c.id} />
        {listQuery.data && <PaginationBar meta={listQuery.data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Credor" : "Novo Credor"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <Tabs defaultValue="geral">
              <TabsList>
                <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
                <TabsTrigger value="endereco">Endereco</TabsTrigger>
                <TabsTrigger value="bancario">Dados Bancarios</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal / Previdenciario</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tipo de Pessoa" htmlFor="tipoPessoa">
                    <Controller
                      control={form.control}
                      name="tipoPessoa"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v as TipoPessoa)}>
                          <SelectTrigger id="tipoPessoa">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FISICA">Pessoa Fisica</SelectItem>
                            <SelectItem value="JURIDICA">Pessoa Juridica</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field label={tipoPessoaForm === "FISICA" ? "CPF" : "CNPJ"} htmlFor="cpfCnpj" error={form.formState.errors.cpfCnpj?.message} className="col-span-2">
                    <Input id="cpfCnpj" {...form.register("cpfCnpj")} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome / Razao Social" htmlFor="nome" error={form.formState.errors.nome?.message}>
                    <Input id="nome" {...form.register("nome")} />
                  </Field>
                  <Field label="Nome Fantasia" htmlFor="nomeFantasia">
                    <Input id="nomeFantasia" {...form.register("nomeFantasia")} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Classificacao" htmlFor="classificacao">
                    <Controller
                      control={form.control}
                      name="classificacao"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v as ClassificacaoCredor)}>
                          <SelectTrigger id="classificacao">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CLASSIFICACAO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field label="Telefone" htmlFor="telefone">
                    <Input id="telefone" {...form.register("telefone")} />
                  </Field>
                  <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
                    <Input id="email" type="email" {...form.register("email")} />
                  </Field>
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
              </TabsContent>

              <TabsContent value="endereco" className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <Field label="CEP" htmlFor="cep" className="col-span-1">
                    <Input id="cep" {...form.register("cep")} />
                  </Field>
                  <Field label="Logradouro" htmlFor="logradouro" className="col-span-2">
                    <Input id="logradouro" {...form.register("logradouro")} />
                  </Field>
                  <Field label="Numero" htmlFor="numero" className="col-span-1">
                    <Input id="numero" {...form.register("numero")} />
                  </Field>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="Complemento" htmlFor="complemento" className="col-span-2">
                    <Input id="complemento" {...form.register("complemento")} />
                  </Field>
                  <Field label="Bairro" htmlFor="bairro" className="col-span-2">
                    <Input id="bairro" {...form.register("bairro")} />
                  </Field>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="Municipio" htmlFor="municipio" className="col-span-3">
                    <Input id="municipio" {...form.register("municipio")} />
                  </Field>
                  <Field label="UF" htmlFor="uf">
                    <Input id="uf" maxLength={2} {...form.register("uf")} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="bancario" className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Banco" htmlFor="banco">
                    <Input id="banco" {...form.register("banco")} />
                  </Field>
                  <Field label="Agencia" htmlFor="agencia">
                    <Input id="agencia" {...form.register("agencia")} />
                  </Field>
                  <Field label="Conta" htmlFor="conta">
                    <Input id="conta" {...form.register("conta")} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo de Conta" htmlFor="tipoConta">
                    <Controller
                      control={form.control}
                      name="tipoConta"
                      render={({ field }) => (
                        <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : (v as TipoContaBancaria))}>
                          <SelectTrigger id="tipoConta">
                            <SelectValue placeholder="Nao informado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Nao informado</SelectItem>
                            {Object.entries(TIPO_CONTA_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field label="Chave PIX" htmlFor="chavePix">
                    <Input id="chavePix" {...form.register("chavePix")} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="fiscal" className="space-y-3">
                {tipoPessoaForm === "JURIDICA" ? (
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Inscricao Estadual" htmlFor="inscricaoEstadual">
                      <Input id="inscricaoEstadual" {...form.register("inscricaoEstadual")} />
                    </Field>
                    <Field label="Inscricao Municipal" htmlFor="inscricaoMunicipal">
                      <Input id="inscricaoMunicipal" {...form.register("inscricaoMunicipal")} />
                    </Field>
                    <Field label="Regime Tributario" htmlFor="regimeTributario">
                      <Input id="regimeTributario" {...form.register("regimeTributario")} />
                    </Field>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data de Nascimento" htmlFor="dataNascimento">
                      <Input id="dataNascimento" type="date" {...form.register("dataNascimento")} />
                    </Field>
                    <Field label="Numero de Dependentes" htmlFor="numeroDependentes">
                      <Input id="numeroDependentes" type="number" min={0} {...form.register("numeroDependentes")} />
                    </Field>
                  </div>
                )}
              </TabsContent>
            </Tabs>

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
        title="Excluir credor"
        description={`Deseja realmente excluir o credor "${deleting?.nome}"? Esta acao realiza exclusao logica.`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Excluir"
      />
    </div>
  );
}
