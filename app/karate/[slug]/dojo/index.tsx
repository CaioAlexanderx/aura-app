// ============================================================
// Entrada do Portal do Dojô — Aura Karatê (Canal B / link fixo)
//
// Rota: /karate/[slug]/dojo?t=<token>
// O acesso é por LINK FIXO não-expirável enviado pela federação. Aqui só
// capturamos o token da URL (?t=), validamos contra o backend e
// redirecionamos para /portal. Não há login por OTP — quem tem o link entra.
//
// Sem token (ou link inválido/revogado): orienta o sensei a usar o link
// recebido da federação.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  ScrollView, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { karateDojoPortalApi } from "@/services/karateDojoPortalApi";
import { useDojoPortal } from "./_layout";

type Stage = "checking" | "invalid" | "no-token";

export default function DojoPortalEntry() {
  const { slug, t } = useLocalSearchParams<{ slug: string; t?: string }>();
  const router = useRouter();
  const { setToken } = useDojoPortal();

  const [stage, setStage] = useState<Stage>(t ? "checking" : "no-token");

  useEffect(() => {
    if (!t) { setStage("no-token"); return; }
    let alive = true;
    (async () => {
      try {
        await karateDojoPortalApi.getMe(t);          // valida o link fixo
        if (!alive) return;
        setToken(t);
        router.replace(`/karate/${slug}/dojo/portal` as any);
      } catch {
        if (alive) setStage("invalid");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <FpktLogo size={56} />
          <Text style={styles.title}>Portal do Dojô</Text>
          <Text style={styles.subtitle}>Acesso da federação · documento oficial</Text>
        </View>

        {stage === "checking" ? (
          <View style={styles.card}>
            <ActivityIndicator color={KarateColors.primary} />
            <Text style={styles.cardText}>Validando seu link de acesso…</Text>
          </View>
        ) : stage === "invalid" ? (
          <View style={styles.card}>
            <Ionicons name="lock-closed-outline" size={28} color={KarateColors.primary} />
            <Text style={styles.cardTitle}>Link inválido ou revogado</Text>
            <Text style={styles.cardText}>
              Este link de acesso não é mais válido. Solicite um novo link à federação.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Ionicons name="link-outline" size={28} color={KarateColors.ink3} />
            <Text style={styles.cardTitle}>Acesse pelo seu link</Text>
            <Text style={styles.cardText}>
              O portal do dojô abre por um link permanente que a federação envia por
              WhatsApp ou e-mail. Use esse link para entrar — não há senha nem código.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 24, alignItems: "center" } as ViewStyle,
  header: { alignItems: "center", gap: 8, paddingVertical: 24 } as ViewStyle,
  title: { fontFamily: KarateFonts.heading, fontSize: 26, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  subtitle: { fontSize: 13, color: KarateColors.ink3, textAlign: "center" } as TextStyle,
  card: {
    width: "100%", maxWidth: 420, backgroundColor: KarateColors.glass,
    borderRadius: 16, borderWidth: 1, borderColor: KarateColors.border,
    padding: 24, gap: 12, alignItems: "center",
  } as ViewStyle,
  cardTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  cardText: { fontSize: 14, color: KarateColors.ink2, textAlign: "center", lineHeight: 20 } as TextStyle,
});
