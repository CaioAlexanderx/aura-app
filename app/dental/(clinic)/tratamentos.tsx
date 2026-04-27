import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { OrcamentosTab } from "@/components/verticals/odonto/OdontoAdminTabs";
import { DentalFunnel } from "@/components/verticals/odonto/DentalFunnel";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";

// Tratamentos — visão global de captação e orçamentos da clínica.
//
// PR14 (2026-04-27): removido Implantes e Ortodontia desta tela.
// Esses workflows sao por-paciente (ImplantWorkflow / OrthoWorkflow
// exigem prop patient: PatientLite) e ja vivem dentro do PatientHub.
// Tentar renderizar standalone causava crash em `patient.id`.
// Hint visual no final aponta o caminho correto.

const TABS = [
  { id: "orcamentos", label: "Orçamentos",     Component: OrcamentosTab },
  { id: "funil",      label: "Funil de leads", Component: DentalFunnel },
];

export default function TratamentosScreen() {
  const [active, setActive] = useState(TABS[0].id);
  const Active = TABS.find((t) => t.id === active)?.Component;
  const router = useRouter();

  return (
    <View>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>OPERACAO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Tratamentos</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Orçamentos e funil de captação. Workflows clínicos detalhados (Implantes, Ortodontia, Anamnese) vivem dentro de cada paciente.</Text>
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

      {/* Hint: workflows clínicos vivem por paciente */}
      <Pressable
        onPress={() => router.push("/dental/(clinic)/pacientes" as any)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          marginTop: 24, padding: 14,
          backgroundColor: DentalColors.cyanGhost,
          borderRadius: 12, borderWidth: 1, borderColor: DentalColors.cyanBorder,
        }}
      >
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: DentalColors.cyanDim,
          alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="users" size={16} color={DentalColors.cyan} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: DentalColors.ink, marginBottom: 2 }}>
            Workflows clínicos por paciente
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink2, lineHeight: 16 }}>
            Implantes, Ortodontia, Anamnese e Periograma são acessados em Pacientes → abrir paciente → aba específica.
          </Text>
        </View>
        <Icon name="chevron_right" size={14} color={DentalColors.cyan} />
      </Pressable>
    </View>
  );
}
