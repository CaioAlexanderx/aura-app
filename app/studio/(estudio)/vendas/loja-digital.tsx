import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioVendasLoja() {
  return (
    <StudioPlaceholder
      icon="globe"
      phase="Atalho · reaproveita Canal Digital"
      title="Loja digital"
      subtitle="Sua storefront pública. Cliente final entra, escolhe produto, faz personalização e fecha pedido. Hub Studio recebe e empurra pra produção."
      bullets={[
        "Página de produto com upload de arte + preview SVG ao vivo (Fase 1)",
        "Galeria pronta de templates (Fase 2)",
        "Pedidos chegam com customization preservada por item",
        "Compartilha o mesmo domínio/slug do Canal Digital",
      ]}
    />
  );
}
