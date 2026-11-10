// ============================================================
// AURA. — Em que nota o item sai: NFC-e ou NFS-e (10/11/2026)
//
// Espelho de src/services/notaDoItem.js do backend (migration 442).
// Até aqui "vai para a NFS-e" era sinônimo de unit "srv" (Serviço). Decisão
// do dono: a NOTA é separada do TIPO do item. Uma gráfica vende carimbo sob
// encomenda: é ISS (NFS-e), mas a mecânica do carimbo é peça que precisa de
// estoque. Campo do item, "Sai em":
//   "nfse" → nota de serviço; "nfce" → cupom fiscal;
//   null   → segue o tipo, como sempre foi (serviço na NFS-e, produto na NFC-e).
//
// UM predicado só no app para decidir a nota. Quem decide a nota pelo
// `unit === "srv"` direto está errado — use vaiNaNfse/vaiNaNfce.
// O estoque NÃO passa por aqui: continua pelo tipo do item.
// ============================================================

export type NotaFiscal = "nfce" | "nfse";

/** Aceita o item do app (notaFiscal) e o do backend (nota_fiscal). */
export type ItemComNota = {
  unit?: string | null;
  notaFiscal?: NotaFiscal | string | null;
  nota_fiscal?: NotaFiscal | string | null;
} | null | undefined;

export function ehUnidadeServico(unit: string | null | undefined): boolean {
  return String(unit == null ? "" : unit).trim().toLowerCase() === "srv";
}

/** "nfce" | "nfse" | null — qualquer outro valor conta como não escolhido. */
export function notaEscolhida(item: ItemComNota): NotaFiscal | null {
  if (!item) return null;
  const v = item.notaFiscal !== undefined ? item.notaFiscal : item.nota_fiscal;
  return v === "nfce" || v === "nfse" ? v : null;
}

/** O item sai na NFS-e: escolheu NFS-e, ou não escolheu e é serviço (unit "srv"). */
export function vaiNaNfse(item: ItemComNota): boolean {
  const nota = notaEscolhida(item);
  if (nota) return nota === "nfse";
  return ehUnidadeServico(item ? item.unit : null);
}

/** O inverso: o item sai na NFC-e (cupom fiscal). */
export function vaiNaNfce(item: ItemComNota): boolean {
  return !vaiNaNfse(item);
}

/** A nota padrão de um tipo: serviço na NFS-e, produto na NFC-e. */
export function notaPadraoDoTipo(unit: string | null | undefined): NotaFiscal {
  return ehUnidadeServico(unit) ? "nfse" : "nfce";
}

/** Normaliza o que vem do backend: só "nfce"/"nfse"; o resto vira null. */
export function lerNotaFiscal(v: unknown): NotaFiscal | null {
  return v === "nfce" || v === "nfse" ? v : null;
}

/**
 * O que o cadastro grava: a escolha igual ao padrão do tipo vira null
 * (continua seguindo o tipo); só a escolha diferente fica guardada.
 */
export function gravacaoDaNota(escolha: NotaFiscal, unit: string | null | undefined): NotaFiscal | null {
  return escolha === notaPadraoDoTipo(unit) ? null : escolha;
}

export const ROTULO_NOTA: Record<NotaFiscal, string> = {
  nfce: "Cupom fiscal (NFC-e)",
  nfse: "Nota de serviço (NFS-e)",
};

export const AJUDA_SAI_EM =
  "Use Nota de serviço para trabalho sob encomenda que você também controla no estoque, como carimbo ou impressão personalizada.";
