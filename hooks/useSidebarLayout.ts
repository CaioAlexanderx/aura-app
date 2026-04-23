import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sidebarLayoutApi, type SidebarLayout, type SidebarLayoutItem } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hook de preferencia de layout da sidebar
//
// Lê /auth/sidebar-layout (com cache infinito por sessao) e
// expoe save() pra persistir mudancas no backend (que sincroniza
// entre dispositivos do mesmo usuario).
// ============================================================

export type NavItem = {
  r: string; l: string; ic: string;
  soon?: boolean; plan?: string; mod?: string; staff?: boolean;
};
export type NavSection = { s: string; i: NavItem[] };

export function useSidebarLayout() {
  var { token } = useAuthStore();
  var qc = useQueryClient();

  var { data, isLoading } = useQuery({
    queryKey: ["sidebar-layout"],
    queryFn: function() { return sidebarLayoutApi.get(); },
    enabled: !!token,
    staleTime: Infinity, // so muda quando o cliente edita
    retry: 1,
  });

  var saveMutation = useMutation({
    mutationFn: function(layout: SidebarLayout | null) { return sidebarLayoutApi.save(layout); },
    onSuccess: function(result) { qc.setQueryData(["sidebar-layout"], result); },
  });

  return {
    layout: (data?.layout as SidebarLayout | null) || null,
    isLoading: isLoading,
    save: function(layout: SidebarLayout | null) { return saveMutation.mutateAsync(layout); },
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error as Error | null,
  };
}

// ============================================================
// applyLayoutToNav — aplica o layout custom ao NAV ja filtrado
// (por plano/staff/vertical). Resultado:
//   - Items reordenados conforme layout salvo
//   - Items ocultos (hidden=true) sao removidos
//   - Items "novos" (que nao estavam no layout salvo) vao pra
//     secao original deles, no fim (preserva backward compat
//     quando lancarmos features novas)
// ============================================================
export function applyLayoutToNav(filteredNav: NavSection[], layout: SidebarLayout | null): NavSection[] {
  if (!layout || !Array.isArray(layout.items) || layout.items.length === 0) {
    return filteredNav;
  }

  // Mapa: route -> NavItem original (mantem icone, label, badges)
  var itemMap = new Map<string, NavItem>();
  for (var i = 0; i < filteredNav.length; i++) {
    var section = filteredNav[i];
    for (var j = 0; j < section.i.length; j++) {
      var item = section.i[j];
      itemMap.set(item.r, item);
    }
  }

  // Resultado: { sectionName: [items...] } + ordem das secoes
  var result: Record<string, NavItem[]> = {};
  var sectionOrder: string[] = [];
  var handledKeys = new Set<string>();

  // Pass 1: items declarados no layout (na ordem do layout)
  for (var k = 0; k < layout.items.length; k++) {
    var li = layout.items[k];
    handledKeys.add(li.key);
    if (li.hidden) continue; // escondido pelo cliente
    var nav = itemMap.get(li.key);
    if (!nav) continue; // route nao existe mais (feature removida)

    if (!result[li.section]) {
      result[li.section] = [];
      sectionOrder.push(li.section);
    }
    result[li.section].push(nav);
  }

  // Pass 2: items "novos" (entram em produtos/features depois do salvo)
  // vao pra secao ORIGINAL deles, ao fim.
  for (var s = 0; s < filteredNav.length; s++) {
    var sec = filteredNav[s];
    for (var n = 0; n < sec.i.length; n++) {
      var it = sec.i[n];
      if (handledKeys.has(it.r)) continue;
      if (!result[sec.s]) {
        result[sec.s] = [];
        sectionOrder.push(sec.s);
      }
      result[sec.s].push(it);
    }
  }

  // Monta NavSection[] preservando ordem
  return sectionOrder.map(function(s) {
    return { s: s, i: result[s] };
  });
}

// ============================================================
// navToLayoutItems — converte um NAV (estado atual visivel)
// em SidebarLayoutItem[] (formato persistido).
// Util quando cliente abre o editor pela primeira vez:
// pegamos o NAV padrao, achatamos em items, e a partir dai
// ele edita.
// ============================================================
export function navToLayoutItems(nav: NavSection[]): SidebarLayoutItem[] {
  var items: SidebarLayoutItem[] = [];
  for (var i = 0; i < nav.length; i++) {
    var section = nav[i];
    for (var j = 0; j < section.i.length; j++) {
      items.push({ key: section.i[j].r, section: section.s, hidden: false });
    }
  }
  return items;
}

// ============================================================
// mergeLayoutWithCurrent — combina layout salvo + items novos
// que apareceram no NAV mas nao estao no layout. Util pra
// inicializar o estado do editor (cliente ve TUDO disponivel).
// ============================================================
export function mergeLayoutWithCurrent(
  layout: SidebarLayout | null,
  currentNav: NavSection[]
): SidebarLayoutItem[] {
  var allCurrent = navToLayoutItems(currentNav);
  if (!layout || !Array.isArray(layout.items)) return allCurrent;

  var keysInLayout = new Set(layout.items.map(function(i) { return i.key; }));
  var currentByKey = new Map<string, SidebarLayoutItem>();
  for (var i = 0; i < allCurrent.length; i++) currentByKey.set(allCurrent[i].key, allCurrent[i]);

  // Filtra items do layout que ainda existem
  var validLayoutItems: SidebarLayoutItem[] = [];
  for (var k = 0; k < layout.items.length; k++) {
    var li = layout.items[k];
    if (currentByKey.has(li.key)) validLayoutItems.push(li);
  }

  // Adiciona items novos (que nao estavam no layout salvo)
  var newItems: SidebarLayoutItem[] = [];
  for (var n = 0; n < allCurrent.length; n++) {
    if (!keysInLayout.has(allCurrent[n].key)) newItems.push(allCurrent[n]);
  }

  return [...validLayoutItems, ...newItems];
}
