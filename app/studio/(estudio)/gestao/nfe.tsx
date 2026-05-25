import { StudioBridge } from "@/components/studio/StudioBridge";

export default function StudioGestaoNfe() {
  return (
    <StudioBridge
      eyebrow="GESTÃO · NF-e / NFC-e"
      title="Documentos fiscais do estúdio"
      subtitle="Emissão de NFC-e nas vendas + NF-e modelo 55 quando necessário."
      bridgeHref="/(tabs)/nfe"
      bridgeIcon="file-text"
      bridgeLabel="Abrir NF-e / NFC-e"
      bridgeNote="A central de NF-e do Aura emite NFC-e (consumidor final) automaticamente em cada venda, e NF-e modelo 55 sob demanda. Funciona pro Studio do mesmo jeito que pro varejo."
      futureFeatures={[
        "NCM padrão Studio (por tipo de produto: caneca, camiseta, brinde, etc) — pré-configurado",
        "Descrição automática da NFC-e incluindo a personalização (\"Caneca personalizada para João\")",
        "Histórico de NF-es por pedido Studio (uma view integrada com produção)",
        "Alerta de produto sem NCM cadastrado antes de virar personalizável",
      ]}
    />
  );
}
