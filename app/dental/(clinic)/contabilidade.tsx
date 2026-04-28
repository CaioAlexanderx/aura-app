// ============================================================
// /dental/(clinic)/contabilidade
//
// PR32 #18 (2026-04-28): trazer modulo Contabilidade do shell violet
// pro shell odonto. Reusa ContabilidadeScreen (que ja tem hooks +
// componentes prontos: FiscalHero, DasPreviewCard, UpcomingAlerts,
// ObligationTimeline, etc).
//
// Dentista que abre /dental/(clinic)/contabilidade ve as obrigacoes
// fiscais da empresa sem precisar trocar pro Aura Negocio.
// ============================================================

import ContabilidadeScreen from "@/app/(tabs)/contabilidade";

export default function DentalContabilidadeScreen() {
  return <ContabilidadeScreen />;
}
