// ============================================================
// Modo Consulta — rota fullscreen.
//
// /dental/consulta/[appointmentId]
//
// Vive FORA do grupo (clinic), por isso nao herda DentalShell.
// Renderiza ocupando 100% da viewport. Guard de vertical=odonto
// + plan check (qualquer plano com odonto pode iniciar consulta;
// IA dentro e que e gated por Negocio+).
// ============================================================

import { useLocalSearchParams, Redirect } from "expo-router";
import { View, Text } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { ConsultaShell } from "@/components/dental/consulta/ConsultaShell";
import { DentalColors } from "@/constants/dental-tokens";

export default function ConsultaRoute() {
  const params = useLocalSearchParams<{ appointmentId: string }>();
  const { company, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return <View style={{ flex: 1, backgroundColor: DentalColors.bg }} />;
  }
  if ((company as any)?.vertical_active !== "odonto") {
    return <Redirect href="/(tabs)" />;
  }
  if (!params.appointmentId || typeof params.appointmentId !== "string") {
    return (
      <View style={{ flex: 1, backgroundColor: DentalColors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: DentalColors.ink, fontSize: 14 }}>Atendimento nao encontrado</Text>
      </View>
    );
  }
  return <ConsultaShell appointmentId={params.appointmentId} />;
}
