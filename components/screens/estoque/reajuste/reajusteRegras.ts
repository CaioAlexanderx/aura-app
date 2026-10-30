// ============================================================================
// AURA. — Reajuste de preço em lote: regras e textos (p-52, 30/10/2026)
//
// Só contas de EXIBIÇÃO e validação do que a pessoa digitou. A conta do
// preço novo é do servidor (prévia com dry_run): o app nunca calcula preço
// para gravar. Limites iguais aos do backend (Aura-backend#939), para o
// erro aparecer no campo antes de ir ao servidor.
// ============================================================================
import type {
  DirecaoReajuste, ItemReajuste, ModoReajuste, PedidoReajuste, RespostaReajuste, Terminacao,
} from "@/services/priceAdjustmentsApi";

/** Máximo de produtos num reajuste (backend: TOO_MANY_PRODUCTS acima disso). */
export var MAX_PRODUTOS_REAJUSTE = 2000;

export var MODOS: Array<{ modo: ModoReajuste; titulo: string; texto: string }> = [
  { modo: "percent", titulo: "Percentual", texto: "Aumenta ou diminui em %" },
  { modo: "fixed", titulo: "Valor fixo", texto: "Soma ou tira um valor em R$" },
  { modo: "markup", titulo: "Markup sobre o custo", texto: "Preço = custo + um % em cima" },
  { modo: "margin", titulo: "Margem desejada", texto: "Preço para ficar com esta margem" },
];

export var TERMINACOES: Array<{ valor: Terminacao; rotulo: string }> = [
  { valor: "none", rotulo: "Sem ajuste" },
  { valor: "90", rotulo: ",90" },
  { valor: "99", rotulo: ",99" },
  { valor: "00", rotulo: ",00" },
];

/** Valor sugerido ao trocar de modo (o mesmo do mockup aprovado). */
export var VALOR_INICIAL: Record<ModoReajuste, string> = { percent: "10", fixed: "5", markup: "60", margin: "50" };

export function usaDirecao(modo: ModoReajuste): boolean {
  return modo === "percent" || modo === "fixed";
}

/** Modos que dependem do custo (quem não tem custo fica de fora). */
export function usaCusto(modo: ModoReajuste): boolean {
  return modo === "markup" || modo === "margin";
}

export function rotuloDoValor(modo: ModoReajuste): string {
  if (modo === "percent") return "Quanto (%)";
  if (modo === "fixed") return "Quanto (R$)";
  if (modo === "markup") return "Markup (%)";
  return "Margem (%)";
}

/** "10,5" ou "10.5" -> 10.5. Vazio ou inválido -> NaN. */
export function lerNumero(txt: string): number {
  var t = String(txt == null ? "" : txt).trim().replace(/\s/g, "");
  if (!t) return NaN;
  // "1.234,56" -> 1234.56; "10,5" -> 10.5; "10.5" -> 10.5
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return parseFloat(t);
}

/** Erro do campo de valor (texto gentil) ou null quando está ok. */
export function erroDoValor(modo: ModoReajuste, direcao: DirecaoReajuste, txt: string): string | null {
  var v = lerNumero(txt);
  if (!String(txt || "").trim()) return "Digite um valor.";
  if (isNaN(v)) return "Use só números. Exemplo: 10 ou 10,5.";
  if (v <= 0) return "O valor precisa ser maior que zero.";
  if (modo === "percent") {
    if (direcao === "down" && v >= 100) return "Para diminuir, use menos de 100%.";
    if (v > 1000) return "O máximo é 1.000%.";
  } else if (modo === "fixed") {
    if (v > 100000) return "O máximo é R$ 100.000,00.";
  } else if (modo === "markup") {
    if (v > 10000) return "O máximo é 10.000%.";
  } else if (v >= 100) {
    return "A margem precisa ser menor que 100%.";
  }
  return null;
}

export function montarPedido(
  ids: string[], modo: ModoReajuste, direcao: DirecaoReajuste, valorTxt: string, terminacao: Terminacao,
): PedidoReajuste {
  var pedido: PedidoReajuste = { product_ids: ids, mode: modo, value: lerNumero(valorTxt), rounding: terminacao };
  if (usaDirecao(modo)) pedido.direction = direcao;
  return pedido;
}

/** Quantos dos selecionados não têm custo (mesma regra do backend: vazio ou 0). */
export function contarSemCusto(produtos: Array<{ cost?: number | null }>): number {
  return produtos.filter(function (p) { return !(Number(p.cost) > 0); }).length;
}

// ---------------------------------------------------------------- formatos

export function brl(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  var v = Math.round(Number(n) * 100) / 100;
  var neg = v < 0;
  var partes = Math.abs(v).toFixed(2).split(".");
  var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + "R$ " + inteiro + "," + partes[1];
}

/** Fração -> "52%" (margem, sem casas). null -> "sem custo". */
export function margemTxt(f: number | null | undefined): string {
  if (f == null || isNaN(Number(f))) return "sem custo";
  return Math.round(Number(f) * 100) + "%";
}

/** Fração -> "+10,0%" / "-5,3%" (variação). */
export function variacaoTxt(f: number | null | undefined): string {
  if (f == null || isNaN(Number(f))) return "—";
  var pct = Math.round(Number(f) * 1000) / 10;
  var sinal = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return sinal + Math.abs(pct).toFixed(1).replace(".", ",") + "%";
}

export function plural(n: number, um: string, varios: string): string {
  return n.toLocaleString("pt-BR") + " " + (n === 1 ? um : varios);
}

/** Exemplo da terminação, sempre para cima: R$ 53,20 vira R$ 53,90. */
export function exemploTerminacao(t: Terminacao): string | null {
  if (t === "none") return null;
  var vira = t === "90" ? "R$ 53,90" : t === "99" ? "R$ 53,99" : "R$ 54,00";
  return "Arredonda sempre para cima. Exemplo: R$ 53,20 vira " + vira + ".";
}

// ---------------------------------------------------------------- prévia

export type FiltroPrevia = "todos" | "fora" | "abaixo";

export function itensDoFiltro(items: ItemReajuste[], filtro: FiltroPrevia): ItemReajuste[] {
  if (filtro === "fora") return items.filter(function (i) { return i.status === "skipped"; });
  if (filtro === "abaixo") return items.filter(function (i) { return i.status === "change" && i.below_cost; });
  return items;
}

function produtosOnde(items: ItemReajuste[], cond: (i: ItemReajuste) => boolean): string[] {
  var vistos: Record<string, true> = {};
  var ids: string[] = [];
  items.forEach(function (i) {
    if (!cond(i) || vistos[i.product_id]) return;
    vistos[i.product_id] = true;
    ids.push(i.product_id);
  });
  return ids;
}

/** Produtos (não linhas) cujo preço muda: variante conta no produto dela. */
export function produtosQueMudam(items: ItemReajuste[]): string[] {
  return produtosOnde(items, function (i) { return i.status === "change"; });
}

/** Produtos com algum item que ficou de fora (sem custo ou ficaria sem preço). */
export function produtosDeFora(items: ItemReajuste[]): string[] {
  return produtosOnde(items, function (i) { return i.status === "skipped"; });
}

export function produtosAbaixoDoCusto(items: ItemReajuste[]): string[] {
  return produtosOnde(items, function (i) { return i.status === "change" && i.below_cost; });
}

/** "52% → 56%" da margem média, ou null quando nenhum item com custo muda. */
export function margemMediaTxt(r: RespostaReajuste): string | null {
  var s = r.summary;
  if (s.margin_avg_before == null || s.margin_avg_after == null) return null;
  return margemTxt(s.margin_avg_before) + " → " + margemTxt(s.margin_avg_after);
}

/** Nome do item na lista: produto, e a variante depois quando houver. */
export function nomeDoItem(i: { name: string; variant_label: string | null }): string {
  return i.variant_label ? i.name + " · " + i.variant_label : i.name;
}

export function motivoDeFora(i: ItemReajuste): string | null {
  if (i.status !== "skipped") return null;
  if (i.skip_reason === "no_cost") return "fora: sem custo";
  if (i.skip_reason === "not_positive") return "fora: ficaria sem preço";
  return "fora";
}
