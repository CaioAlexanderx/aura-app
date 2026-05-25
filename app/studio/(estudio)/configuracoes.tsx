import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioConfiguracoes() {
  return (
    <StudioPlaceholder
      icon="settings"
      phase="Fase 0+ · em construção"
      title="Configurações do Studio"
      subtitle="Aqui você liga/desliga features, define prazos padrão de produção e conecta o WhatsApp pra enviar aprovação de arte aos clientes."
      bullets={[
        "Toggles: KDS, galeria, aprovação de arte",
        "WhatsApp pra aprovação (modo wa.me ou Business API)",
        "SLA padrão por tipo de produto",
        "Fontes e cores permitidas globalmente nas personalizações",
      ]}
    />
  );
}
