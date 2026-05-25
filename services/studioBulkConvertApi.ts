/**
 * Helper studio bulk convert — item #4 da análise UX/UI.
 * Backend: PR Aura-backend#116 + migration 134.
 */
import { request } from "./api";

export type StudioBulkEventItemRow = {
  item_id: string;
  line_number: number;
  recipient_name: string | null;
  customization: any | null;
  digital_order_id: string | null;
  studio_production_status: string | null;
  total: number | null;
  order_created_at: string | null;
  order_customer_name: string | null;
  pending_mockup_url: string | null;
};

export type StudioBulkEventItemsResponse = {
  items: StudioBulkEventItemRow[];
  converted: number;
  total: number;
};

export type StudioBulkConvertResponse = {
  converted: number;
  order_ids?: string[];
  message: string;
};

const base = (cid: string) => `/companies/${cid}/studio/bulk-events`;

export const studioBulkConvertApi = {
  listItems: (cid: string, eid: string) =>
    request<StudioBulkEventItemsResponse>(`${base(cid)}/${eid}/orders`, {
      method: "GET",
      retry: 1,
      timeout: 10000,
    } as any),

  convert: (cid: string, eid: string) =>
    request<StudioBulkConvertResponse>(`${base(cid)}/${eid}/convert`, {
      method: "POST",
      retry: 0,
      timeout: 30000,
    } as any),
};
