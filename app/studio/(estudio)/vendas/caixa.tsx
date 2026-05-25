import { StudioBridge } from "@/components/studio/StudioBridge";

export default function StudioVendasCaixa() {
  return (
    <StudioBridge
      eyebrow="VENDAS · CAIXA / PDV"
      title="Caixa do estúdio"
      subtitle="Frente de caixa pra registrar pedidos personalizados, pagamentos e impressão de NFC-e."
      bridgeHref="/(tabs)/pdv"
      bridgeIcon="credit-card"
      bridgeLabel="Abrir PDV"
      bridgeNote="O PDV do Aura Varejo funciona normalmente — você cadastra produto personalizável em Estúdio › Produtos e vende aqui. Os pedidos aparecem em Produção automaticamente."
      futureFeatures={[
        "Wizard de personalização dentro do PDV (campos do produto aparecem ao escolher)",
        "Preview SVG ao vivo do que o cliente está pedindo",
        "Captura de telefone do cliente já pré-formatada pra aprovação de arte",
        "Trigger automático do fluxo de aprovação de arte ao fechar venda",
        "SLA de produção calculado em tempo real baseado na fila atual",
      ]}
    />
  );
}
