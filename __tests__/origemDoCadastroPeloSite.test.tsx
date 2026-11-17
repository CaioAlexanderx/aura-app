// ============================================================
// Origem do cadastro pelo site e pelo login (b-mk-33, 17/11/2026)
//
// O que este teste segura:
//   1. regras puras: parâmetros que o site põe no "Entrar" (utm_*,
//      origem_site, origem_pagina, origem_data), visita direta com
//      "/login" ou "/register", primeiro toque (com sinal troca direta,
//      nunca o contrário), telas de entrada, limpeza do guardado;
//   2. guardarOrigemDaEntrada: localStorage do app, storage bloqueado
//      (memória), tela que não é de entrada não guarda;
//   3. ponta a ponta simulado: www por ?utm_source=x → "Entrar" (link com o
//      primeiro toque) → "/" (o router troca pelo login e a query some) →
//      login → "Criar conta grátis" → o register leva a origem.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/LGPDConsent", () => ({ useLgpdConsentInset: () => 0 }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
const mockRegister = jest.fn();
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = () => ({ login: jest.fn(), register: (...a: any[]) => mockRegister(...a), isLoading: false });
  useAuthStore.getState = () => ({ user: null, company: null });
  return { useAuthStore };
});
jest.mock("@/stores/karateIntro", () => ({ useKarateIntro: { getState: () => ({ trigger: jest.fn() }) } }));
jest.mock("@/services/inviteApi", () => ({ inviteApi: { accept: jest.fn() } }));
jest.mock("@/services/karateSignupApi", () => ({ karateSignupApi: { listFederations: jest.fn(async () => []) } }));
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any;
    constructor(message: string, status: number, data?: any) { super(message); this.status = status; this.data = data; }
  }
  return { ApiError, authApi: { validateCode: jest.fn(async () => ({ valid: true })), signupLead: jest.fn(async () => { throw new Error("rota ausente"); }) } };
});

import {
  CHAVE_DA_ORIGEM, montarOrigem, montarVisitaDireta, decidirOrigem, ehTelaDeEntrada, paginaDeEntradaDoApp,
  temSinal, limparOrigem, origemValida, guardarOrigemDaEntrada, origemParaOCadastro, _zerarOrigemEmMemoria,
} from "@/utils/origemDoCadastro";
import LoginScreen from "@/app/(auth)/login";
import RegisterScreen from "@/app/(auth)/register";

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-11-17T15:00:00.000Z");
const HA_2_DIAS = new Date(AGORA.getTime() - 2 * DIA).toISOString();
const OWN = "app.getaura.com.br";

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (global as any).open = jest.fn();
  window.localStorage.clear();
  _zerarOrigemEmMemoria();
});
afterEach(() => {
  jest.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

const guardada = () => JSON.parse(window.localStorage.getItem(CHAVE_DA_ORIGEM) || "null");

// ── 1. regras puras ──────────────────────────────────────────
describe("parâmetros do site no link do app", () => {
  test("utm_* e origem_*: a página e a data são as do site, o host é o do site de origem", () => {
    const search = "?utm_source=Google&utm_medium=cpc&origem_site=www.google.com&origem_pagina=%2Fplanos&origem_data=" + encodeURIComponent(HA_2_DIAS);
    expect(montarOrigem({ search, referrer: "https://www.getaura.com.br/planos", pathname: "/", ownHost: OWN, agora: AGORA })).toEqual({
      utm_source: "Google", utm_medium: "cpc", referrer: "www.google.com", landing_page: "/planos", first_seen_at: HA_2_DIAS,
    });
  });

  test("origem_site da própria Aura ou estranho não conta; origem_pagina fora do formato e data vencida ou no futuro caem no app e em agora", () => {
    expect(montarOrigem({ search: "?origem_site=www.getaura.com.br", referrer: "", pathname: "/", ownHost: OWN, agora: AGORA })).toBeNull();
    expect(montarOrigem({ search: "?origem_site=" + encodeURIComponent("x.com/<script>"), referrer: "", pathname: "/", ownHost: OWN, agora: AGORA })).toBeNull();
    const vencida = new Date(AGORA.getTime() - 31 * DIA).toISOString();
    const o = montarOrigem({ search: "?utm_source=x&origem_pagina=https%3A%2F%2Fmal.com%2F&origem_data=" + vencida, referrer: "", pathname: "/login", ownHost: OWN, agora: AGORA });
    expect(o).toEqual({ utm_source: "x", landing_page: "/login", first_seen_at: AGORA.toISOString() });
    const futuro = new Date(AGORA.getTime() + 3 * DIA).toISOString();
    expect(montarOrigem({ search: "?utm_source=x&origem_pagina=%2F%2Fmal.com&origem_data=" + futuro, referrer: "", pathname: "/", ownHost: OWN, agora: AGORA }))
      .toEqual({ utm_source: "x", landing_page: "/", first_seen_at: AGORA.toISOString() });
  });

  test("visita direta: página do site se veio do site; senão /login ou /register", () => {
    expect(montarVisitaDireta({ search: "?origem_pagina=%2Fsobre&origem_data=" + encodeURIComponent(HA_2_DIAS), pathname: "/", agora: AGORA }))
      .toEqual({ landing_page: "/sobre", first_seen_at: HA_2_DIAS });
    expect(montarVisitaDireta({ search: "", pathname: "/", agora: AGORA })).toEqual({ landing_page: "/login", first_seen_at: AGORA.toISOString() });
    expect(montarVisitaDireta({ search: "?email=a@b.com", pathname: "/register", agora: AGORA })).toEqual({ landing_page: "/register", first_seen_at: AGORA.toISOString() });
    expect(paginaDeEntradaDoApp("/login")).toBe("/login");
    expect(paginaDeEntradaDoApp("/register/")).toBe("/register");
    expect(paginaDeEntradaDoApp("/registerx")).toBe("/login");
  });

  test("telas de entrada: só /, /login e /register", () => {
    for (const p of ["/", "", "/login", "/register", "/register/", "/(auth)/login"]) expect(ehTelaDeEntrada(p)).toBe(true);
    for (const p of ["/caixa", "/loja/minha-loja", "/invite/abc", "/login/x", "/karate/fpkt"]) expect(ehTelaDeEntrada(p)).toBe(false);
  });

  test("primeiro toque: com sinal troca direta; direta nunca troca nada; com sinal não troca com sinal", () => {
    const direta = { landing_page: "/login", first_seen_at: HA_2_DIAS };
    const google = { utm_source: "google", landing_page: "/planos", first_seen_at: HA_2_DIAS };
    const insta = { utm_source: "instagram", landing_page: "/", first_seen_at: AGORA.toISOString() };
    const outraDireta = { landing_page: "/register", first_seen_at: AGORA.toISOString() };
    expect(decidirOrigem(null, direta, AGORA)).toEqual(direta);
    expect(decidirOrigem(direta, insta, AGORA)).toEqual(insta);
    expect(decidirOrigem(direta, outraDireta, AGORA)).toBeNull();
    expect(decidirOrigem(google, outraDireta, AGORA)).toBeNull();
    expect(decidirOrigem(google, insta, AGORA)).toBeNull();
    expect(decidirOrigem(direta, { ref: "REF-ANA1", landing_page: "/register", first_seen_at: AGORA.toISOString() }, AGORA)?.ref).toBe("REF-ANA1");
    const vencida = { utm_source: "google", first_seen_at: new Date(AGORA.getTime() - 30 * DIA).toISOString() };
    expect(origemValida(vencida, AGORA)).toBe(false);
    expect(decidirOrigem(vencida, outraDireta, AGORA)).toEqual(outraDireta);
    expect(temSinal(direta)).toBe(false);
    expect(temSinal({ referrer: "www.google.com" })).toBe(true);
  });

  test("guardado mexido: só as chaves do contrato", () => {
    expect(limparOrigem({ utm_source: "x", email: "a@b.com", referrer: "Mal Com", landing_page: "/a?email=a@b.com", first_seen_at: HA_2_DIAS, ref: "<x>" }))
      .toEqual({ utm_source: "x", landing_page: "/a", first_seen_at: HA_2_DIAS });
    expect(limparOrigem("texto")).toBeNull();
    expect(limparOrigem([1])).toBeNull();
  });
});

// ── 2. guardar na entrada ────────────────────────────────────
describe("guardarOrigemDaEntrada", () => {
  test("link do site em \"/\" guarda; visita direta depois não troca", () => {
    window.history.pushState({}, "", "/?utm_source=x&origem_pagina=%2F&origem_data=" + encodeURIComponent(HA_2_DIAS));
    guardarOrigemDaEntrada(AGORA);
    expect(guardada()).toEqual({ utm_source: "x", landing_page: "/", first_seen_at: HA_2_DIAS });
    window.history.replaceState({}, "", "/login");
    guardarOrigemDaEntrada(AGORA);
    expect(guardada().utm_source).toBe("x");
  });

  test("tela que não é de entrada não guarda nada", () => {
    window.history.pushState({}, "", "/loja/minha-loja?utm_source=x");
    guardarOrigemDaEntrada(AGORA);
    expect(guardada()).toBeNull();
    expect(origemParaOCadastro(AGORA)).toBeNull();
  });

  test("localStorage bloqueado: nada quebra e a origem fica em memória", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    window.history.pushState({}, "", "/login?utm_source=x");
    expect(() => guardarOrigemDaEntrada(AGORA)).not.toThrow();
    window.history.pushState({}, "", "/register");
    expect(origemParaOCadastro(AGORA)).toEqual({ utm_source: "x", landing_page: "/login", first_seen_at: AGORA.toISOString() });
  });

  test("localStorage com lixo: vira visita direta nova", () => {
    window.localStorage.setItem(CHAVE_DA_ORIGEM, "não é json");
    window.history.pushState({}, "", "/login");
    guardarOrigemDaEntrada(AGORA);
    expect(guardada()).toEqual({ landing_page: "/login", first_seen_at: AGORA.toISOString() });
  });

  test("o cadastro junta o ref da própria URL quando o guardado não tem", () => {
    window.history.pushState({}, "", "/?utm_source=x");
    guardarOrigemDaEntrada(AGORA);
    window.history.pushState({}, "", "/register?ref=ref-ana1");
    expect(origemParaOCadastro(AGORA)).toEqual({ utm_source: "x", landing_page: "/", first_seen_at: AGORA.toISOString(), ref: "REF-ANA1" });
  });
});

// ── 3. ponta a ponta simulado ────────────────────────────────
const porId = (t: renderer.ReactTestRenderer, id: string, prop = "onPress") =>
  t.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props[prop] !== "undefined")[0];
const digitar = async (t: renderer.ReactTestRenderer, id: string, v: string) => {
  await act(async () => { porId(t, id, "onChangeText").props.onChangeText(v); });
};
const tocar = async (t: renderer.ReactTestRenderer, id: string) => {
  await act(async () => { await porId(t, id).props.onPress(); });
};

async function criarConta() {
  global.fetch = jest.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ legal_name: "MARIA DA SILVA MODAS LTDA", trade_name: "Modas da Maria", address_city: "Campinas", address_state: "SP", suggested_regime: "simples_nacional", regime_confirmar: false }),
  })) as any;
  mockRegister.mockResolvedValueOnce({});
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<RegisterScreen />); });
  await digitar(t, "cadastro-nome", "Maria Souza");
  await digitar(t, "cadastro-email", "maria@loja.com");
  await digitar(t, "cadastro-senha", "Senha1234");
  await tocar(t, "cadastro-termos");
  await tocar(t, "cadastro-continuar-1");
  await digitar(t, "cadastro-cnpj", "11222333000181");
  await tocar(t, "cadastro-continuar-2");
  await digitar(t, "cadastro-whatsapp", "11987654321");
  await tocar(t, "cadastro-criar");
  expect(mockRegister).toHaveBeenCalledTimes(1);
  return mockRegister.mock.calls[0][0];
}

describe("ponta a ponta: www com ?utm_source=x → Entrar → login → Criar conta", () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test("o register leva a origem do site", async () => {
    // www.getaura.com.br/?utm_source=x grava { utm_source, landing_page: "/", first_seen_at }
    // e o js/origem.js põe isso no "Entrar" (https://app.getaura.com.br/?...).
    const noSite = new Date(Date.now() - 60 * 1000).toISOString();
    const entrar = "/?utm_source=x&origem_pagina=%2F&origem_data=" + encodeURIComponent(noSite);
    window.history.pushState({}, "", entrar);
    guardarOrigemDaEntrada();                       // app/_layout.tsx, antes do router
    window.history.replaceState({}, "", "/login");   // AuthGuard: router.replace("/(auth)/login"), sem a query
    await act(async () => { renderer.create(<LoginScreen />); });
    window.history.pushState({}, "", "/register");   // "Criar conta grátis" (sem query)
    const corpo = await criarConta();
    expect(corpo.origem).toEqual({ utm_source: "x", landing_page: "/", first_seen_at: noSite });
  });

  test("app aberto direto no login (sem site): o register leva a visita direta com /login", async () => {
    window.history.pushState({}, "", "/login");
    await act(async () => { renderer.create(<LoginScreen />); });
    window.history.pushState({}, "", "/register");
    const corpo = await criarConta();
    expect(Object.keys(corpo.origem).sort()).toEqual(["first_seen_at", "landing_page"]);
    expect(corpo.origem.landing_page).toBe("/login");
  });

  test("visita direta guardada antes e depois um link com utm: vale o utm", async () => {
    window.history.pushState({}, "", "/login");
    guardarOrigemDaEntrada();
    expect(guardada().landing_page).toBe("/login");
    window.history.pushState({}, "", "/?utm_source=instagram&utm_medium=bio&origem_site=l.instagram.com&origem_pagina=%2Fplanos&origem_data=" + encodeURIComponent(new Date().toISOString()));
    guardarOrigemDaEntrada();
    window.history.replaceState({}, "", "/register");
    const corpo = await criarConta();
    expect(corpo.origem).toEqual(expect.objectContaining({ utm_source: "instagram", utm_medium: "bio", referrer: "l.instagram.com", landing_page: "/planos" }));
  });
});
