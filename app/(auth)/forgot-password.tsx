import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useToastStore } from "@/components/Toast";

const API = process.env.EXPO_PUBLIC_API_URL || "https://aura-backend-production-f805.up.railway.app/api/v1";
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const isWeb = Platform.OS === "web";
  const toast = useToastStore.getState();

  async function handleSubmit() {
    if (!email || !email.includes("@")) {
      toast.error("Digite um e-mail valido");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        toast.error(data.error || "Erro ao enviar. Tente novamente.");
      }
    } catch {
      toast.error("Erro de conexao. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      {/* Logo */}
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      {sent ? (
        /* Estado: email enviado */
        <View style={{ alignItems: "center" }}>
          <View style={s.successIcon}>
            <Icon name="check" size={28} color={Colors.green} />
          </View>
          <Text style={s.title}>Verifique seu e-mail</Text>
          <Text style={[s.subtitle, { marginBottom: 20 }]}>
            Se o e-mail <Text style={{ color: Colors.violet3, fontWeight: "600" }}>{email}</Text> estiver cadastrado, voce recebera um link para redefinir sua senha.
          </Text>
          <Text style={[s.subtitle, { marginBottom: 24 }]}>
            O link expira em 30 minutos.
          </Text>
          <Pressable style={s.btn} onPress={() => { setSent(false); setEmail(""); }}>
            <Text style={s.btnText}>Enviar novamente</Text>
          </Pressable>
          <View style={s.footerRow}>
            <Text style={s.footerText}>Lembrou a senha? </Text>
            <Link href="/(auth)/login"><Text style={s.link}>Entrar</Text></Link>
          </View>
        </View>
      ) : (
        /* Estado: formulario */
        <>
          <Text style={s.title}>Esqueci minha senha</Text>
          <Text style={s.subtitle}>Digite seu e-mail e enviaremos um link para redefinir sua senha</Text>

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
                autoComplete="email" autoFocus
              />
            </View>
          </View>

          <Pressable
            style={[s.btn, loading && { opacity: 0.7 }]}
            {...(isWeb ? { className: "auth-btn" } as any : {})}
            onPress={handleSubmit} disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar link de recuperacao</Text>}
          </Pressable>

          <View style={s.footerRow}>
            <Text style={s.footerText}>Lembrou a senha? </Text>
            <Link href="/(auth)/login"><Text style={s.link}>Entrar</Text></Link>
          </View>
        </>
      )}

      <Text style={s.footer}>Aura. · Tecnologia para Negocios</Text>
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
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 28, lineHeight: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 0,
  },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13 },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5, marginTop: 8 },
  successIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.greenD || "rgba(34,197,94,0.1)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
});
