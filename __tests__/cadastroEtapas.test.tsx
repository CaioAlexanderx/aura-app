// ============================================================
// Cadastro em etapas (tq-68, 21/10/2026)
//
// O que este teste segura:
//   1. regras puras: origem do cadastro lida da URL (utils/origemDoCadastro),
//      lead que nunca lança (utils/leadDoCadastro) e a linha do carimbo;
//   2. etapa 1: textos do mockup "Porta de entrada v4", saudação pela hora,
//      medidor e chips da senha, caixa dos Termos (checkbox), trilho
//      (progressbar), e-mail pela URL, e-mail que já tem conta (409 do
//      register e resposta do lead) com o atalho de login levando o e-mail;
//   3. lead: etapa 1 com origem, etapa 2 com o token, token no register;
//      falha ou demora do lead não trava nada; voltar e mudar o e-mail
//      refaz a etapa 1;
//   4. etapa 2: CNPJ com carimbo da Receita, erro da consulta, dojô com a
//      federação obrigatória, código pela URL e "Tenho um código";
//   5. convite: só a etapa 1, sem trilho, sem crachá e sem lead.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/LGPDConsent", () => ({ useLgpdConsentInset: () => 0 }));

const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { error: (...a: any[]) => mockToastError(...a), success: jest.fn(), info: jest.fn() },
}));

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
  router: { replace: (...a: any[]) => mockReplace(...a), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

const mockRegister = jest.fn();
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ register: (...a: any[]) => mockRegister(...a), isLoading: false }),
}));

const mockAccept = jest.fn();
jest.mock("@/services/inviteApi", () => ({ inviteApi: { accept: (...a: any[]) => mockAccept(...a) } }));
const mockFeds = jest.fn();
jest.mock("@/services/karateSignupApi", () => ({ karateSignupApi: { listFederations: (...a: any[]) => mockFeds(...a) } }));
const mockLead = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any;
    constructor(message: string, status: number, data?: any) { super(message); this.status = status; this.data = data; }
  }
  return { ApiError, authApi: { validateCode: jest.fn(async () => ({ valid: true })), signupLead: (...a: any[]) => mockLead(...a) } };
});

import { ApiError } from "@/services/api";
import { montarOrigem, codigoDoLink, hostDeFora } from "@/utils/origemDoCadastro";
import { gravarLeadSemTravar, linhaDoCarimbo } from "@/utils/leadDoCadastro";
import RegisterScreen from "@/app/(auth)/register";

const TOKEN = "a".repeat(48);
const CNPJ_OK = "11222333000181";
const RECEITA = {
  legal_name: "MARIA DA SILVA MODAS LTDA", trade_name: "Modas da Maria",
  address_city: "Campinas", address_state: "SP", suggested_regime: "simples_nacional", regime_confirmar: false,
};

// ── utilitários de teste ─────────────────────────────────────
function textos(node: any, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string") { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => textos(n, out)); return out; }
  textos(node.children, out);
  return out;
}
const tudo = (t: renderer.ReactTestRenderer) => textos(t.toJSON()).join("|");
const textoDe = (inst: any): string =>
  (inst.children || []).map((c: any) => (typeof c === "string" ? c : textoDe(c))).join("");
const porId = (t: renderer.ReactTestRenderer, id: string, prop = "onPress") =>
  t.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props[prop] !== "undefined")[0];
const existe = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n: any) => n.props && n.props.testID === id).length > 0;
const digitar = async (t: renderer.ReactTestRenderer, id: string, v: string) => {
  await act(async () => { porId(t, id, "onChangeText").props.onChangeText(v); });
};
const tocar = async (t: renderer.ReactTestRenderer, id: string) => {
  await act(async () => { await porId(t, id).props.onPress(); });
};
const esvaziar = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });

async function montar() {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<RegisterScreen />); });
  return t;
}
async function preencherEtapa1(t: renderer.ReactTestRenderer, email = "maria@loja.com") {
  await digitar(t, "cadastro-nome", "Maria Souza");
  await digitar(t, "cadastro-email", email);
  await digitar(t, "cadastro-senha", "Senha1234");
  await tocar(t, "cadastro-termos");
}
async function irParaEtapa2(t: renderer.ReactTestRenderer, email?: string) {
  await preencherEtapa1(t, email);
  await tocar(t, "cadastro-continuar-1");
}
const naEtapa = (t: renderer.ReactTestRenderer, n: number) => existe(t, "cadastro-etapa-" + n);

function receitaOk(data: any = RECEITA) {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => data })) as any;
}

// Largura da janela: o RNW lê documentElement.clientWidth (0 no jsdom) e
// atualiza no evento resize.
function largura(px: number) {
  Object.defineProperty(document.documentElement, "clientWidth", { value: px, configurable: true });
  Object.defineProperty(document.documentElement, "clientHeight", { value: 900, configurable: true });
  act(() => { window.dispatchEvent(new Event("resize")); });
}

const realFetch = global.fetch;
beforeEach(() => {
  largura(1280);
  jest.clearAllMocks();
  mockParams = {};
  mockLead.mockImplementation(async () => { throw new Error("rota ausente"); });
  mockFeds.mockResolvedValue([]);
  (global as any).open = jest.fn();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  global.fetch = realFetch;
  window.history.pushState({}, "", "/");
});

// ── 1. regras puras ──────────────────────────────────────────
describe("origem do cadastro", () => {
  const agora = new Date("2026-10-21T15:00:00.000Z");
  test("utm, ref do link e referrer de fora; caminho sem query", () => {
    expect(montarOrigem({
      search: "?utm_source=Instagram&utm_campaign=bf&ref=ref-ana123&email=x@y.com",
      referrer: "https://l.instagram.com/?u=abc", pathname: "/register", ownHost: "app.getaura.com.br", agora,
    })).toEqual({
      utm_source: "Instagram", utm_campaign: "bf", ref: "REF-ANA123", referrer: "l.instagram.com",
      landing_page: "/register", first_seen_at: "2026-10-21T15:00:00.000Z",
    });
  });
  test("sem utm, sem ref e com referrer da própria Aura: nada", () => {
    expect(montarOrigem({ search: "?email=x@y.com", referrer: "https://getaura.com.br/comecar", pathname: "/register", ownHost: "app.getaura.com.br", agora })).toBeNull();
    expect(hostDeFora("https://app.getaura.com.br/login", "app.getaura.com.br")).toBe("");
    expect(hostDeFora("javascript:alert(1)", "x")).toBe("");
  });
  test("código do link: maiúsculas, só [A-Z0-9-], 3 a 44", () => {
    expect(codigoDoLink("ref-ana123")).toBe("REF-ANA123");
    expect(codigoDoLink(["maria7"])).toBe("MARIA7");
    expect(codigoDoLink("<script>")).toBe("");
    expect(codigoDoLink("ab")).toBe("");
    expect(codigoDoLink("A".repeat(45))).toBe("");
    expect(codigoDoLink(undefined)).toBe("");
  });
});

describe("lead que nunca lança", () => {
  const e1 = { etapa: 1 as const, nome: "Maria", email: "m@l.com", terms_accepted: true as const };
  test("token, conta existente, 404 e falhas", async () => {
    expect(await gravarLeadSemTravar(async () => ({ lead_token: TOKEN }), e1)).toEqual({ tipo: "ok", token: TOKEN });
    expect(await gravarLeadSemTravar(async () => ({ lead_token: null }), e1)).toEqual({ tipo: "conta_existente" });
    expect(await gravarLeadSemTravar(async () => ({ lead_token: null }), { etapa: 2, lead_token: TOKEN, cpf: "1" })).toEqual({ tipo: "falhou" });
    expect(await gravarLeadSemTravar(async () => { throw Object.assign(new Error("x"), { status: 404 }); }, { etapa: 2, lead_token: TOKEN, cpf: "1" })).toEqual({ tipo: "nao_encontrado" });
    for (const status of [400, 429, 503, 0]) {
      expect(await gravarLeadSemTravar(async () => { throw Object.assign(new Error("x"), { status }); }, e1)).toEqual({ tipo: "falhou" });
    }
    expect(await gravarLeadSemTravar(undefined, e1)).toEqual({ tipo: "falhou" });
    expect(await gravarLeadSemTravar(async () => undefined, e1)).toEqual({ tipo: "falhou" });
  });
});

describe("linha do carimbo", () => {
  test("fantasia, cidade e regime confirmado", () => {
    expect(linhaDoCarimbo(RECEITA)).toBe("Modas da Maria · Campinas, SP · Simples Nacional");
  });
  test("regime estimado não é afirmado; MEI pelo bloco do Simples; fantasia igual à razão some", () => {
    expect(linhaDoCarimbo({ ...RECEITA, regime_confirmar: true })).toBe("Modas da Maria · Campinas, SP");
    expect(linhaDoCarimbo({ legal_name: "ANA ME", trade_name: "ana me", is_mei: true, regime_confirmar: true })).toBe("MEI");
    expect(linhaDoCarimbo(null)).toBe("");
  });
});

// ── 2. etapa 1 ───────────────────────────────────────────────
describe("etapa 1 — dados e Termos", () => {
  test("textos do mockup, saudação pela hora, trilho e crachá vazio", async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 21, 9, 30) });
    const t = await montar();
    expect(textoDe(porId(t, "cadastro-say", "role"))).toBe("Bom dia! Como a gente te chama?");
    const s = tudo(t);
    for (const txt of [
      "Leva um minuto. Nada de cartão, nada de contrato.", "Seu nome", "E-mail", "Senha", "Ver",
      "8+ caracteres", "uma maiúscula", "um número", "Li e aceito os ", "Termos de Uso", " da Aura.",
      "Continuar", "Já tem conta?", "Entrar", "1 / 3", "Conta Aura", "em formação",
    ]) expect(s).toContain(txt);
    expect(porId(t, "cadastro-nome", "onChangeText").props.placeholder).toBe("Como você gosta de ser chamado");
    expect(porId(t, "cadastro-email", "onChangeText").props.placeholder).toBe("seu@email.com");
    expect(porId(t, "cadastro-senha", "onChangeText").props.placeholder).toBe("Pelo menos 8 caracteres");
    const trilho = porId(t, "cadastro-trilho", "role");
    expect(trilho.props.role).toBe("progressbar");
    expect(trilho.props["aria-valuenow"]).toBe(1);
    expect(trilho.props["aria-label"]).toBe("Etapa 1 de 3");
    expect(porId(t, "cadastro-continuar-1").props.disabled).toBe(true);
  });

  test("375 px: o crachá vira uma linha (sem a faixa de baixo)", async () => {
    largura(375);
    const t = await montar();
    expect(existe(t, "cadastro-cracha")).toBe(true);
    expect(tudo(t)).not.toContain("Conta Aura");
    expect(existe(t, "cadastro-cracha-tag")).toBe(false);
  });

  test("madrugada troca só o cumprimento", async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 21, 2, 0) });
    const t = await montar();
    expect(textoDe(porId(t, "cadastro-say", "role"))).toBe("Ainda por aí? Como a gente te chama?");
  });

  test("Termos: checkbox com aria-checked; o link abre os Termos sem marcar a caixa", async () => {
    const t = await montar();
    const caixa = () => porId(t, "cadastro-termos");
    expect(caixa().props.role).toBe("checkbox");
    expect(caixa().props["aria-checked"]).toBe(false);
    await act(async () => { porId(t, "cadastro-termos-link").props.onPress({ stopPropagation: jest.fn() }); });
    expect((global as any).open).toHaveBeenCalledWith("https://getaura.com.br/termos", "_blank", "noopener,noreferrer");
    await tocar(t, "cadastro-termos");
    expect(caixa().props["aria-checked"]).toBe(true);
  });

  test("Continuar só com tudo certo; o crachá ganha o nome", async () => {
    const t = await montar();
    await digitar(t, "cadastro-nome", "Maria Souza");
    await digitar(t, "cadastro-email", "maria@loja.com");
    await digitar(t, "cadastro-senha", "senha");
    expect(porId(t, "cadastro-continuar-1").props.disabled).toBe(true);
    expect(tudo(t)).toContain("Maria Souza");
    expect(tudo(t)).toContain("1 de 3");
    await digitar(t, "cadastro-senha", "Senha1234");
    expect(porId(t, "cadastro-continuar-1").props.disabled).toBe(true); // falta o aceite
    await tocar(t, "cadastro-termos");
    expect(porId(t, "cadastro-continuar-1").props.disabled).toBe(false);
  });

  test("e-mail torto avisa ao sair do campo", async () => {
    const t = await montar();
    await digitar(t, "cadastro-email", "maria@loja");
    await act(async () => { porId(t, "cadastro-email", "onBlur").props.onBlur(); });
    expect(tudo(t)).toContain("Confere o e-mail? Falta alguma coisa depois do @.");
  });

  test("e-mail que veio pela URL já entra preenchido", async () => {
    mockParams = { email: "loja@exemplo.com" };
    const t = await montar();
    expect(porId(t, "cadastro-email", "onChangeText").props.value).toBe("loja@exemplo.com");
  });

  test("e-mail que já tem conta (409 do register): volta à etapa 1, segura o Continuar e o atalho leva o e-mail ao login", async () => {
    receitaOk();
    mockRegister.mockRejectedValueOnce(new (ApiError as any)("E-mail ja cadastrado", 409, { error: "E-mail ja cadastrado" }));
    const t = await montar();
    await irParaEtapa2(t);
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await tocar(t, "cadastro-continuar-2");
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(naEtapa(t, 1)).toBe(true);
    expect(tudo(t)).toContain("Esse e-mail já tem conta por aqui. ");
    expect(tudo(t)).toContain("Quer entrar?");
    await tocar(t, "cadastro-continuar-1");
    expect(naEtapa(t, 1)).toBe(true);
    await tocar(t, "cadastro-quer-entrar");
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login?email=maria%40loja.com");
    await digitar(t, "cadastro-email", "maria2@loja.com");
    expect(tudo(t)).not.toContain("Esse e-mail já tem conta por aqui.");
  });

  test("e-mail que já tem conta (lead da etapa 1 sem token): volta uma vez e deixa seguir", async () => {
    mockLead.mockResolvedValue({ lead_token: null, etapa: 1, whatsapp_confirmado: false });
    const t = await montar();
    await irParaEtapa2(t);
    await esvaziar();
    expect(naEtapa(t, 1)).toBe(true);
    expect(tudo(t)).toContain("Esse e-mail já tem conta por aqui. ");
    await tocar(t, "cadastro-continuar-1");
    await esvaziar();
    expect(naEtapa(t, 2)).toBe(true);
  });
});

// ── 3. lead ──────────────────────────────────────────────────
describe("lead parcial", () => {
  test("etapa 1 com a origem da URL, etapa 2 com o token e o token no register", async () => {
    window.history.pushState({}, "", "/register?utm_source=Instagram&ref=REF-ANA1");
    receitaOk();
    mockLead.mockResolvedValue({ lead_token: TOKEN, etapa: 1, whatsapp_confirmado: false });
    mockRegister.mockResolvedValueOnce({});
    const t = await montar();
    await irParaEtapa2(t, " Maria@Loja.com ");
    expect(mockLead).toHaveBeenCalledTimes(1);
    expect(mockLead.mock.calls[0][0]).toEqual(expect.objectContaining({
      etapa: 1, nome: "Maria Souza", email: "maria@loja.com", terms_accepted: true, terms_version: "2026-03-26",
      origem: expect.objectContaining({ utm_source: "Instagram", ref: "REF-ANA1", landing_page: "/register" }),
    }));
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await tocar(t, "cadastro-continuar-2");
    await esvaziar();
    expect(mockLead).toHaveBeenCalledTimes(2);
    expect(mockLead.mock.calls[1][0]).toEqual({ etapa: 2, lead_token: TOKEN, cnpj: CNPJ_OK, company_name: "MARIA DA SILVA MODAS LTDA" });
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.lead_token).toBe(TOKEN);
    expect(corpo.origem).toEqual(expect.objectContaining({ utm_source: "Instagram", ref: "REF-ANA1" }));
    expect(corpo.email).toBe("maria@loja.com");
  });

  test("lead que não responde não trava a navegação nem o cadastro (sem token)", async () => {
    receitaOk();
    mockLead.mockImplementation(() => new Promise(() => {})); // nunca responde
    mockRegister.mockResolvedValueOnce({});
    const t = await montar();
    await irParaEtapa2(t);
    expect(naEtapa(t, 2)).toBe(true);
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await tocar(t, "cadastro-continuar-2");
    expect(naEtapa(t, 3)).toBe(true);
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty("lead_token");
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty("origem");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  test("lead que falha (429/503) segue sem aviso", async () => {
    mockLead.mockRejectedValue(Object.assign(new Error("Muitas tentativas"), { status: 429 }));
    const t = await montar();
    await irParaEtapa2(t);
    await esvaziar();
    expect(naEtapa(t, 2)).toBe(true);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(tudo(t)).not.toContain("Muitas tentativas");
  });

  test("voltar e mudar o e-mail refaz a etapa 1; o token do e-mail antigo não vai", async () => {
    receitaOk();
    mockLead.mockResolvedValueOnce({ lead_token: TOKEN }).mockImplementation(async () => { throw new Error("x"); });
    mockRegister.mockResolvedValueOnce({});
    const t = await montar();
    await irParaEtapa2(t);
    await esvaziar();
    await tocar(t, "cadastro-voltar-1");
    expect(naEtapa(t, 1)).toBe(true);
    expect(porId(t, "cadastro-nome", "onChangeText").props.value).toBe("Maria Souza");
    await tocar(t, "cadastro-continuar-1"); // mesmo e-mail: não manda de novo
    expect(mockLead).toHaveBeenCalledTimes(1);
    await tocar(t, "cadastro-voltar-1");
    await digitar(t, "cadastro-email", "outra@loja.com");
    await tocar(t, "cadastro-continuar-1");
    expect(mockLead).toHaveBeenCalledTimes(2);
    expect(mockLead.mock.calls[1][0]).toEqual(expect.objectContaining({ etapa: 1, email: "outra@loja.com" }));
    await esvaziar();
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await tocar(t, "cadastro-continuar-2");
    await esvaziar();
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty("lead_token");
  });
});

// ── 4. etapa 2 ───────────────────────────────────────────────
describe("etapa 2 — negócio", () => {
  test("CNPJ: consulta aos 14 dígitos, carimbo da Receita, nome da loja e crachá", async () => {
    receitaOk();
    const t = await montar();
    await irParaEtapa2(t);
    const s = tudo(t);
    for (const txt of ["E o seu ", "negócio", "Com o CNPJ a gente puxa o resto na Receita. Sem CNPJ também dá.", "Tenho CNPJ", "Não tenho CNPJ",
      "CNPJ", "Digite os 14 números. A consulta é automática.", "Como a loja se chama", "Meu negócio é um dojo de karatê", "Tenho um código", "← Voltar", "2 / 3"]) {
      expect(s).toContain(txt);
    }
    expect(porId(t, "cadastro-documento", "role").props.role).toBe("radiogroup");
    expect(porId(t, "cadastro-negocio", "onChangeText").props.placeholder).toBe("O nome que seus clientes conhecem");
    expect(porId(t, "cadastro-continuar-2").props.disabled).toBe(true);
    await digitar(t, "cadastro-cnpj", "112223330001");
    expect(global.fetch).not.toHaveBeenCalled();
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const s2 = tudo(t);
    expect(s2).toContain("Achei. Confira o nome da loja abaixo.");
    expect(s2).toContain("RECEITA ✓");
    expect(s2).toContain("Encontrei");
    expect(s2).toContain("MARIA DA SILVA MODAS LTDA");
    expect(s2).toContain("Modas da Maria · Campinas, SP · Simples Nacional");
    expect(porId(t, "cadastro-negocio", "onChangeText").props.value).toBe("MARIA DA SILVA MODAS LTDA");
    expect(textoDe(porId(t, "cadastro-cracha-tag", "children"))).toBe("2 de 3");
    expect(porId(t, "cadastro-continuar-2").props.disabled).toBe(false);
  });

  test("CNPJ que a Receita não acha: aviso, Tentar novamente e Continuar travado", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) as any;
    const t = await montar();
    await irParaEtapa2(t);
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    expect(tudo(t)).toContain("CNPJ não encontrado na Receita Federal.");
    expect(tudo(t)).toContain("Tentar novamente");
    expect(existe(t, "cadastro-carimbo")).toBe(false);
    expect(porId(t, "cadastro-continuar-2").props.disabled).toBe(true);
  });

  test("dojô: rótulo próprio, federação obrigatória e corpo com vertical + federation_id", async () => {
    receitaOk();
    mockFeds.mockResolvedValue([{ id: "f-1", name: "Federação A" }, { id: "f-2", name: "Federação B" }]);
    mockRegister.mockResolvedValueOnce({});
    const t = await montar();
    await irParaEtapa2(t);
    expect(porId(t, "cadastro-dojo").props["aria-pressed"]).toBe(false);
    await tocar(t, "cadastro-dojo");
    await esvaziar();
    expect(porId(t, "cadastro-dojo").props["aria-pressed"]).toBe(true);
    const s = tudo(t);
    expect(s).toContain("Dojo de karatê · trocar para comércio");
    expect(s).toContain("Nome do dojo");
    expect(s).toContain("Federação *");
    expect(s).toContain("Escolher a federação aqui não filia seu dojo.");
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await digitar(t, "cadastro-negocio", "Dojo Centro");
    expect(porId(t, "cadastro-continuar-2").props.disabled).toBe(true);
    expect(tudo(t)).toContain("Escolha a federação para liberar o cadastro.");
    await act(async () => {
      t.root.findAll((n: any) => n.props && n.props.role === "radio" && typeof n.props.onPress === "function"
        && textoDe(n).includes("Federação B"))[0].props.onPress();
    });
    expect(porId(t, "cadastro-continuar-2").props.disabled).toBe(false);
    await tocar(t, "cadastro-continuar-2");
    expect(tudo(t)).toContain("Criar conta do dojo");
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.vertical).toBe("karate_dojo");
    expect(corpo.federation_id).toBe("f-2");
    expect(corpo.company_name).toBe("Dojo Centro");
  });

  test("trocar o dojô para comércio limpa a federação", async () => {
    receitaOk();
    mockFeds.mockResolvedValue([{ id: "f-1", name: "Federação A" }]);
    mockRegister.mockResolvedValueOnce({});
    const t = await montar();
    await irParaEtapa2(t);
    await tocar(t, "cadastro-dojo");
    await esvaziar();
    await tocar(t, "cadastro-dojo");
    expect(tudo(t)).not.toContain("Federação *");
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await tocar(t, "cadastro-continuar-2");
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty("vertical");
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty("federation_id");
  });

  test("código pela URL: campo aberto e preenchido, vai como access_code e na origem", async () => {
    mockParams = { ref: "ref-ana123" };
    window.history.pushState({}, "", "/register?ref=ref-ana123");
    receitaOk();
    mockRegister.mockResolvedValueOnce({});
    const t = await montar();
    await irParaEtapa2(t);
    expect(porId(t, "cadastro-codigo", "onChangeText").props.value).toBe("REF-ANA123");
    expect(existe(t, "cadastro-tenho-codigo")).toBe(false);
    expect(tudo(t)).toContain("Código de indicação");
    expect(tudo(t)).toContain("Se veio por link, já preenchemos sozinhos.");
    await digitar(t, "cadastro-cnpj", CNPJ_OK);
    await tocar(t, "cadastro-continuar-2");
    await digitar(t, "cadastro-telefone", "11987654321");
    await tocar(t, "cadastro-criar");
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.access_code).toBe("REF-ANA123");
    expect(corpo.origem).toEqual(expect.objectContaining({ ref: "REF-ANA123" }));
  });

  test("sem código na URL: \"Tenho um código\" abre o campo", async () => {
    const t = await montar();
    await irParaEtapa2(t);
    expect(porId(t, "cadastro-codigo", "onChangeText")).toBeUndefined();
    await tocar(t, "cadastro-tenho-codigo");
    expect(porId(t, "cadastro-codigo", "onChangeText")).toBeDefined();
    expect(existe(t, "cadastro-tenho-codigo")).toBe(false);
  });
});

// ── 5. convite ───────────────────────────────────────────────
describe("convite", () => {
  test("só a etapa 1: sem trilho, sem crachá e sem lead; cria a conta e aceita o convite", async () => {
    mockParams = { invite_token: "tok-9", invite_email: "bia@loja.com" };
    mockRegister.mockResolvedValueOnce({});
    mockAccept.mockResolvedValueOnce({});
    const t = await montar();
    expect(existe(t, "cadastro-trilho")).toBe(false);
    expect(existe(t, "cadastro-cracha")).toBe(false);
    const s = tudo(t);
    expect(s).toContain("Aceite o convite");
    expect(s).toContain("Você foi convidado para entrar numa equipe Aura");
    expect(porId(t, "cadastro-email", "onChangeText").props.value).toBe("bia@loja.com");
    await digitar(t, "cadastro-nome", "Bia");
    await digitar(t, "cadastro-senha", "Senha1234");
    await tocar(t, "cadastro-termos");
    await tocar(t, "cadastro-convite-criar");
    expect(mockLead).not.toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledWith({ name: "Bia", email: "bia@loja.com", password: "Senha1234", terms_accepted: true, terms_version: "2026-03-26" });
    expect(mockAccept).toHaveBeenCalledWith("tok-9");
  });
});
