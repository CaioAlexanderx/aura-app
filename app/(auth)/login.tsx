import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Alert, Platform, ScrollView, Image,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";

// Inject gradient animation
if (typeof document !== "undefined" && !document.getElementById("aura-auth-css")) {
  const st = document.createElement("style");
  st.id = "aura-auth-css";
  st.textContent = `
    @keyframes authFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes authGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
    .auth-card { animation: authFadeIn 0.6s ease-out; }
    .auth-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); outline: none; }
    .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
    .auth-btn:active { transform: scale(0.98); }
  `;
  document.head.appendChild(st);
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
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

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      {/* Logo */}
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      {/* Header */}
      <Text style={s.title}>Entrar na sua conta</Text>
      <Text style={s.subtitle}>Gerencie seu negócio de qualquer lugar</Text>

      {/* E-mail */}
      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <View style={s.inputWrap}>
          <Icon name="message" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={email} onChangeText={setEmail}
            placeholder="seu@email.com" placeholderTextColor={Colors.ink3}
            autoCapitalize="none" keyboardType="email-address"
            autoComplete="email"
          />
        </View>
      </View>

      {/* Senha */}
      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <View style={s.inputWrap}>
          <Icon name="settings" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={Colors.ink3}
            secureTextEntry={!showPass}
            autoComplete="current-password"
          />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
            <Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Esqueci senha */}
      <Pressable style={s.forgotRow}>
        <Text style={s.forgotText}>Esqueci minha senha</Text>
      </Pressable>

      {/* Botão Entrar */}
      <Pressable
        style={[s.btn, isLoading && { opacity: 0.7 }]}
        {...(isWeb ? { className: "auth-btn" } as any : {})}
        onPress={handleLogin} disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
      </Pressable>

      {/* Divider */}
      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>ou</Text>
        <View style={s.dividerLine} />
      </View>

      {/* Criar conta */}
      <View style={s.footerRow}>
        <Text style={s.footerText}>Não tem conta? </Text>
        <Link href="/(auth)/register"><Text style={s.link}>Criar conta grátis</Text></Link>
      </View>

      {/* Demo */}
      <Pressable style={s.demoBtn} onPress={loginDemo} disabled={isLoading}>
        <Icon name="dashboard" size={14} color={Colors.violet3} />
        <Text style={s.demoBtnText}>Explorar modo demonstrativo</Text>
      </Pressable>

      {/* Footer */}
      <Text style={s.footer}>Aura. · Tecnologia para Negócios</Text>
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.15) 0%, transparent 50%),
                     radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 40%),
                     ${Colors.bg}`,
        padding: 20, overflowY: "auto",
      } as any}>
        {card}
      </div>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.mobileContainer}>
      {card}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, justifyContent: "center", alignItems: "center" },
  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 24, padding: 28,
    borderWidth: 1, borderColor: Colors.border2,
  },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 },
  logo: { width: 40, height: 40 },
  brand: { fontSize: 26, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 0,
  },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  forgotRow: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.ink3 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.border2,
    marginBottom: 20,
  },
  demoBtnText: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
