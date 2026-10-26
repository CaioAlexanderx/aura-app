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
//
// 26/10/2026: "Corrigir meu e-mail". Quem criou a conta com o e-mail
// errado (erro de digitação) não tinha saída: o botão "Trocar de e-mail
// ou sair" só saía, e recadastrar não resolve (com CNPJ a conta nova entra
// como vendedor da loja que já existe; com CPF dá CPF já cadastrado).
// Agora o link abre o campo com o e-mail atual e "Salvar e reenviar"
// (POST /auth/corrigir-email); a tela passa a mostrar o e-mail novo e diz
// que o link foi reenviado. O e-mail aparece inteiro (era mascarado): é da
// própria pessoa, logada, e é vendo ele inteiro que se nota o erro.
// O botão de sair passa a se chamar só "Sair".
//
// 26/10/2026 (tq-113): quem não confirmou em 7 dias teve a empresa
// desativada pelo backend; a confirmação reabre. Como o login foi feito
// sem empresa, ao confirmar a tela renova o token e relê o /me antes de
// liberar a entrada (utils/empresaAoConfirmar). Conta comum: nada muda.
// ============================================================
import { useState, useEffect, useRef } from "react";
import {
  View, Text, Pressable, ActivityIndicator, TextInput,
  StyleSheet, Platform, Animated, Linking,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { authApi, ApiError, renovarToken } from "@/services/api";
import { recarregarEmpresaAoConfirmar } from "@/utils/empresaAoConfirmar";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { consumeVerifyLinkError, type VerifyLinkError } from "@/utils/verifyLinkStatus";
import { AuthStage } from "@/components/auth/AuthStage";
import { waAura } from "@/constants/suporteAura";
import {
  normalizarEmailDigitado, erroAoCorrigir, MSG_EMAIL_INCOMPLETO, MSG_EMAIL_IGUAL,
  TEXTO_WHATSAPP_CORRIGIR_EMAIL, type ErroAoCorrigir,
} from "@/utils/corrigirEmail";

const isWeb = Platform.OS === "web";

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
  // "Corrigir meu e-mail"
  const [editing, setEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<ErroAoCorrigir | null>(null);
  const [corrigido, setCorrigido] = useState(false);

  const didInit = useRef(false);            // guard StrictMode/duplo mount
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttempt = useRef(0);
  const pollFails = useRef(0);
  const doneApplied = useRef(false);
  const recargaDaEmpresa = useRef<Promise<boolean> | null>(null);
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const checkScale = useRef(new Animated.Value(0)).current;

  // Inteiro, não mascarado: é vendo o e-mail todo que a pessoa nota o erro.
  const emailAtual = user?.email || "";


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
    // tq-113: em paralelo com a celebração; applyVerified espera.
    recargaDaEmpresa.current = recarregarEmpresaAoConfirmar({ getState: useAuthStore.getState, renovarToken });
    Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    // Deixa a celebração respirar antes do AuthGuard redirecionar.
    setTimeout(applyVerified, 1600);
  }

  async function applyVerified() {
    if (recargaDaEmpresa.current) await recargaDaEmpresa.current;
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

  // ── Corrigir meu e-mail ──
  function abrirCorrecao() {
    setEmailDraft(emailAtual);
    setEditErr(null);
    setEditing(true);
  }

  function cancelarCorrecao() {
    setEditing(false);
    setEditErr(null);
  }

  async function salvarCorrecao() {
    if (saving) return;
    const novo = normalizarEmailDigitado(emailDraft);
    if (!novo) { setEditErr({ texto: MSG_EMAIL_INCOMPLETO, falarComAGente: false }); return; }
    if (novo === emailAtual.trim().toLowerCase()) { setEditErr({ texto: MSG_EMAIL_IGUAL, falarComAGente: false }); return; }
    setSaving(true);
    setEditErr(null);
    try {
      const res = await authApi.corrigirEmail(novo);
      const emailNovo = res.user?.email || novo;
      const cur = useAuthStore.getState().user;
      if (cur) useAuthStore.setState({ user: { ...cur, email: emailNovo } as any });
      setCorrigido(true);
      setResent(true);
      setOtp(Array(OTP_LEN).fill(""));
      setOtpError(null);
      setLinkError(null);
      setEditing(false);
      if (res.otp_available === false) setOtpAvailable(false);
      if (res.sent === false) {
        setSendReason(res.reason || "send_failed");
        setStatus("sendfail");
        return;
      }
      setStatus("waiting");
      setCooldown(Math.max(15, res.retry_after ?? 60));
    } catch (err: any) {
      setEditErr(erroAoCorrigir(err));
    } finally { setSaving(false); }
  }

  const corrigirLink = (
    <Pressable onPress={abrirCorrecao} style={s.fixBtn} testID="corrigir-email-abrir" accessibilityRole="button">
      <Text style={s.fixText}>Corrigir meu e-mail</Text>
    </Pressable>
  );

  const exitBtn = (
    <>
      {corrigirLink}
      <Pressable onPress={() => { logout(); }} style={s.logoutBtn} testID="verify-sair" accessibilityRole="button">
        <Text style={s.logoutText}>Sair</Text>
      </Pressable>
    </>
  );

  // ── Estados ──
  let body: React.ReactNode;
  if (editing) {
    body = (
      <>
        <Text style={s.desc}>Digite o e-mail certo. A gente manda um link novo para ele.</Text>
        <View style={s.field}>
          <Text style={s.fieldLabel}>Seu e-mail</Text>
          <TextInput
            style={[s.emailInput, !!editErr && s.emailInputErr]}
            value={emailDraft}
            onChangeText={(v) => { setEmailDraft(v); if (editErr) setEditErr(null); }}
            placeholder="seu@email.com"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={salvarCorrecao}
            editable={!saving}
            accessibilityLabel="Seu e-mail"
            testID="corrigir-email-campo"
            {...(isWeb ? { className: "v2-input" } as any : {})}
          />
          {!!editErr && (
            <View testID="corrigir-email-erro">
              <Text style={s.fieldErr}>{editErr.texto}</Text>
              {editErr.falarComAGente && (
                <Pressable
                  onPress={() => { Linking.openURL(waAura(TEXTO_WHATSAPP_CORRIGIR_EMAIL)).catch(() => {}); }}
                  testID="corrigir-email-whatsapp"
                  accessibilityRole="link"
                >
                  <Text style={s.fieldHelp}>Falar com a gente no WhatsApp</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
        <Pressable
          style={[s.btn, saving && { opacity: 0.7 }]}
          {...(isWeb ? { className: "v2-btn" } as any : {})}
          onPress={salvarCorrecao}
          disabled={saving}
          testID="corrigir-email-salvar"
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salvar e reenviar</Text>}
        </Pressable>
        <Pressable onPress={cancelarCorrecao} style={s.logoutBtn} disabled={saving} testID="corrigir-email-cancelar" accessibilityRole="button">
          <Text style={s.logoutText}>Cancelar</Text>
        </Pressable>
      </>
    );
  } else if (status === "sending") {
    body = (
      <>
        <Text style={s.desc}>Enviando link de confirmação para{"\n"}<Text style={s.emailHighlight}>{emailAtual}</Text></Text>
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
                : `Nosso servidor de e-mails não respondeu. Nada foi enviado para ${emailAtual} — pode tentar de novo agora.`}
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
            <Text style={s.mailTo}>{emailAtual}</Text>
            <Text style={s.mailAt} testID="verify-enviado">
              {corrigido ? "E-mail corrigido. Reenviamos o link agora há pouco." : resent ? "Reenviado agora há pouco" : "Enviado agora há pouco"}
            </Text>
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
    <View style={s.card}>
      <View style={s.logoRow}>
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      <Text style={s.title}>
        {editing ? "Corrigir meu e-mail" : status === "done" ? "Tudo certo" : status === "sendfail" ? "Ops — o e-mail não saiu" : status === "expired" ? "Link expirado" : "Confirme seu e-mail"}
      </Text>

      {body}

      <Text style={s.footerTag}>Aura. - Tecnologia para Negócios</Text>
    </View>
  );

  return <AuthStage>{card}</AuthStage>;
}

const s = StyleSheet.create({
  // 21/10/2026 (tq-67): o vidro, o aro e o orbe são do AuthStage; aqui só o miolo.
  card: { width: "100%", alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
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
  fixBtn: { marginTop: 2, paddingVertical: 10, minHeight: 40, alignItems: "center", justifyContent: "center" },
  fixText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  logoutBtn: { marginTop: 4, paddingVertical: 10, minHeight: 40 },
  field: { width: "100%", marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  emailInput: {
    width: "100%", height: 48, paddingHorizontal: 14, fontSize: 15, color: Colors.ink,
    backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
  },
  emailInputErr: { borderColor: Colors.red },
  fieldErr: { fontSize: 12, color: Colors.red, marginTop: 8, lineHeight: 17 },
  fieldHelp: { fontSize: 12, color: Colors.violet3, fontWeight: "600", marginTop: 6 },
  logoutText: { fontSize: 12, color: Colors.ink3 },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5, marginTop: 14 },
});
