// ============================================================
// "Produtos relacionados" — quem mais está na mesma categoria.
//
// Porte da loja comum, com uma diferença que vale registrar: lá a seção
// faz um fetch (`/catalogo?cat=X`), porque a loja comum pagina de 24 em 24
// e os vizinhos da categoria quase nunca estão na página carregada. Aqui
// a vitrine carrega o catálogo inteiro de uma vez — a maior tem 30
// produtos — então relacionado é filtro de array, sem rede nenhuma.
//
// Não é recomendação: é "o que mais tem parecido com isto". Uma loja com
// 12 produtos não tem sinal para recomendar nada, e fingir que tem produz
// vitrine de e-commerce grande com estoque de loja pequena.
// ============================================================
import type { StudioStoreProduct } from "./types";

export const MAXIMO_RELACIONADOS = 4;

/**
 * Vizinhos de categoria, sem o próprio produto.
 *
 * Devolve [] quando sobra pouco: uma seção "Produtos relacionados" com um
 * item só chama atenção para o fato de a loja ser pequena. Dois é o mínimo
 * para a fileira parecer uma fileira.
 */
export function relacionadosDe(
  atual: StudioStoreProduct | null,
  todos: StudioStoreProduct[] | undefined,
  maximo: number = MAXIMO_RELACIONADOS,
): StudioStoreProduct[] {
  if (!atual || !todos || !todos.length) return [];

  // Compara por category_id quando existe (a árvore da F0), e cai para o
  // nome só quando não existe. Comparar sempre pelo nome juntaria duas
  // categorias homônimas de ramos diferentes da árvore.
  const mesmaCategoria = (p: StudioStoreProduct) =>
    atual.category_id
      ? p.category_id === atual.category_id
      : !!atual.category && p.category === atual.category;

  const vizinhos = todos.filter(
    (p) => p.id !== atual.id && mesmaCategoria(p) && (p.stock_qty == null || p.stock_qty > 0),
  );

  return vizinhos.length >= 2 ? vizinhos.slice(0, maximo) : [];
}
