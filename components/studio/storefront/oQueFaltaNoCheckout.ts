// ============================================================
// components/studio/storefront/oQueFaltaNoCheckout.ts
//
// O botão "Enviar pedido" desabilitado DIZ o que falta.
//
// ── O QUE ACONTECIA (QA de 04/09/2026) ─────────────────────────────────
// Com nome ou WhatsApp em branco o botão ficava cinza e mudo. A cliente
// com pressa via um botão apagado, tocava, nada acontecia, e não havia
// nada na tela dizendo por quê — o campo obrigatório estava acima, fora
// da dobra do celular. "Botão desabilitado diz o que falta" é critério
// de aceite da LJ-07 e a régua de qualquer checkout.
//
// A frase é uma só, curta, e nasce daqui para o componente não ter de
// montar português com condicionais.
// ============================================================

export function oQueFaltaNoCheckout(args: {
  itens: number;
  nome: string;
  whatsapp: string;
}): string | null {
  const faltas: string[] = [];
  if (!String(args.nome || "").trim()) faltas.push("seu nome");
  if (!String(args.whatsapp || "").trim()) faltas.push("seu WhatsApp");

  // Carrinho vazio é outro problema: não é campo a preencher, é peça a
  // escolher — e vem antes de qualquer campo.
  if (!(Number(args.itens) > 0)) return "Escolha uma peça para enviar o pedido.";
  if (!faltas.length) return null;
  if (faltas.length === 1) return `Falta ${faltas[0]} para enviar o pedido.`;
  return `Faltam ${faltas[0]} e ${faltas[1]} para enviar o pedido.`;
}
