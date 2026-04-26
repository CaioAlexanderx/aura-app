import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { AutomationConfig } from "@/components/verticals/odonto/AutomationConfig";
import { RetornoTab } from "@/components/verticals/odonto/RetornoTab";
import { DentalColors } from "@/constants/dental-tokens";

// Comunicacao — automacoes e recall/retorno de pacientes.

const TABS = [
  { id: "retorno",    label: "Retorno e recall", Component: RetornoTab },
  { id: "automacoes", label: "Automacoes",       Component: AutomationConfig },
];

export default function ComunicacaoScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>NEGOCIO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Comunicacao</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Recall, retorno e automacoes de mensagens com pacientes.</Text>
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
