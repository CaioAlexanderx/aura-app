import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { KarateFederationProvider } from "@/contexts/KarateFederation";
import { KarateShell } from "@/components/karate/KarateShell";
import { useAuthStore } from "@/stores/auth";
import { KarateColors } from "@/constants/karateTheme";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];

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

  // 3) Empresa karatê: provê o contexto e renderiza o shell (que tem o <Slot/>)
  return (
    <KarateFederationProvider>
      <KarateShell />
    </KarateFederationProvider>
  );
}