// ============================================================
// AURA. — Oferta "vamos configurar juntos": textos e link (18/10/2026, f2-04)
//
// Cartão discreto no Painel de quem acabou de se cadastrar: uma conversa de
// 20 minutos com o time da Aura (o Caio faz o onboarding pessoalmente,
// decisão de 15/09). O botão abre o WhatsApp da Aura com o texto pronto; o
// número vem de constants/suporteAura.ts (um lugar só).
//
// Linguagem para quem não é técnico: nada de "onboarding", "setup" ou "call".
// ============================================================
import { waAura } from "@/constants/suporteAura";

/** Chave de módulo própria do cartão (CLAUDE.md, armadilha 3). */
export const MOD_CONFIGURAR_JUNTOS = "onboarding.configurar_juntos";

export const TEXTOS_CONFIGURAR_JUNTOS = {
  titulo: "Quer configurar junto com a gente?",
  sub: "Uma conversa de 20 minutos para deixar o Caixa e o estoque prontos.",
  marcar: "Marcar pelo WhatsApp",
  agoraNao: "Agora não",
  aberto: "Abrimos a conversa no WhatsApp. É só combinar com a gente o melhor horário.",
  fechar: "Fechar",
} as const;

/** Texto pronto da conversa. Sem nome da loja, vira "minha loja". */
export function mensagemConfigurarJuntos(loja: string | null | undefined): string {
  const nome = String(loja || "").trim() || "minha loja";
  return "Oi! Acabei de criar a conta da " + nome + " na Aura e quero marcar os 20 minutos para configurar juntos.";
}

/** wa.me do número da Aura com a mensagem pronta. */
export function linkConfigurarJuntos(loja: string | null | undefined): string {
  return waAura(mensagemConfigurarJuntos(loja));
}
