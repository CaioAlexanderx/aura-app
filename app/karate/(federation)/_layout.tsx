import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { KarateFederationProvider } from "@/contexts/KarateFederation";
import { KarateShell } from "@/components/karate/KarateShell";
import { useAuthStore } from "@/stores/auth";
import { KarateColors } from "@/constants/karateTheme";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];
// Papéis de dojô: usam o shell light /karate/sensei (somente leitura).
const DOJO_ROLES = ["sensei", "dojo_owner"];

export default function KarateLayout() {
  const { isHydrated, company } = useAuthStore();

  // 1) Espera a sessão hidratar (evita decidir com company ainda vazio)
  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  // 2) Gate por vertical: só federação/dojô de karatê entram no shell
  const vertical = (company as any)?.vertical ?? (company as any)?.vertical_active;
  if (!KARATE_VERTICALS.includes(vertical as string)) {
    return <Redirect href="/(tabs)" />;   // empresa não-karatê → home do Aura Negócio
  }

  // 2b) Track G: papéis de dojô (sensei/dono) vão pro shell light do sensei,
  // não pro shell administrativo da federação.
  const karateRole = (company as any)?.karate_role;
  if (DOJO_ROLES.includes(karateRole as string)) {
    return <Redirect href="/karate/sensei" />;
  }

  // 3) Empresa karatê (federação): provê o contexto e renderiza o shell (com <Slot/>)
  return (
    <KarateFederationProvider>
      <KarateShell />
    </KarateFederationProvider>
  );
}
