// ============================================================
// components/studio/storefront/loteDaVitrine.ts
//
// As regras do orçamento em lote público. Sem React, sem tela.
//
// "50 canecas com o nome de cada convidado, quanto fica?" era conversa
// de WhatsApp respondida na mão, e o assistente que calcula isso morava
// no painel, atrás de login. Quem organiza o casamento não tem login.
//
// O S0 abriu as duas rotas públicas (Aura-backend#665):
//   bulk-quote  — só calcula, pode ser chamada a cada tecla
//   bulk-order  — grava o evento como RASCUNHO
//
// Rascunho e não confirmado é decisão do Caio (decisão 2): quem confirma
// um pedido em lote é a lojista, olhando. Aqui a tela precisa dizer isso
// com todas as letras, senão a pessoa acha que fechou negócio.
// ============================================================

/** Cada linha colada vira uma peça. O servidor também corta em 200. */
export const MAXIMO_NOMES = 200;

export type FaixaDoLote = { from: number; pct: number; label: string };

export type CotacaoDoLote = {
  qty: number;
  unit_price: number;
  discount_pct: number;
  total_amount: number;
  savings: number;
  tiers: FaixaDoLote[];
  product?: { id: string; name: string; price: number };
};

/**
 * A lista colada, virada em nomes.
 *
 * Aceita quebra de linha, ponto-e-vírgula e vírgula — quem cola de uma
 * planilha traz qualquer um dos três, e recusar a lista da pessoa por
 * causa do separador é perder a venda no primeiro passo.
 */
export function nomesDaLista(bruto: string): string[] {
  return String(bruto || "")
    .split(/[\n;,]+/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, MAXIMO_NOMES);
}

/** Quantos nomes passaram do teto, para a tela avisar em vez de cortar calado. */
export function nomesIgnorados(bruto: string): number {
  const todos = String(bruto || "").split(/[\n;,]+/).map((n) => n.trim()).filter(Boolean);
  return Math.max(0, todos.length - MAXIMO_NOMES);
}

/**
 * Quanto falta para a próxima faixa, e quanto ela economizaria.
 *
 * É o empurrão do desenho ("Faltam 38 nomes para R$ 39,90 cada"). Só
 * existe quando há faixa acima da atual — na última, o silêncio é a
 * resposta certa.
 */
export function proximoDegrau(
  cot: CotacaoDoLote | null,
): { faltam: number; pct: number; precoUn: number } | null {
  if (!cot || !cot.tiers?.length || !cot.unit_price) return null;
  const acima = cot.tiers.filter((t) => t.from > cot.qty).sort((a, b) => a.from - b.from);
  const alvo = acima[0];
  if (!alvo) return null;
  return {
    faltam: alvo.from - cot.qty,
    pct: alvo.pct,
    precoUn: +(cot.unit_price * (1 - alvo.pct / 100)).toFixed(2),
  };
}

/** O WhatsApp digitado só serve se der para responder nele. */
export function telefoneValido(bruto: string): boolean {
  return String(bruto || "").replace(/\D/g, "").length >= 10;
}

export type PendenciaDoLote = string | null;

/**
 * O que ainda falta para pedir o orçamento.
 *
 * A ordem é a da tela: primeiro o que a pessoa preenche primeiro. Devolve
 * `null` quando está tudo pronto — e é isso que libera o botão.
 */
export function pendenciaDoLote(d: {
  evento: string; produtoId: string | null; nomes: string[];
  contato: string; telefone: string;
}): PendenciaDoLote {
  if (!d.evento || d.evento.trim().length < 2) return "Diga de qual evento se trata.";
  if (!d.produtoId) return "Escolha a peça que vai ser personalizada.";
  if (!d.nomes.length) return "Cole a lista de nomes, um por linha.";
  if (!d.contato || d.contato.trim().length < 2) return "Diga seu nome.";
  if (!telefoneValido(d.telefone)) return "Informe um WhatsApp com DDD.";
  return null;
}

/** Reais em pt-BR, sem depender de Intl no react-native-web. */
export function dinheiro(n: number): string {
  return "R$ " + Number(n || 0).toFixed(2).replace(".", ",");
}
