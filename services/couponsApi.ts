import { request } from "./api";

export type CouponValidation = {
  valid: boolean;
  coupon_id?: string;
  code?: string;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  final_total?: number;
  source?: string;
  customer_id?: string | null;
  error?: string;
};

export var couponsApi = {
  list: function(companyId: string, source?: string) {
    var suffix = source ? "?source=" + encodeURIComponent(source) : "";
    return request<{ total: number; coupons: any[] }>("/companies/" + companyId + "/coupons" + suffix);
  },
  create: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/coupons", { method: "POST", body: body }); },
  validate: function(companyId: string, code: string, orderTotal: number) {
    return request<CouponValidation>("/companies/" + companyId + "/coupons/validate", { method: "POST", body: { code: code, order_total: orderTotal }, retry: 0 });
  },
  update: function(companyId: string, couponId: string, body: any) { return request<any>("/companies/" + companyId + "/coupons/" + couponId, { method: "PATCH", body: body }); },
  remove: function(companyId: string, couponId: string) { return request<any>("/companies/" + companyId + "/coupons/" + couponId, { method: "DELETE" }); },
};
