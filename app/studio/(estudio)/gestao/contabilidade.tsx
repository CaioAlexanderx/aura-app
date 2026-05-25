import { StudioBridge } from "@/components/studio/StudioBridge";

export default function StudioGestaoContabilidade() {
  return (
    <StudioBridge
      eyebrow="GESTÃO · CONTABILIDADE"
      title="Contabilidade do estúdio"
      subtitle="Relatórios mensais, DRE, obrigações fiscais — tudo pra mandar pro seu contador."
      bridgeHref="/(tabs)/contabilidade"
      bridgeIcon="calculator"
      bridgeLabel="Abrir Contabilidade"
      bridgeNote="A central de Contabilidade do Aura gera relatórios mensais consolidados, DRE, e lista de obrigações fiscais. Suas operações Studio entram automaticamente nos relatórios."
      futureFeatures={[
        "Recorte Studio: relatório separado quando você tem vertical mista (varejo + Studio)",
        "Exportação direta pro contador com tag \"Aura Studio\" no e-mail",
        "Conciliação automática de insumos consumidos (entrada NF-e fornecedor × baixa por venda)",
        "Calendário de obrigações específico pra negócios de personalização (ICMS-ST quando aplicável)",
      ]}
    />
  );
}
