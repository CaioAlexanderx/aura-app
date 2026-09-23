// ============================================================
// AURA. — Preço no cartão (22/09/2026)
// Mockup aprovado: docs/mockups/preco-no-cartao.html (+ .md).
//
// A loja pode cobrar um preço no dinheiro/PIX/crediário e outro no cartão
// (débito e crédito). Opção da loja em Políticas do Caixa
// (pdv_settings.card_price_enabled + card_price_pct); o produto pode ter o
// próprio preço no cartão (products.card_price, null = segue o %).
//
// Tudo aqui é PURO (sem React, sem API) — é o que os testes cobrem e o que
// o Caixa, o cadastro, a etiqueta e o orçamento usam. Com a opção
// desligada, lerConfigDoCartao devolve { enabled: false } e nenhuma tela
// chama o resto: a Aura de hoje, sem campo, linha ou texto novo.
//
// Decisões do Caio (fechadas em 22/09/2026):
//   · débito e crédito pagam o preço no cartão; dinheiro, PIX e
//     crediário, o preço de sempre (crediário tem juros próprios);
//   · o automático é preço × (1 + %) arredondado PARA CIMA nos 10
//     centavos (42,18 → 42,20);
//   · variante com preço próprio: preço da variante × (card_price do pai ÷
//     preço do pai) quando o pai tem card_price, senão o % da loja — mesmo
//     arredondamento;
//   · pagamento dividido: base = total no dinheiro; fator = total no
//     cartão ÷ total no dinheiro DESTA venda; dinheiro/PIX/crediário abatem
//     da base pelo valor, cartão abate valor ÷ fator; a última linha é "o
//     que falta". O acréscimo da parte no cartão é rateado no preço de cada
//     item, com o resíduo de centavos na última linha, e a soma das linhas
//     fecha com a soma dos pagamentos.
// ============================================================

/** Chaves do Caixa que pagam o preço no cartão. */
export const METODOS_NO_CARTAO = ["cartao", "debito"];

export function ehCartao(method: string | null | undefined): boolean {
  return method === "cartao" || method === "debito";
}

export type ConfigDoCartao = { enabled: boolean; pct: number };

export const CARTAO_DESLIGADO: ConfigDoCartao = { enabled: false, pct: 0 };

/** Lê as duas chaves do pdv_settings. Qualquer coisa diferente de
 *  `card_price_enabled === true` é desligado. % null/lixo vira 0. */
export function lerConfigDoCartao(
  s: { card_price_enabled?: boolean | null; card_price_pct?: number | null } | null | undefined,
): ConfigDoCartao {
  if (!s || s.card_price_enabled !== true) return CARTAO_DESLIGADO;
  const bruto = s.card_price_pct;
  const n = Number(bruto);
  const pct = bruto == null || !isFinite(n) ? 0 : Math.min(100, Math.max(0, n));
  return { enabled: true, pct };
}

export function r2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** 42,18 → 42,20 · 42,20 → 42,20. Arredonda no centavo antes, pra
 *  111,00000000000001 (100 × 1,11 em ponto flutuante) não virar 111,10. */
export function paraCimaNos10Centavos(v: number): number {
  const centavos = Math.round((Number(v) || 0) * 100);
  return (Math.ceil(centavos / 10) * 10) / 100;
}

/** Preço no cartão que nasce do % da loja. % zero = o mesmo preço. */
export function precoNoCartaoAutomatico(preco: number, pct: number): number {
  const p = Number(preco) || 0;
  if (p <= 0) return 0;
  if (!(pct > 0)) return r2(p);
  return paraCimaNos10Centavos(p * (1 + pct / 100));
}

/** O que o produto do catálogo diz: preço e (talvez) o preço no cartão
 *  ajustado à mão. `cardPrice` null/0/undefined = segue o %. */
export type RefDoProduto = { price: number; cardPrice?: number | null };

/** Preço no cartão do produto como está no cadastro (null = opção desligada). */
export function precoNoCartaoDoProduto(p: RefDoProduto, cfg: ConfigDoCartao): number | null {
  if (!cfg.enabled) return null;
  if (p.cardPrice != null && p.cardPrice > 0) return r2(p.cardPrice);
  return precoNoCartaoAutomatico(p.price, cfg.pct);
}

/**
 * Preço no cartão de um item cujo preço no dinheiro pode ser DIFERENTE do
 * cadastro — variante com preço próprio, ou linha de orçamento salvo.
 * Mesmo preço do cadastro → o card_price do produto (ou o automático).
 * Preço diferente e o pai tem card_price → mesma proporção do pai,
 * arredondada para cima nos 10 centavos. Sem card_price → o % da loja.
 */
export function precoNoCartaoDoItem(
  precoDinheiro: number,
  ref: RefDoProduto | null | undefined,
  cfg: ConfigDoCartao,
): number | null {
  if (!cfg.enabled) return null;
  const d = Number(precoDinheiro) || 0;
  const temManual = !!ref && ref.cardPrice != null && ref.cardPrice > 0 && ref.price > 0;
  if (temManual) {
    if (Math.abs(d - ref!.price) < 0.005) return r2(ref!.cardPrice as number);
    return paraCimaNos10Centavos((d * (ref!.cardPrice as number)) / ref!.price);
  }
  return precoNoCartaoAutomatico(d, cfg.pct);
}

/** % a mais que o cartão cobra sobre o dinheiro, com 1 casa (15,5). */
export function percentualReal(dinheiro: number, cartao: number): number | null {
  if (!(dinheiro > 0)) return null;
  return Math.round((cartao / dinheiro - 1) * 1000) / 10;
}

/** "11" · "15,5" · "-3" — sem ",0" no fim. */
export function fmtPct(n: number): string {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return String(v).replace(".", ",");
}

/** "R$ 1.066,00" — o mesmo formato do papel e do Caixa. */
export function fmtReais(n: number): string {
  const v = r2(n);
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  return (neg ? "− " : "") + "R$ " + int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

// ── Linhas da venda ────────────────────────────────────────────

/** Um item do carrinho visto pelos dois preços (efetivo e de tabela). */
export type PrecosDaLinha = {
  qty: number;
  cash: number;
  cashList?: number;
  card: number;
  cardList?: number;
};

/** O que vai em `items[]` do POST /pdv/sale (e o total da linha como o
 *  backend calcula). */
export type LinhaDoPayload = {
  unit_price: number;
  item_discount?: number;
  totalDaLinha: number;
};

/**
 * A regra de sempre do lápis do Caixa (useCart): unit_price é o preço de
 * tabela e a diferença para o preço cobrado vai em item_discount (total da
 * linha). totalDaLinha espelha o backend (pdv.js): bruto no centavo menos o
 * desconto do item.
 */
export function linhaNoPreco(qty: number, preco: number, lista?: number | null): LinhaDoPayload {
  const listPrice = lista != null && lista > 0 ? lista : preco;
  const unit = Math.max(listPrice, preco);
  const desconto = r2(Math.max(0, unit - preco) * qty);
  return fecharLinha(qty, unit, desconto);
}

function fecharLinha(qty: number, unit: number, desconto: number): LinhaDoPayload {
  const bruto = parseFloat((qty * unit).toFixed(2));
  const d = Math.min(Math.max(desconto, 0), bruto);
  return {
    unit_price: unit,
    item_discount: desconto > 0 ? desconto : undefined,
    totalDaLinha: parseFloat((bruto - d).toFixed(2)),
  };
}

export type RegraDoCupom = { tipo: "percent" | "fixed"; valor: number };

export type DescontosDaVenda = {
  cupom?: RegraDoCupom | null;
  /** discount_pct do POST (desconto manual em %). */
  manualPct?: number;
  /** discount_amount do POST (desconto manual em R$). Vence o %. */
  manualValor?: number;
};

/** Quanto o cupom tira de um subtotal — a mesma conta do POST /pdv/sale
 *  (% arredondado no centavo; valor fixo com teto no subtotal). */
export function descontoDoCupom(cupom: RegraDoCupom | null | undefined, subtotal: number): number {
  if (!cupom) return 0;
  return cupom.tipo === "percent"
    ? Math.round(((subtotal * cupom.valor) / 100) * 100) / 100
    : Math.min(cupom.valor, subtotal);
}

/** Espelho do cálculo do POST /pdv/sale (aura-backend src/routes/pdv.js):
 *  cupom e desconto manual somam, com teto no subtotal. */
export function totalComoNoServidor(linhas: { totalDaLinha: number }[], d: DescontosDaVenda) {
  let subtotal = 0;
  for (const l of linhas) subtotal += l.totalDaLinha;
  const cupom = descontoDoCupom(d.cupom, subtotal);
  let manual = 0;
  if (d.manualValor && d.manualValor > 0) manual = d.manualValor;
  else if (d.manualPct && d.manualPct > 0) manual = parseFloat(((subtotal * d.manualPct) / 100).toFixed(2));
  const desconto = Math.min(parseFloat((cupom + manual).toFixed(2)), subtotal);
  const total = parseFloat((subtotal - desconto).toFixed(2));
  return { subtotal: r2(subtotal), cupom, manual, desconto, total: Math.max(0, total) };
}

/** A conta da venda como a tela final mostra: subtotal − desconto = total. */
export type ContaDaVenda = { subtotal: number; cupom: number; manual: number; desconto: number; total: number };

/**
 * Tela final da venda (QA 23/09/2026): o que vale é o que o POST /pdv/sale
 * gravou — `sale.total_amount` e `sale.discount_amount` (cupom + manual,
 * recalculados pelo servidor sobre o subtotal das linhas enviadas). Com os
 * dois, o subtotal é total + desconto e o manual (que o servidor não devolve
 * separado) sai da conta local; o resto do desconto é o cupom. Sem eles
 * (venda offline/demo, ambiente antigo), fica a conta local.
 */
export function contaComOServidor(
  local: ContaDaVenda,
  venda: { total_amount?: unknown; discount_amount?: unknown } | null | undefined,
): ContaDaVenda {
  const total = parseFloat(venda?.total_amount as any);
  const desconto = parseFloat(venda?.discount_amount as any);
  if (!isFinite(total) || !isFinite(desconto)) return local;
  const manual = r2(Math.min(Math.max(0, local.manual), desconto));
  return {
    subtotal: r2(total + desconto),
    cupom: r2(desconto - manual),
    manual,
    desconto: r2(desconto),
    total: r2(total),
  };
}

export function linhasNoMetodo(linhas: PrecosDaLinha[], noCartao: boolean): LinhaDoPayload[] {
  return linhas.map((l) => noCartao
    ? linhaNoPreco(l.qty, l.card, l.cardList ?? l.card)
    : linhaNoPreco(l.qty, l.cash, l.cashList ?? l.cash));
}

/**
 * Venda dividida: o acréscimo da parte paga no cartão entra no preço de
 * cada item, na mesma fração da base paga no cartão. `alvo` é a soma dos
 * pagamentos. A última linha absorve o resíduo de centavos, de modo que o
 * total que o backend calcula (e a NFC-e confere) seja exatamente `alvo`.
 * Tudo num método só devolve exatamente as linhas daquele método.
 */
export function linhasRateadas(linhas: PrecosDaLinha[], alvo: number, d: DescontosDaVenda): LinhaDoPayload[] {
  const noDinheiro = linhasNoMetodo(linhas, false);
  const noCartao = linhasNoMetodo(linhas, true);
  if (linhas.length === 0) return noDinheiro;
  const C = totalComoNoServidor(noDinheiro, d).total;
  const K = totalComoNoServidor(noCartao, d).total;
  if (Math.abs(alvo - C) < 0.005) return noDinheiro;
  if (Math.abs(alvo - K) < 0.005) return noCartao;
  const fc = K !== C ? Math.min(1, Math.max(0, (alvo - C) / (K - C))) : 0;
  const out = linhas.map((l) => {
    const cl = l.cashList ?? l.cash;
    const kl = l.cardList ?? l.card;
    const preco = r2(l.cash + (l.card - l.cash) * fc);
    const lista = r2(cl + (kl - cl) * fc);
    return linhaNoPreco(l.qty, preco, lista);
  });
  return fecharNoCentavo(out, linhas[linhas.length - 1].qty, alvo, d);
}

/** Muda o bruto da última linha até o total do servidor bater com `alvo`. */
function fecharNoCentavo(out: LinhaDoPayload[], qtyUltima: number, alvo: number, d: DescontosDaVenda): LinhaDoPayload[] {
  const i = out.length - 1;
  if (!(qtyUltima > 0)) return out;
  for (let k = 0; k < 12; k++) {
    const t = totalComoNoServidor(out, d).total;
    const dif = Math.round((alvo - t) * 100);
    if (dif === 0) break;
    // Primeiro a diferença inteira; se o cupom em % fizer oscilar, vai de
    // centavo em centavo.
    const passo = k < 6 ? dif : Math.sign(dif);
    const linha = out[i];
    const bruto = parseFloat((qtyUltima * linha.unit_price).toFixed(2));
    const novoBruto = r2(bruto + passo / 100);
    if (novoBruto <= 0) break;
    out[i] = fecharLinha(qtyUltima, novoBruto / qtyUltima, linha.item_discount || 0);
  }
  return out;
}

// ── Pagamento dividido ─────────────────────────────────────────

export type EntradaDividida = { method: string; value: number; change?: number; auto?: boolean };

export type Dividido = {
  entradas: EntradaDividida[];
  /** total no cartão ÷ total no dinheiro desta venda. */
  fator: number;
  /** Soma dos pagamentos (o que o cliente paga). */
  total: number;
  /** Quanto da BASE (dinheiro) ainda falta. Negativo = sobrando. */
  falta: number;
  /** O mesmo "falta", se for pago no cartão. */
  faltaNoCartao: number;
  equilibrado: boolean;
};

/**
 * A regra do dividido (tela 4 do mockup). `base` = total da venda no
 * dinheiro, `totalCartao` = no cartão. A linha `auto` (a última criada, "o
 * que falta") se preenche sozinha; as outras valem o que foi digitado.
 */
export function resolverDividido(entradas: EntradaDividida[], base: number, totalCartao: number): Dividido {
  const fator = base > 0 ? totalCartao / base : 1;
  let pagoBase = 0;
  let autoIdx = -1;
  entradas.forEach((e, i) => {
    if (e.auto) { autoIdx = i; return; }
    const v = Number(e.value) || 0;
    pagoBase += ehCartao(e.method) ? v / fator : v;
  });
  const faltaBruta = r2(base - pagoBase);
  const resolvidas = entradas.map((e, i) => {
    if (i !== autoIdx) return e;
    const valor = Math.max(0, ehCartao(e.method) ? r2(faltaBruta * fator) : faltaBruta);
    return { ...e, value: valor };
  });
  const falta = autoIdx >= 0 ? (faltaBruta < 0 ? faltaBruta : 0) : faltaBruta;
  const total = r2(resolvidas.reduce((s, e) => s + (Number(e.value) || 0), 0));
  return {
    entradas: resolvidas,
    fator,
    total,
    falta,
    faltaNoCartao: r2(falta * fator),
    equilibrado: Math.abs(falta) < 0.01,
  };
}

/**
 * A linha "o que falta" no cartão, em frase de balcão (QA 23/09/2026 —
 * antes era a equação "R$ 1.142,40 no dinheiro − R$ 1.268,16 no crédito
 * (÷ 1,11 = …)"): "No cartão, os R$ 742,40 que faltavam ficam R$ 824,13
 * (11% a mais)."
 *
 * QA 23/09/2026 (Matcon): esta frase era "Faltam R$ 742,40. No cartão fica
 * …" e aparecia EMBAIXO de "Pronto · a conta fecha" — duas frases que se
 * contradiziam. Com a linha "o que falta" preenchida a conta sempre fecha,
 * então agora ela é só o complemento do "Pronto" (statusDoDividido), no
 * passado. No dinheiro/PIX/crediário não há diferença a explicar → "".
 */
export function fraseDaConta(dv: Dividido): string {
  const auto = dv.entradas.find((e) => e.auto);
  if (!auto || !ehCartao(auto.method)) return "";
  const faltaBase = r2(auto.value / dv.fator);
  if (!(faltaBase > 0.005)) return "";
  const pct = Math.round((dv.fator - 1) * 1000) / 10;
  if (pct === 0) return "";
  const diferenca = pct > 0 ? " (" + fmtPct(pct) + "% a mais)" : " (" + fmtPct(-pct) + "% a menos)";
  return "No cartão, os " + fmtReais(faltaBase) + " que faltavam ficam " + fmtReais(auto.value) + diferenca + ".";
}

/**
 * O status do dividido — a ÚNICA frase da conta na tela (QA 23/09/2026):
 * "Sobrando …", "Faltam …" ou "Pronto · a conta fecha em …", este último
 * com o porquê do valor no cartão quando a linha "o que falta" é de cartão.
 * Nunca "Faltam" e "Pronto" ao mesmo tempo.
 */
export function statusDoDividido(dv: Dividido): string {
  if (dv.falta < -0.005) return "Sobrando " + fmtReais(-dv.falta) + " (no dinheiro) — diminua um pagamento";
  if (dv.equilibrado) {
    const porque = fraseDaConta(dv);
    return "Pronto · a conta fecha em " + fmtReais(dv.total) + (porque ? ". " + porque : "");
  }
  return "Faltam " + fmtReais(dv.falta) + " no dinheiro ou PIX, ou " + fmtReais(dv.faltaNoCartao) + " no cartão";
}

/**
 * Lápis do carrinho: editar o preço de um método leva o outro na mesma
 * proporção em que estavam (decisão 5 do Caio).
 */
export function editarPrecoProporcional(
  atual: { cash: number; card: number },
  novo: number,
  noCartao: boolean,
): { cash: number; card: number } {
  const n = r2(novo);
  if (noCartao) {
    return { card: n, cash: atual.card > 0 ? r2((n * atual.cash) / atual.card) : n };
  }
  return { cash: n, card: atual.cash > 0 ? r2((n * atual.card) / atual.cash) : n };
}

/**
 * Lápis no dividido (QA 23/09/2026): a linha mostra o preço RATEADO desta
 * venda. O novo valor vale sobre ele — dinheiro e cartão andam na mesma
 * proporção (novo ÷ mostrado), e o rateio da venda acompanha.
 */
export function editarPrecoNoDividido(
  atual: { cash: number; card: number },
  mostrado: number,
  novo: number,
): { cash: number; card: number } {
  const n = r2(novo);
  if (!(mostrado > 0)) return { cash: n, card: n };
  const k = n / mostrado;
  return { cash: r2(atual.cash * k), card: r2(atual.card * k) };
}
