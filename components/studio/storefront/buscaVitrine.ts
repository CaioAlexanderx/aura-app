// ============================================================
// AURA STUDIO · vitrine — busca
//
// A vitrine não tinha busca. Com 3 produtos dá pra rolar; com os 30 da
// loja modelo, ou os 74 da Sheid, não dá.
//
// A busca precisa aguentar duas bagunças que são a norma, não a exceção:
//
//   ACENTO — o cliente digita "camiseta polo", o produto se chama
//   "Camiseta Polo Marinho", e a Sheid tem "Xicara" sem acento no
//   cadastro e "Xícara" na cabeça de quem procura.
//
//   CAIXA E RUÍDO — metade dos nomes vem em CAIXA ALTA com medida e
//   código no meio ("CALCA JEANS MASCULINA SLIM FIT 38x32 AZUL ESCURO").
//   Quem procura "calça jeans" tem que achar.
// ============================================================

/** Tira acento, caixa e espaço repetido — a forma comparável do texto. */
export function normalizar(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Casa quando TODOS os termos aparecem em algum lugar do texto.
 *
 * Por termo, e não pela frase inteira, porque o cliente digita na ordem
 * dele: "jeans calça" acha "CALCA JEANS MASCULINA". Exigir a frase exata
 * transformaria a busca numa loteria de ordem de palavra.
 */
export function casa(busca: string, ...campos: unknown[]): boolean {
  const termos = normalizar(busca).split(" ").filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = campos.map(normalizar).filter(Boolean).join(" ");
  return termos.every((t) => alvo.includes(t));
}
