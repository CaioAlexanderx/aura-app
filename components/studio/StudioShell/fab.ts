// ============================================================
// AURA STUDIO · StudioShell — FAB config + resolveFab por rota
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Mapeia pathname → FAB visível (rótulo, ícone, ação).
// Mantém comportamento idêntico ao original.
// ============================================================
export type FabConfig = {
  label: string;
  icon: string;
  accessibilityLabel: string;
  action: "push" | "queryNew";
  href: string;
};

export function resolveFab(pathname: string): FabConfig | null {
  if (pathname === "/studio/estoque" || pathname.startsWith("/studio/estoque/")) {
    return { label: "Cadastrar produto", icon: "plus", accessibilityLabel: "Cadastrar novo produto", action: "queryNew", href: "/studio/estoque?action=new" };
  }
  if (pathname === "/studio/produtos" || pathname.startsWith("/studio/produtos/")) {
    return { label: "Cadastrar produto", icon: "plus", accessibilityLabel: "Cadastrar novo produto", action: "queryNew", href: "/studio/estoque?action=new" };
  }
  if (pathname === "/studio/galeria" || pathname.startsWith("/studio/galeria/")) {
    return { label: "Adicionar template", icon: "plus", accessibilityLabel: "Adicionar novo template", action: "queryNew", href: "/studio/galeria?action=new" };
  }
  // Camada 1 (30/05): FAB para lista de orçamentos — P2: href corrigido para gestao/
  if (pathname === "/studio/gestao/orcamentos" || pathname.startsWith("/studio/gestao/orcamentos")) {
    return { label: "Novo orçamento", icon: "plus", accessibilityLabel: "Criar novo orçamento", action: "push", href: "/studio/gestao/orcamentos/novo" };
  }
  if (pathname === "/studio/pedidos" || pathname.startsWith("/studio/pedidos/")) {
    // FIX (bug #3 QA): "/studio/pedidos/novo" não existe como rota — o Expo
    // Router casa com [id].tsx (id="novo") e mostra "Pedido não encontrado".
    // A única ação de "novo pedido" que existe de fato é o wizard de evento.
    return { label: "Novo pedido pra evento", icon: "plus", accessibilityLabel: "Criar novo pedido pra evento", action: "push", href: "/studio/pedidos/novo-evento" };
  }
  if (pathname === "/studio" || pathname === "/studio/") {
    return { label: "Novo produto", icon: "plus", accessibilityLabel: "Ir para cadastro de produto", action: "push", href: "/studio/estoque" };
  }
  return null;
}
