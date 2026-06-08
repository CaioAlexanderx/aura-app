// ============================================================
// Perfil Público Reduzido — Aura Karatê (DESIGN-16)
// Rota: /karate/[slug]/p/[publicToken]  (PÚBLICA, sem login)
//
// Vitrine compartilhável (opt-in do praticante). Dados reduzidos: nome,
// dojô, faixa atual, trajetória só com cor + ano. Sem CPF/contato/histórico.
// Bypass AuthGuard: segments[0]==="karate" && segments[2]==="p".
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, Linking,
  StyleSheet, ViewStyle, TextStyle, Platform, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { beltHex } from "@/constants/karateBelts";
import { karatePortalApi, PublicProfile } from "@/services/karatePortalApi";

function beltLabel(name?: string | null): string {
  return name ? `Faixa ${name.toLowerCase()}` : "—";
}

export default function PublicProfileScreen() {
  const { slug, publicToken } = useLocalSearchParams<{ slug: string; publicToken: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    karatePortalApi.getPublicProfile(String(slug || ""), String(publicToken || ""))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, publicToken]);

  const initial = (data?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.wrap}>
      {loading ? (
        <View style={{ paddingVertical: 60 }}><ActivityIndicator color={KarateColors.primary} /></View>
      ) : notFound || !data ? (
        <View style={styles.card}>
          <View style={styles.nfGlyph}><Ionicons name="eye-off-outline" size={30} color={KarateColors.ink3} /></View>
          <Text style={styles.nfH}>Perfil não disponível</Text>
          <Text style={styles.nfP}>Este perfil público não está ativo ou o link expirou.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {/* header escuro */}
          <View style={styles.ph}>
            <View style={styles.av}><Text style={styles.avTxt}>{initial}</Text></View>
            <Text style={styles.name}>{data.name}</Text>
            <Text style={styles.bl}>{beltLabel(data.current_belt_name)}</Text>
          </View>

          {/* faixa atual */}
          <View style={styles.beltWrap}>
            <View style={[styles.beltBar, { backgroundColor: beltHex(data.current_belt_name) }]} />
          </View>

          {/* grid */}
          <View style={styles.grid}>
            <View style={styles.gCell}><Text style={styles.k}>Dojo</Text><Text style={styles.v}>{data.dojo_name || "—"}</Text></View>
            <View style={styles.gCell}><Text style={styles.k}>Federação</Text><Text style={styles.v}>{data.federation?.name || "FPKT"}</Text></View>
            <View style={styles.gCell}><Text style={styles.k}>Registro</Text><Text style={[styles.v, styles.mono]}>{data.registration || "—"}</Text></View>
            <View style={styles.gCell}><Text style={styles.k}>Situação</Text><Text style={[styles.v, { color: KarateColors.ok }]}>Ativo</Text></View>
          </View>

          {/* trajetória reduzida (cor + ano) */}
          {data.belt_path?.length ? (
            <View style={styles.path}>
              <Text style={styles.pathLbl}>Trajetória</Text>
              <View style={styles.pathRow}>
                {data.belt_path.map((b, i) => (
                  <View key={i} style={styles.pathItem}>
                    <View style={[styles.pathDot, { backgroundColor: beltHex(b.belt_name) }]} />
                    <Text style={styles.pathYear}>{b.year}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* foot */}
          <View style={styles.foot}>
            <Ionicons name="checkmark-circle" size={14} color={KarateColors.ok} />
            <Text style={styles.footTxt}>Perfil público verificado pela {data.federation?.name || "FPKT"}</Text>
          </View>
        </View>
      )}

      <Text style={styles.note}>Perfil público compartilhável. O praticante controla o que aparece aqui — sem CPF, contato ou histórico detalhado.</Text>

      <TouchableOpacity style={styles.auraFooter} onPress={() => Linking.openURL("https://www.getaura.com.br")} accessibilityRole="link">
        <View style={styles.footSeal}><Text style={styles.footSealK}>空</Text></View>
        <View>
          <Text style={styles.footWm}>Aura · Karatê</Text>
          <Text style={styles.footSub}>Plataforma oficial da FPKT</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  wrap: { alignItems: "center", padding: 24, paddingTop: 40, paddingBottom: 56 } as ViewStyle,
  card: {
    width: "100%", maxWidth: 400, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: KarateRadius.lg, overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 16px 40px rgba(28,23,20,0.14)" } as any,
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 5 },
    }),
  } as ViewStyle,

  ph: { backgroundColor: "#221d17", paddingVertical: 28, paddingHorizontal: 26, alignItems: "center" } as ViewStyle,
  av: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#a85c4f", alignItems: "center", justifyContent: "center", marginBottom: 14 } as ViewStyle,
  avTxt: { fontSize: 38, fontWeight: "800", color: "#fbeee4" } as TextStyle,
  name: { fontSize: 24, fontWeight: "800", color: "#f3ece0" } as TextStyle,
  bl: { fontSize: 13, color: "rgba(243,236,224,0.7)", marginTop: 5 } as TextStyle,

  beltWrap: { paddingHorizontal: 26, paddingTop: 18 } as ViewStyle,
  beltBar: { height: 22, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" } as ViewStyle,

  grid: { flexDirection: "row", flexWrap: "wrap", padding: 18 } as ViewStyle,
  gCell: { width: "50%", paddingVertical: 8 } as ViewStyle,
  k: { fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  v: { fontSize: 14, fontWeight: "600", color: KarateColors.ink, marginTop: 3 } as TextStyle,
  mono: { fontFamily: "monospace", fontWeight: "400" } as TextStyle,

  path: { paddingHorizontal: 18, paddingBottom: 14 } as ViewStyle,
  pathLbl: { fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: "monospace", marginBottom: 8 } as TextStyle,
  pathRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  pathItem: { alignItems: "center", gap: 4 } as ViewStyle,
  pathDot: { width: 22, height: 14, borderRadius: 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" } as ViewStyle,
  pathYear: { fontSize: 11, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,

  foot: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  footTxt: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,

  nfGlyph: { width: 66, height: 66, borderRadius: 33, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 32, marginBottom: 16 } as ViewStyle,
  nfH: { fontSize: 20, fontWeight: "800", color: KarateColors.ink, textAlign: "center" } as TextStyle,
  nfP: { fontSize: 14, color: KarateColors.ink2, textAlign: "center", marginTop: 8, paddingHorizontal: 28, paddingBottom: 32, lineHeight: 20 } as TextStyle,

  note: { maxWidth: 400, fontSize: 12, color: KarateColors.ink3, textAlign: "center", marginTop: 16, lineHeight: 18 } as TextStyle,
  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 24 } as ViewStyle,
  footSeal: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK: { fontSize: 14, color: KarateColors.ink3 } as TextStyle,
  footWm: { fontSize: 13, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  footSub: { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
});
