// Quem aparece na vitrine (tq-57, 29/10/2026).
//
// A loja online lê duas listas da configuração do canal:
//
//   hidden_product_ids   = OCULTOS. O que está aqui some da loja. Produto
//                          que não está aqui aparece sozinho, inclusive o
//                          cadastrado amanhã. É o que a aba Vitrine grava.
//   featured_product_ids = lista de INCLUSÃO antiga. Vazia, não faz nada.
//                          Cheia, a loja mostra só o que está nela e produto
//                          novo NÃO entra sozinho. A aba não cria mais essa
//                          lista; as lojas que já têm seguem como estão até
//                          a conversão (script do backend) ou até a lojista
//                          tocar em "Mostrar todos novamente".
//
// O oculto ganha da lista: é a mesma regra do backend (NA_VITRINE em
// aura-backend/src/services/catalogoPaginado.js). Mudou lá, muda aqui.

export type Visibilidade = { featured: ReadonlySet<string>; hidden: ReadonlySet<string> };

/** A loja ainda usa a lista de inclusão antiga (só mostra uma seleção). */
export function usaListaDeInclusao(v: Visibilidade): boolean {
  return v.featured.size > 0;
}

/** O produto aparece na loja online? */
export function apareceNaLoja(v: Visibilidade, id: string): boolean {
  if (v.hidden.has(id)) return false;
  return v.featured.size === 0 || v.featured.has(id);
}

/** Oculta o produto. A lista de inclusão não é tocada: o oculto já ganha dela. */
export function ocultar(v: Visibilidade, ids: Iterable<string>): Visibilidade {
  const hidden = new Set(v.hidden);
  for (const id of ids) hidden.add(id);
  return { featured: v.featured, hidden };
}

/**
 * Mostra o produto: sai dos ocultos e, se a loja ainda usa a lista de
 * inclusão, entra nela — senão continuaria fora da loja.
 */
export function mostrar(v: Visibilidade, ids: Iterable<string>): Visibilidade {
  const hidden = new Set(v.hidden);
  const comLista = usaListaDeInclusao(v);
  const featured = new Set(v.featured);
  for (const id of ids) {
    hidden.delete(id);
    if (comLista) featured.add(id);
  }
  return { featured, hidden };
}

/** Liga/desliga um produto conforme ele aparece hoje. */
export function alternar(v: Visibilidade, id: string): Visibilidade {
  return apareceNaLoja(v, id) ? ocultar(v, [id]) : mostrar(v, [id]);
}

/** "Mostrar todos novamente": sem lista de inclusão e sem ocultos. */
export function mostrarTodos(): Visibilidade {
  return { featured: new Set(), hidden: new Set() };
}

/**
 * Contagens para os números do topo. `total` é o total de produtos que a
 * aba lista. Os ocultos podem guardar id de produto apagado, por isso o
 * resultado é limitado a [0, total].
 */
export function contagens(v: Visibilidade, total: number): { naLoja: number; ocultos: number } {
  let naLoja: number;
  if (usaListaDeInclusao(v)) {
    let n = 0;
    v.featured.forEach((id) => { if (!v.hidden.has(id)) n += 1; });
    naLoja = n;
  } else {
    naLoja = total - v.hidden.size;
  }
  naLoja = Math.max(0, Math.min(total, naLoja));
  return { naLoja, ocultos: total - naLoja };
}

/** O que vai para o PUT do canal digital. */
export function paraSalvar(v: Visibilidade): { featured_product_ids: string[]; hidden_product_ids: string[] } {
  return { featured_product_ids: Array.from(v.featured), hidden_product_ids: Array.from(v.hidden) };
}
