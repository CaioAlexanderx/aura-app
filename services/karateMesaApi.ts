// ============================================================
// KARATE MESA API — Hub P2.1: mesa pública do mesário (fora do shell)
//
// Cliente do prefixo /public/karate/mesa (aura-backend PR #579,
// migration 302). Autenticação: Authorization: Bearer <token-de-64-chars>
// — o token OPACO da CONVOCAÇÃO, emitido pela federação na escala
// (NUNCA o JWT do shell). Por isso todo request daqui passa `token`
// explícito ao core (services/api.ts): com token explícito o core não
// tenta refresh de sessão nem dispara logout em 401 — um link revogado
// vira ApiError(401) limpo para a tela tratar.
//
// O servidor deriva TUDO do token (federação, competição, koto atual) —
// este cliente nunca envia esses ids. Erros de contrato:
//   401 { code:'MESA_LINK_INVALID' }      — link inválido/revogado
//   409 { code:'MESARIO_SEM_KOTO' }       — aguardando alocação de koto
//   403 { code:'CATEGORIA_FORA_DO_KOTO' } — categoria movida → refresh da fila
//
// Tipos do payload de bracket/kata reusados de karateBracketsApi
// (os handlers do backend são os MESMOS — sharedHandlers).
// ============================================================
import { request } from "@/services/api";
import type {
  BracketState, BracketNotGenerated, AdvanceResult, FinalizeResult,
  KataScore, KataScoreInput, KataScoreUpdate, KataAdvanceResult,
} from "@/services/karateBracketsApi";
import type { MatchDecision, Scoresheet } from "@/services/karateCompetitionP1Api";

// ── Tipos do GET /me ─────────────────────────────────────────
export interface MesaCompetition {
  id: string;
  name: string;
  status: string;
  event_date: string | null;
  location: string | null;
}

export interface MesaOfficial {
  name: string;
  role: string;
  is_chief: boolean;
  status: string;
}

export interface MesaArea {
  id: string;
  name: string;
  sort_order: number;
}

export interface MesaCategory {
  id: string;
  name: string;
  modality: string;
  group_label: string | null;
  division_name: string | null;
  area_order: number | null;
  entry_count: number;
  bracket_status: "not_generated" | "draft" | "locked" | "done";
  kata_mode: "score_rounds" | "hantei_tree" | null;
}

export interface MesaMe {
  competition: MesaCompetition;
  official: MesaOfficial;
  /** null = mesário ainda sem koto alocado (tela "aguardando alocação"). */
  area: MesaArea | null;
  categories: MesaCategory[];
}

// ── Token da mesa (memória do módulo) ────────────────────────
// A tela pública seta uma vez (URL ?t= → sessionStorage → aqui);
// cada request injeta como Bearer explícito.
let _mesaToken: string | null = null;
export function setMesaToken(token: string | null) { _mesaToken = token; }
export function getMesaToken(): string | null { return _mesaToken; }

/** Código de erro do contrato da mesa (e.data.code do ApiError). */
export function mesaErrorCode(e: any): string | null {
  return (e && e.data && e.data.code) || null;
}

const BASE = "/public/karate/mesa";

function req<T>(path: string, opts: { method?: string; body?: unknown; retry?: number } = {}): Promise<T> {
  return request<T>(`${BASE}${path}`, { ...opts, token: _mesaToken });
}

// ── API ──────────────────────────────────────────────────────
export const karateMesaApi = {
  /** GET /me — bootstrap: evento + oficial + koto atual + fila do koto. */
  getMe: (): Promise<MesaMe> => req("/me"),

  /** GET /categories/:catId/bracket — mesmo payload do GET da federação. */
  getBracket: (catId: string): Promise<BracketState | BracketNotGenerated> =>
    req(`/categories/${catId}/bracket`),

  /** POST /categories/:catId/bracket/advance — vencedor + decisão (kiken/W.O. inclusive). */
  advanceWinner: (
    catId: string,
    body: { match_id: string; winner_entry_id: string; aka_score?: number; shiro_score?: number; decision?: MatchDecision }
  ): Promise<AdvanceResult> =>
    req(`/categories/${catId}/bracket/advance`, { method: "POST", body, retry: 0 }),

  /** POST /categories/:catId/bracket/finalize — fecha o resultado (pódio). */
  finalizeBracket: (catId: string): Promise<FinalizeResult> =>
    req(`/categories/${catId}/bracket/finalize`, { method: "POST", body: {}, retry: 0 }),

  /** GET /categories/:catId/kata-scores */
  getKataScores: (catId: string): Promise<KataScore[]> =>
    req(`/categories/${catId}/kata-scores`),

  /**
   * PUT /categories/:catId/kata-scores — lança/edita a nota de um atleta.
   * Onda B: `notas` (uma por árbitro) é o modo novo; `nota` única segue aceita.
   */
  putKataScore: (
    catId: string,
    body: KataScoreInput
  ): Promise<KataScoreUpdate> =>
    req(`/categories/${catId}/kata-scores`, { method: "PUT", body, retry: 0 }),

  /** POST /categories/:catId/kata-scores/advance — eliminatória → final. */
  advanceKata: (catId: string, body?: { advance_count?: number }): Promise<KataAdvanceResult> =>
    req(`/categories/${catId}/kata-scores/advance`, { method: "POST", body: body || {}, retry: 0 }),

  /** GET /categories/:catId/scoresheet — súmula da categoria (fields = campos gravados). */
  getScoresheet: (catId: string): Promise<Scoresheet> =>
    req(`/categories/${catId}/scoresheet`),

  /**
   * PATCH /categories/:catId/scoresheet — grava os campos que na folha real
   * eram manuscritos (shuchin, mesário, duração). String vazia LIMPA o campo;
   * campo ausente no body fica como está. 409 NO_BRACKET quando a categoria
   * ainda não tem chave.
   */
  patchScoresheet: (catId: string, body: ScoresheetFieldsPatch): Promise<ScoresheetPatchResult> =>
    req(`/categories/${catId}/scoresheet`, { method: "PATCH", body, retry: 0 }),
};

// ── Campos manuscritos da súmula ─────────────────────────────
/** Strings de até 120 chars; vazia limpa o campo. */
export interface ScoresheetFieldsPatch {
  shuchin?: string;
  mesario?: string;
  duracao?: string;
}

export interface ScoresheetPatchResult {
  sumula: Scoresheet;
}
