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
  /** COUPON_REQUIRES_CUSTOMER | COUPON_CUSTOMER_MISMATCH — cupom nominal
   *  (aniversário / crédito livre) recusado por titularidade. O `error` já
   *  vem pronto pra tela; o código é pra telemetria e branch de UX. */
  error_code?: string;
};

export var couponsApi = {
  list: function(companyId: string, source?: string) {
    var suffix = source ? "?source=" + encodeURIComponent(source) : "";
    return request<{ total: number; coupons: any[] }>("/companies/" + companyId + "/coupons" + suffix);
  },
  create: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/coupons", { method: "POST", body: body }); },
  // customerId é OPCIONAL de propósito: o PDV do Studio não tem cliente
  // identificado (só texto livre) e continua chamando com 3 argumentos.
  // Sem ele o backend recusa cupom NOMINAL — que é o comportamento correto,
  // não dá pra provar titularidade sem saber quem é o cliente. Cupom
  // genérico (customer_id NULL) segue passando dos dois jeitos.
  validate: function(companyId: string, code: string, orderTotal: number, customerId?: string | null) {
    return request<CouponValidation>("/companies/" + companyId + "/coupons/validate", { method: "POST", body: { code: code, order_total: orderTotal, customer_id: customerId || null }, retry: 0 });
  },
  update: function(companyId: string, couponId: string, body: any) { return request<any>("/companies/" + companyId + "/coupons/" + couponId, { method: "PATCH", body: body }); },
  remove: function(companyId: string, couponId: string) { return request<any>("/companies/" + companyId + "/coupons/" + couponId, { method: "DELETE" }); },
};
