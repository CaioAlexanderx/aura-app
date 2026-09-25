// ============================================================
// components/studio/storefront/pedidoPeloWhatsApp.ts
//
// "Comprar pelo WhatsApp", com o pedido já escrito.
//
// ── POR QUE ────────────────────────────────────────────────────────────
// Metade das clientes de loja de personalizados só fecha falando com
// gente. A DNA Presentes põe esse botão em TODO produto; a Aqui Tem
// Caneca põe o atendimento no cabeçalho. Nós tínhamos só uma âncora
// flutuante de "tirar dúvida" — que abre a conversa vazia e faz a
// lojista perguntar "de qual peça você fala?".
//
// O que muda a conversa não é o botão: é a mensagem chegar pronta. A
// lojista lê a peça, a personalização e o valor sem digitar nada, e
// responde prazo em vez de fazer inventário.
//
// ── O QUE VAI NA MENSAGEM ──────────────────────────────────────────────
// Só o que a cliente REALMENTE preencheu. Campo vazio não vira linha —
// uma mensagem com "Cor: —" e "Foto: —" é pior que uma curta, porque a
// lojista tem de ler tudo para descobrir que não há nada ali.
//
// Foto enviada vira o endereço do arquivo: é assim que a lojista abre a
// arte sem pedir para reenviar.
// ============================================================
import type { StudioStoreProduct, CartLine } from "./types";
import { numeroWhatsApp } from "./AncoraWhatsApp";
import { dinheiro } from "./moeda";
import { linhasDaPeca } from "./resumoDaPeca";
import { precoDaLinha } from "./precoDaSacola";

/** Quantos caracteres cabem sem o WhatsApp truncar o link. */
const TETO = 1200;

export type LinhaDoPedido = { rotulo: string; valor: string };

/**
 * As linhas da personalização, na ordem em que a cliente preencheu, com
 * o NOME que ela viu (Fase 2 · 25/09/2026).
 *
 * Até aqui a linha levava o valor cru da escolha: a lojista recebia
 * "Serviço de arte: designer" e "Tamanho: m", o briefing da arte ficava
 * de fora quando o config não tinha o campo, e a cor da arte (chave
 * lateral `<campo>_cor`) nunca chegava. Os nomes vêm de resumoDaPeca.ts,
 * a mesma leitura que a sacola usa — a mensagem diz o que a tela disse.
 */
export function linhasDaPersonalizacao(
  produto: StudioStoreProduct,
  valores: Record<string, any> | null | undefined
): LinhaDoPedido[] {
  return linhasDaPeca(produto, valores).map((l) => ({ rotulo: l.rotulo, valor: l.valor }));
}

/** "2 × R$ 39,90 = R$ 79,80", com a arte (uma vez) quando houver. */
function contaDaLinha(qtd: number, unit: number, arte: number): string {
  const arteTxt = arte > 0 ? ` + ${dinheiro(arte)} do serviço de arte` : "";
  const total = unit * qtd + (arte > 0 ? arte : 0);
  if (qtd > 1) return `${qtd} × ${dinheiro(unit)}${arteTxt} = ${dinheiro(total)}`;
  return arte > 0 ? `${dinheiro(unit)}${arteTxt} = ${dinheiro(total)}` : dinheiro(unit);
}

/**
 * A mensagem inteira.
 *
 * Começa dizendo de onde a pessoa veio: a lojista atende por vários
 * canais e precisa saber, na primeira linha, que este veio da loja.
 */
export function mensagemDoPedido({
  produto,
  valores,
  quantidade = 1,
  precoUnitario,
  arte = 0,
  nomeDaLoja,
}: {
  produto: StudioStoreProduct;
  valores?: Record<string, any> | null;
  quantidade?: number;
  /** Por unidade, SEM o serviço de arte (ver precoDaSacola.ts). */
  precoUnitario?: number;
  /** O serviço de arte pago, uma vez por linha. */
  arte?: number;
  nomeDaLoja?: string | null;
}): string {
  const loja = String(nomeDaLoja || "").trim();
  const partes: string[] = [];

  partes.push(loja ? `Olá! Vim pela loja ${loja} e quero pedir:` : "Olá! Vim pela loja e quero pedir:");
  partes.push("");
  partes.push(`*${produto?.name || "Peça personalizada"}*`);

  const qtd = Math.max(1, Math.floor(Number(quantidade) || 1));
  const unit = Number(precoUnitario);
  if (Number.isFinite(unit) && unit > 0) {
    partes.push(contaDaLinha(qtd, unit, Number(arte) || 0));
  } else if (qtd > 1) {
    partes.push(`Quantidade: ${qtd}`);
  }

  const linhas = linhasDaPersonalizacao(produto, valores);
  if (linhas.length) {
    partes.push("");
    for (const l of linhas) partes.push(`${l.rotulo}: ${l.valor}`);
  }

  const texto = partes.join("\n");
  // Teto por segurança: link longo demais é truncado pelo WhatsApp e a
  // mensagem chega pela metade, o que é pior do que chegar resumida.
  return texto.length <= TETO ? texto : texto.slice(0, TETO - 1) + "…";
}

/**
 * O link pronto, ou `null` quando a loja não tem WhatsApp.
 *
 * `null` é resposta: sem número, o botão não deve existir. Um botão que
 * abre o WhatsApp em branco é pior que nenhum.
 */
export function linkDoPedido(args: {
  numero?: string | null;
  produto: StudioStoreProduct;
  valores?: Record<string, any> | null;
  quantidade?: number;
  precoUnitario?: number;
  arte?: number;
  nomeDaLoja?: string | null;
}): string | null {
  const num = numeroWhatsApp(args.numero);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagemDoPedido(args))}`;
}

/**
 * A mensagem do CARRINHO inteiro, para pedir orçamento (04/09/2026).
 *
 * Decisão do Caio: o orçamento é sempre acionável e apartado do checkout —
 * um botão pequeno, que não disputa com "Finalizar". A cliente que
 * prefere conversar leva o carrinho que já montou, peça por peça, com a
 * personalização de cada uma.
 */
export function mensagemDoCarrinho({
  linhas,
  nomeDaLoja,
}: {
  linhas: CartLine[];
  nomeDaLoja?: string | null;
}): string {
  const loja = String(nomeDaLoja || "").trim();
  const partes: string[] = [];
  partes.push(loja
    ? `Olá! Vim pela loja ${loja} e quero um orçamento destas peças:`
    : "Olá! Vim pela loja e quero um orçamento destas peças:");

  // Fase 2 (25/09/2026): o preço de cada linha é o que a SACOLA mostra —
  // faixa de quantidade, adicionais (verso, meio, opções) e o serviço de
  // arte uma vez por linha (precoDaSacola.ts). Antes ia o preço de tabela
  // vezes a quantidade, e a lojista respondia um valor que a cliente não
  // tinha visto.
  let total = 0;
  for (const l of linhas || []) {
    const qtd = Math.max(1, Math.floor(Number(l.qty) || 1));
    const p = precoDaLinha({ ...l, qty: qtd });
    total += p.total;
    partes.push("");
    partes.push(`*${l.product?.name || "Peça personalizada"}* × ${qtd}`);
    if (p.unitario > 0) {
      const faixa = p.faixa ? ` (faixa de ${p.faixa.min_qty} un: -${p.faixa.pct}%)` : "";
      partes.push(contaDaLinha(qtd, p.unitario, p.arte) + faixa);
    }
    for (const c of linhasDaPersonalizacao(l.product, l.values)) {
      partes.push(`${c.rotulo}: ${c.valor}`);
    }
  }
  if (total > 0) {
    partes.push("");
    partes.push(`Total estimado: ${dinheiro(total)} (sem frete)`);
  }

  const texto = partes.join("\n");
  return texto.length <= TETO ? texto : texto.slice(0, TETO - 1) + "…";
}

/** O link do orçamento do carrinho, ou `null` sem WhatsApp na loja. */
export function linkDoOrcamentoDoCarrinho(args: {
  numero?: string | null;
  linhas: CartLine[];
  nomeDaLoja?: string | null;
}): string | null {
  const num = numeroWhatsApp(args.numero);
  if (!num || !args.linhas?.length) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagemDoCarrinho(args))}`;
}
