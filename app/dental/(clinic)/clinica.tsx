import { View, Text } from "react-native";
import { DentalSettings } from "@/components/verticals/odonto/DentalSettings";
import { DentalAiSettingsCard } from "@/components/dental/DentalAiSettingsCard";
import { DentalColors } from "@/constants/dental-tokens";

// Clinica — configuracoes da clinica, equipe, cadeiras, especialidades + IA Aura.

export default function ClinicaScreen() {
  return (
    <View>
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>CONFIGURACOES</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Clinica</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Cadeiras, equipe, especialidades, IA e ajustes operacionais.</Text>
      </View>
      <DentalAiSettingsCard />
      <DentalSettings />
    </View>
  );
}
