// ============================================================
// AURA. -- Ordem de tamanhos e de variantes (p-35, 18/10/2026)
// Funções puras, sem React. Usadas pelo seletor "Qual variante?" do Caixa
// (VariantPickerModal) e pelo cadastro de tamanhos (SecaoEstoque).
//
// Ordem do tamanho:
//   1. letras: PP, P, M, G, GG, XG, depois XXG / XGG / EG / EGG
//   2. números (36, 38, 40; aceita decimal "1,5"), em ordem numérica
//   3. o resto (U, Único, G1, 33/34, 10 anos, 500ml...), em ordem alfabética
//      natural ("2 anos" antes de "10 anos"), sem diferenciar maiúscula/acento
// ============================================================

var LETRAS: Record<string, number> = {
  PP: 0, P: 1, M: 2, G: 3, GG: 4, XG: 5,
  XXG: 6, XGG: 6, EG: 6, EGG: 6,
};

var colador: { compare: (a: string, b: string) => number } | null = null;
function compararTexto(a: string, b: string): number {
  if (!colador) {
    try {
      colador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
    } catch {
      colador = { compare: function(x: string, y: string) { return x.localeCompare(y); } };
    }
  }
  return colador.compare(a, b);
}

/** Compara dois textos em pt-BR, sem diferenciar maiúscula nem acento. */
export function compararTextoPtBr(a: string, b: string): number {
  return compararTexto(String(a || ""), String(b || ""));
}

type Chave = { grupo: number; num: number; texto: string };

function chaveDoTamanho(t: string): Chave {
  var limpo = String(t == null ? "" : t).trim();
  var maiusc = limpo.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(LETRAS, maiusc)) {
    return { grupo: 0, num: LETRAS[maiusc], texto: maiusc };
  }
  if (/^\d+([.,]\d+)?$/.test(limpo)) {
    return { grupo: 1, num: parseFloat(limpo.replace(",", ".")), texto: limpo };
  }
  return { grupo: 2, num: 0, texto: limpo };
}

/** Comparador de tamanhos para Array.prototype.sort. */
export function compararTamanhos(a: string, b: string): number {
  var ka = chaveDoTamanho(a);
  var kb = chaveDoTamanho(b);
  if (ka.grupo !== kb.grupo) return ka.grupo - kb.grupo;
  if (ka.num !== kb.num) return ka.num - kb.num;
  return compararTexto(ka.texto, kb.texto);
}

/** Devolve uma cópia da lista em ordem de tamanho. Não altera a original. */
export function ordenarTamanhos(lista: string[]): string[] {
  return estavel(lista || [], compararTamanhos);
}

/** O que a ordem de uma variante leva em conta. null = a variante não tem. */
export type ChaveDeVariante = { cor: string | null; tamanho: string | null };

/**
 * Ordena variantes por cor (alfabética, pt-BR, sem acento) e depois por
 * tamanho. Variante sem cor vem depois das que têm; sem tamanho, depois das
 * que têm. Empate mantém a ordem original (sort estável). Devolve cópia.
 */
export function ordenarVariantes<T>(lista: T[], chave: (v: T) => ChaveDeVariante): T[] {
  var chaves = new Map<T, ChaveDeVariante>();
  (lista || []).forEach(function(v) { chaves.set(v, chave(v)); });
  return estavel(lista || [], function(a, b) {
    var ka = chaves.get(a)!;
    var kb = chaves.get(b)!;
    var c = compararOpcional(ka.cor, kb.cor, compararTexto);
    if (c !== 0) return c;
    return compararOpcional(ka.tamanho, kb.tamanho, compararTamanhos);
  });
}

function compararOpcional(a: string | null, b: string | null, cmp: (x: string, y: string) => number): number {
  var ta = a == null ? "" : String(a).trim();
  var tb = b == null ? "" : String(b).trim();
  if (!ta && !tb) return 0;
  if (!ta) return 1;
  if (!tb) return -1;
  return cmp(ta, tb);
}

// Array.prototype.sort é estável nos motores atuais, mas o índice como
// desempate garante a ordem original em qualquer um.
function estavel<T>(lista: T[], cmp: (a: T, b: T) => number): T[] {
  return lista
    .map(function(v, i) { return { v: v, i: i }; })
    .sort(function(a, b) { return cmp(a.v, b.v) || a.i - b.i; })
    .map(function(x) { return x.v; });
}
