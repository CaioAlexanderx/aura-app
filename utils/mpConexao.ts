// ============================================================
// AURA. — Conexão do Mercado Pago por OAuth (tq-96)
//
// Regras puras do cartão "Mercado Pago" no Meu Site, separadas da tela para
// teste. O backend (tq-94) devolve em GET /companies/:id/payment-gateways:
//   gateways[].auth_method        'manual' | 'oauth'
//   gateways[].account_name       nome da conta ("Conectado como")
//   gateways[].connection_status  'ok' | 'caiu'
//   oauth_disponivel              a Aura tem a aplicação do Mercado Pago ligada
//   pode_conectar                 quem está vendo é o dono (ou equipe Aura)
//   pedidos_em_andamento          pedidos com pagamento do MP aguardando
// A volta do Mercado Pago chega no app com ?mp=conectado|negado|erro.
// ============================================================

export type EstadoDoMp = "oculto" | "desconectado" | "conectado" | "caiu";
export type ResultadoDoRetorno = "conectado" | "negado" | "erro" | null;

export type GatewayMp = {
  gateway: string;
  auth_method?: "manual" | "oauth";
  account_name?: string | null;
  connection_status?: "ok" | "caiu";
  sandbox?: boolean;
  created_at?: string;
  updated_at?: string;
};

/** O que o cartão mostra. Sem a aplicação ligada e sem conexão, some. */
export function estadoDoMp(gateway: GatewayMp | null | undefined, oauthDisponivel: boolean): EstadoDoMp {
  if (gateway) return gateway.connection_status === "caiu" ? "caiu" : "conectado";
  return oauthDisponivel ? "desconectado" : "oculto";
}

/** A loja está recebendo pelo Mercado Pago agora (cartão e Pix automático)? */
export function mpRecebendo(gateway: GatewayMp | null | undefined): boolean {
  return !!gateway && gateway.connection_status !== "caiu";
}

export function lerResultadoDoRetorno(valor: unknown): ResultadoDoRetorno {
  const v = String(Array.isArray(valor) ? valor[0] : valor || "").toLowerCase();
  return v === "conectado" || v === "negado" || v === "erro" ? v : null;
}

export function nomeDaConta(gateway: GatewayMp | null | undefined): string {
  const nome = (gateway?.account_name || "").trim();
  return nome || "sua conta do Mercado Pago";
}

/** "desde 21/10" a partir da data da conexão. */
export function desdeQuando(gateway: GatewayMp | null | undefined): string | null {
  const bruto = gateway?.updated_at || gateway?.created_at;
  if (!bruto) return null;
  const d = new Date(bruto);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `desde ${dd}/${mm}`;
}

/** URL atual sem ?mp= (e sem ?empresa=), para não repetir o aviso ao recarregar. */
export function urlSemRetorno(href: string): string | null {
  try {
    const u = new URL(href);
    if (!u.searchParams.has("mp") && !u.searchParams.has("empresa")) return null;
    u.searchParams.delete("mp");
    u.searchParams.delete("empresa");
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** Caminho de volta para depois do Mercado Pago: a tela onde ela está, sem o resultado anterior. */
export function caminhoDeVolta(href: string | null | undefined, padrao = "/canal?tab=site"): string {
  if (!href) return padrao;
  try {
    const u = new URL(href);
    u.searchParams.delete("mp");
    u.searchParams.delete("empresa");
    const caminho = u.pathname + u.search;
    if (!caminho.startsWith("/") || caminho.startsWith("//") || caminho === "/") return padrao;
    return caminho;
  } catch {
    return padrao;
  }
}

export function textoDosPedidosEmAndamento(n: number): string | null {
  if (!n || n < 1) return null;
  // Medido em 29/10: pedido com cartão não tem "confirmar à mão" no painel
  // (filaDePedidos.podeConfirmarPagamento); prometer isso seria falso.
  return n === 1
    ? "Você tem 1 pedido com pagamento em andamento. Se desconectar agora, a confirmação dele deixa de chegar sozinha na Aura. Confira no seu Mercado Pago antes de preparar."
    : `Você tem ${n} pedidos com pagamento em andamento. Se desconectar agora, a confirmação deles deixa de chegar sozinha na Aura. Confira no seu Mercado Pago antes de preparar.`;
}
