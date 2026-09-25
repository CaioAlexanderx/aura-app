// ============================================================
// components/studio/storefront/precoDaSacola.ts
//
// O preço de uma linha da sacola, do jeito que o servidor cobra.
//
// ── POR QUE SAIU DO useStorefront (Fase 2 · 25/09/2026) ────────────────
// As funções de preço moravam dentro do hook (choicesDelta, backDelta,
// middleDelta, lineUnitPrice) e o Cart.tsx tinha a própria cópia de
// "o verso está ativo?". Três lugares para uma regra de dinheiro (D12
// da JORNADA). Agora é um módulo puro, com teste, e todo mundo lê daqui.
//
// Com a chave `vitrine_v2` os valores exibidos vêm da cotação do servidor
// (POST /studio/cotacao, cotacaoDaSacola.ts); esta conta vira a
// estimativa instantânea enquanto a resposta não chega — e continua sendo
// a única conta com a chave desligada. Por isso ela tem de bater.
//
// ── A ORDEM DA CONTA (espelho de services/precoDoStudio.js) ────────────
//   1. faixa de quantidade (S6) sobre o preço de TABELA
//   2. + opções/cores escolhidas (price_delta), por unidade
//   3. + verso e + faixa central, por unidade
//   4. × quantidade
//   5. + serviço de arte pago, UMA VEZ POR LINHA   ← decisão do PO, 25/09
//
// Serviço de arte ("Envio minha arte e vocês ajustam", "Criem a arte pra
// mim") é trabalho feito uma vez: a lojista ajusta UMA arte, e ela sai
// em duas canecas iguais. Antes o price_delta dele entrava no preço
// unitário e era multiplicado — duas canecas com a mesma foto pagavam o
// ajuste duas vezes. Exemplo (caneca R$ 39,90, ajuste R$ 10, 2 un):
//   antes: (39,90 + 10) × 2 = R$ 99,80
//   agora:  39,90 × 2 + 10  = R$ 89,80
// ============================================================
import type { CartLine, StudioStoreProduct } from "./types";
import { basePriceForQty, matchTier } from "./qtyTiers";
import { isArtServiceField } from "@/components/studio/customizationConfig";

type Config = StudioStoreProduct["customization_config"] | null | undefined;

/**
 * O campo de serviço de arte: `type: 'option'` com `is_art_service` ou o
 * id canônico. O briefing carrega a mesma marca, mas é texto — por isso o
 * tipo entra na regra (igual a ehCampoDeServicoDeArte no backend).
 */
export function ehCampoDeArte(f: any): boolean {
  return !!f && f.type === "option" && isArtServiceField(f);
}

/** Soma os price_delta das escolhas de UM campo. */
function deltaDoCampo(f: any, values: Record<string, any>): number {
  const choices = f?.config?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return 0;
  const selected = values[f.id];
  if (selected == null) return 0;
  const sels = Array.isArray(selected) ? selected : [selected];
  let delta = 0;
  for (const s of sels) {
    const c = choices.find((ch: any) => ch.value === s || ch.label === s);
    if (c && typeof c.price_delta === "number" && !isNaN(c.price_delta)) delta += c.price_delta;
  }
  return delta;
}

/** Opções e cores escolhidas, POR UNIDADE. O serviço de arte fica de fora. */
export function deltaDasOpcoes(cfg: Config, values: Record<string, any> | null | undefined): number {
  if (!cfg?.fields || !values) return 0;
  let delta = 0;
  for (const f of cfg.fields as any[]) {
    if (!f || (f.type !== "option" && f.type !== "color")) continue;
    if (ehCampoDeArte(f)) continue;
    delta += deltaDoCampo(f, values);
  }
  return delta;
}

/** O serviço de arte escolhido, cobrado UMA VEZ por linha. */
export function deltaDaArte(cfg: Config, values: Record<string, any> | null | undefined): number {
  if (!cfg?.fields || !values) return 0;
  let delta = 0;
  for (const f of cfg.fields as any[]) {
    if (ehCampoDeArte(f)) delta += deltaDoCampo(f, values);
  }
  return delta;
}

/** O verso está na peça? (incluso no preço, ou escolhido quando é cobrado) */
export function versoEfetivo(cfg: Config, explicit: boolean | undefined): boolean {
  if (!cfg || cfg.has_back !== true) return false;
  if (cfg.back_charge_enabled !== true) return true;
  return explicit === true;
}

// Mesma regra do verso, para o meio (faixa central / wrap 360 de caneca e
// copo). ESPELHO de middleIsActive no backend — se um lado mudar sem o
// outro, o item entra na sacola e o pedido leva 400 no fechamento.
export function meioEfetivo(cfg: Config, explicit: boolean | undefined): boolean {
  if (!cfg || cfg.has_middle !== true) return false;
  if (cfg.middle_charge_enabled !== true) return true;
  return explicit === true;
}

/** O que o verso soma por unidade (0 quando incluso ou não escolhido). */
export function deltaDoVerso(cfg: Config, explicit: boolean | undefined): number {
  if (!cfg || cfg.has_back !== true) return 0;
  if (cfg.back_charge_enabled !== true) return 0;
  if (explicit !== true) return 0;
  const d = Number(cfg.back_price_delta);
  return isFinite(d) ? d : 0;
}

/** O que o meio soma por unidade. ESPELHO de computeMiddleDelta. */
export function deltaDoMeio(cfg: Config, explicit: boolean | undefined): number {
  if (!cfg || cfg.has_middle !== true) return 0;
  if (cfg.middle_charge_enabled !== true) return 0;
  if (explicit !== true) return 0;
  const d = Number(cfg.middle_price_delta);
  return isFinite(d) ? d : 0;
}

export type PrecoDaLinha = {
  /** Preço de tabela do produto. */
  lista: number;
  /** Depois da faixa de quantidade. */
  base: number;
  opcoes: number;
  verso: number;
  meio: number;
  /** Serviço de arte, uma vez por linha (não entra no unitário). */
  arte: number;
  /** base + opções + verso + meio. */
  unitario: number;
  /** unitário × quantidade + arte. */
  total: number;
  /** A faixa que a quantidade atingiu, quando ela baixa o preço. */
  faixa: { min_qty: number; pct: number } | null;
};

/**
 * O preço de uma peça com a personalização e a quantidade dela. É a conta
 * do configurador (antes de virar linha) e da linha da sacola.
 *
 * A bandeira do meio vive em `values.has_middle_selected` (a CartLine não
 * tem campo próprio para ela — ver commitConfigure em useStorefront).
 */
export function precoDaPeca(args: {
  produto: Pick<StudioStoreProduct, "price" | "qty_tiers" | "customization_config">;
  quantidade: number;
  values: Record<string, any> | null | undefined;
  verso?: boolean;
  meio?: boolean;
}): PrecoDaLinha {
  const cfg = args.produto.customization_config;
  const qtd = Math.max(1, Math.floor(Number(args.quantidade) || 1));
  const lista = Number(args.produto.price) || 0;
  const base = basePriceForQty(lista, args.produto.qty_tiers, qtd);
  const values = args.values || {};
  const opcoes = deltaDasOpcoes(cfg, values);
  const verso = deltaDoVerso(cfg, args.verso);
  const meio = deltaDoMeio(cfg, args.meio);
  const arte = deltaDaArte(cfg, values);
  const unitario = base + opcoes + verso + meio;
  const tier = base < lista ? matchTier(args.produto.qty_tiers, qtd) : null;
  return {
    lista, base, opcoes, verso, meio, arte, unitario,
    total: unitario * qtd + arte,
    faixa: tier ? { min_qty: Number(tier.min_qty), pct: Number(tier.discount_pct) } : null,
  };
}

/** O preço de uma linha da sacola. */
export function precoDaLinha(line: CartLine): PrecoDaLinha {
  return precoDaPeca({
    produto: line.product,
    quantidade: line.qty,
    values: line.values,
    verso: line.hasBackSelected,
    meio: line.values?.has_middle_selected,
  });
}

/** Unitário da linha (sem a arte, que é por linha). */
export function precoUnitarioDaLinha(line: CartLine): number {
  return precoDaLinha(line).unitario;
}

/** Total da linha: unitário × quantidade + arte. */
export function totalDaLinha(line: CartLine): number {
  return precoDaLinha(line).total;
}

/** Subtotal da sacola. */
export function subtotalDaSacola(cart: CartLine[] | null | undefined): number {
  return (cart || []).reduce((s, l) => s + totalDaLinha(l), 0);
}

/**
 * O desconto do Pix, com a MESMA conta do servidor: sobre o subtotal,
 * arredondado em centavos, frete fora.
 */
export function descontoDoPix(subtotal: number, pct: number | null | undefined): number {
  const p = Number(pct) || 0;
  if (p <= 0) return 0;
  return Math.round((Number(subtotal) || 0) * p) / 100;
}

/** Quantas peças há na sacola (soma das quantidades). */
export function pecasNaSacola(cart: CartLine[] | null | undefined): number {
  return (cart || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
}
