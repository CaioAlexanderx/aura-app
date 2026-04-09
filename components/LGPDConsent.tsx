import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";

const CONSENT_KEY = "aura_lgpd_consent";
const isWeb = Platform.OS === "web";

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
