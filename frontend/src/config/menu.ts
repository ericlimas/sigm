import {
  LayoutDashboard,
  Users,
  Building2,
  Coins,
  BookOpen,
  FileSpreadsheet,
  Banknote,
  Calculator,
  Gavel,
  FileText,
  Handshake,
  Boxes,
  Package,
  Eye,
  ShieldCheck,
  Bot,
  type LucideIcon,
} from "lucide-react";

export interface MenuLeaf {
  path: string;
  label: string;
  modulo: string;
}

export interface MenuGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  modulo?: string;
  items?: MenuLeaf[];
}

export const MENU: MenuGroup[] = [
  {
    key: "dashboard",
    label: "Inicio",
    icon: LayoutDashboard,
    path: "/",
    modulo: "DASHBOARD",
  },
  {
    key: "cadastros",
    label: "Cadastros",
    icon: Users,
    items: [
      { path: "/credores", label: "Credores", modulo: "CREDORES" },
      { path: "/orgaos", label: "Orgaos e Unidades", modulo: "ORGAOS" },
      { path: "/fontes-recurso", label: "Fontes de Recurso", modulo: "FONTES_RECURSO" },
      { path: "/plano-contas", label: "Plano de Contas (PCASP)", modulo: "PLANO_CONTAS" },
      { path: "/naturezas-servico", label: "Naturezas de Servico", modulo: "RETENCOES" },
    ],
  },
  {
    key: "orcamento",
    label: "Orcamento",
    icon: BookOpen,
    items: [
      { path: "/orcamento/ppa", label: "PPA", modulo: "ORCAMENTO" },
      { path: "/orcamento/ldo", label: "LDO", modulo: "ORCAMENTO" },
      { path: "/orcamento/loa", label: "LOA", modulo: "ORCAMENTO" },
      { path: "/orcamento/dotacoes", label: "Dotacoes Orcamentarias", modulo: "ORCAMENTO" },
      { path: "/orcamento/creditos-adicionais", label: "Creditos Adicionais", modulo: "ORCAMENTO" },
    ],
  },
  {
    key: "execucao",
    label: "Execucao",
    icon: FileSpreadsheet,
    items: [
      { path: "/empenhos", label: "Empenhos", modulo: "EMPENHOS" },
      { path: "/liquidacoes", label: "Liquidacoes", modulo: "LIQUIDACOES" },
      { path: "/pagamentos", label: "Pagamentos", modulo: "PAGAMENTOS" },
      { path: "/retencoes", label: "Retencoes (INSS/IRRF)", modulo: "RETENCOES" },
    ],
  },
  {
    key: "tesouraria",
    label: "Tesouraria",
    icon: Banknote,
    items: [
      { path: "/tesouraria/contas", label: "Contas Bancarias", modulo: "TESOURARIA" },
      { path: "/tesouraria/movimentos", label: "Movimentacoes", modulo: "TESOURARIA" },
      { path: "/tesouraria/relatorios", label: "Relatorios de Tesouraria", modulo: "TESOURARIA" },
      { path: "/receitas", label: "Receitas", modulo: "RECEITAS" },
    ],
  },
  {
    key: "contabil",
    label: "Contabil",
    icon: Calculator,
    path: "/contabil",
    modulo: "CONTABIL",
  },
  {
    key: "licitacoes",
    label: "Licitacoes",
    icon: Gavel,
    path: "/licitacoes",
    modulo: "LICITACOES",
  },
  {
    key: "contratos",
    label: "Contratos",
    icon: FileText,
    items: [
      { path: "/contratos", label: "Contratos", modulo: "CONTRATOS" },
      { path: "/convenios", label: "Convenios", modulo: "CONVENIOS" },
    ],
  },
  {
    key: "patrimonio",
    label: "Patrimonio",
    icon: Package,
    items: [
      { path: "/almoxarifado", label: "Almoxarifado", modulo: "ALMOXARIFADO" },
      { path: "/patrimonio", label: "Bens Patrimoniais", modulo: "PATRIMONIO" },
    ],
  },
  {
    key: "transparencia",
    label: "Transparencia",
    icon: Eye,
    path: "/transparencia",
    modulo: "DASHBOARD",
  },
  {
    key: "auditoria",
    label: "Auditoria",
    icon: ShieldCheck,
    path: "/auditoria",
    modulo: "AUDITORIA",
  },
  {
    key: "ia",
    label: "Assistente IA",
    icon: Bot,
    path: "/ia",
    modulo: "IA",
  },
];

export const SHORTCUT_ICONS: { path: string; label: string; icon: LucideIcon; modulo: string }[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, modulo: "DASHBOARD" },
  { path: "/credores", label: "Credores", icon: Users, modulo: "CREDORES" },
  { path: "/orcamento/dotacoes", label: "Dotacoes", icon: Coins, modulo: "ORCAMENTO" },
  { path: "/empenhos", label: "Empenhos", icon: FileSpreadsheet, modulo: "EMPENHOS" },
  { path: "/liquidacoes", label: "Liquidacoes", icon: FileText, modulo: "LIQUIDACOES" },
  { path: "/pagamentos", label: "Pagamentos", icon: Banknote, modulo: "PAGAMENTOS" },
  { path: "/tesouraria/contas", label: "Tesouraria", icon: Building2, modulo: "TESOURARIA" },
  { path: "/contabil", label: "Contabil", icon: Calculator, modulo: "CONTABIL" },
  { path: "/almoxarifado", label: "Almoxarifado", icon: Boxes, modulo: "ALMOXARIFADO" },
  { path: "/contratos", label: "Contratos", icon: Handshake, modulo: "CONTRATOS" },
];

export function findLabelForPath(path: string): string {
  for (const group of MENU) {
    if (group.path === path) return group.label;
    for (const item of group.items ?? []) {
      if (item.path === path) return item.label;
    }
  }
  for (const shortcut of SHORTCUT_ICONS) {
    if (shortcut.path === path) return shortcut.label;
  }
  return path;
}
