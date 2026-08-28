// ============================================================
// AURA KARATÊ — /dojo/me AUTENTICADO (lado do dojô logado)
//
//   GET   /federation/:id/dojo/me
//   PATCH /federation/:id/dojo/me
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
//
// Polish QA 25/07: contrato novo (Aura-backend#422) — `linked`/`linked_at`
// aditivos, disponíveis na raiz OU em dojo.linked/dojo.linked_at.
// FAIL-OPEN: backend antigo sem o campo → linked=true (nunca esconde nav
// nem bloqueia telas por causa de um deploy fora de ordem).
//
// QA 27/07 (item 5, contrato Aura-backend#429 FINAL): o GET passou a
// devolver o dojô inteiro (cnpj/email/phone/founded_at + o bloco de
// filiação com affiliation_status/affiliated_since/practitioners_count).
// A tela de Configurações separa em dois blocos:
//   • Dados do dojô — nome/cnpj/email/phone/founded_at, EDITÁVEIS pelo
//     sensei via PATCH (novo, este arquivo).
//   • Filiação — fpkt_affiliation_id/federation_name/affiliation_status/
//     affiliation_model/affiliated_since/region/practitioners_count,
//     somente leitura (vem da federação; o servidor ignora esses campos
//     se enviados no PATCH).
// ============================================================
import { request } from "@/services/api";

/** 'filiado' · 'pendente' · 'nao_filiado' — só a federação muda isso. */
export type DojoAffiliationStatus = "filiado" | "pendente" | "nao_filiado";

export interface DojoMeInfo {
  id: string | null;
  name: string | null;
  slug: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  /** 'YYYY-MM-DD' — date puro; parse manual, NUNCA new Date() direto. */
  founded_at: string | null;
  /**
   * Logo do PRÓPRIO dojô — URL absoluta do R2, já com ?v= de cache-buster.
   * Na coluna é companies.karate_logo_url; no fio o backend usa `logo_url`,
   * o mesmo nome da identidade da federação (um nome só para a mesma coisa).
   * O Canal B do portal ainda expõe `karate_logo_url` cru — a normalização
   * abaixo aceita os dois para o shell não depender de qual lado respondeu.
   */
  logo_url: string | null;
  federation_id: string | null;
  federation_name: string | null;
  federation_slug: string | null;
  fpkt_affiliation_id: string | null;
  affiliation_status: DojoAffiliationStatus | null;
  affiliation_model: string | null;
  /** 'YYYY-MM-DD'. */
  affiliated_since: string | null;
  region: string | null;
  practitioners_count: number | null;
  auth_channel: string | null;
  /** Conexão do dojô à federação (aditivo, Aura-backend#422). Fail-open: true quando ausente. */
  linked: boolean;
  linked_at: string | null;
}

/**
 * Payload do PATCH — só os campos PRÓPRIOS do dojô (o dojô tem registro
 * próprio; decisão do Caio). Campos federativos (fpkt_affiliation_id,
 * affiliation_status…) são ignorados pelo servidor mesmo se enviados.
 * Campo ausente (undefined) = não mexe.
 */
export interface DojoMeUpdatePayload {
  name?: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  /** 'YYYY-MM-DD'. */
  founded_at?: string | null;
}

function num(v: any): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** true/false explícitos respeitados; ausente (undefined/null) cai no fallback (fail-open). */
function boolWithFallback(v: any, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function affiliationStatus(v: any): DojoAffiliationStatus | null {
  return v === "filiado" || v === "pendente" || v === "nao_filiado" ? v : null;
}

export function normalizeDojoMe(raw: any): DojoMeInfo {
  const d =
    raw && typeof raw === "object" && raw.dojo && typeof raw.dojo === "object"
      ? raw.dojo
      : raw ?? {};
  // linked pode vir na raiz OU dentro de `dojo` — aceita qualquer um dos dois,
  // dojo.linked tem prioridade quando ambos existirem.
  const linked = boolWithFallback(d.linked, boolWithFallback(raw?.linked, true));
  const linkedAt = str(d.linked_at) ?? str(raw?.linked_at);
  return {
    id: str(d.id),
    name: str(d.name),
    slug: str(d.slug),
    cnpj: str(d.cnpj),
    email: str(d.email),
    phone: str(d.phone),
    founded_at: str(d.founded_at),
    logo_url: str(d.logo_url) ?? str(d.karate_logo_url),
    federation_id: str(d.federation_id),
    federation_name:
      str(d.federation_name) ?? str(raw?.federation?.name) ?? str(d.federation?.name),
    federation_slug: str(d.federation_slug),
    fpkt_affiliation_id: str(d.fpkt_affiliation_id),
    affiliation_status: affiliationStatus(d.affiliation_status),
    affiliation_model: str(d.affiliation_model),
    affiliated_since: str(d.affiliated_since),
    region: str(d.region),
    practitioners_count: num(d.practitioners_count),
    auth_channel: str(d.auth_channel),
    linked,
    linked_at: linkedAt,
  };
}

export const karateDojoInfoApi = {
  getDojoMe: async (federationId: string): Promise<DojoMeInfo> =>
    normalizeDojoMe(await request<any>(`/federation/${federationId}/dojo/me`)),

  /**
   * PATCH /dojo/me — 200 com o mesmo shape do GET; 422 VALIDATION_ERROR
   * com `errors: string[]` (mapeado em pt-BR em app/karate/(dojo)/configuracoes.tsx).
   */
  updateDojoMe: async (
    federationId: string,
    payload: DojoMeUpdatePayload
  ): Promise<DojoMeInfo> =>
    normalizeDojoMe(
      await request<any>(`/federation/${federationId}/dojo/me`, {
        method: "PATCH",
        body: payload,
      })
    ),

  /**
   * POST /dojo/me/logo — sobe a logo do dojô.
   *
   * Mesmo contrato dos outros uploads da casa (foto do praticante, foto do
   * aluno, imagem de produto): JSON + base64 PURO no campo `content`, nunca
   * FormData e nunca com o prefixo `data:...;base64,`. Limite de 5 MB no
   * servidor (express.json), por isso o picker checa o tamanho antes.
   *
   * Responde com o MESMO shape do GET — a tela rehidrata inteira sem um
   * segundo GET, e a URL já vem com ?v= (o Image não serve a logo antiga).
   */
  uploadDojoLogo: async (
    federationId: string,
    body: { content: string; content_type?: string }
  ): Promise<DojoMeInfo> =>
    normalizeDojoMe(
      await request<any>(`/federation/${federationId}/dojo/me/logo`, {
        method: "POST",
        body,
        timeout: 60000,
      })
    ),

  /** DELETE /dojo/me/logo — volta ao monograma. Mesmo shape do GET. */
  removeDojoLogo: async (federationId: string): Promise<DojoMeInfo> =>
    normalizeDojoMe(
      await request<any>(`/federation/${federationId}/dojo/me/logo`, {
        method: "DELETE",
      })
    ),
};
