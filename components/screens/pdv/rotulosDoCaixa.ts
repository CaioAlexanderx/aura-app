// ============================================================
// AURA. — Caixa: textos da tela na língua do lojista (QA 23/09/2026).
//
// Funções PURAS (sem React) — é o que os testes cobrem. Nada de chave
// interna ("CARTAO", "SPLIT"), sigla técnica ou inglês na tela.
// ============================================================
import { fmtReais } from "@/utils/precoNoCartao";

/** Nome de cada forma de pagamento como o lojista fala. */
export const NOME_DO_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  cartao: "Crédito",
  crediario: "Crediário",
};

export function nomeDoPagamento(key: string | null | undefined): string {
  const k = String(key || "");
  return NOME_DO_PAGAMENTO[k] || k;
}

/**
 * O "Pagamento" do topo do carrinho: "Crédito", "PIX"… ou, no dividido,
 * "Dividido em 2" (conta só as linhas com valor).
 *
 * QA 23/09/2026 (Matcon): com UM pagamento só, "Dividido em 1" não diz
 * nada — o topo mostra o nome da forma ("PIX"). "Dividido em N" só a
 * partir de dois pagamentos com valor.
 */
export function rotuloDoPagamento(
  activePay: string,
  dividido: boolean,
  pagamentos?: { value: number; method?: string }[] | null,
): string {
  if (!dividido) return nomeDoPagamento(activePay);
  const linhas = pagamentos || [];
  const comValor = linhas.filter((p) => (Number(p.value) || 0) > 0);
  if (comValor.length >= 2) return "Dividido em " + comValor.length;
  // Um pagamento com valor (ou uma linha só, ainda zerada): o nome dele.
  const unico = comValor.length === 1 ? comValor[0] : linhas.length === 1 ? linhas[0] : null;
  if (unico && unico.method) return nomeDoPagamento(unico.method);
  return "Dividido";
}

/**
 * Rótulo do lado "dinheiro" do par de totais (preço no cartão). Com o
 * Crediário escolhido o destaque cai nesse lado — então o rótulo diz que
 * vale para o crediário também.
 */
export function rotuloDoLadoDinheiro(activePay: string, dividido: boolean): string {
  return !dividido && activePay === "crediario" ? "Dinheiro, PIX ou crediário" : "Dinheiro ou PIX";
}

/** "Cupom 15OFF aplicado · −R$ 223,79" — sem "!", e sem valor quando ele
 *  ainda depende da forma de pagamento (dividido). */
export function fraseDoCupomAplicado(code: string, valor: number | null | undefined): string {
  return "Cupom " + code + " aplicado" + (valor != null && valor > 0 ? " · −" + fmtReais(valor) : "");
}
