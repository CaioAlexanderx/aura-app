// ============================================================
// "Corrigir meu e-mail" na tela de confirmação (26/10/2026)
//
// Quem criou a conta com o e-mail errado (erro de digitação) não tinha como
// corrigir: o botão da tela só saía da conta, e recadastrar não resolve.
// POST /auth/corrigir-email (Aura-backend) troca o e-mail de quem ainda não
// confirmou. Aqui ficam a conferência do formato (a mesma do backend, para
// avisar antes de ir ao servidor) e o texto de cada recusa, no tom da Aura:
// curto, sem jargão, sem culpar a pessoa.
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** E-mail como o backend grava (sem espaços, minúsculas) ou null se não parece completo. */
export function normalizarEmailDigitado(bruto: string): string | null {
  const email = String(bruto || "").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  const tld = email.slice(email.lastIndexOf(".") + 1);
  if (tld.length < 2) return null;
  return email;
}

export const MSG_EMAIL_INCOMPLETO = "Esse e-mail não parece completo. Confira e tente de novo.";
export const MSG_EMAIL_IGUAL = "Esse já é o e-mail da sua conta.";
export const MSG_EMAIL_EM_USO = "Esse e-mail já tem uma conta na Aura. Entre com ele ou fale com a gente.";
export const MSG_EMAIL_JA_CONFIRMADO = "Seu e-mail já foi confirmado. Para trocar, fale com a gente.";
export const MSG_MUITAS_TENTATIVAS = "Você tentou trocar muitas vezes. Espere um pouco e tente de novo, ou fale com a gente.";
export const MSG_SEM_CONEXAO = "Sem conexão. Confira sua internet e tente de novo.";
export const MSG_NAO_DEU = "Não deu para trocar o e-mail agora. Tente de novo em instantes.";

export type ErroAoCorrigir = { texto: string; falarComAGente: boolean };

/** Texto da recusa a partir do erro da API (ApiError: status, data.code, isNetworkError). */
export function erroAoCorrigir(err: any): ErroAoCorrigir {
  const status = err && typeof err.status === "number" ? err.status : 0;
  const code = err && err.data && typeof err.data.code === "string" ? err.data.code : "";
  if (err && err.isNetworkError) return { texto: MSG_SEM_CONEXAO, falarComAGente: false };
  if (code === "EMAIL_EM_USO") return { texto: MSG_EMAIL_EM_USO, falarComAGente: true };
  if (code === "EMAIL_JA_CONFIRMADO") return { texto: MSG_EMAIL_JA_CONFIRMADO, falarComAGente: true };
  if (code === "EMAIL_INVALIDO") return { texto: MSG_EMAIL_INCOMPLETO, falarComAGente: false };
  if (code === "EMAIL_IGUAL") return { texto: MSG_EMAIL_IGUAL, falarComAGente: false };
  if (code === "CORRIGIR_EMAIL_LIMITE" || status === 429) return { texto: MSG_MUITAS_TENTATIVAS, falarComAGente: true };
  if (status === 400 && err && err.message) return { texto: String(err.message), falarComAGente: true };
  return { texto: MSG_NAO_DEU, falarComAGente: status === 404 };
}

export const TEXTO_WHATSAPP_CORRIGIR_EMAIL = "Olá! Criei minha conta na Aura com o e-mail errado e preciso de ajuda para corrigir.";
