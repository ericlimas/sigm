import { create } from "zustand";

export interface WorkspaceTab {
  path: string;
  title: string;
}

interface TabsState {
  tabs: WorkspaceTab[];
  activePath: string | null;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (path: string, fallback: (path: string) => void) => void;
  setActive: (path: string) => void;
}

const HOME_TAB: WorkspaceTab = { path: "/", title: "Inicio" };

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: [HOME_TAB],
  activePath: "/",
  openTab: (tab) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.path === tab.path)) {
      set({ tabs: [...tabs, tab], activePath: tab.path });
    } else {
      set({ activePath: tab.path });
    }
  },
  closeTab: (path, navigate) => {
    const { tabs, activePath } = get();
    if (path === "/") return;
    const index = tabs.findIndex((t) => t.path === path);
    if (index === -1) return;
    const newTabs = tabs.filter((t) => t.path !== path);
    set({ tabs: newTabs });
    if (activePath === path) {
      const fallback = newTabs[index - 1] ?? newTabs[0] ?? HOME_TAB;
      set({ activePath: fallback.path });
      navigate(fallback.path);
    }
  },
  setActive: (path) => set({ activePath: path }),
}));
