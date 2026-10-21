import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { authApi } from "@/services/api";
import { AuthStage } from "@/components/auth/AuthStage";

const isWeb = Platform.OS === "web";

const webInputProps = isWeb ? { className: "v2-input" } as any : {};
const inputOutline = isWeb ? { outlineWidth: 0 } as any : {};

function Req({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ok ? Colors.green : Colors.ink3 + "44" }} />
      <Text style={{ fontSize: 10, color: ok ? Colors.green : Colors.ink3, fontWeight: "500" }}>{text}</Text>
    </View>
  );
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(params.token || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);


  const passLength = password.length >= 8;
  const passUpper = /[A-Z]/.test(password);
  const passNumber = /[0-9]/.test(password);
  const passValid = passLength && passUpper && passNumber;
  const passMatch = password === confirm && confirm.length > 0;

  async function handleReset() {
    if (!token) { toast.error("Token inválido. Use o link do e-mail."); return; }
    if (!passValid) { toast.error("Senha deve ter 8+ caracteres, 1 maiúscula e 1 número"); return; }
    if (!passMatch) { toast.error("As senhas não conferem"); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      toast.success("Senha alterada com sucesso!");
    } catch (err: any) { toast.error(err?.message || "Token inválido ou expirado"); }
    finally { setLoading(false); }
  }

  const card = (
    <View style={s.card}>
      <View style={s.logoRow}>
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      {!success ? (
        <View>
          <Text style={s.title}>Redefinir senha</Text>
          <Text style={s.subtitle}>Crie uma nova senha para sua conta Aura.</Text>

          <View style={s.field}>
            <Text style={s.label}>Nova senha</Text>
            <View style={s.inputWrap}>
              <Icon name="lock" size={16} color={Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} autoComplete="new-password" />
              <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}><Text style={s.eye}>{showPass ? "Ocultar" : "Ver"}</Text></Pressable>
            </View>
            {password.length > 0 && <View style={s.reqs}><Req ok={passLength} text="8+ caracteres" /><Req ok={passUpper} text="1 maiúscula" /><Req ok={passNumber} text="1 número" /></View>}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirmar nova senha</Text>
            <View style={s.inputWrap}>
              <Icon name="check" size={16} color={confirm.length > 0 ? (passMatch ? Colors.green : Colors.red) : Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} autoComplete="new-password" onSubmitEditing={handleReset} />
            </View>
            {confirm.length > 0 && !passMatch && <Text style={{ fontSize: 10, color: Colors.red, marginTop: 4 }}>As senhas não conferem</Text>}
          </View>

          <Pressable style={[s.btn, (loading || !passValid || !passMatch) && { opacity: 0.6 }]} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={handleReset} disabled={loading || !passValid || !passMatch}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Redefinir senha</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={s.successCard}>
          <View style={s.successIcon}><Icon name="check" size={28} color={Colors.green} /></View>
          <Text style={s.successTitle}>Senha alterada!</Text>
          <Text style={s.successDesc}>Sua senha foi redefinida com sucesso. Faça login com a nova senha para continuar.</Text>
          <Pressable style={s.btn} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={() => router.replace("/(auth)/login")}><Text style={s.btnText}>Ir para login</Text></Pressable>
        </View>
      )}

      <View style={s.footerRow}>
        <Link href="/(auth)/login"><Text style={s.link}>Voltar para login</Text></Link>
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
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 14 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eye: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  reqs: { flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap", alignItems: "center" },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  successCard: { alignItems: "center", paddingVertical: 8, gap: 8, marginBottom: 16 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 4, borderWidth: 1, borderColor: Colors.green + "33" },
  successTitle: { fontSize: 20, fontWeight: "700", color: Colors.ink },
  successDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, marginBottom: 12 },
  footerRow: { alignItems: "center", marginBottom: 16 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
