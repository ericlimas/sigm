import { Navigate, Route, Routes } from "react-router-dom";
import type { ComponentType } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import FontesRecursoPage from "@/pages/cadastros/FontesRecursoPage";
import CredoresPage from "@/pages/cadastros/CredoresPage";
import OrgaosPage from "@/pages/cadastros/OrgaosPage";
import PlanoContasPage from "@/pages/cadastros/PlanoContasPage";
import NaturezasServicoPage from "@/pages/cadastros/NaturezasServicoPage";
import UsuariosPage from "@/pages/cadastros/UsuariosPage";
import PpaPage from "@/pages/orcamento/PpaPage";
import LdoPage from "@/pages/orcamento/LdoPage";
import LoaPage from "@/pages/orcamento/LoaPage";
import DotacoesPage from "@/pages/orcamento/DotacoesPage";
import CreditosAdicionaisPage from "@/pages/orcamento/CreditosAdicionaisPage";
import EmpenhosPage from "@/pages/execucao/EmpenhosPage";
import LiquidacoesPage from "@/pages/execucao/LiquidacoesPage";
import PagamentosPage from "@/pages/execucao/PagamentosPage";
import RetencoesPage from "@/pages/execucao/RetencoesPage";
import ContasBancariasPage from "@/pages/tesouraria/ContasBancariasPage";
import MovimentosPage from "@/pages/tesouraria/MovimentosPage";
import RelatoriosTesourariaPage from "@/pages/tesouraria/RelatoriosTesourariaPage";
import ReceitasPage from "@/pages/receitas/ReceitasPage";
import ContabilPage from "@/pages/contabil/ContabilPage";
import ContratosPage from "@/pages/contratos/ContratosPage";
import ConveniosPage from "@/pages/contratos/ConveniosPage";
import PatrimonioPage from "@/pages/patrimonio/PatrimonioPage";
import TransparenciaPage from "@/pages/transparencia/TransparenciaPage";
import AuditoriaPage from "@/pages/auditoria/AuditoriaPage";
import IaPage from "@/pages/ia/IaPage";
import { MENU } from "@/config/menu";

const pageOverrides: Record<string, ComponentType> = {
  "/fontes-recurso": FontesRecursoPage,
  "/credores": CredoresPage,
  "/orgaos": OrgaosPage,
  "/plano-contas": PlanoContasPage,
  "/naturezas-servico": NaturezasServicoPage,
  "/usuarios": UsuariosPage,
  "/orcamento/ppa": PpaPage,
  "/orcamento/ldo": LdoPage,
  "/orcamento/loa": LoaPage,
  "/orcamento/dotacoes": DotacoesPage,
  "/orcamento/creditos-adicionais": CreditosAdicionaisPage,
  "/empenhos": EmpenhosPage,
  "/liquidacoes": LiquidacoesPage,
  "/pagamentos": PagamentosPage,
  "/retencoes": RetencoesPage,
  "/tesouraria/contas": ContasBancariasPage,
  "/tesouraria/movimentos": MovimentosPage,
  "/tesouraria/relatorios": RelatoriosTesourariaPage,
  "/receitas": ReceitasPage,
  "/contabil": ContabilPage,
  "/contratos": ContratosPage,
  "/convenios": ConveniosPage,
  "/patrimonio": PatrimonioPage,
  "/transparencia": TransparenciaPage,
  "/auditoria": AuditoriaPage,
  "/ia": IaPage,
};

const placeholderRoutes = MENU.flatMap((group) => {
  const entries: { path: string; title: string }[] = [];
  if (group.path && group.path !== "/") entries.push({ path: group.path, title: group.label });
  for (const item of group.items ?? []) entries.push({ path: item.path, title: item.label });
  return entries;
}).filter((route) => !(route.path in pageOverrides));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          {Object.entries(pageOverrides).map(([path, Component]) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          {placeholderRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={<PlaceholderPage title={route.title} />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
