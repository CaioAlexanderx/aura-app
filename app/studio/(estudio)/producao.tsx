import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioProducao() {
  return (
    <StudioPlaceholder
      icon="clock"
      phase="Fase 4 · em construção"
      title="Linha de produção"
      subtitle="Painel KDS adaptado pro Studio com 4 colunas: Aguardando arte · Em produção · Pronto · Entregue. Cards com mockup, prazo, cliente e botão de próxima ação."
      bullets={[
        "Drag entre colunas + click no botão guiado (workflow)",
        "Alertas vermelhos pra pedidos atrasados",
        "Filtro por SLA, vendedor e tipo de produto",
        "Reaproveita o KDS Food (memory projeto_aura_food_fases3_4)",
      ]}
    />
  );
}
