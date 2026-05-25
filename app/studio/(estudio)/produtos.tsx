import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioProdutos() {
  return (
    <StudioPlaceholder
      icon="shopping-bag"
      phase="Fase 1 · em construção"
      title="Produtos personalizáveis"
      subtitle="Aqui você cadastra quais produtos aceitam personalização e configura o que o cliente pode mudar (texto, foto, galeria de templates)."
      bullets={[
        "Lista de produtos com badge \"personalizável on/off\"",
        "Wizard de 4 passos pra configurar cada produto",
        "Pré-visualização SVG ao vivo da personalização",
        "Integra com o catálogo do PDV — sem duplicação",
      ]}
    />
  );
}
