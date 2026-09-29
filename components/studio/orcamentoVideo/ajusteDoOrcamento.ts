// ============================================================
// Orçamento em vídeo · "Cliente pediu ajuste" (28/09/2026, backend 362)
//
// O cliente pede, no WhatsApp da lojista, para mudar algo no orçamento
// enviado. Ela registra aqui e o orçamento volta a ser editável. É
// registro INTERNO: nada vai para o cliente. Regras puras (testáveis).
// ============================================================
import type { StudioQuote } from "@/services/studioApi";

/** Tamanho máximo de "O que o cliente pediu" (o mesmo CHECK do banco). */
export const LIMITE_DO_AJUSTE = 500;

/** Erro do texto do pedido, ou null quando dá para registrar. */
export function erroDoAjuste(texto: string): string | null {
  const limpo = (texto || "").trim();
  if (!limpo) return "Escreva o que o cliente pediu";
  if (limpo.length > LIMITE_DO_AJUSTE) return `Até ${LIMITE_DO_AJUSTE} caracteres`;
  return null;
}

/** Cor fixa do selo (mesma família do "Expirado"), igual no claro e no escuro. */
export const COR_DO_AJUSTE = { bg: "#FEF3C7", text: "#92400E" };

/** O selo "Ajuste pedido": pedido registrado e ainda não reenviado. */
export function temAjustePendente(q: Pick<StudioQuote, "status" | "ajuste_pedido_em"> | null | undefined): boolean {
  return !!q && q.status === "draft" && !!q.ajuste_pedido_em;
}

/** "Versão 2" etc. A versão 1 não precisa ser dita. */
export function rotuloDaVersao(versao: number | null | undefined): string | null {
  const v = Number(versao) || 1;
  return v > 1 ? `Versão ${v}` : null;
}
