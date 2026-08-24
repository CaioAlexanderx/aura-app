// ============================================================
// AURA KARATÊ — P1 Hub: KOTOS, FASES, SÚMULA, ARBITRAGEM e TERMOS
// (cliente da FEDERAÇÃO)
//
// Backend: karateCompetitionSetup.js (áreas + schedule-board),
// karateBrackets.js (phase-plan + scoresheet) e karateOfficials.js
// (arbitragem + termos) — migrations 296/297/298, já em produção.
//
// Service próprio e pequeno (regra da casa — karateApi.ts não cresce).
// ============================================================
import { request } from "@/services/api";

// ── Kotos / board do dia (297) ──────────────────────────────

export interface CompetitionArea {
  id: string;
  name: string;
  sort_order: number;
  notes: string | null;
  category_count: number;
}

export interface BoardCategory {
  id: string;
  name: string;
  modality: string;
  group_label: string | null;
  division_name: string | null;
  area_order: number | null;
  entry_count: number;
  est_minutes: number;
}

export interface BoardArea {
  id: string;
  name: string;
  sort_order: number;
  notes: string | null;
  entry_count: number;
  est_minutes: number;
  est_label: string;
  categories: BoardCategory[];
}

/**
 * Onda B — atleta com provas alocadas em kotos DIFERENTES: no dia, pode ser
 * chamado em duas áreas ao mesmo tempo. É AVISO, nunca bloqueio: a federação
 * continua livre para mover categorias; a mesa central usa isso para sequenciar.
 */
export interface BoardConflictCategory {
  id: string;
  name: string;
  area_name: string;
}

export interface BoardConflict {
  student_id: string;
  student_name: string;
  /** Quantidade de kotos distintos em que o atleta tem prova. */
  area_count: number;
  categories: BoardConflictCategory[];
}

export interface ScheduleBoard {
  competition_id: string;
  areas: BoardArea[];
  unassigned: BoardCategory[];
  totals: { categories: number; assigned: number; entry_count: number; conflict_count?: number };
  /** Ausente em backends antigos — tratar como lista vazia. */
  conflicts?: BoardConflict[];
}

// ── Plano de fases (296) ────────────────────────────────────

export type MatchFormat =
  | "sanbon_kumite" | "kihon_ippon" | "jyu_ippon"
  | "shobu_ippon" | "shobu_sanbon" | "kata_hantei" | "kata_notas";

export type DecisionMethod =
  | "ippon" | "wazari" | "hantei" | "kettei_sen"
  | "sai_shiai" | "central" | "wo" | "kiken";

export interface PhaseSpec {
  from_participants?: number | null;
  final?: boolean;
  format: MatchFormat;
  decision?: DecisionMethod | null;
  duration_sec?: number | null;
  time_mode?: "corrido" | "efetivo" | null;
}

export interface PhasePlan {
  phases?: PhaseSpec[];
  tiebreak?: DecisionMethod[];
  required_kata?: string | null;
  prize_places?: number | null;
  third_place_dispute?: boolean;
  notes?: string | null;
}

export interface MatchDecision {
  method: DecisionMethod;
  votes_aka?: number;
  votes_shiro?: number;
  note?: string;
}

// ── Súmula (scoresheet) ─────────────────────────────────────

export interface ScoresheetSide {
  entry_id: string;
  name: string | null;
  dojo_name: string | null;
}

export interface ScoresheetMatch {
  id: string;
  aka: ScoresheetSide | "bye" | null;
  shiro: ScoresheetSide | "bye" | null;
  winner_entry_id: string | null;
  aka_score: number | null;
  shiro_score: number | null;
  decision: MatchDecision | null;
  match_format: MatchFormat | null;
}

export interface ScoresheetRound {
  round: number;
  label: string;
  format: MatchFormat | null;
  format_label: string | null;
  duration_sec: number | null;
  time_mode: string | null;
  matches: ScoresheetMatch[];
}

export interface Scoresheet {
  competition: { id: string; name: string; season: number | null; event_date: string | null; location: string | null };
  category: { id: string; name: string; modality: string; division_name: string | null; group_label: string | null };
  area: { name: string } | null;
  athletes: { entry_id: string; name: string | null; dojo_name: string | null; is_team: boolean }[];
  rules_footer: {
    tiebreak: string[];
    required_kata: string | null;
    prize_places: number;
    third_place_dispute: boolean;
    third_place_note: string | null;
    notes: string | null;
  };
  fields: { koto: string | null; shuchin: string | null; mesario: string | null; duracao: string | null };
  bracket: { status: string; kata_mode?: string | null; rounds_count?: number };
  rounds?: ScoresheetRound[];
  third_place_match?: (ScoresheetMatch & { format_label?: string | null }) | null;
  champion?: ScoresheetSide | null;
  kata_scores?: {
    entry_id: string; name: string | null; dojo_name: string | null;
    phase: "eliminatoria" | "final"; nota: number | null;
    /** Onda B: notas individuais dos árbitros (3–7). Ausente/null no legado. */
    notas?: number[] | null;
    presentation_order: number | null; advances: boolean | null;
  }[];
}

// ── Fila de premiação (P2, migration 301) ───────────────────

export interface AwardPodiumEntry {
  placement: number;
  entry_id: string;
  name: string | null;
  dojo: string | null;
  points_awarded: number;
}

export interface AwardsQueueItem {
  category_id: string;
  category_name: string;
  modality: string;
  group_label: string | null;
  division_name: string | null;
  area_name: string | null;
  awards_delivered: boolean;
  awards_delivered_at: string | null;
  podium: AwardPodiumEntry[];
}

export interface AwardsQueue {
  data: AwardsQueueItem[];
  count: number;
  /** Categorias ainda não entregues (ausente quando schema_pending). */
  pending?: number;
  /** Migration 301 pendente — fila indisponível, nunca 500. */
  schema_pending?: boolean;
}

// ── Check-in leve (credenciamento do dia) ───────────────────
//
// Presença por ATLETA — marcar propaga para todas as inscrições dele no
// campeonato. Duas pontas escrevem no mesmo dado: o dojô (balcão do
// próprio time) e a federação (balcão do credenciamento). A origem fica
// registrada para o dia seguir sem discussão sobre "quem marcou".

export type CheckInStatus = "presente" | "ausente" | "pendente";
export type CheckInSource = "dojo" | "federacao";
/** 'limpar' devolve o atleta ao estado 'pendente'. */
export type CheckInAction = "presente" | "ausente" | "limpar";

export interface CheckInEntry {
  student_id: string;
  student_name: string;
  dojo_id: string | null;
  dojo_name: string | null;
  /** Provas do atleta no campeonato (nomes das categorias). */
  categories: string[];
  status: CheckInStatus;
  checked_in_at: string | null;
  check_in_source: CheckInSource | null;
}

export interface CheckInTotals {
  atletas: number;
  presentes: number;
  ausentes: number;
  pendentes: number;
}

export interface CheckInResponse {
  data: CheckInEntry[];
  totals: CheckInTotals;
  /** Migration do check-in ainda não aplicada — lista vazia, nunca 500. */
  schema_pending?: boolean;
}

// ── Arbitragem (298) ────────────────────────────────────────

export type OfficialRole = "arbitro" | "mesario" | "staff";
export type Credential = "A" | "B" | "C" | "D";
export type OfficialStatus = "summoned" | "confirmed" | "declined" | "present" | "absent";

export interface Official {
  id: string;
  practitioner_id: string | null;
  name: string;
  dojo_id: string | null;
  dojo_name: string | null;
  role: OfficialRole;
  credential: Credential | null;
  credential_note: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
}

export interface EventOfficial {
  id: string;
  official_id: string;
  area_id: string | null;
  area_name: string | null;
  status: OfficialStatus;
  is_chief: boolean;
  sort_order: number;
  penalty_amount: number | null;
  penalty_note: string | null;
  notes: string | null;
  confirmed_at: string | null;
  name: string;
  role: OfficialRole;
  credential: Credential | null;
  dojo_name: string | null;
  /** P2.1 (302): há um link de mesa ATIVO para esta convocação. */
  mesa_token_active?: boolean;
  mesa_token_created_at?: string | null;
}

/** P2.1 — resposta da emissão do link de mesa. O token aparece UMA vez. */
export interface MesaTokenIssued {
  token: string;
  created_at: string;
  official_name: string;
  note: string;
}

// ── Termos (298) ────────────────────────────────────────────

export interface WaiverTerms { version?: string; title?: string; body?: string }

export interface WaiverItem {
  practitioner_id: string;
  practitioner_name: string;
  dojo_id: string | null;
  dojo_name: string | null;
  accepted: boolean;
  accepted_at: string | null;
  accepted_by_role: "athlete" | "guardian" | null;
  accepted_by_name: string | null;
  modalities: string[] | null;
  image_consent: boolean | null;
}

export interface WaiverStatus {
  required: boolean;
  total: number;
  accepted: number;
  pending: number;
  items: WaiverItem[];
  schema_pending?: boolean;
}

// ── Cliente ─────────────────────────────────────────────────

const comp = (fid: string, cid: string) => `/federation/${fid}/competitions/${cid}`;

export const karateCompetitionP1Api = {
  // Kotos
  listAreas: (fid: string, cid: string): Promise<CompetitionArea[]> =>
    request(`${comp(fid, cid)}/areas`),
  createArea: (fid: string, cid: string, body: { name: string; sort_order?: number; notes?: string }): Promise<CompetitionArea> =>
    request(`${comp(fid, cid)}/areas`, { method: "POST", body }),
  updateArea: (fid: string, cid: string, areaId: string, patch: Partial<{ name: string; sort_order: number; notes: string | null }>): Promise<CompetitionArea> =>
    request(`${comp(fid, cid)}/areas/${areaId}`, { method: "PATCH", body: patch }),
  deleteArea: (fid: string, cid: string, areaId: string): Promise<{ deleted: boolean }> =>
    request(`${comp(fid, cid)}/areas/${areaId}`, { method: "DELETE" }),

  /** Move a categoria para um koto (area_id null = tira do dia). */
  assignCategoryArea: (
    fid: string, cid: string, catId: string,
    body: { area_id?: string | null; area_order?: number | null }
  ): Promise<{ id: string; area_id: string | null; area_order: number | null }> =>
    request(`${comp(fid, cid)}/categories/${catId}/area`, { method: "PATCH", body, retry: 0 }),

  getScheduleBoard: (fid: string, cid: string): Promise<ScheduleBoard> =>
    request(`${comp(fid, cid)}/schedule-board`),

  // Plano de fases
  savePhasePlan: (fid: string, cid: string, catId: string, plan: PhasePlan): Promise<{ bracket_id: string; status: string; phase_plan: PhasePlan }> =>
    request(`${comp(fid, cid)}/categories/${catId}/bracket/phase-plan`, { method: "PATCH", body: { phase_plan: plan }, retry: 0 }),

  // Súmula
  getScoresheet: (fid: string, cid: string, catId: string): Promise<Scoresheet> =>
    request(`${comp(fid, cid)}/categories/${catId}/scoresheet`),

  // Fila de premiação (P2) — pendentes primeiro, na ordem do board.
  getAwardsQueue: (fid: string, cid: string): Promise<AwardsQueue> =>
    request(`${comp(fid, cid)}/awards`),
  /** Marca/desmarca "medalhas entregues" da categoria (delivered: false = desfazer). */
  setAwardsDelivered: (
    fid: string, cid: string, catId: string, delivered: boolean
  ): Promise<{ category_id: string; awards_delivered: boolean; awards_delivered_at: string | null }> =>
    request(`${comp(fid, cid)}/categories/${catId}/awards-delivered`, { method: "POST", body: { delivered }, retry: 0 }),

  // Check-in leve — credenciamento do dia (ordenado por dojô, atleta).
  getCheckIn: (fid: string, cid: string): Promise<CheckInResponse> =>
    request(`${comp(fid, cid)}/check-in`),
  /** Marca a presença do ATLETA — propaga para todas as inscrições dele. */
  setCheckIn: (fid: string, cid: string, studentId: string, status: CheckInAction): Promise<{ entries_updated: number }> =>
    request(`${comp(fid, cid)}/check-in/${studentId}`, { method: "PATCH", body: { status }, retry: 0 }),

  // Arbitragem
  listOfficials: (fid: string, params?: { role?: OfficialRole; active?: boolean }): Promise<Official[]> => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.active === false) qs.set("active", "false");
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${fid}/officials${q}`);
  },
  createOfficial: (fid: string, body: Partial<Official> & { name: string }): Promise<Official> =>
    request(`/federation/${fid}/officials`, { method: "POST", body }),
  updateOfficial: (fid: string, officialId: string, patch: Partial<Official>): Promise<Official> =>
    request(`/federation/${fid}/officials/${officialId}`, { method: "PATCH", body: patch }),
  deactivateOfficial: (fid: string, officialId: string): Promise<{ deactivated: boolean }> =>
    request(`/federation/${fid}/officials/${officialId}`, { method: "DELETE" }),

  listEventOfficials: (fid: string, cid: string): Promise<EventOfficial[]> =>
    request(`${comp(fid, cid)}/officials`),
  summonOfficials: (fid: string, cid: string, officialIds: string[]): Promise<{ summoned: number; already: number; skipped: { official_id: string; message: string }[] }> =>
    request(`${comp(fid, cid)}/officials`, { method: "POST", body: { official_ids: officialIds }, retry: 0 }),
  updateEventOfficial: (
    fid: string, cid: string, rowId: string,
    patch: Partial<{ status: OfficialStatus; area_id: string | null; is_chief: boolean; sort_order: number; penalty_amount: number | null; penalty_note: string | null; notes: string | null }>
  ): Promise<EventOfficial> =>
    request(`${comp(fid, cid)}/officials/${rowId}`, { method: "PATCH", body: patch, retry: 0 }),
  removeEventOfficial: (fid: string, cid: string, rowId: string): Promise<{ removed: boolean }> =>
    request(`${comp(fid, cid)}/officials/${rowId}`, { method: "DELETE" }),

  // P2.1 — link da mesa do mesário (acesso fora do shell, migration 302).
  // Emitir ROTACIONA: substitui qualquer link anterior da convocação.
  issueMesaToken: (fid: string, cid: string, rowId: string): Promise<MesaTokenIssued> =>
    request(`${comp(fid, cid)}/officials/${rowId}/mesa-token`, { method: "POST", body: {}, retry: 0 }),
  revokeMesaToken: (fid: string, cid: string, rowId: string): Promise<{ revoked: boolean; id: string }> =>
    request(`${comp(fid, cid)}/officials/${rowId}/mesa-token`, { method: "DELETE", retry: 0 }),

  // Termos
  saveWaiverTerms: (fid: string, cid: string, body: { waiver_terms?: WaiverTerms; waiver_required?: boolean }): Promise<{ id: string; waiver_terms: WaiverTerms; waiver_required: boolean }> =>
    request(`${comp(fid, cid)}/waiver-terms`, { method: "PATCH", body, retry: 0 }),
  getWaivers: (fid: string, cid: string, dojoId?: string): Promise<WaiverStatus> =>
    request(`${comp(fid, cid)}/waivers${dojoId ? `?dojo_id=${dojoId}` : ""}`),
  registerWaiver: (
    fid: string, cid: string,
    body: { practitioner_id: string; accepted_by_role: "athlete" | "guardian"; accepted_by_name: string; accepted_by_doc?: string; modalities?: string[]; image_consent?: boolean }
  ): Promise<WaiverItem> =>
    request(`${comp(fid, cid)}/waivers`, { method: "POST", body, retry: 0 }),
};

// ── Rótulos compartilhados (espelham o serviço puro do backend) ──

export const FORMAT_LABEL: Record<MatchFormat, string> = {
  sanbon_kumite: "Sanbon-Kumite",
  kihon_ippon: "Kihon-Ippon-Kumite",
  jyu_ippon: "Jyu-Ippon-Kumite",
  shobu_ippon: "Kumite Shobu-Ippon",
  shobu_sanbon: "Kumite Shobu-Sanbon",
  kata_hantei: "Kata (bandeiras)",
  kata_notas: "Kata (notas)",
};

export const DECISION_LABEL: Record<DecisionMethod, string> = {
  ippon: "Ippon",
  wazari: "Wazari",
  hantei: "Hantei (bandeiras)",
  kettei_sen: "Kettei-Sen (prorrogação)",
  sai_shiai: "Sai-Shiai (nova luta)",
  central: "Decisão do árbitro central",
  wo: "W.O.",
  kiken: "Kiken (desistência)",
};

export const OFFICIAL_STATUS_LABEL: Record<OfficialStatus, string> = {
  summoned: "Convocado",
  confirmed: "Confirmado",
  declined: "Recusou",
  present: "Presente",
  absent: "Ausente",
};

export const OFFICIAL_ROLE_LABEL: Record<OfficialRole, string> = {
  arbitro: "Árbitro",
  mesario: "Mesário",
  staff: "Staff",
};

/** 210 → "~3,5h" (mesmo formato do backend/planilha). */
export function formatEstMinutes(min: number | null | undefined): string {
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m < 60) return `~${Math.round(m)}min`;
  const h = Math.round((m / 60) * 10) / 10;
  return `~${String(h).replace(".", ",")}h`;
}
