// ============================================================
// components/studio/storefront/selosDoProduto.ts
//
// Os selos e chips do cartão, derivados do que o produto realmente é.
//
// O handoff desenha quatro chips no card — "Mockup 3D", "Frente + verso",
// "Cor da louça", "P ao GG" — e três selos: "Mais vendido", "Novo",
// "Restam N". Tudo isso já existe no payload; o cartão só nunca leu.
//
// DUAS DECISÕES QUE VALEM A PENA LEMBRAR
//
// "Restam N" fica de fora da vitrine Studio (decisão 4 de 03/09/2026).
// Personalizado é feito sob encomenda: o `stock_qty` da Sheid é 1 a 3
// por modelo porque é INSUMO — caneca crua na prateleira —, não peça
// pronta. "Restam 2" em toda caneca seria uma urgência falsa, e o CDC
// trata disso como publicidade enganosa.
//
// A linha de escada ("a partir de R$ 39,90 em 50 un") só existe quando a
// lojista configurou faixa. Nenhuma das lojas Studio tem hoje — inventar
// uma escada seria anunciar desconto que o checkout não daria.
// ============================================================
import type { StudioStoreProduct } from "./types";
import { faixaLabel } from "./qtyTiers";

/** Peça com menos dias que isto é "Novo". Mesma régua da loja comum. */
export const DIAS_PARA_NOVO = 14;
/** Abaixo disto "mais vendido" é ruído: 1 pedido não é um recorde. */
export const PEDIDOS_PARA_MAIS_VENDIDO = 3;

export type SeloDoProduto = { texto: string; tom: "marca" | "novo" };
export type ChipDoProduto = { texto: string };

/**
 * O selo de canto. No máximo UM: dois selos empilhados no canto da foto
 * viram uma etiqueta de liquidação em cima da peça.
 */
export function seloDoProduto(
  p: StudioStoreProduct,
  maisPedidoDaLoja?: string | null,
): SeloDoProduto | null {
  const pedidos = p.pedidos || 0;
  if (pedidos >= PEDIDOS_PARA_MAIS_VENDIDO && p.id === maisPedidoDaLoja) {
    return { texto: "Mais pedido", tom: "marca" };
  }
  if (ehNovo((p as any).created_at)) return { texto: "Novo", tom: "novo" };
  return null;
}

/** Entrou na loja há menos de DIAS_PARA_NOVO dias. */
export function ehNovo(criadoEm?: string | null, agora: Date = new Date()): boolean {
  if (!criadoEm) return false;
  const d = new Date(criadoEm);
  if (isNaN(d.getTime())) return false;
  const dias = (agora.getTime() - d.getTime()) / 86400000;
  return dias >= 0 && dias <= DIAS_PARA_NOVO;
}

/**
 * Os chips do que dá para personalizar, lidos do customization_config.
 *
 * A ordem é a do valor para quem compra: primeiro o que impressiona
 * (mockup 3D), depois o que amplia (verso), depois as escolhas.
 * No máximo três — a partir do quarto o cartão vira formulário.
 */
export function chipsDoProduto(p: StudioStoreProduct): ChipDoProduto[] {
  const cfg: any = p.customization_config || {};
  const campos: any[] = Array.isArray(cfg.fields) ? cfg.fields : [];
  const chips: ChipDoProduto[] = [];

  if (p.visual_kind === "model3d") chips.push({ texto: "Mockup 3D" });
  else if (p.visual_kind === "photo2d") chips.push({ texto: "Prévia da arte" });

  if (cfg.has_back === true) chips.push({ texto: "Frente e verso" });

  const temCor = campos.some((f) => f && f.type === "color");
  if (temCor) chips.push({ texto: "Escolha a cor" });

  if (chips.length < 3) {
    const temTexto = campos.some((f) => f && f.type === "text" && !f.config?.is_art_service);
    if (temTexto) chips.push({ texto: "Nome ou frase" });
  }
  if (chips.length < 3) {
    const temFoto = campos.some((f) => f && (f.type === "image" || f.type === "template"));
    if (temFoto) chips.push({ texto: "Sua arte" });
  }
  return chips.slice(0, 3);
}

/**
 * A linha de escada: "R$ 39,90 cada a partir de 50 un".
 *
 * `null` sem faixa configurada. O backend já manda `qty_tiers` calculado
 * (S6 de 19/08), e ele vem `[]` quando a lojista não configurou nada.
 */
export function linhaDeEscada(p: StudioStoreProduct): string | null {
  const faixas = Array.isArray(p.qty_tiers) ? p.qty_tiers : [];
  if (faixas.length < 2) return null;
  // A última faixa é a mais barata — é o argumento que interessa mostrar.
  const melhor = faixas[faixas.length - 1];
  if (!melhor || !(melhor.unit_price < Number(p.price))) return null;
  return `R$ ${melhor.unit_price.toFixed(2).replace(".", ",")} cada ${faixaLabel(melhor).toLowerCase()}`;
}

/** O id da peça mais pedida da loja, para o selo "Mais pedido". */
export function pecaMaisPedida(produtos: StudioStoreProduct[]): string | null {
  let campeao: StudioStoreProduct | null = null;
  for (const p of produtos || []) {
    if ((p.pedidos || 0) > (campeao?.pedidos || 0)) campeao = p;
  }
  return campeao && (campeao.pedidos || 0) >= PEDIDOS_PARA_MAIS_VENDIDO ? campeao.id : null;
}
