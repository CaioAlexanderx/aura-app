// ============================================================
// WaConnectCard — "Conectar meu WhatsApp" (Embedded Signup da Meta)
//
// A Aura é Tech Provider: cada dojô conecta o PRÓPRIO número, e quem
// paga a conversa é o dojô. O caminho oficial da Meta para isso é o
// Embedded Signup — um popup do Facebook Login for Business que devolve
// um `code` de autorização. O backend troca esse code por token, assina
// o webhook (subscribed_apps) e registra o número (/register).
//
// Contrato (services/waApi.ts):
//   POST /companies/:id/whatsapp/connect     { code, waba_id, phone_number_id }
//   POST /companies/:id/whatsapp/disconnect
// Os parâmetros do popup (app_id, config_id, graph_version) vêm do
// backend em status.embedded_signup — NÃO ficam no bundle do app: eles
// mudam por ambiente e são do app da Meta, não do cliente.
//
// Três coisas que quebram calado e por isso estão explícitas aqui:
//
// 1. O SDK só carrega UMA vez por página (`sdkPromise` no módulo, não no
//    componente): a aba Mensalidades remonta a seção a cada troca de
//    aba, e injetar o script de novo derruba o FB.init.
//
// 2. O SDK é carregado no MOUNT, não no clique. `FB.login` precisa sair
//    de um gesto direto do usuário — se esperássemos o download do SDK
//    dentro do onPress, o navegador bloquearia o popup.
//
// 3. O `message` do popup vem do domínio da Meta. Aceitamos SÓ
//    www.facebook.com e web.facebook.com: qualquer iframe de terceiro na
//    página poderia postar um `WA_EMBEDDED_SIGNUP` falso e nos fazer
//    mandar um waba_id alheio para o backend.
//
// No nativo não existe popup: o cartão vira orientação ("conecte pelo
// computador"), nunca um botão que não funciona.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Platform, ActivityIndicator, Modal, Pressable,
  TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { waApi, WaStatus } from "@/services/waApi";
import { fmtPhoneBR, mapWaError, waConnectMode } from "./helpers";

// ── Tipagem local do SDK do Facebook ────────────────────────
// Sem pacote novo: o SDK é injetado por <script> e só existe em runtime
// no web. O tipo mora aqui porque é o único lugar que o usa.
interface FbAuthResponse {
  code?: string;
  accessToken?: string;
}
interface FbLoginResponse {
  authResponse?: FbAuthResponse | null;
  status?: string;
}
interface FbLoginOptions {
  config_id: string;
  response_type: string;
  override_default_response_type: boolean;
  extras: { setup: Record<string, unknown>; featureType: string; sessionInfoVersion: string };
}
interface FbSdk {
  init(options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
  login(callback: (response: FbLoginResponse) => void, options: FbLoginOptions): void;
}
declare global {
  // eslint-disable-next-line no-var
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const FB_SDK_SRC = "https://connect.facebook.net/pt_BR/sdk.js";
const FB_SDK_ID = "aura-facebook-jssdk";
const DEFAULT_GRAPH_VERSION = "v21.0";
/** Só a Meta posta o evento do Embedded Signup. Mais ninguém. */
const ALLOWED_SIGNUP_ORIGINS = ["https://www.facebook.com", "https://web.facebook.com"];

let sdkPromise: Promise<FbSdk> | null = null;

function loadFbSdk(appId: string, version: string): Promise<FbSdk> {
  if (sdkPromise) return sdkPromise;
  const p = new Promise<FbSdk>((resolve, reject) => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      reject(new Error("O login do Facebook só funciona no navegador."));
      return;
    }
    const finish = () => {
      const FB = window.FB;
      if (!FB) {
        reject(new Error("Não foi possível carregar o login do Facebook. Verifique bloqueadores de anúncio."));
        return;
      }
      FB.init({ appId, autoLogAppEvents: true, xfbml: true, version });
      resolve(FB);
    };
    if (window.FB) {
      finish();
      return;
    }
    const existing = document.getElementById(FB_SDK_ID) as HTMLScriptElement | null;
    const el = existing || document.createElement("script");
    el.addEventListener("load", finish);
    el.addEventListener("error", () =>
      reject(new Error("Não foi possível carregar o login do Facebook. Verifique bloqueadores de anúncio."))
    );
    if (!existing) {
      el.id = FB_SDK_ID;
      el.src = FB_SDK_SRC;
      el.async = true;
      el.defer = true;
      el.crossOrigin = "anonymous";
      document.head.appendChild(el);
    }
  });
  sdkPromise = p;
  // Falha não pode envenenar o cache: a próxima tentativa baixa de novo.
  p.catch(() => { sdkPromise = null; });
  return p;
}

interface SignupInfo {
  waba_id: string | null;
  phone_number_id: string | null;
}

interface Props {
  companyId: string;
  status: WaStatus | null;
  /** Conectou/desconectou — o pai recarrega o status e a lista de templates. */
  onChanged: () => void;
}

export function WaConnectCard({ companyId, status, onChanged }: Props) {
  const isWeb = Platform.OS === "web";
  const es = status?.embedded_signup || null;
  const appId = es?.app_id || null;
  const configId = es?.config_id || null;
  const graphVersion = es?.graph_version || DEFAULT_GRAPH_VERSION;
  const mode = waConnectMode(isWeb, status);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmOff, setConfirmOff] = useState(false);

  // O evento do popup chega por `message`, fora do ciclo do React — ref,
  // não state: o handler do FB.login lê o valor no instante do callback.
  const signupRef = useRef<SignupInfo | null>(null);
  const cancelStepRef = useRef<string | null>(null);

  const canSignup = isWeb && !!appId && !!configId;

  useEffect(() => {
    if (!canSignup || !appId) return;
    let alive = true;
    loadFbSdk(appId, graphVersion)
      .then(() => { if (alive) { setSdkReady(true); setSdkError(null); } })
      .catch((e: any) => { if (alive) setSdkError(e?.message || "Não foi possível carregar o login do Facebook."); });
    return () => { alive = false; };
  }, [canSignup, appId, graphVersion]);

  useEffect(() => {
    if (!canSignup || typeof window === "undefined") return;
    function onMessage(ev: MessageEvent) {
      if (ALLOWED_SIGNUP_ORIGINS.indexOf(ev.origin) === -1) return;
      let payload: any = ev.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH") {
        const d = payload.data || {};
        signupRef.current = {
          waba_id: d.waba_id != null ? String(d.waba_id) : null,
          phone_number_id: d.phone_number_id != null ? String(d.phone_number_id) : null,
        };
        cancelStepRef.current = null;
      } else if (payload.event === "CANCEL") {
        signupRef.current = null;
        const step = payload.data && payload.data.current_step;
        cancelStepRef.current = step ? String(step) : null;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [canSignup]);

  const startSignup = useCallback(() => {
    const FB = typeof window !== "undefined" ? window.FB : undefined;
    if (!FB || !configId) return;
    signupRef.current = null;
    cancelStepRef.current = null;
    setError(null);
    setWarnings([]);
    setBusy(true);
    FB.login(
      (response: FbLoginResponse) => {
        const code = response && response.authResponse && response.authResponse.code;
        if (!code) {
          setBusy(false);
          const step = cancelStepRef.current;
          setError(
            step
              ? `A conexão foi interrompida na etapa "${step}". Você pode recomeçar quando quiser — nada foi cobrado.`
              : "A janela do Facebook foi fechada antes de concluir. Nenhum número foi conectado."
          );
          return;
        }
        const info = signupRef.current;
        waApi
          .connect(companyId, {
            code,
            waba_id: info?.waba_id ?? null,
            phone_number_id: info?.phone_number_id ?? null,
          })
          .then((res) => {
            const list = Array.isArray(res?.warnings) ? res.warnings.slice() : [];
            if (res && res.subscribed === false) {
              list.push("O aviso de entrega (webhook) não pôde ser assinado agora — os status das mensagens podem demorar a aparecer.");
            }
            if (res && res.registered === false) {
              list.push("O número ainda não terminou o registro na Meta. Tente reconectar em alguns minutos antes de ligar o envio automático.");
            }
            setWarnings(list);
            onChanged();
          })
          .catch((e: any) => setError(mapWaError(e).message))
          .finally(() => setBusy(false));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }, [companyId, configId, onChanged]);

  const doDisconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      await waApi.disconnect(companyId);
      setConfirmOff(false);
      onChanged();
    } catch (e: any) {
      setError(mapWaError(e).message);
    } finally {
      setBusy(false);
    }
  }, [companyId, onChanged]);

  const connectLabel = mode === "reconectar" ? "Reconectar meu WhatsApp" : "Conectar meu WhatsApp";
  const btnDisabled = busy || (!sdkReady && !sdkError);

  return (
    <View style={styles.card} testID="wa-connect-card">
      <View style={styles.headTitle}>
        <Icon name="link" size={16} color={KarateColors.primary} />
        <Text style={styles.cardTitle}>Número do dojô</Text>
      </View>

      {mode === "conectado" && (
        <View testID="wa-connect-conectado">
          <Text style={styles.cardSub}>
            O WhatsApp {fmtPhoneBR(status?.phone_display)} está conectado e é ele que aparece para o
            aluno. As conversas iniciadas por template são cobradas pela Meta na conta do dojô.
          </Text>
          {status?.registered === false && (
            <View style={styles.warnBox} testID="wa-connect-nao-registrado">
              <Icon name="alert" size={14} color={KarateColors.warn} />
              <Text style={styles.warnTxt}>
                O registro do número na Meta não foi concluído — reconecte antes de ligar o envio
                automático, senão as mensagens falham na hora do disparo.
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setConfirmOff(true)}
            accessibilityRole="button"
            style={styles.iconBtn}
            testID="wa-disconnect-btn"
          >
            <Icon name="x_circle" size={14} color={KarateColors.ink2} />
            <Text style={styles.iconBtnTxt}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "nativo" && (
        <Text style={styles.cardSub} testID="wa-connect-nativo">
          A conexão do número é feita pelo computador, numa janela oficial do Facebook. Acesse
          app.getaura.com.br pelo navegador e volte a esta tela para conectar o WhatsApp do dojô.
        </Text>
      )}

      {mode === "indisponivel" && (
        <Text style={styles.cardSub} testID="wa-connect-indisponivel">
          A conexão automática do WhatsApp ainda não está liberada neste ambiente. Fale com a Aura —
          enquanto isso, a fila manual da aba Régua continua funcionando normalmente.
        </Text>
      )}

      {(mode === "conectar" || mode === "reconectar") && (
        <View testID="wa-connect-disponivel">
          <Text style={styles.cardSub}>
            {mode === "reconectar"
              ? "A autorização da Meta expirou. Reconecte o mesmo número para voltar a enviar — nada precisa ser cadastrado de novo."
              : "Conecte o número do dojô numa janela oficial do Facebook. O número continua sendo do dojô: a Aura só passa a enviar por ele as mensagens que você autorizar."}
          </Text>
          <Text style={styles.hint}>
            Tenha em mãos o acesso ao Facebook do dojô e um número que ainda não esteja em uso no
            aplicativo do WhatsApp. Cada conversa iniciada por template é cobrada pela Meta.
          </Text>
          <View style={styles.actions}>
            <KarateButton
              label={busy ? "Conectando…" : btnDisabled ? "Carregando…" : connectLabel}
              variant="sumi"
              size="sm"
              loading={busy}
              disabled={btnDisabled}
              onPress={startSignup}
            />
          </View>
          {!!sdkError && <Text style={styles.errTxt} testID="wa-connect-sdk-erro">{sdkError}</Text>}
        </View>
      )}

      {!!error && <Text style={styles.errTxt} testID="wa-connect-erro">{error}</Text>}

      {warnings.length > 0 && (
        <View style={styles.warnBox} testID="wa-connect-warnings">
          <Icon name="alert" size={14} color={KarateColors.warn} />
          <View style={{ flex: 1, gap: 4 }}>
            {warnings.map((w, i) => (
              <Text key={i} style={styles.warnTxt}>{w}</Text>
            ))}
          </View>
        </View>
      )}

      <Modal visible={confirmOff} transparent animationType="fade" onRequestClose={() => setConfirmOff(false)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? null : setConfirmOff(false))}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Desconectar o WhatsApp do dojô?</Text>
            <Text style={styles.dialogSub}>
              O envio automático para de sair na hora e as mensagens que ainda estão na fila não
              serão enviadas. O número continua sendo do dojô e pode ser conectado de novo depois.
              A fila manual da aba Régua não é afetada.
            </Text>
            <View style={styles.dialogActions}>
              <KarateButton label="Cancelar" variant="secondary" size="sm" disabled={busy} onPress={() => setConfirmOff(false)} />
              <KarateButton
                label={busy ? "Desconectando…" : "Desconectar"}
                variant="primary"
                size="sm"
                loading={busy}
                onPress={doDisconnect}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {busy && mode !== "conectado" && (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
          <Text style={styles.hint}>Falando com a Meta — isto pode levar alguns segundos.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 620 } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 8, lineHeight: 16.5, maxWidth: 620 } as TextStyle,
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 } as ViewStyle,
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 6, paddingHorizontal: 10, marginTop: 14, alignSelf: "flex-start" } as ViewStyle,
  iconBtnTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, marginTop: 10, lineHeight: 17, maxWidth: 620 } as TextStyle,
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 10,
    backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm,
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  } as ViewStyle,
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: KarateColors.warn, lineHeight: 17 } as TextStyle,
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 } as ViewStyle,
  backdrop: { flex: 1, backgroundColor: "rgba(20,16,12,0.45)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  dialog: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 18, width: "100%", maxWidth: 460, gap: 10 } as ViewStyle,
  dialogTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  dialogSub: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" } as ViewStyle,
});
