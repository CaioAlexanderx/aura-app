// ============================================================
// AURA. — Cadastro em etapas (tq-68, 21/10/2026)
//
// Layout e textos do #scr-register do mockup aprovado "Porta de entrada v4":
// crachá que se forma (nome, loja, contato), trilho "1 / 3", etapa 1 (dados
// e Termos) e etapa 2 (negócio: CNPJ com carimbo da Receita, CPF, dojô e
// código). A etapa 3 é PROVISÓRIA: o tq-69 redesenha (WhatsApp com
// handshake). Aqui ela é o que o cadastro já fazia para o telefone de
// contato e para criar a conta, com o mesmo envio e as mesmas validações.
//
// O que NÃO mudou (regras de antes, só vestidas no palco):
//   - consulta do CNPJ (POST /onboarding/cnpj-lookup) com o regime da
//     Receita no corpo do cadastro (12/10, app#1046);
//   - conta sem CNPJ, com CPF (20/10, app#1119): CPF válido + nome da loja,
//     sem regime; CPF ou CNPJ de outra conta (409 com code) fica na etapa 2;
//   - dojô (F11): vertical karate_dojo + federation_id, a escolha da
//     federação continua obrigatória (o backend responde 400
//     FEDERATION_REQUIRED sem ela) e o dojô nunca entra numa empresa que já
//     existe; varejo com CNPJ de empresa existente entra nela como sempre
//     (o backend decide, o corpo é o mesmo);
//   - convite (invite_token / invite_email): só a etapa 1, aceite depois;
//   - destino depois do cadastro: /(tabs), o AuthGuard decide o resto.
//
// Novo:
//   - e-mail pela URL (?email=, como no login) e código pela URL (?ref= do
//     link de indicação, ou ?codigo=): o campo do código já abre preenchido;
//   - lead parcial (POST /auth/signup-lead, backend#886) nas etapas 1 e 2,
//     SEM await na navegação: qualquer falha segue em frente, sem token e
//     sem aviso (utils/leadDoCadastro). O lead_token vai no register;
//   - origem do cadastro (utm, referrer de fora, ref) lida da URL uma vez
//     (utils/origemDoCadastro), no lead da etapa 1 e no register.
// ============================================================
import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, Linking, useWindowDimensions,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { authApi, ApiError } from "@/services/api";
import { inviteApi } from "@/services/inviteApi";
import { karateSignupApi, type SignupFederation } from "@/services/karateSignupApi";
import { Stage } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { AuthStage, OrbSvg, type OrbMood } from "@/components/auth/AuthStage";
import { maskCnpj, maskCpf, maskPhone } from "@/utils/masks";
import { cpfDoCadastroValido, documentoDoCadastro, conflitoDoCadastro } from "@/utils/documentoEmpresa";
import { regGreeting } from "@/utils/saudacao";
import { lerOrigemDoNavegador, codigoDoLink } from "@/utils/origemDoCadastro";
import { gravarLeadSemTravar, linhaDoCarimbo } from "@/utils/leadDoCadastro";
import { lerDestino } from "@/utils/destinoDepoisDoLogin";

const API_BASE = "https://aura-backend-production-f805.up.railway.app/api/v1";
// Versao dos Termos de Uso vigente — atualizar aqui quando publicar nova versao
const TERMS_VERSION = "2026-03-26";
const TERMS_URL = "https://getaura.com.br/termos";
const isWeb = Platform.OS === "web";

// Ganchos de CSS do palco (components/auth/authStageCss): o RNW 0.19 só
// repassa data-* (dataSet), não className.
const ds = (o: Record<string, string>) => (isWeb ? ({ dataSet: o } as any) : {});
const noOutline = isWeb ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {};
// Serifada e mono vão INLINE (fora do StyleSheet.create), como no login: a
// regra `html body [class]` do painel, que fica na página depois do logout,
// vence a classe atômica do RNW mas perde para estilo inline.
const serif = { fontFamily: Fonts.heading };
const mono = { fontFamily: Fonts.mono };
const PH_COLOR = "rgba(184,172,223,0.55)";

// ── F11: ramo declarado no cadastro ──────────────────────────
// "varejo" e o caminho de sempre (nao manda `vertical` nenhum pro backend).
// "dojo" e o unico ramo self-serve hoje: manda vertical='karate_dojo' +
// federation_id. A lista e FECHADA no backend (SELF_SERVE_VERTICALS em
// src/routes/auth.js) — nao adicionar opcao aqui sem abrir la primeiro.
type Branch = "varejo" | "dojo";
type EmailTaken = null | "409" | "lead";

const digitos = (v: string) => (v || "").replace(/\D/g, "");
const primeiro = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : typeof v === "string" ? v : "");

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

function openTerms() {
  if (isWeb && typeof window !== "undefined") window.open(TERMS_URL, "_blank", "noopener,noreferrer");
  else Linking.openURL(TERMS_URL).catch(() => {});
}

// ── peças pequenas ───────────────────────────────────────────
function Hint({ kind, children, testID }: { kind?: "ok" | "err"; children: ReactNode; testID?: string }) {
  return (
    <View style={s.hint} testID={testID}>
      {kind === "ok" && <Icon name="check_circle" size={13} color={Stage.okText} />}
      {kind === "err" && <Icon name="alert" size={13} color={Stage.peach} />}
      <Text style={[s.hintText, kind === "ok" && { color: Stage.okText }, kind === "err" && { color: Stage.peach }]}>{children}</Text>
    </View>
  );
}

/** Um espaço do crachá: o texto quando existe, o brilho de espera quando não. */
function Slot({ text, style, phW, phH = 9 }: { text: string; style: any; phW: number | string; phH?: number }) {
  if (!text) return <View style={[s.ph, { width: phW as any, height: phH }]} {...ds({ asPh: "1" })} />;
  return <Text style={style} numberOfLines={1} {...ds({ asInk: "1" })}>{text}</Text>;
}

function Cracha({ nome, loja, zap, narrow }: { nome: string; loja: string; zap: string; narrow: boolean }) {
  const filled = [nome, loja, zap].filter(Boolean).length;
  const tag = filled === 3 ? "pronto para nascer" : filled ? filled + " de 3" : "em formação";
  return (
    <View style={[s.idcard, narrow && s.idcardNarrow]} {...ds({ asIdcard: "1" })} aria-live="polite" aria-label="Sua conta Aura, em formação" testID="cadastro-cracha">
      <View style={s.idRow}>
        <View style={[s.mono, narrow && s.monoNarrow]} {...ds({ asMono: !nome ? "empty" : filled === 3 ? "lit" : "half" })}>
          {isWeb ? <OrbSvg /> : <View style={s.monoDot} />}
        </View>
        <View style={s.who}>
          <Slot text={nome} style={[s.nm, narrow && s.nmNarrow, serif]} phW="56%" phH={12} />
          <Slot text={loja} style={[s.st, narrow && s.stNarrow]} phW="40%" />
        </View>
        <Slot text={zap} style={[s.zp, mono]} phW={86} />
      </View>
      {!narrow && (
        <View style={s.tag}>
          <Text style={[s.tagText, mono]}>Conta Aura</Text>
          <Text style={[s.tagText, mono]} testID="cadastro-cracha-tag">{tag}</Text>
        </View>
      )}
    </View>
  );
}

function Trilho({ n }: { n: number }) {
  return (
    <View
      style={s.rail}
      role="progressbar"
      aria-valuemin={1} aria-valuemax={3} aria-valuenow={n}
      aria-label={"Etapa " + n + " de 3"}
      testID="cadastro-trilho"
    >
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[s.railBar, i < n && s.railDone, i === n && s.railNow]}
          {...ds({ asRail: i < n ? "done" : i === n ? "now" : "todo" })}
        />
      ))}
      <Text style={[s.railN, mono]}>{n + " / 3"}</Text>
    </View>
  );
}

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ invite_token?: string; invite_email?: string; email?: string; ref?: string; codigo?: string }>();
  const invite_token = primeiro(params.invite_token);
  const invite_email = primeiro(params.invite_email);
  const isInviteFlow = !!invite_token;
  const { width } = useWindowDimensions();
  const narrow = width <= 480;

  // Lidos UMA vez: o Expo Router pode limpar a query depois.
  const [codigoDaUrl] = useState(() => codigoDoLink(params.ref) || codigoDoLink(params.codigo));
  const [origem] = useState(() => lerOrigemDoNavegador());
  const [saudacao] = useState(() => regGreeting(new Date()));

  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(primeiro(params.email) || invite_email || "");
  const [senha, setSenha] = useState("");
  // E-mail que já tem conta: "409" é o register (definitivo, segura o
  // Continuar); "lead" é a resposta do lead da etapa 1 (avisa uma vez).
  const [emailTaken, setEmailTaken] = useState<EmailTaken>(null);
  const [emailBad, setEmailBad] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [codigo, setCodigo] = useState(codigoDaUrl);
  const [codeOpen, setCodeOpen] = useState(!!codigoDaUrl);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjFound, setCnpjFound] = useState<string | null>(null);
  const [carimbo, setCarimbo] = useState("");
  // 12/10/2026: regime que a consulta de CNPJ detectou pela Receita; vai no
  // corpo do cadastro. Antes ficava só no localStorage e a empresa nascia
  // com o default da coluna (simples_nacional) para todo mundo.
  const [regimeDetectado, setRegimeDetectado] = useState<string | null>(null);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  // 20/10/2026: conta sem CNPJ. "Não tenho CNPJ" troca o campo do CNPJ por
  // CPF (sem consulta à Receita); "Tenho CNPJ" volta ao fluxo de sempre.
  const [semCnpj, setSemCnpj] = useState(false);
  const [cpf, setCpf] = useState("");
  // Consulta de CNPJ em voo quando a pessoa troca para CPF: a resposta chega
  // depois e nao pode preencher nada.
  const semCnpjRef = useRef(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  // Aceite dos Termos de Uso — obrigatorio para prosseguir no cadastro
  const [termsAccepted, setTermsAccepted] = useState(false);
  // F11 — ramo + federacao escolhida (so quando branch === 'dojo')
  const [branch, setBranch] = useState<Branch>("varejo");
  const [federations, setFederations] = useState<SignupFederation[]>([]);
  const [federationId, setFederationId] = useState<string | null>(null);
  const [fedLoading, setFedLoading] = useState(false);
  const [fedError, setFedError] = useState<string | null>(null);
  const fedLoadedRef = useRef(false);
  const [orbSignal, setOrbSignal] = useState<{ mood: OrbMood; n: number } | null>(null);
  const { register, isLoading } = useAuthStore();

  const isDojo = branch === "dojo";
  const orb = (mood: OrbMood) => setOrbSignal((p) => ({ mood, n: (p?.n || 0) + 1 }));

  // ── lead parcial (nunca trava) ──────────────────────────────
  // email/nome: o que a etapa 1 mandou; token: o que voltou; seq descarta
  // resposta velha; avisado: e-mail já avisado como "tem conta" (uma vez).
  const leadRef = useRef<{ email: string; nome: string; token: string | null; seq: number; avisado: string | null; pending: Promise<void> | null }>(
    { email: "", nome: "", token: null, seq: 0, avisado: null, pending: null },
  );
  const stepRef = useRef(step);
  stepRef.current = step;
  const emailRef = useRef(email);
  emailRef.current = email;
  const emailNorm = email.trim().toLowerCase();

  const firstRef = useRef<Record<number, TextInput | null>>({});
  const senhaRef = useRef<TextInput | null>(null);
  const emailInputRef = useRef<TextInput | null>(null);
  const codigoRef = useRef<TextInput | null>(null);

  // Etapa nova: volta a rolagem do palco ao topo (no celular a etapa
  // anterior deixava a nova começar no meio) e foca o primeiro campo (só no
  // computador; no celular o teclado cobriria a etapa que acabou de entrar).
  const montou = useRef(false);
  useEffect(() => {
    if (!montou.current) { montou.current = true; return; }
    if (isWeb && typeof document !== "undefined") {
      try { const sc = document.querySelector(".aura-stage .as-scroll") as HTMLElement | null; if (sc) sc.scrollTop = 0; } catch {}
    }
    if (narrow) return;
    const t = setTimeout(() => { try { firstRef.current[step]?.focus(); } catch {} }, 60);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function avisarContaExistente(e: string) {
    const L = leadRef.current;
    if (L.avisado === e) return;
    L.avisado = e;
    if (emailRef.current.trim().toLowerCase() !== e) return;
    setEmailTaken((cur) => cur || "lead");
    if (stepRef.current > 0) setStep(0);
    orb("hmm");
  }

  function leadEtapa1() {
    const L = leadRef.current;
    const e = emailNorm, n = nome.trim();
    if (L.email === e && L.nome === n) return;
    L.email = e; L.nome = n; L.token = null;
    const seq = ++L.seq;
    L.pending = gravarLeadSemTravar(authApi.signupLead, {
      etapa: 1, nome: n, email: e, terms_accepted: true, terms_version: TERMS_VERSION,
      ...(origem ? { origem } : {}),
    }).then((r) => {
      if (seq !== L.seq) return;
      if (r.tipo === "ok") L.token = r.token;
      else if (r.tipo === "conta_existente") avisarContaExistente(e);
      else { L.email = ""; L.nome = ""; } // falhou: a próxima passagem tenta de novo
    });
  }

  function leadEtapa2() {
    const L = leadRef.current;
    const e = emailNorm;
    const corpo = {
      etapa: 2 as const,
      ...(semCnpj ? { cpf: digitos(cpf) } : { cnpj: digitos(cnpj) }),
      ...(empresa.trim() ? { company_name: empresa.trim() } : {}),
    };
    (async () => {
      if (L.pending) await L.pending; // espera a etapa 1 fora da navegação
      const token = L.token;
      if (!token || L.email !== e) return;
      const r = await gravarLeadSemTravar(authApi.signupLead, { ...corpo, lead_token: token });
      if (r.tipo === "nao_encontrado" && L.token === token) L.token = null;
    })().catch(() => {});
  }

  // F11: carrega as federacoes SOB DEMANDA (so quando a pessoa marca "dojo").
  async function loadFederations(force = false) {
    if (fedLoading) return;
    if (fedLoadedRef.current && !force) return;
    setFedLoading(true);
    setFedError(null);
    try {
      const list = await karateSignupApi.listFederations();
      fedLoadedRef.current = true;
      setFederations(list);
      // Uma federacao so (caso real hoje) — ja seleciona pra poupar um
      // clique. Continua visivel e trocavel se aparecerem outras.
      if (list.length === 1) setFederationId(list[0].id);
    } catch {
      setFedError("Não foi possível carregar as federações.");
    } finally {
      setFedLoading(false);
    }
  }

  function toggleDojo() {
    const next: Branch = isDojo ? "varejo" : "dojo";
    setBranch(next);
    if (next === "dojo") loadFederations();
    // Sair do ramo dojo limpa a escolha — nunca mandar federation_id num
    // cadastro de varejo.
    else setFederationId(null);
  }

  async function lookupCNPJ(formatted: string) {
    const nums = formatted.replace(/\D/g, ""); if (nums.length !== 14) return;
    setCnpjLoading(true); setCnpjFound(null); setCnpjError(null); setCarimbo("");
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller!.abort(), 10000) : null;
      const res = await fetch(API_BASE + "/onboarding/cnpj-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cnpj: nums }), signal: controller?.signal });
      if (timer) clearTimeout(timer);
      if (res.status === 404) { setCnpjError("CNPJ não encontrado na Receita Federal."); orb("hmm"); return; }
      if (res.status === 429) { setCnpjError("Muitas consultas. Aguarde e tente novamente."); return; }
      if (res.status === 422) { const err = await res.json().catch(() => ({})); setCnpjError(err.error || "CNPJ com situação irregular."); orb("hmm"); return; }
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); setCnpjError(err2.error || "Erro na consulta (" + res.status + ")."); return; }
      const data = await res.json();
      if (semCnpjRef.current) return;
      const companyName = data.legal_name || data.trade_name || data.razao_social || data.nome_fantasia || "";
      // O nome da loja segue o de antes (razão social primeiro: é o que vira
      // legal_name no backend). Só preenche se a pessoa não escreveu nada.
      setEmpresa((cur) => (cur.trim() ? cur : companyName));
      setCnpjFound(companyName);
      setCarimbo(linhaDoCarimbo(data));
      saveCnpjData(data);
      const regime = data.is_mei || data.suggested_regime === "mei" ? "mei" : data.suggested_regime || "simples";
      saveDetectedRegime(regime);
      setRegimeDetectado(data.suggested_regime || (data.is_mei ? "mei" : null));
      orb("happy");
    } catch (err: any) {
      setCnpjError(err?.name === "AbortError" ? "Consulta demorou demais. Tente novamente." : "Erro de conexão ao consultar CNPJ.");
    } finally { setCnpjLoading(false); }
  }

  // Troca CNPJ <-> CPF limpando o que a outra forma preencheu: nunca manda
  // os dois, nem o nome que veio da Receita para uma conta com CPF.
  function alternarSemCnpj(next: boolean) {
    if (next === semCnpj) return;
    if (cnpjFound && empresa === cnpjFound) setEmpresa("");
    setCnpj(""); setCnpjFound(null); setCnpjError(null); setRegimeDetectado(null); setCnpjLoading(false); setCarimbo("");
    setCpf("");
    semCnpjRef.current = next;
    setSemCnpj(next);
  }

  function handleCnpjChange(v: string) {
    const masked = maskCnpj(v);
    setCnpj(masked); setCnpjFound(null); setCnpjError(null); setRegimeDetectado(null); setCarimbo("");
    if (masked.replace(/\D/g, "").length === 14) lookupCNPJ(masked);
  }

  async function handleCodeBlur() {
    const code = codigo.trim(); if (!code) { setCodeValid(null); return; }
    setCodeChecking(true);
    try { const r = await authApi.validateCode(code); setCodeValid(r.valid); if (r.valid) toast.success("Código válido!"); else toast.error(r.error || "Código inválido"); }
    catch { setCodeValid(false); toast.error("Código inválido"); }
    finally { setCodeChecking(false); }
  }

  const passLength = senha.length >= 8;
  const passUpper = /[A-Z]/.test(senha);
  const passNumber = /[0-9]/.test(senha);
  const passValid = passLength && passUpper && passNumber;
  const passScore = (passLength ? 1 : 0) + (passUpper ? 1 : 0) + (passNumber ? 1 : 0);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // termsAccepted e obrigatorio para avancar — previne POST sem aceite
  const step1Valid = nome.trim().length > 0 && emailValid && passValid && termsAccepted;
  const cnpjValid = cnpj.replace(/\D/g, "").length === 14 && !!cnpjFound && !cnpjError;
  const cpfValid = cpfDoCadastroValido(cpf);
  const cpfCompleto = cpf.replace(/\D/g, "").length === 11;
  const documentoValid = semCnpj ? cpfValid : cnpjValid;
  const contatoValid = telefoneContato.replace(/\D/g, "").length >= 10;
  // F11: dojo so fecha o cadastro com a federacao escolhida (o backend
  // devolve 400 FEDERATION_REQUIRED sem ela). Varejo: a regra de antes.
  const federationValid = !isDojo || !!federationId;
  const negocioValid = (semCnpj ? empresa.trim().length > 0 : empresa.length > 0) && documentoValid && federationValid;
  const step2Valid = negocioValid && contatoValid;
  const emailHint = emailTaken === "409" || emailTaken === "lead";

  function avancarEtapa1() {
    if (!step1Valid) { orb("hmm"); return; }
    // O register já disse que o e-mail tem conta: Continuar mostra o aviso
    // de novo em vez de levar a pessoa a preencher tudo para nada.
    if (emailTaken === "409") { orb("hmm"); return; }
    leadEtapa1();
    orb("happy");
    setStep(1);
  }

  function avancarEtapa2() {
    if (!negocioValid) { orb("hmm"); return; }
    leadEtapa2();
    orb("happy");
    setStep(2);
  }

  async function handleInviteRegister() {
    if (!step1Valid) { toast.error(!termsAccepted ? "Você precisa aceitar os Termos de Uso para continuar" : "Preencha todos os campos corretamente"); return; }
    try {
      await register({ name: nome.trim(), email: email.trim().toLowerCase(), password: senha, terms_accepted: true, terms_version: TERMS_VERSION });
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
    if (semCnpj) {
      if (!cpfValid) { toast.error("CPF inválido. Confira os números."); return; }
    } else if (!cnpjValid) { toast.error("CNPJ obrigatório. Insira um CNPJ válido."); return; }
    if (!contatoValid) { toast.error("Informe seu telefone para contato."); return; }
    if (semCnpj ? !empresa.trim() : !empresa) { toast.error(isDojo ? "Preencha o nome do dojo" : semCnpj ? "Preencha o nome da sua loja" : "Preencha o nome da empresa"); return; }
    if (isDojo && !federationId) { toast.error("Escolha a federação do seu dojo"); return; }
    const L = leadRef.current;
    const leadToken = L.token && L.email === emailNorm ? L.token : null;
    // tq-91: lido ANTES do cadastro — o AuthGuard consome o destino assim
    // que o token chega.
    const destino = lerDestino();
    try {
      await register({
        name: nome.trim(),
        email: emailNorm,
        password: senha,
        company_name: empresa.trim(),
        phone: telefoneContato.replace(/\D/g, ""),
        // Com CNPJ: cnpj + regime da Receita, como sempre. Sem CNPJ: só o CPF.
        ...documentoDoCadastro({ semCnpj, cnpj, cpf, regimeDetectado }),
        access_code: codigo.trim() || undefined,
        self_serve: true,
        terms_accepted: true,
        terms_version: TERMS_VERSION,
        // F11: so vao no corpo quando o ramo e dojo. O backend trata a
        // ausencia deles como o cadastro de sempre.
        ...(isDojo ? { vertical: "karate_dojo" as const, federation_id: federationId! } : {}),
        // tq-68: liga o lead à conta; a origem também vai aqui porque o lead
        // pode ter falhado (o backend sanitiza e nunca bloqueia por ela).
        ...(leadToken ? { lead_token: leadToken } : {}),
        ...(origem ? { origem } : {}),
      });
      toast.success(isDojo ? "Conta do dojo criada!" : "Conta criada com sucesso!");
      // Self-service: todo cadastro nasce com trial (7d Negocio sem codigo, ou o plano do codigo).
      // Vai pro Painel (como o convite acima): ele leva ao /checkin e o
      // AuthGuard desvia verificacao de e-mail e verticais.
      // tq-91: se veio de um link aberto sem sessão, volta para ele.
      setTimeout(() => router.replace((destino || "/(tabs)/") as any), 300);
    } catch (err) {
      orb("hmm");
      // 409 tem dois significados; o `code` do backend desempata.
      if (err instanceof ApiError && err.status === 409) {
        // F11: CNPJ ja cadastrado — o dojo NUNCA entra numa empresa existente.
        // 20/10/2026: CPF de outra conta — mesmo tratamento. Volta à etapa 2,
        // onde está o documento.
        if (conflitoDoCadastro((err.data as any)?.code) !== "email") {
          toast.error(err.message);
          setStep(1);
          return;
        }
        // e-mail já cadastrado → volta à etapa 1 com o aviso e o atalho de login.
        setEmailTaken("409");
        setStep(0);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar conta");
    }
  }

  const sayStyle = [s.say, narrow && s.sayNarrow, serif];
  const btnStyle = (ok: boolean) => [s.btn, !ok && s.btnOff];
  const loginComEmail = () => router.replace(("/(auth)/login" + (emailNorm ? "?email=" + encodeURIComponent(emailNorm) : "")) as any);

  // ── ETAPA 1 ────────────────────────────────────────────────
  const etapa1 = (
    <View key="s1" {...ds({ asStep: "1" })} testID="cadastro-etapa-1">
      {isInviteFlow ? (
        <>
          <View style={s.inviteBanner}>
            <Icon name="users" size={14} color={Stage.violet3} />
            <Text style={s.inviteBannerText}>Você foi convidado para entrar numa equipe Aura</Text>
          </View>
          <Text style={sayStyle} role="heading" aria-level={1} testID="cadastro-say">Aceite o convite</Text>
          <Text style={s.sub}>Preencha seus dados para entrar na equipe</Text>
        </>
      ) : (
        <>
          <Text style={sayStyle} role="heading" aria-level={1} testID="cadastro-say">
            {saudacao.map((p, i) => (p.em ? <Text key={i} style={[s.em, serif]}>{p.text}</Text> : <Text key={i} style={serif}>{p.text}</Text>))}
          </Text>
          <Text style={s.sub}>Leva um minuto. Nada de cartão, nada de contrato.</Text>
        </>
      )}

      <View style={s.field}>
        <Text style={s.label}>Seu nome</Text>
        <View style={s.inp} {...ds({ asInp: "1" })}>
          <Icon name="user" size={16} color={Stage.ink3} />
          <TextInput
            ref={(r) => { firstRef.current[0] = r; }}
            style={[s.input, noOutline]} value={nome} onChangeText={setNome}
            placeholder="Como você gosta de ser chamado" placeholderTextColor={PH_COLOR}
            autoComplete="name" accessibilityLabel="Seu nome" returnKeyType="next"
            onSubmitEditing={() => emailInputRef.current?.focus()}
            testID="cadastro-nome"
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <View style={[s.inp, (emailHint || emailBad) && s.inpErr]} {...ds({ asInp: "1" })}>
          <Icon name="mail" size={16} color={Stage.ink3} />
          <TextInput
            ref={emailInputRef}
            style={[s.input, noOutline]} value={email}
            onChangeText={(v: string) => { setEmail(v); setEmailTaken(null); setEmailBad(false); }}
            onBlur={() => { if (email.trim() && !emailValid) { setEmailBad(true); orb("hmm"); } }}
            placeholder="seu@email.com" placeholderTextColor={PH_COLOR}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            accessibilityLabel="E-mail" returnKeyType="next"
            onSubmitEditing={() => senhaRef.current?.focus()}
            testID="cadastro-email"
          />
        </View>
        {emailHint ? (
          <Hint kind="err" testID="cadastro-email-tem-conta">
            <Text>Esse e-mail já tem conta por aqui. </Text>
            <Text style={s.hintLink} onPress={loginComEmail} role="link" testID="cadastro-quer-entrar">Quer entrar?</Text>
          </Hint>
        ) : emailBad ? (
          <Hint kind="err">Confere o e-mail? Falta alguma coisa depois do @.</Hint>
        ) : null}
        {isInviteFlow && !!invite_email && <Text style={s.inviteHint}>Sugestão do convite: {invite_email}</Text>}
      </View>

      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <View style={s.inp} {...ds({ asInp: "1" })}>
          <Icon name="lock" size={16} color={Stage.ink3} />
          <TextInput
            ref={senhaRef}
            style={[s.input, noOutline]} value={senha} onChangeText={setSenha}
            placeholder="Pelo menos 8 caracteres" placeholderTextColor={PH_COLOR}
            secureTextEntry={!showPass} autoComplete="new-password" accessibilityLabel="Senha"
            onSubmitEditing={() => { if (!isInviteFlow) avancarEtapa1(); }}
            testID="cadastro-senha"
          />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.ghost} accessibilityLabel={showPass ? "Ocultar senha" : "Mostrar senha"} {...ds({ asGhost: "1" })}>
            <Text style={s.ghostText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
        <View style={s.meter} aria-hidden>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[s.meterBar, passScore >= i && s.meterOn]} {...ds({ asMeter: passScore >= i ? (passScore === 3 ? "full" : "on") : "off" })} />
          ))}
        </View>
        <View style={s.reqs}>
          {([[passLength, "8+ caracteres"], [passUpper, "uma maiúscula"], [passNumber, "um número"]] as const).map(([ok, t]) => (
            <Text key={t} style={[s.req, ok && s.reqOn]}>{t}</Text>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => setTermsAccepted(!termsAccepted)}
        style={s.terms}
        role="checkbox" aria-checked={termsAccepted}
        accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }}
        testID="cadastro-termos"
      >
        <View style={[s.box, termsAccepted && s.boxOn]} {...ds({ asBox: termsAccepted ? "on" : "off" })}>
          {termsAccepted && <Icon name="check" size={11} color="#fff" />}
        </View>
        <Text style={s.termsText}>
          <Text>Li e aceito os </Text>
          <Text style={s.termsLink} role="link" onPress={(e: any) => { e?.stopPropagation?.(); openTerms(); }} testID="cadastro-termos-link">Termos de Uso</Text>
          <Text> da Aura.</Text>
        </Text>
      </Pressable>

      {isInviteFlow ? (
        <Pressable
          style={[s.btn, (isLoading || !step1Valid) && s.btnOff]} {...ds({ asBtn: "1" })}
          onPress={handleInviteRegister} disabled={isLoading || !step1Valid}
          accessibilityRole="button" testID="cadastro-convite-criar"
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, narrow && s.btnTextNarrow]}>Criar conta e aceitar convite</Text>}
        </Pressable>
      ) : (
        <Pressable
          style={btnStyle(step1Valid)} {...ds({ asBtn: "1" })}
          onPress={avancarEtapa1} disabled={!step1Valid}
          accessibilityRole="button" testID="cadastro-continuar-1"
        >
          <Text style={[s.btnText, narrow && s.btnTextNarrow]}>Continuar</Text>
        </Pressable>
      )}

      <View style={s.links}>
        <Text style={s.muted}>Já tem conta?</Text>
        <Link href="/(auth)/login" style={s.lnk} {...ds({ asLink: "1" })}>Entrar</Link>
      </View>
    </View>
  );

  // ── ETAPA 2 ────────────────────────────────────────────────
  const labelNegocio = isDojo ? "Nome do dojo" : semCnpj ? "Nome da sua loja" : "Como a loja se chama";
  const fedBlock = isDojo && (
    <View style={s.fedBlock} testID="cadastro-federacao">
      <Text style={s.label}>Federação *</Text>
      {fedLoading && (
        <View style={s.fedLoadingRow}>
          <ActivityIndicator size="small" color={Stage.violet3} />
          <Text style={s.fedLoadingText}>Carregando federações...</Text>
        </View>
      )}
      {!fedLoading && fedError && (
        <View style={s.fedErrorWrap}>
          <Text style={s.fedErrorText}>{fedError}</Text>
          <Pressable onPress={() => loadFederations(true)} style={s.inlineBtn}>
            <Text style={s.fedRetry}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}
      {!fedLoading && !fedError && federations.length === 0 && (
        <Text style={s.fedEmpty}>Nenhuma federação disponível no momento. Fale com a equipe Aura.</Text>
      )}
      {!fedLoading && !fedError && federations.map((f) => {
        const selected = federationId === f.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => setFederationId(f.id)}
            style={[s.fedItem, selected && s.fedItemActive]}
            role="radio" aria-checked={selected}
            accessibilityRole="radio" accessibilityState={{ selected }}
          >
            <View style={[s.fedRadio, selected && s.fedRadioActive]}>
              {selected && <Icon name="check" size={10} color="#fff" />}
            </View>
            <Text style={[s.fedItemText, selected && s.fedItemTextActive]} numberOfLines={2}>{f.name}</Text>
          </Pressable>
        );
      })}
      {/* Copy que impede o mal-entendido central da fase: escolher a
          federacao no cadastro NAO filia o dojo. */}
      <View style={s.fedNoteWrap}>
        <Icon name="info" size={13} color={Stage.violet3} />
        <Text style={s.fedNote}>
          Escolher a federação aqui não filia seu dojo. Depois de criar a conta,
          você envia o pedido de filiação e a federação aprova.
        </Text>
      </View>
    </View>
  );

  const etapa2 = (
    <View key="s2" {...ds({ asStep: "2" })} testID="cadastro-etapa-2">
      <Text style={sayStyle} role="heading" aria-level={1}>
        <Text style={serif}>E o seu </Text><Text style={[s.em, serif]}>negócio</Text><Text style={serif}>?</Text>
      </Text>
      <Text style={s.sub}>Com o CNPJ a gente puxa o resto na Receita. Sem CNPJ também dá.</Text>

      <View style={s.seg} role="radiogroup" aria-label="Documento" testID="cadastro-documento">
        {([[false, "Tenho CNPJ", "cadastro-tenho-cnpj"], [true, "Não tenho CNPJ", "cadastro-sem-cnpj"]] as const).map(([sem, t, id]) => {
          const on = semCnpj === sem;
          return (
            <Pressable
              key={id}
              onPress={() => alternarSemCnpj(sem)}
              style={[s.segBtn, on && s.segOn]} {...ds({ asSeg: on ? "on" : "off" })}
              role="radio" aria-checked={on}
              accessibilityRole="radio" accessibilityState={{ checked: on }}
              testID={id}
            >
              <Text style={[s.segText, on && s.segTextOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {semCnpj ? (
        <View style={s.field}>
          <Text style={s.label}>CPF</Text>
          <View style={[s.inp, cpfValid && s.inpOk, cpfCompleto && !cpfValid && s.inpErr]} {...ds(cpfValid ? { asInp: "1", asOkk: "1" } : { asInp: "1" })}>
            <Icon name="card" size={16} color={Stage.ink3} />
            <TextInput
              ref={(r) => { firstRef.current[1] = r; }}
              style={[s.input, noOutline]} value={cpf} onChangeText={(v: string) => setCpf(maskCpf(v))}
              placeholder="000.000.000-00" placeholderTextColor={PH_COLOR}
              keyboardType="number-pad" maxLength={14} accessibilityLabel="CPF"
              onSubmitEditing={avancarEtapa2}
              testID="cadastro-cpf"
            />
          </View>
          {cpfCompleto && !cpfValid
            ? <Hint kind="err">CPF inválido. Confira os números.</Hint>
            : <Hint>Você pode usar a Aura sem CNPJ. Se abrir um depois, é só informar em Configurações.</Hint>}
        </View>
      ) : (
        <>
          <View style={s.field}>
            <Text style={s.label}>CNPJ</Text>
            <View style={[s.inp, cnpjFound && s.inpOk, cnpjError && s.inpErr]} {...ds(cnpjFound ? { asInp: "1", asOkk: "1" } : { asInp: "1" })}>
              <Icon name="building" size={16} color={Stage.ink3} />
              <TextInput
                ref={(r) => { firstRef.current[1] = r; }}
                style={[s.input, noOutline]} value={cnpj} onChangeText={handleCnpjChange}
                placeholder="00.000.000/0000-00" placeholderTextColor={PH_COLOR}
                keyboardType="number-pad" maxLength={18} accessibilityLabel="CNPJ"
                onSubmitEditing={avancarEtapa2}
                testID="cadastro-cnpj"
              />
              {cnpjLoading && <ActivityIndicator size="small" color={Stage.violet4} style={{ marginRight: 6 }} />}
            </View>
            {cnpjLoading ? <Hint>Consultando a Receita…</Hint>
              : cnpjFound ? <Hint kind="ok">Achei. Confira o nome da loja abaixo.</Hint>
              : cnpjError ? (
                <View style={s.errRow}>
                  <Hint kind="err">{cnpjError}</Hint>
                  <Pressable onPress={() => { if (cnpj.replace(/\D/g, "").length === 14) lookupCNPJ(cnpj); }} style={s.inlineBtn}>
                    <Text style={s.retry}>Tentar novamente</Text>
                  </Pressable>
                </View>
              )
              : <Hint>Digite os 14 números. A consulta é automática.</Hint>}
          </View>
          {!!cnpjFound && (
            <View style={s.stamp} {...ds({ asStamp: "1" })} testID="cadastro-carimbo">
              <Text style={[s.seal, mono]}>RECEITA ✓</Text>
              <Text style={s.stampT}>Encontrei</Text>
              <Text style={[s.stampN, serif]}>{cnpjFound}</Text>
              {!!carimbo && <Text style={s.stampM}>{carimbo}</Text>}
            </View>
          )}
        </>
      )}

      <View style={s.field}>
        <Text style={s.label} testID="cadastro-label-negocio">{labelNegocio}</Text>
        <View style={s.inp} {...ds({ asInp: "1" })}>
          <Icon name="store" size={16} color={Stage.ink3} />
          <TextInput
            style={[s.input, noOutline]} value={empresa} onChangeText={setEmpresa}
            placeholder="O nome que seus clientes conhecem" placeholderTextColor={PH_COLOR}
            autoComplete="organization" accessibilityLabel={labelNegocio}
            onSubmitEditing={avancarEtapa2}
            testID="cadastro-negocio"
          />
        </View>
      </View>

      {codeOpen && (
        <View style={s.field} testID="cadastro-codigo-campo">
          <Text style={s.label}>Código de indicação</Text>
          <View style={[s.inp, codeValid === true && s.inpOk, codeValid === false && s.inpErr]} {...ds({ asInp: "1" })}>
            <Text style={[s.pre, mono]}>#</Text>
            <TextInput
              ref={codigoRef}
              style={[s.input, noOutline]} value={codigo}
              onChangeText={(v) => { setCodigo(v.toUpperCase()); setCodeValid(null); }}
              onBlur={handleCodeBlur}
              placeholder="Ex.: MARIA7" placeholderTextColor={PH_COLOR}
              autoCapitalize="characters" maxLength={44} accessibilityLabel="Código de indicação"
              onSubmitEditing={avancarEtapa2}
              testID="cadastro-codigo"
            />
            {codeChecking && <ActivityIndicator size="small" color={Stage.violet4} style={{ marginRight: 6 }} />}
          </View>
          <Hint>Se veio por link, já preenchemos sozinhos.</Hint>
        </View>
      )}

      <View style={s.aside}>
        <Pressable
          onPress={toggleDojo}
          style={[s.pick, isDojo && s.pickOn]}
          accessibilityRole="button" {...({ "aria-pressed": isDojo } as any)}
          testID="cadastro-dojo"
        >
          <Text style={[s.pickText, isDojo && s.pickTextOn]}>{isDojo ? "Dojo de karatê · trocar para comércio" : "Meu negócio é um dojo de karatê"}</Text>
        </Pressable>
        {!codeOpen && (
          <Pressable
            onPress={() => { setCodeOpen(true); setTimeout(() => { try { codigoRef.current?.focus(); } catch {} }, 30); }}
            style={s.inlineBtn} accessibilityRole="button" {...ds({ asLink: "1" })}
            testID="cadastro-tenho-codigo"
          >
            <Text style={s.lnkText}>Tenho um código</Text>
          </Pressable>
        )}
      </View>

      {fedBlock}

      <Pressable
        style={btnStyle(negocioValid)} {...ds({ asBtn: "1" })}
        onPress={avancarEtapa2} disabled={!negocioValid}
        accessibilityRole="button" testID="cadastro-continuar-2"
      >
        <Text style={[s.btnText, narrow && s.btnTextNarrow]}>Continuar</Text>
      </Pressable>
      {isDojo && !federationId && !fedLoading && <Text style={s.warn}>Escolha a federação para liberar o cadastro.</Text>}

      <View style={s.links}>
        <Pressable onPress={() => setStep(0)} style={s.inlineBtn} accessibilityRole="button" {...ds({ asLink: "1" })} testID="cadastro-voltar-1">
          <Text style={s.lnkText}>← Voltar</Text>
        </Pressable>
        <View />
      </View>
    </View>
  );

  // ── ETAPA 3 (provisória: o tq-69 redesenha com o handshake) ──
  const etapa3 = (
    <View key="s3" {...ds({ asStep: "3" })} testID="cadastro-etapa-3">
      <Text style={[...sayStyle, s.sayAlone]} role="heading" aria-level={1}>
        <Text style={serif}>Por onde a gente </Text><Text style={[s.em, serif]}>te chama</Text><Text style={serif}>?</Text>
      </Text>
      <View style={s.field}>
        <Text style={s.label}>Seu telefone para contato *</Text>
        <View style={[s.inp, contatoValid && s.inpOk]} {...ds(contatoValid ? { asInp: "1", asOkk: "1" } : { asInp: "1" })}>
          <Icon name="whatsapp" size={16} color={Stage.ink3} />
          <TextInput
            ref={(r) => { firstRef.current[2] = r; }}
            style={[s.input, noOutline]} value={telefoneContato}
            onChangeText={(v: string) => setTelefoneContato(maskPhone(v))}
            placeholder="(12) 99999-0000" placeholderTextColor={PH_COLOR}
            keyboardType="phone-pad" maxLength={15} autoComplete="tel" accessibilityLabel="Seu telefone para contato"
            onSubmitEditing={() => { if (step2Valid && !isLoading) handleRegister(); }}
            testID="cadastro-telefone"
          />
        </View>
        <Hint>WhatsApp ou celular para a Aura entrar em contato.</Hint>
      </View>
      <Pressable
        style={[s.btn, (isLoading || !step2Valid) && s.btnOff]} {...ds({ asBtn: "1" })}
        onPress={handleRegister} disabled={isLoading || !step2Valid}
        accessibilityRole="button" testID="cadastro-criar"
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, narrow && s.btnTextNarrow]}>{isDojo ? "Criar conta do dojo" : "Criar conta"}</Text>}
      </Pressable>
      <View style={s.links}>
        <Pressable onPress={() => setStep(1)} style={s.inlineBtn} accessibilityRole="button" {...ds({ asLink: "1" })} testID="cadastro-voltar-2">
          <Text style={s.lnkText}>← Voltar</Text>
        </Pressable>
        <View />
      </View>
    </View>
  );

  const etapaAtual = isInviteFlow ? etapa1 : step === 0 ? etapa1 : step === 1 ? etapa2 : etapa3;
  const zap = contatoValid ? maskPhone(telefoneContato) : "";

  return (
    <AuthStage cardTone="stage" orbSignal={orbSignal} step={isInviteFlow ? undefined : String(step + 1)} testID="cadastro-stage">
      <View style={s.top}>
        <Text style={s.brand}>Aura<Text style={s.brandDot}>.</Text></Text>
        {!isInviteFlow && <Trilho n={step + 1} />}
      </View>
      {/* Convite não monta loja nem pede WhatsApp: sem crachá. */}
      {!isInviteFlow && <Cracha nome={nome.trim()} loja={empresa.trim()} zap={zap} narrow={narrow} />}
      {etapaAtual}
    </AuthStage>
  );
}

const sans = Fonts.body;
const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  brand: { fontFamily: sans, fontWeight: "800", fontSize: 17, letterSpacing: -0.3, color: Stage.ink2 },
  brandDot: { color: Stage.violet3 },
  // trilho
  rail: { flexDirection: "row", alignItems: "center", gap: 5 },
  railBar: { width: 26, height: 3, borderRadius: 4, backgroundColor: "rgba(230,226,244,0.16)" },
  railDone: { backgroundColor: Stage.violet2 },
  railNow: { width: 38, backgroundColor: Stage.violet },
  railN: { fontSize: 10, color: Stage.ink3, marginLeft: 4, letterSpacing: 0.4 },
  // crachá
  idcard: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginBottom: 16, backgroundColor: "rgba(196,181,253,0.06)", borderWidth: 1, borderColor: "rgba(230,226,244,0.12)", gap: 10 },
  idcardNarrow: { paddingVertical: 8, paddingHorizontal: 10, marginBottom: 12 },
  idRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mono: { width: 44, height: 44, borderRadius: 12, padding: 3, overflow: "hidden", backgroundColor: "#0b0620", alignItems: "center", justifyContent: "center" },
  monoNarrow: { width: 32, height: 32, borderRadius: 9, padding: 2 },
  monoDot: { width: "70%", height: "70%", borderRadius: 999, backgroundColor: Stage.violet },
  who: { flex: 1, minWidth: 0, gap: 3 },
  nm: { fontSize: 19, lineHeight: 21, color: Stage.ink },
  nmNarrow: { fontSize: 16, lineHeight: 18 },
  st: { fontFamily: sans, fontSize: 12, color: Stage.ink2 },
  stNarrow: { fontSize: 11 },
  zp: { fontSize: 11.5, color: Stage.ink3, letterSpacing: 0.2, textAlign: "right", flexShrink: 0 },
  ph: { borderRadius: 5, backgroundColor: "rgba(230,226,244,0.10)" },
  tag: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: "rgba(230,226,244,0.08)", paddingTop: 8 },
  tagText: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: Stage.ink3 },
  // fala
  say: { fontSize: 32, lineHeight: 34, letterSpacing: -0.4, color: Stage.ink, textAlign: "center", marginBottom: 6, fontWeight: "400" },
  sayNarrow: { fontSize: 27, lineHeight: 29 },
  sayAlone: { marginBottom: 16 },
  em: { fontStyle: "italic", color: Stage.violet4 },
  sub: { fontFamily: sans, fontSize: 13.5, lineHeight: 20, color: Stage.ink2, textAlign: "center", marginBottom: 16 },
  inviteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(196,181,253,0.06)", borderRadius: 14, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "rgba(230,226,244,0.10)" },
  inviteBannerText: { fontFamily: sans, fontSize: 12, color: Stage.ink2, flex: 1, lineHeight: 18 },
  inviteHint: { fontFamily: sans, fontSize: 11, color: Stage.violet3 },
  // campos
  field: { marginBottom: 12, gap: 6 },
  label: { fontFamily: sans, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Stage.ink3 },
  inp: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingLeft: 12, paddingRight: 6, borderRadius: 12, backgroundColor: "rgba(7,4,22,0.42)", borderWidth: 1, borderColor: "rgba(230,226,244,0.11)" },
  inpErr: { borderColor: "rgba(240,191,154,0.75)" },
  inpOk: { borderColor: Stage.okMetal },
  input: { flex: 1, minWidth: 0, height: "100%", fontFamily: sans, fontSize: 15, color: Stage.ink, backgroundColor: "transparent", borderWidth: 0 },
  pre: { fontSize: 13, color: Stage.ink2, paddingRight: 8, borderRightWidth: 1, borderRightColor: "rgba(230,226,244,0.10)" },
  ghost: { minHeight: 36, minWidth: 36, paddingHorizontal: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ghostText: { fontFamily: sans, fontSize: 12, fontWeight: "600", color: Stage.violet3 },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 6, flexShrink: 1 },
  hintText: { fontFamily: sans, fontSize: 12, lineHeight: 17, color: Stage.ink3, flexShrink: 1 },
  hintLink: { fontWeight: "600", color: Stage.violet3, textDecorationLine: "underline" },
  errRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  retry: { fontFamily: sans, fontSize: 12, fontWeight: "600", color: Stage.violet3 },
  meter: { flexDirection: "row", gap: 5, marginTop: 2 },
  meterBar: { flex: 1, height: 3, borderRadius: 3, backgroundColor: "rgba(230,226,244,0.10)" },
  meterOn: { backgroundColor: Stage.violet3 },
  reqs: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 0 },
  req: { fontFamily: sans, fontSize: 11, color: Stage.ink3, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: "rgba(230,226,244,0.10)" },
  reqOn: { color: Stage.okText, borderColor: Stage.okMetal },
  // Termos
  terms: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 14, minHeight: 36 },
  box: { width: 18, height: 18, borderRadius: 6, borderWidth: 1, borderColor: "rgba(230,226,244,0.25)", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  boxOn: { backgroundColor: Stage.violet, borderColor: Stage.violet4 },
  termsText: { fontFamily: sans, fontSize: 12.5, lineHeight: 18, color: Stage.ink2, flex: 1 },
  termsLink: { color: Stage.violet3, fontWeight: "600", textDecorationLine: "underline" },
  // botões e links
  btn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: Stage.violet, marginTop: 4 },
  btnOff: { opacity: 0.4 },
  btnText: { fontFamily: sans, color: "#fff", fontSize: 15, fontWeight: "700" },
  btnTextNarrow: { fontSize: 14 },
  links: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 },
  muted: { fontFamily: sans, fontSize: 12.5, color: Stage.ink3 },
  lnk: { fontFamily: sans, fontSize: 12.5, fontWeight: "600", color: Stage.violet3, paddingVertical: 6, minHeight: 36, textDecorationLine: "none", ...(isWeb ? ({ display: "inline-flex", alignItems: "center" } as any) : {}) },
  lnkText: { fontFamily: sans, fontSize: 12.5, fontWeight: "600", color: Stage.violet3 },
  inlineBtn: { minHeight: 36, justifyContent: "center", paddingVertical: 6 },
  warn: { fontFamily: sans, fontSize: 11, color: Stage.peach, textAlign: "center", marginTop: 8 },
  // etapa 2
  seg: { flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: "rgba(7,4,22,0.40)", borderWidth: 1, borderColor: "rgba(230,226,244,0.10)", marginBottom: 12 },
  segBtn: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingVertical: 6, paddingHorizontal: 10 },
  segOn: { backgroundColor: "rgba(124,58,237,0.42)" },
  segText: { fontFamily: sans, fontSize: 13, fontWeight: "600", color: Stage.ink3 },
  segTextOn: { color: Stage.ink },
  stamp: { position: "relative", marginTop: 2, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(196,181,253,0.08)", borderWidth: 1, borderColor: "rgba(196,181,253,0.30)" },
  stampT: { fontFamily: sans, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: Stage.violet4, fontWeight: "700", marginBottom: 4 },
  stampN: { fontSize: 20, lineHeight: 22, color: Stage.ink, paddingRight: 84 },
  stampM: { fontFamily: sans, fontSize: 12, color: Stage.ink2, marginTop: 4 },
  seal: { position: "absolute", right: 12, top: 10, fontSize: 10, letterSpacing: 0.8, color: Stage.okText, borderWidth: 1.5, borderColor: Stage.okMetal, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6, transform: [{ rotate: "-8deg" }] },
  aside: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  pick: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(230,226,244,0.12)", justifyContent: "center", flexShrink: 1 },
  pickOn: { borderColor: "rgba(196,181,253,0.55)", backgroundColor: "rgba(124,58,237,0.18)" },
  pickText: { fontFamily: sans, fontSize: 12.5, color: Stage.ink2 },
  pickTextOn: { color: Stage.ink },
  // federação (F11), no tom do palco
  fedBlock: { marginBottom: 12, gap: 8 },
  fedLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  fedLoadingText: { fontFamily: sans, fontSize: 12, color: Stage.ink3 },
  fedErrorWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Stage.peachD, borderRadius: 12, borderWidth: 1, borderColor: Stage.peachLine, paddingHorizontal: 10 },
  fedErrorText: { fontFamily: sans, fontSize: 12, color: Stage.peachInk, flexShrink: 1 },
  fedRetry: { fontFamily: sans, fontSize: 12, color: Stage.violet3, fontWeight: "700", marginLeft: 8 },
  fedEmpty: { fontFamily: sans, fontSize: 12, color: Stage.peach, lineHeight: 17 },
  fedItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(230,226,244,0.12)", backgroundColor: "rgba(7,4,22,0.42)", paddingHorizontal: 12, paddingVertical: 10 },
  fedItemActive: { borderColor: "rgba(196,181,253,0.55)", backgroundColor: "rgba(124,58,237,0.18)" },
  fedRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "rgba(230,226,244,0.25)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  fedRadioActive: { backgroundColor: Stage.violet, borderColor: Stage.violet4 },
  fedItemText: { fontFamily: sans, fontSize: 13, color: Stage.ink2, fontWeight: "600", flexShrink: 1, lineHeight: 18 },
  fedItemTextActive: { color: Stage.ink },
  fedNoteWrap: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(196,181,253,0.06)", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "rgba(230,226,244,0.10)" },
  fedNote: { fontFamily: sans, fontSize: 11.5, color: Stage.ink2, lineHeight: 16, flexShrink: 1 },
});
