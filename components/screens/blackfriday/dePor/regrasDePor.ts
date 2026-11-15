// ============================================================================
// AURA. — Promoção em lote (De/Por): regras e textos (p-86, 08/11/2026)
//
// Só contas de EXIBIÇÃO e validação do que a pessoa digitou. O preço da
// promoção é do servidor (prévia com dry_run): o app nunca calcula preço
// para gravar. Fuso: a tela fala em horário de Brasília; o começo é 00h00
// do dia escolhido e o fim é 23h59min59s do dia escolhido (contrato).
// Brasil sem horário de verão desde 2019: -03:00 fixo.
// ============================================================================
import { hojeBrt } from "@/components/screens/configuracoes/assentoTemporada";
import { lerNumero, brl, plural } from "@/components/screens/estoque/reajuste/reajusteRegras";
import type {
  AlvoPromocao, ItemDaLista, ItemDaPrevia, ItemDeFora, ModoPromocao, PedidoPromocao, RespostaPromocao, TerminacaoPromocao,
} from "@/services/promocoesApi";

export { brl, plural, lerNumero };

export var FUSO = "America/Sao_Paulo";

export var MODOS_PROMOCAO: Array<{ modo: ModoPromocao; titulo: string; texto: string }> = [
  { modo: "percent", titulo: "Desconto em %", texto: "Tira um % do preço de cada produto" },
  { modo: "fixed", titulo: "Desconto em R$", texto: "Tira o mesmo valor de cada produto" },
  { modo: "preco", titulo: "Preço único", texto: "Todos saem pelo mesmo preço" },
];

export var ATALHOS_PCT = [10, 15, 20, 30, 40, 50];

export var TERMINACOES_PROMOCAO: Array<{ valor: TerminacaoPromocao; rotulo: string }> = [
  { valor: "none", rotulo: "Sem ajuste" },
  { valor: "90", rotulo: ",90" },
  { valor: "99", rotulo: ",99" },
  { valor: "00", rotulo: ",00" },
];

export var VALOR_INICIAL_PROMO: Record<ModoPromocao, string> = { percent: "20", fixed: "10", preco: "49,90" };

export function rotuloDoValorPromo(modo: ModoPromocao): string {
  if (modo === "percent") return "Desconto (%)";
  if (modo === "fixed") return "Desconto (R$)";
  return "Preço da promoção (R$)";
}

/** Erro do campo de valor (texto gentil) ou null quando está ok. */
export function erroDoValorPromo(modo: ModoPromocao, txt: string): string | null {
  if (!String(txt || "").trim()) return "Digite um valor.";
  var v = lerNumero(txt);
  if (isNaN(v)) return "Use só números. Exemplo: 20 ou 19,90.";
  if (v <= 0) return "O valor precisa ser maior que zero.";
  if (modo === "percent" && v >= 100) return "O desconto precisa ser menor que 100%.";
  if (v > 100000) return "O máximo é R$ 100.000,00.";
  return null;
}

// ---------------------------------------------------------------- datas

/** "AAAA-MM-DD" + n dias (sem fuso: conta de calendário). */
export function somarDias(iso: string, n: number): string {
  var p = iso.split("-").map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

export function inicioDoDiaBrt(iso: string): string { return iso + "T00:00:00-03:00"; }
export function fimDoDiaBrt(iso: string): string { return iso + "T23:59:59-03:00"; }

/** "AAAA-MM-DD" -> "27/11". */
export function diaMes(iso: string): string {
  var p = iso.split("-");
  return p[2] + "/" + p[1];
}

/** Instante (ISO com fuso) -> "AAAA-MM-DD" em Brasília. */
export function diaBrtDe(instante: string | null | undefined): string | null {
  if (!instante) return null;
  var d = new Date(instante);
  if (isNaN(d.getTime())) return null;
  return hojeBrt(d);
}

/** Instante -> "27/11" em Brasília ("—" sem data). */
export function diaMesDe(instante: string | null | undefined): string {
  var d = diaBrtDe(instante);
  return d ? diaMes(d) : "—";
}

/** Black Friday do ano: a sexta depois da 4ª quinta de novembro, até a segunda (Cyber Monday). */
export function blackFridayDoAno(ano: number): { ini: string; fim: string } {
  var primeiro = new Date(Date.UTC(ano, 10, 1)).getUTCDay(); // 0 = domingo
  var primeiraQuinta = 1 + ((4 - primeiro + 7) % 7);
  var sexta = primeiraQuinta + 21 + 1;
  var ini = ano + "-11-" + String(sexta).padStart(2, "0");
  return { ini: ini, fim: somarDias(ini, 3) };
}

export type ChavePrazo = "bf" | "natal" | "agora" | "datas";
export type Prazo = { chave: ChavePrazo; titulo: string; detalhe: string; ini: string; fim: string; comecaAgora: boolean };

/**
 * Atalhos de prazo que ainda fazem sentido hoje. Atalho que já começou
 * vale "a partir de agora"; o que já acabou some.
 */
export function prazosDisponiveis(hoje: string): Prazo[] {
  var ano = Number(hoje.slice(0, 4));
  var bf = blackFridayDoAno(ano);
  var natal = { ini: ano + "-12-01", fim: ano + "-12-24" };
  var out: Prazo[] = [];
  if (bf.fim >= hoje) {
    var ja = bf.ini <= hoje;
    out.push({ chave: "bf", titulo: "Black Friday", detalhe: (ja ? "de hoje" : diaMes(bf.ini)) + " a " + diaMes(bf.fim), ini: ja ? hoje : bf.ini, fim: bf.fim, comecaAgora: ja });
  }
  if (natal.fim >= hoje) {
    var jaN = natal.ini <= hoje;
    out.push({ chave: "natal", titulo: "Natal", detalhe: (jaN ? "de hoje" : diaMes(natal.ini)) + " a " + diaMes(natal.fim), ini: jaN ? hoje : natal.ini, fim: natal.fim, comecaAgora: jaN });
  }
  var fimAgora = bf.fim >= hoje ? bf.fim : natal.fim >= hoje ? natal.fim : somarDias(hoje, 7);
  out.push({ chave: "agora", titulo: "Começar agora", detalhe: "e terminar em " + diaMes(fimAgora), ini: hoje, fim: fimAgora, comecaAgora: true });
  return out;
}

/** Erro das datas escolhidas à mão, ou null. */
export function erroDasDatas(ini: string | null, fim: string | null, hoje: string): string | null {
  if (!ini || !fim) return "Escolha o dia de começo e o de fim.";
  if (ini < hoje) return "O começo já passou. Use hoje ou um dia à frente.";
  if (fim < ini) return "O fim precisa ser no mesmo dia do começo ou depois.";
  return null;
}

/**
 * starts_at / ends_at do pedido. Começar hoje = agora (a promoção liga na
 * hora); outro dia = 00h00 daquele dia em Brasília.
 *
 * QA 08/11/2026: "agora" ia com o relógio do NAVEGADOR. Com o computador da
 * loja uns segundos adiantado, o starts_at ficava no futuro para o servidor,
 * que classifica ativa/agendada com o now() dele: a promoção recém-ligada
 * aparecia como "agendada" na seção até o relógio do servidor alcançar.
 * Agora, para começar hoje, o pedido vai com starts_at = null: o servidor
 * usa o instante dele (lerPedido em services/promocaoEmLote.js do backend:
 * starts_at ausente ou null = agora). Nenhum desvio de relógio, para a
 * frente ou para trás, consegue mais agendar o "começar agora". O dia
 * futuro continua 00h00 de Brasília, que não depende de relógio nenhum.
 */
export function instantesDoPrazo(ini: string, fim: string, hoje: string): { starts_at: string | null; ends_at: string; agendada: boolean } {
  var comecaHoje = ini <= hoje;
  return {
    starts_at: comecaHoje ? null : inicioDoDiaBrt(ini),
    ends_at: fimDoDiaBrt(fim),
    agendada: !comecaHoje,
  };
}

/** "Vale de 27/11 às 00h a 30/11 às 23h59. Os preços voltam em 01/12 às 00h." */
export function textoDoPrazo(ini: string, fim: string, hoje: string): string {
  var comeco = ini <= hoje ? "agora" : diaMes(ini) + " às 00h";
  return "Vale de " + comeco + " a " + diaMes(fim) + " às 23h59. Os preços voltam sozinhos em " + diaMes(somarDias(fim, 1)) + " às 00h.";
}

/** Frase da tela final, com a concordância certa: "1 item já está em promoção." / "3 itens entram em promoção." */
export function textoDoPronto(n: number, agendada: boolean): string {
  return agendada
    ? plural(n, "item entra", "itens entram") + " em promoção."
    : plural(n, "item já está", "itens já estão") + " em promoção.";
}

export function montarPedidoPromo(
  targets: AlvoPromocao[], modo: ModoPromocao, valorTxt: string, terminacao: TerminacaoPromocao,
  instantes: { starts_at: string | null; ends_at: string },
): PedidoPromocao {
  return {
    targets: targets,
    modo: modo,
    valor: lerNumero(valorTxt),
    terminacao: modo === "preco" ? "none" : terminacao,
    starts_at: instantes.starts_at,
    ends_at: instantes.ends_at,
  };
}

// ---------------------------------------------------------------- prévia

export function chaveDoItem(i: { product_id: string; variant_id?: string | null }): string {
  return i.product_id + ":" + (i.variant_id || "");
}

export function alvoDoItem(i: { product_id: string; variant_id?: string | null }): AlvoPromocao {
  return i.variant_id ? { product_id: i.product_id, variant_id: i.variant_id } : { product_id: i.product_id };
}

/** Desconto médio (fração) dos itens com preço de antes. null sem nenhum. */
export function descontoMedio(items: Array<{ preco_de: number; preco_por: number }>): number | null {
  var validos = items.filter(function (i) { return i.preco_de > 0 && i.preco_por >= 0; });
  if (!validos.length) return null;
  var soma = validos.reduce(function (a, i) { return a + (1 - i.preco_por / i.preco_de); }, 0);
  return soma / validos.length;
}

export function pctTxt(f: number | null | undefined): string {
  if (f == null || isNaN(Number(f))) return "—";
  return Math.round(Number(f) * 100) + "%";
}

export function contarFora(fora: ItemDeFora[]): { abaixo: number; semPreco: number; semDesconto: number; naoEncontrado: number } {
  var r = { abaixo: 0, semPreco: 0, semDesconto: 0, naoEncontrado: 0 };
  fora.forEach(function (f) {
    if (f.motivo === "abaixo_do_custo") r.abaixo++;
    else if (f.motivo === "sem_preco" || f.motivo === "preco_invalido") r.semPreco++;
    else if (f.motivo === "sem_desconto") r.semDesconto++;
    else r.naoEncontrado++;
  });
  return r;
}

/**
 * Itens que entram (os da prévia menos os produtos que a pessoa tirou).
 * Tirar é por PRODUTO: o alvo `{product_id}` do backend leva o produto e as
 * variantes com preço próprio juntos, e não há como mandar só o produto.
 */
export function itensQueEntram(r: RespostaPromocao, tirados: Record<string, true>): ItemDaPrevia[] {
  return r.items.filter(function (i) { return !tirados[i.product_id] && !i.abaixo_do_custo; });
}

/** Alvos do aplicar: um `{product_id}` por produto que ficou (mesma forma da prévia). */
export function alvosQueEntram(entram: ItemDaPrevia[]): AlvoPromocao[] {
  var vistos: Record<string, true> = {};
  var out: AlvoPromocao[] = [];
  entram.forEach(function (i) {
    if (vistos[i.product_id]) return;
    vistos[i.product_id] = true;
    out.push({ product_id: i.product_id });
  });
  return out;
}

/** Nome do item: produto, e a variante depois quando houver. */
export function nomeDoItemPromo(i: { nome: string; variant_label?: string | null }): string {
  return i.variant_label ? i.nome + " · " + i.variant_label : i.nome;
}

/** Frase do "fica de fora", ou null quando ninguém fica. */
export function textoDeFora(fora: ItemDeFora[]): string | null {
  var c = contarFora(fora);
  var partes: string[] = [];
  if (c.abaixo) partes.push(plural(c.abaixo, "fica", "ficam") + " de fora porque o preço com desconto ficaria abaixo do custo");
  if (c.semPreco) partes.push(plural(c.semPreco, "fica", "ficam") + " de fora porque o preço ficaria zerado ou não tem preço de venda");
  if (c.semDesconto) partes.push(plural(c.semDesconto, "fica", "ficam") + " de fora porque o preço da promoção não ficaria menor que o normal");
  if (c.naoEncontrado) partes.push(plural(c.naoEncontrado, "não foi encontrado", "não foram encontrados"));
  if (!partes.length) return null;
  return partes.join("; ") + ".";
}

// ---------------------------------------------------------------- seção

/** Instante -> hora em Brasília: "00h" na virada do dia, "14h05" no resto. null sem data. */
export function horaBrtDe(instante: string | null | undefined): string | null {
  if (!instante) return null;
  var t = new Date(instante).getTime();
  if (isNaN(t)) return null;
  var d = new Date(t - 3 * 3600 * 1000); // -03:00 fixo (ver o topo do arquivo)
  var h = String(d.getUTCHours()).padStart(2, "0");
  var m = d.getUTCMinutes();
  return m === 0 ? h + "h" : h + "h" + String(m).padStart(2, "0");
}

export type ResumoDaLista = { itens: number; desconto: number | null; ini: string | null; iniHora: string | null; fim: string | null; fimVaria: boolean };

export function resumoDaLista(lista: ItemDaLista[]): ResumoDaLista {
  var inis = lista.map(function (i) { return diaBrtDe(i.starts_at); }).filter(Boolean) as string[];
  var fins = lista.map(function (i) { return diaBrtDe(i.ends_at); }).filter(Boolean) as string[];
  inis.sort(); fins.sort();
  // A hora do PRIMEIRO começo (QA 08/11/2026): o cartão da agendada dizia
  // "começa às 00h" sempre, mesmo quando o começo não era à meia-noite.
  var primeiro: string | null = null;
  var primeiroT = Infinity;
  lista.forEach(function (i) {
    var t = i.starts_at ? new Date(i.starts_at).getTime() : NaN;
    if (!isNaN(t) && t < primeiroT) { primeiroT = t; primeiro = i.starts_at; }
  });
  return {
    itens: lista.length,
    desconto: descontoMedio(lista),
    ini: inis.length ? inis[0] : null,
    iniHora: horaBrtDe(primeiro),
    fim: fins.length ? fins[fins.length - 1] : null,
    fimVaria: fins.length > 1 && fins[0] !== fins[fins.length - 1],
  };
}

/** Promoção ainda vale ou vai valer (para o aviso no cadastro e o filtro do passo 1). */
export function promocaoVigenteOuAgendada(p: { promoPrice?: number | null; promoEndsAt?: string | null }, agora?: Date): boolean {
  if (p.promoPrice == null || !p.promoEndsAt) return false;
  var fim = new Date(p.promoEndsAt).getTime();
  return !isNaN(fim) && fim > (agora || new Date(Date.now())).getTime();
}

/**
 * Aviso no cadastro/edição de um produto em promoção (decisão do Caio,
 * 08/11): mudar o preço ali muda o preço normal; a promoção segue até o fim.
 * null quando o produto não tem promoção valendo nem agendada.
 */
export function avisoDePromocaoNoCadastro(
  p: { promoPrice?: number | null; promoStartsAt?: string | null; promoEndsAt?: string | null },
  agora?: Date,
): string | null {
  if (!promocaoVigenteOuAgendada(p, agora)) return null;
  var ate = diaMesDe(p.promoEndsAt);
  var inicio = p.promoStartsAt ? new Date(p.promoStartsAt).getTime() : NaN;
  var agendada = !isNaN(inicio) && inicio > (agora || new Date(Date.now())).getTime();
  var por = brl(p.promoPrice as number);
  if (agendada) {
    return "Este produto tem promoção agendada de " + diaMesDe(p.promoStartsAt) + " a " + ate + ", por " + por +
      ". O preço que você mudar aqui é o preço normal: o preço da promoção continua valendo até " + ate + ".";
  }
  return "Este produto está em promoção por " + por + ". O preço que você mudar aqui é o preço normal: o preço da promoção continua valendo até " + ate + ".";
}

// ---------------------------------------------------------------- parados (QA 08/11/2026)

/**
 * "Parados há 60 dias ou mais" (passo 1 do mockup aprovado): produto com
 * estoque que não vendeu nos últimos 60 dias, contando hoje como um deles.
 * Janela de venda = de hoje − 59 até hoje, em Brasília. Quem vendeu pela
 * última vez há exatamente 60 dias (hoje − 60) está parado há 60 dias e
 * ENTRA; quem vendeu há 59 dias não entra.
 */
export var DIAS_PARADO = 60;

/** Primeiro dia ("AAAA-MM-DD", Brasília) da janela em que uma venda tira o produto dos parados. */
export function inicioDaJanelaParados(hoje: string): string {
  return somarDias(hoje, -(DIAS_PARADO - 1));
}

/**
 * Produtos que venderam desde `inicio`, juntando duas rotas que o backend
 * já tem (nenhuma rota nova; ver services/vendasRecentesApi.ts):
 *  - ranking (`/products/ranking`, período `inicio`..hoje): uma linha por
 *    produto vendido NESTA loja, com as variantes somadas, hoje incluído;
 *  - "O que vai faltar" (`/estoque/ruptura`, janela de 60 dias): conta a
 *    venda do produto compartilhado do grupo em qualquer loja e a troca,
 *    mas para em ontem. Dela vale só a linha cuja última venda caiu dentro
 *    da janela (a janela dela começa um dia antes).
 * Venda em qualquer uma das duas tira o produto dos parados: na dúvida o
 * produto fica de fora da promoção, nunca entra por engano.
 */
export function vendidosDesde(
  ranking: Array<{ id?: string | null }>,
  ruptura: Array<{ product_id: string; ultima_venda?: string | null }>,
  inicio: string,
): Record<string, true> {
  var out: Record<string, true> = {};
  (ranking || []).forEach(function (r) { if (r && r.id) out[String(r.id)] = true; });
  (ruptura || []).forEach(function (i) {
    if (!i || !i.product_id) return;
    var dia = diaBrtDe(i.ultima_venda);
    // Sem data: na dúvida conta como vendido (não entra nos parados).
    if (!dia || dia >= inicio) out[String(i.product_id)] = true;
  });
  return out;
}

/** O produto entra em "Parados há 60 dias ou mais"? Precisa ter estoque e não ter vendido na janela. */
export function estaParado(p: { id: string; stock?: number | string | null }, vendidos: Record<string, true>): boolean {
  return Number(p.stock) > 0 && !vendidos[p.id];
}

// ---------------------------------------------------------------- margem da prévia (QA 08/11/2026)

export type MargemDaPrevia = { antes: number | null; depois: number | null; comCusto: number; semCusto: number };

/**
 * Margem média antes e depois da promoção, só dos itens com custo
 * cadastrado (cost_price > 0). Margem = (preço − custo) ÷ preço; "antes"
 * usa o preço normal (De) e "depois" o preço da promoção (Por).
 *
 * Ponderada pelo preço (uma unidade de cada item): Σ(preço − custo) ÷
 * Σ preço. É a margem da cesta, "quanto sobra de cada real vendido". A
 * média simples das margens deixaria um item de R$ 5 com margem fora do
 * comum pesar tanto quanto um de R$ 500.
 */
export function margemDaPrevia(items: Array<{ preco_de: number; preco_por: number; cost_price?: number | null }>): MargemDaPrevia {
  var somaDe = 0, somaPor = 0, sobraDe = 0, sobraPor = 0, comCusto = 0, semCusto = 0;
  items.forEach(function (i) {
    var c = Number(i.cost_price);
    if (!(c > 0)) { semCusto++; return; }
    if (!(i.preco_de > 0) || !(i.preco_por > 0)) return;
    comCusto++;
    somaDe += i.preco_de; sobraDe += i.preco_de - c;
    somaPor += i.preco_por; sobraPor += i.preco_por - c;
  });
  return {
    antes: comCusto ? sobraDe / somaDe : null,
    depois: comCusto ? sobraPor / somaPor : null,
    comCusto: comCusto,
    semCusto: semCusto,
  };
}

/** "62% → 57%", ou "—" sem nenhum item com custo. */
export function textoDaMargem(m: MargemDaPrevia): string {
  if (m.antes == null || m.depois == null) return "—";
  return pctTxt(m.antes) + " → " + pctTxt(m.depois);
}

/** "12 itens sem custo cadastrado não entram nessa conta." ou null quando todos têm custo. */
export function textoSemCusto(m: MargemDaPrevia): string | null {
  if (!m.semCusto) return null;
  return plural(m.semCusto, "item sem custo cadastrado não entra", "itens sem custo cadastrado não entram") + " nessa conta.";
}

// ── O final (",90", ",99", ",00") muda o desconto (p-123b, QA 14/11) ─────
//
// Em item barato o final arredondado pesa: R$ 3,20 com 20% e final ,90 vira
// R$ 2,90, que é 9%, não 20%. O assistente avisa quando o desconto de verdade
// fica mais de LIMITE_DESVIO_DO_FINAL pontos longe do pedido, para a lojista
// conferir ou escolher "Sem ajuste". O preço vem da prévia do servidor.

export var LIMITE_DESVIO_DO_FINAL = 5;

export type DesvioDoFinal = { chave: string; pedidoPct: number; realPct: number; de: number; por: number };

/** Os itens da prévia em que o final mudou o desconto em mais de 5 pontos. */
export function desviosDoFinal(
  items: Array<{ product_id: string; variant_id?: string | null; preco_de: number; preco_por: number }>,
  pedido: { modo: ModoPromocao; valor: number; terminacao?: TerminacaoPromocao } | null | undefined,
): DesvioDoFinal[] {
  if (!pedido || pedido.modo === "preco" || !pedido.terminacao || pedido.terminacao === "none") return [];
  var v = Number(pedido.valor);
  if (!(v > 0)) return [];
  var out: DesvioDoFinal[] = [];
  items.forEach(function (i) {
    var de = Number(i.preco_de), por = Number(i.preco_por);
    if (!(de > 0) || !(por >= 0)) return;
    var alvo = pedido.modo === "percent" ? de * (1 - v / 100) : de - v;
    var pedidoPct = (1 - alvo / de) * 100;
    var realPct = (1 - por / de) * 100;
    if (Math.abs(realPct - pedidoPct) > LIMITE_DESVIO_DO_FINAL) {
      out.push({ chave: chaveDoItem(i), pedidoPct: Math.round(pedidoPct), realPct: Math.round(realPct), de: de, por: por });
    }
  });
  return out;
}

/** A frase do aviso, com um exemplo; null sem desvio. */
export function textoDoDesvioDoFinal(desvios: DesvioDoFinal[], terminacao: TerminacaoPromocao | undefined): string | null {
  if (!desvios.length) return null;
  var final = (TERMINACOES_PROMOCAO.find(function (t) { return t.valor === terminacao; }) || { rotulo: "" }).rotulo;
  var ex = desvios[0];
  return plural(desvios.length, "item fica", "itens ficam") + " com o desconto bem diferente do pedido por causa do final " + final
    + ": " + brl(ex.de) + " → " + brl(ex.por) + " dá " + ex.realPct + "%, não " + ex.pedidoPct + "%."
    + " Confira na lista ou volte e escolha \u201cSem ajuste\u201d.";
}
