// ============================================================
// AURA. — "Contratar acesso" no limite de funcionários da Equipe (p-106)
//
// Para onde vai o botão, de acordo com a conta:
//   valor combinado          → WhatsApp de ajuda (o combinado já inclui os
//                              acessos e só a equipe muda);
//   sem assinatura em dia    → checkout, com o seletor de acessos de
//                              funcionário (p-106);
//   ativa e em dia, temporada → /black-friday#assento: o acesso de
//                              funcionário para a temporada;
//   ativa e em dia, fora dela → WhatsApp de ajuda. O backend recusa mudar
//                              acessos pelo checkout para loja ativa no
//                              mesmo plano (409 ASSINATURA_ATIVA).
// Puro, para ser testado sem renderizar.
// ============================================================
import { waAura } from "@/constants/suporteAura";
import { ROTA_DO_ASSENTO } from "@/utils/linkDoAssento";

export const TEXTO_CONTRATAR_ACESSO = "Contratar acesso";
export const ROTA_CHECKOUT_DOS_ACESSOS = "/(tabs)/checkout";
export const MENSAGEM_WHATSAPP_ACESSO = "Oi, Aura! Quero contratar mais um acesso de funcionário para a minha loja.";
export const MENSAGEM_WHATSAPP_ACESSO_COMBINADO = "Oi, Aura! Tenho valor combinado e quero contratar mais um acesso de funcionário para a minha loja.";

export type DestinoDoContratarAcesso =
  | { tipo: "checkout"; rota: string }
  | { tipo: "assento"; rota: string }
  | { tipo: "whatsapp"; url: string };

export function destinoDoContratarAcesso(o: { emDia: boolean; combinado: boolean; temporada: boolean }): DestinoDoContratarAcesso {
  if (o.combinado) return { tipo: "whatsapp", url: waAura(MENSAGEM_WHATSAPP_ACESSO_COMBINADO) };
  if (!o.emDia) return { tipo: "checkout", rota: ROTA_CHECKOUT_DOS_ACESSOS };
  if (o.temporada) return { tipo: "assento", rota: ROTA_DO_ASSENTO };
  return { tipo: "whatsapp", url: waAura(MENSAGEM_WHATSAPP_ACESSO) };
}
