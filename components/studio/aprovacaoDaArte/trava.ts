// ============================================================
// AURA STUDIO · Pedir aprovação da arte: a trava (27/11/2026)
//
// O modal novo (fiel ao mockup da Nina) só aparece atrás da mesma trava das
// outras telas dos Personalizados (#1400): PERSONALIZADOS_LIBERADO ou empresa
// de teste (is_sandbox). As outras lojas, no Studio no ar, seguem com o modal
// de sempre (ApprovalRequestModalAtual).
//
// Quem hospeda o modal dentro de um <Modal> precisa saber qual dos dois vai
// aparecer: o novo traz o próprio pano escuro (Modal transparente, fade); o
// atual não (Modal opaco, slide).
// ============================================================
import { useAuthStore } from "@/stores/auth";
import { PERSONALIZADOS_LIBERADO } from "@/utils/personalizados";
import { empresaSandbox } from "@/utils/whatsappOficialLiberado";

/** A regra pura: o novo vale com a trava geral ou na empresa de teste (nunca no consolidado). */
export function aprovacaoNovaLiberada(
  company: unknown,
  consolidado: boolean = false,
  liberado: boolean = PERSONALIZADOS_LIBERADO,
): boolean {
  return liberado === true || empresaSandbox(company, consolidado);
}

/** Qual modal a empresa atual vê (inscrito no store: reage quando o /auth/me chega). */
export function useAprovacaoNova(): boolean {
  const st: any = useAuthStore();
  return aprovacaoNovaLiberada(st?.company, st?.consolidatedView === true);
}

/** Props do <Modal> que hospeda o modal de aprovação (o novo é transparente e faz fade). */
export function propsDoModalDeAprovacao(nova: boolean): { transparent?: boolean; animationType: "fade" | "slide" } {
  return nova ? { transparent: true, animationType: "fade" } : { animationType: "slide" };
}
