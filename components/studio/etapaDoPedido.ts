// ============================================================
// AURA Studio · A etapa de um pedido, com o cancelamento (28/09/2026)
//
// QA final da vitrine Studio (LJ-33, P1). O pedido da loja online tem
// dois status: o do PEDIDO (`status`/`order_status`: pending_payment,
// confirmed, cancelled...) e a etapa da PRODUÇÃO
// (`studio_production_status`). "Recusar pagamento" cancelava só o
// primeiro, e o painel — que lê o segundo — seguia com o pedido em
// "Aguardando arte", com "Solicitar aprovação" e "Marcar como aprovado".
//
// O backend novo (aura-backend, migration 359 + leitura em
// services/cancelamentoDoPedido) já manda 'cancelled'. Esta regra repete
// a leitura no app para o painel não depender da ordem do deploy: pedido
// cancelado é "Cancelado" em todo lugar.
//
// Puro, sem import de componente (Icon quebra no Jest).
// ============================================================
import type { StudioProductionStatus } from "@/constants/studio-status";

type ComEtapa = {
  studio_production_status?: string | null;
  /** status do pedido digital (detalhe e lista /studio/orders). */
  status?: string | null;
  /** status do pedido digital no feed do hub (lá `status` é a etapa). */
  order_status?: string | null;
};

/** A etapa que o painel deve mostrar. `null` quando o pedido não tem etapa. */
export function etapaDoPedido(p: ComEtapa | null | undefined): StudioProductionStatus | null {
  if (!p) return null;
  if (p.status === "cancelled" || p.order_status === "cancelled") return "cancelled";
  return (p.studio_production_status as StudioProductionStatus) || null;
}

/** O mesmo pedido com a etapa corrigida (para listas e o quadro). */
export function comEtapaDoPedido<T extends ComEtapa>(p: T): T {
  const etapa = etapaDoPedido(p);
  return etapa === p.studio_production_status ? p : { ...p, studio_production_status: etapa };
}

/** Pedido que já saiu do fluxo: nada de avançar, aprovar arte ou produzir. */
export function pedidoEncerrado(p: ComEtapa | null | undefined): boolean {
  const etapa = etapaDoPedido(p);
  return etapa === "cancelled" || etapa === "delivered";
}
