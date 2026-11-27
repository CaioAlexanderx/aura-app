// ============================================================
// waGratis — o caminho grátis do Venda+ quando as novidades acabam
//
// Sem o adicional (o saldo não renova: presente de boas-vindas do Essencial) e com as
// novidades esgotadas, a Aura não manda mais pelo número oficial. A lojista chama a
// cliente pelo WhatsApp do próprio celular: um toque por cliente abre o wa.me com o
// texto do Venda+ já preenchido (nome e peça). Não gasta saldo e a Aura não envia nada.
// ============================================================

/** A oferta do adicional, em uma linha: só no Essencial, quando o presente de boas-vindas acaba. No Negócio, só "Adicionar 100 novidades por R$ 69". */
export const TEXTO_OFERTA_UMA_LINHA = "Ou assine + R$ 29/mês: 10 novidades todo mês.";

/** wa.me com o texto pronto. Telefone sem DDI (10 ou 11 dígitos) ganha 55. Sem telefone válido: null. */
export function linkWaMe(telefone: string | null | undefined, texto: string): string | null {
  let d = String(telefone || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.length < 12 || d.length > 15) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
