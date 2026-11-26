// ============================================================
// AURA. — Personalizados: "Tirar da fila" (C1, 26/11/2026)
//
// Tirar o pedido da Fila de produção NÃO cancela a venda nem mexe no
// dinheiro: só esconde o cartão (coluna nova no backend, migration). Pedido
// com valor já recebido o backend recusa com TEM_RECEBIMENTO; aí a tela avisa
// e leva ao cancelamento do pedido, que é quem cuida do dinheiro.
//
// CAMINHO ISOLADO. O contrato do backend (agente à parte) ainda não estava
// fechado quando isto foi escrito: a rota e o formato do erro estão só aqui,
// neste arquivo. Se mudarem, muda este arquivo e mais nada.
//   POST /companies/:cid/studio/orders/:oid/tirar-da-fila
//   erro 409 com { error: "TEM_RECEBIMENTO" } (ou code), pedido com valor recebido.
// ============================================================
import { request } from "@/services/api";

export const TEXTO_DE_TIRAR_DA_FILA = {
  titulo: "Tirar da fila?",
  corpo: "A venda e o dinheiro continuam como estão.",
  confirmar: "Tirar da fila",
  feito: "Tirado da fila. A venda e o dinheiro continuam como estão.",
  temRecebimentoTitulo: "Este pedido tem valor recebido",
  temRecebimentoCorpo: "Tirar da fila não mexe no dinheiro. Para desfazer o pedido, o caminho é o cancelamento do pedido.",
  irParaCancelamento: "Ir para o cancelamento do pedido",
} as const;

export function tirarDaFila(companyId: string, orderId: string) {
  return request<{ ok?: boolean }>(
    `/companies/${companyId}/studio/orders/${orderId}/tirar-da-fila`,
    { method: "POST", body: {}, retry: 0, timeout: 8000 },
  );
}

/** A recusa do backend por valor já recebido. */
export function ehTemRecebimento(e: any): boolean {
  const cod = [e?.code, e?.error, e?.data?.error, e?.data?.code, e?.data?.codigo];
  return cod.some((c) => typeof c === "string" && c.toUpperCase() === "TEM_RECEBIMENTO");
}
