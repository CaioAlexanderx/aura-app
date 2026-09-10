// ============================================================
// AURA. — Aviso de pedido no computador (Web Push) — lado do navegador
// Criado: 10/09/2026
//
// O backend (services/webPush.js, rota /companies/:id/web-push) guarda a
// inscrição e envia. Aqui: registrar o service worker (public/sw.js), pedir
// permissão, inscrever com a chave VAPID do servidor e reafirmar a inscrição
// ao abrir o painel (troca de empresa, banco que perdeu a linha).
//
// Limite conhecido: no iPhone/iPad o Safari só entrega Web Push para o
// painel ADICIONADO À TELA DE INÍCIO. Fora disso, estado "indisponivel".
// ============================================================
import { request } from "@/services/api";
import { urlBase64ParaBytes } from "@/utils/avisosDePedido";

export type EstadoDoAviso = "indisponivel" | "bloqueado" | "ativo" | "inativo";

const CAMINHO_DO_SW = "/sw.js";

export function suportaAvisoNoNavegador(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let _registro: Promise<ServiceWorkerRegistration | null> | null = null;

export function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!suportaAvisoNoNavegador()) return Promise.resolve(null);
  if (!_registro) {
    _registro = navigator.serviceWorker
      .register(CAMINHO_DO_SW)
      .then(() => navigator.serviceWorker.ready)
      .catch(() => {
        _registro = null;
        return null;
      });
  }
  return _registro;
}

export async function estadoDoAviso(): Promise<EstadoDoAviso> {
  if (!suportaAvisoNoNavegador()) return "indisponivel";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await registrarServiceWorker();
  if (!reg) return "indisponivel";
  const inscricao = await reg.pushManager.getSubscription();
  return inscricao && Notification.permission === "granted" ? "ativo" : "inativo";
}

async function inscreverNoServidor(companyId: string, inscricao: PushSubscription): Promise<void> {
  await request(`/companies/${companyId}/web-push/subscribe`, {
    method: "POST",
    body: inscricao.toJSON(),
  });
}

export async function ativarAviso(companyId: string): Promise<EstadoDoAviso> {
  if (!suportaAvisoNoNavegador()) return "indisponivel";
  const permissao = await Notification.requestPermission();
  if (permissao === "denied") return "bloqueado";
  if (permissao !== "granted") return "inativo";
  const reg = await registrarServiceWorker();
  if (!reg) return "indisponivel";
  const { public_key } = await request<{ public_key: string }>(`/companies/${companyId}/web-push/public-key`);
  let inscricao = await reg.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ParaBytes(public_key) as any,
    });
  }
  await inscreverNoServidor(companyId, inscricao);
  return "ativo";
}

export async function desativarAviso(companyId: string): Promise<EstadoDoAviso> {
  const reg = await registrarServiceWorker();
  const inscricao = reg ? await reg.pushManager.getSubscription() : null;
  if (inscricao) {
    try {
      await request(`/companies/${companyId}/web-push/unsubscribe`, {
        method: "POST",
        body: { endpoint: inscricao.endpoint },
      });
    } catch { /* o servidor apaga sozinho no proximo 410 */ }
    try { await inscricao.unsubscribe(); } catch { /* ja desinscrito */ }
  }
  return "inativo";
}

export function enviarAvisoDeTeste(companyId: string) {
  return request<{ enviados: number; removidos: number; falhas: number }>(
    `/companies/${companyId}/web-push/test`,
    { method: "POST", body: {} },
  );
}

/** Ao abrir o painel: navegador já autorizado reafirma a inscrição nesta empresa. */
export async function sincronizarInscricao(companyId?: string): Promise<void> {
  if (!companyId || !suportaAvisoNoNavegador() || Notification.permission !== "granted") return;
  const reg = await registrarServiceWorker();
  const inscricao = reg ? await reg.pushManager.getSubscription() : null;
  if (!inscricao) return;
  try { await inscreverNoServidor(companyId, inscricao); } catch { /* tenta de novo no proximo acesso */ }
}

/** Mensagens do service worker: push recebido (toca o som) e pedido de abrir um endereço. */
export function ouvirAvisosDoServiceWorker(aoReceber: (aviso: any) => void): () => void {
  if (!suportaAvisoNoNavegador()) return () => {};
  const ouvinte = (evento: MessageEvent) => {
    const msg = (evento && evento.data) || {};
    if (msg.tipo === "aura-push") aoReceber(msg.aviso || {});
    if (msg.tipo === "aura-abrir" && typeof msg.url === "string") {
      try { window.location.assign(msg.url); } catch { /* sem navegacao */ }
    }
  };
  navigator.serviceWorker.addEventListener("message", ouvinte as any);
  return () => navigator.serviceWorker.removeEventListener("message", ouvinte as any);
}

/** Só para teste. */
export function _resetRegistro(): void {
  _registro = null;
}
