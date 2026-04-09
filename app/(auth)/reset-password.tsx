import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Platform, ScrollView, Image } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { authApi } from "@/services/api";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
const isWeb = Platform.OS === "web";
const webInputProps = isWeb ? { className: "auth-input" } as any : {};
const inputOutline = isWeb ? { outlineWidth: 0 } as any : {};

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passMatch = password === confirm && confirm.length > 0;

  async function handleReset() {
    if (!token) { toast.error("Token invalido. Use o link do e-mail."); return; }
    if (!passValid) { toast.error("Senha deve ter 8+ caracteres, 1 maiuscula e 1 numero"); return; }
    if (!passMatch) { toast.error("As senhas nao conferem"); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      toast.success("Senha alterada com sucesso!");
    } catch (err: any) { toast.error(err?.message || "Token invalido ou expirado"); }
    finally { setLoading(false); }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "auth-card" } as any : {})}>
      <View style={s.logoRow}><Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" /><Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text></View>

      {!success ? (
        <View>
          <Text style={s.title}>Redefinir senha</Text>
          <Text style={s.subtitle}>Crie uma nova senha para sua conta.</Text>

          <View style={s.field}><Text style={s.label}>Nova senha</Text>
            <View style={s.inputWrap}><Icon name="settings" size={16} color={Colors.ink3} /><TextInput style={[s.input, inputOutline]} {...webInputProps} value={password} onChangeText={setPassword} placeholder="Minimo 8 caracteres" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} /><Pressable onPress={() => setShowPass(!showPass)}><Text style={s.eye}>{showPass ? "Ocultar" : "Ver"}</Text></Pressable></View>
            {password.length > 0 && <View style={s.reqs}><View style={[s.dot, password.length >= 8 && s.dotOk]} /><Text style={s.reqText}>8+ caracteres</Text><View style={[s.dot, /[A-Z]/.test(password) && s.dotOk]} /><Text style={s.reqText}>1 maiuscula</Text><View style={[s.dot, /[0-9]/.test(password) && s.dotOk]} /><Text style={s.reqText}>1 numero</Text></View>}
          </View>

          <View style={s.field}><Text style={s.label}>Confirmar nova senha</Text>
            <View style={s.inputWrap}><Icon name="check" size={16} color={confirm.length > 0 ? (passMatch ? Colors.green : Colors.red) : Colors.ink3} /><TextInput style={[s.input, inputOutline]} {...webInputProps} value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} onSubmitEditing={handleReset} /></View>
          </View>

          <Pressable style={[s.btn, (loading || !passValid || !passMatch) && { opacity: 0.6 }]} {...(isWeb ? { className: "auth-btn" } as any : {})} onPress={handleReset} disabled={loading || !passValid || !passMatch}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Redefinir senha</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={s.successCard}>
          <View style={s.successIcon}><Icon name="check" size={28} color={Colors.green} /></View>
          <Text style={s.successTitle}>Senha alterada!</Text>
          <Text style={s.successDesc}>Sua senha foi redefinida com sucesso. Faca login com a nova senha.</Text>
          <Pressable style={s.btn} onPress={() => router.replace("/(auth)/login")}><Text style={s.btnText}>Ir para login</Text></Pressable>
        </View>
      )}

      <View style={s.footerRow}><Link href="/(auth)/login"><Text style={s.link}>Voltar para login</Text></Link></View>
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
  eye: { fontSize: 11, color: Colors.violet3, fontWeight: "600", paddingVertical: 8, paddingHorizontal: 4 },
  reqs: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.ink3 + "44" },
  dotOk: { backgroundColor: Colors.green },
  reqText: { fontSize: 10, color: Colors.ink3, fontWeight: "500", marginRight: 8 },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 16 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  successCard: { alignItems: "center", paddingVertical: 16, gap: 8, marginBottom: 16 },
  successIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  successTitle: { fontSize: 20, fontWeight: "700", color: Colors.ink },
  successDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18 },
  footerRow: { alignItems: "center", marginBottom: 16 }, link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footer: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
