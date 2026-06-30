// ============================================================
// Hub do microsite da federação — Aura Karatê (frente 3)
//
// Rota: /karate/[slug]  (raiz do subdomínio {slug}.getaura.com.br após a
// reescrita do Cloudflare → /karate/{slug}). Lançador Shoji para as páginas
// públicas: ranking, portal do praticante e portal do dojô.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { karateCompetitionsApi } from "@/services/karateCompetitionsApi";

const LINKS: { key: string; title: string; sub: string; icon: string; path: string }[] = [
  { key: "ranking",     title: "Ranking",            sub: "Classificação por temporada e categoria", icon: "podium-outline",       path: "ranking" },
  { key: "praticante",  title: "Portal do praticante", sub: "Carteirinha digital e histórico",        icon: "person-circle-outline", path: "praticante" },
  { key: "dojo",        title: "Portal do dojô",     sub: "Filiação, anuidade e praticantes",        icon: "business-outline",      path: "dojo" },
];

export default function MicrositeHub() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [fedName, setFedName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    karateCompetitionsApi.getPublicSeasons(slug as string)
      .then((s) => { if (alive && s?.federation?.name) setFedName(s.federation.name); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <FpktLogo size={72} />
          <Text style={styles.eyebrow}>Federação</Text>
          <Text style={styles.h1}>{fedName ?? "Aura Karatê"}</Text>
          <Text style={styles.sub}>Documento oficial · serviços ao atleta e ao dojô</Text>
        </View>

        <View style={styles.grid}>
          {LINKS.map((l) => (
            <TouchableOpacity
              key={l.key}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/karate/${slug}/${l.path}` as any)}
              accessibilityLabel={l.title}
            >
              <View style={styles.cardIcon}>
                <Icon name={l.icon} size={22} color={KarateColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                <Text style={styles.cardSub}>{l.sub}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.foot}>
          <View style={styles.footSeal}><Text style={styles.footSealK}>空</Text></View>
          <Text style={styles.footWm}>Aura Karatê</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, paddingTop: 40, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" } as ViewStyle,
  header: { alignItems: "center", gap: 7, marginBottom: 28 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: KarateColors.primary, textTransform: "uppercase", marginTop: 6 } as TextStyle,
  h1: { fontFamily: KarateFonts.heading, fontSize: 30, fontWeight: "400", color: KarateColors.ink, textAlign: "center", lineHeight: 36 } as TextStyle,
  sub: { fontSize: 13.5, color: KarateColors.ink3, textAlign: "center" } as TextStyle,

  grid: { gap: 12 } as ViewStyle,
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: KarateColors.glass, borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: 14, padding: 16,
  } as ViewStyle,
  cardIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine,
  } as ViewStyle,
  cardTitle: { fontFamily: KarateFonts.heading, fontSize: 18, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  foot: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 32 } as ViewStyle,
  footSeal: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK: { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink3 } as TextStyle,
  footWm: { fontFamily: KarateFonts.heading, fontSize: 14, color: KarateColors.ink2 } as TextStyle,
});
