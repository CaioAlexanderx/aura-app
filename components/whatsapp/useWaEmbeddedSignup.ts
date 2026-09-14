// ============================================================
// useWaEmbeddedSignup — conectar o número pelo popup da Meta (headless)
//
// A Aura é Tech Provider: cada cliente conecta o PRÓPRIO número e quem
// paga a conversa é ele. O caminho oficial da Meta é o Embedded Signup —
// um popup do Facebook Login for Business que devolve um `code` de
// autorização; o backend troca por token, assina o webhook
// (subscribed_apps) e registra o número (/register).
//
// Isto aqui é SÓ a mecânica, sem uma linha de UI: o cartão do dojô
// (KarateColors) e o do varejo (Colors) desenham diferente, mas a
// sequência frágil abaixo tem que ser exatamente a mesma nos dois.
//
// Três coisas que quebram calado e por isso estão explícitas:
//
// 1. O SDK só carrega UMA vez por página (`sdkPromise` no módulo, não no
//    componente): a tela remonta a cada troca de aba, e injetar o script
//    de novo derruba o FB.init.
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
// Coexistence (doc "Onboard WhatsApp Business app users"): o mesmo
// número pode continuar no app WhatsApp Business do celular E entrar na
// Cloud API ao mesmo tempo — sem esse modo, o número precisa sair do
// app do celular antes de conectar. `mode` troca só o `extras` do
// FB.login e o evento de sucesso aceito; o resto da mecânica é igual.
// DEPENDE do backend (branch claude/whatsapp-coexistence, ainda não
// mergeada) para os campos `coexistence`/`is_on_biz_app` no response.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { waApi, WaSignupMode, WaStatus } from "@/services/waApi";
import { mapWaError, waConnectMode, WaConnectMode } from "./waGuards";

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

export function loadFbSdk(appId: string, version: string): Promise<FbSdk> {
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

export interface UseWaEmbeddedSignup {
  /** conectado | nativo | indisponivel | reconectar | conectar */
  mode: WaConnectMode;
  /** true quando dá para abrir o popup (web + app_id + config_id). */
  canSignup: boolean;
  sdkReady: boolean;
  sdkError: string | null;
  /** Falando com a Meta/backend — trava os botões. */
  busy: boolean;
  error: string | null;
  /** Conectou, mas um passo secundário falhou. Já em pt-BR. */
  warnings: string[];
  /** Botão travado enquanto o SDK não resolve (nem carregou, nem falhou). */
  btnDisabled: boolean;
  startSignup: () => void;
  disconnect: () => Promise<void>;
}

/**
 * @param companyId  company dona do número (no dojô, a company do sensei).
 * @param status     /whatsapp/status já carregado (null = ainda não veio).
 * @param onChanged  conectou/desconectou — o dono recarrega status e templates.
 * @param signupMode 'padrao' (default) ou 'coexistence' — ver o comentário do topo do arquivo.
 *                   Nome diferente do `mode` devolvido pelo hook (esse é o
 *                   ESTADO da tela — conectado/nativo/…, vem de waConnectMode).
 */
export function useWaEmbeddedSignup(
  companyId: string,
  status: WaStatus | null,
  onChanged: () => void,
  signupMode: WaSignupMode = "padrao"
): UseWaEmbeddedSignup {
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
      // FINISH = modo padrão. FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING = modo
      // Coexistence (mesmo popup, evento diferente) — a Meta manda
      // waba_id/phone_number_id do mesmo jeito nos dois.
      if (payload.event === "FINISH" || payload.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
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
            mode: signupMode,
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
        extras:
          signupMode === "coexistence"
            ? { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }
            : { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }, [companyId, configId, onChanged, signupMode]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      await waApi.disconnect(companyId);
      onChanged();
    } catch (e: any) {
      setError(mapWaError(e).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [companyId, onChanged]);

  return {
    mode,
    canSignup,
    sdkReady,
    sdkError,
    busy,
    error,
    warnings,
    btnDisabled: busy || (!sdkReady && !sdkError),
    startSignup,
    disconnect,
  };
}
