// ============================================================
// Cartão "Mercado Pago" do Meu Site — conexão por OAuth (tq-96, 29/10/2026)
//
// Antes: três campos (token de acesso, chave pública, segredo do webhook) e
// o interruptor de modo de testes na mão da lojista. Nenhuma loja conseguiu
// conectar. Agora: um botão "Conectar com Mercado Pago" — ela entra na conta
// dela, autoriza a Aura e volta para cá (?mp=conectado|negado|erro).
//
// Desenho aprovado pelo Caio em 24/10 (mockup da Nina, estados: não
// conectado, voltando, conectou, não autorizou, erro, conectado,
// desconectar, conexão caiu).
//
// - Sem a aplicação do Mercado Pago ligada na Aura (oauth_disponivel=false)
//   e sem conexão, o cartão não aparece.
// - Só o dono conecta e desconecta. Modo de testes só para a equipe Aura.
// - Multi-CNPJ: conecta a empresa ativa. A volta traz ?empresa= e o
//   AuthGuard troca para ela antes da tela (useEmpresaPeloLink).
// - Texto sem promessa sobre taxas.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking, Platform } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useChannelStyles } from "./shared";
import { useAccent, type AccentTokens } from "@/contexts/AccentTheme";
import { usePaletaDoCanal, type PaletaDoCanalTokens } from "./paletaDoCanal";
import { usePaymentGateways } from "@/hooks/usePaymentGateways";
import { useAuthStore } from "@/stores/auth";
import {
  estadoDoMp, lerResultadoDoRetorno, nomeDaConta, desdeQuando, urlSemRetorno,
  caminhoDeVolta, textoDosPedidosEmAndamento, type ResultadoDoRetorno,
} from "@/utils/mpConexao";

const MP_AZUL = "#009EE3";
const PAINEL_DO_MP = "https://www.mercadopago.com.br/activities";

type Props = {
  /** O interruptor "Aceitar cartão de crédito" do Meu Site está ligado? */
  cartaoLigado?: boolean;
  /** Liga e grava o interruptor de cartão (pergunta logo depois de conectar). */
  onLigarCartao?: () => Promise<void>;
};

function limparRetornoDaUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const limpa = urlSemRetorno(window.location.href);
    if (limpa) window.history.replaceState(window.history.state, "", limpa);
  } catch { /* fica na URL; nada quebra */ }
}

export function MpGatewayCard({ cartaoLigado, onLigarCartao }: Props = {}) {
  const cs = useChannelStyles();
  const accent = useAccent();
  const p = usePaletaDoCanal();
  const s = useMemo(() => buildStyles(p, accent), [p, accent]);
  const isStaff = useAuthStore((st) => st.isStaff);
  const {
    mpGateway, isLoading, refetch, oauthDisponivel, podeConectar, pedidosEmAndamento,
    removeGateway, isRemoving, iniciarConexao, isIniciando,
  } = usePaymentGateways();

  const params = useGlobalSearchParams<{ mp?: string | string[] }>();
  const [retorno, setRetorno] = useState<ResultadoDoRetorno>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [perguntarCartao, setPerguntarCartao] = useState(false);
  const [ligandoCartao, setLigandoCartao] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const tratado = useRef(false);

  // Volta do Mercado Pago: lê ?mp= uma vez, confirma com o servidor e limpa a URL.
  useEffect(() => {
    if (tratado.current) return;
    const r = lerResultadoDoRetorno(params?.mp);
    if (!r) return;
    tratado.current = true;
    limparRetornoDaUrl();
    if (r !== "conectado") { setRetorno(r); return; }
    setConfirmando(true);
    refetch()
      .then((res: any) => {
        const g = (res?.data?.gateways ?? []).find((x: any) => x.gateway === "mercadopago");
        if (g && g.connection_status !== "caiu") {
          toast.success("Mercado Pago conectado.");
          setRetorno("conectado");
          if (cartaoLigado === false && onLigarCartao) setPerguntarCartao(true);
        } else {
          setRetorno("erro");
        }
      })
      .catch(() => setRetorno("erro"))
      .finally(() => setConfirmando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.mp]);

  async function conectar(sandbox = false) {
    const volta = Platform.OS === "web" && typeof window !== "undefined"
      ? caminhoDeVolta(window.location.href)
      : "/canal?tab=site";
    let url: string | undefined;
    try {
      ({ url } = await iniciarConexao({ sandbox, volta }));
    } catch { return; } // o hook já avisou
    if (!url) return;
    if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(url);
    else Linking.openURL(url).catch(() => toast.error("Não conseguimos abrir o Mercado Pago agora."));
  }

  async function desconectar() {
    try {
      await removeGateway("mercadopago");
    } catch { return; }
    setConfirmarSaida(false);
    setRetorno(null);
    setPerguntarCartao(false);
    toast.success("Mercado Pago desconectado. Dá para conectar de novo quando quiser.");
  }

  async function ligarCartao() {
    if (!onLigarCartao) { setPerguntarCartao(false); return; }
    setLigandoCartao(true);
    try {
      await onLigarCartao();
      setPerguntarCartao(false);
      toast.success("Pronto, sua loja já aceita cartão.");
    } catch { /* o salvamento já avisou */ }
    finally { setLigandoCartao(false); }
  }

  if (isLoading) {
    return (
      <View style={[cs.card, s.loadingRow]}>
        <ActivityIndicator size="small" color={accent.primaryStrong} />
        <Text style={s.loadingText}>Verificando o Mercado Pago...</Text>
      </View>
    );
  }

  const estado = estadoDoMp(mpGateway, oauthDisponivel);
  if (estado === "oculto" && !confirmando) return null;

  const Cabecalho = ({ chip, tom }: { chip: string; tom?: "ok" | "warn" | "run" }) => (
    <>
      <View style={s.header}>
        <View style={s.mpLogo}><Text style={s.mpLogoText}>MP</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>Mercado Pago</Text>
          <Text style={s.subtitle}>Cartão de crédito e débito</Text>
        </View>
        <View style={[s.chip, tom === "ok" && s.chipOk, tom === "warn" && s.chipWarn, tom === "run" && s.chipRun]}>
          <Text style={[s.chipText, tom === "ok" && s.chipTextOk, tom === "warn" && s.chipTextWarn, tom === "run" && s.chipTextRun]}>{chip}</Text>
        </View>
      </View>
      <View style={cs.divider} />
    </>
  );

  const BotaoConectar = ({ rotulo = "Conectar com Mercado Pago" }: { rotulo?: string }) => (
    podeConectar ? (
      <Pressable
        onPress={() => conectar(false)}
        disabled={isIniciando}
        accessibilityRole="button"
        style={[s.mpBtn, isIniciando && { opacity: 0.6 }]}
        testID="mp-conectar"
      >
        {isIniciando ? <ActivityIndicator size="small" color="#fff" /> : null}
        <Text style={s.mpBtnText}>{isIniciando ? "Abrindo o Mercado Pago..." : rotulo}</Text>
      </Pressable>
    ) : (
      <Text style={s.mini}>Só o dono da conta conecta o Mercado Pago.</Text>
    )
  );

  const ModoDeTestes = () => (
    isStaff && podeConectar ? (
      <Pressable onPress={() => conectar(true)} disabled={isIniciando} style={s.staffRow} testID="mp-conectar-testes">
        <Text style={s.staffText}>Equipe Aura: conectar em modo de testes</Text>
      </Pressable>
    ) : null
  );

  // ── Voltando do Mercado Pago ───────────────────────────────────────────
  if (confirmando) {
    return (
      <View style={cs.card}>
        <Cabecalho chip="Conectando" tom="run" />
        <View style={s.body}>
          <View style={s.row}>
            <ActivityIndicator size="small" color={accent.primaryStrong} />
            <Text style={s.strong}>Confirmando com o Mercado Pago…</Text>
          </View>
          <Text style={s.mini}>Leva alguns segundos. Pode ficar nesta página.</Text>
        </View>
      </View>
    );
  }

  // ── Conexão caiu ───────────────────────────────────────────────────────
  if (estado === "caiu") {
    return (
      <View style={cs.card}>
        <Cabecalho chip="Precisa reconectar" tom="warn" />
        <View style={s.body}>
          <View style={[s.note, s.noteWarn]}>
            <Icon name="alert_circle" size={15} color={p.amber} />
            <Text style={[s.noteText, { color: p.amber }]}>
              <Text style={{ fontWeight: "700" }}>O cartão está desligado na sua loja.</Text> Reconecte o Mercado Pago para voltar a receber no cartão.
            </Text>
          </View>
          <Text style={s.strong}>A conexão com o Mercado Pago caiu. Sua loja não está aceitando cartão agora.</Text>
          <Text style={s.text}>
            Isso acontece quando a autorização é retirada dentro do Mercado Pago. O que você tiver ligado além do cartão, como o Pix pela sua chave e o pagamento na entrega, segue funcionando.
          </Text>
          <BotaoConectar rotulo="Reconectar" />
          <Text style={s.mini}>Quem tentar pagar vê só as outras formas de pagamento.</Text>
          <ModoDeTestes />
        </View>
        <SupportCta />
      </View>
    );
  }

  // ── Conectado ──────────────────────────────────────────────────────────
  if (estado === "conectado") {
    const desde = desdeQuando(mpGateway);
    const avisoPedidos = textoDosPedidosEmAndamento(pedidosEmAndamento);
    return (
      <View style={cs.card}>
        <Cabecalho chip={mpGateway?.sandbox ? "Modo de testes" : "Conectado"} tom={mpGateway?.sandbox ? "warn" : "ok"} />
        <View style={s.body}>
          <Text style={s.strong} testID="mp-conectado-como">Conectado como {nomeDaConta(mpGateway)}</Text>
          <View style={s.kv}>
            <Text style={s.kvLabel}>Conta</Text>
            <Text style={s.kvValue}>Mercado Pago{desde ? `, ${desde}` : ""}</Text>
          </View>
          <View style={s.kv}>
            <Text style={s.kvLabel}>Seu dinheiro</Text>
            <Text style={s.kvValue}>Cai direto na sua conta do Mercado Pago</Text>
          </View>
          {mpGateway?.auth_method === "oauth" ? (
            <View style={s.kv}>
              <Text style={s.kvLabel}>Autorização</Text>
              <Text style={s.kvValue}>Renova sozinha. Você não precisa fazer nada.</Text>
            </View>
          ) : null}

          {perguntarCartao && !cartaoLigado ? (
            <View style={[s.note, s.noteInfo, { flexDirection: "column", alignItems: "stretch" }]}>
              <Text style={[s.strong, { fontSize: 14 }]}>Ligar o pagamento por cartão na sua loja agora?</Text>
              <View style={s.btnRow}>
                <Pressable onPress={ligarCartao} disabled={ligandoCartao} style={[s.priBtn, ligandoCartao && { opacity: 0.6 }]} testID="mp-ligar-cartao">
                  <Text style={s.priBtnText}>{ligandoCartao ? "Ligando..." : "Ligar o cartão"}</Text>
                </Pressable>
                <Pressable onPress={() => setPerguntarCartao(false)} style={s.ghostBtn}>
                  <Text style={s.ghostBtnText}>Agora não</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {confirmarSaida ? (
            <>
              <View style={[s.note, s.noteInfo, { flexDirection: "column", alignItems: "stretch" }]}>
                <Text style={[s.strong, { fontSize: 14 }]}>Desconectar o Mercado Pago?</Text>
                <Text style={s.text}>• A loja deixa de aceitar cartão na hora.</Text>
                <Text style={s.text}>• O Pix pela sua chave e o pagamento na entrega, se estiverem ligados, continuam funcionando. O Pix automático do Mercado Pago sai junto.</Text>
                <Text style={s.text}>• O que você já recebeu continua na sua conta do Mercado Pago.</Text>
                <Text style={s.text}>• Dá para conectar de novo quando quiser.</Text>
              </View>
              {avisoPedidos ? (
                <View style={[s.note, s.noteWarn]}>
                  <Icon name="alert_circle" size={15} color={p.amber} />
                  <Text style={[s.noteText, { color: p.amber }]}>{avisoPedidos}</Text>
                </View>
              ) : null}
              <View style={s.btnRow}>
                <Pressable onPress={() => setConfirmarSaida(false)} style={s.ghostBtn}>
                  <Text style={s.ghostBtnText}>Voltar</Text>
                </Pressable>
                <Pressable onPress={desconectar} disabled={isRemoving} style={[s.dangerBtn, isRemoving && { opacity: 0.6 }]} testID="mp-desconectar-confirmar">
                  <Text style={s.dangerBtnText}>{isRemoving ? "Desconectando..." : "Desconectar"}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.btnRow}>
              <Pressable onPress={() => Linking.openURL(PAINEL_DO_MP).catch(() => {})} style={s.softBtn}>
                <Text style={s.softBtnText}>Abrir o Mercado Pago</Text>
                <Icon name="external_link" size={13} color={accent.primaryStrong} />
              </Pressable>
              {podeConectar ? (
                <Pressable onPress={() => setConfirmarSaida(true)} style={s.ghostBtn} testID="mp-desconectar">
                  <Text style={s.ghostBtnText}>Desconectar</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        <SupportCta />
      </View>
    );
  }

  // ── Não conectado (inclui "não autorizou" e "deu erro") ────────────────
  return (
    <View style={cs.card}>
      <Cabecalho chip="Não conectado" />
      <View style={s.body}>
        {retorno === "negado" ? (
          <View style={[s.note, s.noteInfo]}>
            <Icon name="info" size={15} color={p.ink2} />
            <Text style={s.noteText}>
              <Text style={{ fontWeight: "700" }}>Você não autorizou a conexão.</Text> Tudo certo, nada foi alterado. Quando quiser, é só conectar de novo.
            </Text>
          </View>
        ) : retorno === "erro" ? (
          <View style={[s.note, s.noteErr]}>
            <Icon name="alert_circle" size={15} color={p.redInk} />
            <Text style={[s.noteText, { color: p.redInk }]}>
              <Text style={{ fontWeight: "700" }}>Não conseguimos concluir a conexão.</Text> Nada mudou na sua conta do Mercado Pago. Tente de novo. Se continuar, fale com a gente.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.strong}>Conecte a sua conta do Mercado Pago e a sua loja passa a aceitar cartão. O dinheiro cai direto na sua conta.</Text>
            <View style={{ gap: 8 }}>
              {["Você entra na sua conta do Mercado Pago", "Autoriza a Aura a receber os pagamentos da sua loja", "Volta para cá, já conectada"].map((t, i) => (
                <View key={t} style={s.step}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                  <Text style={[s.text, { flex: 1 }]}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <BotaoConectar rotulo={retorno === "erro" ? "Tentar de novo" : "Conectar com Mercado Pago"} />

        {retorno ? null : (
          <>
            <View style={s.row}>
              <Icon name="lock" size={13} color={p.ink3} />
              <Text style={s.mini}>A Aura não vê a sua senha. Você desconecta quando quiser.</Text>
            </View>
            <Text style={s.mini}>Ainda não tem conta? Dá para criar na própria tela do Mercado Pago.</Text>
          </>
        )}
        <ModoDeTestes />
      </View>
      <SupportCta />
    </View>
  );
}

function SupportCta() {
  const accent = useAccent();
  const p = usePaletaDoCanal();
  const s = useMemo(() => buildStyles(p, accent), [p, accent]);
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/suporte" as any)}
      style={s.supportRow}
    >
      <Icon name="headset" size={12} color={p.ink3} />
      <Text style={s.supportText}>
        Precisa de ajuda?{" "}
        <Text style={s.supportLink}>Fale com o suporte Aura</Text>
      </Text>
    </Pressable>
  );
}

function buildStyles(p: PaletaDoCanalTokens, accent: AccentTokens) {
  return StyleSheet.create({
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { fontSize: 12, color: p.ink3 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  mpLogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: MP_AZUL, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  mpLogoText: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  title: { fontSize: 14, fontWeight: "700", color: p.ink },
  subtitle: { fontSize: 11, color: p.ink3, marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0, borderWidth: 1, borderColor: p.border, backgroundColor: p.bg3 },
  chipOk: { backgroundColor: p.greenD, borderColor: "transparent" },
  chipWarn: { backgroundColor: p.amberD, borderColor: "transparent" },
  chipRun: { backgroundColor: accent.primarySoft, borderColor: "transparent" },
  chipText: { fontSize: 11, fontWeight: "700", color: p.ink2 },
  chipTextOk: { color: p.greenInk },
  chipTextWarn: { color: p.amber },
  chipTextRun: { color: accent.primaryStrong },
  body: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  strong: { fontSize: 14, color: p.ink, fontWeight: "600", lineHeight: 20 },
  text: { fontSize: 13, color: p.ink2, lineHeight: 19 },
  mini: { fontSize: 12, color: p.ink3, lineHeight: 17 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: accent.primarySoft, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { fontSize: 12, fontWeight: "700", color: accent.primaryStrong },
  mpBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: MP_AZUL, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16 },
  mpBtnText: { fontSize: 14, color: "#fff", fontWeight: "700", textAlign: "center" },
  note: { flexDirection: "row", gap: 10, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  noteInfo: { backgroundColor: p.bg3, gap: 6 },
  noteWarn: { backgroundColor: p.amberD },
  noteErr: { backgroundColor: p.redD },
  noteText: { flex: 1, fontSize: 13, color: p.ink2, lineHeight: 19 },
  kv: { flexDirection: "row", gap: 12, alignItems: "baseline" },
  kvLabel: { fontSize: 13, color: p.ink3, width: 92, flexShrink: 0 },
  kvValue: { flex: 1, fontSize: 13, color: p.ink, fontWeight: "500" },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priBtn: { flexGrow: 1, flexBasis: 140, paddingVertical: 12, borderRadius: 10, backgroundColor: accent.primary, alignItems: "center" },
  priBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  softBtn: { flexGrow: 1, flexBasis: 140, flexDirection: "row", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: accent.primarySoft, alignItems: "center", justifyContent: "center" },
  softBtnText: { fontSize: 13, color: accent.primaryStrong, fontWeight: "700" },
  ghostBtn: { flexGrow: 1, flexBasis: 140, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, alignItems: "center" },
  ghostBtnText: { fontSize: 13, color: p.ink2, fontWeight: "600" },
  dangerBtn: { flexGrow: 1, flexBasis: 140, paddingVertical: 12, borderRadius: 10, backgroundColor: p.red, alignItems: "center" },
  dangerBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  staffRow: { alignSelf: "flex-start", paddingVertical: 4 },
  staffText: { fontSize: 12, color: p.ink3, textDecorationLine: "underline" },
  supportRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.border },
  supportText: { fontSize: 12, color: p.ink3 },
  supportLink: { color: accent.primaryStrong, fontWeight: "600" },
});
}
