import { View, Text } from "react-native";
import { OdontoDashboard } from "@/components/verticals/odonto/OdontoDashboard";
import { DentalColors } from "@/constants/dental-tokens";

// Tela inicial da experiencia Aura Odonto.
// Reusa OdontoDashboard ja existente; iteracoes futuras podem
// adicionar saudacao personalizada, agenda do dia em destaque,
// recalls do dia (ver mockup-portal-aura-odonto.html).

export default function HojeScreen() {
  return (
    <View>
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>OPERACAO</Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>Hoje</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>Visao geral do dia: agenda, indicadores e proximas acoes.</Text>
      </View>
      <OdontoDashboard />
    </View>
  );
}
