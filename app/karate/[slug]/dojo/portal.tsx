// ============================================================
// Portal Autenticado do Dojô — Aura Karatê (Fase 0 / Canal B)
//
// Rota: /karate/[slug]/dojo/portal
// Requer token dojo_portal (do fluxo OTP em /dojo/index.tsx).
// Chama GET /federation/:federationId/dojo/me para hidratar dados.
//
// Stub Fase 0: exibe nome e contexto do dojô.
// Fases 1-6 adicionam sub-seções (certificados, anuidade, etc.)
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { useDojoPortal } from "./_layout";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

interface DojoInfo {
  id: string;
  name: string;
  phone: string | null;
  federation_id: string;
  auth_channel: "A" | "B";
}

export default function DojoPortal() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { token, federationId, clearAuth } = useDojoPortal();

  const [dojo, setDojo] = useState<DojoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !federationId) {
      router.replace(`/karate/${slug}/dojo` as any);
      return;
    }
    fetch(`${API}/api/v1/federation/${federationId}/dojo/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.dojo) setDojo(data.dojo);
        else setError("Não foi possível carregar os dados do dojô.");
      })
      .catch(() => setError("Erro de conexão."))
      .finally(() => setLoading(false));
  }, [token, federationId]);

  function handleLogout() {
    clearAuth();
    router.replace(`/karate/${slug}/dojo` as any);
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <FpktLogo size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.dojoName} numberOfLines={1}>
            {dojo?.name ?? "Carregando…"}
          </Text>
          <Text style={styles.dojoSub}>Portal do Dojô · Fase 0</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={KarateColors.ink3} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} style={{ marginTop: 48 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : dojo ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Informações do Dojô</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Nome</Text>
                <Text style={styles.rowValue}>{dojo.name}</Text>
              </View>
              {dojo.phone && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Telefone</Text>
                  <Text style={styles.rowValue}>{dojo.phone}</Text>
                </View>
              )}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Canal de acesso</Text>
                <Text style={[styles.rowValue, { color: KarateColors.primary }]}>
                  Canal {dojo.auth_channel} ({dojo.auth_channel === "A" ? "Aura Dojô" : "Off-app"})
                </Text>
              </View>
            </View>

            <View style={styles.placeholderCard}>
              <Ionicons name="construct-outline" size={32} color={KarateColors.ink3} />
              <Text style={styles.placeholderTitle}>Fase 0 — Keystone</Text>
              <Text style={styles.placeholderText}>
                Autenticação Canal B funcionando.{"\n"}
                Certificados, anuidade e eventos chegam nas fases seguintes.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  logoMark: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  kanji: { fontFamily: KarateFonts.heading, fontSize: 19, color: KarateColors.primary } as TextStyle,
  dojoName: { fontFamily: KarateFonts.heading, fontSize: 16, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  dojoSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  logoutBtn: { padding: 8 } as ViewStyle,
  content: { padding: 16, gap: 16 } as ViewStyle,
  infoCard: { backgroundColor: KarateColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 12 } as ViewStyle,
  sectionTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 } as TextStyle,
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 } as ViewStyle,
  rowLabel: { fontSize: 14, color: KarateColors.ink3, flex: 1 } as TextStyle,
  rowValue: { fontSize: 14, fontWeight: "700", color: KarateColors.ink, flex: 2, textAlign: "right" } as TextStyle,
  placeholderCard: { backgroundColor: KarateColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: KarateColors.border, padding: 24, alignItems: "center", gap: 8 } as ViewStyle,
  placeholderTitle: { fontFamily: KarateFonts.heading, fontSize: 16, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  placeholderText: { fontSize: 13, color: KarateColors.ink3, textAlign: "center", lineHeight: 20 } as TextStyle,
  errorBox: { padding: 24, alignItems: "center" } as ViewStyle,
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center" } as TextStyle,
});
