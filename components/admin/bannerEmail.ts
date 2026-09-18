// ============================================================
// AURA. — E-mail de notificação de empresa específica: regras puras
// (sem React) usadas pelo painel Endomarketing. Mockup aprovado pelo
// Caio em 18/09/2026. Rota: POST /admin/notifications/banners/:id/email.
// ============================================================
import type { BannerRecipient, SendBannerEmailBody } from "@/services/adminApi";

export type EmailDraft = {
  enabled:        boolean;
  recipients:     BannerRecipient[];     // o que o backend devolveu
  selected:       string[];              // e-mails marcados
  subject:        string;
  subjectTouched: boolean;               // até editar, o assunto acompanha o título
  pixAmount:      string;                // "169,00"
  pixDue:         string;                // "18/09/2026"
  pixCode:        string;
};

export const EMPTY_DRAFT: EmailDraft = {
  enabled: false, recipients: [], selected: [], subject: "", subjectTouched: false,
  pixAmount: "", pixDue: "", pixCode: "",
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "169,00" | "1.169,00" | "R$ 169" | "169.5" → número. Vazio → null. Lixo → NaN.
export function parseValorBRL(s: string): number | null {
  const t = String(s || "").replace(/R\$\s*/i, "").trim();
  if (!t) return null;
  let norm = t;
  if (t.includes(",")) norm = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return NaN;
  return Number(norm);
}

// "18/09/2026" → "2026-09-18". Vazio → null. Data inexistente → undefined.
export function parseDataBR(s: string): string | null | undefined {
  const t = String(s || "").trim();
  if (!t) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (dt.getFullYear() !== Number(y) || dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) return undefined;
  return `${y}-${mo}-${d}`;
}

export function subjectOf(draft: EmailDraft, title: string): string {
  return (draft.subjectTouched ? draft.subject : title).trim();
}

// Monta o corpo do POST ou diz o que falta. Mesmas regras do backend,
// antes de sair da tela.
export function buildSendBody(draft: EmailDraft, title: string): { body?: SendBannerEmailBody; error?: string } {
  if (!draft.selected.length) return { error: "Escolha ao menos um destinatário" };

  const code = draft.pixCode.trim();
  const amount = parseValorBRL(draft.pixAmount);
  const due = parseDataBR(draft.pixDue);
  const temPix = !!(code || draft.pixAmount.trim() || draft.pixDue.trim());

  let pix: SendBannerEmailBody["pix"] = null;
  if (temPix) {
    if (!code) return { error: "Informe o PIX copia e cola (ou limpe valor e vencimento)" };
    if (!code.startsWith("000201")) return { error: "PIX copia e cola inválido: deve começar com 000201" };
    if (amount !== null && (Number.isNaN(amount) || amount <= 0)) return { error: "Valor inválido. Ex.: 169,00" };
    if (due === undefined) return { error: "Vencimento inválido. Use DD/MM/AAAA" };
    pix = { code, amount, due_date: due };
  }

  return { body: { recipients: draft.selected, subject: subjectOf(draft, title) || undefined, pix } };
}

export function sourceLabel(r: BannerRecipient): string {
  const s = r.sources;
  if (s.includes("owner") && s.includes("company")) return "responsável e empresa";
  if (s.includes("owner")) return "responsável";
  if (s.includes("company")) return "empresa";
  return "equipe";
}

// "2026-09-18T12:52:00Z" → "18/09 09:52" (horário local).
export function fmtEnvio(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
