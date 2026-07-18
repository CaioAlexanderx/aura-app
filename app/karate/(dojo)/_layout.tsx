// ============================================================
// Layout do grupo (dojo) — Aura Karatê F1 (shell completo do dojô)
//
// O grupo vive DENTRO do segmento /karate (nunca grupo nu na raiz do
// app). Rotas: /karate (Painel), /karate/praticantes, /karate/
// solicitacoes, /karate/eventos, /karate/anuidade, /karate/certificados,
// /karate/configuracoes.
//
// ⚠️ ROTAS COMPARTILHADAS: index/praticantes/eventos/configuracoes
// existem TAMBÉM no grupo (federation). Na resolução de URL sem grupo,
// (dojo) vem primeiro (ordem alfabética) — por isso TODO redirect
// cross-shell leva o nome do grupo no href ("/karate/(federation)…"),
// senão /karate resolveria de volta pra cá e viraria loop.
//
// Gate (padrão do antigo sensei/_layout): espera hidratar → exige
// vertical karatê → exige dojo_id (o JWT de dojô carrega dojo_id;
// federação NÃO entra aqui e volta pro shell dela preservando a seção
// quando ela existe lá).
// ============================================================
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Redirect, usePathname } from "expo-router";
import { KarateFederationProvider } from "@/contexts/KarateFederation";
import { KarateDojoProvider } from "@/contexts/KarateDojo";
import { DojoShell } from "@/components/karate/DojoShell";
import { useAuthStore } from "@/stores/auth";
import { KarateColors } from "@/constants/karateTheme";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];

// Seções cuja URL também existe no grupo (federation) — deep-link de
// usuário de federação cai aqui primeiro; devolvemos preservando a seção.
const FEDERATION_SHARED_SECTIONS = ["praticantes", "eventos", "configuracoes"];

function FederationRedirect() {
  const path = usePathname();
  const seg = (path || "").split("?")[0].split("/").filter(Boolean)[1] ?? "";
  const href = FEDERATION_SHARED_SECTIONS.includes(seg)
    ? `/karate/(federation)/${seg}`
    : "/karate/(federation)";
  return <Redirect href={href as any} />;
}

export default function DojoLayout() {
  const { isHydrated, company } = useAuthStore();

  // 1) Espera a sessão hidratar (nunca decidir com company ainda vazio).
  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  // 2) Vertical karatê obrigatória.
  const vertical = (company as any)?.vertical ?? (company as any)?.vertical_active;
  if (!KARATE_VERTICALS.includes(vertical as string)) {
    return <Redirect href="/(tabs)" />;
  }

  // 3) Este grupo é do DOJÔ: exige dojo_id no JWT. Conta karatê sem
  // dojo_id (a federação) volta pro shell administrativo dela.
  const dojoId = (company as any)?.dojo_id;
  if (!dojoId) {
    return <FederationRedirect />;
  }

  // 4) Dojô sem federação vinculada: estado claro, sem provider com id falso
  // (mesmo padrão do (federation)/_layout).
  const federationId = (company as any)?.federation_id;
  if (!federationId) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: KarateColors.ink, fontSize: 16, textAlign: "center", marginBottom: 8 }}>
          Seu dojô ainda não está vinculado a uma federação.
        </Text>
        <Text style={{ color: KarateColors.ink3, fontSize: 14, textAlign: "center" }}>
          Fale com o suporte da Aura para concluir a ativação.
        </Text>
      </View>
    );
  }

  return (
    <KarateFederationProvider>
      <KarateDojoProvider>
        <DojoShell />
      </KarateDojoProvider>
    </KarateFederationProvider>
  );
}
