// ============================================================
// Helpers — Alunos do dojô (F2)
//
// Faixas comuns do karatê (chips do form; belt_order = posição na
// hierarquia, 1 = Branca … 9 = Preta — espelha BELT_KEY_RANK do tema,
// sem a Vermelha histórica/isLegacy). Faixa em texto livre entra com
// belt_order null (vai pro fim da pirâmide — NULLS LAST no backend).
//
// Datas tz-safe: 'YYYY-MM-DD' é date puro — NUNCA new Date('YYYY-MM-DD')
// (em UTC-3 volta um dia). Parse/format sempre por split manual.
// ============================================================
import { KarateBelts, KarateColors, resolveBeltKey } from "@/constants/karateTheme";

export interface CommonBelt {
  label: string;
  order: number;
}

export const COMMON_BELTS: CommonBelt[] = [
  { label: "Branca", order: 1 },
  { label: "Amarela", order: 2 },
  { label: "Laranja", order: 3 },
  { label: "Verde", order: 4 },
  { label: "Azul Claro", order: 5 },
  { label: "Roxa", order: 6 },
  { label: "Azul Escuro", order: 7 },
  { label: "Marrom", order: 8 },
  { label: "Preta", order: 9 },
];

/** belt_order derivado da POSIÇÃO na lista de faixas comuns; texto livre → null. */
export function beltOrderForLabel(label: string | null | undefined): number | null {
  if (!label) return null;
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

// ── Datas (tz-safe, string-only) ─────────────────────────────

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

// ── CPF ──────────────────────────────────────────────────────

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

// ── Erros da API → campo certo, em pt-BR ─────────────────────

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
