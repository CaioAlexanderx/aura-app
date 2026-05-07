import { request } from "./api";

export type BirthdayCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  total_purchases: number;
  total_spent: number;
  days_until: number;
  is_today: boolean;
  marketing_opt_out?: boolean;
};
export type BirthdayCouponDefaults = {
  discount_type: "percent" | "fixed";
  discount_value: number;
  validity_days: number;
  min_order_value: number;
  max_uses: number;
};
export type BirthdaySettings = {
  defaults: BirthdayCouponDefaults;
  template: string;
  configured: boolean;
};
export type BirthdaySentRow = {
  customer_id: string;
  sent_at: string;
  method: "wa_link" | "wa_api" | "sms" | "email";
  coupon_id: string | null;
};

export var birthdayApi = {
  getSettings: function(companyId: string) {
    return request<BirthdaySettings>("/companies/" + companyId + "/birthday/settings", { retry: 1 });
  },
  saveSettings: function(companyId: string, body: { defaults?: Partial<BirthdayCouponDefaults>; template?: string }) {
    return request<{ ok: true }>("/companies/" + companyId + "/birthday/settings", { method: "PUT", body: body, retry: 0 });
  },
  createCoupon: function(companyId: string, body: {
    customer_id: string; code?: string; description?: string;
    discount_type?: "percent" | "fixed"; discount_value?: number;
    validity_days?: number; min_order_value?: number; max_uses?: number;
  }) {
    return request<{ coupon: any; customer: { id: string; name: string; opted_out: boolean } }>(
      "/companies/" + companyId + "/birthday/create-coupon", { method: "POST", body: body, retry: 0 }
    );
  },
  logSent: function(companyId: string, body: {
    customer_id: string; coupon_id?: string;
    method?: "wa_link" | "wa_api" | "sms" | "email"; message?: string;
  }) {
    return request<{ log: any }>("/companies/" + companyId + "/birthday/send-log", { method: "POST", body: body, retry: 0 });
  },
  sentThisYear: function(companyId: string) {
    return request<{ year: number; total: number; sent: BirthdaySentRow[] }>(
      "/companies/" + companyId + "/birthday/sent-this-year", { retry: 1 }
    );
  },
};
