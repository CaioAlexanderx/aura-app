// ============================================================
// AURA STUDIO · StudioShell — FAB config + resolveFab por rota
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Mapeia pathname → FAB visível (rótulo, ícone, ação).
//
// QA mobile (05/10/2026):
//   - Só a rota EXATA da lista tem flutuante. Com `startsWith` ele seguia
//     para dentro do detalhe do pedido, do orçamento aberto e do próprio
//     wizard de evento, cobrindo o conteúdo de telas que já têm a sua
//     barra de ação.
//   - Um rótulo por ação, igual ao do botão do cabeçalho no desktop
//     ("Novo produto", "Novo orçamento", "Subir template"). No celular o
//     botão do cabeçalho some e fica só o flutuante.
//   - O `href` é o caminho de quem não tem tela registrada em
//     fabControl.ts; quando a tela registra a ação, vale a da tela.
// ============================================================
export type FabConfig = {
  label: string;
  icon: string;
  accessibilityLabel: string;
  action: "push" | "queryNew";
  href: string;
};

const NOVO_PRODUTO: FabConfig = {
  label: "Novo produto",
  icon: "plus",
  accessibilityLabel: "Cadastrar novo produto",
  action: "queryNew",
  // "novo-produto" é o deep-link que o catálogo entende (estoque.tsx).
  href: "/studio/estoque?action=novo-produto",
};

const FABS: Record<string, FabConfig> = {
  "/studio": NOVO_PRODUTO,
  "/studio/estoque": NOVO_PRODUTO,
  "/studio/galeria": {
    label: "Subir template",
    icon: "plus",
    accessibilityLabel: "Subir novo template de arte",
    action: "queryNew",
    href: "/studio/galeria?action=new",
  },
  "/studio/gestao/orcamentos": {
    label: "Novo orçamento",
    icon: "plus",
    accessibilityLabel: "Criar novo orçamento",
    action: "push",
    href: "/studio/gestao/orcamentos/novo",
  },
  // FIX (bug #3 QA): "/studio/pedidos/novo" não existe como rota — o Expo
  // Router casa com [id].tsx (id="novo") e mostra "Pedido não encontrado".
  // A única ação de "novo pedido" que existe de fato é o wizard de evento.
  "/studio/pedidos": {
    label: "Novo pedido para evento",
    icon: "plus",
    accessibilityLabel: "Criar novo pedido para evento",
    action: "push",
    href: "/studio/pedidos/novo-evento",
  },
};

export function resolveFab(pathname: string): FabConfig | null {
  const rota = (pathname || "").replace(/\/+$/, "") || "/";
  return FABS[rota] ?? null;
}

/** Espaço que a tela reserva no fim da rolagem para o flutuante não cobrir
 *  a última linha: 56 (altura) + 24 (distância da borda) + 16 de respiro. */
export const FAB_CLEARANCE = 96;
