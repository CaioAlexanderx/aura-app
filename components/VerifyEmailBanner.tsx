import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { authApi } from "@/services/api";
import { toast } from "@/components/Toast";

type Props = {
  emailVerified?: boolean;
  onVerified?: () => void;
};

export function VerifyEmailBanner({ emailVerified, onVerified }: Props) {
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(emailVerified || false);

  if (verified) return null;

  async function handleSendCode() {
    setLoading(true);
    try {
      const res = await authApi.sendEmailVerification();
      if (res.already_verified) { setVerified(true); onVerified?.(); return; }
      setCodeSent(true);
      toast.success(`Codigo enviado para ${res.destination || 'seu e-mail'}`);
    } catch { toast.error("Erro ao enviar codigo"); }
    finally { setLoading(false); }
  }

  async function handleVerify() {
    if (code.length !== 6) { toast.error("Codigo de 6 digitos"); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyEmail(code);
      if (res.valid || res.email_verified) {
        setVerified(true);
        onVerified?.();
        toast.success("E-mail verificado!");
      } else { toast.error("Codigo invalido"); }
    } catch { toast.error("Codigo invalido ou expirado"); }
    finally { setLoading(false); }
  }

  return (
    <View style={s.banner}>
      <View style={s.row}>
        <View style={s.iconWrap}><Icon name="message" size={16} color={Colors.amber} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Verifique seu e-mail</Text>
          <Text style={s.desc}>Confirme seu e-mail para garantir a seguranca da sua conta.</Text>
        </View>
      </View>
      {!codeSent ? (
        <Pressable onPress={handleSendCode} disabled={loading} style={[s.actionBtn, loading && { opacity: 0.6 }]}>
          <Text style={s.actionText}>{loading ? "Enviando..." : "Enviar codigo de verificacao"}</Text>
        </Pressable>
      ) : (
        <View style={s.codeRow}>
          <TextInput style={s.codeInput} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={Colors.ink3} maxLength={6} keyboardType="number-pad" />
          <Pressable onPress={handleVerify} disabled={loading} style={[s.verifyBtn, loading && { opacity: 0.6 }]}>
            <Text style={s.verifyText}>{loading ? "..." : "Verificar"}</Text>
          </Pressable>
          <Pressable onPress={handleSendCode} disabled={loading}><Text style={s.resendText}>Reenviar</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: Colors.amber + "12", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.amber + "33", marginBottom: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.amber + "22", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  desc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  actionBtn: { backgroundColor: Colors.amber + "22", borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.amber + "44" },
  actionText: { fontSize: 12, fontWeight: "600", color: Colors.amber },
  codeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  codeInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: Colors.ink, textAlign: "center", letterSpacing: 6, fontWeight: "700", borderWidth: 1, borderColor: Colors.border },
  verifyBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  verifyText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  resendText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});

export default VerifyEmailBanner;
