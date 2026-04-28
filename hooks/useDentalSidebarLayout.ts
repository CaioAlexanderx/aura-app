import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

// ============================================================
// useDentalSidebarLayout — preferencia local da sidebar dental.
//
// Diferente do useSidebarLayout (genérico, sincronizado via backend),
// este e localStorage-only. Justificativa:
//  - Sidebar dental tem 9 items so (vs ~15 do generico)
//  - Persistir cross-device exigiria endpoint backend novo
//  - Por enquanto, persistir no browser ja resolve UAT
// ============================================================

export type DentalSidebarLayoutItem = {
  key: string;     // route do item (ex "/dental/(clinic)/hoje")
  section: string; // nome da secao ("Operação" | "Negócio" | "Configurações")
  hidden: boolean;
};

export type DentalSidebarLayout = {
  version: 1;
  items: DentalSidebarLayoutItem[];
};

const STORAGE_KEY = "aura_dental_sidebar_layout";

function readStorage(): DentalSidebarLayout | null {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) {
      return parsed as DentalSidebarLayout;
    }
  } catch {}
  return null;
}

function writeStorage(layout: DentalSidebarLayout | null) {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
  try {
    if (layout === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

export function useDentalSidebarLayout() {
  const [layout, setLayout] = useState<DentalSidebarLayout | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setLayout(readStorage());
    setIsHydrated(true);
  }, []);

  const save = useCallback((next: DentalSidebarLayout | null) => {
    setLayout(next);
    writeStorage(next);
    return Promise.resolve();
  }, []);

  return { layout, save, isHydrated };
}

// ============================================================
// Helpers analogos ao useSidebarLayout, mas tipados pro contexto dental.
// ============================================================

export interface DentalNavItem {
  route: string;
  label: string;
  icon: string;
  tourKey?: string;
}
export interface DentalNavSection {
  label: string;
  items: DentalNavItem[];
}

// applyLayoutToDental — aplica reorder/hidden no NAV original.
// - Items declarados no layout viram primeiro (na ordem do layout)
// - Items "novos" (ainda nao salvos) vao pro fim da secao original
// - Items hidden=true sao removidos
export function applyLayoutToDental(
  base: DentalNavSection[],
  layout: DentalSidebarLayout | null,
): DentalNavSection[] {
  if (!layout || !Array.isArray(layout.items) || layout.items.length === 0) {
    return base;
  }

  const itemMap = new Map<string, DentalNavItem>();
  for (const sec of base) {
    for (const it of sec.items) itemMap.set(it.route, it);
  }

  const result: Record<string, DentalNavItem[]> = {};
  const sectionOrder: string[] = [];
  const handled = new Set<string>();

  for (const li of layout.items) {
    handled.add(li.key);
    if (li.hidden) continue;
    const nav = itemMap.get(li.key);
    if (!nav) continue;
    if (!result[li.section]) {
      result[li.section] = [];
      sectionOrder.push(li.section);
    }
    result[li.section].push(nav);
  }

  for (const sec of base) {
    for (const it of sec.items) {
      if (handled.has(it.route)) continue;
      if (!result[sec.label]) {
        result[sec.label] = [];
        sectionOrder.push(sec.label);
      }
      result[sec.label].push(it);
    }
  }

  return sectionOrder.map((s) => ({ label: s, items: result[s] }));
}

// dentalNavToLayoutItems — achata um NAV em items de layout
// (todos visiveis). Usado pra inicializar o editor.
export function dentalNavToLayoutItems(nav: DentalNavSection[]): DentalSidebarLayoutItem[] {
  const items: DentalSidebarLayoutItem[] = [];
  for (const sec of nav) {
    for (const it of sec.items) {
      items.push({ key: it.route, section: sec.label, hidden: false });
    }
  }
  return items;
}

// mergeLayoutWithCurrentDental — combina layout salvo + items novos
// que apareceram no NAV mas nao estao no layout salvo. Usado pra
// inicializar o estado do editor (cliente ve TUDO disponivel).
export function mergeLayoutWithCurrentDental(
  layout: DentalSidebarLayout | null,
  currentNav: DentalNavSection[],
): DentalSidebarLayoutItem[] {
  const allCurrent = dentalNavToLayoutItems(currentNav);
  if (!layout || !Array.isArray(layout.items)) return allCurrent;

  const keysInLayout = new Set(layout.items.map((i) => i.key));
  const currentByKey = new Map<string, DentalSidebarLayoutItem>();
  for (const c of allCurrent) currentByKey.set(c.key, c);

  const validLayoutItems: DentalSidebarLayoutItem[] = [];
  for (const li of layout.items) {
    if (currentByKey.has(li.key)) validLayoutItems.push(li);
  }

  const newItems: DentalSidebarLayoutItem[] = [];
  for (const c of allCurrent) {
    if (!keysInLayout.has(c.key)) newItems.push(c);
  }

  return [...validLayoutItems, ...newItems];
}
