// ============================================================
// Helpers — Alunos do dojô (F2) + vínculo com a federação (F5a/F5b)
//
// Faixas comuns do karatê (chips do form; belt_order = posição na
// hierarquia, 1 = Branca … 9 = Preta — espelha BELT_KEY_RANK do tema,
// sem a Vermelha histórica/isLegacy). Faixa em texto livre entra com
// belt_order null (vai pro fim da pirâmide — NULLS LAST no backend).
//
// Datas tz-safe: 'YYYY-MM-DD' é date puro — NUNCA new Date('YYYY-MM-DD')
// (em UTC-3 volta um dia). Parse/format sempre por split manual.
// ============================================================
import { KarateBelts, KarateColors, resolveBeltKey, BeltKey } from "@/constants/karateTheme";

export interface CommonBelt {
  label: string;
  order: number;
  /** BeltKey canônico (constants/karateTheme.ts) — usado para casar o
   *  rótulo COM ou SEM grau (ex.: "Marrom 2º kyu", "Preta 3°") de volta
   *  à faixa base (F8.2, ver parseCommonBelt/beltOrderForLabel abaixo). */
  key: BeltKey;
}

export const COMMON_BELTS: CommonBelt[] = [
  { label: "Branca", order: 1, key: "branca" },
  { label: "Amarela", order: 2, key: "amarela" },
  { label: "Laranja", order: 3, key: "laranja" },
  { label: "Verde", order: 4, key: "verde" },
  { label: "Azul Claro", order: 5, key: "azul_claro" },
  { label: "Roxa", order: 6, key: "roxo" },
  { label: "Azul Escuro", order: 7, key: "azul_escuro" },
  { label: "Marrom", order: 8, key: "marrom" },
  { label: "Preta", order: 9, key: "preta" },
];

/**
 * F8.2 (01/08/2026 — pedido do Caio: "a ficha de cadastro do aluno DEVE
 * ser igual à ficha de cadastro do praticante da federação"): a ficha do
 * aluno passa a aceitar grau nas mesmas duas faixas que o lado da
 * federação já trata assim (praticante-detalhe/helpers.ts BELT_KYUS/
 * DAN_OPTIONS — escala oficial FPKT: Branca(10º kyu)·Amarela(9º)·
 * Laranja(8º)·Verde(7º)·Azul Claro(6º)·Roxa(5º)·Azul Escuro(4º)·Marrom
 * 3º/2º/1º kyu·Preta 1º ao 10º dan): Marrom tem 3 kyus distintos e Preta
 * aceita grau Dan. Um aluno já cadastrado com "Marrom" ou "Preta" SEM
 * grau continua válido — grau é opcional, parseCommonBelt reconhece os
 * dois formatos (com e sem número) e nunca quebra dado existente.
 */
export function parseCommonBelt(label: string | null | undefined): { base: BeltKey; degree: number | null } | null {
  if (!label) return null;
  const key = resolveBeltKey(label);
  if (!key || key === "vermelha") return null; // vermelha é histórica — nunca é seleção nova aqui
  const m = String(label).match(/(\d+)/);
  return { base: key, degree: m ? parseInt(m[1], 10) : null };
}

// F8.2: mapa key → order derivado direto de COMMON_BELTS (fonte única —
// nunca duplicar a escala em dois lugares).
const KEY_ORDER: Partial<Record<BeltKey, number>> = Object.fromEntries(
  COMMON_BELTS.map((b) => [b.key, b.order])
);

/**
 * belt_order derivado da faixa BASE — independe do grau/kyu/dan no rótulo:
 * "Marrom 2º kyu" e "Marrom" ordenam juntos na pirâmide, na mesma posição
 * (8). Resolve por texto via resolveBeltKey (mesmo helper usado no lado da
 * federação, constants/karateTheme.ts), com fallback pro match exato
 * antigo — cobre rótulos em texto livre que não batem com nenhuma das 9
 * faixas comuns (o "Outra…" do form).
 *
 * F8.2: ANTES desta função só casava o rótulo por igualdade EXATA contra
 * COMMON_BELTS — um rótulo com grau ("Marrom 2º kyu") nunca batia, caía em
 * null e ia pro fim/começo da pirâmide (NULLS LAST/behaviour do backend),
 * fora da posição correta. resolveBeltKey já normaliza acento/caixa/ordinal
 * e reconhece "marrom"/"preta" mesmo com o grau no texto — é o mesmo bug
 * que a escala oficial da federação (F8) corrigiu do lado do praticante.
 */
export function beltOrderForLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const key = resolveBeltKey(label);
  if (key && KEY_ORDER[key] != null) return KEY_ORDER[key]!;
  const t = label.trim().toLowerCase();
  const hit = COMMON_BELTS.find((b) => b.label.toLowerCase() === t);
  return hit ? hit.order : null;
}

/** Cor/label de exibição de uma faixa (texto livre não resolvido cai no neutro). */
export function beltViewFor(label: string | null | undefined): {
  label: string;
  color: string;
  textColor: string;
} {
  const key = label ? resolveBeltKey(label) : null;
  if (key) {
    return {
      label: label || KarateBelts[key].label,
      color: KarateBelts[key].color,
      textColor: KarateBelts[key].textColor,
    };
  }
  return { label: label || "Sem faixa", color: KarateColors.bg2, textColor: KarateColors.ink2 };
}

// ── Pirâmide de faixas (summary do backend) ─────────────────────

/** Uma linha de summary.by_belt (GET /dojo/students?summary=true). */
export interface BeltCountRow {
  belt_label: string | null;
  belt_order: number | null;
  count: number;
}

/** Uma barra da pirâmide, já agrupada por rótulo. */
export interface BeltPyramidGroup {
  belt_label: string | null;
  belt_order: number | null;
  count: number;
}

/**
 * Agrupa summary.by_belt POR RÓTULO — uma barra por faixa.
 *
 * QA 27/07/2026 (aba "Meus alunos"): o summary do backend agrupa por
 * (belt_label, belt_order) — GROUP BY de propósito — e o MESMO rótulo
 * pode chegar em duas linhas com belt_order divergente (importação de
 * planilha, edição manual, aluno sem ordem = NULL). Sem agrupar aqui, a
 * tela desenhava duas barras "Laranja" e a key={belt_label} duplicava
 * (React warning). 30/07/2026: o mesmo bug reproduzido no Painel do dojô
 * (app/karate/(dojo)/index.tsx), que fazia filter+sort+map direto sobre
 * by_belt sem passar por este agrupamento.
 *
 * Soma as contagens do mesmo rótulo; a ORDEM do grupo fica com o item
 * PREDOMINANTE (maior count; empate → menor ordem) — nunca o máximo: um
 * registro órfão com ordem alta não pode promover a faixa inteira.
 *
 * Fonte ÚNICA desta regra — AlunosList (aba "Meus alunos") e o Painel do
 * dojô chamam este helper; não reimplementar em nenhum dos dois lugares
 * (três cópias da mesma regra já nos morderam neste projeto).
 */
export function agruparPiramidePorFaixa(byBelt: BeltCountRow[] | null | undefined): BeltPyramidGroup[] {
  const acc = new Map<string, { belt_label: string | null; belt_order: number | null; count: number; topCount: number }>();
  for (const b of byBelt ?? []) {
    if (!b.count) continue;
    const key = b.belt_label ?? "__sem_faixa__";
    const cur = acc.get(key);
    if (!cur) {
      acc.set(key, { belt_label: b.belt_label ?? null, belt_order: b.belt_order ?? null, count: b.count, topCount: b.count });
      continue;
    }
    cur.count += b.count;
    const wins = b.count > cur.topCount
      || (b.count === cur.topCount
        && (b.belt_order ?? Number.MAX_SAFE_INTEGER) < (cur.belt_order ?? Number.MAX_SAFE_INTEGER));
    if (wins) {
      cur.belt_order = b.belt_order ?? null;
      cur.topCount = b.count;
    }
  }
  return Array.from(acc.values())
    .sort((a, z) => (z.belt_order ?? -1) - (a.belt_order ?? -1))
    .map(({ belt_label, belt_order, count }) => ({ belt_label, belt_order, count }));
}

// ── Datas (tz-safe, string-only) ─────────────────

/** 'YYYY-MM-DD' → idade em anos (null se ausente/inválida). */
export function ageFromISO(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const now = new Date();
  const ry = now.getFullYear();
  const rm = now.getMonth() + 1;
  const rd = now.getDate();
  let age = ry - y;
  if (rm < mo || (rm === mo && rd < d)) age--;
  return age;
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' ('' se ausente/inválida). */
export function isoToBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** 'DD/MM/AAAA' → 'YYYY-MM-DD' (null se incompleta ou dia inexistente no calendário). */
export function brToISO(br: string | null | undefined): string | null {
  if (!br) return null;
  const m = String(br).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  // Date.UTC só para validar o dia (31/02 etc.) — nunca para formatar.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Máscara de digitação DD/MM/AAAA (só dígitos + barras automáticas). */
export function maskDateBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// ── CPF ──────────────────────────────────

export function onlyDigits(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

/** Máscara 000.000.000-00 (aceita parcial durante a digitação). */
export function maskCpf(raw: string | null | undefined): string {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── CEP ──────────────────────────────────

/** Máscara 00000-000 (aceita parcial) — usado na ficha de solicitação de filiação (F5a). */
export function maskCep(raw: string | null | undefined): string {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ── Telefone ─────────────────────────────

/**
 * Máscara BR de telefone a partir de dígitos crus: (DD) 90000-0000 (celular,
 * 11 dígitos) ou (DD) 0000-0000 (fixo, 10 dígitos) — mesmo formato do
 * placeholder "(91) 90000-0000" já usado no form. Aceita parcial (uso
 * incremental durante digitação) e serve também pra EXIBIÇÃO de telefone
 * já salvo (ex.: card do responsável vinculado), que hoje sai cru
 * ("91988887777") em vez de mascarado.
 */
export function formatPhone(raw: string | null | undefined): string {
  const d = onlyDigits(raw).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── E-mail ──────────────────────────────

/**
 * Validação de formato bem simples (não resolve DNS, só pega erro de
 * digitação óbvio). String vazia é considerada válida aqui (o campo é
 * opcional na maioria dos forms) — quem chama decide se é obrigatório.
 * QA 27/07 (item 1): o e-mail do responsável é pra onde vai o lembrete
 * de mensalidade do menor — vale validar formato antes de salvar.
 */
export function isValidEmail(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ── Nomes ──────────────────────────────

/** minúsculas, sem acento, espaços colapsados — pronta pra comparar/exibir. */
export function normalizeName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// ── Erros da API → campo certo, em pt-BR ───────────

export type StudentErrorField =
  | "full_name"
  | "birth_date"
  | "cpf"
  | "email"
  | "guardian"
  | "general";

/**
 * Mapeia os erros do backend (422 VALIDATION_ERROR/MENOR_SEM_RESPONSAVEL/
 * GUARDIAN_NOT_FOUND, 409 DUPLICATE_CPF, 503 SCHEMA_PENDING…) pro campo
 * certo do form, em pt-BR. ApiError do request() carrega o body em e.data.
 */
export function mapStudentSaveError(e: any): { field: StudentErrorField; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  const apiErrors: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : [];
  if (code === "DUPLICATE_CPF") {
    return { field: "cpf", message: "Já existe um aluno com este CPF neste dojô." };
  }
  if (code === "MENOR_SEM_RESPONSAVEL") {
    return { field: "guardian", message: "Aluno menor de 18 anos precisa de um responsável vinculado (LGPD)." };
  }
  if (code === "GUARDIAN_NOT_FOUND") {
    return { field: "guardian", message: "Responsável não encontrado neste dojô — escolha outro ou cadastre de novo." };
  }
  if (code === "SCHEMA_PENDING") {
    return { field: "general", message: "O cadastro de alunos ainda não está liberado neste ambiente (atualização pendente no servidor)." };
  }
  if (code === "PORTAL_READ_ONLY") {
    return { field: "general", message: "O portal do dojô é somente leitura. Entre com a conta do dojô para alterar dados." };
  }
  if (code === "NOT_FOUND") {
    return { field: "general", message: "Aluno não encontrado — talvez tenha sido excluído em outra aba." };
  }
  if (code === "VALIDATION_ERROR") {
    const joined = apiErrors.join(" ");
    if (/cpf/i.test(joined)) return { field: "cpf", message: "CPF inválido — confira os 11 dígitos." };
    if (/email/i.test(joined)) return { field: "email", message: "E-mail inválido." };
    if (/birth_date/i.test(joined)) return { field: "birth_date", message: "Data de nascimento inválida. Use DD/MM/AAAA." };
    if (/full_name/i.test(joined)) return { field: "full_name", message: "Informe o nome do aluno." };
    if (/enrolled_at/i.test(joined)) return { field: "general", message: "Data de início inválida. Use DD/MM/AAAA." };
    return { field: "general", message: apiErrors[0] || "Dados inválidos — confira o formulário." };
  }
  return { field: "general", message: e?.message || "Não foi possível salvar. Tente de novo." };
}

// ── Federação (F5b) — erros do POST/DELETE .../students/:sid/federate ──

export type FederationErrorField = "fpkt_number" | "general";

/**
 * Mapeia os erros do preview/confirmação do vínculo com a federação
 * (Aura-backend#447, migration 262) pro campo certo, em pt-BR:
 *
 * - 404 FPKT_NUMBER_NOT_FOUND — número não existe.
 * - 409 PRATICANTE_JA_VINCULADO — o praticante já é de outro aluno. O
 *   backend RENOMEOU o código (era PRACTITIONER_JA_VINCULADO); durante a
 *   transição ele também manda `legacy_code` com o nome antigo — tratamos
 *   os dois em `code` e em `legacy_code`.
 * - 409 CPF_CONFLITANTE — os dois lados têm CPF e são diferentes. NÃO HÁ
 *   OVERRIDE: o sensei precisa corrigir o cadastro ou usar outro número.
 *   Normalmente isso já chega como `blockers` no preview (200, can_link
 *   false) — este mapeamento cobre o caso de a confirmação ainda assim
 *   devolver 409 (corrida entre preview e confirm).
 * - 409 JA_FEDERADO — este aluno já está federado.
 * - 409 DOJO_NAO_CONECTADO — o dojô ainda não está conectado à federação.
 * - 503 SCHEMA_PENDING_262 — a migration 262 ainda não rodou neste
 *   ambiente; a confirmação não funciona (o preview funciona normalmente).
 */
export function mapFederationError(e: any): { field: FederationErrorField; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  const legacyCode = e?.data?.legacy_code ?? null;
  if (code === "FPKT_NUMBER_NOT_FOUND") {
    return { field: "fpkt_number", message: "Não encontramos nenhum praticante com este número FPKT." };
  }
  if (
    code === "PRATICANTE_JA_VINCULADO" ||
    code === "PRACTITIONER_JA_VINCULADO" ||
    legacyCode === "PRACTITIONER_JA_VINCULADO" ||
    legacyCode === "PRATICANTE_JA_VINCULADO"
  ) {
    return { field: "fpkt_number", message: "Este número FPKT já está vinculado a outro aluno." };
  }
  if (code === "CPF_CONFLITANTE") {
    return {
      field: "general",
      message:
        e?.data?.error ||
        "O CPF do dojô e o CPF da federação são diferentes — não é possível sobrescrever. Corrija o cadastro ou use outro número FPKT.",
    };
  }
  if (code === "JA_FEDERADO") {
    return { field: "general", message: "Este aluno já está federado." };
  }
  if (code === "DOJO_NAO_CONECTADO") {
    return { field: "general", message: "Seu dojô ainda não está conectado à federação — conecte primeiro para federar alunos." };
  }
  if (code === "SCHEMA_PENDING_262" || code === "SCHEMA_PENDING") {
    return {
      field: "general",
      message: "Essa confirmação ainda não está disponível neste ambiente (atualização pendente no servidor). Tente novamente mais tarde.",
    };
  }
  return { field: "general", message: e?.message || "Não foi possível concluir. Tente de novo." };
}
