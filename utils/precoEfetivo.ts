// ============================================================
// AURA. — Preço que vale agora no Caixa (De/Por, p-87, 08/11/2026)
//
// Contrato De/Por (opção A): o backend devolve, em produto e variante,
// `em_promocao` e `preco_efetivo`; `price` continua sendo o preço normal
// (o "De"). Quem decide se está em promoção é o SERVIDOR (data em
// Brasília); o app só lê. Backend antigo (sem os campos) = comportamento
// de hoje: vale `price` / `price_override`.
//
// Lê os dois formatos: o produto mapeado do catálogo (emPromocao /
// precoEfetivo, hooks/useProducts) e o objeto cru do bipe / das variantes
// (em_promocao / preco_efetivo).
//
// Regra de segurança: promoção só vale se for MENOR que o preço normal e
// maior que zero; qualquer coisa estranha = preço normal.
// ============================================================

export type PromoDoItem = { por: number; de: number };

function num(v: any): number {
  var n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** A promoção do item no ar ({ por, de }) ou null. `base` = preço normal (padrão: `price`). */
export function promoDoItem(p: any, base?: number): PromoDoItem | null {
  if (!p) return null;
  var em = p.emPromocao === true || p.em_promocao === true;
  if (!em) return null;
  var por = num(p.precoEfetivo != null ? p.precoEfetivo : p.preco_efetivo);
  var de = base != null ? num(base) : num(p.price);
  if (!(por > 0) || !(de > 0) || por >= de - 0.001) return null;
  return { por: Math.round(por * 100) / 100, de: de };
}

/**
 * Preço e "De" de uma variante. Com preço próprio (price_override) a
 * variante é item próprio: vale a promoção DELA. Sem preço próprio segue o
 * produto (a promoção do produto vale para ela).
 */
export function precoDaVariante(v: any, produto: any): { price: number; promoDe: number | null } {
  var temProprio = !!(v && v.price_override);
  var base = temProprio ? num(v.price_override) : num(produto && produto.price);
  var daVariante = promoDoItem(v, base);
  if (daVariante) return { price: daVariante.por, promoDe: daVariante.de };
  if (!temProprio) {
    var doProduto = promoDoItem(produto);
    if (doProduto) return { price: doProduto.por, promoDe: doProduto.de };
  }
  return { price: base, promoDe: null };
}
