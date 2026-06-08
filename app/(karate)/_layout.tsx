// ============================================================
// Layout do grupo (karate) — Aura Karatê
//
// HOTFIX incidente 08/06: este grupo é um ROUTE GROUP nu — suas telas
// registram rotas na RAIZ ("/", "/financeiro", ...) que COLIDEM com as do
// grupo (tabs) (Aura Negócio). Como este _layout renderiza KarateShell
// diretamente (sem <Slot/>) e NÃO checava a vertical, empresas não-karatê
// (ex.: Davi Calçados, vertical=null) passaram a ver o shell de Karatê
// assim que o export web voltou a funcionar (#196).
//
// Gate: só empresas com vertical karate_federation/karate_dojo entram no
// shell; as demais são redirecionadas para /(tabs) (mesmo alvo que o
// AuthGuard raiz usa para o Aura Negócio).
//
// FOLLOW-UP (correção definitiva): mover este grupo para um SEGMENTO real
// — app/karate/(federation)/... — espelhando app/dental/(clinic),
// app/food/(salao) e app/studio/(estudio). Isso elimina a colisão de rota
// na raiz e permite roteamento próprio (/karate, /karate/dojos, ...).
// ============================================================
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

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  const vertical = (company as any)?.vertical ?? (company as any)?.vertical_active;
  const isKarate = KARATE_VERTICALS.includes(vertical as string);

  // Empresa não-karatê não deve ver o shell de Karatê (colisão de rota).
  if (!isKarate) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KarateFederationProvider>
      <KarateShell />
    </KarateFederationProvider>
  );
}
