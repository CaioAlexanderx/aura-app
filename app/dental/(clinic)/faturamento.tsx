import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ConvêniosTab } from "@/components/verticals/odonto/OdontoAdminTabs";
import { BillingDashboard } from "@/components/verticals/odonto/BillingDashboard";
import { RepasseDentista } from "@/components/verticals/odonto/RepasseDentista";
import { TissUnifiedTab } from "@/components/verticals/odonto/TissUnifiedTab";
import { NfseTab } from "@/components/verticals/odonto/NfseTab";
import { DentalColors } from "@/constants/dental-tokens";

// Faturamento — fonte unica financeira da clinica dental.
// PR20 (2026-04-27): TISS e Reconciliar TISS colapsados em uma tab
// unica que tem sub-nav interna (Convênios | Guias | Lotes | Reconciliar).
// Reduz overload visual e remove modal full-screen do TissDashboard antigo.

const TABS = [
  { id: "cobranças",  label: "Cobranças",          Component: BillingDashboard },
  { id: "nfse",       label: "NFS-e",              Component: NfseTab },
  { id: "tiss",       label: "TISS",               Component: TissUnifiedTab },
  { id: "repasses",   label: "Repasses",           Component: RepasseDentista },
  { id: "convênios",  label: "Convênios (legado)", Component: ConvêniosTab },
];

export default function FaturamentoScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>NEGÓCIO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Faturamento</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Cobranças, NFS-e, TISS, repasses e convênios da clínica.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setActive(t.id)} style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            borderWidth: 1,
            borderColor: active === t.id ? DentalColors.cyanBorder : DentalColors.border,
            backgroundColor: active === t.id ? DentalColors.cyanDim : "transparent",
          }}>
            <Text style={{ fontSize: 12, color: active === t.id ? DentalColors.cyan : DentalColors.ink2, fontWeight: "600" }}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View>{Active && <Active />}</View>
    </View>
  );
}
