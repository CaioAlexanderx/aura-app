// ============================================================
// AURA. — Preencher custos em massa: regras da tela (12/11/2026)
//
// Sem React (o jest carrega direto). Mockup aprovado pelo Caio em 12/11
// (claude.ai/artifact/X9nk1tpyZoQVv4jdEuHJ9k), com as 4 decisões:
//   1. atalho com Markup como padrão e Margem ao lado num toque; a loja
//      lembra o último usado (o backend devolve `ultimo_atalho`);
//   2. custo sugerido arredondado ao centavo, nada de ,90/,99;
//   3. um custo por produto (products.cost_price); a linha mostra a faixa
//      de preço quando as variantes variam, e a conta usa o preço do produto;
//   4. Essencial, sem trava de plano; só a permissão (editar estoque E ver
//      custo).
//
// REGRA DO CAIO (obrigatória): o lojista sempre pode preencher o custo à
// mão. O campo de cada linha vem primeiro e fica sempre editável; os atalhos
// só SUGEREM e só preenchem campos vazios ou já sugeridos (salvo "Trocar
// também o que eu digitei"); nada grava sem confirmação.
// ============================================================
import type { ItemDoPedido, ModoDoAtalho, OrigemDoCusto, PedidoDeCusto, ProdutoSemCusto } from "@/services/custoEmMassaApi";

/** Prazo do desfazer (igual ao reajuste de preço e à conferência). */
export var DIAS_PARA_DESFAZER_CUSTO = 7;
/** Percentual ao abrir e ao trocar de modo (o do mockup): os dois dão metade do preço. */
export var PERCENTUAL_INICIAL: Record<ModoDoAtalho, string> = { markup: "100", margem: "50" };
/** Quantas linhas aparecem na confirmação antes do "e mais N". */
export var PREVIA_NA_CONFIRMACAO = 3;
// NUMERIC(10,2) no banco: 99.999.999,99.
var MAX_CUSTO = 99999999.99;

/** Uma linha da tela: o produto e o que a pessoa fez nela. */
export type LinhaDeCusto = {
  produto: ProdutoSemCusto;
  marcada: boolean;
  /** O texto do campo, como a pessoa vê ("27,72"). */
  valor: string;
  /** De onde veio o número do campo; null = campo vazio. */
  origem: OrigemDoCusto | null;
};

export function novaLinha(produto: ProdutoSemCusto): LinhaDeCusto {
  return { produto: produto, marcada: true, valor: "", origem: null };
}

/**
 * Lê um número em reais como a pessoa digita.
 *   "27,72" -> 27.72   "1.234,56" -> 1234.56   "27.5" -> 27.5
 *   "1.234" -> 1234    "R$ 10" -> 10           "" / "abc" -> null
 */
export function lerReais(txt: string | null | undefined): number | null {
  var t = String(txt == null ? "" : txt).replace(/R\$/g, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  var n = parseFloat(t);
  return isFinite(n) ? n : null;
}

/** 29.95 -> "29,95"; 1234.5 -> "1.234,50". */
export function reaisNoCampo(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function brl(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(Number(n))) return "—";
  return "R$ " + reaisNoCampo(Number(n));
}

/** Preço que a conta usa: o do produto (decisão 3), null sem preço. */
export function precoDaConta(p: ProdutoSemCusto): number | null {
  return p.preco != null && p.preco > 0 ? p.preco : null;
}

/**
 * Custo sugerido pelo preço de venda, ao centavo e mais nada (decisão 2).
 * Mesma conta do backend (services/custoEmMassa.js, sugerirCusto).
 *   markup: custo = preço ÷ (1 + %)
 *   margem: custo = preço × (1 − %), % menor que 100
 */
export function sugerirCusto(preco: number | null | undefined, modo: ModoDoAtalho, pct: number | null): number | null {
  if (preco == null || !(preco > 0) || pct == null || !isFinite(pct) || pct < 0) return null;
  var c = Math.round(preco * 100);
  if (modo === "markup") return Math.round(c / (1 + pct / 100)) / 100;
  if (pct >= 100) return null;
  return Math.round(c * (1 - pct / 100)) / 100;
}

/** Percentual do campo do atalho; null quando não dá para sugerir com ele. */
export function lerPercentual(txt: string, modo: ModoDoAtalho): number | null {
  var t = String(txt == null ? "" : txt).replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  var n = parseFloat(t);
  if (!isFinite(n) || n < 0) return null;
  if (modo === "margem" && n >= 100) return null;
  if (n > 10000) return null;
  return n;
}

/** Custo válido do campo (maior que zero e cabe no banco) ou null. */
export function custoDaLinha(l: LinhaDeCusto): number | null {
  var n = lerReais(l.valor);
  if (n === null) return null;
  var c = Math.round(n * 100) / 100;
  if (!(c > 0) || c > MAX_CUSTO) return null;
  return c;
}

/** Campo com texto que não é um custo (ex.: "abc", "0"). */
export function campoInvalido(l: LinhaDeCusto): boolean {
  return String(l.valor || "").trim() !== "" && custoDaLinha(l) === null;
}

export function acimaDoPreco(l: LinhaDeCusto): boolean {
  var c = custoDaLinha(l);
  var p = precoDaConta(l.produto);
  return c !== null && p !== null && c >= p;
}

/** Margem que o custo dá (inteiro), ou null sem preço. */
export function margemDaLinha(l: LinhaDeCusto): number | null {
  var c = custoDaLinha(l);
  var p = precoDaConta(l.produto);
  if (c === null || p === null) return null;
  return Math.round(((p - c) / p) * 100);
}

/** O que a pessoa digita no campo. Vazio volta a "sem origem". */
export function digitar(l: LinhaDeCusto, valor: string): LinhaDeCusto {
  return { ...l, valor: valor, origem: valor.trim() ? "digitado" : null };
}

/** Linha que um atalho pode preencher: marcada e vazia, ou com número de atalho (ou digitado, se trocar). */
function atalhoPodePreencher(l: LinhaDeCusto, trocarDigitados: boolean): boolean {
  if (!l.marcada) return false;
  if (!String(l.valor || "").trim() || l.origem === null) return true;
  if (l.origem === "sugerido" || l.origem === "mesmo") return true;
  return trocarDigitados;
}

export type ContasDaTela = {
  marcadas: number;
  /** Quantas o "Sugerir custos" vai preencher. */
  alvoDaSugestao: number;
  /** Marcadas sem preço de venda (o atalho passa por elas). */
  semPreco: number;
  /** Marcadas com número digitado à mão. */
  digitadas: number;
  /** Marcadas com custo válido: o que vai para a gravação. */
  prontas: number;
};

export function contas(linhas: LinhaDeCusto[], trocarDigitados: boolean): ContasDaTela {
  var out: ContasDaTela = { marcadas: 0, alvoDaSugestao: 0, semPreco: 0, digitadas: 0, prontas: 0 };
  linhas.forEach(function (l) {
    if (!l.marcada) return;
    out.marcadas += 1;
    var temPreco = precoDaConta(l.produto) !== null;
    if (!temPreco) out.semPreco += 1;
    if (l.origem === "digitado" && custoDaLinha(l) !== null) out.digitadas += 1;
    if (temPreco && atalhoPodePreencher(l, trocarDigitados)) out.alvoDaSugestao += 1;
    if (custoDaLinha(l) !== null) out.prontas += 1;
  });
  return out;
}

/** "Sugerir custos": preenche só o que o atalho pode preencher. */
export function aplicarSugestao(
  linhas: LinhaDeCusto[], modo: ModoDoAtalho, pct: number, trocarDigitados: boolean,
): { linhas: LinhaDeCusto[]; sugeridas: number; semPreco: number } {
  var sugeridas = 0;
  var semPreco = 0;
  var novas = linhas.map(function (l) {
    if (!l.marcada) return l;
    var sug = sugerirCusto(precoDaConta(l.produto), modo, pct);
    if (sug === null) { semPreco += 1; return l; }
    if (!atalhoPodePreencher(l, trocarDigitados)) return l;
    sugeridas += 1;
    return { ...l, valor: reaisNoCampo(sug), origem: "sugerido" as OrigemDoCusto };
  });
  return { linhas: novas, sugeridas: sugeridas, semPreco: semPreco };
}

/** "Mesmo custo para os marcados": mesma regra do atalho (não pisa no digitado). */
export function aplicarMesmoCusto(
  linhas: LinhaDeCusto[], custo: number, trocarDigitados: boolean,
): { linhas: LinhaDeCusto[]; preenchidas: number; mantidas: number } {
  var preenchidas = 0;
  var mantidas = 0;
  var novas = linhas.map(function (l) {
    if (!l.marcada) return l;
    if (!atalhoPodePreencher(l, trocarDigitados)) { mantidas += 1; return l; }
    preenchidas += 1;
    return { ...l, valor: reaisNoCampo(custo), origem: "mesmo" as OrigemDoCusto };
  });
  return { linhas: novas, preenchidas: preenchidas, mantidas: mantidas };
}

/** Exemplo da conta do atalho, com R$ 59,90 (o do mockup). */
export function exemploDoAtalho(modo: ModoDoAtalho, pctTxt: string): string {
  var pct = lerPercentual(pctTxt, modo);
  var p = String(pctTxt || "0").trim() || "0";
  if (modo === "margem" && pct === null && lerReais(pctTxt) !== null && (lerReais(pctTxt) as number) >= 100) {
    return "A margem precisa ser menor que 100%.";
  }
  var s = sugerirCusto(59.9, modo, pct);
  var custo = s === null ? "—" : brl(s);
  if (modo === "markup") return "Custo = preço de venda ÷ (1 + " + p + "%). Quem vende a R$ 59,90 fica com custo de " + custo + ".";
  return "Custo = preço de venda × (1 − " + p + "%). Quem vende a R$ 59,90 fica com custo de " + custo + ".";
}

/** Texto do detalhe da linha (abaixo do nome). */
export function detalheDaLinha(p: ProdutoSemCusto): string {
  var partes: string[] = [];
  if (precoDaConta(p) === null) partes.push("Sem preço de venda");
  else if (p.preco_min != null && p.preco_max != null && p.preco_min !== p.preco_max) {
    partes.push("Preço varia de " + brl(p.preco_min) + " a " + brl(p.preco_max) + "; a conta usa " + brl(p.preco));
  } else partes.push("Vende a " + brl(p.preco));
  if (p.variantes > 0) partes.push(plural(p.variantes, "variante", "variantes") + " · um custo para todas");
  return partes.join(" · ");
}

export type TomDaEtiqueta = "neutro" | "ambar" | "sugerido" | "digitado";

/** A etiqueta embaixo do campo: de onde veio o número e o que conferir. */
export function etiquetaDaLinha(l: LinhaDeCusto): { texto: string; tom: TomDaEtiqueta } {
  if (!l.marcada) return { texto: "desmarcado: fica como está", tom: "neutro" };
  if (campoInvalido(l)) return { texto: "Confira o número: use só o valor, como 27,50.", tom: "ambar" };
  var c = custoDaLinha(l);
  if (c === null) {
    if (precoDaConta(l.produto) === null) return { texto: "Sem preço, a Aura não tem de onde sugerir. Digite o custo.", tom: "ambar" };
    return { texto: "digite o custo, ou use um atalho", tom: "neutro" };
  }
  if (acimaDoPreco(l)) return { texto: "Maior que o preço de venda. Confira se não sobrou um zero.", tom: "ambar" };
  var m = margemDaLinha(l);
  var mt = m !== null ? " · margem " + m + "%" : "";
  if (l.origem === "sugerido") return { texto: "sugerido" + mt + " · dá para mudar", tom: "sugerido" };
  if (l.origem === "mesmo") return { texto: "mesmo custo dos marcados" + mt, tom: "sugerido" };
  return { texto: "digitado por você" + mt, tom: "digitado" };
}

export function plural(n: number, um: string, varios: string): string {
  return n.toLocaleString("pt-BR") + " " + (n === 1 ? um : varios);
}

/**
 * Corpo do POST: marcadas com custo válido. O atalho vai quando alguma
 * linha usa o número sugerido (o backend guarda modo e % no histórico).
 */
export function montarPedido(
  linhas: LinhaDeCusto[], atalhoUsado: { modo: ModoDoAtalho; percentual: number } | null, countId: string | null,
): PedidoDeCusto {
  var itens: ItemDoPedido[] = [];
  linhas.forEach(function (l) {
    if (!l.marcada) return;
    var c = custoDaLinha(l);
    if (c === null) return;
    itens.push({ product_id: l.produto.product_id, custo: c, origem: l.origem || "digitado" });
  });
  var temSugerido = itens.some(function (i) { return i.origem === "sugerido"; });
  return {
    itens: itens,
    atalho: temSugerido && atalhoUsado ? atalhoUsado : null,
    count_id: countId || null,
    dry_run: false,
  };
}

/** Texto do ConfirmDialog (D do mockup). */
export function mensagemDaConfirmacao(linhas: LinhaDeCusto[], totalDaLista: number): string {
  var prontas = linhas.filter(function (l) { return l.marcada && custoDaLinha(l) !== null; });
  var previa = prontas.slice(0, PREVIA_NA_CONFIRMACAO).map(function (l) {
    return l.produto.nome + ": sem custo → " + brl(custoDaLinha(l));
  });
  var resto = prontas.length - previa.length;
  var ficam = Math.max(0, totalDaLista - prontas.length);
  var compart = prontas.filter(function (l) { return l.produto.compartilhado; });
  var lojas = compart.reduce(function (m, l) { return Math.max(m, l.produto.lojas || 0); }, 0);
  var acima = prontas.filter(acimaDoPreco).length;
  var partes = [
    "Vamos gravar o custo de " + plural(prontas.length, "produto", "produtos") + ". Dá para desfazer por " + DIAS_PARA_DESFAZER_CUSTO + " dias.",
  ];
  if (previa.length) partes.push(previa.join("\n") + (resto > 0 ? "\ne mais " + resto.toLocaleString("pt-BR") : ""));
  var notas: string[] = [];
  if (ficam > 0) notas.push(ficam === 1 ? "1 produto fica sem custo, como está." : plural(ficam, "produto", "produtos") + " ficam sem custo, como estão.");
  if (compart.length > 0) {
    notas.push((compart.length === 1 ? "1 é compartilhado" : plural(compart.length, "é compartilhado", "são compartilhados"))
      + " com o grupo: o custo vale nas " + Math.max(lojas, 2) + " lojas.");
  }
  if (acima > 0) notas.push(acima === 1 ? "1 está com custo maior que o preço de venda." : plural(acima, "está", "estão") + " com custo maior que o preço de venda.");
  if (notas.length) partes.push(notas.join(" "));
  return partes.join("\n\n");
}

/** "Bolsa tote lona e Necessaire estampada"; "A, B e mais 3". */
export function listaDeNomes(nomes: string[], max: number = 3): string {
  var limpos = nomes.filter(Boolean);
  if (limpos.length <= 1) return limpos.join("");
  if (limpos.length <= max) return limpos.slice(0, -1).join(", ") + " e " + limpos[limpos.length - 1];
  return limpos.slice(0, max).join(", ") + " e mais " + (limpos.length - max).toLocaleString("pt-BR");
}

/** "19/11, às 14:32" no fuso de Brasília. */
export function dataEHoraDoPrazo(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  var dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  var hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return dia + ", às " + hora;
}
