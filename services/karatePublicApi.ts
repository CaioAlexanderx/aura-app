// ============================================================
// KARATE PUBLIC PORTAL API — Aura Karatê
//
// Endpoints públicos para o portal redesenhado:
//   - POST /public/karate/:slug/lookup  → perfil + inscrições
//   - GET  /public/karate/:slug/banners → banners do hub
//
// Usa fetch direto (sem auth JWT de empresa), igual karatePortalApi.
// NÃO tocar em services/karateApi.ts (agente admin).
// ============================================================

function apiBase(): string {
  return (
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
    "https://aura-backend-production-f805.up.railway.app/api/v1"
  );
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  data?: any;
}

async function pub<T>(
  path: string,
  opts?: { method?: string; body?: any }
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${apiBase()}${path}`, {
    method: opts?.method || "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const e: ApiError = new Error(data?.error || `Erro ${res.status}`);
    e.status = res.status;
    e.code = data?.code;
    e.data = data;
    throw e;
  }
  return data as T;
}

const enc = encodeURIComponent;

// ─────────────────────────────────────────────────────────────
// Tipos — Lookup
// ─────────────────────────────────────────────────────────────
/**
 * Uma inscrição do praticante (exame, campeonato ou curso), como retornada
 * por POST /:slug/lookup. `category_name` só é preenchido quando
 * kind==='competition' e o praticante escolheu uma categoria; caso
 * contrário vem null. `payment_status` também pode ser null quando o
 * evento é gratuito (sem cobrança associada).
 */
export interface LookupRegistration {
  kind: "exam" | "competition" | "course";
  event_id: string;
  event_name: string;
  category_name: string | null;
  status: string;
  payment_status: string | null;
  created_at: string;
}

export interface LookupPractitioner {
  id: string;
  name: string;
  registration: string | null;
  current_belt: string | null;
  current_belt_name: string | null;
}

export interface LookupResponse {
  federation: { name: string; logo: string | null };
  practitioner: LookupPractitioner;
  registrations: LookupRegistration[];
}

// ─────────────────────────────────────────────────────────────
// Tipos — Banners
// ─────────────────────────────────────────────────────────────
export type BannerFormat = "square" | "story" | "landscape";

export interface HubBanner {
  id: string;
  title: string;
  image_url: string;
  format: BannerFormat;
  event_id: string | null;
  placement: string;
  sort_order: number;
}

export interface BannersResponse {
  federation: { name: string; logo: string | null };
  banners: HubBanner[];
}

// ─────────────────────────────────────────────────────────────
// Tipos — Portal público do sensei (atualização de quadro por token)
//
// Consome GET/POST /public/roster-update/:token (karateRosterPortalPublic.js
// no backend). Token opaco de uso único — NÃO é o mesmo token de auth do
// usuário; nunca anexar Authorization aqui. 404 = token inválido,
// 410 = token existe mas expirou (ou já foi usado — vira 'validated' e
// token_expires_at é zerado no POST, então um novo GET some com 410).
// ─────────────────────────────────────────────────────────────
export interface RosterPractitioner {
  id: string;
  name: string;
  karate_registration_number: string | null;
  belt_name: string | null;
  is_active: boolean;
  phone: string | null;
  email: string | null;
  /** Campos essenciais faltando (hoje: 'telefone' e/ou 'email'). Vazio = ok. */
  missing: string[];
  /**
   * 'a' faixa-preta ATIVA com anuidade em aberto · 'b' ativo sem NENHUM
   * contato · 'c' o resto. Ordena/agrupa a fila (G1 item 2/4) — nunca
   * reordenar no cliente por conta própria, é a mesma régua do backend.
   */
  priority_group: "a" | "b" | "c";
}

export interface RosterCounts {
  essenciais: number;
  demais: number;
}

/**
 * Stateless por desenho (sem tabela de baseline no backend) —
 * essenciais_total/essenciais_resolvidos cobrem TODOS os praticantes
 * ativos (não só o grupo prioritário 'a'/'b'). A barra de progresso da
 * fila (item 5) usa esses números como pano de fundo geral; o contador
 * "X de Y" da fila em si é calculado no cliente a partir de quantos itens
 * ainda têm `missing.length > 0` (ver [token].tsx) — os dois se resolvem
 * sozinhos a cada refetch, sem estado adicional para "lembrar por onde
 * o sensei parou".
 */
export interface RosterProgress {
  essenciais_total: number;
  essenciais_resolvidos: number;
}

export interface RosterUpdateResponse {
  dojo_nome: string;
  status: string;
  praticantes: RosterPractitioner[];
  counts: RosterCounts;
  progress: RosterProgress;
  /**
   * Link PRONTO (URL montada) de auto-atendimento do PRÓPRIO aluno — token
   * SEPARADO do token do sensei (self_service_token, ver
   * karateRosterSelfServicePublic.js). É o que o sensei cola no grupo de
   * WhatsApp do dojô: cada aluno atualiza o próprio telefone/e-mail e some
   * da fila dele. O backend gera o token sob demanda se o dojô ainda não
   * tinha um (idempotente — nunca vem vazio por falta de token). Pode vir
   * `null` só se a migration 225 ainda não foi aplicada no ambiente.
   */
  self_service_url: string | null;
}

/** Ficha completa — GET /public/roster-update/:token/practitioners/:studentId */
export interface RosterFullRecord {
  id: string;
  name: string;
  karate_registration_number: string | null;
  is_active: boolean;
  phone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  rg: string | null;
  birth_date: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  belt_name: string | null;
  belt_level: string | null;
}

/**
 * Autosave granular — PATCH /public/roster-update/:token/practitioners/:studentId.
 * Só os campos presentes no objeto são alterados (idempotente); `is_active:
 * false` é a implementação de "Não treina mais". Espelha
 * PORTAL_EDITABLE_FIELDS do backend (karateRosterPortalPublic.js).
 */
export interface PatchPractitionerInput {
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  is_active?: boolean;
}

export interface PatchPractitionerResult {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  missing: string[];
  progress: RosterProgress | null;
}

/** Resultado de POST /public/roster-update/:token/import — sem drama por linha. */
export interface RosterImportResult {
  atualizados: number;
  ignorados: number;
  erros: { row: number; motivo: string }[];
}

export interface RosterUpdateInput {
  student_id: string;
  is_active: boolean;
}

export interface RosterSubmitResult {
  status: string;
  validated_at: string;
  validated_by: string | null;
  applied: { student_id: string; was_active: boolean }[];
  skipped: { student_id: string | null; reason: string }[];
}

/**
 * H2b (decisão do Caio, 14/07/2026): "solicitar novo praticante" mora no
 * link PÚBLICO, não atrás de JWT — o sensei que só tem o link nunca
 * conseguiria abrir a conta Aura pra solicitar. Este é o mesmo shape de
 * services/karateApi.ts#PractitionerRequestInput (canal autenticado) e de
 * components/karate/PractitionerRequestForm.tsx#PractitionerRequestBody
 * — os três ficam separados de propósito (não importar um do outro:
 * cada arquivo é dono do seu próprio contrato, TypeScript casa
 * estruturalmente), mas o CAMPO é sempre o mesmo.
 *
 * Input de POST /public/roster-update/:token/practitioner — abre uma
 * SOLICITAÇÃO de praticante novo (NUNCA cria em customers direto — quem
 * cria/atribui o número FPKT é a federação, ao aprovar). Só `full_name`
 * é obrigatório. dojo_id/federation_id NUNCA vão no body — vêm sempre do
 * token no backend.
 */
export interface AddPractitionerInput {
  full_name: string;
  birth_date?: string | null;
  sex?: "M" | "F" | "other" | null;
  cpf?: string | null;
  rg?: string | null;
  phone?: string | null;
  email?: string | null;
  claimed_belt?: string | null;
  /** Número FPKT que o sensei digitou (opcional — "Não tem" = omitir). */
  fpkt_number_claimed?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  guardian_name?: string | null;
  guardian_cpf?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
}

/** Achado do auto-localizar (GET .../fpkt-lookup) — nunca mais que nome + dojô atual do terceiro. */
export interface FpktLookupHint {
  found: boolean;
  is_transfer?: boolean;
  message?: string;
  practitioner?: {
    id: string;
    name: string;
    current_dojo_id: string | null;
    current_dojo_name: string | null;
    is_active: boolean;
  };
}

/** Retorno de POST /public/roster-update/:token/practitioner. */
export interface AddPractitionerResult {
  id: string;
  status: string;
  created_at: string;
  already_pending: boolean;
  claimed_belt?: string | null;
  message?: string;
  fpkt_lookup?: FpktLookupHint | null;
}

/** Item 9 — upload de foto (JSON base64), mesmo shape do canal autenticado (services/karateApi.ts#UploadPhotoInput/Result). */
export interface PublicUploadPhotoInput {
  content: string;
  content_type?: "image/jpeg" | "image/png" | "image/webp";
}
export interface PublicUploadPhotoResult {
  photo_url: string;
}

export type PractitionerRequestStatus = "pendente" | "aprovada" | "rejeitada";

/** Uma linha de GET /public/roster-update/:token/practitioner-requests. */
export interface PractitionerRequestRow {
  id: string;
  status: PractitionerRequestStatus;
  resolution: string | null;
  reject_reason: string | null;
  full_name: string;
  birth_date: string | null;
  claimed_belt: string | null;
  fpkt_number_claimed: string | null;
  resolved_practitioner_id: string | null;
  /** Número REAL atribuído pela federação — só presente quando aprovada. */
  resolved_fpkt_number: string | null;
  resolved_practitioner_name: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// Tipos — Página pública de pagamento PIX (Fase F4/PIX)
//
// Consome GET /public/karate/pix/:token (karatePixPublic.js no backend).
// Token stateless assinado (karatePixPublicToken.js) — carrega o próprio
// conteúdo da cobrança, NUNCA nome/CPF/telefone/e-mail/id de dojô ou
// praticante (decisão de privacidade documentada no PR do backend).
// 404 = link inválido ou expirado (nunca diferencia o motivo).
// ─────────────────────────────────────────────────────────────
export interface PixPublicData {
  amount: number;
  reference_period: string;
  pix_code: string;
}

// ─────────────────────────────────────────────────────────────
// Tipos — Auto-atendimento do PRÓPRIO praticante (G1, item 7)
//
// Consome GET/POST /public/roster-self/:token (karateRosterSelfServicePublic.js).
// Token SEPARADO do token do sensei (self_service_token). (16/07/2026 —
// decisão do Caio: agora aceita a FICHA INTEIRA do PRÓPRIO praticante
// (mesmos campos de PORTAL_EDITABLE_FIELDS), nunca inativa/edita
// faixa/status/dojo_id, nunca vê a lista inteira do dojô. Identidade
// (SelfServiceIdentity) e o que muda (SelfServiceFields) são objetos
// SEPARADOS no payload — ver comentário de topo do backend.
// ─────────────────────────────────────────────────────────────
export interface SelfServiceSearchHit {
  id: string;
  name: string;
}

/**
 * PROVA de identidade (2º fator) — sempre o valor ATUAL/correto que já
 * está no banco. Informe UM dos dois. Nunca confundir com
 * `SelfServiceFields.birth_date`, que é o valor NOVO (a correção).
 */
export interface SelfServiceIdentity {
  birth_date?: string; // YYYY-MM-DD
  karate_registration_number?: string;
}

/**
 * O QUE MUDA — mesmos campos de PORTAL_EDITABLE_FIELDS
 * (karateRosterPortalPublic.js), espelhados aqui (16/07/2026: decisão do
 * Caio de abrir a ficha inteira pro próprio aluno, não só contato).
 * `karate_registration_number` PROPOSITALMENTE não existe aqui — o nº
 * FPKT é emitido pela federação, só entra como `SelfServiceIdentity`.
 * Só inclua no payload os campos que o aluno de fato preencheu — campo
 * ausente aqui não é tocado no banco (omitir ≠ limpar).
 */
export interface SelfServiceFields {
  phone?: string;
  email?: string;
  cpf?: string;
  rg?: string;
  birth_date?: string; // correção do nascimento — YYYY-MM-DD
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface SelfServiceUpdateInput {
  student_id: string;
  identity: SelfServiceIdentity;
  fields: SelfServiceFields;
}

export interface SelfServiceUpdateResult {
  ok: true;
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const karatePublicApi = {
  /**
   * Página pública de pagamento PIX de uma cobrança de anuidade — dados
   * mínimos (valor, competência, BR Code). O QR é desenhado no cliente
   * (components/karate/PixQRCode.tsx, já usa react-native-qrcode-svg —
   * sem endpoint de imagem novo). 404 = link inválido ou expirado.
   */
  getPixPublic: (token: string): Promise<PixPublicData> =>
    pub(`/public/karate/pix/${enc(token)}`),


  /**
   * Busca praticante por CPF, e-mail ou Número FPKT.
   * Lança ApiError com code='PRACTITIONER_NOT_FOUND' (404) se não achar.
   */
  lookup: (slug: string, identifier: string): Promise<LookupResponse> =>
    pub(`/public/karate/${enc(slug)}/lookup`, { method: "POST", body: { identifier } }),

  /**
   * Banners do hub público por placement.
   * Retorna lista vazia quando não há banners — nunca lança para esse caso.
   */
  getBanners: (slug: string, placement = "hub"): Promise<BannersResponse> =>
    pub(`/public/karate/${enc(slug)}/banners?placement=${enc(placement)}`),
  verifyCert: (token: string): Promise<any> =>
    pub(`/public/karate/verify/cert/${enc(token)}`),
  myCerts: (slug: string, cpf: string): Promise<{ federation: { name: string }; certificates: { verify_token: string; course_name: string | null; participant_name: string | null; issued_at: string }[] }> =>
    pub(`/public/karate/${enc(slug)}/meus-certificados`, { method: "POST", body: { cpf } }),

  /**
   * Portal público do sensei — atualização de quadro por token.
   * GET dados do dojô + praticantes. 404 = link inválido; 410 = link
   * expirado (ou já usado, já que o POST expira o token — uso único).
   */
  getPublicRoster: (token: string): Promise<RosterUpdateResponse> =>
    pub(`/public/roster-update/${enc(token)}`),

  /**
   * Aplica as alterações de is_active do quadro e expira o token (uso
   * único). `validatedBy` é opcional (nome de quem confirmou no dojô).
   */
  submitPublicRoster: (
    token: string,
    updates: RosterUpdateInput[],
    validatedBy?: string
  ): Promise<RosterSubmitResult> =>
    pub(`/public/roster-update/${enc(token)}`, {
      method: "POST",
      body: { updates, validated_by: validatedBy || undefined },
    }),

  /**
   * URL do CSV de export do quadro (nome, registro, faixa, situação).
   * Não faz fetch — é só a URL pronta pra <a href> / download direto,
   * já que o backend manda Content-Disposition: attachment.
   */
  getRosterExportUrl: (token: string): string =>
    `${apiBase()}/public/roster-update/${enc(token)}/export`,

  /**
   * Abre uma SOLICITAÇÃO de praticante novo pro dojô do token — NUNCA cria
   * o praticante direto (H1/H2/H2b). NÃO expira o token — o sensei pode
   * solicitar vários e só confirmar o quadro depois (submitPublicRoster).
   * 422 = validação (full_name faltando); 404/410 = link inválido/expirado.
   * Idempotente: reenviar os mesmos dados (nome + nascimento) enquanto a
   * primeira solicitação segue pendente devolve `already_pending:true` em
   * vez de duplicar.
   */
  addPublicPractitioner: (
    token: string,
    input: AddPractitionerInput
  ): Promise<AddPractitionerResult> =>
    pub(`/public/roster-update/${enc(token)}/practitioner`, {
      method: "POST",
      body: input,
    }),

  /**
   * Item 9 (revisão Atualização Cadastral, 15/07/2026): foto do praticante
   * NA SOLICITAÇÃO, pelo canal PÚBLICO (link do sensei, sem login) — o
   * mesmo mecanismo de upload de karateApi.ts#uploadPractitionerPhoto
   * (JSON + base64 → R2), token-gated como todo o resto deste arquivo.
   * Chamar DEPOIS de addPublicPractitioner (precisa do `id` da solicitação
   * já criada).
   */
  uploadPublicPractitionerPhoto: (
    token: string,
    requestId: string,
    input: PublicUploadPhotoInput
  ): Promise<PublicUploadPhotoResult> =>
    pub(`/public/roster-update/${enc(token)}/practitioner/${enc(requestId)}/photo`, {
      method: "POST",
      body: input,
    }),

  /**
   * Auto-localizar (H2b): dado um número FPKT digitado no formulário de
   * solicitação, diz se já pertence a alguém NA FEDERAÇÃO do token (não
   * só no dojô — pode ser outro dojô da mesma federação). Se `found:true`
   * a UI deve deixar claro que isto vira TRANSFERÊNCIA, não criação
   * (fpkt_lookup.is_transfer). Equivalente token-gated de
   * karateApi.lookupFpktNumber (canal autenticado).
   */
  lookupFpktNumber: (token: string, number: string): Promise<FpktLookupHint> =>
    pub(`/public/roster-update/${enc(token)}/fpkt-lookup?number=${enc(number)}`),

  /**
   * Status das solicitações do dojô do token — pendente/aprovada (com o
   * número FPKT real atribuído) ou rejeitada (com o motivo), visível no
   * link público SEM login. `status` omitido = todas. Equivalente
   * token-gated de karateApi.listPractitionerRequests (canal autenticado).
   */
  listPractitionerRequests: (
    token: string,
    status?: PractitionerRequestStatus
  ): Promise<{ data: PractitionerRequestRow[] }> =>
    pub(`/public/roster-update/${enc(token)}/practitioner-requests${status ? `?status=${status}` : ""}`),

  /**
   * Ficha completa de um praticante — atrás do link "Ver ficha completa"
   * da UI (item 1: a lista/fila só mostra o que falta, não os 20 campos).
   */
  getFullRecord: (token: string, studentId: string): Promise<RosterFullRecord> =>
    pub(`/public/roster-update/${enc(token)}/practitioners/${enc(studentId)}`),

  /**
   * Autosave granular de UM praticante — a base do modo fila e da edição
   * inline na lista (item 4/5). Idempotente; inclui is_active (item 3,
   * "Não treina mais"). Nunca manda dojo_id/federation_id — o token já
   * escopa isso no backend.
   */
  patchPractitioner: (
    token: string,
    studentId: string,
    patch: PatchPractitionerInput
  ): Promise<PatchPractitionerResult> =>
    pub(`/public/roster-update/${enc(token)}/practitioners/${enc(studentId)}`, {
      method: "PATCH",
      body: patch,
    }),

  /**
   * URL do CSV só de quem falta algo (matrícula + nome + telefone + e-mail),
   * pronto pro sensei baixar/preencher/reenviar (item 6 — caminho dos
   * dojôs grandes).
   */
  getRosterExportMissingUrl: (token: string): string =>
    `${apiBase()}/public/roster-update/${enc(token)}/export-missing`,

  /**
   * Reimporta a planilha de export-missing preenchida. Casamento por
   * matrícula FPKT (nunca por nome). Erro em uma linha não aborta o
   * lote — o retorno já vem pronto pra UI mostrar sem drama.
   */
  importRosterCsv: (token: string, csvContent: string): Promise<RosterImportResult> =>
    pub(`/public/roster-update/${enc(token)}/import`, {
      method: "POST",
      body: { csv_content: csvContent },
    }),

  /**
   * Auto-atendimento do aluno — busca só por nome (nunca a lista inteira
   * do dojô), no máximo 8 resultados. `token` aqui é o self_service_token
   * (SEPARADO do token do sensei).
   */
  selfServiceSearch: (token: string, q: string): Promise<{ data: SelfServiceSearchHit[] }> =>
    pub(`/public/roster-self/${enc(token)}/search?q=${enc(q)}`),

  /**
   * Grava o próprio telefone/e-mail após confirmar identidade (nascimento
   * OU matrícula FPKT). Nunca toca is_active/faixa/status — o backend
   * rejeita qualquer campo fora da whitelist com 422.
   */
  selfServiceUpdate: (
    token: string,
    input: SelfServiceUpdateInput
  ): Promise<SelfServiceUpdateResult> =>
    pub(`/public/roster-self/${enc(token)}/update`, {
      method: "POST",
      body: { student_id: input.student_id, identity: input.identity, fields: input.fields },
    }),
};
