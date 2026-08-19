// ============================================================
// Helpers — Turmas do dojô (F4: CRUD, matrícula, chamada, check-in QR;
// F9: QR único do dojô + janela de tolerância)
//
// Datas 'YYYY-MM-DD' são SEMPRE tz-safe: parse manual / Date.UTC, nunca
// new Date('YYYY-MM-DD') local direto (em UTC-3 isso pode voltar um
// dia). O dia da semana é derivado da STRING manualmente via Date.UTC —
// o cálculo de dia-da-semana de uma data de calendário não depende de
// fuso horário, então isso é seguro (mesmo racional de brToISO no
// módulo dojoAlunos, que usa Date.UTC só para VALIDAR o dia).
// ============================================================
import type { DojoClassStartTimeRange } from "@/services/karateDojoClassesApi";

export const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAY_LONG = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

/** Hoje no fuso do device, 'YYYY-MM-DD' (componentes locais, nunca toISOString). */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Desloca uma data 'YYYY-MM-DD' por `deltaDays` (+/-), tz-safe via Date.UTC. */
export function shiftISODate(iso: string, deltaDays: number): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return todayISO();
  const dt = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Dia da semana (0=domingo..6=sábado) de 'YYYY-MM-DD', via Date.UTC (tz-safe). */
export function weekdayOfISO(iso: string): number {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date().getDay();
  return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))).getUTCDay();
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' ('—' se ausente/inválida). */
export function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** 'YYYY-MM-DD' → 'Segunda-feira, 21/07' (cabeçalho da chamada). */
export function fmtDateLongBR(iso: string): string {
  const wd = WEEKDAY_LONG[weekdayOfISO(iso)];
  return `${wd}, ${fmtDateBR(iso)}`;
}

/** Chips de dias da semana ordenados, formato compacto de leitura ("D · S · T"). */
export function weekdaysLabel(weekdays: number[]): string {
  const sorted = [...(weekdays || [])].sort((a, b) => a - b);
  if (sorted.length === 0) return "Sem dia definido";
  return sorted.map((d) => WEEKDAY_SHORT[d] ?? "?").join(" · ");
}

/** Máscara de digitação HH:MM (só dígitos, ':' automático). */
export function maskTimeHHMM(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Valida 'HH:MM' (00-23:00-59). String vazia é válida (campo opcional). */
export function isValidTimeOrEmpty(v: string): boolean {
  if (!v) return true;
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59;
}

/** 'HH:MM' → minutos do dia (0..1439). null se vazio/inválido. */
export function timeToMinutes(v: string): number | null {
  const m = String(v || "").match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

// ── Faixa de início da turma (virada do dia) ──────────────────────────
//
// O backend recusa turma que começa na virada do dia: a janela de
// tolerância do check-in por QR é linear dentro de uma data e vazaria pro
// dia vizinho, quebrando o check-in bem na hora da aula. Os limites vêm
// do servidor (settings.class_start_time_range), derivados lá das
// constantes da janela — nunca hardcodados aqui.
//
// SEM faixa conhecida (backend antigo, ou o settings falhou) as duas
// funções viram no-op: nada de dica, nada de bloqueio. O 422 do servidor
// segue valendo — o front nunca inventa um limite que não conhece.

/** Dica pro campo de início. null quando a faixa é desconhecida. */
export function startTimeRangeHint(range: DojoClassStartTimeRange | null | undefined): string | null {
  if (!range?.min || !range?.max) return null;
  return `Entre ${range.min} e ${range.max} — o check-in por QR precisa de uma janela que não atravesse a meia-noite.`;
}

/**
 * O horário digitado cai fora da faixa aceita?
 * Vazio (campo é opcional) e faixa desconhecida nunca bloqueiam.
 */
export function isStartTimeOutOfRange(
  value: string,
  range: DojoClassStartTimeRange | null | undefined
): boolean {
  if (!value || !range?.min || !range?.max) return false;
  const v = timeToMinutes(value);
  const min = timeToMinutes(range.min);
  const max = timeToMinutes(range.max);
  if (v == null || min == null || max == null) return false;
  return v < min || v > max;
}

/** 'HH:MM'–'HH:MM' formatado para exibição, ou null quando ambos ausentes. */
export function timeRangeLabel(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

// ── Erros da API → mensagem pt-BR (ApiError carrega body em e.data) ───

export function mapClassesError(e: any): { code: string | null; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  const apiErrors: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : [];
  if (code === "SCHEMA_PENDING") {
    return { code, message: "Turmas ainda não estão disponíveis neste ambiente (atualização pendente no servidor)." };
  }
  if (code === "HAS_HISTORY") {
    return { code, message: "Essa turma já tem chamadas registradas — não é possível excluir. Prefira inativar." };
  }
  if (code === "ALREADY_ENROLLED") {
    return { code, message: "Esse aluno já está matriculado nesta turma." };
  }
  if (code === "QR_DESABILITADO") {
    return { code, message: "O check-in por QR está desligado para este dojô." };
  }
  if (code === "NOT_ENROLLED") {
    // QA prod 30/07 (item 2): o back distingue NOT_ENROLLED de
    // NO_CLASS_TODAY, mas o "de hoje" no fim desta mensagem reintroduzia
    // a mesma confusão que o fix queria eliminar — mandava o sensei
    // olhar a agenda em vez do cadastro do aluno. É matrícula, não data.
    return { code, message: "Esse aluno não está matriculado em nenhuma turma." };
  }
  if (code === "NO_CLASS_TODAY") {
    return { code, message: "Não há turma prevista para hoje." };
  }
  // F9 — QR único do dojô.
  if (code === "STUDENT_ID_REQUIRED") {
    return { code, message: "Esse é o QR único do dojô — informe o aluno para confirmar a presença." };
  }
  if (code === "NO_CLASS_NOW") {
    // O back já manda a janela (30/60 min) na mensagem — repassa direto
    // em vez de reescrever um texto genérico que esconderia o motivo.
    return { code, message: e?.data?.error || "Não há aula agora (fora da janela de tolerância do horário)." };
  }
  if (code === "AMBIGUOUS_CLASS") {
    return { code, message: "Mais de uma turma possível agora — escolha qual." };
  }
  if (code === "VALIDATION_ERROR") {
    return { code, message: apiErrors[0] || "Dados inválidos — confira o formulário." };
  }
  if (code === "NOT_FOUND") {
    return { code, message: "Não encontrado — talvez tenha sido alterado em outra aba." };
  }
  return { code, message: e?.data?.error || e?.message || "Não foi possível concluir. Tente de novo." };
}
