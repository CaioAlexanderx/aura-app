import { useEffect, useState } from "react";
import {
  View, Text, Pressable, ActivityIndicator,
  StyleSheet, Platform, Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { inviteApi } from "@/services/inviteApi";
import type { InviteDetails } from "@/services/inviteApi";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
const isWeb = Platform.OS === "web";

export default function InviteLandingScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Link de convite invalido."); setLoading(false); return; }
    inviteApi.validate(token)
      .then(data => setInvite(data))
      .catch(err => setError(err?.message || "Convite nao encontrado ou expirado."))
      .finally(() => setLoading(false));
  }, [token]);

  function goRegister() {
    const params = new URLSearchParams({ invite_token: token });
    if (invite?.email) params.set("invite_email", invite.email);
    router.push(`/(auth)/register?${params.toString()}`);
  }

  function goLogin() {
    router.push(`/(auth)/login?invite_token=${token}`);
  }

  const card = (
    <View style={s.card}>
      {/* Logo */}
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
      </View>

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={Colors.violet3} size="large" />
          <Text style={s.loadingText}>Verificando convite...</Text>
        </View>
      )}

      {!loading && error && (
        <View style={s.center}>
          <View style={s.iconCircle}>
            <Icon name="x" size={28} color={Colors.red} />
          </View>
          <Text style={s.errorTitle}>Convite invalido</Text>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} style={s.btnOutline}>
            <Text style={s.btnOutlineText}>Ir para o login</Text>
          </Pressable>
        </View>
      )}

      {!loading && invite && (
        <View>
          {/* Badge convidado */}
          <View style={s.inviteBadge}>
            <Icon name="users" size={14} color={Colors.violet3} />
            <Text style={s.inviteBadgeText}>Convite para equipe</Text>
          </View>

          <Text style={s.title}>Voce foi convidado!</Text>
          <Text style={s.subtitle}>
            Junte-se a <Text style={{ fontWeight: "700", color: Colors.ink }}>{invite.company_name}</Text>
            {invite.role ? ` como ${invite.role}` : ""}
          </Text>

          {/* Card empresa */}
          <View style={s.companyCard}>
            <View style={s.companyAvatar}>
              <Text style={s.companyAvatarText}>{(invite.company_name || "E")[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.companyName}>{invite.company_name}</Text>
              <Text style={s.companyRole}>{invite.role || "Colaborador"}</Text>
            </View>
            <View style={s.checkBadge}>
              <Icon name="check" size={12} color={Colors.green} />
            </View>
          </View>

          {/* Email do convite */}
          {invite.masked_email ? (
            <View style={s.emailNote}>
              <Icon name="message" size={12} color={Colors.ink3} />
              <Text style={s.emailNoteText}>
                Convite enviado para <Text style={{ fontWeight: "600" }}>{invite.masked_email}</Text>
              </Text>
            </View>
          ) : (
            <View style={s.emailNote}>
              <Icon name="link" size={12} color={Colors.ink3} />
              <Text style={s.emailNoteText}>Link de acesso direto — qualquer pessoa com este link pode entrar</Text>
            </View>
          )}

          {/* CTAs */}
          <View style={s.ctaGroup}>
            <Pressable onPress={goRegister} style={s.btnPrimary}>
              <Icon name="user_plus" size={16} color="#fff" />
              <Text style={s.btnPrimaryText}>Criar conta e entrar</Text>
            </Pressable>
            <Pressable onPress={goLogin} style={s.btnOutline}>
              <Icon name="dashboard" size={14} color={Colors.violet3} />
              <Text style={s.btnOutlineText}>Ja tenho conta — fazer login</Text>
            </Pressable>
          </View>

          <Text style={s.disclaimer}>
            Link valido por 7 dias. Uso unico. Ao entrar, voce aceita os termos de uso da Aura.
          </Text>
        </View>
      )}
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.15) 0%, transparent 50%),
                     radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 40%),
                     ${Colors.bg}`,
        padding: "40px 20px",
      } as any}>
        {card}
      </div>
    );
  }

  return (
    <View style={s.mobileContainer}>{card}</View>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flex: 1, backgroundColor: Colors.bg, padding: 20, justifyContent: "center", alignItems: "center" },
  card: { width: "100%", maxWidth: 420, backgroundColor: Colors.bg3, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: Colors.border2 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 },
  logo: { width: 36, height: 36 },
  brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  center: { alignItems: "center", paddingVertical: 24, gap: 12 },
  loadingText: { fontSize: 13, color: Colors.ink3, marginTop: 8 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  errorTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  errorText: { fontSize: 13, color: Colors.ink3, textAlign: "center" },
  inviteBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  inviteBadgeText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: Colors.ink, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.ink3, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  companyCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg4, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  companyAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  companyAvatarText: { fontSize: 18, fontWeight: "700", color: Colors.violet3 },
  companyName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  companyRole: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  checkBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.green + "33" },
  emailNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  emailNoteText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 17 },
  ctaGroup: { gap: 10, marginBottom: 16 },
  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15 },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: Colors.border2 },
  btnOutlineText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  disclaimer: { fontSize: 10, color: Colors.ink3, textAlign: "center", lineHeight: 15 },
});
