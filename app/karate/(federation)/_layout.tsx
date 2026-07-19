import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { KarateFederationProvider } from "@/contexts/KarateFederation";
import { KarateShell } from "@/components/karate/KarateShell";
import { KarateBillingGate } from "@/components/karate/KarateBillingGate";
import { ToastContainer } from "@/components/Toast";
import { ConfirmHost } from "@/components/karate/ConfirmDialog";
import { useAuthStore } from "@/stores/auth";
import { KarateColors } from "@/constants/karateTheme";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];
// Papéis de dojô: usam o shell COMPLETO do dojô — grupo /karate/(dojo)
// (F1 Aura Dojô; antes era o shell light /karate/sensei, que hoje só
// redireciona pra lá).
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

  // 2b) Track G/F1: papéis de dojô (sensei/dono) vão pro shell completo
  // do dojô — grupo (dojo) —, não pro shell administrativo da federação.
  // O href LEVA o nome do grupo: index/praticantes/eventos/configuracoes
  // são rotas compartilhadas entre (dojo) e (federation), e um href nu
  // ("/karate") resolveria de volta pro outro grupo e viraria loop.
  const karateRole = (company as any)?.karate_role;
  if (DOJO_ROLES.includes(karateRole as string)) {
    return <Redirect href={"/karate/(dojo)" as any} />;
  }

  // 3) Sem mock: o federationId vem do JWT (company.federation_id). Se a
  // conta karatê não estiver vinculada a uma federação, não montamos o
  // provider com um id falso — mostramos um estado claro.
  const federationId = (company as any)?.federation_id;
  if (!federationId) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: KarateColors.ink, fontSize: 16, textAlign: "center", marginBottom: 8 }}>
          Sua conta de karatê ainda não está vinculada a uma federação.
        </Text>
        <Text style={{ color: KarateColors.ink3, fontSize: 14, textAlign: "center" }}>
          Fale com o suporte da Aura para concluir a ativação.
        </Text>
      </View>
    );
  }

  // 4) Empresa karatê (federação): provê o contexto e renderiza o shell (com <Slot/>)
  return (
    <KarateFederationProvider>
      <KarateShell />
      {/* Checkout "invisível": só aparece (bloqueante) quando a federação
          está em atraso/vencimento; caso contrário renderiza null. */}
      <KarateBillingGate federationId={federationId} />
      <ToastContainer />
      <ConfirmHost />
    </KarateFederationProvider>
  );
}
