import { useState, useEffect, useRef } from "react";
import {
  View, Text, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image, Animated, Easing,
  useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
const isWeb = Platform.OS === "web";

if (typeof document !== "undefined" && !document.getElementById("aura-login-v2-css")) {
  const st = document.createElement("style");
  st.id = "aura-login-v2-css";
  st.textContent = `
    @keyframes auraPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
      50% { transform: translate(-50%, -50%) scale(1.08); opacity: 0.3; }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes gridShift {
      from { transform: translate(0, 0); }
      to { transform: translate(40px, 40px); }
    }
    @keyframes floatParticle {
      0%, 100% { transform: translate(0, 0); opacity: 0; }
      10%, 90% { opacity: 1; }
      50% { transform: translate(var(--dx), var(--dy)); }
    }
    .v2-card { animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
    .v2-hero { animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
    .v2-input:focus {
      border-color: #7c3aed !important;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.18), inset 0 0 12px rgba(124,58,237,0.08) !important;
      outline: none !important;
    }
    .v2-btn { position: relative; overflow: hidden; transition: transform .18s ease, box-shadow .18s ease; }
    .v2-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(124,58,237,0.45); }
    .v2-btn:active { transform: translateY(0); }
    .v2-btn::before {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%);
      transform: translateX(-100%);
    }
    .v2-btn:hover::before { transform: translateX(100%); transition: transform 0.7s ease; }
    .v2-aura-ring { position: absolute; top: 50%; left: 50%; border-radius: 50%; border: 1px solid rgba(167,139,250,0.3); pointer-events: none; }
    .v2-grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px);
      background-size: 40px 40px;
      animation: gridShift 20s linear infinite;
      pointer-events: none;
      mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    }
    .v2-particle {
      position: absolute; width: 3px; height: 3px; border-radius: 50%;
      background: rgba(167,139,250,0.8); pointer-events: none;
      animation: floatParticle var(--dur) ease-in-out infinite;
      animation-delay: var(--delay);
    }
  `;
  document.head.appendChild(st);
}

function AuraRings() {
  if (!isWeb) return null;
  const rings = [240, 380, 540, 720];
  return (
    <>
      {rings.map((size, i) => (
        <div key={size} className="v2-aura-ring" style={{
          width: size, height: size,
          animation: `auraPulse ${6 + i * 0.8}s ease-in-out ${i * 0.3}s infinite`,
          borderColor: i === 0 ? "rgba(167,139,250,0.45)" : "rgba(167,139,250,0.15)",
        } as any} />
      ))}
    </>
  );
}

function Particles({ count = 24 }: { count?: number }) {
  if (!isWeb) return null;
  const particles = Array.from({ length: count }, (_, i) => {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const dx = (Math.random() - 0.5) * 80;
    const dy = (Math.random() - 0.5) * 80;
    const dur = 8 + Math.random() * 8;
    const delay = Math.random() * 10;
    return (
      <div key={i} className="v2-particle" style={{
        left: `${x}%`, top: `${y}%`,
        // @ts-ignore
        "--dx": `${dx}px`, "--dy": `${dy}px`, "--dur": `${dur}s`, "--delay": `-${delay}s`,
      } as any} />
    );
  });
  return <>{particles}</>;
}

export default function VerifyEmailScreen() {
  const { user, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  const isDesktop = isWeb && width >= 960;

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : "";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

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
      toast.error(err?.message || "Erro ao enviar email. Tente reenviar.");
      setSent(true);
    } finally { setSending(false); }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "v2-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

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

      <Text style={s.footerTag}>Aura. - Tecnologia para Negocios</Text>
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%", position: "relative", overflow: "hidden",
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(124,58,237,0.18) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 70%, rgba(139,92,246,0.10) 0%, transparent 50%),
          ${Colors.bg}
        `,
      } as any}>
        <div className="v2-grid" />
        <Particles count={24} />

        {isDesktop ? (
          <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 } as any}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 80px", position: "relative" } as any}>
              <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}><AuraRings /></div>
              <div className="v2-hero" style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 2 } as any}>
                <img src={LOGO_SVG} style={{ width: 32, height: 32 }} />
                <span style={{ fontSize: 22, fontWeight: 800, color: Colors.ink, letterSpacing: -0.5 }}>Aura<span style={{ color: Colors.violet }}>.</span></span>
              </div>
              <div className="v2-hero" style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative", zIndex: 2 } as any}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: Colors.violet3 }}>Quase la</div>
                <div style={{ fontFamily: Fonts.heading, fontSize: 56, lineHeight: 1.08, color: Colors.ink, letterSpacing: -2, maxWidth: 480 }}>
                  O ultimo <em style={{ fontStyle: "italic", color: Colors.violet3 }}>passo</em> antes de entrar.
                </div>
                <div style={{ fontSize: 14, color: Colors.ink2, maxWidth: 420, lineHeight: 1.6 }}>
                  Confirme o e-mail que acabamos de enviar e sua conta fica ativa na hora.
                </div>
              </div>
              <div className="v2-hero" style={{ display: "flex", gap: 20, fontSize: 11, color: Colors.ink3, letterSpacing: 1, textTransform: "uppercase", position: "relative", zIndex: 2 } as any}>
                <span>1 clique no e-mail</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Auto-redirect</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Expira em 24h</span>
              </div>
            </div>

            <div style={{ width: 480, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 60px", position: "relative", zIndex: 2 } as any}>
              {card}
            </div>
          </div>
        ) : (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", zIndex: 2 } as any}>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}><AuraRings /></div>
            {card}
          </div>
        )}
      </div>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.mobileContainer}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], width: "100%", alignItems: "center" }}>
        {card}
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, justifyContent: "center", alignItems: "center" },
  card: { width: "100%", maxWidth: 420, backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, borderWidth: 1, borderColor: Colors.border2, alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  logo: { width: 36, height: 36 },
  brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 12, ...(isWeb ? { fontFamily: Fonts.heading, fontWeight: "400" as any, fontSize: 28 } : {}) },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 20, maxWidth: 320 },
  emailHighlight: { color: Colors.violet3, fontWeight: "600" },
  stepsCard: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, width: "100%", gap: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  stepText: { fontSize: 12, color: Colors.ink3, flex: 1 },
  pollingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  pollingText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  resendBtn: { paddingVertical: 10, marginBottom: 8 },
  resendText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  logoutBtn: { marginTop: 8, paddingVertical: 8 },
  logoutText: { fontSize: 12, color: Colors.ink3 },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5, marginTop: 12 },
});
