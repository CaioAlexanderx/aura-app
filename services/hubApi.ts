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

export interface HubLabel { id: string; name: string; color: string; n?: number }

export interface HubCliente {
  id: string; name: string; phone: string | null; email: string | null;
  birth_date: string | null; since: string | null; last_purchase_at: string | null; total_spent: number | null;
  /** Total da última venda não cancelada (Aura-backend: last_purchase_amount). Ausente em servidor antigo. */
  last_purchase_amount?: number | null;
}

export interface HubConviteCampo { key: string; rotulo: string; auto: boolean; exemplo: string; max: number }

export interface HubConvite {
  key: string; titulo: string;
  /** Estado do modelo na Meta: APPROVED | PENDING | REJECTED | PAUSED | NAO_CRIADO. */
  estado: string; pronto: boolean;
  /** Texto do modelo: pedaços fixos e `{ campo }` (campo.auto = a Aura preenche). */
  partes: (string | { campo: string })[];
  campos: HubConviteCampo[];
}

export interface HubSaldoAvisos {
  ativo: boolean; restante: number; total: number; esgotado: boolean;
  renova_em: string | null; mes: string | null;
  pacote: { qty: number; preco_centavos: number } | null;
}

export interface HubConvites {
  aberta: boolean; conectado: boolean;
  /** https://wa.me/<número da loja> */
  meu_link: string | null;
  /** null = este servidor não informa o saldo (a tela só diz "Usa 1 aviso"). */
  saldo: HubSaldoAvisos | null;
  auto: { nome: string; loja: string };
  convites: HubConvite[];
}

export interface HubConversation {
  /** Etiquetas aplicadas (migration 474). */
  labels?: HubLabel[];
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

/** Dados do cartão da thread (Aura-backend: metadata.cartao). Ausente em mensagens antigas. */
export interface HubCartao {
  numero?: number | null;
  itens?: { nome: string; qtd: number; valor: number }[];
  total?: number | null;
  validade?: string | null;
  url?: string | null;
  valor?: number | null;
  loja?: string | null;
  chave?: string | null;
  codigo?: string | null;
  imagem?: string | null;
  descricao?: string | null;
}

export interface HubMessage {
  /** Cartão estruturado de orçamento, Pix ou link da loja. */
  cartao?: HubCartao | null;
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  created_at: string;
  /** 'aurinha' | 'humano' | null (inbound) */
  source_type: string | null;
  /** Quem falou (hub_messages, canal WhatsApp). Instagram não manda. */
  author?: HubAuthor | null;
  /** Mensagem rica enviada pela tela: produto | orcamento | pix | link_loja. */
  tipo?: string | null;
  /** Foto do produto mandada (cartão de produto na thread). */
  image_url?: string | null;
  /** Foto ou áudio guardado (URL assinada de 1 h). null = não foi guardado. */
  media?: { kind: "image" | "audio"; mime: string; url: string | null } | null;
}

export type HubEnvioTipo = "produto" | "orcamento" | "pix" | "link_loja";

export interface HubCatalogItem { id: string; name: string; price: number; image_url: string | null }

export interface HubQuote {
  id: string; status: string; total: string | number; expires_at: string | null;
  customer_name: string | null; sent_at: string | null;
}

export type HubAuthor = "cliente" | "humano" | "aurinha";

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
  conversations: (companyId: string, filters?: { channel?: string; status?: string; category?: string; label?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.label) qs.set("label", filters.label);
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

  /** Mensagens de sessão (grátis, só com a conversa aberta). */
  send: (companyId: string, convId: string, body: { type: HubEnvioTipo; product_id?: string; quote_id?: string; amount?: number }) =>
    request<{ ok: boolean; wamid: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/send`, { method: "POST", body }
    ),

  /** Foto ou áudio da conversa aberta. `data` é base64 puro; o servidor converte o WebM do Chrome. */
  midia: (companyId: string, convId: string, body: { kind: "foto" | "audio"; mime: string; data: string; caption?: string }) =>
    request<{ ok: boolean; wamid: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/midia`, { method: "POST", body, timeout: 60000, retry: 0 }
    ),

  // ── Etiquetas ──
  etiquetas: (companyId: string) =>
    request<{ labels: HubLabel[]; schema_pending?: boolean }>(`/companies/${companyId}/hub/etiquetas`),
  criarEtiqueta: (companyId: string, body: { name: string; color?: string }) =>
    request<{ label: HubLabel }>(`/companies/${companyId}/hub/etiquetas`, { method: "POST", body }),
  apagarEtiqueta: (companyId: string, labelId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/etiquetas/${labelId}`, { method: "DELETE" }),
  aplicarEtiqueta: (companyId: string, convId: string, labelId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/conversations/${convId}/etiquetas/${labelId}`, { method: "PUT" }),
  tirarEtiqueta: (companyId: string, convId: string, labelId: string) =>
    request<{ ok: boolean }>(`/companies/${companyId}/hub/conversations/${convId}/etiquetas/${labelId}`, { method: "DELETE" }),

  // ── "É ela": cadastro de Clientes da conversa ──
  clienteDaConversa: (companyId: string, convId: string) =>
    request<{ cliente: HubCliente | null; sugestao: HubCliente | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/cliente`
    ),
  buscarClientes: (companyId: string, q: string) =>
    request<{ clientes: Pick<HubCliente, "id" | "name" | "phone" | "email">[] }>(
      `/companies/${companyId}/hub/clientes?q=${encodeURIComponent(q)}`
    ),
  ligarCliente: (companyId: string, convId: string, customerId: string | null) =>
    request<{ ok: boolean; customer_id: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/cliente`, { method: "PUT", body: { customer_id: customerId } }
    ),

  // ── Conversa fechada: convites prontos (gastam 1 aviso) ──
  convites: (companyId: string, convId: string) =>
    request<HubConvites>(`/companies/${companyId}/hub/conversations/${convId}/convites`),
  mandarConvite: (companyId: string, convId: string, body: { key: string; campos: Record<string, string> }) =>
    request<{ ok: boolean; outbox_id: string }>(
      `/companies/${companyId}/hub/conversations/${convId}/convites`, { method: "POST", body, retry: 0 }
    ),
  prepararConvites: (companyId: string) =>
    request<{ criados: number; ja_existiam: number }>(`/companies/${companyId}/hub/convites/preparar`, { method: "POST", body: {} }),
  /** Pedido de pacote de avisos (só gera a cobrança; o saldo soma depois do pagamento confirmado). */
  pedirPacoteDeAvisos: (companyId: string) =>
    request<{ pack?: unknown; payment_url?: string | null; needs_manual?: boolean }>(
      `/companies/${companyId}/whatsapp/saldo/pacotes`, { method: "POST", body: { bucket: "avisos" }, retry: 0 }
    ),

  /** Medidor de avisos do mês (agente A: GET /whatsapp/saldo). Erro ou ausência = a tela não mostra o número. */
  saldoAvisos: (companyId: string) =>
    request<{ ativo: boolean; saldos?: { avisos?: { restante: number; total: number } } }>(`/companies/${companyId}/whatsapp/saldo`),

  catalogo: (companyId: string, q: string) =>
    request<{ products: HubCatalogItem[] }>(`/companies/${companyId}/hub/catalogo?q=${encodeURIComponent(q)}`),

  orcamentos: (companyId: string, convId: string) =>
    request<{ quotes: HubQuote[] }>(`/companies/${companyId}/hub/conversations/${convId}/orcamentos`),

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
