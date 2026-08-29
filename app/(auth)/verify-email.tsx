// ============================================================
// AURA. — Verificação de e-mail (Task Sign Up 03/08/2026)
//
// ANTES: tela otimista que mentia nos erros — envio falho mostrava
// sucesso, polling de 5s fixos com catch{} vazio e token explícito
// (JWT nunca renovava → loop de 401 silencioso), link expirado
// (?verify_error) apagado da URL sem nunca ser exibido, e nenhum
// caminho alternativo ao link.
//
// AGORA: máquina de estados honesta —
//   sending → waiting → done
//              ├→ sendfail  (backend respondeu {sent:false} ou erro)
//              └→ expired   (?verify_error=expired|invalid do link)
// + código OTP de 6 dígitos como caminho paralelo ao link
//   (POST /auth/verify-email; e-mail traz botão E código),
// + polling com backoff (5s→10s→30s) via meSession() (refresh de JWT
//   funciona), erros de conexão visíveis discretamente,
// + reenvio com cooldown sincronizado ao retry_after do servidor,
// + StrictMode-safe (guard de duplo mount; backend também dedupe 60s).
// ============================================================
import { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, Pressable, ActivityIndicator, TextInput,
  StyleSheet, Platform, ScrollView, Image, Animated, Easing,
  useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { authApi, ApiError } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { consumeVerifyLinkError, type VerifyLinkError } from "@/utils/verifyLinkStatus";
import { useLgpdConsentInset } from "@/components/LGPDConsent";

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
  // useMemo: as posições eram sorteadas a cada render — cada tecla digitada
  // reposicionava as 24 partículas (fix transversal da task 03/08).
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    dx: (Math.random() - 0.5) * 80,
    dy: (Math.random() - 0.5) * 80,
    dur: 8 + Math.random() * 8,
    delay: Math.random() * 10,
  })), [count]);
  if (!isWeb) return null;
  return (
    <>
      {particles.map((p, i) => (
        <div key={i} className="v2-particle" style={{
          left: `${p.x}%`, top: `${p.y}%`,
          // @ts-ignore
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--dur": `${p.dur}s`, "--delay": `-${p.delay}s`,
        } as any} />
      ))}
    </>
  );
}

type Status = "sending" | "waiting" | "sendfail" | "expired" | "done";

// Backoff do polling: 3× 5s → 3× 10s → 30s em diante.
function pollDelay(attempt: number): number {
  if (attempt < 3) return 5000;
  if (attempt < 6) return 10000;
  return 30000;
}

const OTP_LEN = 6;

export default function VerifyEmailScreen() {
  const { user, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  const isDesktop = isWeb && width >= 960;
  // 29/08/2026: espaco reservado para o banner de LGPD (0 quando ele nao
  // esta na tela) — o banner nao pode cobrir conteudo interativo.
  const consentInset = useLgpdConsentInset();

  const [status, setStatus] = useState<Status>("sending");
  const [linkError, setLinkError] = useState<VerifyLinkError | null>(null);
  const [sendReason, setSendReason] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [connIssue, setConnIssue] = useState(false);
  const [otpAvailable, setOtpAvailable] = useState(true);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpChecking, setOtpChecking] = useState(false);

  const didInit = useRef(false);            // guard StrictMode/duplo mount
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttempt = useRef(0);
  const pollFails = useRef(0);
  const doneApplied = useRef(false);
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const checkScale = useRef(new Animated.Value(0)).current;

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

  // ── Mount: consome verify_error do link (capturado pelo AuthGuard) e
  //    decide o estado inicial. Guard didInit evita o duplo envio do
  //    StrictMode (o backend ainda tem dedupe de 60s como 2ª barreira).
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const err = consumeVerifyLinkError();
    if (err === "expired" || err === "invalid") {
      setLinkError(err);
      setStatus("expired");
      return; // não auto-envia: o usuário escolhe "Enviar novo link"
    }
    if (err === "server") toast.error("O link de confirmação falhou no servidor. Enviamos um novo.");
    sendLink();
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, []);

  // ── Cooldown do reenvio ──
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Polling com backoff, só enquanto "waiting" ──
  useEffect(() => {
    if (status !== "waiting") {
      if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
      return;
    }
    pollAttempt.current = 0;
    pollFails.current = 0;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        // meSession(): sem token explícito → refresh automático de JWT.
        const res = await authApi.meSession();
        pollFails.current = 0;
        setConnIssue(false);
        if ((res.user as any)?.email_verified) { markVerified(); return; }
      } catch (e: any) {
        pollFails.current += 1;
        if (pollFails.current >= 2) setConnIssue(true);
      }
      pollAttempt.current += 1;
      if (!cancelled) pollTimer.current = setTimeout(tick, pollDelay(pollAttempt.current));
    };
    pollTimer.current = setTimeout(tick, pollDelay(0));
    return () => { cancelled = true; if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [status]);

  function markVerified() {
    if (doneApplied.current) return;
    doneApplied.current = true;
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    setStatus("done");
    Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    // Deixa a celebração respirar antes do AuthGuard redirecionar.
    setTimeout(applyVerified, 1600);
  }

  function applyVerified() {
    const cur = useAuthStore.getState().user;
    if (cur && !(cur as any).email_verified) {
      useAuthStore.setState({ user: { ...cur, email_verified: true } as any });
    }
  }

  async function sendLink() {
    if (sending) return;
    setSending(true);
    setSendReason(null);
    if (status !== "waiting") setStatus("sending");
    try {
      const res = await authApi.sendEmailVerification();
      if (res.already_verified) { markVerified(); return; }
      if (res.sent === false) {
        setSendReason(res.reason || "send_failed");
        setStatus("sendfail");
        return;
      }
      if (res.otp_available === false) setOtpAvailable(false);
      setLinkError(null);
      setStatus("waiting");
      setCooldown(Math.max(15, res.retry_after ?? 60));
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429) {
        // Cota de reenvio: respeita o retry_after do servidor.
        const wait = Math.min(900, Math.max(30, err.data?.retry_after ?? 300));
        setCooldown(wait);
        setStatus("waiting");
        toast.error(`Limite de envios atingido. Você pode reenviar em ${Math.ceil(wait / 60)} min.`);
      } else {
        setSendReason(err?.isNetworkError ? "network" : "request_failed");
        setStatus("sendfail");
      }
    } finally { setSending(false); }
  }

  function handleResend() {
    setResent(true);
    setOtp(Array(OTP_LEN).fill(""));
    setOtpError(null);
    sendLink();
  }

  // ── OTP ──
  function setOtpDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "");
    setOtpError(null);
    if (d.length > 1) {
      // colagem do código inteiro
      const digits = d.slice(0, OTP_LEN).split("");
      const next = Array(OTP_LEN).fill("");
      digits.forEach((x, j) => { next[j] = x; });
      setOtp(next);
      if (digits.length === OTP_LEN) submitOtp(next.join(""));
      else otpRefs.current[digits.length]?.focus();
      return;
    }
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus();
    const code = next.join("");
    if (code.length === OTP_LEN) submitOtp(code);
  }

  function handleOtpKey(i: number, key: string) {
    if (key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  async function submitOtp(code: string) {
    if (otpChecking) return;
    setOtpChecking(true);
    setOtpError(null);
    try {
      const res = await authApi.verifyEmail(code);
      if (res.valid) { markVerified(); return; }
      setOtpError(res.error || "Código incorreto.");
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        // Backend ainda sem a rota (deploy em andamento): esconde o caminho OTP.
        setOtpAvailable(false);
      } else {
        setOtpError(err instanceof ApiError ? err.message : "Não deu para validar o código. Tente de novo.");
      }
    } finally { setOtpChecking(false); }
  }

  const otpSection = otpAvailable && (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View style={s.orSep}>
        <View style={s.orLine} />
        <Text style={s.orTxt}>ou digite o código do e-mail</Text>
        <View style={s.orLine} />
      </View>
      <View style={s.otpRow}>
        {Array.from({ length: OTP_LEN }).map((_, i) => (
          <TextInput
            key={i}
            ref={(r) => { otpRefs.current[i] = r; }}
            style={[s.otpBox, !!otpError && s.otpBoxErr]}
            value={otp[i]}
            onChangeText={(v) => setOtpDigit(i, v)}
            onKeyPress={(e: any) => handleOtpKey(i, e?.nativeEvent?.key)}
            keyboardType="number-pad"
            maxLength={i === 0 ? OTP_LEN : 1}
            selectTextOnFocus
            accessibilityLabel={`Dígito ${i + 1} do código de verificação`}
            {...(isWeb ? { className: "v2-input" } as any : {})}
          />
        ))}
      </View>
      {otpChecking && <Text style={s.otpChecking}>Validando código...</Text>}
      {!!otpError && <Text style={s.otpErr}>{otpError}</Text>}
    </View>
  );

  const exitBtn = (
    <Pressable onPress={logout} style={s.logoutBtn}>
      <Text style={s.logoutText}>Trocar de e-mail ou sair</Text>
    </Pressable>
  );

  // ── Estados ──
  let body: React.ReactNode;
  if (status === "sending") {
    body = (
      <>
        <Text style={s.desc}>Enviando link de confirmação para{"\n"}<Text style={s.emailHighlight}>{maskedEmail}</Text></Text>
        <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 20 }} />
      </>
    );
  } else if (status === "sendfail") {
    body = (
      <>
        <View style={s.bannerRed}>
          <Icon name="alert_triangle" size={16} color={Colors.red} />
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>Não conseguimos enviar o e-mail</Text>
            <Text style={s.bannerTxt}>
              {sendReason === "network"
                ? "Sem conexão com o servidor. Confira sua internet e tente de novo."
                : `Nosso servidor de e-mails não respondeu. Nada foi enviado para ${maskedEmail} — pode tentar de novo agora.`}
            </Text>
          </View>
        </View>
        <Pressable style={s.btn} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={sendLink} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Tentar enviar de novo</Text>}
        </Pressable>
        {exitBtn}
      </>
    );
  } else if (status === "expired") {
    body = (
      <>
        <View style={s.bannerAmber}>
          <Icon name="clock" size={16} color={Colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: Colors.amber }]}>
              {linkError === "invalid" ? "Esse link não é mais válido" : "Esse link já expirou"}
            </Text>
            <Text style={s.bannerTxt}>
              Por segurança o link vale por 1 hora. Enviamos um novo agora mesmo? O código de 6 dígitos do e-mail mais recente também funciona.
            </Text>
          </View>
        </View>
        <Pressable style={s.btn} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={handleResend} disabled={sending || cooldown > 0}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{cooldown > 0 ? `Enviar novo link em ${cooldown}s` : "Enviar novo link"}</Text>}
        </Pressable>
        {otpSection}
        {exitBtn}
      </>
    );
  } else if (status === "done") {
    body = (
      <>
        <Animated.View style={[s.doneCircle, { transform: [{ scale: checkScale }] }]}>
          <Icon name="check" size={38} color={Colors.green} />
        </Animated.View>
        <Text style={s.doneTitle}>E-mail confirmado!</Text>
        <Text style={s.desc}>Sua conta está pronta.{"\n"}Bora organizar o seu negócio?</Text>
        <Pressable style={s.btn} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={applyVerified}>
          <Text style={s.btnText}>Entrar na Aura →</Text>
        </Pressable>
      </>
    );
  } else {
    // waiting
    body = (
      <>
        <View style={s.mailbox}>
          <View style={s.mailIcon}><Icon name="mail" size={18} color={Colors.violet3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.mailTo}>{maskedEmail}</Text>
            <Text style={s.mailAt}>{resent ? "Reenviado agora há pouco" : "Enviado agora há pouco"}</Text>
          </View>
        </View>

        <View style={s.stepsCard}>
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
            <Text style={s.stepText}>Abra seu e-mail (vale conferir o spam)</Text>
          </View>
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
            <Text style={s.stepText}>Clique em "Confirmar meu e-mail"</Text>
          </View>
          <View style={s.step}>
            <View style={[s.stepNum, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
              <Icon name="check" size={12} color={Colors.green} />
            </View>
            <Text style={s.stepText}>Pronto! Você entra automaticamente</Text>
          </View>
        </View>

        {otpSection}

        <View style={s.pollingRow}>
          <ActivityIndicator size="small" color={Colors.violet3} />
          <Text style={s.pollingText}>Aguardando confirmação...</Text>
        </View>
        {connIssue && (
          <Text style={s.connIssue}>Conexão instável — vamos continuar tentando.</Text>
        )}

        <Pressable onPress={handleResend} disabled={cooldown > 0 || sending} style={s.resendBtn}>
          {sending
            ? <ActivityIndicator size="small" color={Colors.violet3} />
            : (
              <Text style={[s.resendText, cooldown > 0 && { opacity: 0.5 }]}>
                {cooldown > 0 ? "Reenviar e-mail em " + cooldown + "s" : "Reenviar e-mail"}
              </Text>
            )}
        </Pressable>
        {exitBtn}
      </>
    );
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "v2-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      <Text style={s.title}>
        {status === "done" ? "Tudo certo" : status === "sendfail" ? "Ops — o e-mail não saiu" : status === "expired" ? "Link expirado" : "Confirme seu e-mail"}
      </Text>

      {body}

      <Text style={s.footerTag}>Aura. - Tecnologia para Negócios</Text>
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%", position: "relative", overflow: "auto",
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(124,58,237,0.18) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 70%, rgba(139,92,246,0.10) 0%, transparent 50%),
          ${Colors.bg}
        `,
      } as any}>
        <div className="v2-grid" />
        <Particles count={24} />

        {isDesktop ? (
          <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1, boxSizing: "border-box", paddingBottom: consentInset } as any}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 80px", position: "relative" } as any}>
              <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}><AuraRings /></div>
              <div className="v2-hero" style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 2 } as any}>
                <img src={LOGO_SVG} style={{ width: 32, height: 32 }} />
                <span style={{ fontSize: 22, fontWeight: 800, color: Colors.ink, letterSpacing: -0.5 }}>Aura<span style={{ color: Colors.violet }}>.</span></span>
              </div>
              <div className="v2-hero" style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative", zIndex: 2 } as any}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: Colors.violet3 }}>Quase lá</div>
                <div style={{ fontFamily: Fonts.heading, fontSize: 56, lineHeight: 1.08, color: Colors.ink, letterSpacing: -2, maxWidth: 480 }}>
                  O último <em style={{ fontStyle: "italic", color: Colors.violet3 }}>passo</em> antes de entrar.
                </div>
                <div style={{ fontSize: 14, color: Colors.ink2, maxWidth: 420, lineHeight: 1.6 }}>
                  Clique no link do e-mail ou digite o código de 6 dígitos — sua conta fica ativa na hora.
                </div>
              </div>
              <div className="v2-hero" style={{ display: "flex", gap: 20, fontSize: 11, color: Colors.ink3, letterSpacing: 1, textTransform: "uppercase", position: "relative", zIndex: 2 } as any}>
                <span>1 clique no e-mail</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>ou código de 6 dígitos</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Expira em 1h</span>
              </div>
            </div>

            <div style={{ width: 480, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 60px", position: "relative", zIndex: 2 } as any}>
              {card}
            </div>
          </div>
        ) : (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, paddingBottom: 20 + consentInset, boxSizing: "border-box", position: "relative", zIndex: 2 } as any}>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}><AuraRings /></div>
            {card}
          </div>
        )}
      </div>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.mobileContainer} keyboardShouldPersistTaps="handled">
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
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 14, ...(isWeb ? { fontFamily: Fonts.heading, fontWeight: "400" as any, fontSize: 28 } : {}) },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 18, maxWidth: 320 },
  emailHighlight: { color: Colors.violet3, fontWeight: "600" },

  mailbox: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg4, borderRadius: 14, padding: 14, width: "100%", borderWidth: 1, borderColor: Colors.border2, marginBottom: 14 },
  mailIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  mailTo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  mailAt: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },

  stepsCard: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, width: "100%", gap: 14, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  stepText: { fontSize: 12, color: Colors.ink3, flex: 1 },

  orSep: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 12, width: "100%" },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orTxt: { fontSize: 10.5, color: Colors.ink3, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  otpRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  otpBox: {
    width: 44, height: 52, textAlign: "center", fontSize: 20, fontWeight: "800", color: Colors.ink,
    backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
  },
  otpBoxErr: { borderColor: Colors.red },
  otpChecking: { fontSize: 11.5, color: Colors.violet3, marginTop: 8 },
  otpErr: { fontSize: 11.5, color: Colors.red, marginTop: 8, textAlign: "center" },

  bannerRed: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.red + "12", borderWidth: 1, borderColor: Colors.red + "44", borderRadius: 13, padding: 13, width: "100%", marginBottom: 16 },
  bannerAmber: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.amber + "10", borderWidth: 1, borderColor: Colors.amber + "44", borderRadius: 13, padding: 13, width: "100%", marginBottom: 16 },
  bannerTitle: { fontSize: 13.5, fontWeight: "800", color: Colors.red, marginBottom: 3 },
  bannerTxt: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },

  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", width: "100%", marginTop: 4 },
  btnText: { fontSize: 14.5, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },

  doneCircle: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: Colors.green,
    backgroundColor: Colors.green + "14", alignItems: "center", justifyContent: "center", marginBottom: 16, marginTop: 4,
  },
  doneTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 8, ...(isWeb ? { fontFamily: Fonts.heading, fontWeight: "400" as any, fontSize: 26 } : {}) },

  pollingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 2 },
  pollingText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  connIssue: { fontSize: 11, color: Colors.amber, marginTop: 4, textAlign: "center" },

  resendBtn: { paddingVertical: 12, marginTop: 6, minHeight: 42, alignItems: "center", justifyContent: "center" },
  resendText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  logoutBtn: { marginTop: 4, paddingVertical: 10, minHeight: 40 },
  logoutText: { fontSize: 12, color: Colors.ink3 },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5, marginTop: 14 },
});
