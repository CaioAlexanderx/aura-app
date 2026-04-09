import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Platform, ScrollView, Image } from "react-native";
import { Link, router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { authApi } from "@/services/api";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
const isWeb = Platform.OS === "web";
const webInputProps = isWeb ? { className: "auth-input" } as any : {};
const inputOutline = isWeb ? { outlineWidth: 0 } as any : {};

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email || !email.includes("@")) { toast.error("Informe um e-mail valido"); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
      toast.success("Link enviado! Verifique seu e-mail.");
    } catch { toast.error("Erro ao enviar. Tente novamente."); }
    finally { setLoading(false); }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      <View style={s.logoRow}><Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" /><Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text></View>
      <Text style={s.title}>Esqueci minha senha</Text>
      <Text style={s.subtitle}>Informe seu e-mail para receber um link de redefinicao.</Text>

      {!sent ? (
        <View>
          <View style={s.field}><Text style={s.label}>E-mail cadastrado</Text>
            <View style={s.inputWrap}><Icon name="message" size={16} color={Colors.ink3} /><TextInput style={[s.input, inputOutline]} {...webInputProps} value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={handleSubmit} /></View>
          </View>
          <Pressable style={[s.btn, loading && { opacity: 0.7 }]} {...(isWeb ? { className: "auth-btn" } as any : {})} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar link de redefinicao</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={s.sentCard}>
          <View style={s.sentIcon}><Icon name="check" size={24} color={Colors.green} /></View>
          <Text style={s.sentTitle}>E-mail enviado!</Text>
          <Text style={s.sentDesc}>Se o e-mail estiver cadastrado, voce recebera um link para redefinir sua senha. Verifique sua caixa de entrada e spam.</Text>
          <Pressable style={s.sentBtn} onPress={() => setSent(false)}><Text style={s.sentBtnText}>Enviar novamente</Text></Pressable>
        </View>
      )}

      <View style={s.footerRow}><Text style={s.footerText}>Lembrou a senha? </Text><Link href="/(auth)/login"><Text style={s.link}>Fazer login</Text></Link></View>
      <Text style={s.footer}>Aura. - Tecnologia para Negocios</Text>
    </View>
  );

  if (isWeb) return <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 40%), ${Colors.bg}`, padding: 20 } as any}>{card}</div>;
  return <ScrollView contentContainerStyle={s.mobileContainer}>{card}</ScrollView>;
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, justifyContent: "center", alignItems: "center" },
  card: { width: "100%", maxWidth: 400, backgroundColor: Colors.bg3, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: Colors.border2 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 },
  logo: { width: 36, height: 36 }, brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  field: { marginBottom: 16 }, label: { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "600" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13 },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sentCard: { alignItems: "center", paddingVertical: 16, gap: 8, marginBottom: 16 },
  sentIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  sentTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  sentDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18 },
  sentBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  sentBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 }, link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
