// ============================================================
// Layout do grupo (karate) — Aura Karatê
//
// Espelha padrão de app/studio/(estudio)/_layout.tsx:
// 1. isHydrated — aguarda auth
// 2. Provê KarateFederationProvider
// 3. Renderiza KarateShell (shell responsivo Shoji)
//
// Gate de plano: por ora libera para todos os usuários com
// vertical=karate_federation. TODO: adicionar gate quando
// o fluxo de onboarding de federação for concluído.
// ============================================================
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { KarateFederationProvider } from "@/contexts/KarateFederation";
import { KarateShell } from "@/components/karate/KarateShell";
import { useAuthStore } from "@/stores/auth";
import { KarateColors } from "@/constants/karateTheme";

export default function KarateLayout() {
  const { isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  return (
    <KarateFederationProvider>
      <KarateShell />
    </KarateFederationProvider>
  );
}
