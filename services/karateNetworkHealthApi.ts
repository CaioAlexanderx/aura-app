// ============================================================
// KARATE NETWORK HEALTH API — Aura Karatê (Track L)
//
// Saúde da Rede: 9 indicadores institucionais + relatório periódico.
//
// Mantido SEPARADO de services/karateApi.ts (mesmo critério dos Tracks
// D, E, I, J, M) para evitar conflitos de merge na karateApi.
//
// Contrato backend: /federation/:id/network-health/*
// ============================================================
import { request } from "@/services/api";

// ── Tipos ────────────────────────────────────────────────────

export interface NetworkKpi {
  key: string;
  label: string;
  value: number;
  unit: string;
}

export interface NetworkSummary {
  season: number;
  kpis: NetworkKpi[];
}

// Filiação
export interface AfiliacaoDojo {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  affiliated_since: string | null;
  annuity_status: string | null;
}
export interface AfiliacaoPayload {
  season: number;
  total_now: number;
  novas_affiliacoes: number;
  nao_renovaram: number;
  yearly: Array<{ ano: number; new_affiliations: number }>;
  dojos: AfiliacaoDojo[];
}

// Renovação
export interface RenovacaoPayload {
  season: number;
  total_due: number;
  renewed: number;
  not_renewed: number;
  renewal_rate_pct: number | null;
}

// Cobertura
export interface CoberturaRegion {
  regiao: string;
  short: string;
  col: number;
  row: number;
  dojos: number;
  mun_covered: number;
  mun_total: number;
  practitioners: number;
}
export interface CoberturaPayload {
  regions: CoberturaRegion[];
  // Lacunas de cobertura removidas (Item 5) — opcionais por compat.
  gap_count?: number;
  gap_mun_total?: number;
  gap_names?: string;
}

// Inadimplência
export interface InadRow {
  dojo_id: string;
  dojo_name: string;
  city: string | null;
  due_date: string | null;
  amount: number;
  status: string;
  paid_at: string | null;
}
export interface InadimplenciaPayload {
  season: number;
  total: number;
  em_dia: number;
  vencendo: number;
  vencido: number;
  inad_pct: number;
  rows: InadRow[];
}

// Projeção de receita
export interface ProjecaoMonth {
  month: string;
  mes: string;
  ano: string;
  total: number;
  realized: number;
  projected: number;
  annuities: number;
  kind: "real" | "proj";
}
export interface ProjecaoPayload {
  months: number;
  total_realized: number;
  total_projected: number;
  data: ProjecaoMonth[];
}

// Dormência
export interface DormenciaDojo {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  has_exam: boolean;
  has_comp: boolean;
  active: boolean;
}
export interface DormenciaPayload {
  season: number;
  total: number;
  ativos: number;
  dormentes: number;
  pct_ativos: number | null;
  dojos: DormenciaDojo[];
}

// Concentração
export interface ConcentracaoDojo {
  id: string;
  name: string;
  practitioners: number;
  revenue: number;
}
export interface ConcentracaoPayload {
  season: number;
  total_dojos: number;
  total_practitioners: number;
  total_revenue: number;
  top5_pct_practitioners: number | null;
  top5_pct_revenue: number | null;
  top5: ConcentracaoDojo[];
  all: ConcentracaoDojo[];
}

// Graduações
export interface GraduacaoMonth {
  month: string;
  mes: string;
  ano: string;
  kyu: number;
  dan: number;
  total: number;
}
export interface GraduacaoItem {
  id: string;
  exam_date: string | null;
  student_id: string;
  student_name: string;
  dojo_name: string | null;
  from_belt: string | null;
  to_belt: string | null;
  examiner: string | null;
}
export interface GraduacoesPayload {
  months: number;
  total: number;
  kyu: number;
  dan: number;
  monthly: GraduacaoMonth[];
  list: GraduacaoItem[];
}

// Relação de faixas
export interface FaixaBucket {
  faixa: string;
  long: string;
  n: number;
  pct: number;
}
export interface RelacaoFaixasPayload {
  total: number;
  kyu: number;
  dan: number;
  dan_pct: number;
  buckets: FaixaBucket[];
  raw: Array<{ belt_level: string; belt_name: string; count: number }>;
  _note: string;
}

// Relatório periódico
export interface ReportSendResult {
  sent: boolean;
  to: string;
  season: number;
  summary: {
    dojoCount: number;
    renewalPct: number | null;
    inadPct: number | null;
    dormenteDojos: number;
    gradLast30: number;
  };
}

// ── API object ───────────────────────────────────────────────

function base(federationId: string): string {
  return `/federation/${federationId}/network-health`;
}

export const karateNetworkHealthApi = {
  getSummary: (federationId: string, season?: number): Promise<NetworkSummary> => {
    const q = season ? `?season=${season}` : "";
    return request(`${base(federationId)}/summary${q}`);
  },

  getAfiliacao: (federationId: string): Promise<AfiliacaoPayload> =>
    request(`${base(federationId)}/afiliacao`),

  getRenovacao: (federationId: string, season?: number): Promise<RenovacaoPayload> => {
    const q = season ? `?season=${season}` : "";
    return request(`${base(federationId)}/renovacao${q}`);
  },

  getCobertura: (federationId: string): Promise<CoberturaPayload> =>
    request(`${base(federationId)}/cobertura`),

  getInadimplencia: (federationId: string, season?: number): Promise<InadimplenciaPayload> => {
    const q = season ? `?season=${season}` : "";
    return request(`${base(federationId)}/inadimplencia${q}`);
  },

  getProjecaoReceita: (federationId: string, months?: number): Promise<ProjecaoPayload> => {
    const q = months ? `?months=${months}` : "";
    return request(`${base(federationId)}/projecao-receita${q}`);
  },

  getDormencia: (federationId: string, season?: number): Promise<DormenciaPayload> => {
    const q = season ? `?season=${season}` : "";
    return request(`${base(federationId)}/dormencia${q}`);
  },

  getConcentracao: (federationId: string, season?: number): Promise<ConcentracaoPayload> => {
    const q = season ? `?season=${season}` : "";
    return request(`${base(federationId)}/concentracao${q}`);
  },

  getGraduacoes: (federationId: string, months?: number): Promise<GraduacoesPayload> => {
    const q = months ? `?months=${months}` : "";
    return request(`${base(federationId)}/graduacoes${q}`);
  },

  getRelacaoFaixas: (federationId: string): Promise<RelacaoFaixasPayload> =>
    request(`${base(federationId)}/relacao-faixas`),

  // CSV export — returns a URL with ?export=csv to be opened in browser/download
  csvUrl: (federationId: string, indicator: string): string => {
    const apiBase =
      (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
      "https://aura-backend-production-f805.up.railway.app/api/v1";
    return `${apiBase}${base(federationId)}/${indicator}?export=csv`;
  },

  sendReport: (
    federationId: string,
    opts?: { to?: string; season?: number }
  ): Promise<ReportSendResult> =>
    request(
      `${base(federationId)}/report/send${opts?.season ? `?season=${opts.season}` : ""}`,
      { method: "POST", body: opts?.to ? { to: opts.to } : {} }
    ),
};
