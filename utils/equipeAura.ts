// ============================================================
// Quem é da equipe Aura no app: só o is_staff que o backend devolve no
// usuário (/auth/login, /auth/me). O domínio do e-mail não conta para nada:
// nem para pular a confirmação do e-mail, nem o checkout, nem para ver as
// telas da Gestão Aura. Quem marca a equipe é o backend.
// ============================================================

export function ehEquipeAura(user: unknown): boolean {
  return !!user && typeof user === "object" && (user as { is_staff?: unknown }).is_staff === true;
}
