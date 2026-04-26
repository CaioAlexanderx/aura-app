import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { OdontogramaTab, ProntuarioTab } from "@/components/verticals/odonto/OdontoClinicTabs";
import { DentalColors } from "@/constants/dental-tokens";

// Atendimento — espaco clinico do dentista.
// Odontograma + Prontuario. Anamnese, periograma, fichas por
// especialidade e imagens clinicas vivem dentro do PatientHub
// (acessado via Pacientes > Lista > paciente especifico).

const TABS = [
  { id: "odontograma", label: "Odontograma", Component: OdontogramaTab },
  { id: "prontuario",  label: "Prontuario",  Component: ProntuarioTab },
];

export default function AtendimentoScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>OPERACAO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Atendimento</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Odontograma e prontuario para consulta clinica.</Text>
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
