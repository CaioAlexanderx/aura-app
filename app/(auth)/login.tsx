import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading }    = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao entrar.");
    }
  }

  const formCard = (
    <View style={s.card}>
      <Text style={s.title}>Entrar</Text>
      <Text style={s.subtitle}>Bem-vindo de volta</Text>
      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail}
          placeholder="seu@email.com" placeholderTextColor={Colors.ink3}
          autoCapitalize="none" keyboardType="email-address" />
      </View>
      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <TextInput style={s.input} value={password} onChangeText={setPassword}
          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" placeholderTextColor={Colors.ink3}
          secureTextEntry />
      </View>
      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
      </TouchableOpacity>
      <View style={s.footerRow}>
        <Text style={s.footerText}>Ainda n\u00e3o tem conta? </Text>
        <Link href="/(auth)/register"><Text style={s.link}>Criar conta</Text></Link>
      </View>
    </View>
  );

  if (!isWeb) {
    return (
      <ScrollView contentContainerStyle={s.mobile}>
        <TouchableOpacity onPress={() => Linking.openURL("https://getaura.com.br")} style={s.mobileLogo}>
          <Text style={s.mobileWordmark}>aura.</Text>
          <Text style={s.mobileTagline}>TECNOLOGIA PARA NEG\u00d3CIOS</Text>
        </TouchableOpacity>
        {formCard}
      </ScrollView>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "row", height: "100vh", width: "100vw",
      background: `radial-gradient(ellipse at 15% 50%, rgba(109,40,217,0.22) 0%, transparent 55%),
                   radial-gradient(ellipse at 85% 15%, rgba(91,140,255,0.14) 0%, transparent 50%),
                   radial-gradient(ellipse at 55% 85%, rgba(139,92,246,0.12) 0%, transparent 45%),
                   ${Colors.bg}`,
    } as any}>

      {/* Painel esquerdo */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 56 } as any}>
        <a href="https://getaura.com.br" target="_blank" rel="noreferrer" style={{ textDecoration: "none", textAlign: "center" } as any}>
          <svg width="100" height="100" viewBox="0 0 120 120">
            <defs>
              <radialGradient id="lg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e0c4ff" stopOpacity="1" />
                <stop offset="40%" stopColor="#a855f7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="lo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="60%" stopColor="#d8b4fe" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="56" fill="url(#lg)" opacity="0.2" />
            <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(196,181,253,0.6)" strokeWidth="1.8" />
            <circle cx="60" cy="60" r="37" fill="none" stroke="rgba(196,181,253,0.5)" strokeWidth="1.3" />
            <circle cx="60" cy="60" r="28" fill="none" stroke="rgba(196,181,253,0.4)" strokeWidth="1.3" />
            <circle cx="60" cy="60" r="20" fill="none" stroke="rgba(196,181,253,0.3)" strokeWidth="1.3" />
            <path d="M60 14 A46 46 0 0 1 106 60" fill="none" stroke="#c4b5fd" strokeWidth="2.2" opacity="0.85" />
            <path d="M60 23 A37 37 0 0 1 97 60" fill="none" stroke="#a78bfa" strokeWidth="1.6" opacity="0.65" />
            <circle cx="60" cy="60" r="10" fill="url(#lo)" />
            <circle cx="60" cy="60" r="4.5" fill="white" />
          </svg>
          <div style={{ fontSize: 44, color: Colors.ink, fontWeight: 300, letterSpacing: -2, marginTop: 12, fontFamily: "Georgia, serif" } as any}>
            aura<span style={{ color: Colors.violet3 }}>.</span>
          </div>
          <div style={{ fontSize: 9, color: Colors.ink3, letterSpacing: 4, marginTop: 4 } as any}>
            TECNOLOGIA PARA NEG\u00d3CIOS
          </div>
        </a>

        <div style={{ width: 44, height: 1, background: Colors.border2, margin: "32px 0" } as any} />

        <p style={{ fontSize: 18, color: Colors.ink2, lineHeight: 1.75, textAlign: "center", margin: 0 } as any}>
          Gest\u00e3o completa<br />para MEI e ME.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 210, marginTop: 28 } as any}>
          {["\u2713 Financeiro & DRE", "\u2713 PDV & Estoque", "\u2713 Contabilidade", "\u2713 Canal Digital"].map(b => (
            <div key={b} style={{ background: Colors.violetD, border: `1px solid ${Colors.border2}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: Colors.violet3 } as any}>{b}</div>
          ))}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ width: 1, background: Colors.border, margin: "48px 0" } as any} />

      {/* Painel direito */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: 56, background: "rgba(6,8,22,0.55)" } as any}>
        {formCard}
      </div>
    </div>
  );
}

const s = StyleSheet.create({
  mobile:         { flexGrow: 1, backgroundColor: Colors.bg, padding: 28, justifyContent: "center", alignItems: "center" },
  mobileLogo:     { alignItems: "center", marginBottom: 32 },
  mobileWordmark: { fontSize: 40, color: Colors.violet4, fontWeight: "300", letterSpacing: -1 },
  mobileTagline:  { fontSize: 9, color: Colors.ink3, letterSpacing: 3, marginTop: 4 },
  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: Colors.border2,
  },
  title:     { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:     { marginBottom: 16 },
  label:     { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:     { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 13, fontSize: 14, color: Colors.ink },
  btn:       { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 4 },
  btnText:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText:{ fontSize: 13, color: Colors.ink3 },
  link:      { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
