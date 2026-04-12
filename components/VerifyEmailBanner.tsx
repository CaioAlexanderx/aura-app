import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useState } from "react";

export function VerifyEmailBanner() {
  const { user, isDemo } = useAuthStore();
  const [sending, setSending] = useState(false);
  const emailVerified = !!(user as any)?.email_verified;

  if (isDemo || emailVerified || !user) return null;

  async function handleSend() {
    setSending(true);
    try {
      const res = await authApi.sendEmailVerification();
      if (res.already_verified) {
        useAuthStore.setState({ user: { ...user!, email_verified: true } as any });
        toast.success("E-mail ja verificado!");
      } else {
        toast.success("Codigo enviado! Verifique seu e-mail.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar codigo");
    } finally { setSending(false); }
  }

  return (
    <View style={s.banner}>
      <Icon name="alert" size={16} color={Colors.amber} />
      <View style={s.bannerContent}>
        <Text style={s.bannerTitle}>E-mail nao verificado</Text>
        <Text style={s.bannerDesc}>Verifique seu e-mail para liberar todas as funcionalidades.</Text>
      </View>
      <Pressable onPress={handleSend} style={s.bannerBtn} disabled={sending}>
        <Text style={s.bannerBtnText}>{sending ? "Enviando..." : "Verificar"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.amberD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.amber + "33", marginBottom: 16 },
  bannerContent: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 13, fontWeight: "700", color: Colors.amber },
  bannerDesc: { fontSize: 11, color: Colors.ink3 },
  bannerBtn: { backgroundColor: Colors.amber, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  bannerBtnText: { fontSize: 12, fontWeight: "700", color: "#000" },
});

export default VerifyEmailBanner;
