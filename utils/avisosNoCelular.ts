// ============================================================
// AURA. — Avisos no celular: convite e regra de quem vê (04/11/2026)
//
// O Web Push existia desde 09/2026, mas o botão se chamava "Aviso de
// pedido novo" (pedido da loja online). Das 25 lojas que venderam no mês,
// só 1 tem loja online: para as outras o aviso não dizia nada, e em
// produção havia UM navegador inscrito. Com os avisos de venda, crediário
// e orçamento (Aura-backend #953), o push passa a valer para a loja de
// balcão — mas só se a dona souber ligar. Daí o convite.
//
// O CONVITE (components/ConviteDeAvisos.tsx, mockup
// docs/mockups/avisos-no-celular.html tela 2):
//   - aparece uma vez por aparelho, no topo do Painel e do Caixa;
//   - só para quem recebe os avisos: dona, admin e acesso total
//     (permissions null). Funcionária com Financeiro recebe o aviso, mas
//     ligar é decisão da dona (◆ do mockup);
//   - "Agora não" esconde para sempre neste aparelho (não é como o convite
//     de instalar, que volta em 14 dias: insistir num aviso é o jeito mais
//     rápido de ele ser bloqueado no navegador);
//   - nunca aparece com o aviso já ligado, bloqueado ou sem suporte.
//
// Puro (sem React/RN/store): o jest carrega direto.
// ============================================================

export const CHAVE_DO_CONVITE = "aura.avisos.convite.dispensado";

export const TEXTO_DO_CONVITE = {
  titulo: "Saiba de cada venda no celular",
  descricao: "Venda, crediário recebido, orçamento aprovado e pedido online chegam como notificação, mesmo com a Aura fechada.",
  ligar: "Ligar avisos",
  agoraNao: "Agora não",
  ligado: "Avisos ligados neste aparelho.",
  bloqueado: "O navegador bloqueou as notificações. Libere nas configurações do site.",
} as const;

/** Dona, admin e acesso total: quem decide ligar os avisos. */
export function podeVerConvite(permData: any): boolean {
  if (!permData) return false;
  if (permData.is_owner) return true;
  if (permData.role === "owner" || permData.role === "admin") return true;
  return permData.permissions == null;
}

function armazenamento(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function conviteDispensado(): boolean {
  try {
    return armazenamento()?.getItem(CHAVE_DO_CONVITE) === "1";
  } catch {
    return false;
  }
}

export function dispensarConvite(): void {
  try {
    armazenamento()?.setItem(CHAVE_DO_CONVITE, "1");
  } catch {
    /* sem armazenamento: o card volta na próxima abertura, só isso */
  }
}

/** Só para teste. */
export function _limparConvite(): void {
  try {
    armazenamento()?.removeItem(CHAVE_DO_CONVITE);
  } catch {
    /* nada */
  }
}
