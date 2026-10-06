// WhatsApp da equipe Aura (o mesmo da tela de Planos). Um lugar só para o
// número; cada tela passa o texto pronto da conversa.
export const AURA_WHATSAPP_NUMERO = "5511956305269";

export function waAura(texto: string): string {
  return "https://wa.me/" + AURA_WHATSAPP_NUMERO + "?text=" + encodeURIComponent(texto);
}
