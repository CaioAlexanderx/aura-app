import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
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

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWeb = Platform.OS === "web";
  const router = useRouter();
  const toast = useToastStore.getState();

  const passLength = password.length >= 8;
  const passUpper = /[A-Z]/.test(password);
  const passNumber = /[0-9]/.test(password);
  const passMatch = password === confirm && confirm.length > 0;
  const passValid = passLength && passUpper && passNumber;

  async function handleReset() {
    if (!passValid) {
      toast.error("Senha deve ter 8+ caracteres, 1 maiuscula e 1 numero");
      return;
    }
    if (!passMatch) {
      toast.error("Senhas nao conferem");
      return;
    }
    if (!token) {
      setError("Link invalido. Solicite um novo link de recuperacao.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Erro ao redefinir senha.");
      }
    } catch {
      setError("Erro de conexao. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  function Req({ ok, text }: { ok: boolean; text: string }) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ok ? Colors.green : Colors.ink3 + "44" }} />
        <Text style={{ fontSize: 10, color: ok ? Colors.green : Colors.ink3, fontWeight: "500" }}>{text}</Text>
      </View>
    );
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      {success ? (
        <View style={{ alignItems: "center" }}>
          <View style={s.successIcon}>
            <Icon name="check" size={28} color={Colors.green} />
          </View>
          <Text style={s.title}>Senha alterada!</Text>
          <Text style={[s.subtitle, { marginBottom: 24 }]}>Sua senha foi redefinida com sucesso. Faca login com a nova senha.</Text>
          <Pressable style={s.btn} onPress={() => router.replace("/(auth)/login")}>
            <Text style={s.btnText}>Ir para login</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={s.title}>Nova senha</Text>
          <Text style={s.subtitle}>Escolha uma nova senha para sua conta</Text>

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>Nova senha</Text>
            <View style={s.inputWrap}>
              <Icon name="settings" size={16} color={Colors.ink3} />
              <TextInput
                style={[s.input, isWeb && { outlineWidth: 0 } as any]}
                {...(isWeb ? { className: "auth-input" } as any : {})}
                value={password} onChangeText={setPassword}
                placeholder="Minimo 8 caracteres" placeholderTextColor={Colors.ink3}
                secureTextEntry={!showPass} autoComplete="new-password"
              />
              <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                <Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text>
              </Pressable>
            </View>
            {password.length > 0 && (
              <View style={s.passReqs}>
                <Req ok={passLength} text="8+ caracteres" />
                <Req ok={passUpper} text="1 maiuscula" />
                <Req ok={passNumber} text="1 numero" />
              </View>
            )}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirmar nova senha</Text>
            <View style={s.inputWrap}>
              <Icon name="check" size={16} color={confirm.length > 0 ? (passMatch ? Colors.green : Colors.red) : Colors.ink3} />
              <TextInput
                style={[s.input, isWeb && { outlineWidth: 0 } as any]}
                {...(isWeb ? { className: "auth-input" } as any : {})}
                value={confirm} onChangeText={setConfirm}
                placeholder="Repita a senha" placeholderTextColor={Colors.ink3}
                secureTextEntry={!showPass} autoComplete="new-password"
              />
            </View>
            {confirm.length > 0 && !passMatch && (
              <Text style={{ fontSize: 10, color: Colors.red, marginTop: 4 }}>As senhas nao conferem</Text>
            )}
          </View>

          <Pressable
            style={[s.btn, (loading || !passValid || !passMatch) && { opacity: 0.6 }]}
            {...(isWeb ? { className: "auth-btn" } as any : {})}
            onPress={handleReset} disabled={loading || !passValid || !passMatch}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Redefinir senha</Text>}
          </Pressable>

          <View style={s.footerRow}>
            <Link href="/(auth)/login"><Text style={s.link}>Voltar ao login</Text></Link>
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
  passReqs: { flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5, marginTop: 8 },
  errorBox: {
    backgroundColor: Colors.redD || "rgba(239,68,68,0.1)",
    borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.red + "33",
  },
  errorText: { fontSize: 12, color: Colors.red, textAlign: "center" },
  successIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.greenD || "rgba(34,197,94,0.1)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
});
