import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const LOGO_URL = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";

export default function VerifyEmailScreen() {
  const { user, logout } = useAuthStore();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : "";

  // Auto-send on mount
  useEffect(() => { handleSendLink(); }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Poll for verification (check every 5s if user verified via link)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await authApi.me(useAuthStore.getState().token!);
        if ((res.user as any)?.email_verified) {
          clearInterval(interval);
          useAuthStore.setState({ user: { ...user!, email_verified: true } as any });
          toast.success("E-mail verificado!");
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [user]);

  async function handleSendLink() {
    if (cooldown > 0 || sending) return;
    setSending(true);
    try {
      const res = await authApi.sendEmailVerification();
      if (res.already_verified) {
        useAuthStore.setState({ user: { ...user!, email_verified: true } as any });
        toast.success("E-mail ja verificado!");
        return;
      }
      setSent(true);
      setCooldown(60);
    } catch (err: any) {
      // Show error but still show "sent" UI so user can retry
      toast.error(err?.message || "Erro ao enviar email. Tente reenviar.");
      setSent(true);
    } finally { setSending(false); }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Image source={{ uri: LOGO_URL }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={s.brandDot}>.</Text></Text>
        <Text style={s.title}>Verifique seu e-mail</Text>

        {sent ? (
          <>
            <Text style={s.desc}>
              Enviamos um link de confirmacao para{"\n"}
              <Text style={s.emailHighlight}>{maskedEmail}</Text>
            </Text>
            <View style={s.stepsCard}>
              <View style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
                <Text style={s.stepText}>Abra seu e-mail (verifique o spam)</Text>
              </View>
              <View style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
                <Text style={s.stepText}>Clique em "Confirmar meu e-mail"</Text>
              </View>
              <View style={s.step}>
                <View style={[s.stepNum, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
                  <Icon name="check" size={12} color={Colors.green} />
                </View>
                <Text style={s.stepText}>Pronto! Voce sera redirecionado automaticamente</Text>
              </View>
            </View>
            <View style={s.pollingRow}>
              <ActivityIndicator size="small" color={Colors.violet3} />
              <Text style={s.pollingText}>Aguardando confirmacao...</Text>
            </View>
            <Pressable onPress={handleSendLink} disabled={cooldown > 0 || sending} style={s.resendBtn}>
              <Text style={[s.resendText, cooldown > 0 && { opacity: 0.5 }]}>
                {cooldown > 0 ? "Reenviar em " + cooldown + "s" : "Reenviar e-mail"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.desc}>Enviando link de confirmacao para {maskedEmail}...</Text>
            <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 20 }} />
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
  logo: { width: 64, height: 64, borderRadius: 18, marginBottom: 8 },
  brand: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 16, letterSpacing: -0.5 },
  brandDot: { color: Colors.violet },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 20, maxWidth: 320 },
  emailHighlight: { color: Colors.violet3, fontWeight: "600" },
  stepsCard: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, width: "100%", gap: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  stepText: { fontSize: 12, color: Colors.ink3, flex: 1 },
  pollingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  pollingText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  resendBtn: { paddingVertical: 10 },
  resendText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  logoutBtn: { marginTop: 16, paddingVertical: 8 },
  logoutText: { fontSize: 12, color: Colors.ink3 },
});
