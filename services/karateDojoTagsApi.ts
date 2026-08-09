// ============================================================
// AURA DOJÔ — F11: Tags configuráveis do aluno (migration 274)
//
// Cliente tipado do Aura-backend (src/routes/karateDojoTags.js +
// src/services/karateDojoTagService.js). Base: /federation/:id/dojo —
// mesmo padrão de karateDojoStudentsApi.ts (Bearer via request() core;
// Canal A escreve, Canal B/portal é somente leitura).
//
// Pedido do dono do produto: a planilha real do 1º dojô (Areikan, 484
// alunos) tem uma coluna "Academia" (4 locais de treino) que virou TAG
// configurável pelo sensei — não é "unidade" nem dojô separado. Um aluno
// pode ter VÁRIAS tags; gerenciadas em Configurações (CRUD completo).
//
// NOME ÚNICO por dojô, case-insensitive ("SESC" e "sesc" são a MESMA
// tag) — o backend responde 409 DUPLICATE_TAG_NAME.
//
// DESATIVAR, NÃO APAGAR: DELETE só é aceito para tag SEM nenhum aluno —
// em uso, o backend responde 409 TAG_EM_USO e o caminho é PATCH
// {active:false}, que preserva os vínculos existentes (histórico
// intacto) e só bloqueia NOVAS atribuições. Atribuir uma tag desativada
// responde 422 TAG_INATIVA.
//
// Vive num service pequeno separado (mesmo racional de
// karateDojoStudentsApi.ts/karateDojoClassesApi.ts — edição cirúrgica,
// nunca engordar karateApi.ts).
// ============================================================
import { request } from "@/services/api";

export interface DojoTag {
  id: string;
  dojo_id: string;
  name: string;
  color: string | null;
  active: boolean;
  /**
   * Total de alunos com esta tag (todos os status, ativo ou inativo) —
   * presente em GET /dojo/tags (lista) e no retorno de create/update.
   * AUSENTE em GET .../students/:sid/tags (tags de UM aluno; ali não
   * faz sentido repetir a contagem global).
   */
  student_count?: number;
  created_at?: string;
  updated_at?: string;
}

/** Payload de criação/edição — campo ausente (undefined) = não mexe. */
export interface DojoTagPayload {
  name?: string;
  color?: string | null;
  active?: boolean;
}

export interface DojoTagsListResponse {
  data: DojoTag[];
  count: number;
  /** true quando a migration 274 ainda não rodou neste ambiente (lista vem vazia). */
  schema_pending?: boolean;
}

export interface DojoStudentTagsResponse {
  data: DojoTag[];
  count: number;
}

function qs(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v != null && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

const base = (federationId: string) => `/federation/${federationId}/dojo`;

export const karateDojoTagsApi = {
  /** Ausente = TODAS (ativas e desativadas) — o sensei precisa ver as desativadas para poder reativar. */
  listTags: (federationId: string, opts: { active?: boolean } = {}): Promise<DojoTagsListResponse> =>
    request<DojoTagsListResponse>(
      `${base(federationId)}/tags${qs({ active: opts.active == null ? undefined : String(opts.active) })}`
    ),

  createTag: (federationId: string, payload: DojoTagPayload): Promise<DojoTag> =>
    request<DojoTag>(`${base(federationId)}/tags`, { method: "POST", body: payload }),

  /** Cobre renomear (name), cor (color) e desativar/reativar (active) — mesmo endpoint no backend. */
  updateTag: (federationId: string, tagId: string, payload: DojoTagPayload): Promise<DojoTag> =>
    request<DojoTag>(`${base(federationId)}/tags/${tagId}`, { method: "PATCH", body: payload }),

  /** 409 TAG_EM_USO se houver ao menos 1 vínculo — a UI deve oferecer desativar (updateTag com {active:false}). */
  deleteTag: (federationId: string, tagId: string): Promise<{ deleted: boolean; id: string }> =>
    request<{ deleted: boolean; id: string }>(`${base(federationId)}/tags/${tagId}`, { method: "DELETE" }),

  listStudentTags: (federationId: string, studentId: string): Promise<DojoStudentTagsResponse> =>
    request<DojoStudentTagsResponse>(`${base(federationId)}/students/${studentId}/tags`),

  /** 422 TAG_INATIVA se a tag estiver desativada — atribuir só vale para tag ativa. */
  assignTag: (federationId: string, studentId: string, tagId: string): Promise<DojoStudentTagsResponse> =>
    request<DojoStudentTagsResponse>(`${base(federationId)}/students/${studentId}/tags`, {
      method: "POST",
      body: { tag_id: tagId },
    }),

  /** Idempotente — remover uma tag não atribuída não é erro (mesmo racional do backend). */
  removeTag: (federationId: string, studentId: string, tagId: string): Promise<DojoStudentTagsResponse> =>
    request<DojoStudentTagsResponse>(`${base(federationId)}/students/${studentId}/tags/${tagId}`, {
      method: "DELETE",
    }),
};
