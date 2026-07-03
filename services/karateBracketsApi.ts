// ============================================================
// KARATE BRACKETS API — Track M (Chaves)
//
// Endpoints para:
//   Kumite: bracket eliminatório (generate / lock / get / advance)
//   Kata:   apuração por bateria (kata-scores, generate-order, advance)
//
// Montado separado de karateCompetitionsApi.ts — mesmo padrão.
// ============================================================
import { request } from "@/services/api";

// ── Tipos compartilhados ─────────────────────────────────────────
export type BracketStatus = "not_generated" | "draft" | "locked";
export type BracketKind = "main" | "third";
export type KataPhase = "eliminatoria" | "final";
export type DrawMethod = "ranking" | "random";

export interface BracketOptions {
  method: DrawMethod;
  separateSameDojo: boolean;
  thirdPlace: boolean;
}

export interface BracketAthleteRef {
  entry_id: string;
  student_name: string | null;
  dojo_name: string | null;
}

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  aka: BracketAthleteRef | "bye" | null;
  shiro: BracketAthleteRef | "bye" | null;
  winner_entry_id: string | null;
  is_bye: boolean;
}

export interface BracketState {
  bracket_id: string;
  status: BracketStatus;
  modality: string;
  seed: string | null;
  options: BracketOptions;
  athletes_count: number;
  pending_payment_count?: number;
  bye_count: number;
  rounds: BracketMatch[][];
  third_place_match: BracketMatch | null;
  champion: BracketAthleteRef | null;
}

export interface BracketNotGenerated {
  status: "not_generated";
  athletes_count: number;
  pending_payment_count?: number;
  bracket: null;
}

export interface GenerateResult {
  bracket_id: string;
  modality: string;
  status: "draft";
  seed: string;
  options: BracketOptions;
  athletes_count: number;
  bye_count?: number;
  same_dojo_clashes?: number;
  third_place?: boolean;
  rounds_count?: number;
  // Kata-specific
  presentation_order?: Array<{ entry_id: string; student_name: string; order: number }>;
}

export interface LockResult {
  bracket_id: string;
  status: "locked";
  modality: string;
  message: string;
}

export interface AdvanceResult {
  match_id: string;
  winner_entry_id: string;
  champion_entry_id: string | null;
  third_place_match: {
    aka_entry_id: string | null;
    shiro_entry_id: string | null;
    winner_entry_id: string | null;
  } | null;
}

export interface KataScore {
  entry_id: string;
  student_name: string;
  dojo_name: string | null;
  phase: KataPhase;
  nota: number | null;
  presentation_order: number | null;
  advances: boolean | null;
}

export interface KataScoreUpdate {
  entry_id: string;
  phase: KataPhase;
  nota: number;
  updated_at: string;
}

export interface KataAdvanceResult {
  advanced: number;
  eliminated: number;
  advancing_entry_ids: string[];
}

export interface KataOrderResult {
  seed: string;
  presentation_order: Array<{ entry_id: string; student_name: string; order: number }>;
}

// ── API calls ──────────────────────────────────────────────────
export const karateBracketsApi = {
  // ── Kumite bracket ────────────────────────────────────────

  /** POST /competitions/:cid/categories/:catId/bracket/generate */
  generateBracket: (
    federationId: string,
    cid: string,
    catId: string,
    body: { method?: DrawMethod; separateSameDojo?: boolean; thirdPlace?: boolean; seed?: string }
  ): Promise<GenerateResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/generate`,
      { method: "POST", body }
    ),

  /** POST /competitions/:cid/categories/:catId/bracket/lock */
  lockBracket: (
    federationId: string,
    cid: string,
    catId: string
  ): Promise<LockResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/lock`,
      { method: "POST", body: {} }
    ),

  /** GET /competitions/:cid/categories/:catId/bracket */
  getBracket: (
    federationId: string,
    cid: string,
    catId: string
  ): Promise<BracketState | BracketNotGenerated> =>
    request(`/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket`),

  /** POST /competitions/:cid/categories/:catId/bracket/advance */
  advanceWinner: (
    federationId: string,
    cid: string,
    catId: string,
    body: { match_id: string; winner_entry_id: string }
  ): Promise<AdvanceResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/advance`,
      { method: "POST", body }
    ),

  // ── Kata scores ─────────────────────────────────────────

  /** GET /competitions/:cid/categories/:catId/kata-scores */
  getKataScores: (
    federationId: string,
    cid: string,
    catId: string
  ): Promise<KataScore[]> =>
    request(`/federation/${federationId}/competitions/${cid}/categories/${catId}/kata-scores`),

  /** PUT /competitions/:cid/categories/:catId/kata-scores */
  putKataScore: (
    federationId: string,
    cid: string,
    catId: string,
    body: { entry_id: string; phase: KataPhase; nota: number }
  ): Promise<KataScoreUpdate> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/kata-scores`,
      { method: "PUT", body }
    ),

  /** POST .../kata-scores/generate-order */
  generateKataOrder: (
    federationId: string,
    cid: string,
    catId: string,
    body?: { seed?: string }
  ): Promise<KataOrderResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/kata-scores/generate-order`,
      { method: "POST", body: body || {} }
    ),

  /** POST .../kata-scores/advance */
  advanceKata: (
    federationId: string,
    cid: string,
    catId: string,
    body?: { advance_count?: number }
  ): Promise<KataAdvanceResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/kata-scores/advance`,
      { method: "POST", body: body || {} }
    ),
};
