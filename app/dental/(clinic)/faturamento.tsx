import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ConveniosTab } from "@/components/verticals/odonto/OdontoAdminTabs";
import { BillingDashboard } from "@/components/verticals/odonto/BillingDashboard";
import { RepasseDentista } from "@/components/verticals/odonto/RepasseDentista";
import { TissTab } from "@/components/verticals/odonto/TissTab";
import { NfseTab } from "@/components/verticals/odonto/NfseTab";
import { DentalColors } from "@/constants/dental-tokens";

// Faturamento — fonte unica financeira da clinica dental.
// SUBSTITUI o /financeiro generico para usuarios com vertical=odonto.
// Decisao 2026-04-25 (memory: plano_aura_odonto_portal).

const TABS = [
  { id: "cobrancas", label: "Cobrancas",          Component: BillingDashboard },
  { id: "nfse",      label: "NFS-e",              Component: NfseTab },
  { id: "tiss",      label: "TISS",               Component: TissTab },
  { id: "repasses",  label: "Repasses",           Component: RepasseDentista },
  { id: "convenios", label: "Convenios (legado)", Component: ConveniosTab },
];

export default function FaturamentoScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>NEGOCIO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Faturamento</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Cobrancas, NFS-e, TISS, repasses e convenios da clinica.</Text>
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
