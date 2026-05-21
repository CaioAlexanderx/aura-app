// ─── CRM Comercial (admin) ──────────────────────────────────────────────────
// Endpoints: /admin/leads, /admin/cadences, /admin/lead-goals, /admin/lead-views
// ============================================================
import { request } from "./api";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "responded" | "interested" | "demo" | "converted" | "lost";
export type LeadChannel = "whatsapp" | "ligacao" | "email" | "visita" | "sem_resposta" | "outro";
export type ExpectedPlan = "essencial" | "negocio" | "expansao";

export type Lead = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  source: string;
  status: LeadStatus;
  lost_reason: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  converted_company_id: string | null;
  created_at: string;
  updated_at: string;
  // Fase 1 (21/05/2026)
  expected_plan: ExpectedPlan | null;
  expected_mrr: number | null;
  cadence_name: string | null;
  cadence_day: number;
  rotten_since: string | null;
  last_activity_at: string | null;
  dynamic_score: number;
  // Computados no GET
  interaction_count?: number;
  last_interaction_at?: string | null;
  followup_overdue?: boolean;
};

export type LeadInteraction = {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  channel: LeadChannel | null;
  created_at: string;
};

export type PipelineEntry = { count: number; potential_mrr: number };
export type LeadPipeline = Record<LeadStatus, PipelineEntry>;

export type LeadStats = {
  total: number;
  contacted_total: number;
  responded_total: number;
  interested_total: number;
  demo_total: number;
  converted_total: number;
  lost_total: number;
  with_phone: number;
  avg_rating: number | null;
  overdue: number;
  pipeline_mrr: number;
  won_mrr: number;
  avg_score: number;
  rate_contacted: number;
  rate_responded: number;
  rate_interested: number;
  rate_demo: number;
  rate_converted: number;
};

export type CadenceStep = {
  day: number;
  channel: "whatsapp" | "email" | "call" | "ligacao" | "visita";
  template: string;
  subject?: string;
};

export type Cadence = {
  id: string;
  name: string;
  description: string | null;
  steps: CadenceStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  leads_in_use?: number;
};

export type LeadGoal = {
  id: string;
  reference_month: string;
  target_contacts: number;
  target_converted: number;
  target_mrr: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  actual_contacts?: number;
  actual_converted?: number;
  actual_mrr?: number;
};

export type GoalCurrentProgress = {
  goal: Partial<LeadGoal> & { reference_month: string; target_contacts: number; target_converted: number; target_mrr: number };
  actual_contacts: number;
  actual_converted: number;
  actual_mrr: number;
  pace_contacts: number;
  pace_converted: number;
  month_progress: number;
};

// ─── Saved Views (Fase 5) ───────────────────────────────────────────────────

export type LeadViewFilters = Omit<LeadFilters, "limit" | "offset">;

export type LeadView = {
  id: string;
  name: string;
  description: string | null;
  filters: LeadViewFilters;
  icon: string | null;
  color: string | null;
  is_pinned: boolean;
  is_system: boolean;
  sort_order: number;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  lead_count?: number | null;
  count_error?: boolean;
};

// ─── Fila do dia (Fase 5) ───────────────────────────────────────────────────

export type PriorityReason = "followup_overdue" | "funnel_stalled" | "hot_cold" | "new_lead" | "other";

export type QueueLead = Lead & {
  priority_score: number;
  priority_reason: PriorityReason;
};

export type QueueResponse = {
  total: number;
  by_reason: Partial<Record<PriorityReason, number>>;
  leads: QueueLead[];
};

// ─── Filtros ─────────────────────────────────────────────────────────────────

export type LeadFilters = {
  status?: LeadStatus;
  city?: string;
  category?: string;
  followup_due?: boolean;
  has_phone?: boolean;
  min_rating?: number;
  no_contact?: boolean;
  search?: string;
  min_score?: number;
  expected_plan?: ExpectedPlan;
  is_rotten?: boolean;
  limit?: number;
  offset?: number;
  status_in?: string;
  status_not_in?: string;
  stale_days?: number;
  recent_hours?: number;
};

function leadsQs(f: LeadFilters = {}): string {
  const qs: string[] = [];
  if (f.status)         qs.push(`status=${encodeURIComponent(f.status)}`);
  if (f.city)           qs.push(`city=${encodeURIComponent(f.city)}`);
  if (f.category)       qs.push(`category=${encodeURIComponent(f.category)}`);
  if (f.followup_due)   qs.push(`followup_due=true`);
  if (f.has_phone)      qs.push(`has_phone=true`);
  if (f.min_rating)     qs.push(`min_rating=${f.min_rating}`);
  if (f.no_contact)     qs.push(`no_contact=true`);
  if (f.search)         qs.push(`search=${encodeURIComponent(f.search)}`);
  if (f.min_score)      qs.push(`min_score=${f.min_score}`);
  if (f.expected_plan)  qs.push(`expected_plan=${f.expected_plan}`);
  if (f.is_rotten !== undefined) qs.push(`is_rotten=${f.is_rotten ? "true" : "false"}`);
  if (f.status_in)      qs.push(`status_in=${encodeURIComponent(f.status_in)}`);
  if (f.status_not_in)  qs.push(`status_not_in=${encodeURIComponent(f.status_not_in)}`);
  if (f.stale_days !== undefined && f.stale_days > 0)
    qs.push(`stale_days=${f.stale_days}`);
  if (f.recent_hours !== undefined && f.recent_hours > 0)
    qs.push(`recent_hours=${f.recent_hours}`);
  if (f.limit !== undefined)     qs.push(`limit=${f.limit}`);
  if (f.offset !== undefined)    qs.push(`offset=${f.offset}`);
  return qs.length ? `?${qs.join("&")}` : "";
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const crmApi = {
  leads: {
    list: (filters?: LeadFilters) =>
      request<{ total: number; pipeline: LeadPipeline; pipeline_filtered?: LeadPipeline; leads: Lead[] }>(`/admin/leads${leadsQs(filters)}`),

    meta: () =>
      request<{
        cities: { name: string; total: number }[];
        categories: { name: string; total: number }[];
        stats: {
          with_phone: number; high_rated: number; followup_overdue: number;
          rotten_total: number; hot_total: number; never_contacted: number; total: number;
        };
      }>("/admin/leads/meta"),

    stats: () => request<LeadStats>("/admin/leads/stats"),

    // Fase 5.1: queue aceita TODOS os filtros agora.
    queue: (filters?: LeadFilters & { limit?: number }) => {
      const f = { limit: 50, ...filters };
      return request<QueueResponse>(`/admin/leads/queue${leadsQs(f)}`);
    },

    get: (id: string) =>
      request<{ lead: Lead; interactions: LeadInteraction[] }>(`/admin/leads/${id}`),

    create: (body: Partial<Lead>) =>
      request<{ lead: Lead }>("/admin/leads", { method: "POST", body, retry: 0 }),

    update: (id: string, body: Partial<Lead>) =>
      request<{ lead: Lead }>(`/admin/leads/${id}`, { method: "PATCH", body, retry: 0 }),

    remove: (id: string) =>
      request<{ message: string }>(`/admin/leads/${id}`, { method: "DELETE", retry: 0 }),

    import: (leads: any[]) =>
      request<{ inserted: number; skipped: number; total: number }>(
        "/admin/leads/import", { method: "POST", body: { leads }, retry: 0 }
      ),

    exportCsvUrl: (filters?: LeadFilters) => `/admin/leads/export${leadsQs(filters)}`,

    batch: (
      ids: string[],
      action: "update_status" | "set_expected_plan" | "assign_cadence" | "mark_rotten" | "unmark_rotten" | "set_followup" | "delete",
      payload?: Record<string, any>,
    ) => request<{ action: string; affected: number; total: number }>(
      "/admin/leads/batch", { method: "POST", body: { ids, action, payload }, retry: 0 }
    ),

    recomputeScores: () =>
      request<{ recomputed: number }>("/admin/leads/recompute-scores", { method: "POST", retry: 0 }),

    markRotten: (threshold_days = 14) =>
      request<{ threshold_days: number; affected: number }>(
        "/admin/leads/mark-rotten", { method: "POST", body: { threshold_days }, retry: 0 }
      ),

    applyCadence: (id: string, cadence_name: string, start_day = 0) =>
      request<{ lead: Lead; cadence: { name: string; total_steps: number; next_step: CadenceStep | undefined } }>(
        `/admin/leads/${id}/apply-cadence`,
        { method: "POST", body: { cadence_name, start_day }, retry: 0 }
      ),

    interactions: {
      list: (leadId: string) =>
        request<{ interactions: LeadInteraction[] }>(`/admin/leads/${leadId}/interactions`),
      create: (leadId: string, body: {
        body: string;
        channel?: LeadChannel;
        new_status?: LeadStatus;
        next_followup_at?: string;
        advance_cadence?: boolean;
      }) => request<{ interaction: LeadInteraction; lead: Lead }>(
        `/admin/leads/${leadId}/interactions`, { method: "POST", body, retry: 0 }
      ),
    },
  },

  cadences: {
    list: (active?: boolean) => {
      const qs = active === undefined ? "" : `?active=${active ? "true" : "false"}`;
      return request<{ cadences: Cadence[] }>(`/admin/cadences${qs}`);
    },
    get: (id: string) => request<{ cadence: Cadence }>(`/admin/cadences/${id}`),
    create: (body: { name: string; description?: string; steps: CadenceStep[]; is_active?: boolean }) =>
      request<{ cadence: Cadence }>("/admin/cadences", { method: "POST", body, retry: 0 }),
    update: (id: string, body: Partial<{ name: string; description: string; steps: CadenceStep[]; is_active: boolean }>) =>
      request<{ cadence: Cadence }>(`/admin/cadences/${id}`, { method: "PATCH", body, retry: 0 }),
    remove: (id: string) =>
      request<{ message: string; soft_deleted: boolean; leads_in_use?: number }>(
        `/admin/cadences/${id}`, { method: "DELETE", retry: 0 }
      ),
  },

  goals: {
    list: (year?: number) => {
      const qs = year ? `?year=${year}` : "";
      return request<{ year: number; goals: LeadGoal[] }>(`/admin/lead-goals${qs}`);
    },
    current: () => request<GoalCurrentProgress>("/admin/lead-goals/current"),
    get: (id: string) => request<{ goal: LeadGoal }>(`/admin/lead-goals/${id}`),
    upsert: (body: {
      reference_month: string | { year: number; month: number };
      target_contacts: number;
      target_converted: number;
      target_mrr?: number;
      notes?: string;
    }) => request<{ goal: LeadGoal; created: boolean }>(
      "/admin/lead-goals", { method: "POST", body, retry: 0 }
    ),
    update: (id: string, body: Partial<Pick<LeadGoal, "target_contacts" | "target_converted" | "target_mrr" | "notes">>) =>
      request<{ goal: LeadGoal }>(`/admin/lead-goals/${id}`, { method: "PATCH", body, retry: 0 }),
    remove: (id: string) =>
      request<{ message: string }>(`/admin/lead-goals/${id}`, { method: "DELETE", retry: 0 }),
  },

  views: {
    list: () => request<{ views: LeadView[] }>("/admin/lead-views"),
    get: (id: string) => request<{ view: LeadView }>(`/admin/lead-views/${id}`),
    create: (body: {
      name: string;
      description?: string;
      filters: LeadViewFilters;
      icon?: string;
      color?: string;
      is_pinned?: boolean;
      sort_order?: number;
    }) => request<{ view: LeadView }>("/admin/lead-views", { method: "POST", body, retry: 0 }),
    update: (id: string, body: Partial<{
      name: string;
      description: string;
      filters: LeadViewFilters;
      icon: string;
      color: string;
      is_pinned: boolean;
      sort_order: number;
    }>) => request<{ view: LeadView }>(`/admin/lead-views/${id}`, { method: "PATCH", body, retry: 0 }),
    remove: (id: string) =>
      request<{ message: string }>(`/admin/lead-views/${id}`, { method: "DELETE", retry: 0 }),
  },
};
