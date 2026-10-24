// ============================================================
// AURA. — Login (tq-67, 21/10/2026: palco compartilhado + saudações vivas)
//
// Layout e textos do #scr-login do mockup aprovado "Porta de entrada v4".
// A LÓGICA é a de antes, sem mudança: mesma chamada de login, convite por
// link (aceite depois do login), entrada Shoji do Karatê (trigger + /karate),
// e-mail vindo pela URL (?email=, handoff do /comecar) e o resto do caminho
// (verificação de e-mail e verticais) com o AuthGuard, que decide depois do
// router.replace("/(tabs)").
//
// O que mudou de comportamento, de propósito:
//   - senha errada (ApiError 401) aparece na linha pêssego do mockup, no
//     cartão, em vez de toast; os outros erros seguem no toast de sempre;
//   - a saudação vem de utils/saudacao (hora, data especial, dia da
//     semana) e chama pelo primeiro nome do último login neste aparelho
//     (utils/primeiroNomeNoAparelho). O convite mantém o título próprio.
//
// 24/10/2026 (tq-91): link aberto sem sessão volta para a tela pedida. O
// AuthGuard guardou o destino (utils/destinoDepoisDoLogin); aqui o login lê
// antes de entrar e vai para ele em vez do /(tabs). Convite e Karatê
// (Shoji) mantêm o caminho deles.
// ============================================================
import { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Platform, useWindowDimensions,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { inviteApi } from "@/services/inviteApi";
import { Stage } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useKarateIntro } from "@/stores/karateIntro";
import { AuthStage, type OrbMood } from "@/components/auth/AuthStage";
import { greeting } from "@/utils/saudacao";
import { lerPrimeiroNome, guardarPrimeiroNome } from "@/utils/primeiroNomeNoAparelho";
import { lerDestino, limparDestino } from "@/utils/destinoDepoisDoLogin";
import { MSG_LOGIN_FALTA_DADO } from "@/utils/mensagensDoApp";

const isWeb = Platform.OS === "web";
// DESIGN-29: animação de login Shoji é exibida só quando o vertical é karatê.
const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];
// Ganchos de CSS do palco (components/auth/authStageCss): o RNW 0.19 só
// repassa data-* (dataSet), não className.
const hook = (k: string) => (isWeb ? ({ dataSet: { [k]: "1" } } as any) : {});
const noOutline = isWeb ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {};
// Serifada e mono vão INLINE (objeto solto, fora do StyleSheet.create): o
// painel injeta `html body [class]`/`[dir]` com a DM Sans, e essa regra fica
// na página depois do logout. Ela vence a classe atômica do RNW, mas perde
// para estilo inline (ver app/(tabs)/_layout.tsx, useWebFonts).
const serif = { fontFamily: Fonts.heading };
const mono = { fontFamily: Fonts.mono };

export default function LoginScreen() {
  // `email`/`from`: handoff do checkout do site (/comecar) — pré-preenche o
  // e-mail da conta recém-criada (T3.2, fallback v1 sem SSO cross-origin).
  const { invite_token, email: emailParam } = useLocalSearchParams<{ invite_token?: string; email?: string }>();
  const isInviteFlow = !!invite_token;
  const { width } = useWindowDimensions();
  const narrow = width <= 480;

  const [email, setEmail] = useState(typeof emailParam === "string" ? emailParam : "");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [wrongPass, setWrongPass] = useState(false);
  const [orbSignal, setOrbSignal] = useState<{ mood: OrbMood; n: number } | null>(null);
  const passRef = useRef<TextInput | null>(null);
  const { login, isLoading } = useAuthStore();
  // Sorteada uma vez por visita: re-render não troca a frase na cara da pessoa.
  const [saudacao] = useState(() => greeting(new Date(), lerPrimeiroNome()));

  const orb = (mood: OrbMood) => setOrbSignal((p) => ({ mood, n: (p?.n || 0) + 1 }));

  async function handleLogin() {
    if (!email || !password) { orb("hmm"); toast.error(MSG_LOGIN_FALTA_DADO); return; }
    setWrongPass(false);
    // tq-91: lido ANTES de entrar — o AuthGuard consome o destino assim que o
    // token chega, e os dois precisam ir para o mesmo lugar. O convite tem o
    // caminho dele: destino velho não vale.
    if (isInviteFlow) limparDestino();
    const destino = isInviteFlow ? null : lerDestino();
    try {
      await login(email.trim().toLowerCase(), password);
      // Só o primeiro nome, só neste aparelho (nunca o e-mail).
      guardarPrimeiroNome(useAuthStore.getState().user?.name);
      orb("happy");
      if (isInviteFlow && invite_token) {
        try {
          await inviteApi.accept(invite_token);
          toast.success("Login efetuado e convite aceito! Bem-vindo à equipe.");
        } catch (err: any) {
          toast.error(err?.message || "Não foi possível aceitar o convite. Tente abrir o link novamente.");
        }
      } else {
        toast.success("Login efetuado!");
      }
      // Karatê tem porta dedicada: dispara a animação Shoji (one-shot) e
      // navega para /karate ao final. Demais verticais seguem o fluxo normal.
      const co = useAuthStore.getState().company as any;
      const vertical = co?.vertical_active ?? co?.vertical;
      // Entrada Shoji (portas abrindo) é uma cerimônia de login: dispara a
      // cada AÇÃO de login com senha (uma vez por sessão). Não é montada no
      // shell, então não reaparece em refresh/navegação. Karatê → /karate.
      if (KARATE_VERTICALS.includes(vertical)) { useKarateIntro.getState().trigger(); router.replace("/karate"); return; }
      router.replace((destino || "/(tabs)") as any);
    } catch (err) {
      orb("hmm");
      // Senha errada chega como ApiError 401 com a mensagem do backend: vira
      // a linha pêssego do cartão. O que não é ApiError não veio do servidor:
      // não dá para afirmar que a senha está errada (toast de sempre).
      if (err instanceof ApiError && err.status === 401) { setWrongPass(true); return; }
      const msg = err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.";
      toast.error(msg);
    }
  }

  const sayStyle = [s.say, narrow && s.sayNarrow, serif];

  return (
    <AuthStage cardTone="stage" orbSignal={orbSignal} testID="login-stage">
      <View style={s.top}>
        <Text style={s.brand}>Aura<Text style={s.brandDot}>.</Text></Text>
        <Text style={[s.tag, mono]}>ENTRAR</Text>
      </View>

      {isInviteFlow && (
        <View style={s.inviteBanner}>
          <Icon name="users" size={14} color={Stage.violet3} />
          <Text style={s.inviteBannerText}>Faça login para aceitar o convite e entrar na equipe</Text>
        </View>
      )}

      {isInviteFlow ? (
        <>
          <Text style={sayStyle} role="heading" aria-level={1} testID="login-say">Entrar para aceitar convite</Text>
          <Text style={s.sub}>Entre na sua conta e continue de onde parou</Text>
        </>
      ) : (
        <>
          <Text style={sayStyle} role="heading" aria-level={1} testID="login-say">
            {saudacao.say.map((p, i) => (p.em ? <Text key={i} style={[s.em, serif]}>{p.text}</Text> : <Text key={i} style={serif}>{p.text}</Text>))}
          </Text>
          <Text style={s.sub} testID="login-sub">{saudacao.sub}</Text>
        </>
      )}

      {wrongPass && (
        <View style={s.errLine} role="alert" testID="login-err">
          <Icon name="alert" size={14} color={Stage.peachInk} />
          <Text style={s.errText}>
            <Text>Essa senha não bateu. Quer tentar de novo ou </Text>
            <Text style={s.errLink} onPress={() => router.push("/(auth)/forgot-password")} role="link">redefinir</Text>
            <Text>?</Text>
          </Text>
        </View>
      )}

      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <View style={s.inp} {...hook("asInp")}>
          <Icon name="mail" size={16} color={Stage.ink3} />
          <TextInput
            style={[s.input, noOutline]}
            value={email}
            onChangeText={(v) => { setEmail(v); if (wrongPass) setWrongPass(false); }}
            placeholder="seu@email.com" placeholderTextColor="rgba(184,172,223,0.55)"
            autoCapitalize="none" keyboardType="email-address"
            autoComplete="email" accessibilityLabel="E-mail"
            returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()}
            testID="login-email"
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <View style={[s.inp, wrongPass && s.inpErr]} {...hook("asInp")}>
          <Icon name="lock" size={16} color={Stage.ink3} />
          <TextInput
            ref={passRef}
            style={[s.input, noOutline]}
            value={password}
            onChangeText={(v) => { setPassword(v); if (wrongPass) setWrongPass(false); }}
            placeholder="••••••••" placeholderTextColor="rgba(184,172,223,0.55)"
            secureTextEntry={!showPass}
            autoComplete="current-password" accessibilityLabel="Senha"
            onSubmitEditing={handleLogin}
            testID="login-senha"
          />
          <Pressable onPress={() => setShowPass(!showPass)} style={s.ghost} accessibilityLabel={showPass ? "Ocultar senha" : "Mostrar senha"} {...hook("asGhost")}>
            <Text style={s.ghostText}>{showPass ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.forgotRow}>
        <Link href="/(auth)/forgot-password" style={s.lnk} {...hook("asLink")}>Esqueci minha senha</Link>
      </View>

      <Pressable
        style={[s.btn, narrow && s.btnNarrow, isLoading && { opacity: 0.7 }]}
        {...hook("asBtn")}
        onPress={handleLogin} disabled={isLoading}
        accessibilityRole="button"
        testID="login-entrar"
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : (
          <Text style={[s.btnText, narrow && s.btnTextNarrow]}>{isInviteFlow ? "Entrar e aceitar convite" : "Entrar"}</Text>
        )}
      </Pressable>

      <View style={s.divider}>
        <View style={s.dividerLine} {...hook("asDivider")} />
        <Text style={s.dividerText}>ou</Text>
        <View style={s.dividerLine} {...hook("asDivider")} />
      </View>

      <View style={s.linksCenter}>
        <Text style={s.muted}>Primeira vez por aqui?</Text>
        <Link href={isInviteFlow ? `/(auth)/register?invite_token=${invite_token}` : "/(auth)/register"} style={s.lnk} {...hook("asLink")}>Criar conta grátis</Link>
      </View>

      <Text style={s.foot}>Aura. · Tecnologia para negócios</Text>
    </AuthStage>
  );
}

const sans = Fonts.body;
const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  brand: { fontFamily: sans, fontWeight: "800", fontSize: 17, letterSpacing: -0.3, color: Stage.ink2 },
  brandDot: { color: Stage.violet3 },
  tag: { fontSize: 10, color: Stage.ink3, letterSpacing: 0.6 },
  inviteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(196,181,253,0.06)", borderRadius: 14, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "rgba(230,226,244,0.10)" },
  inviteBannerText: { fontFamily: sans, fontSize: 12, color: Stage.ink2, flex: 1, lineHeight: 18 },
  say: { fontSize: 32, lineHeight: 34, letterSpacing: -0.4, color: Stage.ink, textAlign: "center", marginBottom: 6, fontWeight: "400" },
  sayNarrow: { fontSize: 27, lineHeight: 29 },
  em: { fontStyle: "italic", color: Stage.violet4 },
  sub: { fontFamily: sans, fontSize: 13.5, lineHeight: 20, color: Stage.ink2, textAlign: "center", marginBottom: 16 },
  errLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Stage.peachD, borderWidth: 1, borderColor: Stage.peachLine, marginBottom: 12 },
  errText: { fontFamily: sans, fontSize: 12.5, lineHeight: 18, color: Stage.peachInk, flex: 1 },
  errLink: { color: Stage.peachInk, textDecorationLine: "underline", fontWeight: "600" },
  field: { marginBottom: 12, gap: 6 },
  label: { fontFamily: sans, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Stage.ink3 },
  inp: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingLeft: 12, paddingRight: 6, borderRadius: 12, backgroundColor: "rgba(7,4,22,0.42)", borderWidth: 1, borderColor: "rgba(230,226,244,0.11)" },
  inpErr: { borderColor: "rgba(240,191,154,0.75)" },
  input: { flex: 1, minWidth: 0, height: "100%", fontFamily: sans, fontSize: 15, color: Stage.ink, backgroundColor: "transparent", borderWidth: 0 },
  ghost: { minHeight: 36, minWidth: 36, paddingHorizontal: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ghostText: { fontFamily: sans, fontSize: 12, fontWeight: "600", color: Stage.violet3 },
  forgotRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: -6, marginBottom: 10 },
  lnk: { fontFamily: sans, fontSize: 12.5, fontWeight: "600", color: Stage.violet3, paddingVertical: 6, minHeight: 36, textDecorationLine: "none", ...(isWeb ? ({ display: "inline-flex", alignItems: "center" } as any) : {}) },
  btn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: Stage.violet, marginTop: 4 },
  btnNarrow: {},
  btnText: { fontFamily: sans, color: "#fff", fontSize: 15, fontWeight: "700" },
  btnTextNarrow: { fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(230,226,244,0.12)" },
  dividerText: { fontFamily: sans, fontSize: 11, color: Stage.ink3 },
  linksCenter: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" },
  muted: { fontFamily: sans, fontSize: 12.5, color: Stage.ink3 },
  foot: { fontFamily: sans, marginTop: 14, textAlign: "center", fontSize: 11, color: Stage.ink3, letterSpacing: 0.2 },
});
