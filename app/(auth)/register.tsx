import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, ScrollView, Image, Animated, Easing,
  useWindowDimensions,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { authApi, ApiError } from "@/services/api";
import { inviteApi } from "@/services/inviteApi";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { maskCNPJ, maskPhone } from "@/utils/masks";

const LOGO_SVG = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";
const API_BASE = "https://aura-backend-production-f805.up.railway.app/api/v1";
const isWeb = Platform.OS === "web";

// Inject the same CSS from login.tsx (reuses .v2-* classes if already present)
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

const STEPS = ["Sua conta", "Sua empresa"];
const webInputProps = isWeb ? { className: "v2-input" } as any : {};
const inputOutline = isWeb ? { outlineWidth: 0 } as any : {};

function Req({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ok ? Colors.green : Colors.ink3 + "44" }} />
      <Text style={{ fontSize: 10, color: ok ? Colors.green : Colors.ink3, fontWeight: "500" }}>{text}</Text>
    </View>
  );
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

function saveDetectedRegime(regime: string) {
  try { if (typeof localStorage === "undefined") return; const cfg = JSON.parse(localStorage.getItem("aura_config") || "{}"); cfg.detectedRegime = regime; localStorage.setItem("aura_config", JSON.stringify(cfg)); } catch {}
}

function saveCnpjData(data: any) {
  try {
    if (typeof localStorage === "undefined") return;
    const cfg = JSON.parse(localStorage.getItem("aura_config") || "{}");
    if (data.legal_name) cfg.companyName = data.legal_name;
    if (data.trade_name) cfg.tradeName = data.trade_name;
    if (data.address_street) { const parts = [data.address_street, data.address_number, data.address_district, data.address_city, data.address_state].filter(Boolean); cfg.address = parts.join(", "); }
    if (data.email) cfg.email = data.email.toLowerCase();
    if (data.phone) cfg.phone = data.phone;
    localStorage.setItem("aura_config", JSON.stringify(cfg));
  } catch {}
}

export default function RegisterScreen() {
  const { invite_token, invite_email } = useLocalSearchParams<{ invite_token?: string; invite_email?: string }>();
  const isInviteFlow = !!invite_token;
  const { width } = useWindowDimensions();
  const isDesktop = isWeb && width >= 960;

  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(invite_email || "");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [telefoneEmpresa, setTelefoneEmpresa] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjFound, setCnpjFound] = useState<string | null>(null);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const { register, isLoading } = useAuthStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  async function lookupCNPJ(formatted: string) {
    const nums = formatted.replace(/\D/g, ""); if (nums.length !== 14) return;
    setCnpjLoading(true); setCnpjFound(null); setCnpjError(null);
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller!.abort(), 10000) : null;
      const res = await fetch(API_BASE + "/onboarding/cnpj-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cnpj: nums }), signal: controller?.signal });
      if (timer) clearTimeout(timer);
      if (res.status === 404) { setCnpjError("CNPJ nao encontrado na Receita Federal."); return; }
      if (res.status === 429) { setCnpjError("Muitas consultas. Aguarde e tente novamente."); return; }
      if (res.status === 422) { const err = await res.json().catch(() => ({})); setCnpjError(err.error || "CNPJ com situacao irregular."); return; }
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); setCnpjError(err2.error || "Erro na consulta (" + res.status + ")."); return; }
      const data = await res.json();
      const companyName = data.legal_name || data.trade_name || data.razao_social || data.nome_fantasia || "";
      setEmpresa(companyName); setCnpjFound(companyName);
      if (data.phone) setTelefoneEmpresa(maskPhone(data.phone));
      else if (data.ddd_telefone_1) setTelefoneEmpresa(maskPhone("" + data.ddd_telefone_1 + (data.telefone_1 || "")));
      saveCnpjData(data);
      saveDetectedRegime(data.is_mei || data.suggested_regime === "mei" ? "mei" : data.suggested_regime || "simples");
    } catch (err: any) {
      setCnpjError(err?.name === "AbortError" ? "Consulta demorou demais. Tente novamente." : "Erro de conexao ao consultar CNPJ.");
    } finally { setCnpjLoading(false); }
  }

  function handleCnpjChange(v: string) { const masked = maskCNPJ(v); setCnpj(masked); setCnpjFound(null); setCnpjError(null); if (masked.replace(/\D/g, "").length === 14) lookupCNPJ(masked); }

  async function handleCodeBlur() {
    const code = codigo.trim(); if (!code) { setCodeValid(null); return; }
    setCodeChecking(true);
    try { const r = await authApi.validateCode(code); setCodeValid(r.valid); if (r.valid) toast.success("Codigo valido!"); else toast.error(r.error || "Codigo invalido"); }
    catch { setCodeValid(false); toast.error("Codigo invalido"); }
    finally { setCodeChecking(false); }
  }

  const passLength = senha.length >= 8;
  const passUpper = /[A-Z]/.test(senha);
  const passNumber = /[0-9]/.test(senha);
  const passMatch = senha === confirmarSenha && confirmarSenha.length > 0;
  const passValid = passLength && passUpper && passNumber;
  const step1Valid = nome.length > 0 && email.includes("@") && passValid && passMatch;
  const cnpjValid = cnpj.replace(/\D/g, "").length === 14 && !!cnpjFound && !cnpjError;
  const contatoValid = telefoneContato.replace(/\D/g, "").length >= 10;
  const step2Valid = empresa.length > 0 && contatoValid && cnpjValid;

  function nextStep() { if (!step1Valid) { toast.error("Preencha todos os campos corretamente"); return; } setStep(1); }

  async function handleInviteRegister() {
    if (!step1Valid) { toast.error("Preencha todos os campos corretamente"); return; }
    try {
      await register({ name: nome.trim(), email: email.trim().toLowerCase(), password: senha });
      if (invite_token) {
        try {
          await inviteApi.accept(invite_token);
          toast.success("Conta criada e convite aceito!");
          setTimeout(() => router.replace("/(tabs)/" as any), 400);
        } catch {
          toast.error("Conta criada! Abra o link do convite novamente para aceitar.");
          setTimeout(() => router.replace("/(tabs)/" as any), 400);
        }
      }
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Erro ao criar conta"); }
  }

  async function handleRegister() {
    if (!cnpjValid) { toast.error("CNPJ obrigatorio. Insira um CNPJ valido."); return; }
    if (!contatoValid) { toast.error("Informe seu telefone para contato."); return; }
    if (!empresa) { toast.error("Preencha o nome da empresa"); return; }
    try {
      await register({ name: nome.trim(), email: email.trim().toLowerCase(), password: senha, company_name: empresa.trim(), phone: telefoneContato.replace(/\D/g, ""), cnpj: cnpj.replace(/\D/g, ""), access_code: codigo.trim() || undefined });
      toast.success("Conta criada com sucesso!");
      const hasTrialCode = codigo.trim() && codeValid === true;
      setTimeout(() => router.replace(hasTrialCode ? "/(tabs)/onboarding" : "/(tabs)/checkout"), 300);
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Erro ao criar conta"); }
  }

  const card = (
    <View style={s.card} {...(isWeb ? { className: "v2-card" } as any : {})}>
      <View style={s.logoRow}>
        <Image source={{ uri: LOGO_SVG }} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>Aura<Text style={{ color: Colors.violet }}>.</Text></Text>
      </View>

      {isInviteFlow && (
        <View style={s.inviteBanner}>
          <Icon name="users" size={14} color={Colors.violet3} />
          <Text style={s.inviteBannerText}>Voce foi convidado para entrar numa equipe Aura</Text>
        </View>
      )}

      <Text style={s.title}>{isInviteFlow ? "Aceite o convite" : "Crie sua conta"}</Text>
      <Text style={s.subtitle}>{isInviteFlow ? "Preencha seus dados para entrar na equipe" : "Organize seu negocio em minutos"}</Text>

      {!isInviteFlow && (
        <View style={s.stepsRow}>
          {STEPS.map((label, i) => (
            <Pressable key={label} onPress={() => { if (i === 0 || step1Valid) setStep(i); }} style={[s.stepItem, step === i && s.stepItemActive]}>
              <View style={[s.stepDot, step === i && s.stepDotActive, i < step && s.stepDotDone]}>
                <Text style={[s.stepDotText, (step === i || i < step) && { color: "#fff" }]}>{i < step ? "OK" : i + 1}</Text>
              </View>
              <Text style={[s.stepLabel, step === i && s.stepLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {(isInviteFlow || step === 0) && (
        <View>
          <View style={s.field}><Text style={s.label}>Nome completo *</Text><View style={s.inputWrap}><Icon name="user_plus" size={16} color={Colors.ink3} /><TextInput style={[s.input, inputOutline]} {...webInputProps} value={nome} onChangeText={setNome} placeholder="Maria da Silva" placeholderTextColor={Colors.ink3} autoComplete="name" /></View></View>
          <View style={s.field}>
            <Text style={s.label}>E-mail *</Text>
            <View style={s.inputWrap}>
              <Icon name="message" size={16} color={Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={email} onChangeText={setEmail} placeholder="maria@empresa.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            </View>
            {isInviteFlow && invite_email && <Text style={{ fontSize: 10, color: Colors.violet3, marginTop: 4 }}>Sugestao do convite: {invite_email}</Text>}
          </View>
          <View style={s.field}>
            <Text style={s.label}>Senha *</Text>
            <View style={s.inputWrap}>
              <Icon name="settings" size={16} color={Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={senha} onChangeText={setSenha} placeholder="Minimo 8 caracteres" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} autoComplete="new-password" />
              <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}><Text style={s.eyeText}>{showPass ? "Ocultar" : "Ver"}</Text></Pressable>
            </View>
            {senha.length > 0 && <View style={s.passReqs}><Req ok={passLength} text="8+ caracteres" /><Req ok={passUpper} text="1 maiuscula" /><Req ok={passNumber} text="1 numero" /></View>}
          </View>
          <View style={s.field}>
            <Text style={s.label}>Confirmar senha *</Text>
            <View style={s.inputWrap}>
              <Icon name="check" size={16} color={confirmarSenha.length > 0 ? (passMatch ? Colors.green : Colors.red) : Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={confirmarSenha} onChangeText={setConfirmarSenha} placeholder="Repita a senha" placeholderTextColor={Colors.ink3} secureTextEntry={!showPass} autoComplete="new-password" />
            </View>
            {confirmarSenha.length > 0 && !passMatch && <Text style={{ fontSize: 10, color: Colors.red, marginTop: 4 }}>As senhas nao conferem</Text>}
          </View>

          {isInviteFlow ? (
            <Pressable style={[s.btn, (isLoading || !step1Valid) && { opacity: 0.6 }]} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={handleInviteRegister} disabled={isLoading || !step1Valid}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar conta e aceitar convite</Text>}
            </Pressable>
          ) : (
            <Pressable style={s.btn} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={nextStep}><Text style={s.btnText}>Continuar</Text></Pressable>
          )}
        </View>
      )}

      {!isInviteFlow && step === 1 && (
        <View>
          <View style={s.field}>
            <Text style={s.label}>CNPJ *</Text>
            <View style={[s.inputWrap, cnpjFound && { borderColor: Colors.green }, cnpjError && { borderColor: Colors.red }]}>
              <Icon name="file_text" size={16} color={cnpjFound ? Colors.green : cnpjError ? Colors.red : Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={cnpj} onChangeText={handleCnpjChange} placeholder="00.000.000/0000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={18} />
              {cnpjLoading && <ActivityIndicator size="small" color={Colors.violet3} />}
            </View>
            {cnpjFound && <View style={s.cnpjOk}><Icon name="check" size={12} color={Colors.green} /><Text style={s.cnpjOkText}>{cnpjFound}</Text></View>}
            {cnpjError && <View style={s.cnpjErrWrap}><Text style={s.cnpjErr}>{cnpjError}</Text><Pressable onPress={() => { if (cnpj.replace(/\D/g, "").length === 14) lookupCNPJ(cnpj); }}><Text style={s.cnpjRetry}>Tentar novamente</Text></Pressable></View>}
            {!cnpjFound && !cnpjError && !cnpjLoading && <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 4 }}>Ao digitar o CNPJ, os dados serao preenchidos automaticamente.</Text>}
          </View>
          <View style={s.field}><Text style={s.label}>Nome da empresa *</Text><View style={s.inputWrap}><Icon name="bag" size={16} color={Colors.ink3} /><TextInput style={[s.input, inputOutline]} {...webInputProps} value={empresa} onChangeText={setEmpresa} placeholder="Minha Empresa Ltda" placeholderTextColor={Colors.ink3} autoComplete="organization" /></View>{cnpjFound && <Text style={{ fontSize: 10, color: Colors.green, marginTop: 4, fontStyle: "italic" }}>Preenchido pelo CNPJ</Text>}</View>
          <View style={s.field}><Text style={s.label}>Telefone da empresa</Text><View style={[s.inputWrap, telefoneEmpresa ? { borderColor: Colors.green + "66" } : {}]}><Icon name="bag" size={16} color={Colors.ink3} /><TextInput style={[s.input, inputOutline, { opacity: telefoneEmpresa ? 0.7 : 1 }]} {...webInputProps} value={telefoneEmpresa} onChangeText={(v: string) => setTelefoneEmpresa(maskPhone(v))} placeholder="Preenchido pelo CNPJ" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} /></View>{telefoneEmpresa && cnpjFound && <Text style={{ fontSize: 10, color: Colors.green, marginTop: 4, fontStyle: "italic" }}>Preenchido pelo CNPJ</Text>}</View>
          <View style={s.field}><Text style={s.label}>Seu telefone para contato *</Text><View style={[s.inputWrap, contatoValid && { borderColor: Colors.green }]}><Icon name="message" size={16} color={contatoValid ? Colors.green : Colors.ink3} /><TextInput style={[s.input, inputOutline]} {...webInputProps} value={telefoneContato} onChangeText={(v: string) => setTelefoneContato(maskPhone(v))} placeholder="(12) 99999-0000" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} autoComplete="tel" /></View><Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 4 }}>WhatsApp ou celular para a Aura entrar em contato.</Text></View>
          <View style={s.field}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={s.label}>Codigo de acesso</Text>
              {codeChecking && <ActivityIndicator size="small" color={Colors.violet3} />}
              {codeValid === true && <Text style={{ fontSize: 10, color: Colors.green, fontWeight: "600" }}>Validado</Text>}
              {codeValid === false && <Text style={{ fontSize: 10, color: Colors.red, fontWeight: "600" }}>Invalido</Text>}
            </View>
            <View style={[s.inputWrap, codeValid === true && { borderColor: Colors.green }, codeValid === false && { borderColor: Colors.red }]}>
              <Icon name="star" size={16} color={codeValid === true ? Colors.green : codeValid === false ? Colors.red : Colors.ink3} />
              <TextInput style={[s.input, inputOutline]} {...webInputProps} value={codigo} onChangeText={(v) => { setCodigo(v.toUpperCase()); setCodeValid(null); }} onBlur={handleCodeBlur} placeholder="BETA01, TRIAL-XXXX..." placeholderTextColor={Colors.ink3} autoCapitalize="characters" maxLength={20} />
            </View>
            <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" }}>Recebeu um codigo? Insira para ativar seu plano. Sem codigo? Voce escolhe o plano na proxima etapa.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={s.backBtn} onPress={() => setStep(0)}><Text style={s.backBtnText}>Voltar</Text></Pressable>
            <Pressable style={[s.btn, { flex: 1 }, (isLoading || !step2Valid) && { opacity: 0.6 }]} {...(isWeb ? { className: "v2-btn" } as any : {})} onPress={handleRegister} disabled={isLoading || !step2Valid}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar conta</Text>}
            </Pressable>
          </View>
          {!step2Valid && cnpj.length > 0 && !cnpjLoading && !cnpjFound && <Text style={{ fontSize: 10, color: Colors.amber, textAlign: "center", marginTop: 8 }}>Aguardando validacao do CNPJ para liberar o cadastro.</Text>}
        </View>
      )}

      <View style={s.footerRow}>
        <Text style={s.footerText}>Ja tem conta? </Text>
        <Link href="/(auth)/login"><Text style={s.link}>Entrar</Text></Link>
      </View>
      <Text style={s.footerTag}>Aura. - Tecnologia para Negocios</Text>
    </View>
  );

  if (isWeb) {
    return (
      <div style={{
        minHeight: "100vh", width: "100%", position: "relative",
        // FIX: overflow-x hidden para conter orbs/partículas lateralmente,
        // mas overflow-y auto permite scroll em viewports pequenas.
        overflowX: "hidden", overflowY: "auto",
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
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: Colors.violet3 }}>Comece em minutos</div>
                <div style={{ fontFamily: Fonts.heading, fontSize: 56, lineHeight: 1.08, color: Colors.ink, letterSpacing: -2, maxWidth: 480 }}>
                  Da <em style={{ fontStyle: "italic", color: Colors.violet3 }}>planilha</em> ao piloto automatico.
                </div>
                <div style={{ fontSize: 14, color: Colors.ink2, maxWidth: 420, lineHeight: 1.6 }}>
                  Crie sua conta, conecte seu CNPJ e deixe a Aura cuidar de nota, caixa e imposto.
                </div>
              </div>
              <div className="v2-hero" style={{ display: "flex", gap: 20, fontSize: 11, color: Colors.ink3, letterSpacing: 1, textTransform: "uppercase", position: "relative", zIndex: 2 } as any}>
                <span>14 dias gratis</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Sem cartao</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>LGPD</span>
              </div>
            </div>

            <div style={{ width: 520, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 60px", position: "relative", zIndex: 2 } as any}>
              {card}
            </div>
          </div>
        ) : (
          // FIX: layout narrow agora usa padding vertical em vez de justify-content: center,
          // para que o card seja acessível mesmo quando maior que a viewport.
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "60px 20px 60px", position: "relative", zIndex: 2 } as any}>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } as any}><AuraRings /></div>
            {card}
          </div>
        )}
      </div>
    );
  }

  // FIX: flex:1 garante que o ScrollView ocupa toda a tela no mobile nativo,
  // permitindo scroll quando o teclado abre ou o conteúdo ultrapassa a viewport.
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.mobileContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], width: "100%", alignItems: "center" }}>
        {card}
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  mobileContainer: { flexGrow: 1, backgroundColor: Colors.bg, padding: 20, paddingTop: 40, paddingBottom: 40, alignItems: "center" },
  card: { width: "100%", maxWidth: 440, backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, borderWidth: 1, borderColor: Colors.border2 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  logo: { width: 36, height: 36 },
  brand: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  inviteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  inviteBannerText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 4, ...(isWeb ? { fontFamily: Fonts.heading, fontWeight: "400" as any, fontSize: 28 } : {}) },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  stepsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  stepItemActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: Colors.green, borderColor: Colors.green },
  stepDotText: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },
  stepLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  stepLabelActive: { color: Colors.violet3, fontWeight: "600" },
  field: { marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, marginBottom: 6, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 12 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  eyeText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  passReqs: { flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" },
  cnpjOk: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cnpjOkText: { fontSize: 11, color: Colors.green, fontWeight: "600" },
  cnpjErrWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, backgroundColor: Colors.redD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cnpjErr: { fontSize: 10, color: Colors.red, flex: 1 },
  cnpjRetry: { fontSize: 10, color: Colors.violet3, fontWeight: "600", marginLeft: 8 },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 16, marginTop: 4 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  backBtn: { backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, alignItems: "center", marginBottom: 16, marginTop: 4, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  footerTag: { fontSize: 11, color: Colors.ink3, textAlign: "center", opacity: 0.5 },
});
