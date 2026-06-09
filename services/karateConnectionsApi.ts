// ============================================================
// KARATE CONNECTIONS API — Aura Karatê (Fase 5 / Track F)
//
// Conexão Federação ↔ Dojô (2 vias: native = usa o Aura Karatê,
// manual = a federação cuida). Contrato docs/karate-fase5-openapi.yaml.
// Autenticado via request() core. Termos técnicos (token/handshake)
// vivem só aqui e no backend — a UI usa linguagem simples.
// ============================================================
import { request } from "@/services/api";

export type Via = "native" | "manual";
export type ConnStatus = "pending" | "connected" | "suspended" | "revoked" | "error";
export type SyncDirection = "dojo_to_fed" | "fed_to_dojo";

export interface SyncEvent {
  id: string;
  direction: SyncDirection;
  event_type: string;
  status: "ok" | "failed" | "reprocessed" | "pending";
  error: string | null;
  created_at: string;
}

export interface Connection {
  id: string;
  federation_id: string;
  dojo_id: string;
  dojo_name: string | null;
  fpkt_affiliation_id: string | null;
  via: Via;
  status: ConnStatus;
  sync_token_masked: string | null;
  token_rotated_at: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_sync_status: "ok" | "syncing" | "error" | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConnectionDetail extends Connection {
  recent_events: SyncEvent[];
}

export interface ConnectionsList {
  counts: Partial<Record<ConnStatus, number>>;
  data: Connection[];
}

export interface ApproveResult extends Connection {
  sync_token: string | null;
  _note?: string;
}

interface EventsPage {
  page: number;
  page_size: number;
  total: number;
  data: SyncEvent[];
}

export const karateConnectionsApi = {
  listConnections: (
    federationId: string,
    params?: { via?: Via; status?: ConnStatus }
  ): Promise<ConnectionsList> => {
    const qs = new URLSearchParams();
    if (params?.via) qs.set("via", params.via);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/connections${q}`);
  },

  listRequests: (federationId: string): Promise<Connection[]> =>
    request(`/federation/${federationId}/connections/requests`),

  createConnection: (
    federationId: string,
    body: { dojo_id: string; via: Via; notes?: string | null }
  ): Promise<Connection> =>
    request(`/federation/${federationId}/connections`, { method: "POST", body }),

  getConnection: (federationId: string, connId: string): Promise<ConnectionDetail> =>
    request(`/federation/${federationId}/connections/${connId}`),

  /** Aprova/liga a conexão. native → devolve a chave 1x (não exibida na UI). */
  approve: (federationId: string, connId: string): Promise<ApproveResult> =>
    request(`/federation/${federationId}/connections/${connId}/approve`, { method: "POST", body: {} }),

  reject: (federationId: string, connId: string): Promise<{ id: string; status: ConnStatus }> =>
    request(`/federation/${federationId}/connections/${connId}/reject`, { method: "POST", body: {} }),

  /** "Reconectar" no dia a dia: re-liga a conexão (re-emite a chave nos bastidores). */
  reconnect: (federationId: string, connId: string): Promise<ApproveResult> =>
    request(`/federation/${federationId}/connections/${connId}/approve`, { method: "POST", body: {} }),

  /** Avançado/suporte: gera nova chave de segurança. */
  rotateKey: (federationId: string, connId: string): Promise<{ id: string; sync_token: string }> =>
    request(`/federation/${federationId}/connections/${connId}/rotate-token`, { method: "POST", body: {} }),

  listEvents: (federationId: string, connId: string, page = 1, pageSize = 50): Promise<EventsPage> =>
    request(`/federation/${federationId}/connections/${connId}/events?page=${page}&pageSize=${pageSize}`),
};
