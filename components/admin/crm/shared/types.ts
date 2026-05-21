// ─── CRM Comercial — Tipos locais do modulo ──────────────────────────────────
// Tipos compartilhados pelos views/components do CRM admin que NAO pertencem
// ao contrato da API (esses ficam em services/crmApi.ts).

import type { LeadStatus, LeadChannel, ExpectedPlan, Lead } from "@/services/crmApi";

// ── Modo de visualizacao ─────────────────────────────────────────────────────

export type ViewMode = "lista" | "kanban" | "pipeline" | "importar" | "metas";

// ── Filtros (state local sincronizado com URL query string) ──────────────────

export type LeadListFilters = {
  search: string;
  status: LeadStatus | "";
  city: string;
  category: string;
  has_phone: boolean;
  min_rating: string;          // "" | "3" | "3.5" | "4" | "4.5"
  followup_due: boolean;
  no_contact: boolean;
  // Fase 1 (21/05/2026)
  min_score: string;           // "" | "30" | "50"
  expected_plan: ExpectedPlan | "";
  is_rotten: "" | "true" | "false";
};

export const DEFAULT_FILTERS: LeadListFilters = {
  search: "",
  status: "",
  city: "",
  category: "",
  has_phone: false,
  min_rating: "",
  followup_due: false,
  no_contact: false,
  min_score: "",
  expected_plan: "",
  is_rotten: "",
};

// ── Selecao em lote (BatchActionBar) ─────────────────────────────────────────

export type BatchSelection = {
  ids: Set<string>;
  // Opcional: leads materializados pra mostrar contagem por status na barra
  leads?: Lead[];
};

// ── Estado do modal de interacao ─────────────────────────────────────────────

export type InteractionDraft = {
  body: string;
  channel: LeadChannel;
  new_status: LeadStatus | "";
  next_followup_at: string;   // "YYYY-MM-DD"
  advance_cadence: boolean;
};

export const DEFAULT_INTERACTION_DRAFT: InteractionDraft = {
  body: "",
  channel: "whatsapp",
  new_status: "",
  next_followup_at: "",
  advance_cadence: false,
};

// ── Importacao Excel ─────────────────────────────────────────────────────────

export type ImportStats = { inserted: number; skipped: number };

// ── Kanban DnD ───────────────────────────────────────────────────────────────

export type KanbanDragState = {
  draggingId: string | null;
  draggingStatus: LeadStatus | null;
  hoverStatus: LeadStatus | null;
};
