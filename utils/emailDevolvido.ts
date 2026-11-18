// ============================================================
// AURA. — E-mail de confirmação que voltou (18/11/2026)
//
// O Resend avisa quando o e-mail volta (bounce). O backend (Aura-backend,
// services/emailDevolvido.js) passa o sinal em user.email_devolvido no
// /auth/me (só para quem não confirmou) e, quando o envio nem saiu porque o
// endereço já voltou de vez, responde o reenvio com
// { sent: false, reason: "email_devolvido", email_devolvido }.
//
//   permanente  o endereço não existe: a tela troca a espera pelo aviso, com
//               "Corrigir meu e-mail" e o WhatsApp em destaque;
//   temporaria  caixa cheia, servidor fora: a espera continua, com o aviso
//               em cima e o reenvio de sempre.
//
// Textos aprovados pelo Caio em 18/11/2026.
// ============================================================

export type TipoDaDevolucao = "permanente" | "temporaria";
export type SinalDaDevolucao = { tipo: TipoDaDevolucao; em?: string | null };

export const MOTIVO_EMAIL_DEVOLVIDO = "email_devolvido";

export const TITULO_DEVOLUCAO_PERMANENTE = "Esse e-mail voltou";

export function textoDaDevolucao(tipo: TipoDaDevolucao, email: string): string {
  if (tipo === "permanente") {
    return "O e-mail que mandamos para " + email + " não chegou. Confira se está escrito certo e corrija, ou fale com a gente no WhatsApp.";
  }
  return "Não conseguimos entregar agora em " + email + ". Tente reenviar daqui a pouco ou corrija o e-mail.";
}

/** Lê o sinal do backend (qualquer outro formato vira null). */
export function lerSinalDaDevolucao(v: any): SinalDaDevolucao | null {
  if (!v || typeof v !== "object") return null;
  if (v.tipo === "permanente" || v.tipo === "temporaria") return { tipo: v.tipo, em: v.em || null };
  return null;
}

/**
 * Sinal de uma resposta de envio (send-verification / corrigir-email). O
 * motivo email_devolvido sem o sinal conta como permanente: o backend só
 * segura o envio na devolução permanente.
 */
export function sinalDoEnvio(res: any): SinalDaDevolucao | null {
  if (!res || res.reason !== MOTIVO_EMAIL_DEVOLVIDO) return null;
  return lerSinalDaDevolucao(res.email_devolvido) || { tipo: "permanente", em: null };
}
