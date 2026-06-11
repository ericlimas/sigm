import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import Field from "@/components/shared/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntidadeConfiguracao } from "@/types/usuarios";

const DEFAULT_VALUES: EntidadeConfiguracao = {
  ordenadorNome: "",
  ordenadorCpf: "",
  ordenadorCargo: "",
  contadorNome: "",
  contadorDocumento: "",
  contadorCargo: "",
  diretorFinanceiroNome: "",
  diretorFinanceiroCpf: "",
  diretorFinanceiroCargo: "",
};

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasPermissao = useAuthStore((s) => s.hasPermissao);
  const podeEditar = hasPermissao("USUARIOS", "EDITAR");

  const configQuery = useQuery({
    queryKey: ["entidade", "configuracao"],
    queryFn: async () => (await api.get<EntidadeConfiguracao>("/entidade/configuracao")).data,
  });

  const form = useForm<EntidadeConfiguracao>({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (configQuery.data) {
      form.reset({
        ordenadorNome: configQuery.data.ordenadorNome ?? "",
        ordenadorCpf: configQuery.data.ordenadorCpf ?? "",
        ordenadorCargo: configQuery.data.ordenadorCargo ?? "",
        contadorNome: configQuery.data.contadorNome ?? "",
        contadorDocumento: configQuery.data.contadorDocumento ?? "",
        contadorCargo: configQuery.data.contadorCargo ?? "",
        diretorFinanceiroNome: configQuery.data.diretorFinanceiroNome ?? "",
        diretorFinanceiroCpf: configQuery.data.diretorFinanceiroCpf ?? "",
        diretorFinanceiroCargo: configQuery.data.diretorFinanceiroCargo ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (values: EntidadeConfiguracao) => (await api.put("/entidade/configuracao", values)).data,
    onSuccess: (data: EntidadeConfiguracao) => {
      queryClient.setQueryData(["entidade", "configuracao"], data);
      toast({ title: "Configuracoes salvas" });
    },
    onError: (error) => toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" }),
  });

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="Configuracoes"
        description="Responsaveis impressos na Nota de Empenho (Ordenador da Despesa, Contador e Diretor Financeiro)"
      />

      <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ordenador da Despesa</CardTitle>
            <CardDescription>Responsavel que autoriza a emissao do empenho</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Nome" htmlFor="ordenadorNome">
              <Input id="ordenadorNome" disabled={!podeEditar} {...form.register("ordenadorNome")} />
            </Field>
            <Field label="CPF" htmlFor="ordenadorCpf">
              <Input id="ordenadorCpf" disabled={!podeEditar} {...form.register("ordenadorCpf")} />
            </Field>
            <Field label="Cargo" htmlFor="ordenadorCargo">
              <Input id="ordenadorCargo" placeholder="Ex: Presidente" disabled={!podeEditar} {...form.register("ordenadorCargo")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contador(a)/Contabilista</CardTitle>
            <CardDescription>Responsavel pela contabilizacao do saldo da dotacao</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Nome" htmlFor="contadorNome">
              <Input id="contadorNome" disabled={!podeEditar} {...form.register("contadorNome")} />
            </Field>
            <Field label="CRC" htmlFor="contadorDocumento">
              <Input id="contadorDocumento" placeholder="Ex: 59512/O-9" disabled={!podeEditar} {...form.register("contadorDocumento")} />
            </Field>
            <Field label="Cargo" htmlFor="contadorCargo">
              <Input id="contadorCargo" placeholder="Ex: Contador" disabled={!podeEditar} {...form.register("contadorCargo")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Diretor Financeiro</CardTitle>
            <CardDescription>Responsavel financeiro da entidade</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Nome" htmlFor="diretorFinanceiroNome">
              <Input id="diretorFinanceiroNome" disabled={!podeEditar} {...form.register("diretorFinanceiroNome")} />
            </Field>
            <Field label="CPF" htmlFor="diretorFinanceiroCpf">
              <Input id="diretorFinanceiroCpf" disabled={!podeEditar} {...form.register("diretorFinanceiroCpf")} />
            </Field>
            <Field label="Cargo" htmlFor="diretorFinanceiroCargo">
              <Input id="diretorFinanceiroCargo" placeholder="Ex: Diretor Financeiro" disabled={!podeEditar} {...form.register("diretorFinanceiroCargo")} />
            </Field>
          </CardContent>
        </Card>

        {podeEditar && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending || configQuery.isLoading}>
              Salvar
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
