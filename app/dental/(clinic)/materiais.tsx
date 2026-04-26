import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SuppliesTab } from "@/components/verticals/odonto/SuppliesTab";
import { LabTab } from "@/components/verticals/odonto/LabTab";
import { DentalColors } from "@/constants/dental-tokens";

// Materiais — insumos clinicos + laboratorio.
// SUBSTITUI o /estoque generico para usuarios com vertical=odonto.

const TABS = [
  { id: "insumos",     label: "Insumos clinicos", Component: SuppliesTab },
  { id: "laboratorio", label: "Laboratorio",      Component: LabTab },
];

export default function MateriaisScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>NEGOCIO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Materiais</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Insumos clinicos consumiveis e ordens de laboratorio.</Text>
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
