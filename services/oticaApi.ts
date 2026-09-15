// ============================================================
// AURA. — Ótica (cliente da API)
//
// Semi-vertical sobre o shell Negócio, 15/09/2026. A ótica NÃO tem shell
// próprio: liga por pdv_settings.otica_enabled e vive dentro de app/(tabs),
// como a Ordem de Serviço. Caixa, estoque, crediário, clientes e WhatsApp
// continuam os mesmos — o que é novo é o que uma ótica tem e uma loja de
// roupa não tem: RECEITA do cliente, LABORATÓRIO como etapa da OS, e sinal
// na abertura (a venda de óculos nasce antes das lentes existirem).
//
// Contrato: scratchpad/plano-otica.md (15/09/2026), espelhado no backend em
// src/routes/otica.js e nas extensões de src/routes/serviceOrders.js.
//
// Gate: o backend bloqueia só a ESCRITA (403 OTICA_DISABLED). Leitura e
// impressão funcionam com o toggle desligado, de propósito — a loja que
// desliga o módulo ainda tem óculos no laboratório e cliente pra avisar.
//
// Receita é dado de saúde (LGPD, art. 5º II). Ela nunca entra no corpo de
// uma mensagem de WhatsApp: o aviso de "pronto" manda só o link de
// acompanhamento, e o lembrete de revisão manda só a data.
// ============================================================
import { request } from "@/services/api";
import type { ServiceOrder, ServiceOrderItem } from "@/services/serviceOrdersApi";

// ─── Receita ─────────────────────────────────────────────────

export type PrescriberType = "medico" | "optometrista";

export const PRESCRIBER_LABEL: Record<PrescriberType, string> = {
  medico: "Médico (CRM)",
  optometrista: "Optometrista",
};

/** Um olho da receita. Graus em dioptrias (passo 0,25), eixo 0–180, DNP e altura em mm. */
export type EyeRx = {
  sph: number | null;
  cyl: number | null;
  axis: number | null;
  add: number | null;
  prism: number | null;
  base: string | null;
  pd: number | null;
  height: number | null;
};

export type Prescription = {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string | null;
  od_sph: number | null; od_cyl: number | null; od_axis: number | null; od_add: number | null; od_prism: number | null; od_base: string | null;
  oe_sph: number | null; oe_cyl: number | null; oe_axis: number | null; oe_add: number | null; oe_prism: number | null; oe_base: string | null;
  od_pd: number | null; oe_pd: number | null;
  od_height: number | null; oe_height: number | null;
  prescriber_type: PrescriberType;
  prescriber_name: string | null;
  prescriber_registry: string | null;
  issued_at: string;      // YYYY-MM-DD
  valid_until: string;    // YYYY-MM-DD
  photo_url?: string | null;
  measured_by?: string | null;
  measured_by_name?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type PrescriptionBody = Partial<Omit<Prescription, "id" | "customer_name" | "customer_phone" | "measured_by_name" | "created_at">> & {
  customer_id: string;
  issued_at: string;
};

export const EMPTY_EYE: EyeRx = { sph: null, cyl: null, axis: null, add: null, prism: null, base: null, pd: null, height: null };

/** Achata os dois olhos no shape de colunas do backend. */
export function eyesToColumns(od: EyeRx, oe: EyeRx) {
  return {
    od_sph: od.sph, od_cyl: od.cyl, od_axis: od.axis, od_add: od.add, od_prism: od.prism, od_base: od.base,
    oe_sph: oe.sph, oe_cyl: oe.cyl, oe_axis: oe.axis, oe_add: oe.add, oe_prism: oe.prism, oe_base: oe.base,
    od_pd: od.pd, oe_pd: oe.pd, od_height: od.height, oe_height: oe.height,
  };
}

export function columnsToEyes(p: Partial<Prescription>): { od: EyeRx; oe: EyeRx } {
  const n = (v: any) => (v == null || v === "" ? null : Number(v));
  return {
    od: { sph: n(p.od_sph), cyl: n(p.od_cyl), axis: n(p.od_axis), add: n(p.od_add), prism: n(p.od_prism), base: p.od_base ?? null, pd: n(p.od_pd), height: n(p.od_height) },
    oe: { sph: n(p.oe_sph), cyl: n(p.oe_cyl), axis: n(p.oe_axis), add: n(p.oe_add), prism: n(p.oe_prism), base: p.oe_base ?? null, pd: n(p.oe_pd), height: n(p.oe_height) },
  };
}

/**
 * Grau como o papel do médico escreve: sinal sempre presente, vírgula, duas
 * casas. "−1,75" / "+2,00" / "—" quando vazio. O sinal é o que separa míope
 * de hipermétrope — omitir o "+" é o erro clássico de digitação.
 */
export function fmtDiopter(v: number | null | undefined): string {
  if (v == null || !isFinite(Number(v))) return "—";
  const n = Number(v);
  const s = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "−" : n > 0 ? "+" : "") + s;
}

export function fmtAxis(v: number | null | undefined): string {
  if (v == null || !isFinite(Number(v))) return "—";
  return String(Math.round(Number(v))) + "°";
}

export function fmtMm(v: number | null | undefined): string {
  if (v == null || !isFinite(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Resumo de um olho numa linha: "−1,75 −0,50 180° · ad +2,00". */
export function fmtEyeShort(e: EyeRx): string {
  const parts = [fmtDiopter(e.sph)];
  if (e.cyl != null) parts.push(fmtDiopter(e.cyl), fmtAxis(e.axis));
  let s = parts.join(" ");
  if (e.add != null) s += " · ad " + fmtDiopter(e.add);
  return s;
}

/**
 * Converte o que o vendedor digitou num grau válido. Aceita "-1,75", "-1.75",
 * "+2", "175" (eixo). Devolve null quando vazio; NaN quando inválido.
 */
export function parseDiopter(raw: string): number | null {
  const s = String(raw ?? "").trim().replace("−", "-").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

/** Arredonda ao passo de 0,25 — o passo em que lentes existem. */
export function snapQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Data pura YYYY-MM-DD + meses, sem passar por UTC. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1 + months, d);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function todayIso(): string {
  const dt = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Dias entre hoje e uma data pura (negativo = já passou). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target - now.getTime()) / 86400000);
}

/** "2026-08-20" -> "20/08/2026". Data pura: sem new Date() pra não virar véspera em UTC-3. */
export function fmtIsoDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

/** "20/08/2026" -> "2026-08-20" (null se inválida). */
export function parseBrDate(s: string): string | null {
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dt = new Date(+m[3], +m[2] - 1, +m[1]);
  if (dt.getFullYear() !== +m[3] || dt.getMonth() !== +m[2] - 1 || dt.getDate() !== +m[1]) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ─── Laboratório ─────────────────────────────────────────────

export type OpticalLab = {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  portal_url?: string | null;
  lead_days: number;
  notes?: string | null;
  is_active: boolean;
};

export type OpticalLabBody = Partial<Omit<OpticalLab, "id">> & { name: string };

// ─── Configuração ────────────────────────────────────────────

export type OticaSettings = {
  prescription_validity_months: number;
  adaptation_warranty_days: number;
  default_lab_id: string | null;
  rt_name: string;
  rt_registry: string;
  sanitary_license: string;
  wa_ready_auto: boolean;
  wa_adaptation_auto: boolean;
  wa_revision_auto: boolean;
};

export const OTICA_SETTINGS_DEFAULTS: OticaSettings = {
  prescription_validity_months: 12,
  adaptation_warranty_days: 90,
  default_lab_id: null,
  rt_name: "",
  rt_registry: "",
  sanitary_license: "",
  wa_ready_auto: false,
  wa_adaptation_auto: false,
  wa_revision_auto: false,
};

// ─── Etapa de laboratório (sub-status da OS kind='otica') ────

export type LabStatus = "aguardando_envio" | "no_laboratorio" | "recebida" | "em_montagem" | "refacao";

export const LAB_STATUS_LABEL: Record<LabStatus, string> = {
  aguardando_envio: "Aguardando envio",
  no_laboratorio: "No laboratório",
  recebida: "Recebida",
  em_montagem: "Montagem",
  refacao: "Refação",
};

// Espelha as transições do backend (POST /service-orders/:id/lab). O
// backend é quem manda (409 TRANSICAO_LAB_INVALIDA); esta cópia existe só
// pra tela não oferecer botão que vai falhar. Refação é ação secundária:
// volta ao laboratório com contador e motivo, sem perder a OS.
export const LAB_TRANSICOES: Record<LabStatus, LabStatus[]> = {
  aguardando_envio: ["no_laboratorio"],
  no_laboratorio: ["recebida"],
  recebida: ["em_montagem", "refacao"],
  em_montagem: ["refacao"],
  refacao: ["no_laboratorio"],
};

/** Rótulo de AÇÃO (o que fazer), não de estado. */
export const LAB_ACTION_LABEL: Record<LabStatus, string> = {
  aguardando_envio: "Voltar para aguardando",
  no_laboratorio: "Enviar ao laboratório",
  recebida: "Lentes chegaram",
  em_montagem: "Iniciar montagem",
  refacao: "Refação (volta ao laboratório)",
};

export const LENS_USES = ["longe", "perto", "multifocal", "bifocal", "sol"] as const;
export type LensUse = typeof LENS_USES[number];
export const LENS_USE_LABEL: Record<LensUse, string> = {
  longe: "Longe", perto: "Perto", multifocal: "Multifocal", bifocal: "Bifocal", sol: "Sol com grau",
};

export const LENS_TREATMENTS = ["Antirreflexo", "Fotossensível", "Filtro azul", "Antirrisco", "Polarizada", "Hidrofóbico"] as const;

export type OpticalDetails = {
  prescription_id: string | null;
  prescription: {
    od: EyeRx; oe: EyeRx;
    prescriber_type: PrescriberType;
    prescriber_name: string | null;
    prescriber_registry: string | null;
    issued_at: string | null;
    valid_until: string | null;
  };
  frame: { source: "estoque" | "cliente"; product_id: string | null; description: string; color?: string | null; size?: string | null };
  lens: { type: "pronta" | "surfacada"; brand: string; design: string; material: string; treatments: string[]; notes?: string };
  use: LensUse;
  adaptation_warranty_days: number;
};

/** A OS de ótica é a OS comum com kind='otica' e os campos de laboratório. */
export type OpticalOrder = ServiceOrder & {
  kind: "reparo" | "otica";
  optical?: OpticalDetails | null;
  lab_id?: string | null;
  lab_name?: string | null;
  lab_order_ref?: string | null;
  lab_status?: LabStatus | null;
  lab_sent_at?: string | null;
  lab_received_at?: string | null;
  lab_redo_count?: number;
  deposit_sale_id?: string | null;
  deposit_sale_total?: string | number | null;
  /** Soma dos pagamentos da venda do sinal (o que já entrou no caixa). */
  deposit_paid?: string | number | null;
  tracker_token?: string | null;
  ready_notified_at?: string | null;
};

export type OticaDashboard = {
  counts: Record<LabStatus | "pronta_aguardando_retirada" | "atrasadas", number>;
  expiring_prescriptions_30d: number;
};

// ─── API ─────────────────────────────────────────────────────

const base = (companyId: string) => "/companies/" + companyId + "/otica";

function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => k + "=" + encodeURIComponent(String(v)));
  return parts.length ? "?" + parts.join("&") : "";
}

export var oticaApi = {
  // Configuração
  getSettings: (companyId: string) =>
    request<{ settings: OticaSettings }>(base(companyId) + "/settings", { retry: 1 }),
  saveSettings: (companyId: string, settings: Partial<OticaSettings>) =>
    request<{ settings: OticaSettings }>(base(companyId) + "/settings", { method: "PUT", body: settings, retry: 0 }),

  // Laboratórios
  listLabs: (companyId: string) =>
    request<{ labs: OpticalLab[] }>(base(companyId) + "/labs", { retry: 1 }),
  createLab: (companyId: string, body: OpticalLabBody) =>
    request<{ lab: OpticalLab }>(base(companyId) + "/labs", { method: "POST", body, retry: 0 }),
  patchLab: (companyId: string, labId: string, body: Partial<OpticalLabBody> & { is_active?: boolean }) =>
    request<{ lab: OpticalLab }>(base(companyId) + "/labs/" + labId, { method: "PATCH", body, retry: 0 }),
  removeLab: (companyId: string, labId: string) =>
    request<{ deleted: boolean; deactivated?: boolean }>(base(companyId) + "/labs/" + labId, { method: "DELETE", retry: 0 }),

  // Receitas
  listPrescriptions: (companyId: string, filters: { customer_id?: string; q?: string; from?: string; to?: string; limit?: number; expiring_days?: number } = {}) =>
    request<{ prescriptions: Prescription[] }>(base(companyId) + "/prescriptions" + qs(filters), { retry: 1 }),
  getPrescription: (companyId: string, rxId: string) =>
    request<{ prescription: Prescription }>(base(companyId) + "/prescriptions/" + rxId, { retry: 1 }),
  createPrescription: (companyId: string, body: PrescriptionBody) =>
    request<{ prescription: Prescription }>(base(companyId) + "/prescriptions", { method: "POST", body, retry: 0 }),
  patchPrescription: (companyId: string, rxId: string, body: Partial<PrescriptionBody>) =>
    request<{ prescription: Prescription }>(base(companyId) + "/prescriptions/" + rxId, { method: "PATCH", body, retry: 0 }),
  removePrescription: (companyId: string, rxId: string) =>
    request<{ deleted: boolean }>(base(companyId) + "/prescriptions/" + rxId, { method: "DELETE", retry: 0 }),

  // Livro de registro (Decreto 24.492, arts. 7º e 8º): por período, com as OS.
  book: (companyId: string, from?: string, to?: string) =>
    request<{ rows: Array<{ issued_at: string; customer_name: string; prescriber_name: string | null; prescriber_registry: string | null; prescriber_type: PrescriberType; os_numbers: number[] }> }>(
      base(companyId) + "/prescriptions/book" + qs({ from, to }), { retry: 1 }),

  dashboard: (companyId: string) =>
    request<OticaDashboard>(base(companyId) + "/dashboard", { retry: 1 }),

  // Etapa de laboratório e aviso de pronto — moram em /service-orders
  // porque a OS de ótica É uma service_order.
  setLabStatus: (companyId: string, osId: string, lab_status: LabStatus, extra?: { lab_order_ref?: string; note?: string }) =>
    request<{ order: OpticalOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders/" + osId + "/lab",
      { method: "POST", body: { lab_status, ...(extra || {}) }, retry: 0 }),
  notifyReady: (companyId: string, osId: string) =>
    request<{ queued: boolean; skip_reason?: string | null; track_url: string; wa_link: string | null }>(
      "/companies/" + companyId + "/service-orders/" + osId + "/notify-ready",
      { method: "POST", body: {}, retry: 0 }),
};
