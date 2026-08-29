// ============================================================
// plural — concordância de plural em português (helper global)
//
// 29/08/2026 — Nasceu do QA do PDV ("1 produtos" na tela de venda
// concluída). Já existia um `pluralize(n, singular, plural?)` em
// components/admin/crm/shared/helpers.ts, mas enterrado no módulo de
// CRM admin — lugar errado pra um helper de idioma que o app inteiro
// precisa. Este arquivo SUBSTITUI aquele: mesma assinatura e mesmo
// comportamento, pra que as chamadas do CRM possam migrar pra cá
// depois sem nenhuma alteração no call site.
//
// Uso:
//   pluralize(1, "produto")            → "1 produto"
//   pluralize(3, "produto")            → "3 produtos"
//   pluralize(2, "item")               → "2 itens"
//   pluralize(2, "pessoa", "pessoas")  → "2 pessoas"   (plural explícito)
// ============================================================

/**
 * Plurais irregulares — só o que o app realmente usa. Para qualquer
 * outro caso fora das regras abaixo, passe o plural explícito.
 */
const IRREGULARES: Record<string, string> = {
  mês: "meses",
  mao: "maos",
  mão: "mãos",
  pão: "pães",
  cidadão: "cidadãos",
  alemão: "alemães",
  // invariáveis
  lápis: "lápis",
  ônibus: "ônibus",
};

/** Plural de uma palavra em português (sem o número na frente). */
export function pluralOf(singular: string): string {
  const w = singular.trim();
  if (!w) return singular;

  const lower = w.toLowerCase();
  if (IRREGULARES[lower]) {
    // Preserva capitalização inicial da palavra original.
    const p = IRREGULARES[lower];
    return w[0] === w[0].toUpperCase() ? p.charAt(0).toUpperCase() + p.slice(1) : p;
  }

  // -m → -ns  (item → itens, cupom → cupons, comum → comuns)
  if (/m$/i.test(w)) return w.slice(0, -1) + "ns";

  // -ês → -eses (mês já é irregular; português → portugueses)
  if (/ês$/i.test(w)) return w.slice(0, -2) + "eses";

  // -ão → -ões (opção → opções, devolução → devoluções) — a forma mais
  // comum; os desvios (pão, mão, cidadão) estão em IRREGULARES.
  if (/ão$/i.test(w)) return w.slice(0, -2) + "ões";

  // -al/-el/-ol/-ul → -ais/-éis/-óis/-uis (real → reais, papel → papéis)
  if (/al$/i.test(w)) return w.slice(0, -2) + "ais";
  if (/el$/i.test(w)) return w.slice(0, -2) + "éis";
  if (/ol$/i.test(w)) return w.slice(0, -2) + "óis";
  if (/ul$/i.test(w)) return w.slice(0, -2) + "uis";
  // -il → -is (perfil → perfis)
  if (/il$/i.test(w)) return w.slice(0, -2) + "is";

  // -r / -z → -es (sabor → sabores, aprendiz → aprendizes)
  if (/[rz]$/i.test(w)) return w + "es";

  // -s: sem acento a palavra costuma ser invariável (lápis, ônibus);
  // os casos acentuados relevantes estão em IRREGULARES.
  if (/s$/i.test(w)) return w;

  return w + "s";
}

/**
 * Número + substantivo com concordância.
 * Mesma assinatura do pluralize do CRM (n, singular, plural?) — o
 * terceiro parâmetro vence qualquer regra, use-o pra irregular novo.
 */
export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural || pluralOf(singular)}`;
}

export default pluralize;
