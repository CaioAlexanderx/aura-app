// ============================================================
// Regras só para esta cliente — corpo do PUT de termos (QA 23/11/2026)
//
// O backend (PUT /credit/customers/:cid/terms) só mexe nos campos que
// vierem no corpo: `null` limpa (volta à regra da loja), campo ausente não
// muda. A tela mandava o corpo inteiro `null` quando os dois campos estavam
// em branco (400 "Nenhum campo de termo fornecido") e, com um campo só
// preenchido, nem mandava o outro — o override antigo ficava preso (caso
// "Caio Alexander": 3 parcelas e 2% sem jeito de limpar pela tela).
// Agora os dois campos vão sempre: em branco = null.
// ============================================================

export type CorpoDasRegras = { max_installments: number | null; interest_rate: number | null };

export function corpoDasRegras(maxParcelas: string, jurosAoMes: string): CorpoDasRegras {
  const max = maxParcelas.trim() ? parseInt(maxParcelas, 10) : NaN;
  const juros = jurosAoMes.trim() ? parseFloat(jurosAoMes.replace(",", ".")) : NaN;
  return {
    max_installments: isFinite(max) && max > 0 ? max : null,
    interest_rate: isFinite(juros) && juros >= 0 ? +(juros / 100).toFixed(6) : null,
  };
}

/** Mensagem do erro ao salvar, para a tela (não só um toast que some). */
export function erroAoSalvarRegras(err: any): string {
  const msg = err?.data?.error;
  return msg
    ? `Não foi possível salvar as regras: ${msg}`
    : "Não foi possível salvar as regras. Confira a conexão e tente de novo.";
}
