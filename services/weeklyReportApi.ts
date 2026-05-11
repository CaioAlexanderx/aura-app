// ─── Weekly Report API ─────────────────────────────
// Acesso publico (sem auth) ao relatorio semanal via token JWT
// enviado por email. Token = 30d TTL, gating por plano espelha
// o template do email (heatmap+dormentes só Negocio+, AI só Expansao+).
//
// Backend: GET /api/v1/reports/weekly/:token
//   -> 200 WeeklyReport JSON
//   -> 401 { code: 'invalid' }
//   -> 410 { code: 'expired' }
//   -> 404 { code: 'company_not_found' }
// ─────────────────────────────────────────────────

const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

export type WeeklyReportError = {
  code: "missing_token" | "invalid" | "expired" | "company_not_found" | "internal" | "network" | "unknown";
  message: string;
};

export type WeeklyReportKpis = {
  revenue: number;
  revenue_delta: number;
  revenue_dir: "up" | "down";
  sales: number;
  active_days: number;
  avg_ticket: number;
  ticket_delta: number;
  ticket_dir: "up" | "down";
  new_customers: number;
  customers_delta: number;
  customers_dir: "up" | "down";
  health_score: number;
};

export type DailyRevenuePoint = {
  day: string;
  date: string;
  value: number;
  is_best: boolean;
};

export type TopProduct = {
  rank: number;
  name: string;
  category: string;
  revenue: number;
  qty: number;
};

export type PaymentSlice = {
  name: string;
  pct: number;
};

export type Priority = {
  num: number;
  title?: string;
  description?: string;
  icon_type?: string;
  text?: string;
};

export type WowInsight = {
  icon_type: string;
  text: string;
};

export type Narratives = {
  revenue: string;
  products: string;
  payments: string;
};

export type HeatmapCell = {
  dow: number;
  hour: number;
  sale_count: number;
  revenue: number;
};

export type DormantCustomer = {
  id: string | number;
  name: string;
  total_spent: number;
  last_purchase_at: string;
  days_dormant: number;
};

export type StaleProduct = {
  id: string | number;
  name: string;
  category: string;
  stock_qty: number;
  days_idle: number | null;
};

export type WeeklyReport = {
  company: {
    name: string;
    plan: string;
    logo_url: string | null;
  };
  period: {
    start_date: string;
    end_date: string;
    label: string;
    edition: number;
    sent_at: string;
  };
  health: { score: number; label: string; delta?: number; delta_dir?: string };
  kpis: WeeklyReportKpis;
  daily_revenue: DailyRevenuePoint[];
  top_products: TopProduct[];
  payments: PaymentSlice[];
  priorities: Priority[];
  wow_insight: WowInsight | null;
  narratives: Narratives;
  heatmap: HeatmapCell[] | null;
  dormant: { count: number; topDormant: DormantCustomer[] } | null;
  stale_products: StaleProduct[];
  gating: {
    plan: string;
    show_heatmap: boolean;
    show_dormant: boolean;
    show_ai: boolean;
  };
};

export type WeeklyReportResult =
  | { ok: true; data: WeeklyReport }
  | { ok: false; error: WeeklyReportError };

export async function fetchWeeklyReport(token: string): Promise<WeeklyReportResult> {
  if (!token) {
    return { ok: false, error: { code: "missing_token", message: "Link inválido." } };
  }
  try {
    const res = await fetch(`${BASE_URL}/reports/weekly/${encodeURIComponent(token)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const code = (body?.code as WeeklyReportError["code"]) || "unknown";
      const message = body?.error ||
        (code === "expired" ? "Este link expirou. Acesse o painel para ver o relatório atual." :
         code === "invalid" ? "Link inválido. Verifique o endereço ou abra direto pelo app." :
         "Não foi possível carregar o relatório.");
      return { ok: false, error: { code, message } };
    }
    return { ok: true, data: body as WeeklyReport };
  } catch (_err) {
    return { ok: false, error: { code: "network", message: "Erro de conexão. Verifique sua internet e tente novamente." } };
  }
}
