// ============================================================
// AURA STUDIO · vitrine — capa do produto quando não há foto
//
// O piso de qualidade: "o cliente pode dar um slack no conteúdo, mas a
// loja dele ainda assim vai ser bonita."
//
// Hoje um produto sem foto cai no preview de personalização vazio — um
// retângulo tracejado escrito "28×35cm". Isso é informação de produção,
// não de vitrine: o cliente não sabe o que é e a grade fica furada. Na
// conta de teste são 9 de 30 produtos assim; na Sheid, a maioria.
//
// A resposta é uma capa COMPOSTA: iniciais do produto sobre um tom
// derivado da cor da loja. Nunca um vazio, nunca um ícone genérico.
// ============================================================

/** Palavras que não carregam identidade e não entram nas iniciais. */
const VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "e", "com", "sem", "para", "por",
  "em", "no", "na", "nos", "nas", "a", "o", "as", "os", "um", "uma",
]);

/**
 * Iniciais do produto, no máximo duas.
 *
 * Pula números e palavras vazias: "KIT 3 PARES MEIA CANO LONGO" vira KP,
 * não K3. O nome do produto do lojista é bagunçado por natureza — vem em
 * CAIXA ALTA, com medida no meio, com código no fim.
 */
export function iniciais(nome: string): string {
  const limpo = String(nome || "").trim();
  if (!limpo) return "?";

  const palavras = limpo
    .split(/[\s\-_/·,.]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    // Só entra palavra que COMEÇA com letra: descarta "3", "300g", "20x30cm".
    .filter((p) => /^\p{L}/u.test(p))
    .filter((p) => !VAZIAS.has(p.toLowerCase()));

  if (palavras.length === 0) {
    const primeira = limpo.match(/\p{L}/u);
    return primeira ? primeira[0].toUpperCase() : "?";
  }

  const letras = palavras.slice(0, 2).map((p) => p[0].toUpperCase());
  return letras.join("");
}

/**
 * Intensidade do tom da capa, derivada do nome.
 *
 * Uma grade inteira de capas idênticas parece erro de carregamento. Aqui
 * cada produto ganha um degrau de intensidade — sempre dentro da cor da
 * loja, então a prateleira varia sem deixar de ser dela.
 *
 * Determinístico de propósito: o mesmo produto tem sempre a mesma capa,
 * senão ela mudaria a cada render e o cliente veria a loja piscando.
 */
const DEGRAUS = [0.07, 0.1, 0.13, 0.16, 0.19] as const;

export function degrauDaCapa(nome: string): number {
  const s = String(nome || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return DEGRAUS[hash % DEGRAUS.length];
}

/**
 * Corta descrição longa sem deixar reticências órfãs no meio de palavra.
 *
 * O outro lado do slack: descrição que o lojista colou de um marketplace
 * e tem 400 caracteres estoura o cartão.
 */
export function resumo(texto: string | null | undefined, max = 90): string | null {
  const s = String(texto || "").trim();
  if (!s) return null;
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return (ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd() + "…";
}
