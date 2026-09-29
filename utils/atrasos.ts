// ============================================================
// Atrasos clicáveis no Financeiro (contas F4 · 29/09/2026)
//
// Pedido do Caio: "Cobre R$ X em atraso" e a faixa "Atrasadas" eram vagos e
// levavam só para a aba Lançamentos. O atraso tem duas moradas: parcelas do
// crediário (tela do Crediário, já filtrada em "em atraso") e contas comuns
// (Quadro do Financeiro, coluna Atrasado). O backend separa as duas partes
// (insights: biggest_lever.split e timeline.atrasadas.crediario); aqui ficam
// o texto e para onde cada parte leva.
// ============================================================

export type Parte = { amount: number; count: number };
export type PartesDoAtraso = { crediario: Parte; contas: Parte };
export type DestinoDoAtraso = "crediario" | "contas";

/** Divide o atraso. Sem a divisão do backend (versão antiga), tudo conta como "contas". */
export function partesDoAtraso(
  total: { amount: number; count: number },
  split?: { crediario?: Partial<Parte> | null; contas?: Partial<Parte> | null } | null,
): PartesDoAtraso {
  const cred = split && split.crediario ? { amount: Number(split.crediario.amount) || 0, count: Number(split.crediario.count) || 0 } : { amount: 0, count: 0 };
  const contas = split && split.contas
    ? { amount: Number(split.contas.amount) || 0, count: Number(split.contas.count) || 0 }
    : { amount: Math.max(0, total.amount - cred.amount), count: Math.max(0, total.count - cred.count) };
  return { crediario: cred, contas };
}

/** Parte da faixa "Atrasadas" da timeline (total + crediário dentro dela). */
export function partesDaFaixa(b: { total: number; count: number; crediario?: { total: number; count: number } | null }): PartesDoAtraso {
  const c = b.crediario || { total: 0, count: 0 };
  return partesDoAtraso({ amount: b.total, count: b.count }, {
    crediario: { amount: c.total, count: c.count },
    contas: { amount: Math.max(0, b.total - c.total), count: Math.max(0, b.count - c.count) },
  });
}

/** Onde tocar na linha leva: a parte de maior valor. */
export function destinoPrincipal(p: PartesDoAtraso): DestinoDoAtraso {
  return p.crediario.amount > p.contas.amount ? "crediario" : "contas";
}

function plural(n: number, um: string, varios: string) { return n + " " + (n === 1 ? um : varios); }

/**
 * "R$ 480,00 em 3 parcelas do crediário · R$ 200,00 em 2 contas a receber.
 *  A mais antiga está há 12 dias."
 */
export function detalheDoAtraso(p: PartesDoAtraso, fmt: (n: number) => string, extra?: { oldestDays?: number | null; rotuloCrediario?: string; rotuloContas?: string }): string {
  const partes: string[] = [];
  if (p.crediario.count > 0) partes.push(fmt(p.crediario.amount) + " em " + plural(p.crediario.count, "parcela", "parcelas") + " " + (extra?.rotuloCrediario || "do crediário"));
  if (p.contas.count > 0) partes.push(fmt(p.contas.amount) + " em " + plural(p.contas.count, "conta", "contas") + " " + (extra?.rotuloContas || "a receber"));
  let texto = partes.join(" · ");
  if (texto) texto += ".";
  const d = extra?.oldestDays;
  if (d != null && d > 0) texto += (texto ? " " : "") + "A mais antiga está há " + plural(d, "dia", "dias") + ".";
  return texto;
}
