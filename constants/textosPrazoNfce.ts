// ============================================================
// AURA. — Textos do prazo de cancelamento da nota (17/11/2026)
// Card b-troca-prazo-nfce. Textos NOVOS de tela, separados para o Caio
// aprovar antes do merge (a lista está no PR).
//
// Regra que os textos contam: a NFC-e só pode ser cancelada até 30 minutos
// depois da autorização (SP, AP, RJ e MG — Ajuste SINIEF 19/2016 e a
// legislação de cada UF). Depois disso, o caminho é a NF-e de devolução,
// que a troca do Caixa já emite. Tom gentil, sempre com o caminho.
// ============================================================

/** Duração legível: 30 → "30 minutos"; 1440 → "24 horas". */
export function duracaoDoPrazo(minutos: number): string {
  if (minutos >= 60 && minutos % 60 === 0) {
    const h = minutos / 60;
    return h + (h === 1 ? " hora" : " horas");
  }
  return minutos + " minutos";
}

function hora(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export const TEXTOS_PRAZO_NFCE = {
  // ── Troca (Step 4, card fiscal) ─────────────────────────────
  // Antes: "Venda foi feita ha menos de 24h — cancelamos sem precisar emitir devolução".
  trocaCancelaSub: (minutos: number) =>
    "A NFC-e ainda está no prazo de cancelamento (" + duracaoDoPrazo(minutos) + " depois da autorização). Cancelamos sem precisar emitir devolução.",
  // Antes: "Vendas recentes serão canceladas; antigas terão NF-e de devolução".
  trocaMistaSub: "As vendas no prazo de cancelamento da NFC-e serão canceladas; as outras terão NF-e de devolução.",
  // FiscalBadge (componente fora de uso, alinhado para não guardar a regra antiga).
  badgeCancelaDesc: "A NFC-e original está no prazo de cancelamento da SEFAZ. Ela é cancelada e o cliente leva um cupom só.",
  badgeDevolucaoDesc: "A NFC-e original passou do prazo de cancelamento da SEFAZ. A troca emite a NF-e de devolução.",

  // ── Cancelar venda (confirmação no detalhe da venda) ────────
  cancelarNotaTitulo: (rotulo: string, numero: number | null) =>
    "Cancelar também a " + rotulo + (numero ? " nº " + numero : "") + "?",
  cancelarNotaDentro: (rotulo: string, ate: string | null) =>
    "A " + rotulo + " ainda pode ser cancelada na SEFAZ" + (ate ? " até " + hora(ate) : "") + ". Se marcar, ela é cancelada junto com a venda.",
  cancelarNotaOpcao: "Cancelar a nota junto",
  notaForaDoPrazoTitulo: (rotulo: string, numero: number | null) =>
    "A " + rotulo + (numero ? " nº " + numero : "") + " continua valendo",
  notaForaDoPrazo: (rotulo: string, minutos: number) =>
    "Ela já passou do prazo de cancelamento (" + duracaoDoPrazo(minutos) + " depois da autorização). Se o produto voltou para a loja, faça a devolução pelo Caixa: a NF-e de devolução sai junto, e o estoque e o Financeiro se acertam.",
  irParaDevolucao: "Fazer a devolução no Caixa",
  botaoCancelarVendaENota: "Sim, cancelar venda e nota",
  botaoCancelarSoVenda: "Sim, cancelar só a venda",
} as const;
