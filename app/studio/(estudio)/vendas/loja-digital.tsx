import { StudioBridge } from "@/components/studio/StudioBridge";

export default function StudioVendasLojaDigital() {
  return (
    <StudioBridge
      eyebrow="VENDAS · LOJA DIGITAL"
      title="Storefront pra vender online"
      subtitle="Página pública onde o cliente vê seus produtos, configura a personalização e fecha o pedido pelo Pix."
      bridgeHref="/(tabs)/canal"
      bridgeIcon="globe"
      bridgeLabel="Abrir Canal Digital"
      bridgeNote="O Canal Digital do Aura Varejo já te dá uma vitrine pública com Pix manual + cartão Mercado Pago. Configure aqui e seus produtos personalizáveis ficam disponíveis pra venda."
      futureFeatures={[
        "Configurador de personalização embutido na página do produto (cliente vê preview ao vivo)",
        "Upload de foto direto pela página pública (sem precisar mandar no WhatsApp)",
        "Galeria de templates exposta — cliente escolhe arte pronta sem mandar nada",
        "Notificação automática pra você quando pedido novo cair (com mockup pronto pra aprovar)",
        "Página pública de aprovação de arte com link wa.me (Fase 5 já entregue no backend)",
      ]}
    />
  );
}
