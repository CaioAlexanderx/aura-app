// ============================================================
// Porta de entrada 4/6 — etapa 3 do cadastro e verso (tq-69, 26/10/2026)
//
// O que este teste segura (decisões do Caio de 21/10 e mockup final):
//   1. regras puras: máscara "(11) 9 1234-5678", dicas do celular, mensagem
//      do wa.me com o código e o número central da Aura;
//   2. etapa 3: WhatsApp único, textos do mockup, "Sem WhatsApp agora"
//      visível desde o início, sem temporizador;
//   3. "Confirmar no WhatsApp e criar conta": a aba abre NO clique e recebe
//      o link com o código do backend; o número fica "aguardando sua
//      mensagem" (nunca "confirmado" na criação); o verso fica na tela
//      (o AuthGuard espera) até "Confirmar meu e-mail";
//   4. QR só no computador (> 900 px), com o mesmo link;
//   5. "Sem WhatsApp agora": cria a conta sem abrir nada, número "a confirmar";
//   6. erro do cadastro: solta o AuthGuard e fecha a aba aberta.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/LGPDConsent", () => ({ useLgpdConsentInset: () => 0 }));
jest.mock("@/components/QrCode", () => ({ QrCode: (p: any) => require("react").createElement("QrCode", p) }));

const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { error: (...a: any[]) => mockToastError(...a), success: jest.fn(), info: jest.fn() },
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
  router: { replace: (...a: any[]) => mockReplace(...a), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

const mockRegister = jest.fn();
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ register: (...a: any[]) => mockRegister(...a), isLoading: false }),
}));
jest.mock("@/services/inviteApi", () => ({ inviteApi: { accept: jest.fn() } }));
jest.mock("@/services/karateSignupApi", () => ({ karateSignupApi: { listFederations: jest.fn(async () => []) } }));
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any;
    constructor(message: string, status: number, data?: any) { super(message); this.status = status; this.data = data; }
  }
  return { ApiError, authApi: { validateCode: jest.fn(async () => ({ valid: true })), signupLead: jest.fn(async () => { throw new Error("sem lead"); }) } };
});

import { ApiError } from "@/services/api";
import RegisterScreen from "@/app/(auth)/register";
import {
  mascaraDoZap, conferirZap, dicaDoZap, mensagemDoHandshake, linkDoHandshake, codigoDoCadastro, DICAS_DO_ZAP,
} from "@/utils/whatsappDoCadastro";
import { versoDoCadastroAberto, soltarVerso } from "@/utils/versoDoCadastro";

const CNPJ_OK = "11222333000181";
const RECEITA = { legal_name: "MARIA DA SILVA MODAS LTDA", trade_name: "Modas da Maria", address_city: "Campinas", address_state: "SP", phone: "(19) 3232-1000" };
const LINK = "https://wa.me/5511956305269?text=" + encodeURIComponent("Oi, Aura! Meu código é AURA-7F3K");
const RESPOSTA = { token: "t", company: { plan: "negocio" }, whatsapp_handshake: { codigo: "AURA-7F3K", estado: "aguardando" } };

// ── utilitários (mesmo jeito de cadastroEtapas) ─────────────
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
const noId = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.type !== "string")[0];
const existe = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n: any) => n.props && n.props.testID === id).length > 0;
const digitar = async (t: renderer.ReactTestRenderer, id: string, v: string) => {
  await act(async () => { porId(t, id, "onChangeText").props.onChangeText(v); });
};
const tocar = async (t: renderer.ReactTestRenderer, id: string) => {
  await act(async () => { await porId(t, id).props.onPress(); });
};

function largura(px: number) {
  Object.defineProperty(document.documentElement, "clientWidth", { value: px, configurable: true });
  Object.defineProperty(document.documentElement, "clientHeight", { value: 900, configurable: true });
  act(() => { window.dispatchEvent(new Event("resize")); });
}

async function naEtapa3() {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => RECEITA })) as any;
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<RegisterScreen />); });
  await digitar(t, "cadastro-nome", "Maria Souza");
  await digitar(t, "cadastro-email", "maria@loja.com");
  await digitar(t, "cadastro-senha", "Senha1234");
  await tocar(t, "cadastro-termos");
  await tocar(t, "cadastro-continuar-1");
  await digitar(t, "cadastro-cnpj", CNPJ_OK);
  await tocar(t, "cadastro-continuar-2");
  expect(existe(t, "cadastro-etapa-3")).toBe(true);
  return t;
}

let janela: { location: { href: string }; opener: any; close: jest.Mock };
const realFetch = global.fetch;
beforeEach(() => {
  largura(1280);
  jest.clearAllMocks();
  soltarVerso();
  janela = { location: { href: "" }, opener: {}, close: jest.fn() };
  (global as any).open = jest.fn(() => janela);
});
afterEach(() => {
  global.fetch = realFetch;
  soltarVerso();
});

// ── 1. regras puras ─────────────────────────────────────────
describe("WhatsApp do cadastro (regras)", () => {
  test("máscara do mockup, aos pedaços", () => {
    expect(mascaraDoZap("")).toBe("");
    expect(mascaraDoZap("1")).toBe("(1");
    expect(mascaraDoZap("119")).toBe("(11) 9");
    expect(mascaraDoZap("1191234")).toBe("(11) 9 1234");
    expect(mascaraDoZap("11912345678")).toBe("(11) 9 1234-5678");
    expect(mascaraDoZap("+55 (11) 91234-5678 99")).toBe("(55) 1 1912-3456"); // corta em 11 dígitos
  });

  test("conferência e dicas: fixo, sem o 9, curto e ok", () => {
    expect(dicaDoZap(conferirZap(""))).toEqual({ texto: DICAS_DO_ZAP.padrao });
    expect(dicaDoZap(conferirZap("1191234"))).toEqual({ texto: DICAS_DO_ZAP.padrao });
    expect(dicaDoZap(conferirZap("1132321000"))).toEqual({ kind: "err", texto: "Esse parece um fixo. Precisa ser celular com WhatsApp, com o 9 na frente." });
    expect(dicaDoZap(conferirZap("11812345678"))).toEqual({ kind: "err", texto: "Celular começa com 9 depois do DDD." });
    expect(dicaDoZap(conferirZap("11987654321"))).toEqual({ kind: "ok", texto: "Boa. É esse que vai tocar." });
  });

  test("mensagem pronta com o código e o número central da Aura", () => {
    expect(mensagemDoHandshake("AURA-7F3K")).toBe("Oi, Aura! Meu código é AURA-7F3K");
    expect(linkDoHandshake("AURA-7F3K")).toBe(LINK);
    expect(linkDoHandshake(null)).toBe("https://wa.me/5511956305269?text=" + encodeURIComponent("Oi, Aura! Acabei de criar minha conta."));
  });

  test("código só no formato AURA-XXXX", () => {
    expect(codigoDoCadastro(RESPOSTA)).toBe("AURA-7F3K");
    expect(codigoDoCadastro({ whatsapp_handshake: null })).toBeNull();
    expect(codigoDoCadastro({ whatsapp_handshake: { codigo: "xpto" } })).toBeNull();
    expect(codigoDoCadastro(undefined)).toBeNull();
  });
});

// ── 2. a etapa ──────────────────────────────────────────────
describe("etapa 3: WhatsApp único", () => {
  test("textos do mockup, um campo só e 'Sem WhatsApp agora' desde o início", async () => {
    const t = await naEtapa3();
    const s = tudo(t);
    expect(s).toContain("Por onde a gente ");
    expect(s).toContain("te chama");
    expect(s).toContain("Seu WhatsApp, o que toca no seu bolso. É por aqui que o Caio fala com você nos primeiros dias. Sem robô, sem spam.");
    expect(s).toContain("Seu WhatsApp");
    expect(s).toContain("+55");
    expect(s).toContain("Confirmar no WhatsApp e criar conta");
    expect(s).not.toContain("telefone para contato");
    expect(existe(t, "cadastro-sem-whatsapp")).toBe(true);
    expect(textoDe(noId(t, "cadastro-whatsapp-dica"))).toBe(DICAS_DO_ZAP.padrao);
    expect(porId(t, "cadastro-criar").props.disabled).toBe(true);
  });

  test("a máscara e a dica acompanham o que se digita; o crachá ganha o número", async () => {
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "1132321000");
    expect(textoDe(noId(t, "cadastro-whatsapp-dica"))).toContain("Esse parece um fixo");
    expect(porId(t, "cadastro-criar").props.disabled).toBe(true);
    await digitar(t, "cadastro-whatsapp", "(11) 98765-4321");
    expect(porId(t, "cadastro-whatsapp", "onChangeText").props.value).toBe("(11) 9 8765-4321");
    expect(textoDe(noId(t, "cadastro-whatsapp-dica"))).toBe("Boa. É esse que vai tocar.");
    expect(textoDe(noId(t, "cadastro-cracha"))).toContain("(11) 9 8765-4321");
    expect(porId(t, "cadastro-criar").props.disabled).toBe(false);
  });
});

// ── 3 e 4. confirmar no WhatsApp ────────────────────────────
describe("Confirmar no WhatsApp e criar conta", () => {
  test("a aba abre no clique, recebe o link com o código e o verso fica 'aguardando'", async () => {
    let resolver!: (v: any) => void;
    mockRegister.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "11987654321");

    act(() => { porId(t, "cadastro-criar").props.onPress(); });
    // Antes do cadastro responder: a aba já abriu (vazia) e o AuthGuard espera.
    expect((global as any).open).toHaveBeenCalledWith("", "_blank");
    expect(janela.opener).toBeNull();
    expect(janela.location.href).toBe("");
    expect(versoDoCadastroAberto()).toBe(true);

    await act(async () => { resolver(RESPOSTA); });
    expect(janela.location.href).toBe(LINK);

    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.whatsapp).toBe("11987654321");
    expect(corpo.phone).toBe("11987654321");
    expect(corpo.company_phone).toBe("1932321000"); // telefone da loja, da Receita

    expect(existe(t, "cadastro-verso")).toBe(true);
    expect(existe(t, "cadastro-etapa-3")).toBe(false);
    expect(textoDe(noId(t, "cadastro-pronto"))).toBe("Pronto, Maria.");
    expect(textoDe(noId(t, "cadastro-cracha-zap"))).toBe("(11) 9 8765-4321 · aguardando sua mensagem");
    expect(tudo(t)).not.toMatch(/confirmado/);
    expect(textoDe(noId(t, "cadastro-cracha-plano"))).toBe("Negócio · 7 dias grátis");
    expect(textoDe(noId(t, "cadastro-verso-email"))).toBe("Mandamos um link para maria@loja.com. É ele que libera o Painel.");
    // Sem redirecionar sozinho: o verso fica até o clique.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(versoDoCadastroAberto()).toBe(true);

    // Computador: QR com o MESMO link e o código no texto.
    const qr = t.root.findAll((n: any) => n.type === "QrCode")[0];
    expect(qr.props.value).toBe(LINK);
    expect(textoDe(noId(t, "cadastro-qr"))).toContain("AURA-7F3K");
    expect(textoDe(noId(t, "cadastro-abrir-whatsapp"))).toBe("Abrir o WhatsApp de novo");

    await tocar(t, "cadastro-confirmar-email");
    expect(versoDoCadastroAberto()).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/verify-email");
  });

  test("celular (375 px): sem QR, o resto igual", async () => {
    largura(375);
    mockRegister.mockResolvedValueOnce(RESPOSTA);
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(existe(t, "cadastro-verso")).toBe(true);
    expect(existe(t, "cadastro-qr")).toBe(false);
    expect(janela.location.href).toBe(LINK);
  });

  test("pop-up bloqueado: o verso oferece mandar o código", async () => {
    (global as any).open = jest.fn(() => null);
    mockRegister.mockResolvedValueOnce(RESPOSTA);
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(textoDe(noId(t, "cadastro-cracha-zap"))).toBe("(11) 9 8765-4321 · aguardando sua mensagem");
    expect(textoDe(noId(t, "cadastro-abrir-whatsapp"))).toBe("Mandar o código AURA-7F3K no WhatsApp");
    await tocar(t, "cadastro-abrir-whatsapp");
    expect((global as any).open).toHaveBeenLastCalledWith(LINK, "_blank", "noopener,noreferrer");
  });

  test("erro do cadastro: solta o AuthGuard e fecha a aba", async () => {
    mockRegister.mockRejectedValueOnce(new (ApiError as any)("Falhou", 500, {}));
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "11987654321");
    await tocar(t, "cadastro-criar");
    expect(janela.close).toHaveBeenCalled();
    expect(versoDoCadastroAberto()).toBe(false);
    expect(existe(t, "cadastro-etapa-3")).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith("Falhou");
  });

  test("WhatsApp recusado pelo backend: aviso no campo, na etapa 3", async () => {
    mockRegister.mockRejectedValueOnce(new (ApiError as any)("O DDD do WhatsApp não existe. Confira os dois primeiros números.", 400, { code: "WHATSAPP_DDD_INVALID", field: "whatsapp" }));
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "20987654321");
    await tocar(t, "cadastro-criar");
    expect(existe(t, "cadastro-etapa-3")).toBe(true);
    expect(textoDe(noId(t, "cadastro-whatsapp-dica"))).toBe("O DDD do WhatsApp não existe. Confira os dois primeiros números.");
  });
});

// ── 5. sem WhatsApp agora ───────────────────────────────────
describe("Sem WhatsApp agora", () => {
  test("cria a conta sem abrir nada; o número fica 'a confirmar'", async () => {
    mockRegister.mockResolvedValueOnce(RESPOSTA);
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "11987654321");
    await tocar(t, "cadastro-sem-whatsapp");
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect((global as any).open).not.toHaveBeenCalled();
    expect(textoDe(noId(t, "cadastro-cracha-zap"))).toBe("(11) 9 8765-4321 · a confirmar");
    expect(textoDe(noId(t, "cadastro-abrir-whatsapp"))).toBe("Mandar o código AURA-7F3K no WhatsApp");
  });

  test("sem número válido não cria a conta", async () => {
    const t = await naEtapa3();
    await digitar(t, "cadastro-whatsapp", "1198765");
    await tocar(t, "cadastro-sem-whatsapp");
    expect(mockRegister).not.toHaveBeenCalled();
    expect(existe(t, "cadastro-etapa-3")).toBe(true);
  });
});

// ── reduzir movimento: o verso não vira ─────────────────────
describe("reduzir movimento", () => {
  test("a entrada do verso está na lista do que para com reduced-motion e .as-static", () => {
    const { AUTH_STAGE_CSS } = require("@/components/auth/authStageCss");
    const reduzido = AUTH_STAGE_CSS.split("@media (prefers-reduced-motion: reduce)")[1].split("}")[0];
    expect(reduzido).toContain(".aura-stage [data-as-verso]");
    expect(AUTH_STAGE_CSS).toContain(".as-static [data-as-verso]");
  });
});
