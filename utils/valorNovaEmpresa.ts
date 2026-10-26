// ============================================================
// AURA. — Textos do valor de uma empresa nova (multi-CNPJ)
//
// 25/10/2026 (decisão do Caio): no Negócio o 2º CNPJ deixou de vir incluído
// e custa 50% do valor do plano no ciclo da assinatura. O valor exato vem do
// backend (GET /me/companies/billing-preview, tabela única em
// billingPricing): aqui só montamos as frases. O plano vem do próprio
// preview (lido do banco), não do JWT, que pode estar desatualizado.
// ============================================================
import { formatBRL, type BillingPreviewResponse } from "@/services/multicnpj";

export function avisoDoPlano(plan: string | null | undefined): string {
  const p = String(plan || "").toLowerCase();
  if (p === "negocio") {
    return "No Negócio, a segunda empresa sai com 50% de desconto sobre o seu plano. Mostramos o valor antes de você confirmar.";
  }
  if (p === "expansao") {
    return "No Expansão, sua assinatura cobre 2 CNPJs. CNPJs adicionais têm valor extra, que mostramos antes de você confirmar.";
  }
  return "CNPJs além dos incluídos no seu plano têm valor extra, que mostramos antes de você confirmar.";
}

// Frase do valor com a empresa nova, a partir do billing-preview.
// null = sem preview (ou plano que não permite): a tela não mostra nada.
export function resumoDaNovaEmpresa(preview: BillingPreviewResponse | null | undefined): string | null {
  if (!preview || !preview.can_add || !preview.current || !preview.if_add_one) return null;
  const atual = preview.current.total_monthly;
  const novo = preview.if_add_one.new_total_monthly;
  const delta = preview.if_add_one.delta_monthly;

  if (preview.if_add_one.ajuste_pela_equipe) {
    return (
      "Pela tabela, sua mensalidade com esta empresa seria " + formatBRL(novo) +
      ". Como sua assinatura tem uma condição especial, a equipe Aura confirma o valor com você antes de qualquer mudança."
    );
  }
  if (!(delta > 0)) {
    return "Esta empresa está incluída no seu plano: a mensalidade continua " + formatBRL(atual) + ".";
  }
  return (
    "Com esta empresa, sua mensalidade vai de " + formatBRL(atual) + " para " + formatBRL(novo) +
    " (mais " + formatBRL(delta) + " por mês)."
  );
}
