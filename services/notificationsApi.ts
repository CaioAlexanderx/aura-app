// ============================================================
// AURA. — Notificações do App
// Criado: 13/06/2026
//
// 01/09/2026 — eventos da loja online (`loja_*`).
// O sino deixou de ser "banner + pedido das últimas 24h": o backend passou a
// reaproveitar `app_notifications` com um `type` por evento do ciclo de vida
// do pedido (pago, comprovante enviado, PIX expirado, saiu para entrega,
// entregue, cancelado, sinal pago) e da loja (estoque abaixo do mínimo, loja
// sem meio de pagamento). Vem também preferência por tipo, por empresa, pra
// uma loja de 200 pedidos/dia não receber 200 sinos.
//
// ⚠️ CONTRATO PROVISÓRIO — o backend ainda vai confirmar o shape.
// `events` e as rotas de `preferences` são OPCIONAIS: se o backend não
// mandar, a gaveta cai no feed antigo (banners + orders convertidos em
// eventos `loja_pedido_novo`) e nada quebra. Se o contrato final divergir,
// o ajuste é aqui e em components/notificationEventModel.ts, só.
// ============================================================
import { request } from '@/services/api';

export interface AppBanner {
  id: string;
  type: string;
  title: string;
  body?: string;
  html_content?: string;
  cta_label?: string;
  cta_url?: string;
  cta_route?: string;
  created_at: string;
}

export interface OrderNotification {
  id: string;
  order_number: string | number;
  customer_name?: string;
  total: number;
  status: string;
  created_at: string;
  source: 'canal_digital' | 'studio';
}

export type NotificationSeverity = 'info' | 'atencao' | 'critico';

/** Evento da loja online. `type` é sempre `loja_*`. */
export interface StoreEvent {
  id:            string;
  type:          string;
  title:         string;
  body?:         string;
  severity?:     NotificationSeverity;
  entity_id?:    string;          // id do pedido/produto — base do agrupamento
  entity_label?: string;          // "Pedido #1042" — opcional
  cta_route?:    string;
  created_at:    string;
  read_at?:      string | null;
}

export interface NotificationsResponse {
  banners: AppBanner[];
  orders: OrderNotification[];
  events?: StoreEvent[];
  unread_count: number;
}

export interface NotificationPrefsResponse {
  preferences: Record<string, boolean>;
}

export const notificationsApi = {
  list: (companyId: string) =>
    request<NotificationsResponse>(`/companies/${companyId}/notifications`),

  markBannerRead: (companyId: string, bannerId: string) =>
    request<{ ok: boolean }>(
      `/companies/${companyId}/notifications/banners/${bannerId}/read`,
      { method: 'POST' }
    ),

  markAllBannersRead: (companyId: string) =>
    request<{ ok: boolean }>(
      `/companies/${companyId}/notifications/read-all-banners`,
      { method: 'POST' }
    ),

  // ── Eventos da loja (01/09/2026) ────────────────────────────────────────
  markEventRead: (companyId: string, eventId: string) =>
    request<{ ok: boolean }>(
      `/companies/${companyId}/notifications/${eventId}/read`,
      { method: 'POST' }
    ),

  markAllRead: (companyId: string) =>
    request<{ ok: boolean }>(
      `/companies/${companyId}/notifications/read-all`,
      { method: 'POST' }
    ),

  getPreferences: (companyId: string) =>
    request<NotificationPrefsResponse>(
      `/companies/${companyId}/notifications/preferences`
    ),

  savePreferences: (companyId: string, preferences: Record<string, boolean>) =>
    request<NotificationPrefsResponse>(
      `/companies/${companyId}/notifications/preferences`,
      { method: 'PUT', body: { preferences } }
    ),
};
