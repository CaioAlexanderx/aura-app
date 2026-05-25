import { StudioBridge } from "@/components/studio/StudioBridge";

export default function StudioGestaoFinanceiro() {
  return (
    <StudioBridge
      eyebrow="GESTÃO · FINANCEIRO"
      title="Financeiro do estúdio"
      subtitle="Entradas, saídas, fluxo de caixa, margem real por produto personalizado."
      bridgeHref="/(tabs)/financeiro"
      bridgeIcon="dollar-sign"
      bridgeLabel="Abrir Financeiro"
      bridgeNote="O Financeiro Aura te dá DRE completo, fluxo de caixa, comparativos e margem por produto. Suas vendas Studio entram automaticamente no caixa."
      futureFeatures={[
        "Recorte só do Studio: receita/margem isolada do varejo (se você tem os 2 verticais)",
        "Margem real calculada a partir da Ficha Técnica (insumos consumidos por venda)",
        "Tempo médio de produção × ticket médio — entender quais produtos compensam",
        "Alerta de produto com margem abaixo de % (configurável em Configurações)",
        "Top 5 produtos personalizáveis por receita / por lucro",
      ]}
    />
  );
}
