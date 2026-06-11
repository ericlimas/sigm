import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Landmark, LogOut, KeyRound, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTabsStore } from "@/stores/tabsStore";
import { findLabelForPath } from "@/config/menu";
import { api } from "@/lib/api";
import TopMenuBar from "./TopMenuBar";
import ShortcutBar from "./ShortcutBar";
import TabsBar from "./TabsBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, entidade, perfil, refreshToken, logout } = useAuthStore();
  const { openTab, setActive } = useTabsStore();

  useEffect(() => {
    const title = findLabelForPath(location.pathname);
    openTab({ path: location.pathname, title });
    setActive(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function handleLogout() {
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch {
      // ignora falha ao revogar - efetua logout local de qualquer forma
    } finally {
      logout();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-11 items-center justify-between bg-sidebar px-3 text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-accent-foreground">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">SIGM</p>
            <p className="text-[10px] text-sidebar-foreground/70">{entidade?.nome}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-white/10">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-accent text-[10px] text-accent-foreground">
                  {usuario ? getInitials(usuario.nome) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:flex sm:flex-col sm:items-start sm:leading-tight">
                <span className="font-medium">{usuario?.nome}</span>
                <span className="text-[10px] text-sidebar-foreground/70">{perfil?.nome}</span>
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuLabel>
              <span className="block text-xs font-medium">{usuario?.nome}</span>
              <span className="block text-[11px] font-normal text-muted-foreground">{usuario?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <KeyRound className="mr-2 h-3.5 w-3.5" />
              Trocar senha
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <TopMenuBar />
      <ShortcutBar />
      <TabsBar />

      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
