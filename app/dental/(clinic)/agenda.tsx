import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { AgendaTab } from "@/components/verticals/odonto/OdontoClinicTabs";
import { AgendaOnlineTab } from "@/components/verticals/odonto/OdontoAdminTabs";
import { DentalColors } from "@/constants/dental-tokens";

// Agenda — operacao da agenda interna + canal de agendamento online.

const TABS = [
  { id: "agenda-dia",    label: "Hoje e proximos",    Component: AgendaTab },
  { id: "agenda-online", label: "Agendamento online", Component: AgendaOnlineTab },
];

export default function AgendaScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>OPERACAO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Agenda</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Visao da agenda da clinica + canal publico de agendamento.</Text>
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
