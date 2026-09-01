// ============================================================
// hubApi — Hub Social / Aurinha (backend PR #630)
//
// Cliente tipado das rotas /companies/:companyId/hub/*. O hub unifica
// os canais de atendimento (MVP: Instagram; whatsapp/storefront no
// mesmo schema) com a Aurinha respondendo via IA.
//
// Estados que NÃO são erro:
//   - schema_pending: migration 312 ainda não aplicada no ambiente —
//     a UI mostra estado vazio, nunca crash (mesmo padrão do waApi).
//   - 422 JANELA_FECHADA no reply: regra da Meta (24h após o último
//     inbound do cliente) — vira aviso na tela, não erro genérico.
//   - 409 em ações: hub indisponível no ambiente (migration pendente).
// ============================================================
import { request } from "@/services/api";

export type HubChannel = "instagram" | "whatsapp" | "storefront";
export type HubStatus = "ia" | "precisa_humano" | "humano" | "resolvida";
export type HubCategory = "produto" | "troca" | "entrega" | "pagamento" | "novidades";

export interface HubConversation {
  id: string;
  channel: HubChannel;
  external_id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: HubStatus;
  category: HubCategory | null;
  handoff_reason: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  pending_approvals: number;
}

export interface HubCount { channel: HubChannel; status: HubStatus; n: number }

export interface HubMessage {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  created_at: string;
  /** 'aurinha' | 'humano' | null (inbound) */
  source_type: string | null;
}

export interface HubPendingApproval {
  id: string;
  text_body: string;
  edited_body: string | null;
  status: string;
  source_type: string | null;
  created_at: string;
}

export interface HubSettings {
  enabled: boolean;
  approval_mode: boolean;
  model: string | null;
  extra_instructions: string | null;
  schema_pending?: boolean;
}

export const hubApi = {
  conversations: (companyId: string, filters?: { channel?: string; status?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.channel) qs.set("channel", filters.channel);
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.category) qs.set("category", filters.category);
    const q = qs.toString();
    return request<{ conversations: HubConversation[]; counts: HubCount[]; schema_pending?: boolean }>(
      `/companies/${companyId}/hub/conversations${q ? `?${q}` : ""}`
    );
  },

  messages: (companyId: string, convId: string) =>
    request<{ conversation: HubConversation; messages: HubMessage[]; pending_approvals: HubPendingApproval[] }>(
      `/companies/${companyId}/hub/conversations/${convId}/messages`
    ),

  assume: (companyId: string, convId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/conversations/${convId}/assume`, { method: "POST" }),

  resolve: (companyId: string, convId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/conversations/${convId}/resolve`, { method: "POST" }),

  returnToAi: (companyId: string, convId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/conversations/${convId}/return-to-ai`, { method: "POST" }),

  setCategory: (companyId: string, convId: string, category: HubCategory | null) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/conversations/${convId}/category`, {
      method: "PATCH", body: { category },
    }),

  reply: (companyId: string, convId: string, text: string) =>
    request<{ ok: boolean; outbox_id: string | null; status: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/reply`,
      { method: "POST", body: { text } }
    ),

  approve: (companyId: string, outboxId: string, editedText?: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/outbox/${outboxId}/approve`, {
      method: "POST", body: editedText != null ? { text: editedText } : {},
    }),

  reject: (companyId: string, outboxId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/outbox/${outboxId}/reject`, { method: "POST" }),

  settings: (companyId: string) =>
    request<HubSettings>(`/companies/${companyId}/hub/settings`),

  saveSettings: (companyId: string, patch: Partial<Pick<HubSettings, "enabled" | "approval_mode" | "extra_instructions">>) =>
    request<HubSettings>(`/companies/${companyId}/hub/settings`, {
      method: "PUT", body: patch,
    }),
};
