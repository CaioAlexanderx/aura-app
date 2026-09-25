// ============================================================
// components/studio/storefront/lojaFechada.ts
//
// A loja fechada para pedidos, fora da tela do produto (Fase 1C, D8).
//
// ── O PROBLEMA ─────────────────────────────────────────────────────────
// Até aqui só o produto respeitava `store.pedidos.aceita === false`. A
// sacola guardada no navegador (localStorage, por loja) sobrevivia ao
// fechamento: a cliente voltava, via "Finalizar →", preenchia o
// checkout inteiro e levava um 409 do servidor na última tela — com o
// recado da lojista em vermelho, como se fosse erro dela.
//
// ── A REGRA ────────────────────────────────────────────────────────────
// Com a loja fechada, a sacola não leva ao checkout: ela explica com o
// recado da loja e oferece "Pedir orçamento", pelo WhatsApp com a lista
// das peças ou, sem WhatsApp cadastrado, pela tela de orçamento em lote.
// Quem decide continua sendo o servidor; aqui só se lê a decisão dele.
// ============================================================
import type { CartLine } from "./types";
import { linkDoOrcamentoDoCarrinho } from "./pedidoPeloWhatsApp";

export type DestinoDoOrcamento =
  | { tipo: "whatsapp"; link: string }
  | { tipo: "lote" };

/**
 * Para onde vai o "Pedir orçamento desta sacola".
 *
 * O WhatsApp é o caminho de quem já montou a sacola: a lojista recebe a
 * lista pronta. Sem número, a tela de lote é o formulário que chega
 * nela — um botão que abre o WhatsApp em branco seria pior que nenhum.
 */
export function destinoDoOrcamento(args: {
  numero?: string | null;
  linhas: CartLine[];
  nomeDaLoja?: string | null;
}): DestinoDoOrcamento {
  const link = linkDoOrcamentoDoCarrinho(args);
  return link ? { tipo: "whatsapp", link } : { tipo: "lote" };
}

export type PedidosDaLoja = {
  aceita: boolean;
  motivo: "pausado" | "prazo" | null;
  recado: string | null;
  pedidos_ate: string | null;
};

/**
 * A resposta do envio diz que a loja fechou enquanto a cliente comprava?
 *
 * O `POST /studio/order` devolve 409 com `{ error: recado, motivo,
 * pedidos_ate }` quando a loja está fechada (studioStorefront.js). O
 * outro 409 da mesma rota — frete desatualizado — não tem `motivo`, e
 * continua sendo um erro comum do formulário.
 *
 * Devolve o `store.pedidos` novo, para a vitrine inteira passar a se
 * comportar como loja fechada, ou `null` quando não é esse o caso.
 */
export function lojaFechouNoEnvio(status: number, corpo: any): PedidosDaLoja | null {
  if (status !== 409 || !corpo || typeof corpo !== "object") return null;
  const motivo = corpo.motivo === "pausado" || corpo.motivo === "prazo" ? corpo.motivo : null;
  if (!motivo) return null;
  const recado = typeof corpo.error === "string" && corpo.error.trim() ? corpo.error.trim() : null;
  return {
    aceita: false,
    motivo,
    recado,
    pedidos_ate: typeof corpo.pedidos_ate === "string" ? corpo.pedidos_ate : null,
  };
}
