// ============================================================
// Conta sem CNPJ, com CPF (20/10/2026)
//
// Decisão do Caio: "vamos liberar para os clientes que sinalizarem que não
// tem CNPJ". O que este teste segura:
//   1. regras puras (utils/documentoEmpresa): CPF válido, corpo do cadastro
//      (com CNPJ = o de sempre; sem CNPJ = só o CPF, sem regime), 409 por
//      code, texto do documento sem "null"/"undefined";
//   2. a tela de cadastro em etapas (tq-68, 21/10/2026): na etapa 2, o
//      seletor "Não tenho CNPJ" troca o campo por CPF e o rótulo do nome
//      da loja, e o cadastro manda `cpf`; CPF inválido não libera o
//      Continuar; CPF duplicado (409) volta para a etapa 2 com a mensagem
//      do backend; "Tenho CNPJ" volta e o fluxo com CNPJ manda cnpj +
//      regime como antes, sem `cpf`.
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
jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
  router: { replace: (...a: any[]) => mockReplace(...a) },
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
  return { ApiError, authApi: { validateCode: jest.fn(), signupLead: jest.fn(async () => { throw new Error("rota ainda não existe em produção"); }) } };
});

import {
  cpfDoCadastroValido, documentoDoCadastro, conflitoDoCadastro, textoDoDocumento, contaSemCnpj, MSG_NOTA_PRECISA_CNPJ,
} from "@/utils/documentoEmpresa";
import { ApiError } from "@/services/api";
import RegisterScreen from "@/app/(auth)/register";

const CPF_OK = "52998224725";
const CNPJ_OK = "11222333000181";

describe("regras do documento", () => {
  test("CPF: dígitos verificadores, com ou sem máscara", () => {
    expect(cpfDoCadastroValido(CPF_OK)).toBe(true);
    expect(cpfDoCadastroValido("529.982.247-25")).toBe(true);
    expect(cpfDoCadastroValido("529.982.247-26")).toBe(false);
    expect(cpfDoCadastroValido("111.111.111-11")).toBe(false);
    expect(cpfDoCadastroValido("529.982.247")).toBe(false);
  });

  test("corpo do cadastro: com CNPJ é o de sempre; sem CNPJ só o CPF, sem regime", () => {
    expect(documentoDoCadastro({ semCnpj: false, cnpj: "11.222.333/0001-81", cpf: "", regimeDetectado: "mei" }))
      .toEqual({ cnpj: CNPJ_OK, tax_regime: "mei" });
    expect(documentoDoCadastro({ semCnpj: false, cnpj: CNPJ_OK, cpf: "", regimeDetectado: null }))
      .toEqual({ cnpj: CNPJ_OK, tax_regime: undefined });
    expect(documentoDoCadastro({ semCnpj: true, cnpj: "", cpf: "529.982.247-25", regimeDetectado: "mei" }))
      .toEqual({ cpf: CPF_OK });
  });

  test("409 do cadastro pelo code", () => {
    expect(conflitoDoCadastro("CNPJ_ALREADY_REGISTERED")).toBe("cnpj");
    expect(conflitoDoCadastro("CPF_ALREADY_REGISTERED")).toBe("cpf");
    expect(conflitoDoCadastro(undefined)).toBe("email");
  });

  test("texto do documento: CNPJ, CPF ou vazio — nunca null/undefined", () => {
    expect(textoDoDocumento({ cnpj: CNPJ_OK, cpf: CPF_OK })).toBe("CNPJ 11.222.333/0001-81");
    expect(textoDoDocumento({ cnpj: null, cpf: CPF_OK })).toBe("CPF 529.982.247-25");
    expect(textoDoDocumento({ cnpj: "", cpf: "" })).toBe("");
    expect(textoDoDocumento({ cnpj: undefined, cpf: undefined })).toBe("");
    expect(contaSemCnpj({ cnpj: "", cpf: CPF_OK })).toBe(true);
    expect(contaSemCnpj({ cnpj: CNPJ_OK, cpf: CPF_OK })).toBe(false);
    expect(contaSemCnpj({ cnpj: "", cpf: "" })).toBe(false);
    expect(contaSemCnpj(null)).toBe(false);
  });

  test("mensagem da nota fiscal igual à do backend (CNPJ_REQUIRED)", () => {
    expect(MSG_NOTA_PRECISA_CNPJ).toBe(
      "A emissão de nota fiscal precisa de CNPJ. Quando você abrir o seu, informe em Configurações > Empresa.",
    );
  });
});

// ── Tela de cadastro ─────────────────────────────────────────
const porId = (t: renderer.ReactTestRenderer, id: string, prop = "onPress") =>
  t.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props[prop] !== "undefined")[0];
function textos(node: any, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string") { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => textos(n, out)); return out; }
  textos(node.children, out);
  return out;
}
const tudo = (t: renderer.ReactTestRenderer) => textos(t.toJSON()).join("|");
const digitar = async (t: renderer.ReactTestRenderer, id: string, v: string) => {
  await act(async () => { porId(t, id, "onChangeText").props.onChangeText(v); });
};
const tocar = async (t: renderer.ReactTestRenderer, id: string) => {
  await act(async () => { await porId(t, id).props.onPress(); });
};

async function montarNaEtapa2() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<RegisterScreen />); });
  await digitar(tree, "cadastro-nome", "Maria");
  await digitar(tree, "cadastro-email", "maria@loja.com");
  await digitar(tree, "cadastro-senha", "Senha1234");
  await tocar(tree, "cadastro-termos");
  await tocar(tree, "cadastro-continuar-1");
  expect(porId(tree, "cadastro-continuar-2")).toBeDefined();
  return tree;
}

describe("tela de cadastro — conta sem CNPJ", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (global as any).open = jest.fn();
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
  });

  test("Não tenho CNPJ: CPF + nome da loja, manda cpf (sem cnpj e sem regime)", async () => {
    mockRegister.mockResolvedValueOnce({});
    const tree = await montarNaEtapa2();
    expect(porId(tree, "cadastro-cpf", "onChangeText")).toBeUndefined();
    expect(porId(tree, "cadastro-tenho-cnpj").props["aria-checked"]).toBe(true);

    await tocar(tree, "cadastro-sem-cnpj");
    expect(porId(tree, "cadastro-cpf", "onChangeText")).toBeDefined();
    expect(porId(tree, "cadastro-sem-cnpj").props["aria-checked"]).toBe(true);
    expect(tudo(tree)).toContain("Nome da sua loja");

    await digitar(tree, "cadastro-cpf", "52998224725");
    await digitar(tree, "cadastro-negocio", "Loja da Maria");
    expect(porId(tree, "cadastro-cpf", "onChangeText").props.value).toBe("529.982.247-25");
    await tocar(tree, "cadastro-continuar-2");

    await digitar(tree, "cadastro-whatsapp", "12999990000");
    await tocar(tree, "cadastro-criar");
    expect(mockRegister).toHaveBeenCalledTimes(1);
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.cpf).toBe(CPF_OK);
    expect(corpo.company_name).toBe("Loja da Maria");
    expect(corpo.phone).toBe("12999990000");
    expect(corpo).not.toHaveProperty("cnpj");
    expect(corpo).not.toHaveProperty("tax_regime");
    expect(corpo.segment).toBeUndefined();
  });

  test("CPF inválido não libera o Continuar e avisa", async () => {
    const tree = await montarNaEtapa2();
    await tocar(tree, "cadastro-sem-cnpj");
    await digitar(tree, "cadastro-cpf", "52998224726");
    await digitar(tree, "cadastro-negocio", "Loja da Maria");
    expect(tudo(tree)).toContain("CPF inválido. Confira os números.");
    expect(porId(tree, "cadastro-continuar-2").props.disabled).toBe(true);
    await tocar(tree, "cadastro-continuar-2");
    expect(porId(tree, "cadastro-whatsapp", "onChangeText")).toBeUndefined();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test("CPF de outra conta: volta à etapa 2 com a mensagem do backend", async () => {
    mockRegister.mockRejectedValueOnce(new (ApiError as any)(
      "Ja existe uma conta Aura com este CPF. Entre com ela ou peca acesso ao responsavel.", 409, { code: "CPF_ALREADY_REGISTERED" },
    ));
    const tree = await montarNaEtapa2();
    await tocar(tree, "cadastro-sem-cnpj");
    await digitar(tree, "cadastro-cpf", "52998224725");
    await digitar(tree, "cadastro-negocio", "Loja da Maria");
    await tocar(tree, "cadastro-continuar-2");
    await digitar(tree, "cadastro-whatsapp", "12999990000");
    await tocar(tree, "cadastro-criar");
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/conta Aura com este CPF/));
    expect(porId(tree, "cadastro-cpf", "onChangeText")).toBeDefined(); // de volta na etapa 2, CPF preservado
    expect(porId(tree, "cadastro-cpf", "onChangeText").props.value).toBe("529.982.247-25");
    expect(tudo(tree)).not.toContain("Esse e-mail já tem conta por aqui.");
  });

  test("Tenho CNPJ volta ao fluxo de sempre: consulta a Receita e manda cnpj + regime, sem cpf", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ legal_name: "LOJA DA MARIA LTDA", suggested_regime: "simples_nacional" }),
    })) as any;
    mockRegister.mockResolvedValueOnce({});
    const tree = await montarNaEtapa2();
    await tocar(tree, "cadastro-sem-cnpj");
    await digitar(tree, "cadastro-cpf", "52998224725");
    await tocar(tree, "cadastro-tenho-cnpj");
    expect(porId(tree, "cadastro-cpf", "onChangeText")).toBeUndefined();
    expect(tudo(tree)).toContain("Como a loja se chama");

    await digitar(tree, "cadastro-cnpj", CNPJ_OK);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/onboarding\/cnpj-lookup$/), expect.anything());
    await tocar(tree, "cadastro-continuar-2");
    await digitar(tree, "cadastro-whatsapp", "12999990000");
    await tocar(tree, "cadastro-criar");
    expect(mockRegister).toHaveBeenCalledTimes(1);
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.cnpj).toBe(CNPJ_OK);
    expect(corpo.tax_regime).toBe("simples_nacional");
    expect(corpo.company_name).toBe("LOJA DA MARIA LTDA");
    expect(corpo).not.toHaveProperty("cpf");
  });
});
