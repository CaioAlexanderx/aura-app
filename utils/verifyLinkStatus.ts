// ============================================================
// verifyLinkStatus — Task Sign Up 03/08/2026
//
// O backend redireciona o clique do link de confirmação de e-mail
// para o app com ?email_verified=true OU ?verify_error=expired|
// invalid|server. O AuthGuard (app/_layout.tsx) limpa esses params
// da URL; antes ele APAGAVA o verify_error sem nunca lê-lo — o link
// expirado era 100% silencioso para o usuário.
//
// Este módulo é o hand-off de um valor só entre o AuthGuard (que
// captura o param antes de limpar a URL) e a tela verify-email
// (que o consome no mount para abrir direto no estado "expirado").
// ============================================================

export type VerifyLinkError = "expired" | "invalid" | "server";

let pending: VerifyLinkError | null = null;

export function setVerifyLinkError(v: string | null) {
  pending = (v === "expired" || v === "invalid" || v === "server") ? v : null;
}

/** Lê e limpa o erro pendente (consumo único). */
export function consumeVerifyLinkError(): VerifyLinkError | null {
  const v = pending;
  pending = null;
  return v;
}
