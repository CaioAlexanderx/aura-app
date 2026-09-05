import { useSegments } from "expo-router";
import { useState, useEffect, useSyncExternalStore } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking, type LayoutChangeEvent } from "react-native";
import { Colors } from "@/constants/colors";

const STORAGE_KEY = "aura_lgpd_consent";
const PRIVACY_URL = "https://getaura.com.br/privacidade";

// 29/08/2026 — o banner passou a ter recusa. "all" = aceitou tudo (gravado como
// "1", o valor historico: quem ja tinha aceitado nao ve o banner de novo).
// "essential" = recusou os nao-essenciais (dados de uso/telemetria).
export type LgpdConsent = "all" | "essential";

export function getLgpdConsent(): LgpdConsent | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "1" || v === "all") return "all";
    if (v === "essential") return "essential";
    return null;
  } catch { return null; }
}

// 29/08/2026 — porta unica para qualquer coleta NAO-essencial (analytics,
// telemetria, heatmap). Hoje ninguem consome: o app nao dispara telemetria
// nenhuma. Quem ligar a primeira tem que checar isto antes de mandar evento.
export function hasAnalyticsConsent(): boolean {
  return getLgpdConsent() === "all";
}

export function saveConsent(choice: LgpdConsent) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, choice === "all" ? "1" : "essential");
    }
  } catch {}
}

// ── Espaco reservado para o banner ───────────────────────────
// 29/08/2026 (QA da porta de entrada): o banner e ancorado no rodape e vinha
// POR CIMA do conteudo — em 375px cobria metade do "Continuar" do cadastro e
// escondia o divisor "ou" do login. Agora ele publica a propria altura e as
// telas de auth reservam esse espaco (ver app/(auth)/_layout.tsx). Enquanto o
// banner nao esta visivel a altura e 0, entao o desktop nao ganha vao nenhum.
let insetHeight = 0;
const insetSubs = new Set<() => void>();

function publishInset(h: number) {
  const next = Math.round(h);
  if (next === insetHeight) return;
  insetHeight = next;
  insetSubs.forEach((fn) => fn());
}

function subscribeInset(fn: () => void) {
  insetSubs.add(fn);
  return () => { insetSubs.delete(fn); };
}

export function useLgpdConsentInset(): number {
  return useSyncExternalStore(subscribeInset, () => insetHeight, () => 0);
}

// 05/09/2026: a vitrine publica (loja.getaura.com.br/<slug> e
// /cardapio/...) tem o proprio aviso, na cor da loja e so quando a loja
// rastreia algo (ver storefront/ConsentimentoDaVitrine.tsx). Este banner
// e do PAINEL: violeta escuro, fala em "app", e por cima da loja de uma
// cliente ele parecia propaganda de outra empresa.
const RAIZES_PUBLICAS = new Set(["[slug]", "cardapio"]);

export function LGPDConsent() {
  const [visible, setVisible] = useState(false);
  const segments = useSegments() as string[];
  const naVitrine = RAIZES_PUBLICAS.has(String(segments[0] || ""));

  useEffect(() => {
    // So aparece na web (mobile ja tem termos aceitos no cadastro)
    if (Platform.OS !== "web") return;
    if (naVitrine) return;
    // Pequeno delay para nao competir com splash
    const t = setTimeout(() => {
      if (!getLgpdConsent()) setVisible(true);
    }, 1200);
    return () => { clearTimeout(t); publishInset(0); };
  }, [naVitrine]);

  function decide(choice: LgpdConsent) {
    saveConsent(choice);
    setVisible(false);
    // Libera o espaco reservado assim que o banner sai da tela.
    publishInset(0);
  }

  function handlePrivacy() {
    Linking.openURL(PRIVACY_URL);
  }

  if (!visible || naVitrine) return null;

  return (
    <View
      style={s.overlay}
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => publishInset(e.nativeEvent.layout.height)}
    >
      <View style={s.banner}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Text style={s.icon}>!</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Cookies e privacidade</Text>
            <Text style={s.text}>
              Usamos cookies essenciais para o funcionamento do app e dados de uso para melhorar sua experiência, conforme a{" "}
              <Text style={s.link} onPress={handlePrivacy}>Lei Geral de Proteção de Dados (LGPD)</Text>
              . Nenhum dado é vendido a terceiros. Você pode ficar só com os essenciais.
            </Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable onPress={handlePrivacy} style={s.ghostBtn} accessibilityRole="link">
            <Text style={s.ghostBtnText}>Política de privacidade</Text>
          </Pressable>
          <Pressable onPress={() => decide("essential")} style={s.secondaryBtn} accessibilityRole="button">
            <Text style={s.secondaryBtnText}>Só os essenciais</Text>
          </Pressable>
          <Pressable onPress={() => decide("all")} style={s.acceptBtn} accessibilityRole="button">
            <Text style={s.acceptBtnText}>Entendi e aceito</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: 16,
    pointerEvents: "box-none" as any,
  },
  banner: {
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    maxWidth: 640,
    alignSelf: "center",
    width: "100%",
    // Sombra web
    ...(Platform.OS === "web" ? { boxShadow: "0 -4px 32px rgba(0,0,0,0.5)" } as any : {}),
  },
  content: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  icon:   { fontSize: 16, fontWeight: "800", color: Colors.violet3 },
  title:  { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  text:   { fontSize: 11, color: Colors.ink3, lineHeight: 17 },
  link:   { color: Colors.violet3, fontWeight: "600" },
  // flexWrap: em 375px os tres botoes nao cabem na mesma linha — quebram em
  // vez de estourar a largura do banner.
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" },
  ghostBtn: { paddingVertical: 9, paddingHorizontal: 6 },
  ghostBtnText: { fontSize: 11, color: Colors.ink3, fontWeight: "500", textDecorationLine: "underline" },
  secondaryBtn: {
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  acceptBtn: {
    backgroundColor: Colors.violet, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  acceptBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },
});

export default LGPDConsent;
