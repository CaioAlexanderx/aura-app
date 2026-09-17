// ============================================================
// AURA. — WhatsApp MANUAL (odonto QA, 2026-09-16)
//
// Decisão de produto: nada é enviado pela Aura. Este utilitário só monta a
// URL do WhatsApp/discador com o texto pronto e abre o app do usuário —
// quem manda a mensagem é o dentista, com um toque.
//
// Regra de ouro do popup no web: `openWhatsApp` PRECISA ser chamada de
// forma síncrona dentro do handler de clique (nunca depois de um `await`),
// senão o navegador bloqueia o pop-up. Se o fluxo depende de gerar algo no
// servidor antes (token, doc assinado etc.), abra a URL primeiro e resolva
// o resto depois — não espere a resposta do servidor pra abrir a aba.
// ============================================================
import { Linking, Platform } from "react-native";

/**
 * Normaliza um telefone brasileiro pra dígitos com DDI 55.
 * - 10 ou 11 dígitos (DDD + número, sem DDI) → prefixa 55.
 * - 12 ou 13 dígitos já começando com 55 → mantém como está.
 * - qualquer outra coisa (vazio, tamanho errado, DDI diferente) → null.
 */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }
  return null;
}

/** Monta a URL do wa.me com o número normalizado e o texto (se houver). */
export function buildWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const normalized = normalizeBrPhone(phone);
  if (!normalized) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${normalized}${query}`;
}

/** Monta a URL tel: com o número normalizado. */
export function buildTelUrl(phone: string | null | undefined): string | null {
  const normalized = normalizeBrPhone(phone);
  if (!normalized) return null;
  return `tel:+${normalized}`;
}

/**
 * Abre o WhatsApp com a mensagem pronta. Retorna false (e não faz nada) se
 * não há telefone válido — quem chama decide o que mostrar nesse caso.
 *
 * Web: window.open síncrono (mesmo tick do clique, senão o browser bloqueia
 * o pop-up). Nativo: Linking.openURL.
 */
export function openWhatsApp(phone: string | null | undefined, text?: string): boolean {
  const url = buildWhatsAppUrl(phone, text);
  if (!url) return false;
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.open === "function") {
      window.open(url, "_blank", "noopener");
    }
  } else {
    Linking.openURL(url).catch(() => {});
  }
  return true;
}

/** Abre o discador com o telefone normalizado. Retorna false se não há telefone válido. */
export function openTel(phone: string | null | undefined): boolean {
  const url = buildTelUrl(phone);
  if (!url) return false;
  Linking.openURL(url).catch(() => {});
  return true;
}

function firstName(fullName: string | null | undefined): string {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

const WEEKDAYS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function formatWeekdayDate(d: Date): string {
  const weekday = WEEKDAYS_PT[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${weekday}, ${day}/${month}`;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Texto de confirmação de consulta — primeiro nome, dia da semana + data
 * (fuso local, sem hardcode de timezone) e horário. Sem clinicName, omite
 * o trecho "Aqui é da <clínica>."
 */
export function confirmationText({
  patientName,
  clinicName,
  when,
}: {
  patientName: string;
  clinicName?: string | null;
  when: Date;
}): string {
  const name = firstName(patientName);
  const clinicPart = clinicName ? ` Aqui é da ${clinicName}.` : "";
  const dateStr = formatWeekdayDate(when);
  const timeStr = formatTime(when);
  return `Olá, ${name}!${clinicPart} Confirmando sua consulta ${dateStr} às ${timeStr}. Responda SIM para confirmar ou me avise se precisar remarcar.`;
}

/** Texto genérico de saudação — usado quando não há contexto de agendamento. */
export function genericText({ patientName }: { patientName: string }): string {
  return `Olá, ${firstName(patientName)}!`;
}

function clinicIntro(clinicName?: string | null): string {
  return clinicName ? ` Aqui é da ${clinicName}.` : "";
}

/** "quinta, 17/09, às 14:00" — usado nos avisos de falta/cancelamento/remarcação. */
function whenPhrase(d: Date): string {
  return `${formatWeekdayDate(d)}, às ${formatTime(d)}`;
}

type WhenArgs = { patientName: string; clinicName?: string | null; when: Date };

/** Lembrete para quem já confirmou. */
export function reminderText({ patientName, clinicName, when }: WhenArgs): string {
  return `Olá, ${firstName(patientName)}!${clinicIntro(clinicName)} Lembrando da sua consulta ${formatWeekdayDate(when)} às ${formatTime(when)}. Até lá!`;
}

/** Para quem faltou: oferece remarcar. */
export function noShowText({ patientName, clinicName, when }: WhenArgs): string {
  return `Olá, ${firstName(patientName)}!${clinicIntro(clinicName)} Sentimos sua falta na consulta de ${whenPhrase(when)}. Quer remarcar? Me diga o melhor dia e horário para você.`;
}

export type CancelReasonKey = "desmarcou" | "sem_resposta" | "remarcada" | "outro";

/** Aviso de cancelamento; a redação muda conforme o motivo (mockup aprovado, aba E). */
export function cancellationText({
  patientName,
  clinicName,
  when,
  reason,
}: WhenArgs & { reason?: CancelReasonKey | null }): string {
  const hi = `Olá, ${firstName(patientName)}!${clinicIntro(clinicName)}`;
  const w = whenPhrase(when);
  switch (reason) {
    case "desmarcou":
      return `${hi} Conforme combinamos, cancelei sua consulta de ${w}. Quando quiser remarcar, é só me chamar por aqui.`;
    case "sem_resposta":
      return `${hi} Como não consegui confirmar sua consulta de ${w}, liberei o horário. Se ainda quiser vir, me chame que encontramos outro horário.`;
    case "remarcada":
      return `${hi} Sua consulta de ${w} foi remarcada. Já te mando a nova data.`;
    default:
      return `${hi} Sua consulta de ${w} foi cancelada. Quando quiser remarcar, é só me chamar por aqui.`;
  }
}

/** Aviso de remarcação: "antes → agora". */
export function rescheduleText({
  patientName,
  clinicName,
  from,
  to,
}: {
  patientName: string;
  clinicName?: string | null;
  from: Date;
  to: Date;
}): string {
  return `Olá, ${firstName(patientName)}!${clinicIntro(clinicName)} Sua consulta de ${whenPhrase(from)} foi remarcada para ${whenPhrase(to)}. Qualquer dúvida, me avise por aqui.`;
}

/**
 * Mensagem pronta do botão WhatsApp do detalhe, conforme o status:
 * agendado → pedir confirmação; faltou → oferecer remarcar; cancelado →
 * aviso de cancelamento; demais → lembrete.
 */
export function appointmentMessage({
  status,
  ...args
}: WhenArgs & { status: string | null | undefined }): string {
  if (status === "faltou") return noShowText(args);
  if (status === "cancelado") return cancellationText(args);
  if (!status || status === "agendado" || status === "avaliacao") return confirmationText(args);
  return reminderText(args);
}
