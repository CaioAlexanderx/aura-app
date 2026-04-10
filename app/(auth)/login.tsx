import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { inviteApi } from "@/services/inviteApi";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";

if (typeof document !== "undefined" && !document.getElementById("aura-auth-css")) {
  const st = document.createElement("style");
  st.id = "aura-auth-css";
  st.textContent = `
    @keyframes authFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .auth-card { animation: authFadeIn 0.6s ease-out; }
    .auth-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); outline: none; }
    .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
    .auth-btn:active { transform: scale(0.98); }
  `;
  document.head.appendChild(st);
}

export default function LoginScreen() {
  const { invite_token } = useLocalSearchParams<{ invite_token?: string }>();
  const isInviteFlow = !!invite_token;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const { login, loginDemo, isLoading } = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleLogin() {
    if (!email || !password) { toast.error("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);

      // Se veio de um convite, aceita automaticamente apos o login
      if (isInviteFlow && invite_token) {
        try {
          await inviteApi.accept(invite_token);
          toast.success("Login efetuado e convite aceito! Bem-vindo a equipe.");
        } catch (err: any) {
          // Nao bloqueia o login se o accept falhar
          toast.error(err?.message || "Nao foi possivel aceitar o convite. Tente abrir o link novamente.");
        }
      } else {
        toast.success("Login efetuado!");
      }

      router.replace("/(tabs)");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "E-mail ou senha incorretos.";
      toast.error(msg);
    }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      {/* Banner de convite */}
      {isInviteFlow && (
        <View style={s.inviteBanner}>
          <Icon name="users" size={14} color={Colors.violet3} />
          <Text style={s.inviteBannerText}>Faca login para aceitar o convite e entrar na equipe</Text>
        </View>
      )}

      <Text style={s.title}>{isInviteFlow ? "Entrar para aceitar convite" : "Entrar na sua conta"}</Text>
      <Text style={s.subtitle}>Gerencie seu negocio de qualquer lugar</Text>

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

      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <View style={s.inputWrap}>
          <Icon name="settings" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "auth-input" } as any : {})}
            value={password} onChangeText={setPassword}
            placeholder="********" placeholderTextColor={Colors.ink3}
            secureTextEntry={!showPass}
            autoComplete="current-password"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
            <Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
      </View>

      <Link href="/(auth)/forgot-password" style={s.forgotRow}>
        <Text style={s.forgotText}>Esqueci minha senha</Text>
      </Link>

      <Pressable
        style={[s.btn, isLoading && { opacity: 0.7 }]}
        {...(isWeb ? { className: "auth-btn" } as any : {})}
        onPress={handleLogin} disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isInviteFlow ? "Entrar e aceitar convite" : "Entrar"}</Text>}
      </Pressable>

      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>ou</Text>
        <View style={s.dividerLine} />
      </View>

      <View style={s.footerRow}>
        <Text style={s.footerText}>Nao tem conta? </Text>
        <Link href={isInviteFlow ? `/(auth)/register?invite_token=${invite_token}` : "/(auth)/register"}>
          <Text style={s.link}>Criar conta gratis</Text>
        </Link>
      </View>

      {!isInviteFlow && (
        <Pressable style={s.demoBtn} onPress={loginDemo} disabled={isLoading}>
          <Icon name="dashboard" size={14} color={Colors.violet3} />
          <Text style={s.demoBtnText}>Explorar modo demonstrativo</Text>
        </Pressable>
      )}

      <Text style={s.footer}>Aura. - Tecnologia para Negocios</Text>
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
  card: { width: "100%", maxWidth: 400, backgroundColor: Colors.bg3, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: Colors.border2 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 },
  logo: { width: 40, height: 40 },
  brand: { fontSize: 26, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  inviteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  inviteBannerText: { fontSize: 12, color: Colors.violet3, flex: 1, lineHeight: 18 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  forgotRow: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.ink3 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  demoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  demoBtnText: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
