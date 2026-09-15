// ============================================================
// AURA. — Quando o painel deve tocar o som de pedido
// Criado: 10/09/2026
//
// Duas fontes chegam na mesma aba: o poll do sino (a cada 30 s) e a
// mensagem do service worker quando o Web Push chega. As duas descrevem o
// mesmo fato com a mesma chave — tipo + entidade ("pedido:<id>") — e o som
// toca uma vez só.
//
// Regras que evitam barulho errado:
//   - a PRIMEIRA carga só aprende o que já existe: abrir o painel não toca
//     pelos pedidos de ontem;
//   - só os três avisos que pedem a lojista agora (pedido novo, comprovante,
//     pagamento confirmado);
//   - não toca por evento já lido nem mais velho que 2 h.
// ============================================================
import type { StoreEvent, NotificationsResponse } from "@/services/notificationsApi";
import { ordersToEvents } from "@/components/notificationEventModel";

export const TIPOS_QUE_TOCAM: readonly string[] = [
  "loja_pedido_novo",
  "loja_comprovante_enviado",
  "loja_pedido_pago",
];

const JANELA_MS = 2 * 60 * 60 * 1000;
const TETO_DE_CHAVES = 500;

export function chaveDoAviso(tipo: string, entidade?: string | null, id?: string | null): string {
  return `${tipo}|${entidade || id || ""}`;
}

/** A mesma junção do hook: eventos do servidor + pedidos do feed de 24 h, sem duplicar. */
export function eventosDaResposta(res: Partial<Pick<NotificationsResponse, "events" | "orders">>): StoreEvent[] {
  const doServidor = res.events || [];
  const jaNoFeed = new Set(doServidor.map((e) => e.entity_id).filter(Boolean) as string[]);
  const dePedidos = ordersToEvents(res.orders || []).filter((e) => !jaNoFeed.has(e.entity_id as string));
  return [...doServidor, ...dePedidos];
}

export function avisosNovos(
  conhecidos: Set<string>,
  eventos: StoreEvent[],
  opts: { primeiraCarga: boolean; agora?: number },
): { novos: StoreEvent[]; conhecidos: Set<string> } {
  const agora = opts.agora ?? Date.now();
  const proximos = new Set(conhecidos);
  const novos: StoreEvent[] = [];
  for (const ev of eventos) {
    const chave = chaveDoAviso(ev.type, ev.entity_id, ev.id);
    if (proximos.has(chave)) continue;
    proximos.add(chave);
    if (opts.primeiraCarga) continue;
    if (!TIPOS_QUE_TOCAM.includes(ev.type)) continue;
    if (ev.read_at) continue;
    const quando = new Date(ev.created_at).getTime();
    if (!Number.isFinite(quando) || agora - quando > JANELA_MS) continue;
    novos.push(ev);
  }
  // Aba aberta por dias: o conjunto não cresce para sempre.
  const lista = [...proximos];
  return { novos, conhecidos: new Set(lista.slice(-TETO_DE_CHAVES)) };
}

export function tocaParaPush(aviso: { type?: string | null } | null | undefined): boolean {
  return !!aviso && TIPOS_QUE_TOCAM.includes(String(aviso.type));
}

/** Chave VAPID (base64url) no formato que o PushManager aceita. */
export function urlBase64ParaBytes(base64url: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}
