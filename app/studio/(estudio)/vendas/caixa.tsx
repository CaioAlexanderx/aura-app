import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioVendasCaixa() {
  return (
    <StudioPlaceholder
      icon="credit-card"
      phase="Atalho · reaproveita PDV existente"
      title="Caixa / PDV"
      subtitle="O PDV do varejo continua sendo a fonte de verdade. Aqui vai abrir o PDV com filtro automático nos produtos personalizáveis."
      bullets={[
        "Mesmo PDV do varejo, sem duplicação",
        "Filtro automático: só produtos com is_personalizable=true",
        "Configuração de personalização aparece no add-to-cart",
        "Fluxo de pagamento idêntico ao varejo",
      ]}
    />
  );
}
