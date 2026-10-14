// ============================================================
// AURA. — Aviso "Venda recuperada" do Caixa (14/10/2026)
//
// O Caixa restaura em silêncio a venda guardada (utils/vendaGuardada) e
// mostra uma faixa curta: "Venda recuperada (N itens)" com o botão Limpar.
// Aqui ficam as duas regras puras da faixa, para o teste não precisar montar
// a tela: o texto e a conferência de preço.
// ============================================================

type ItemGuardado = { productId: string; price: number; listPrice?: number };
type ProdutoDoCatalogo = { id: string; price: number };

/** "Venda recuperada (1 item)" / "Venda recuperada (3 itens)". */
export function tituloDaVendaRecuperada(itens: number): string {
  const n = Math.max(0, Math.floor(Number(itens) || 0));
  return "Venda recuperada (" + n + (n === 1 ? " item)" : " itens)");
}

export const TEXTO_CONFIRA_VALORES = "Confira os valores: algum preço mudou desde que a venda foi guardada.";

/**
 * Algum item da venda guardada tem preço de tabela diferente do preço atual
 * do catálogo? Só avisa, nunca bloqueia nem troca o preço (o lojista pode
 * ter dado um preço por fora, e o desconto já é outra conta).
 *
 * Compara o preço de TABELA que o item guardou (listPrice, o de quando
 * entrou) com o do catálogo de hoje — o lápis do Caixa mexe em `price`, não
 * em `listPrice`. Fica de fora o que não dá para comparar: item de variante
 * (a chave tem "__" e o preço é da variante), linha sem produto do cadastro
 * (taxa da comanda, avulso do orçamento) e produto que não está na lista.
 */
export function algumPrecoMudou(itens: ItemGuardado[], produtos: ProdutoDoCatalogo[]): boolean {
  if (!Array.isArray(itens) || !Array.isArray(produtos) || produtos.length === 0) return false;
  const porId = new Map<string, number>();
  produtos.forEach((p) => { if (p && p.id != null) porId.set(String(p.id), Number(p.price)); });
  return itens.some((i) => {
    if (!i || typeof i.productId !== "string" || i.productId.indexOf("__") >= 0) return false;
    const atual = porId.get(i.productId);
    if (atual == null || !isFinite(atual)) return false;
    const guardado = Number(i.listPrice != null ? i.listPrice : i.price);
    if (!isFinite(guardado)) return false;
    return Math.abs(guardado - atual) >= 0.005;
  });
}
