// ============================================================
// components/studio/storefront/pedidoGuardado.ts
//
// O pedido que acabou de ser feito, guardado no navegador (Fase 2).
//
// Duas memórias, com trabalhos diferentes:
//
// 1. O PEDIDO EM ANDAMENTO da loja (localStorage, `aura_pending_order_
//    <slug>`, a mesma chave da loja Negócio — migration 121). Serve à
//    proteção contra pedido duplicado (Tela 8): quem volta pelo
//    histórico, abre duas abas ou toca duas vezes criava dois pedidos, e
//    a Sheid recebia duas cobranças do mesmo presente. Serve também à
//    volta do cartão: o Mercado Pago devolve `?order_id=&payment=`, e é
//    daqui que sai o token da página do pedido.
//
// 2. O `order_id` DE CADA TOKEN (sessionStorage, por token). A página
//    `/pedido/<token>` é pública e lida pelo token; "Já paguei" e
//    "Anexar comprovante" usam as rotas da loja comum, que pedem o id. O
//    id nunca vai na URL (o link é reencaminhado no WhatsApp). Em outro
//    aparelho ele não existe — e os dois botões somem, que é o certo.
//
// O storage entra por parâmetro: regra pura, com teste.
// ============================================================

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined;

/** O Pix pendente do Studio cancela sozinho em 72 h (decisão do PO, 25/09). */
export const PRAZO_DO_PIX_MS = 72 * 60 * 60 * 1000;

export function chaveDoPedidoPendente(slug: string): string {
  return "aura_pending_order_" + String(slug || "").trim().toLowerCase();
}

export function chaveDoIdDoPedido(token: string): string {
  return "aura-vitrine-pedido-" + String(token || "").trim();
}

export type PedidoPendente = {
  id: string;
  token: string | null;
  order_number: string | null;
  ts: number;
  payment_method: string | null;
  total: number | null;
  pecas: number;
  /** Miniaturas (URL da foto da peça), para a Tela 8 mostrar o que é. */
  imagens: string[];
  /** O init_point do Mercado Pago: "Tentar outro cartão" volta para ele. */
  card_init_point: string | null;
};

const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Grava o pedido que acabou de ser criado. */
export function guardarPedidoPendente(slug: string, p: Omit<PedidoPendente, "ts">, storage: Armazem, agora = Date.now()): void {
  try { storage?.setItem(chaveDoPedidoPendente(slug), JSON.stringify({ ...p, ts: agora })); } catch { /* sem storage */ }
}

/**
 * O pedido em andamento desta loja, ou null. Vencido (mais de 72 h, quando
 * o Pix já cancelou sozinho) é apagado em silêncio.
 */
export function lerPedidoPendente(slug: string, storage: Armazem, agora = Date.now()): PedidoPendente | null {
  try {
    const raw = storage?.getItem(chaveDoPedidoPendente(slug));
    if (!raw) return null;
    const d = JSON.parse(raw);
    const id = s(d?.id);
    const ts = Number(d?.ts);
    if (!id || !Number.isFinite(ts)) { storage?.removeItem(chaveDoPedidoPendente(slug)); return null; }
    if (agora - ts > PRAZO_DO_PIX_MS) { storage?.removeItem(chaveDoPedidoPendente(slug)); return null; }
    return {
      id,
      token: s(d.token),
      order_number: d.order_number != null ? String(d.order_number) : null,
      ts,
      payment_method: s(d.payment_method),
      total: Number.isFinite(Number(d.total)) ? Number(d.total) : null,
      pecas: Math.max(0, Math.floor(Number(d.pecas) || 0)),
      imagens: Array.isArray(d.imagens) ? d.imagens.filter((x: unknown) => typeof x === "string").slice(0, 4) : [],
      card_init_point: s(d.card_init_point),
    };
  } catch {
    return null;
  }
}

export function esquecerPedidoPendente(slug: string, storage: Armazem): void {
  try { storage?.removeItem(chaveDoPedidoPendente(slug)); } catch { /* idem */ }
}

/** Guarda o id do pedido deste token, na aba. */
export function guardarIdDoPedido(token: string, orderId: string, storage: Armazem): void {
  if (!token || !orderId) return;
  try { storage?.setItem(chaveDoIdDoPedido(token), String(orderId)); } catch { /* idem */ }
}

/** O id do pedido deste token, se foi feito nesta aba. */
export function idDoPedido(token: string, storage: Armazem): string | null {
  try { return s(storage?.getItem(chaveDoIdDoPedido(token))); } catch { return null; }
}

/**
 * O pedido pendente ainda pede a Tela 8? Só se o servidor diz que ele
 * espera pagamento. Pago, cancelado ou vencido: não há o que continuar.
 */
export function aindaEsperaPagamento(pedido: { status?: string | null; payment_status?: string | null } | null | undefined): boolean {
  if (!pedido) return false;
  const pago = ["paid", "confirmed", "received"].includes(String(pedido.payment_status || "").toLowerCase());
  return !pago && (pedido.status === "pending_payment" || pedido.status === "awaiting_approval");
}

// ── A volta do cartão ────────────────────────────────────────

export type RetornoDoCartao = { orderId: string; resultado: "approved" | "pending" | "failed" };

/**
 * O que o Mercado Pago devolveu no back_url (`?order_id=&payment=`, o
 * mesmo contrato do bootstrap.js da loja Negócio), ou null.
 */
export function lerRetornoDoCartao(search: string | null | undefined): RetornoDoCartao | null {
  let q: URLSearchParams;
  try { q = new URLSearchParams(String(search || "")); } catch { return null; }
  const orderId = s(q.get("order_id"));
  const p = s(q.get("payment"))?.toLowerCase();
  if (!orderId || !p) return null;
  const resultado = p === "approved" ? "approved" : p === "failed" || p === "rejected" ? "failed" : "pending";
  return { orderId, resultado };
}
