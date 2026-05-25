import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioGestaoFinanceiro() {
  return (
    <StudioPlaceholder
      icon="dollar-sign"
      phase="Atalho · módulo financeiro do Aura"
      title="Financeiro"
      subtitle="Caixa, contas a pagar/receber, DRE e cobranças. O mesmo Financeiro do Aura, filtrando pedidos Studio quando relevante."
      bullets={[
        "Caixa do dia com filtro por vertical=studio",
        "Contas a receber dos pedidos personalizados",
        "DRE consolidado (varejo + Studio juntos ou separado)",
        "Reaproveita 100% o módulo financeiro do Aura — sem duplicação",
      ]}
    />
  );
}
