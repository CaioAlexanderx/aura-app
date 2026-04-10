import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";

const STORAGE_KEY = "aura_lgpd_consent";
const PRIVACY_URL = "https://getaura.com.br/privacidade";

function getConsent(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch { return false; }
}

function saveConsent() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
  } catch {}
}

export function LGPDConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // So aparece na web (mobile ja tem termos aceitos no cadastro)
    if (Platform.OS !== "web") return;
    // Pequeno delay para nao competir com splash
    const t = setTimeout(() => {
      if (!getConsent()) setVisible(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  function handleAccept() {
    saveConsent();
    setVisible(false);
  }

  function handlePrivacy() {
    Linking.openURL(PRIVACY_URL);
  }

  if (!visible) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <View style={s.banner}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Text style={s.icon}>!</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Cookies e privacidade</Text>
            <Text style={s.text}>
              Usamos cookies essenciais para o funcionamento do app e dados de uso para melhorar sua experiencia, conforme a{" "}
              <Text style={s.link} onPress={handlePrivacy}>Lei Geral de Protecao de Dados (LGPD)</Text>
              . Nenhum dado e vendido a terceiros.
            </Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable onPress={handlePrivacy} style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>Politica de privacidade</Text>
          </Pressable>
          <Pressable onPress={handleAccept} style={s.acceptBtn}>
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
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  secondaryBtn: {
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  acceptBtn: {
    backgroundColor: Colors.violet, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  acceptBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },
});

export default LGPDConsent;
