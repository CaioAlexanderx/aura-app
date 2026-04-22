import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image, Animated, Easing,
  useWindowDimensions,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { authApi } from "@/services/api";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";
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

const webInputProps = isWeb ? { className: "v2-input" } as any : {};
const inputOutline = isWeb ? { outlineWidth: 0 } as any : {};

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
  const { width } = useWindowDimensions();
  const isDesktop = isWeb && width >= 960;

  const [token, setToken] = useState(params.token || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const passLength = password.length >= 8;
  const passUpper = /[A-Z]/.test(password);
  const passNumber = /[0-9]/.test(password);
  const passValid = passLength && passUpper && passNumber;
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
    <View style={s.card} {...(isWeb ? { className: "v2-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      {!success ? (
        <View>
          <Text style={s.title}>Redefinir senha</Text>
          <Text style={s.subtitle}>Crie uma nova senha para sua conta Aura.</Text>

          <View style={s.field}>
            <Text style={s.label}>Nova senha</Text>
            <View style={s.inputWrap}>
              <Icon name="settings" size={16} color={Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={password} onChangeText={setPassword} placeholder="Minimo 8 caracteres" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} autoComplete="new-password" />
              <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}><Text style={s.eye}>{showPass ? "Ocultar" : "Ver"}</Text></Pressable>
            </View>
            {password.length > 0 && <View style={s.reqs}><Req ok={passLength} text="8+ caracteres" /><Req ok={passUpper} text="1 maiuscula" /><Req ok={passNumber} text="1 numero" /></View>}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirmar nova senha</Text>
            <View style={s.inputWrap}>
              <Icon name="check" size={16} color={confirm.length > 0 ? (passMatch ? Colors.green : Colors.red) : Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} autoComplete="new-password" onSubmitEditing={handleReset} />
            </View>
            {confirm.length > 0 && !passMatch && <Text style={{ fontSize: 10, color: Colors.red, marginTop: 4 }}>As senhas nao conferem</Text>}
          </View>

          <Pressable style={[s.btn, (loading || !passValid || !passMatch) && { opacity: 0.6 }]} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={handleReset} disabled={loading || !passValid || !passMatch}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Redefinir senha</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={s.successCard}>
          <View style={s.successIcon}><Icon name="check" size={28} color={Colors.green} /></View>
          <Text style={s.successTitle}>Senha alterada!</Text>
          <Text style={s.successDesc}>Sua senha foi redefinida com sucesso. Faca login com a nova senha para continuar.</Text>
          <Pressable style={s.btn} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={() => router.replace("/(auth)/login")}><Text style={s.btnText}>Ir para login</Text></Pressable>
        </View>
      )}

      <View style={s.footerRow}>
        <Link href="/(auth)/login"><Text style={s.link}>Voltar para login</Text></Link>
      </View>
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
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: Colors.violet3 }}>Nova senha</div>
                <div style={{ fontFamily: Fonts.heading, fontSize: 56, lineHeight: 1.08, color: Colors.ink, letterSpacing: -2, maxWidth: 480 }}>
                  Uma <em style={{ fontStyle: "italic", color: Colors.violet3 }}>chave</em> nova, pronta pra usar.
                </div>
                <div style={{ fontSize: 14, color: Colors.ink2, maxWidth: 420, lineHeight: 1.6 }}>
                  Escolha uma senha forte e retome de onde parou. Sem friccao.
                </div>
              </div>
              <div className="v2-hero" style={{ display: "flex", gap: 20, fontSize: 11, color: Colors.ink3, letterSpacing: 1, textTransform: "uppercase", position: "relative", zIndex: 2 } as any}>
                <span>8+ caracteres</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>1 maiuscula</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>1 numero</span>
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
  card: { width: "100%", maxWidth: 400, backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, borderWidth: 1, borderColor: Colors.border2 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 },
  logo: { width: 36, height: 36 },
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
