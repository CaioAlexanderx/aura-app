// ============================================================
// /dental/(clinic)/contabilidade
//
// PR32 #18 (2026-04-28): trazer modulo Contabilidade do shell violet
// pro shell odonto. Reusa ContabilidadeScreen (que ja tem hooks +
// componentes prontos: FiscalHero, DasPreviewCard, UpcomingAlerts,
// ObligationTimeline, etc).
//
// PR37 (2026-04-28): pluga DentalComplianceConfigCard ANTES do
// ContabilidadeScreen. Card cadastra alvara, CRO, RT, CNES e flag
// uses_controlled_meds em companies. Backend obligationsCalendar
// le esses dados pra calcular vencimentos saude (cnae=saude).
// ============================================================

import { ScrollView, View } from "react-native";
import ContabilidadeScreen from "@/app/(tabs)/contabilidade";
import { DentalComplianceConfigCard } from "@/components/dental/DentalComplianceConfigCard";

export default function DentalContabilidadeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }}>
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <DentalComplianceConfigCard />
        </View>
        <ContabilidadeScreen />
      </ScrollView>
    </View>
  );
}
