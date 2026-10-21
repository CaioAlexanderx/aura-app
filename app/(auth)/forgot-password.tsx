import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform,
} from "react-native";
import { Link, router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { authApi, ApiError } from "@/services/api";
import { AuthStage } from "@/components/auth/AuthStage";

const isWeb = Platform.OS === "web";

const webInputProps = isWeb ? { className: "v2-input" } as any : {};
const inputOutline = isWeb ? { outlineWidth: 0 } as any : {};

export default function ForgotPasswordScreen() {

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);


  async function handleSubmit() {
    if (!email || !email.includes("@")) { toast.error("Informe um e-mail válido"); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
      toast.success("Link enviado! Verifique seu e-mail.");
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Erro ao enviar. Tente novamente."); }
    finally { setLoading(false); }
  }

  const card = (
    <View style={s.card}>
      <View style={s.logoRow}>
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      <Text style={s.title}>Esqueci minha senha</Text>
      <Text style={s.subtitle}>Informe seu e-mail e enviaremos um link para redefinir sua senha.</Text>

      {!sent ? (
        <View>
          <View style={s.field}>
            <Text style={s.label}>E-mail cadastrado</Text>
            <View style={s.inputWrap}>
              <Icon name="mail" size={16} color={Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={handleSubmit} />
            </View>
          </View>
          <Pressable style={[s.btn, loading && { opacity: 0.7 }]} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar link de redefinição</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={s.sentCard}>
          <View style={s.sentIcon}><Icon name="check" size={24} color={Colors.green} /></View>
          <Text style={s.sentTitle}>E-mail enviado!</Text>
          <Text style={s.sentDesc}>Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique a caixa de entrada e a pasta de spam.</Text>
          <Pressable style={s.sentBtn} onPress={() => setSent(false)}><Text style={s.sentBtnText}>Enviar novamente</Text></Pressable>
        </View>
      )}

      <View style={s.footerRow}>
        <Text style={s.footerText}>Lembrou a senha? </Text>
        <Link href="/(auth)/login"><Text style={s.link}>Fazer login</Text></Link>
      </View>
      <Text style={s.footerTag}>Aura. - Tecnologia para Negócios</Text>
    </View>
  );

  return <AuthStage>{card}</AuthStage>;
}

const s = StyleSheet.create({
  // 21/10/2026 (tq-67): o vidro, o aro e o orbe são do AuthStage; aqui só o miolo.
  card: { width: "100%" },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 },
  brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 6, ...(isWeb ? { fontFamily: Fonts.heading, fontWeight: "400" as any, fontSize: 28 } : {}) },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 28, lineHeight: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 14 },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  sentCard: { alignItems: "center", paddingVertical: 8, gap: 8, marginBottom: 16 },
  sentIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 4, borderWidth: 1, borderColor: Colors.green + "33" },
  sentTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  sentDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18 },
  sentBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  sentBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
