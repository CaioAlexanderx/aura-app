// ============================================================
// AURA. — D2 (F0): filtro de categoria hierárquico
//
// Selecionar "Feminino" tem que trazer também o que está em
// "Feminino > Calçados > Botas". Sem isso, a árvore de 3 níveis piora a
// vida do lojista em vez de melhorar: quanto mais ele organiza, menos
// produto aparece ao filtrar pelo topo.
//
// ── POR QUE ISSO FUNCIONA SEM MUDAR O BACKEND ───────────────
// A listagem interna de produtos devolve `category` como TEXTO, não o
// id. Mas o trigger de dual-write (migration 259) mantém esse texto
// igual ao NOME da categoria primária. Então expandir a seleção para os
// nomes da subárvore e continuar comparando texto dá o resultado certo,
// sem endpoint novo e sem tocar na query de produtos.
//
// ── LIMITAÇÃO CONHECIDA, HERDADA DA DEC-01 ──────────────────
// Irmãos homônimos em ramos diferentes ("Calçados" sob Feminino e sob
// Masculino) casam os dois. A DEC-01 aceitou isso como transitório, e
// aqui o efeito é over-match no filtro — mostra a mais, nunca a menos.
// Mostrar produto demais é recuperável pelo olho do lojista; esconder
// produto não é.
//
// Some quando o filtro passar a usar `category_id`, o que exige a
// listagem de produtos expor o vínculo.
// ============================================================

export type NoDaArvore = { name: string; path: string };

/**
 * Expande nomes de categoria selecionados para incluir a subárvore.
 *
 * @param selecionadas nomes escolhidos no filtro (vazio = "Todos")
 * @param flat         lista achatada da árvore (useCategories().flattened)
 * @returns nomes a casar contra `products.category`
 */
export function expandirComDescendentes(
  selecionadas: string[],
  flat: NoDaArvore[] | undefined | null
): string[] {
  if (!selecionadas || selecionadas.length === 0) return [];
  // Base sem árvore: devolve o que veio. O filtro segue exatamente como
  // era antes da D2 — a maioria das empresas ainda está só em texto.
  if (!flat || flat.length === 0) return selecionadas;

  const saida = new Set<string>(selecionadas);

  for (const nome of selecionadas) {
    // Pode haver mais de um nó com o mesmo nome (irmãos homônimos): todos
    // contam, e a subárvore de cada um entra.
    const nos = flat.filter((c) => c.name === nome);
    for (const no of nos) {
      const prefixo = no.path.endsWith("/") ? no.path : no.path + "/";
      for (const c of flat) {
        if (c.path.startsWith(prefixo)) saida.add(c.name);
      }
    }
  }

  return [...saida];
}

export default expandirComDescendentes;
