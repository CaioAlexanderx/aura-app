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
// shell. As demais são redirecionadas para o EQUIVALENTE em (tabs) — assim
// "/" cai no painel do Negócio e "/financeiro" no Financeiro do Negócio
// (e não no painel), preservando a navegação.
//
// FOLLOW-UP (correção definitiva): mover este grupo para um SEGMENTO real
// — app/karate/(federation)/... — espelhando app/dental/(clinic),
// app/food/(salao) e app/studio/(estudio). Isso elimina a colisão de rota
// na raiz e permite roteamento próprio (/karate, /karate/dojos, ...).
// Requer `git mv` (delete) — fora do alcance da API de conteúdo do GitHub.
// ============================================================
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, usePathname } from "expo-router";
import { KarateFederationProvider } from "@/contexts/KarateFederation";
import { KarateShell } from "@/components/karate/KarateShell";
import { useAuthStore } from "@/stores/auth";
import { KarateColors } from "@/constants/karateTheme";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];

// Rotas do grupo (karate) que colidem com telas do Aura Negócio (grupo tabs).
// Mapeadas para o equivalente qualificado por grupo, para não perder navegação.
const TABS_EQUIVALENT: Record<string, string> = {
  "/financeiro": "/(tabs)/financeiro",
};

export default function KarateLayout() {
  const { isHydrated, company } = useAuthStore();
  const pathname = usePathname();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  const vertical = (company as any)?.vertical ?? (company as any)?.vertical_active;
  const isKarate = KARATE_VERTICALS.includes(vertical as string);

  // Empresa não-karatê não deve ver o shell de Karatê (colisão de rota):
  // redireciona para o equivalente no Aura Negócio.
  if (!isKarate) {
    const target = TABS_EQUIVALENT[pathname] || "/(tabs)";
    return <Redirect href={target as any} />;
  }

  return (
    <KarateFederationProvider>
      <KarateShell />
    </KarateFederationProvider>
  );
}
