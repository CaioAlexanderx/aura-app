// ============================================================
// QA fix (LJ-01, 28/09/2026, Studio rodada 3).
//
// Achado: abrir app.getaura.com.br/ com sessão válida mostrava o
// FORMULÁRIO de login inteiro por ≥3s antes de ir sozinho pra /studio
// (ou outra vertical). Causa: hydrate() (stores/auth.ts) só marca
// isHydrated=true DEPOIS de esperar /auth/me quando há token salvo — até
// lá, o redirect do app/_layout.tsx ("!token && !inAuth" etc.) ainda não
// rodou, e o <Slot/> renderiza o que bate com "/" nesse meio-tempo.
//
// Função pura extraída pra ser testável sem montar o layout inteiro
// (app/_layout.tsx puxa QueryClientProvider, StudioThemeProvider,
// ErrorBoundary, LGPDConsent, offlineSync — pesado demais só pra travar
// esta condição).
// ============================================================

/**
 * Troca o <Slot/> por um carregamento neutro?
 *
 * SÓ na raiz vazia ("/", segments=[]) e só antes de hidratar — pra não
 * atrasar NENHUMA rota pública (vitrine, aprovação, acompanhamento…),
 * que o <Slot/> já mostra direto, sem esperar hidratação nenhuma.
 */
export function mostrarCarregandoSessao(segments: readonly string[], isHydrated: boolean): boolean {
  return segments.length === 0 && !isHydrated;
}
