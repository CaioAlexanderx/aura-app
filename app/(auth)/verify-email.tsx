import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

export default function VerifyEmailScreen() {
  const { user, logout } = useAuthStore();
  const [code, setCode] = useState(["" ,"", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const inputs = useRef<(TextInput | null)[]>([]);

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : "";

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSendCode() {
    if (cooldown > 0) return;
    setSending(true); setError("");
    try {
      const res = await authApi.sendEmailVerification();
      if (res.already_verified) {
        // Already verified — update store and redirect
        useAuthStore.setState({
          user: { ...user!, email_verified: true } as any,
        });
        toast.success("E-mail ja verificado!");
        return;
      }
      setSent(true);
      setCooldown(60);
      toast.success("Codigo enviado para " + (res.destination || maskedEmail));
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar codigo");
    } finally { setSending(false); }
  }

  function handleDigitChange(index: number, value: string) {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    setError("");
    // Auto-focus next
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 filled
    if (value && index === 5 && next.every(d => d)) {
      submitCode(next.join(""));
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  // Handle paste of full code
  function handlePaste(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) {
      const arr = digits.split("");
      setCode(arr);
      submitCode(digits);
    }
  }

  async function submitCode(fullCode: string) {
    setVerifying(true); setError("");
    try {
      const res = await authApi.verifyEmail(fullCode);
      if (res.valid || res.email_verified) {
        // Update user in store
        useAuthStore.setState({
          user: { ...user!, email_verified: true } as any,
        });
        toast.success("E-mail verificado com sucesso!");
        // AuthGuard will redirect to tabs
      } else {
        setError("Codigo invalido");
        setCode(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err?.message || "Codigo invalido ou expirado");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally { setVerifying(false); }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Icon name="mail" size={28} color={Colors.violet3} />
        </View>
        <Text style={s.title}>Verifique seu e-mail</Text>
        <Text style={s.desc}>
          {sent
            ? "Enviamos um codigo de 6 digitos para " + maskedEmail + ". Verifique sua caixa de entrada e spam."
            : "Para sua seguranca, precisamos verificar seu e-mail antes de continuar."}
        </Text>

        {!sent ? (
          <Pressable onPress={handleSendCode} style={s.primaryBtn} disabled={sending}>
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.primaryBtnText}>Enviar codigo para {maskedEmail}</Text>}
          </Pressable>
        ) : (
          <>
            <View style={s.codeRow}>
              {code.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => { inputs.current[i] = r; }}
                  style={[s.codeInput, error ? s.codeInputError : null, digit ? s.codeInputFilled : null]}
                  value={digit}
                  onChangeText={v => {
                    if (v.length > 1) { handlePaste(v); return; }
                    handleDigitChange(i, v);
                  }}
                  onKeyPress={e => handleKeyPress(i, (e as any).nativeEvent?.key || "")}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            {verifying && (
              <View style={s.verifyingRow}>
                <ActivityIndicator color={Colors.violet3} size="small" />
                <Text style={s.verifyingText}>Verificando...</Text>
              </View>
            )}

            <Pressable onPress={handleSendCode} disabled={cooldown > 0 || sending} style={s.resendBtn}>
              <Text style={[s.resendText, cooldown > 0 && { opacity: 0.5 }]}>
                {cooldown > 0 ? "Reenviar em " + cooldown + "s" : "Reenviar codigo"}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: Colors.bg },
  card: { backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 420, width: "100%" },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  title: { fontSize: 20, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 24, maxWidth: 320 },
  primaryBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: "100%", alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  codeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  codeInput: { width: 44, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg4, textAlign: "center", fontSize: 22, fontWeight: "700", color: Colors.ink },
  codeInputFilled: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  codeInputError: { borderColor: Colors.red },
  error: { fontSize: 12, color: Colors.red, marginBottom: 12, textAlign: "center" },
  verifyingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  verifyingText: { fontSize: 13, color: Colors.violet3 },
  resendBtn: { paddingVertical: 10 },
  resendText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  logoutBtn: { marginTop: 20, paddingVertical: 8 },
  logoutText: { fontSize: 12, color: Colors.ink3 },
});
