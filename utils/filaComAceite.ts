// ============================================================
// AURA. — Fila do pedido com aceite (tq-47, 29/10/2026)
//
// Desenho da Nina (19/10), piloto numa adega. O pedido de pagar na entrega
// chega "Aguardando aceite"; a lojista aceita com o tempo de preparo ou
// recusa com um motivo, marca "saiu para entrega" e "entregue", e avisa a
// cliente pelo WhatsApp dela com o texto pronto que o backend devolve.
//
// Acréscimos da Nina: pedido sem resposta NÃO cancela sozinho; a fila
// destaca o pedido parado depois de 10 min ("há 12 min sem resposta") e o
// aviso de pedido novo se repete UMA vez.
//
// Funções puras (testadas sem montar a tela), como utils/filaDePedidos.ts.
// ============================================================
import { PROXIMO_STATUS, rotuloDoStatus, type PedidoDaFila } from "@/utils/filaDePedidos";

/** Tempos de preparo oferecidos no aceite, em minutos. */
export const TEMPOS_DE_PREPARO = [30, 45, 60] as const;
export const PREPARO_PADRAO = 45;

/** Depois de quantos minutos sem resposta o pedido ganha destaque. */
export const PARADO_MIN = 10;
/** O aviso repetido só vale para pedido parado há no máximo isto (abrir a tela não toca por pedido velho). */
const REPETIR_ATE_MIN = 30;

/** Motivos rápidos da recusa (a lojista pode escrever outro). */
export const MOTIVOS_RAPIDOS = [
  "Acabou um dos produtos",
  "Fora da área de entrega",
  "A loja está fechando",
] as const;

export const AVISO_DO_PIX_PAGO =
  "Se a cliente já pagou o Pix, devolva o valor por fora e marque como devolvido.";

/**
 * A lojista pode aceitar ou recusar este pedido? Pagar na entrega esperando
 * aceite, sempre; Pix/cartão pago e ainda sem aceite, só na loja que usa a
 * fila com aceite (`fila_com_aceite` da lista).
 */
export function podeAceitar(o: PedidoDaFila | null | undefined, filaComAceite = false): boolean {
  if (!o) return false;
  if (o.status === "aguardando_aceite") return true;
  // Revisão do #930: `accepted_at` é nulo em todo o histórico. Só o pedido
  // pago que NASCEU na fila (`aceite_na_fila`, gravado no checkout) e com a
  // loja ainda na fila. Pago antes de a loja ligar as formas, ou em loja
  // sem formas, fica exatamente como hoje.
  return filaComAceite && o.status === "confirmed" && !o.accepted_at && o.aceite_na_fila === true;
}

/** Minutos desde que o pedido chegou. */
export function minutosDesde(iso: string | null | undefined, agora: number = Date.now()): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((agora - t) / 60000));
}

/** "há 12 min sem resposta" para o pedido parado; null antes de 10 min ou se não espera aceite. */
export function textoDoPedidoParado(o: PedidoDaFila, filaComAceite = false, agora: number = Date.now()): string | null {
  if (!podeAceitar(o, filaComAceite)) return null;
  const min = minutosDesde(o.created_at, agora);
  if (min < PARADO_MIN) return null;
  if (min < 60) return `há ${min} min sem resposta`;
  const h = Math.floor(min / 60);
  return `há ${h} h sem resposta`;
}

/**
 * Pedidos que devem repetir o aviso de pedido novo agora: esperando aceite,
 * parados entre 10 e 30 min, e ainda não repetidos (`jaRepetidos`).
 */
export function pedidosParaRepetirAviso(
  pedidos: PedidoDaFila[], jaRepetidos: Set<string>, agora: number = Date.now(),
): PedidoDaFila[] {
  return pedidos.filter((o) => {
    if (o.status !== "aguardando_aceite" || jaRepetidos.has(o.id)) return false;
    const min = minutosDesde(o.created_at, agora);
    return min >= PARADO_MIN && min <= REPETIR_ATE_MIN;
  });
}

/** "21:55" — hora local de quando o pedido deve ficar pronto. null sem aceite ou sem tempo. */
export function horaPrevista(o: PedidoDaFila): string | null {
  const aceito = o.accepted_at ? new Date(o.accepted_at).getTime() : NaN;
  const min = Number(o.prep_minutes);
  if (!Number.isFinite(aceito) || !Number.isFinite(min) || min <= 0) return null;
  const d = new Date(aceito + min * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type ProximoPasso =
  | { acao: "saiu"; rotulo: string }
  | { acao: "status"; status: string; rotulo: string };

/**
 * O botão principal do pedido em andamento. Entrega aceita pela fila:
 * em preparo/pronto -> "Saiu para entrega" -> "Marcar como entregue".
 * O resto segue o PROXIMO_STATUS de sempre.
 */
export function proximoPasso(o: PedidoDaFila): ProximoPasso | null {
  if (o.status === "out_for_delivery") return { acao: "status", status: "delivered", rotulo: "Marcar como entregue" };
  if ((o.status === "preparing" || o.status === "ready") && o.delivery_type === "delivery" && o.accepted_at) {
    return { acao: "saiu", rotulo: "Saiu para entrega" };
  }
  const proximo = PROXIMO_STATUS[o.status];
  if (!proximo) return null;
  return { acao: "status", status: proximo, rotulo: `Marcar como ${rotuloDoStatus(proximo).toLowerCase()}` };
}

/** Lembrete do entregador quando o pagamento é na porta. */
export function lembreteNaEntrega(o: PedidoDaFila): string | null {
  if (o.payment_method !== "on_delivery" || o.status !== "out_for_delivery") return null;
  if (o.pay_on_delivery_method === "cash") return "Pagamento em dinheiro: confirme o recebimento ao entregar.";
  if (o.pay_on_delivery_method === "card") return "Pagamento no cartão: leve a maquininha.";
  if (o.pay_on_delivery_method === "pix") return "Pagamento por Pix na hora: confira o Pix antes de entregar.";
  return null;
}

export type AvisoWhatsapp = { passo: string; texto: string; link: string | null };

/** O que a faixa de "avise a cliente" diz depois de uma ação. */
export function tituloDoAviso(passo: string, numero: string | number): string {
  switch (passo) {
    case "aceito": return `Pedido #${numero} aceito.`;
    case "recusado": return `Pedido #${numero} recusado.`;
    case "saiu": return `Pedido #${numero} saiu para entrega.`;
    case "entregue": return `Pedido #${numero} entregue.`;
    default: return `Pedido #${numero} atualizado.`;
  }
}
