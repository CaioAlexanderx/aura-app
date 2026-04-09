import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";

const CONSENT_KEY = "aura_lgpd_consent";

function getConsent(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(CONSENT_KEY) === "true"; } catch { return false; }
}
function setConsent() {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CONSENT_KEY, "true"); } catch {}
}

export function LGPDConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() { setConsent(); setVisible(false); }

  return (
    <View style={s.bar}>
      <View style={s.inner}>
        <Text style={s.text}>
          A Aura utiliza cookies e dados para melhorar sua experiencia.
          Ao continuar, voce concorda com nossa{" "}
          <Text style={s.link} onPress={() => Linking.openURL("https://getaura.com.br/privacidade")}>
            Politica de Privacidade
          </Text>.
        </Text>
        <Pressable onPress={accept} style={s.btn}>
          <Text style={s.btnText}>Aceitar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bg3,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 16,
    zIndex: 9999,
  },
  inner: {
    maxWidth: 960,
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  text: { flex: 1, fontSize: 12, color: Colors.ink3, lineHeight: 18, minWidth: 200 },
  link: { color: Colors.violet3, textDecorationLine: "underline" },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
