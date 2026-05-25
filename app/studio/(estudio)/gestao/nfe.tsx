import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioGestaoNfe() {
  return (
    <StudioPlaceholder
      icon="file-text"
      phase="Atalho · módulo fiscal do Aura"
      title="NF-e / NFC-e"
      subtitle="Emissão de notas fiscais e cupons. Pedidos do Studio emitem cupom normal — o que muda é o histórico filtrável por vertical."
      bullets={[
        "Emissão automática ao confirmar pedido (Studio ou varejo)",
        "Cancelamento, devolução e inutilização",
        "Histórico filtrável por vertical e período",
        "Reaproveita módulo NFC-e/NF-e do Aura — sem duplicação",
      ]}
    />
  );
}
