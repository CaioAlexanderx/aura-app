// ============================================================
// AURA. — Empresa de volta ao confirmar o e-mail (tq-113, 26/10/2026)
//
// Decisão do Caio (opção B): a conta continua nascendo antes da confirmação
// do e-mail, mas quem não confirma em 7 dias tem a empresa desativada pelo
// backend (companies.is_active = false, nunca apagada). Se a pessoa volta
// depois e confirma, o backend reabre a empresa na própria confirmação
// (Aura-backend, routes/verification.js -> reativarAoConfirmar).
//
// O problema do lado do app: o login foi feito com a empresa desativada, então
// o JWT da sessão nasceu SEM empresa (company: null). O /auth/me lê a empresa
// do JWT e continua devolvendo company null mesmo depois da reabertura. Só um
// token novo (POST /auth/refresh resolve a empresa ativa de novo) resolve.
//
// Regra: ao confirmar, se a sessão está sem empresa e não está no modo
// consolidado (multi-CNPJ), renova o token e relê o /me. Nas contas de
// sempre (empresa já carregada) nada acontece. Nunca lança: a confirmação
// segue mesmo que a recarga falhe (a pessoa pode sair e entrar de novo).
// ============================================================

export type EstadoDaSessao = {
  token: string | null;
  company: unknown;
  consolidatedView: boolean;
  refreshMe: () => Promise<void>;
};

export type ResultadoDaRenovacao = { status: string };

/** Sessão logada, sem empresa e fora do consolidado. */
export function precisaRecarregarEmpresa(s: Pick<EstadoDaSessao, "token" | "company" | "consolidatedView"> | null | undefined): boolean {
  return !!s && !!s.token && !s.company && !s.consolidatedView;
}

/**
 * Renova o token e relê o /me quando a sessão está sem empresa.
 * Devolve true quando a empresa voltou para a sessão.
 */
export async function recarregarEmpresaAoConfirmar(deps: {
  getState: () => EstadoDaSessao;
  renovarToken: () => Promise<ResultadoDaRenovacao>;
}): Promise<boolean> {
  try {
    if (!precisaRecarregarEmpresa(deps.getState())) return false;
    const r = await deps.renovarToken();
    if (!r || r.status !== "ok") return false;
    await deps.getState().refreshMe();
    return !!deps.getState().company;
  } catch {
    return false;
  }
}
