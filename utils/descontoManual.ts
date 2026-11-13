// ============================================================
// AURA. — Desconto manual do Caixa e da troca (12/11/2026)
//
// Relato de loja: "quando é colocado o valor do desconto manual, a soma não
// dá certo". O Caixa cortava o desconto em 50% sem avisar: R$ 80 numa peça
// de R$ 139,90 virava R$ 69,95 — e a loja passou a criar cupom de uso único
// com o valor do desconto para contornar.
//
// Decisão do Caio (12/11/2026):
//   · o desconto manual vai até 100% do total;
//   · acima de 50%, a tela pede confirmação ("Desconto de 80% (R$ 119,92).
//     Confirma?" — Confirmar desconto / Voltar), no ConfirmDialog;
//   · nunca cortar em silêncio: R$ maior que o total (ou % acima de 100) a
//     tela diz e limita ao total (100%).
//
// Arredondamento ao centavo ÚNICO, o mesmo do backend
// (aura-backend src/services/descontoManual.js): conta em centavos inteiros,
// meio centavo para CIMA, sem erro de ponto flutuante. R$ 10,05 − 10% =
// desconto R$ 1,01, total R$ 9,04 nos dois lados. Os testes dos dois
// repositórios usam a mesma tabela de casos.
//
// Tudo PURO (sem React): useCart, DiscountSection e a troca usam daqui.
// ============================================================

/** Até aqui o desconto vale direto; acima, pede confirmação. */
export const LIMITE_SEM_CONFIRMACAO_PCT = 50;

export type TipoDoDesconto = "%" | "R$";

/**
 * Valor em reais → centavos inteiros, meio centavo para cima.
 * toPrecision(15) desfaz o erro de representação (1.005 * 100 =
 * 100.49999999999999 → 100.5 → 101) sem mexer em valores já exatos.
 */
export function paraCentavos(valor: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const c = Number((Math.abs(n) * 100).toPrecision(15));
  const inteiro = Math.floor(c + 0.5);
  return n < 0 ? -inteiro : inteiro;
}

/** Arredonda ao centavo (meio centavo para cima). */
export function aoCentavo(valor: number): number {
  return paraCentavos(valor) / 100;
}

/**
 * Desconto em % sobre o subtotal, em reais, ao centavo. Conta inteira:
 * centavos × (pct com 4 casas) ÷ 1.000.000, meio para cima.
 */
export function descontoPercentual(subtotal: number, pct: number): number {
  const centavos = paraCentavos(subtotal);
  const p = Number(pct);
  if (!(centavos > 0) || !Number.isFinite(p) || p <= 0) return 0;
  const pctE4 = Math.round(Number((Math.min(p, 100) * 10000).toPrecision(15)));
  const produto = centavos * pctE4;
  const resto = produto % 1000000;
  const desconto = (produto - resto) / 1000000 + (resto >= 500000 ? 1 : 0);
  return desconto / 100;
}

/** Desconto em R$: ao centavo e nunca acima do subtotal (100%). */
export function descontoEmReais(subtotal: number, valor: number): number {
  const v = aoCentavo(valor);
  const teto = aoCentavo(Math.max(0, Number(subtotal) || 0));
  return Math.min(v, teto);
}

/**
 * O que a pessoa digitou no campo. Aceita "80", "80,5", "1.234,56" e
 * "1234.56". Vazio, inválido ou negativo = 0.
 */
export function lerDescontoDigitado(texto: string): number {
  let t = String(texto || "").trim().replace(/\s/g, "");
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type DescontoManual = {
  tipo: TipoDoDesconto;
  /** O número digitado (antes de qualquer limite). */
  digitado: number;
  /** Quanto sai do total, em R$, ao centavo. */
  valor: number;
  /** O percentual que vale: o digitado (em %), ou valor ÷ subtotal (em R$). */
  pct: number;
  /** Passou do total (R$) ou de 100% (%): a tela diz e vale o total. */
  limitadoAoTotal: boolean;
  /** Acima de 50%: só vale na venda depois de confirmado. */
  precisaConfirmar: boolean;
  /** Identidade do que foi confirmado: em %, o percentual; em R$, o valor. */
  chave: string;
  /** Campos do POST /pdv/sale (vazio sem desconto). */
  campos: { discount_type?: "percent" | "fixed"; discount_value?: number };
};

/**
 * A regra inteira do desconto manual sobre um subtotal: o valor ao centavo,
 * o limite visível no total e se precisa de confirmação.
 */
export function resolverDescontoManual(subtotal: number, tipo: TipoDoDesconto, texto: string): DescontoManual {
  const digitado = lerDescontoDigitado(texto);
  const base = Math.max(0, aoCentavo(subtotal));
  const vazio: DescontoManual = {
    tipo, digitado, valor: 0, pct: 0, limitadoAoTotal: false, precisaConfirmar: false, chave: "", campos: {},
  };
  if (!(digitado > 0) || !(base > 0)) return vazio;

  if (tipo === "%") {
    const pct = Math.min(digitado, 100);
    const valor = descontoPercentual(base, pct);
    return {
      tipo, digitado, valor, pct,
      limitadoAoTotal: digitado > 100,
      precisaConfirmar: pct > LIMITE_SEM_CONFIRMACAO_PCT,
      chave: "%|" + pct,
      campos: valor > 0 ? { discount_type: "percent", discount_value: pct } : {},
    };
  }

  const valor = descontoEmReais(base, digitado);
  const centavos = paraCentavos(valor);
  const centavosDaBase = paraCentavos(base);
  return {
    tipo, digitado, valor,
    pct: (centavos / centavosDaBase) * 100,
    limitadoAoTotal: paraCentavos(digitado) > centavosDaBase,
    precisaConfirmar: centavos * 100 > centavosDaBase * LIMITE_SEM_CONFIRMACAO_PCT,
    chave: "R$|" + centavos,
    campos: valor > 0 ? { discount_type: "fixed", discount_value: valor } : {},
  };
}

const brl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 80 → "80%"; 57,183 → "57,2%". */
export function textoDoPct(pct: number): string {
  const um = Math.round(pct * 10) / 10;
  return (Number.isInteger(um) ? String(um) : um.toFixed(1).replace(".", ",")) + "%";
}

/** "Desconto de 80% (R$ 119,92). Confirma?" */
export function mensagemDaConfirmacao(d: DescontoManual): string {
  return "Desconto de " + textoDoPct(d.pct) + " (" + brl(d.valor) + "). Confirma?";
}

/** O aviso visível quando o digitado passou do total. Null quando não passou. */
export function avisoDoLimite(d: DescontoManual): string | null {
  if (!d.limitadoAoTotal) return null;
  return d.tipo === "%"
    ? "O desconto vai até 100%. Ficou em 100% (" + brl(d.valor) + ")."
    : "O desconto passou do total. Ficou no total, " + brl(d.valor) + " (100%).";
}
