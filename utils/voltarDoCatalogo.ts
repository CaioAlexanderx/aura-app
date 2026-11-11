// ============================================================
// AURA. — "Voltar" das telas /catalogo/* (organizar, migracao, sem-categoria)
//
// 10/11/2026: o "Voltar" dessas telas era `router.back()` e levava ao
// Painel. Causa: a raiz (app/_layout.tsx) é um <Slot />, que só monta a
// rota da frente. Ao abrir /catalogo/organizar, o grupo (tabs) desmonta e
// o React Navigation apaga o estado aninhado dele (useNavigationBuilder
// limpa o estado no unmount). O back() volta para um (tabs) sem estado,
// que recomeça na rota inicial: index, o Painel. Sem histórico (link
// direto, recarga), o back() nem faz nada.
//
// Regra:
//   - a tela anterior na pilha é outra /catalogo/* → back() (as três são
//     irmãs na raiz e voltam inteiras);
//   - qualquer outro caso → replace para a tela de origem: o Canal quando
//     o link diz ?de=canal (Vitrine), senão o Estoque.
// ============================================================

export type DestinoVoltarCatalogo = { tipo: "back" } | { tipo: "replace"; href: string };

export const ORIGENS_DO_CATALOGO: Record<string, string> = {
  estoque: "/estoque",
  canal: "/canal",
};

export function destinoDoVoltarCatalogo(opts: {
  rotaAnterior?: string | null;
  de?: string | null;
}): DestinoVoltarCatalogo {
  if (opts.rotaAnterior && opts.rotaAnterior.indexOf("catalogo/") === 0) return { tipo: "back" };
  const href = (opts.de && ORIGENS_DO_CATALOGO[opts.de]) || ORIGENS_DO_CATALOGO.estoque;
  return { tipo: "replace", href };
}
