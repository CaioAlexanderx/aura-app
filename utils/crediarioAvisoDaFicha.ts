// ============================================================================
// Aviso do cabeçalho da ficha do crediário (F1 do redesenho, 23/11/2026).
//
// Um aviso por vez, o mais grave primeiro (plano, seção 3): as contas que não
// batem, depois as parcelas a conferir, depois o "costuma atrasar". Nenhum
// deles corrige dado: só explica. Puro, sem React.
// ============================================================================

export type EntradaDoAviso = {
  /** detail.ledger_mismatch: as parcelas abertas não batem com o razão. */
  divergencia: boolean;
  somaDasParcelas: number;
  saldoDaConta: number;
  /** Parcelas vencidas antes do cadastro do carnê (só sem atraso de verdade). */
  aConferir: number;
  /** profile.score_warning veio. */
  costumaAtrasar: boolean;
  fmt: (n: number) => string;
};

export type AvisoDaFicha = { tipo: "divergencia" | "a-conferir" | "score"; texto: string } | null;

export function avisoDaFicha(e: EntradaDoAviso): AvisoDaFicha {
  if (e.divergencia) {
    return {
      tipo: "divergencia",
      texto: `As parcelas somam ${e.fmt(e.somaDasParcelas)}, mas a conta dela mostra ${e.fmt(e.saldoDaConta)}. Veja os lançamentos em Movimentações.`,
    };
  }
  if (e.aConferir > 0) {
    return {
      tipo: "a-conferir",
      texto: e.aConferir === 1
        ? "1 parcela venceu antes de o carnê ser cadastrado. Confira se já foi paga."
        : `${e.aConferir} parcelas venceram antes de o carnê ser cadastrado. Confira se já foram pagas.`,
    };
  }
  if (e.costumaAtrasar) {
    return { tipo: "score", texto: "Esta cliente costuma atrasar. Você pode vender normalmente: é só um aviso." };
  }
  return null;
}
