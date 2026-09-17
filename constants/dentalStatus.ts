// ============================================================
// STATUS DA AGENDA ODONTO — fonte única de rótulo e cor
//
// Aprovado no mockup "Agenda Odonto" (16/09/2026): 8 status, uma cor cada,
// iguais na grade, legenda, selo, lista e painel Hoje. Antes cada arquivo
// tinha seu mapa (Confirmado era verde num e laranja noutro).
// Valores do backend: Aura-backend#722 (enum dental_appointment_status).
// Segue IS_DARK_MODE como dental-tokens.ts (o toggle recarrega a página).
// ============================================================
import { IS_DARK_MODE } from "@/constants/colors";

export type DentalStatus =
  | "agendado"
  | "confirmado"
  | "paciente_consultorio"
  | "em_atendimento"
  | "concluido"
  | "faltou"
  | "falta_justificada"
  | "cancelado"
  | "avaliacao"
  | "aprovado";

type StatusInfo = {
  /** Rótulo completo (selo, menu de status). */
  label: string;
  /** Rótulo curto para blocos estreitos. */
  short: string;
  /** Explicação curta para o menu de status. */
  hint: string;
  /** Cor do status (borda, bolinha, texto do selo). */
  color: string;
  /** Fundo translúcido do selo/bloco. */
  bg: string;
  /** "Agendado" ainda não confirmou: desenhar com borda tracejada. */
  dashed?: boolean;
};

const DARK: Record<string, string> = {
  agendado: "#06B6D4",
  confirmado: "#10B981",
  paciente_consultorio: "#A78BFA",
  em_atendimento: "#F59E0B",
  concluido: "#60A5FA",
  faltou: "#EF4444",
  falta_justificada: "#FB923C",
  cancelado: "#9CA3AF",
};

const LIGHT: Record<string, string> = {
  agendado: "#0891B2",
  confirmado: "#059669",
  paciente_consultorio: "#7C3AED",
  em_atendimento: "#D97706",
  concluido: "#2563EB",
  faltou: "#DC2626",
  falta_justificada: "#EA580C",
  cancelado: "#6B7280",
};

const PALETTE = IS_DARK_MODE ? DARK : LIGHT;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function info(key: string, label: string, short: string, hint: string, dashed = false): StatusInfo {
  const color = PALETTE[key];
  return { label, short, hint, color, bg: hexToRgba(color, IS_DARK_MODE ? 0.17 : 0.12), dashed };
}

/** Status que aparecem no menu "Definir status", nesta ordem. */
export const DENTAL_STATUS_ORDER: DentalStatus[] = [
  "agendado",
  "confirmado",
  "paciente_consultorio",
  "em_atendimento",
  "concluido",
  "faltou",
  "falta_justificada",
  "cancelado",
];

export const DENTAL_STATUS: Record<string, StatusInfo> = {
  agendado: info("agendado", "Agendado", "Agendado", "Ainda não confirmou", true),
  confirmado: info("confirmado", "Confirmado", "Confirmado", "Confirmou presença"),
  paciente_consultorio: info("paciente_consultorio", "Paciente no consultório", "No consultório", "Chegou e está aguardando"),
  em_atendimento: info("em_atendimento", "Em atendimento", "Em atendimento", "Na cadeira agora"),
  concluido: info("concluido", "Concluído", "Concluído", "Atendimento finalizado"),
  faltou: info("faltou", "Faltou", "Faltou", "Não veio e não avisou"),
  falta_justificada: info("falta_justificada", "Falta justificada", "Justificada", "Avisou que não viria"),
  cancelado: info("cancelado", "Cancelado", "Cancelado", "Sai da grade, fica no histórico"),
  // Legado do funil de avaliação: exibidos como agendado/confirmado.
  avaliacao: info("agendado", "Em avaliação", "Avaliação", "Avaliação em andamento", true),
  aprovado: info("confirmado", "Aprovado", "Aprovado", "Plano aprovado"),
};

/** Informações do status; status desconhecido cai em "agendado". */
export function dentalStatus(status: string | null | undefined): StatusInfo {
  return (status && DENTAL_STATUS[status]) || DENTAL_STATUS.agendado;
}

/** Status em que a consulta já começou ou terminou: não pode ser arrastada/remarcada pela grade. */
export const DENTAL_LOCKED_STATUSES = new Set<string>([
  "em_atendimento",
  "concluido",
  "faltou",
  "falta_justificada",
  "cancelado",
]);
