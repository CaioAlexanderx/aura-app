// ============================================================
// AURA. — Textos do "Trocar por NF-e" (17/11/2026)
// Card "Trocar por NF-e", aprovado pelo Caio em 17/11. Textos NOVOS de
// tela, separados para o Caio aprovar antes do merge (a lista está no PR).
//
// O que eles contam: dentro do prazo de cancelamento da NFC-e, a loja
// cancela a NFC-e e emite a NF-e da mesma venda no lugar. Fora do prazo não
// há caminho pela Aura (duas notas contariam a mesma mercadoria duas vezes).
// Tom gentil, sem culpa; nada de "erro" ou "expirado" para a lojista.
// ============================================================

function numero(n: number | null | undefined): string {
  return n ? " nº " + n : "";
}

/** "15:51" no fuso de São Paulo. */
export function horaDoPrazo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export const TEXTOS_TROCAR_POR_NFE = {
  // Detalhe da venda, abaixo de "NFC-e nº X autorizada".
  botao: "Trocar por NF-e",
  dicaDoBotao: (ate: string | null | undefined) =>
    "Para cliente que precisa de NF-e (empresa / CNPJ)." + (horaDoPrazo(ate) ? " Dá para trocar até " + horaDoPrazo(ate) + "." : ""),

  // Fora do prazo: um link discreto que abre a explicação.
  foraDoPrazoLink: "Precisa de NF-e no lugar da NFC-e?",
  foraDoPrazo: (n: number | null | undefined) =>
    "A NFC-e" + numero(n) + " já passou do prazo de cancelamento do estado: a SEFAZ só aceita cancelar a NFC-e logo depois da autorização. "
    + "Por isso a NF-e não pode ser emitida para esta venda pela Aura. Seriam duas notas para a mesma mercadoria.",

  // Confirmação (janela por cima do detalhe da venda).
  confirmarTitulo: "Trocar a NFC-e pela NF-e?",
  confirmarTexto: (n: number | null | undefined) =>
    "A NFC-e" + numero(n) + " será cancelada e você vai emitir a NF-e no lugar.",
  confirmarDetalhe:
    "O cancelamento vai para a SEFAZ e não tem volta. Assim que ele for aceito, o assistente da NF-e abre para você conferir os dados do cliente e emitir. "
    + "Se fechar o assistente antes de emitir, a venda fica sem nota até você emitir no detalhe da venda.",
  motivoRotulo: "Motivo do cancelamento (vai para a SEFAZ)",
  // Vai como justificativa do evento 110111 (15 a 255 letras).
  motivoPadrao: "Cliente pediu NF-e no lugar da NFC-e",
  motivoDica: "Pelo menos 15 letras. Regra da SEFAZ.",
  motivoCurto: "A SEFAZ pede um motivo com pelo menos 15 letras.",
  manter: "Manter a NFC-e",
  confirmar: "Cancelar a NFC-e e emitir a NF-e",

  // Resultado.
  cancelada: (n: number | null | undefined) => "NFC-e" + numero(n) + " cancelada. Agora é só emitir a NF-e.",
  recusada: (motivo: string) =>
    "A NFC-e não foi cancelada, então a NF-e não foi aberta. Ela continua autorizada. Motivo: " + motivo,
  recusadaSemMotivo: "Não deu para cancelar a NFC-e agora. Ela continua autorizada. Tente de novo em instantes.",
} as const;
