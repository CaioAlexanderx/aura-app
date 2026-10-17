// ============================================================
// AURA. — Comandas do Caixa: as contas puras (09/10/2026)
//
// A adega do Luis Henrique vende para quem fica no balcão e paga no fim. O
// Caixa ganhou a comanda leve: o operador digita os produtos, manda para a
// comanda N, e no fim "Fechar comanda" traz o consumo de volta para o
// carrinho e cobra como uma venda qualquer.
//
// Aqui fica tudo que não precisa de tela nem de rede — e por isso tem teste
// (__tests__/comanda.test.ts):
//   · numeroDaComanda        — o que o operador digitou vira 1..9999 ou null;
//   · itensParaAComanda      — carrinho → itens do POST (chave "prod__var");
//   · linhasParaOCarrinho    — comanda → linhas do carrinho, com a taxa de
//                              serviço como uma linha própria;
//   · taxaDeServico          — 10% do consumo, em centavos certos;
//   · nomeDaComanda /
//     rotuloDaComanda        — o nome opcional (17/10, tc-01) e o "12 · João";
//   · htmlDoConsumo          — o cupom de conferência (não é venda).
// ============================================================

/** Taxa de serviço oferecida no fechamento. */
export const TAXA_DE_SERVICO_PCT = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O id é de produto do cadastro? (chaves sintéticas do carrinho não são.) */
export function ehIdDeCatalogo(id: string | null | undefined): boolean {
  return !!id && UUID_RE.test(String(id));
}

type ComAChave = { comanda_enabled?: unknown } | null | undefined;

/** A loja usa comanda? Só `true` liga (undefined = backend antigo). */
export function lerComandaEnabled(settings: ComAChave): boolean {
  return !!settings && (settings as any).comanda_enabled === true;
}

/** "12", " 012 " → 12. Vazio, zero, letra ou acima de 9999 → null. */
export function numeroDaComanda(texto: string | number | null | undefined): number | null {
  const s = String(texto == null ? "" : texto).trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 && n <= 9999 ? n : null;
}

/** Até quantos caracteres vai o nome da comanda (o backend corta igual). */
export const MAX_NOME_DA_COMANDA = 40;

/** O nome digitado como o backend grava: aparado, espaços colapsados, até
 *  40 caracteres. Vazio → "" (não manda nome). */
export function nomeDaComanda(texto: string | null | undefined): string {
  const s = String(texto == null ? "" : texto).replace(/\s+/g, " ").trim();
  return Array.from(s).slice(0, MAX_NOME_DA_COMANDA).join("").trim();
}

/** "12" ou "12 · João" — como a comanda aparece nas fichas e nos avisos. */
export function rotuloDaComanda(number: number, name?: string | null): string {
  const n = nomeDaComanda(name);
  return n ? number + " · " + n : String(number);
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** `cashPrice` só existe com o preço no cartão ligado: aí `price` é o do
 *  chip escolhido, e o que vai para a comanda é sempre o do dinheiro — a
 *  forma de pagamento só se decide no fechamento. */
export type ItemDoCarrinho = { productId: string; name: string; price: number; qty: number; unit?: string | null; cashPrice?: number };

export type ItemParaAComanda = {
  product_id: string | null;
  variant_id: string | null;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
};

/** Carrinho → corpo do lançamento. A chave do carrinho é "produto__variação". */
export function itensParaAComanda(cart: ItemDoCarrinho[]): ItemParaAComanda[] {
  return (cart || []).filter((i) => i.qty > 0).map((i) => {
    const idx = i.productId.indexOf("__");
    const pid = idx < 0 ? i.productId : i.productId.slice(0, idx);
    const vid = idx < 0 ? null : i.productId.slice(idx + 2);
    return {
      product_id: ehIdDeCatalogo(pid) ? pid : null,
      variant_id: ehIdDeCatalogo(vid) ? vid : null,
      name: i.name,
      unit: i.unit || null,
      quantity: i.qty,
      unit_price: round2(i.cashPrice != null ? i.cashPrice : i.price),
    };
  });
}

export type ItemDaComanda = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  total: number;
};

export type Comanda = {
  id: string;
  number: number;
  /** Nome opcional (17/10, tc-01; backend migration 389). Ausente/null =
   *  só o número (backend antigo ou comanda aberta sem nome). */
  name?: string | null;
  status: string;
  opened_at: string;
  items: ItemDaComanda[];
  items_count: number;
  subtotal: number;
};

/** Valor da taxa de serviço sobre o consumo. */
export function taxaDeServico(subtotal: number, pct: number): number {
  if (!(pct > 0)) return 0;
  return round2((Number(subtotal) || 0) * pct / 100);
}

export type LinhaDoCarrinho = { key: string; name: string; price: number; qty: number; unit?: string };

/**
 * Comanda → linhas do carrinho. O mesmo produto lançado três vezes ao longo
 * da noite vira UMA linha com a quantidade somada — desde que o preço seja o
 * mesmo; preço diferente (promoção que acabou) fica em linha própria, senão
 * o carrinho cobraria tudo pelo último preço.
 * Com `taxaPct`, a taxa de serviço entra como uma linha sem produto.
 */
export function linhasParaOCarrinho(comanda: Comanda, taxaPct: number = 0): LinhaDoCarrinho[] {
  const linhas: LinhaDoCarrinho[] = [];
  const porChave = new Map<string, LinhaDoCarrinho>();
  for (const it of comanda.items || []) {
    const base = it.product_id
      ? it.product_id + (it.variant_id ? "__" + it.variant_id : "")
      : "comanda-" + comanda.id + "-" + it.id;
    const preco = round2(it.unit_price);
    // Mesmo produto com outro preço: chave própria (sufixo fora do padrão
    // "__variação", para não ser lido como variação na hora da venda).
    const repetido = porChave.get(base);
    const chave = repetido && repetido.price !== preco ? "comanda-" + comanda.id + "-" + it.id : base;
    const existente = porChave.get(chave);
    if (existente) {
      existente.qty = Math.round((existente.qty + it.quantity) * 1000) / 1000;
      continue;
    }
    const linha: LinhaDoCarrinho = { key: chave, name: it.name, price: preco, qty: it.quantity, ...(it.unit ? { unit: it.unit } : {}) };
    porChave.set(chave, linha);
    linhas.push(linha);
  }
  const taxa = taxaDeServico(comanda.subtotal, taxaPct);
  if (taxa > 0) {
    linhas.push({ key: chaveDaTaxa(comanda.id), name: `Taxa de serviço (${taxaPct}%)`, price: taxa, qty: 1 });
  }
  return linhas;
}

export function chaveDaTaxa(comandaId: string): string {
  return "comanda-taxa-" + comandaId;
}

function esc(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function brl(n: number): string {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qtd(n: number): string {
  return String(Math.round((Number(n) || 0) * 1000) / 1000).replace(".", ",");
}

/**
 * Cupom de conferência do consumo (80 mm). NÃO é a venda: é o papel que o
 * cliente confere antes de pagar. Fonte de sistema e traço cheio — fonte fina
 * some na térmica.
 */
export function htmlDoConsumo(opts: { comanda: Comanda; loja: string; taxaPct: number; agora?: Date }): string {
  const { comanda, loja, taxaPct } = opts;
  const taxa = taxaDeServico(comanda.subtotal, taxaPct);
  const total = round2(comanda.subtotal + taxa);
  const quando = (opts.agora || new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const linhas = (comanda.items || []).map((it) =>
    "<tr><td>" + qtd(it.quantity) + "x " + esc(it.name) + "</td><td class=\"v\">" + brl(it.total) + "</td></tr>"
  ).join("");
  return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Comanda " + comanda.number + "</title>" +
    "<style>@page{size:80mm auto;margin:4mm}body{font-family:Consolas,'Lucida Console',monospace;font-size:12px;color:#000;margin:0;width:72mm}" +
    "h1{font-size:15px;margin:0 0 2px;text-align:center}.c{text-align:center}.l{border-top:1px solid #000;margin:6px 0}" +
    "table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}.v{text-align:right;white-space:nowrap;padding-left:6px}" +
    ".t td{font-weight:700;font-size:14px;padding-top:4px}.n{font-size:10px;text-align:center;margin-top:8px}</style></head><body>" +
    "<h1>" + esc(loja) + "</h1><div class=\"c\">COMANDA " + esc(rotuloDaComanda(comanda.number, comanda.name)) + "</div><div class=\"c\">" + esc(quando) + "</div>" +
    "<div class=\"l\"></div><table>" + linhas + "</table><div class=\"l\"></div><table>" +
    "<tr><td>Consumo</td><td class=\"v\">" + brl(comanda.subtotal) + "</td></tr>" +
    (taxa > 0 ? "<tr><td>Taxa de serviço (" + taxaPct + "%)</td><td class=\"v\">" + brl(taxa) + "</td></tr>" : "") +
    "<tr class=\"t\"><td>TOTAL</td><td class=\"v\">" + brl(total) + "</td></tr></table>" +
    "<div class=\"n\">Conferência de consumo. Não é documento fiscal.</div>" +
    "<script>window.onload=function(){window.print();}</script></body></html>";
}

// ── Painel das abertas (17/10/2026, tc-02) ───────────────────
// O painel "Comandas" do Caixa lista todas as abertas com há quanto tempo
// cada uma está aberta. As contas ficam aqui (testadas em
// __tests__/comandasAbertasPainel.test.tsx).

/** Daqui (minutos) em diante o tempo fica âmbar: quem ainda não pagou. Fixo
 *  por decisão do Caio (17/10); vira configuração só se alguma loja pedir. */
export const ALERTA_DA_COMANDA_MIN = 180;

/** Minutos desde `opened_at`. Data inválida → null (o painel não mostra
 *  tempo nem alerta). Relógio da máquina atrasado não dá tempo negativo. */
export function minutosAberta(openedAt: string | null | undefined, agora: number): number | null {
  if (!openedAt) return null;
  const t = Date.parse(openedAt);
  if (!isFinite(t)) return null;
  return Math.max(0, Math.floor((agora - t) / 60000));
}

/** "agora", "há 18 min", "há 2h14", "há 3h", "há 2 dias". */
export function tempoDaComanda(min: number | null): string {
  if (min == null) return "";
  if (min < 1) return "agora";
  if (min < 60) return "há " + min + " min";
  if (min >= 48 * 60) return "há " + Math.floor(min / 1440) + " dias";
  const h = Math.floor(min / 60), m = min % 60;
  return "há " + h + "h" + (m ? String(m).padStart(2, "0") : "");
}

export function comandaVelha(min: number | null): boolean {
  return min != null && min >= ALERTA_DA_COMANDA_MIN;
}

export type OrdemDasComandas = "antigas" | "numero";

type ParaOrdenar = { number: number; opened_at?: string | null };

/** "antigas" (padrão): a aberta há mais tempo primeiro; sem data vai para o
 *  fim. "numero": crescente. Não muda a lista recebida. */
export function ordenarComandas<T extends ParaOrdenar>(lista: T[], ordem: OrdemDasComandas): T[] {
  const copia = (lista || []).slice();
  if (ordem === "numero") return copia.sort(function (a, b) { return a.number - b.number; });
  return copia.sort(function (a, b) {
    const ta = a.opened_at ? Date.parse(a.opened_at) : NaN;
    const tb = b.opened_at ? Date.parse(b.opened_at) : NaN;
    const va = isFinite(ta), vb = isFinite(tb);
    if (va && vb && ta !== tb) return ta - tb;
    if (va !== vb) return va ? -1 : 1;
    return a.number - b.number;
  });
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Busca do painel: número que começa com o digitado ou nome que contém o
 *  texto (sem diferença de acento nem de maiúscula). */
export function filtrarComandas<T extends { number: number; name?: string | null }>(lista: T[], busca: string): T[] {
  const q = semAcento(String(busca || "").trim());
  if (!q) return lista;
  return lista.filter(function (c) {
    if (/^\d+$/.test(q) && String(c.number).startsWith(q)) return true;
    return !!c.name && semAcento(c.name).includes(q);
  });
}
