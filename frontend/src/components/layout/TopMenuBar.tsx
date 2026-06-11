import { Link, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { MENU } from "@/config/menu";
import { useAuthStore } from "@/stores/authStore";
import { useTabsStore } from "@/stores/tabsStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function TopMenuBar() {
  const hasPermissao = useAuthStore((s) => s.hasPermissao);
  const navigate = useNavigate();
  const openTab = useTabsStore((s) => s.openTab);

  function go(path: string, title: string) {
    openTab({ path, title });
    navigate(path);
  }

  return (
    <nav className="flex h-9 items-center gap-1 border-b border-sidebar-border/40 bg-sidebar px-2 text-sidebar-foreground">
      {MENU.map((group) => {
        if (group.path) {
          if (group.modulo && !hasPermissao(group.modulo, "VISUALIZAR")) return null;
          return (
            <Link
              key={group.key}
              to={group.path}
              onClick={() => openTab({ path: group.path!, title: group.label })}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium hover:bg-white/10"
              )}
            >
              <group.icon className="h-3.5 w-3.5" />
              {group.label}
            </Link>
          );
        }

        const items = (group.items ?? []).filter((item) => hasPermissao(item.modulo, "VISUALIZAR"));
        if (items.length === 0) return null;

        return (
          <DropdownMenu key={group.key}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium hover:bg-white/10 focus:outline-none"
              >
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              {items.map((item) => (
                <DropdownMenuItem key={item.path} onSelect={() => go(item.path, item.label)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
