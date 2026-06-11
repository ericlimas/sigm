import { useNavigate } from "react-router-dom";
import { SHORTCUT_ICONS } from "@/config/menu";
import { useAuthStore } from "@/stores/authStore";
import { useTabsStore } from "@/stores/tabsStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function ShortcutBar() {
  const hasPermissao = useAuthStore((s) => s.hasPermissao);
  const activePath = useTabsStore((s) => s.activePath);
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();

  const items = SHORTCUT_ICONS.filter((item) => hasPermissao(item.modulo, "VISUALIZAR"));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-11 items-center gap-1 overflow-x-auto border-b bg-card px-2">
        {items.map((item) => {
          const active = activePath === item.path;
          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    openTab({ path: item.path, title: item.label });
                    navigate(item.path);
                  }}
                  className={cn(
                    "flex h-9 w-12 flex-col items-center justify-center gap-0.5 rounded-sm text-[10px] text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground",
                    active && "bg-accent/15 text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="leading-none">{item.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
