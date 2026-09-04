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
import type { StudioStoreProduct, CustomizationField } from "./types";
import { numeroWhatsApp } from "./AncoraWhatsApp";

/** Quantos caracteres cabem sem o WhatsApp truncar o link. */
const TETO = 1200;

function ehVazio(v: any): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function rotuloDoCampo(f: CustomizationField): string {
  const l = (f as any)?.label;
  return typeof l === "string" && l.trim() ? l.trim() : "Personalização";
}

/**
 * O valor como a LOJISTA precisa ler.
 *
 * Uma cor é `#D62828` no dado e "cor #D62828" na mensagem: ela abre o
 * pedido e vê o hex, que é o que ela usa na prensa. Um arquivo é o
 * endereço, que ela abre. Um texto é o texto.
 */
function valorLegivel(f: CustomizationField, valor: any): string | null {
  if (ehVazio(valor)) return null;
  const tipo = (f as any)?.type;
  if (tipo === "image" || tipo === "template") {
    return typeof valor === "string" ? valor : null;
  }
  if (tipo === "color") return String(valor);
  return String(valor);
}

export type LinhaDoPedido = { rotulo: string; valor: string };

/** As linhas da personalização, na ordem em que a cliente preencheu. */
export function linhasDaPersonalizacao(
  produto: StudioStoreProduct,
  valores: Record<string, any> | null | undefined
): LinhaDoPedido[] {
  const campos = produto?.customization_config?.fields || [];
  const v = valores || {};
  const linhas: LinhaDoPedido[] = [];
  for (const f of campos) {
    const legivel = valorLegivel(f, v[(f as any).id]);
    if (legivel == null) continue;
    linhas.push({ rotulo: rotuloDoCampo(f), valor: legivel });
  }
  return linhas;
}

function dinheiro(v: number): string {
  return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");
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
  nomeDaLoja,
}: {
  produto: StudioStoreProduct;
  valores?: Record<string, any> | null;
  quantidade?: number;
  precoUnitario?: number;
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
    partes.push(qtd > 1 ? `${qtd} × ${dinheiro(unit)} = ${dinheiro(unit * qtd)}` : dinheiro(unit));
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
  nomeDaLoja?: string | null;
}): string | null {
  const num = numeroWhatsApp(args.numero);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagemDoPedido(args))}`;
}
