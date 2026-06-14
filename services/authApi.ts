import { request } from "./api";

export type VerticalKey = "odonto" | "barber" | "food" | "studio" | "estetica" | "pet" | "academia" | "karate_federation" | "karate_dojo";

export type LoginResponse = {
  token: string;
  user: { id: string; name: string; email: string; role: string; is_staff?: boolean; email_verified?: boolean };
  company: {
    id: string;
    name: string;
    plan: string;
    onboarding_step: string;
    module_overrides?: Record<string, boolean>;
    trial_active?: boolean;
    trial_ends_at?: string;
    vertical_active?: VerticalKey | null;
    member_role?: string;
    billing_status?: string | null;
    access_code_used?: boolean;
    // Track G (acesso real): federação resolvida + papel karatê. federation_id =
    // company.id (federação) ou federation_id do pai (dojô); null fora de karatê.
    federation_id?: string | null;
    karate_role?: string | null;
  } | null;
  code_applied?: { type: string; plan: string; discount_pct: number; trial_days: number } | null;
};
// feat/terms-acceptance: terms_accepted e terms_version adicionados para registro de aceite
export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  company_name?: string;
  phone?: string;
  cnpj?: string;
  access_code?: string;
  self_serve?: boolean;
  terms_accepted?: boolean;
  terms_version?: string;
};
export type CodeValidation = { valid: boolean; type?: string; plan?: string; discount_pct?: number; trial_days?: number; error?: string };
export type VerificationResponse = { sent?: boolean; destination?: string; expires_in?: number; already_verified?: boolean; valid?: boolean; email_verified?: boolean; phone_verified?: boolean; error?: string };

export type SidebarLayoutItem = {
  key: string;
  section: string;
  hidden: boolean;
};
export type SidebarLayout = {
  version: number;
  items: SidebarLayoutItem[];
};

export type PdvSettings = {
  require_customer: boolean;
  require_seller: boolean;
  caixa_enabled: boolean;
  // 09/05/2026: toggle por funcionalidade — ligavel/desligavel em
  // Configuracoes > PDV > Politicas do Caixa.
  crediario_enabled: boolean;
  // 12/05/2026: controla se o modal de troco abre quando o pagamento
  // e em dinheiro (single ou parcela dinheiro em split-mode). Default
  // true em DEFAULT_SETTINGS — operador batuto/fila grande pode desligar.
  cash_tender_modal_enabled: boolean;
  // 18/05/2026 (Fase 0 Aura Food, migration 118)
  food_mode_enabled?: boolean;
  service_fee_pct?: number;
  food_service_fee_pct?: number;
  food_nfce_manual_enabled?: boolean;
  food_comanda_print_enabled?: boolean;
  // 24-25/05/2026 (Aura Studio): liga shell /studio + features personalizados.
  studio_enabled?: boolean;
  studio_kds_enabled?: boolean;
  studio_gallery_enabled?: boolean;
  studio_approval_enabled?: boolean;
  studio_approval_mode?: "wa_me" | "whatsapp_business";
};

export var authApi = {
  login: function(email: string, password: string) { return request<LoginResponse>("/auth/login", { method: "POST", body: { email: email, password: password }, retry: 1 }); },
  register: function(body: RegisterBody) { return request<LoginResponse>("/auth/register", { method: "POST", body: body, retry: 1 }); },
  me: function(token: string) { return request<Omit<LoginResponse, "token">>("/auth/me", { method: "POST", token: token, retry: 1 }); },
  validateCode: function(code: string) { return request<CodeValidation>("/auth/validate-code", { method: "POST", body: { code: code }, retry: 0 }); },
  forgotPassword: function(email: string) { return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email: email }, retry: 0 }); },
  resetPassword: function(token: string, password: string) { return request<{ message: string }>("/auth/reset-password", { method: "POST", body: { token: token, password: password }, retry: 0 }); },
  sendEmailVerification: function() { return request<VerificationResponse>("/auth/send-verification", { method: "POST", retry: 0 }); },
  verifyEmail: function(code: string) { return request<VerificationResponse>("/auth/verify-email", { method: "POST", body: { code: code }, retry: 0 }); },
  sendPhoneVerification: function() { return request<VerificationResponse>("/auth/send-phone-verification", { method: "POST", retry: 0 }); },
  verifyPhone: function(code: string) { return request<VerificationResponse>("/auth/verify-phone", { method: "POST", body: { code: code }, retry: 0 }); },
};

export var sidebarLayoutApi = {
  get: function() { return request<{ layout: SidebarLayout | null }>("/auth/sidebar-layout", { retry: 1 }); },
  save: function(layout: SidebarLayout | null) {
    return request<{ layout: SidebarLayout | null }>("/auth/sidebar-layout", { method: "PUT", body: { layout: layout }, retry: 0 });
  },
};

export var pdvSettingsApi = {
  get: function(companyId: string) { return request<{ settings: PdvSettings }>("/companies/" + companyId + "/pdv-settings", { retry: 1 }); },
  save: function(companyId: string, settings: PdvSettings) {
    return request<{ settings: PdvSettings }>("/companies/" + companyId + "/pdv-settings", { method: "PUT", body: { settings: settings }, retry: 0 });
  },
};
