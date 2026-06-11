import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useTabsStore } from "@/stores/tabsStore";
import { cn } from "@/lib/utils";

export default function TabsBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activePath = useTabsStore((s) => s.activePath);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  const navigate = useNavigate();

  return (
    <div className="flex h-8 items-center gap-px overflow-x-auto bg-muted/40 px-1">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            onClick={() => {
              setActive(tab.path);
              navigate(tab.path);
            }}
            className={cn(
              "group flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-t-sm border-b-2 px-3 text-xs transition-colors",
              active
                ? "border-primary bg-background font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:bg-background/60"
            )}
          >
            <span>{tab.title}</span>
            {tab.path !== "/" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.path, navigate);
                }}
                className="rounded-sm p-0.5 opacity-0 hover:bg-destructive/20 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
