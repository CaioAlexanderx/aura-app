import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

const LOGO_URL = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg";

const FEATURES = [
  { icon: "\u{1F4CA}", label: "Organização Financeira" },
  { icon: "\u{1F4E6}", label: "Controle de Estoque e Vendas" },
  { icon: "\u{1F4CB}", label: "Contabilidade Integrada" },
  { icon: "\u{1F310}", label: "Identidade Digital para seu negócio" },
];


// W-01
if (typeof document !== "undefined" && !document.getElementById("aura-grad")) { const _g = document.createElement("style"); _g.id = "aura-grad"; _g.textContent = "@keyframes auraGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}"; document.head.appendChild(_g); }
export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const { login, loginDemo, isLoading } = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao entrar.");
    }
  }

  async function handleDemo() {
    await loginDemo();
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
          placeholder="••••••••" placeholderTextColor={Colors.ink3}
          secureTextEntry />
      </View>
      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
      </TouchableOpacity>
      <View style={s.footerRow}>
        <Text style={s.footerText}>Ainda não tem conta? </Text>
        <Link href="/(auth)/register"><Text style={s.link}>Criar conta</Text></Link>
      </View>
      <View style={s.divider} />
      <TouchableOpacity style={s.demoBtn} onPress={handleDemo} disabled={isLoading}>
        <Text style={s.demoBtnText}>Explorar modo demonstrativo</Text>
      </TouchableOpacity>
    </View>
  );

  if (!isWeb) {
    return (
      <ScrollView contentContainerStyle={s.mobile}>
        <TouchableOpacity onPress={() => Linking.openURL("https://getaura.com.br")} style={s.mobileLogo}>
          <img src={LOGO_URL} alt="Aura." style={{ width: 180, height: "auto" } as any} />
        </TouchableOpacity>
        {formCard}
      </ScrollView>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "row", height: "100vh", width: "100vw",
      backgroundSize: "200% 200%", animation: "auraGrad 15s ease infinite", background: `radial-gradient(ellipse at 15% 50%, rgba(109,40,217,0.22) 0%, transparent 55%),
                   radial-gradient(ellipse at 85% 15%, rgba(91,140,255,0.14) 0%, transparent 50%),
                   radial-gradient(ellipse at 55% 85%, rgba(139,92,246,0.12) 0%, transparent 45%),
                   ${Colors.bg}`,
    } as any}>

      {/* Painel esquerdo */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 56px" } as any}>
        <a href="https://getaura.com.br" target="_blank" rel="noreferrer"
          style={{ display: "block", textDecoration: "none", marginBottom: 40 } as any}>
          <img src={LOGO_URL} alt="Aura." style={{ width: 260, height: "auto", display: "block" } as any} />
        </a>
        <p style={{ fontSize: 16, color: Colors.ink2, lineHeight: 1.7, textAlign: "center", margin: "0 0 28px" } as any}>
          Você fez a escolha certa, hora de{" "}
          <span style={{ color: Colors.violet3, fontWeight: 600 } as any}>revolucionar</span>{" "}
          sua empresa com:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 } as any}>
          {FEATURES.map(f => (
            <div key={f.label} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: Colors.violetD,
              border: `1px solid ${Colors.border2}`,
              borderRadius: 12, padding: "12px 16px",
            } as any}>
              <span style={{ fontSize: 20 } as any}>{f.icon}</span>
              <span style={{ fontSize: 14, color: Colors.ink, fontWeight: 500 } as any}>{f.label}</span>
            </div>
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
  mobile:     { flexGrow: 1, backgroundColor: Colors.bg, padding: 28, justifyContent: "center", alignItems: "center" },
  mobileLogo: { marginBottom: 32, alignItems: "center" },
  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: Colors.border2,
  },
  title:      { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle:   { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:      { marginBottom: 16 },
  label:      { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:      { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 13, fontSize: 14, color: Colors.ink },
  btn:        { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 4 },
  btnText:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow:  { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link:       { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  divider:    { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  demoBtn:    { borderRadius: 8, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  demoBtnText:{ color: Colors.violet3, fontSize: 13, fontWeight: "500" },
});
