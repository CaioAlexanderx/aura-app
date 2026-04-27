// ============================================================
// ConsultaAiPanelGated — placeholder do painel IA.
//
// Plano Negocio+ = mostra chat real (a integracao backend vem
// em PR18, ate la mostra estado vazio "IA disponivel — em breve
// integracao com motor LLM").
//
// Plano abaixo de Negocio = bloqueia com CTA pra upgrade.
//
// Doc: PLANO_IA_PLANO_EXPANSAO.md
// ============================================================

import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { DentalColors } from "@/constants/dental-tokens";
import { useAiAccess } from "@/hooks/useAiAccess";

export function ConsultaAiPanelGated() {
  const access = useAiAccess();
  const router = useRouter();

  if (access.canUseAi) {
    return (
      <View style={{ flex: 1, padding: 12, backgroundColor: DentalColors.bg }}>
        <Text style={{
          fontSize: 9, color: DentalColors.ink3, fontWeight: "700",
          letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8,
        }}>
          ✨ IA AURA
        </Text>
        <View style={{
          flex: 1, backgroundColor: DentalColors.bg2,
          borderWidth: 1, borderColor: DentalColors.border,
          borderRadius: 10, padding: 16, alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Text style={{ fontSize: 24 }}>✨</Text>
          <Text style={{ fontSize: 12, color: DentalColors.ink, fontWeight: "700", textAlign: "center" }}>
            IA Aura disponivel no seu plano
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink2, textAlign: "center", lineHeight: 16, maxWidth: 280 }}>
            Integracao com motor LLM (brief contextual, sugestoes em tempo real, resumo da consulta) chega em breve.
          </Text>
          <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700", letterSpacing: 1, marginTop: 4 }}>
            EM IMPLEMENTACAO · PR18
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: DentalColors.bg }}>
      <Text style={{
        fontSize: 9, color: DentalColors.ink3, fontWeight: "700",
        letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8,
      }}>
        ✨ IA AURA
      </Text>
      <View style={{
        flex: 1, backgroundColor: DentalColors.bg2,
        borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
        borderRadius: 10, padding: 16, alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <Text style={{ fontSize: 28 }}>🔒</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink, fontWeight: "700", textAlign: "center" }}>
          IA Aura · disponivel no plano {access.requiredPlanLabel}+
        </Text>
        <Text style={{ fontSize: 11, color: DentalColors.ink2, textAlign: "center", lineHeight: 16, maxWidth: 280 }}>
          Brief pre-consulta inteligente, sugestoes em tempo real, perguntas livres e resumo automatico da evolucao clinica.
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/configuracoes")}
          style={{
            backgroundColor: DentalColors.violet, borderRadius: 8,
            paddingHorizontal: 14, paddingVertical: 8, marginTop: 6,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Ver plano {access.requiredPlanLabel}</Text>
        </Pressable>
        <Text style={{ fontSize: 9, color: DentalColors.ink3, marginTop: 4 }}>
          Plano atual: {access.plan}
        </Text>
      </View>
    </View>
  );
}
