// ============================================================
// KARATE BRACKETS API — Track M (Chaves)
//
// Endpoints para:
//   Kumite: bracket eliminatório (generate / lock / get / advance)
//   Kata:   apuração por bateria (kata-scores, generate-order, advance)
//
// Montado separado de karateCompetitionsApi.ts — mesmo padrão.
//
// P2 (modo mesário): o GET do bracket passou a expor phase_plan/
// phases_by_round (formato por rodada, migration 296) e o advance
// aceita `decision` (como a luta foi decidida — kiken/W.O. inclusive).
// POST .../bracket/finalize deriva o pódio e grava nas inscrições.
// ============================================================
import { request } from "@/services/api";
import type { PhasePlan, MatchDecision } from "@/services/karateCompetitionP1Api";

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
  aka_score?: number;
  shiro_score?: number;
  /** P1 (296): formato efetivo da luta (snapshot do lançamento OU resolvido do plano). */
  match_format?: string | null;
  /** P1 (296): registro de COMO a luta foi decidida (kiken/W.O. inclusive). */
  decision?: MatchDecision | null;
}

/** Fase efetiva por rodada, já resolvida pelo backend a partir do phase_plan. */
export interface PhaseByRound {
  round: number;
  format: string | null;
  format_label: string | null;
  decision: string | null;
  duration_sec: number | null;
  time_mode: "corrido" | "efetivo" | null;
}

export interface BracketState {
  bracket_id: string;
  status: BracketStatus;
  modality: string;
  /** 'hantei_tree' | 'score_rounds' | null — kata em árvore vs. por notas. */
  kata_mode?: string | null;
  seed: string | null;
  options: BracketOptions;
  /** P1 (296): plano de fases da categoria ({} quando não configurado). */
  phase_plan?: PhasePlan;
  /** P1 (296): fase efetiva de cada rodada (índice = round). */
  phases_by_round?: PhaseByRound[];
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

/** Um degrau do pódio derivado pelo finalize (P2). */
export interface PodiumEntry {
  placement: number;
  entry_id: string;
  name: string | null;
  dojo: string | null;
  points_awarded: number;
}

/** Resposta do POST .../bracket/finalize (P2 — modo mesário).
 *  Erros esperados: 422 { code: 'FINAL_PENDENTE' | 'TERCEIRO_PENDENTE' },
 *  409 { code: 'BRACKET_NOT_LOCKED' } — chegam como ApiError (status + data.code). */
export interface FinalizeResult {
  finalized: boolean;
  category_id: string;
  podium: PodiumEntry[];
  points_applied: boolean;
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

// ── Edição total do bracket (Fase 2) ──────────────────────────────
// Cada item representa SOMENTE os campos que mudaram para aquele match.
// `id` é o id sintético devolvido pelo GET (ex.: "r0-0", "r1-2", "third").
export interface BracketMatchEdit {
  id: string;
  aka_entry_id?: string | null;
  shiro_entry_id?: string | null;
  winner_entry_id?: string | null;
  aka_score?: number | null;
  shiro_score?: number | null;
  is_bye?: boolean;
}

export interface UnlockResult {
  status: "draft";
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

/** Item enviado ao PUT .../kata-scores/order (reordenação manual). */
export interface KataOrderItem {
  entry_id: string;
  presentation_order: number;
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

  /** POST /competitions/:cid/categories/:catId/bracket/advance
   *  `decision` (P1/P2): como a luta foi decidida — em especial
   *  method 'kiken'/'wo' para ausência (o vencedor é o presente). */
  advanceWinner: (
    federationId: string,
    cid: string,
    catId: string,
    body: { match_id: string; winner_entry_id: string; aka_score?: number; shiro_score?: number; decision?: MatchDecision }
  ): Promise<AdvanceResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/advance`,
      { method: "POST", body }
    ),

  /** POST /competitions/:cid/categories/:catId/bracket/finalize — P2 (modo
   *  mesário): deriva o pódio da chave decidida e grava nas inscrições
   *  (placement + points_awarded). Idempotente no backend; retry 0 mesmo
   *  assim (ação explícita do operador). */
  finalizeBracket: (
    federationId: string,
    cid: string,
    catId: string
  ): Promise<FinalizeResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/finalize`,
      { method: "POST", body: {}, retry: 0 }
    ),

  /** PUT /competitions/:cid/categories/:catId/bracket/matches — edição total (Fase 2) */
  saveMatches: (
    federationId: string,
    cid: string,
    catId: string,
    matches: BracketMatchEdit[]
  ): Promise<BracketState> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/matches`,
      { method: "PUT", body: { matches } }
    ),

  /** POST /competitions/:cid/categories/:catId/bracket/reset — limpa vencedores/placares, mantém posições */
  resetBracket: (
    federationId: string,
    cid: string,
    catId: string
  ): Promise<BracketState> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/reset`,
      { method: "POST", body: {} }
    ),

  /** POST /competitions/:cid/categories/:catId/bracket/unlock — destrava (locked → draft) */
  unlockBracket: (
    federationId: string,
    cid: string,
    catId: string
  ): Promise<UnlockResult> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/bracket/unlock`,
      { method: "POST", body: {} }
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

  /** PUT .../kata-scores/order — reordenação manual (drag-and-drop) da ordem de apresentação */
  saveKataOrder: (
    federationId: string,
    cid: string,
    catId: string,
    phase: KataPhase,
    order: KataOrderItem[]
  ): Promise<KataScore[]> =>
    request(
      `/federation/${federationId}/competitions/${cid}/categories/${catId}/kata-scores/order`,
      { method: "PUT", body: { phase, order } }
    ),
};
