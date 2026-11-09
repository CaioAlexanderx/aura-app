// ============================================================
// AURA. — Editar venda: regras de tela, sem React (09/11/2026)
//
// O que a tela de edição precisa calcular sozinha, antes de perguntar ao
// servidor: rótulo de cada forma, soma das formas contra o total, qual corpo
// mandar ao PATCH (só o que mudou: campo ausente não mexe) e em que campo
// mostrar cada efeito que o dry_run devolve. A regra de negócio mora no
// backend (services/editarVenda.js, Aura-backend#972); aqui é só apresentação.
// ============================================================
import type { SaleEditBody, SaleEditContext, SaleEditEffect, SaleEditPlan, SalePaymentPill } from "@/services/salesApi";

export type Metodo = "dinheiro" | "pix" | "debito" | "cartao" | "crediario";

export const METODOS: { key: Metodo; label: string; icon: string }[] = [
  { key: "dinheiro", label: "Dinheiro", icon: "cash" },
  { key: "pix", label: "Pix", icon: "pix" },
  { key: "debito", label: "Débito", icon: "credit_card" },
  { key: "cartao", label: "Crédito", icon: "credit_card" },
  { key: "crediario", label: "Crediário", icon: "calendar" },
];

const APELIDOS: Record<string, Metodo> = {
  dinheiro: "dinheiro", cash: "dinheiro",
  pix: "pix",
  debito: "debito", "débito": "debito", cartao_debito: "debito", debit: "debito",
  cartao: "cartao", credito: "cartao", "crédito": "cartao", cartao_credito: "cartao", credit: "cartao",
  crediario: "crediario", "crediário": "crediario", fiado: "crediario",
};

export function normalizarMetodo(m: string | null | undefined): Metodo | null {
  return APELIDOS[String(m || "").trim().toLowerCase()] || null;
}

const ROTULO_EXTRA: Record<string, string> = {
  crediario_credito: "Crédito da troca",
  voucher: "Voucher",
  vale: "Vale",
  sinal: "Sinal",
  on_delivery: "Pagar na entrega",
};

export function rotuloDaForma(m: string | null | undefined): string {
  const n = normalizarMetodo(m);
  if (n) return (METODOS.find((x) => x.key === n) as { label: string }).label;
  const raw = String(m || "").toLowerCase();
  if (ROTULO_EXTRA[raw]) return ROTULO_EXTRA[raw];
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "—";
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function brl(n: number | null | undefined): string {
  const v = round2(Number(n) || 0);
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "-" : "") + "R$ " + int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

/** "100", "100,5", "1.234,56", "R$ 89,70" -> número (NaN quando não dá). */
export function lerValor(txt: string): number {
  const limpo = String(txt || "").replace(/[^\d,.-]/g, "");
  if (!limpo) return NaN;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = parseFloat(normal);
  return Number.isFinite(n) ? round2(n) : NaN;
}

export function valorParaCampo(n: number): string {
  return round2(n).toFixed(2).replace(".", ",");
}

/** 'AAAA-MM-DD' -> 'DD/MM' */
export function ddmm(dia: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dia || ""));
  return m ? m[3] + "/" + m[2] : "";
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
export function ddmmaaaa(dia: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dia || ""));
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

/** 'DD/MM/AAAA' -> 'AAAA-MM-DD' (null quando não é uma data). */
export function lerDia(txt: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(txt || "").trim());
  if (!m) return null;
  const iso = m[3] + "-" + m[2] + "-" + m[1];
  const d = new Date(iso + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Mesma soma de meses do backend (fica no último dia quando o dia não existe). */
export function somarMes(dia: string, n: number): string {
  const d = new Date(dia + "T00:00:00Z");
  const total = d.getUTCMonth() + n;
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), total + 1, 0)).getUTCDate();
  const dd = Math.min(d.getUTCDate(), ultimo);
  return new Date(Date.UTC(d.getUTCFullYear(), total, dd)).toISOString().slice(0, 10);
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
    const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    return dia + " às " + hora;
  } catch (_) { return String(iso); }
}

export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  } catch (_) { return ""; }
}

/** "Editada em 08/11 por Ana" */
export function rotuloDaEdicao(edit: { at: string; by_name: string | null } | null | undefined): string | null {
  if (!edit || !edit.at) return null;
  let dia = "";
  try {
    dia = new Date(edit.at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  } catch (_) { dia = ""; }
  return "Editada em " + dia + (edit.by_name ? " por " + edit.by_name : "");
}

/** (11) 9····-··21 — o detalhe mostra que há telefone sem expor o número. */
export function mascararTelefone(tel: string | null | undefined): string | null {
  const dig = String(tel || "").replace(/\D/g, "");
  if (dig.length < 8) return null;
  const local = dig.length > 11 ? dig.slice(-11) : dig;
  const ddd = local.length >= 10 ? local.slice(0, 2) : "";
  return (ddd ? "(" + ddd + ") " : "") + "9····-··" + local.slice(-2);
}

export function mesDaVenda(dia: string | null | undefined): string {
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const m = /^\d{4}-(\d{2})/.exec(String(dia || ""));
  return m ? MESES[parseInt(m[1], 10) - 1] : "";
}

/** Dia da venda em São Paulo ('AAAA-MM-DD'). */
export function diaEmSaoPaulo(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } catch (_) { return ""; }
}

// ── Formas digitadas ─────────────────────────────────────────
export type LinhaDeForma = { method: Metodo; valor: string };

export function linhasIniciais(pagamentos: SalePaymentPill[], total: number): LinhaDeForma[] {
  const linhas: LinhaDeForma[] = [];
  for (const p of pagamentos || []) {
    const m = normalizarMetodo(p.method);
    if (!m) continue;
    linhas.push({ method: m, valor: valorParaCampo(p.amount) });
  }
  if (!linhas.length) linhas.push({ method: "dinheiro", valor: valorParaCampo(total) });
  return linhas;
}

export function agrupar(lista: { method: string; amount: number }[]): { method: Metodo; amount: number }[] {
  const mapa = new Map<Metodo, number>();
  for (const p of lista) {
    const m = normalizarMetodo(p.method);
    if (!m || !(p.amount > 0)) continue;
    mapa.set(m, round2((mapa.get(m) || 0) + p.amount));
  }
  return METODOS.map((x) => x.key).filter((k) => mapa.has(k)).map((k) => ({ method: k, amount: mapa.get(k) as number }));
}

export function formasDasLinhas(linhas: LinhaDeForma[]): { method: Metodo; amount: number }[] {
  return agrupar(linhas.map((l) => ({ method: l.method, amount: lerValor(l.valor) })));
}

export function mesmasFormas(a: { method: string; amount: number }[], b: { method: string; amount: number }[]): boolean {
  const x = agrupar(a); const y = agrupar(b);
  return x.length === y.length && x.every((p, i) => p.method === y[i].method && Math.abs(p.amount - y[i].amount) < 0.005);
}

/** Soma das formas contra o total da venda, em texto para o rodapé do campo. */
export function conferirSoma(total: number, linhas: LinhaDeForma[]): { ok: boolean; soma: number; texto: string } {
  const valores = linhas.map((l) => lerValor(l.valor));
  if (valores.some((v) => !(v > 0))) return { ok: false, soma: NaN, texto: "Preencha o valor de cada forma." };
  const soma = round2(valores.reduce((a, v) => a + v, 0));
  const dif = round2(total - soma);
  if (Math.abs(dif) < 0.005) return { ok: true, soma, texto: "Fechou certinho" };
  if (dif > 0) return { ok: false, soma, texto: "Faltam " + brl(dif) };
  return { ok: false, soma, texto: "Passou " + brl(-dif) };
}

// ── Corpo do PATCH ───────────────────────────────────────────
export type Escolhas = {
  sellerId: string | null | undefined;      // undefined = não mexeu
  customer: { id: string; name: string } | null | undefined;
  linhas: LinhaDeForma[];
  parcelas: number;
  primeiraParcela: string | null;           // 'AAAA-MM-DD'
};

export type Mudanca = "payments" | "seller" | "customer";

/**
 * Só o que mudou vai no corpo. Campo ausente não mexe na venda (ausente ≠
 * null): o PATCH antigo zerava o vendedor quando ele não vinha.
 */
export function montarCorpo(ctx: SaleEditContext, e: Escolhas): { body: SaleEditBody; mudancas: Mudanca[] } {
  const body: SaleEditBody = {};
  const mudancas: Mudanca[] = [];

  const vendAtual = (ctx.current.seller && ctx.current.seller.id) || null;
  if (e.sellerId !== undefined && String(e.sellerId || "") !== String(vendAtual || "")) {
    body.seller_id = e.sellerId || null;
    mudancas.push("seller");
  }
  const cliAtual = (ctx.current.customer && ctx.current.customer.id) || null;
  if (e.customer !== undefined && String((e.customer && e.customer.id) || "") !== String(cliAtual || "")) {
    body.customer_id = e.customer ? e.customer.id : null;
    mudancas.push("customer");
  }

  const novas = formasDasLinhas(e.linhas);
  const temCred = novas.some((p) => p.method === "crediario");
  const credAtual = ctx.current.credit;
  const formasMudaram = !mesmasFormas(novas, ctx.current.payments || []);
  const termosMudaram = !!(temCred && credAtual && (
    e.parcelas !== credAtual.installments ||
    String(e.primeiraParcela || "") !== String(credAtual.first_due_date || "")
  ));
  if (formasMudaram || termosMudaram) {
    body.payments = novas.map((p) => ({ method: p.method, amount: p.amount }));
    if (temCred) {
      body.installments = e.parcelas;
      if (e.primeiraParcela) body.first_due_date = e.primeiraParcela;
    }
    mudancas.push("payments");
  }
  return { body, mudancas };
}

export function rotuloDasMudancas(m: string[]): string {
  if (!m.length) return "Nada mudou ainda";
  const nomes: Record<string, string> = { payments: "forma de pagamento", seller: "vendedor(a)", customer: "cliente" };
  if (m.length === 1) return "1 mudança: " + nomes[m[0]];
  return m.length + " mudanças";
}

// ── Efeitos do dry_run, campo a campo ───────────────────────
const CAMPO_DO_EFEITO: Record<string, Mudanca> = {
  CASH_CHANGED: "payments", CASH_REMOVED: "payments", DRAWER_CHANGES: "payments", CARD_FEE_CHANGES: "payments",
  CREDIT_ENTERS: "payments", CREDIT_LEAVES: "payments", CREDIT_RECREATED: "payments", GOES_TO_RECEIVABLE: "payments",
  CAIXA_CLOSED: "payments", CAIXA_OPEN: "payments",
  CREDIT_MOVES: "customer", CUSTOMER_HISTORY: "customer",
  COMMISSION_MOVES: "seller",
};

export function efeitosDoCampo(plan: SaleEditPlan | null | undefined, campo: Mudanca): SaleEditEffect[] {
  if (!plan) return [];
  return [...(plan.effects || []), ...(plan.warnings || [])].filter((e) => CAMPO_DO_EFEITO[e.code] === campo);
}

/** Antes/depois das formas em texto curto ("Pix R$ 189,70", "Crediário em 3x"). */
export function resumoDasFormas(lista: SalePaymentPill[] | null | undefined): string {
  const l = lista || [];
  if (!l.length) return "—";
  if (l.length === 1) {
    const p = l[0];
    if (normalizarMetodo(p.method) === "crediario") return "Crediário em " + (p.installments || 1) + "x";
    return rotuloDaForma(p.method) + " " + brl(p.amount);
  }
  return l.map((p) => (normalizarMetodo(p.method) === "crediario"
    ? "Crediário " + brl(p.amount) + " em " + (p.installments || 1) + "x"
    : rotuloDaForma(p.method) + " " + brl(p.amount))).join(" + ");
}

/** Aviso de NFC-e no topo da edição (mockup 4d). */
export function avisoDaNota(nfce: SaleEditContext["nfce"], agora = Date.now()): { texto: string; podeCancelar: boolean; ate: string | null } | null {
  if (!nfce) return null;
  const ate = nfce.cancel_until ? fmtHora(nfce.cancel_until) : null;
  const podeCancelar = !!(nfce.cancel_until && agora < new Date(nfce.cancel_until).getTime());
  const n = nfce.numero ? " " + nfce.numero : "";
  const rotulo = nfce.tipo === "nfe" ? "NF-e" : "NFC-e";
  return {
    texto: "A " + rotulo + n + " já foi autorizada e não muda depois disso. O que você mudar aqui vale para o Financeiro, o caixa e a comissão.",
    podeCancelar,
    ate,
  };
}

/** Busca da lista (vendedor(a) e cliente): nome ou subtítulo (telefone, e-mail). */
export function filtrarPorBusca<T extends { name: string; subtitle?: string | null }>(lista: T[], busca: string, limite = 30): T[] {
  const q = String(busca || "").trim().toLowerCase();
  if (!q) return lista.slice(0, limite);
  const digitos = q.replace(/\D/g, "");
  return lista.filter((o) => {
    const nome = (o.name || "").toLowerCase();
    const sub = String(o.subtitle || "").toLowerCase();
    return nome.includes(q) || sub.includes(q) || (digitos.length >= 3 && sub.replace(/\D/g, "").includes(digitos));
  }).slice(0, limite);
}
