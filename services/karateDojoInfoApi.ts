// ============================================================
// AURA KARATÊ — /dojo/me AUTENTICADO (lado do dojô logado)
//
//   GET /federation/:id/dojo/me
//
// Dados cadastrais do dojô da company logada (JWT com dojo_id;
// requireDojoAccess no aura-backend). É o análogo autenticado do
// karateDojoPortalApi.getMe (Canal B, token fixo) — aqui o Bearer é o
// JWT normal via request() core.
//
// Vive num service pequeno separado: karateApi.ts tem 125 KB e a regra
// da casa é edição cirúrgica (mesmo racional do karateDojoPortalApi).
//
// Normalização DEFENSIVA: aceita o objeto cru ou embrulhado em { dojo },
// e o nome da federação em federation_name | federation.name — o shape
// exato do endpoint pode evoluir sem quebrar o shell.
// ============================================================
import { request } from "@/services/api";

export interface DojoMeInfo {
  id: string | null;
  name: string | null;
  cnpj: string | null;
  region: string | null;
  fpkt_affiliation_id: string | null;
  affiliation_model: string | null;
  affiliation_since: string | null;
  dojo_founded_year: number | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  practitioner_count: number | null;
  federation_name: string | null;
}

function num(v: any): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function normalizeDojoMe(raw: any): DojoMeInfo {
  const d =
    raw && typeof raw === "object" && raw.dojo && typeof raw.dojo === "object"
      ? raw.dojo
      : raw ?? {};
  return {
    id: str(d.id),
    name: str(d.name),
    cnpj: str(d.cnpj),
    region: str(d.region),
    fpkt_affiliation_id: str(d.fpkt_affiliation_id),
    affiliation_model: str(d.affiliation_model),
    affiliation_since: str(d.affiliation_since),
    dojo_founded_year: num(d.dojo_founded_year),
    phone: str(d.phone),
    email: str(d.email),
    status: str(d.status),
    practitioner_count: num(d.practitioner_count),
    federation_name:
      str(d.federation_name) ?? str(raw?.federation?.name) ?? str(d.federation?.name),
  };
}

export const karateDojoInfoApi = {
  getDojoMe: async (federationId: string): Promise<DojoMeInfo> =>
    normalizeDojoMe(await request<any>(`/federation/${federationId}/dojo/me`)),
};
