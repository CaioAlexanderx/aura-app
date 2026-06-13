// ============================================================
// AURA. — Notificações do App
// Criado: 13/06/2026
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

export interface NotificationsResponse {
  banners: AppBanner[];
  orders: OrderNotification[];
  unread_count: number;
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
};
