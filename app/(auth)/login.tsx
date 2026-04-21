import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image, Animated, Easing,
  useWindowDimensions,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { inviteApi } from "@/services/inviteApi";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
const isWeb = Platform.OS === "web";

// Web-only CSS: aura rings, particles, grid, magnetic button, input focus
if (typeof document !== "undefined" && !document.getElementById("aura-login-v2-css")) {
  const st = document.createElement("style");
  st.id = "aura-login-v2-css";
  st.textContent = `
    @keyframes auraPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
      50% { transform: translate(-50%, -50%) scale(1.08); opacity: 0.3; }
    }
    @keyframes auraDraw {
      from { stroke-dashoffset: 880; opacity: 0; }
      to { stroke-dashoffset: 0; opacity: 1; }
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
        <div
          key={size}
          className="v2-aura-ring"
          style={{
            width: size, height: size,
            animation: `auraPulse ${6 + i * 0.8}s ease-in-out ${i * 0.3}s infinite`,
            borderColor: i === 0 ? "rgba(167,139,250,0.45)" : "rgba(167,139,250,0.15)",
          } as any}
        />
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
      <div
        key={i}
        className="v2-particle"
        style={{
          left: `${x}%`, top: `${y}%`,
          // @ts-ignore
          "--dx": `${dx}px`, "--dy": `${dy}px`,
          "--dur": `${dur}s`, "--delay": `-${delay}s`,
        } as any}
      />
    );
  });
  return <>{particles}</>;
}

export default function LoginScreen() {
  const { invite_token } = useLocalSearchParams<{ invite_token?: string }>();
  const isInviteFlow = !!invite_token;
  const { width } = useWindowDimensions();
  const isDesktop = isWeb && width >= 960;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const { login, isLoading } = useAuthStore();

  // Native fade-in for mobile
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleLogin() {
    if (!email || !password) { toast.error("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
      if (isInviteFlow && invite_token) {
        try {
          await inviteApi.accept(invite_token);
          toast.success("Login efetuado e convite aceito! Bem-vindo a equipe.");
        } catch (err: any) {
          toast.error(err?.message || "Nao foi possivel aceitar o convite. Tente abrir o link novamente.");
        }
      } else {
        toast.success("Login efetuado!");
      }
      router.replace("/(tabs)");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "E-mail ou senha incorretos.";
      toast.error(msg);
    }
  }

  const formCard = (
    <View style={s.card} {...(isWeb ? { className: "v2-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      {isInviteFlow && (
        <View style={s.inviteBanner}>
          <Icon name="users" size={14} color={Colors.violet3} />
          <Text style={s.inviteBannerText}>Faca login para aceitar o convite e entrar na equipe</Text>
        </View>
      )}

      <Text style={s.title}>{isInviteFlow ? "Entrar para aceitar convite" : "Bem-vindo de volta"}</Text>
      <Text style={s.subtitle}>Entre na sua conta e continue de onde parou</Text>

      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <View style={s.inputWrap}>
          <Icon name="message" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "v2-input" } as any : {})}
            value={email} onChangeText={setEmail}
            placeholder="seu@email.com" placeholderTextColor={Colors.ink3}
            autoCapitalize="none" keyboardType="email-address"
            autoComplete="email"
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <View style={s.inputWrap}>
          <Icon name="settings" size={16} color={Colors.ink3} />
          <TextInput
            style={[s.input, isWeb && { outlineWidth: 0 } as any]}
            {...(isWeb ? { className: "v2-input" } as any : {})}
            value={password} onChangeText={setPassword}
            placeholder="********" placeholderTextColor={Colors.ink3}
            secureTextEntry={!showPass}
            autoComplete="current-password"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
            <Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
      </View>

      <Link href="/(auth)/forgot-password" style={s.forgotRow}>
        <Text style={s.forgotText}>Esqueci minha senha</Text>
      </Link>

      <Pressable
        style={[s.btn, isLoading && { opacity: 0.7 }]}
        {...(isWeb ? { className: "v2-btn" } as any : {})}
        onPress={handleLogin} disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : (
          <Text style={s.btnText}>{isInviteFlow ? "Entrar e aceitar convite" : "Entrar"}</Text>
        )}
      </Pressable>

      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>ou</Text>
        <View style={s.dividerLine} />
      </View>

      <View style={s.footerRow}>
        <Text style={s.footerText}>Nao tem conta? </Text>
        <Link href={isInviteFlow ? `/(auth)/register?invite_token=${invite_token}` : "/(auth)/register"}>
          <Text style={s.link}>Criar conta gratis</Text>
        </Link>
      </View>

      <Text style={s.footerTag}>Aura. - Tecnologia para Negocios</Text>
    </View>
  );

  // WEB: split desktop layout with cinematic hero
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
        <Particles count={28} />

        {isDesktop ? (
          // DESKTOP: split hero + form
          <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 } as any}>
            {/* Hero side */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between",
              padding: "60px 80px", position: "relative",
            } as any}>
              {/* Aura rings behind */}
              <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}>
                <AuraRings />
              </div>

              {/* Logo */}
              <div className="v2-hero" style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 2 } as any}>
                <img src={LOGO_SVG} style={{ width: 32, height: 32 }} />
                <span style={{ fontSize: 22, fontWeight: 800, color: Colors.ink, letterSpacing: -0.5 }}>
                  Aura<span style={{ color: Colors.violet }}>.</span>
                </span>
              </div>

              {/* Hero text block */}
              <div className="v2-hero" style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative", zIndex: 2 } as any}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: Colors.violet3 }}>
                  Gestao Inteligente · 2026
                </div>
                <div style={{ fontFamily: Fonts.heading, fontSize: 56, lineHeight: 1.08, color: Colors.ink, letterSpacing: -2, maxWidth: 480 }}>
                  O seu negocio merece mais do que <em style={{ fontStyle: "italic", color: Colors.violet3 }}>planilhas.</em>
                </div>
                <div style={{ fontSize: 14, color: Colors.ink2, maxWidth: 420, lineHeight: 1.6 }}>
                  Contabilidade, gestao e nota fiscal em um so lugar — rodando enquanto voce dorme.
                </div>
              </div>

              {/* Footer tag */}
              <div className="v2-hero" style={{ display: "flex", gap: 20, fontSize: 11, color: Colors.ink3, letterSpacing: 1, textTransform: "uppercase", position: "relative", zIndex: 2 } as any}>
                <span>Seguranca bancaria</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>LGPD</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Suporte 7 dias</span>
              </div>
            </div>

            {/* Form side */}
            <div style={{
              width: 480, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "40px 60px", position: "relative", zIndex: 2,
            } as any}>
              {formCard}
            </div>
          </div>
        ) : (
          // WEB MOBILE/TABLET: centered
          <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, position: "relative", zIndex: 2,
          } as any}>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}>
              <AuraRings />
            </div>
            {formCard}
          </div>
        )}
      </div>
    );
  }

  // NATIVE mobile: animated ScrollView
  return (
    <ScrollView contentContainerStyle={s.mobileContainer}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], width: "100%", alignItems: "center" }}>
        {formCard}
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, justifyContent: "center", alignItems: "center" },
  card: { width: "100%", maxWidth: 400, backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, borderWidth: 1, borderColor: Colors.border2 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 },
  logo: { width: 36, height: 36 },
  brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  inviteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  inviteBannerText: { fontSize: 12, color: Colors.violet3, flex: 1, lineHeight: 18 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 6, ...(isWeb ? { fontFamily: Fonts.heading, fontWeight: "400" as any, fontSize: 28 } : {}) },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 14 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  forgotRow: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.ink3 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
