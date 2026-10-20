// ============================================================
// Conta sem CNPJ, com CPF (20/10/2026)
//
// Decisão do Caio: "vamos liberar para os clientes que sinalizarem que não
// tem CNPJ". O que este teste segura:
//   1. regras puras (utils/documentoEmpresa): CPF válido, corpo do cadastro
//      (com CNPJ = o de sempre; sem CNPJ = só o CPF, sem regime), 409 por
//      code, texto do documento sem "null"/"undefined";
//   2. a tela de cadastro: "Não tenho CNPJ" troca o campo por CPF + nome da
//      loja e manda `cpf`; CPF inválido não libera; CPF duplicado fica no
//      passo 2 com a mensagem do backend; "Tenho CNPJ" volta e o fluxo com
//      CNPJ manda cnpj + regime como antes, sem `cpf`.
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
  return { ApiError, authApi: { validateCode: jest.fn() } };
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
function byPlaceholder(tree: renderer.ReactTestRenderer, ph: string) {
  return tree.root.find((n: any) => n.props && n.props.placeholder === ph && typeof n.props.onChangeText === "function");
}
function byTestId(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false })[0];
}
function pressText(tree: renderer.ReactTestRenderer, text: string) {
  const alvo = tree.root.findAll((n: any) => n.props && typeof n.props.onPress === "function"
    && n.findAll((c: any) => c.children && c.children.includes && c.children.includes(text)).length > 0);
  // o mais interno que tem o texto
  return alvo[alvo.length - 1].props.onPress();
}
function hasText(tree: renderer.ReactTestRenderer, text: string) {
  return tree.root.findAll((n: any) => Array.isArray(n.children) && n.children.includes(text)).length > 0;
}

async function montarNoPasso2() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<RegisterScreen />); });
  await act(async () => {
    byPlaceholder(tree, "Maria da Silva").props.onChangeText("Maria");
    byPlaceholder(tree, "maria@empresa.com").props.onChangeText("maria@loja.com");
    byPlaceholder(tree, "Mínimo 8 caracteres").props.onChangeText("Senha1234");
  });
  // o checkbox dos Termos: o Pressable com accessibilityRole=checkbox
  await act(async () => {
    tree.root.find((n: any) => n.props && n.props.accessibilityRole === "checkbox" && typeof n.props.onPress === "function").props.onPress();
  });
  await act(async () => { pressText(tree, "Continuar"); });
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
    const tree = await montarNoPasso2();
    expect(byTestId(tree, "cadastro-cpf")).toBeUndefined();

    await act(async () => { byTestId(tree, "cadastro-sem-cnpj").props.onPress(); });
    expect(byTestId(tree, "cadastro-cpf")).toBeDefined();
    expect(hasText(tree, "Nome da sua loja *")).toBe(true);

    await act(async () => {
      byTestId(tree, "cadastro-cpf").props.onChangeText("52998224725");
      byPlaceholder(tree, "Loja da Maria").props.onChangeText("Loja da Maria");
      byPlaceholder(tree, "(12) 99999-0000").props.onChangeText("12999990000");
    });
    expect(byTestId(tree, "cadastro-cpf").props.value).toBe("529.982.247-25");

    await act(async () => { pressText(tree, "Criar conta"); });
    expect(mockRegister).toHaveBeenCalledTimes(1);
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.cpf).toBe(CPF_OK);
    expect(corpo.company_name).toBe("Loja da Maria");
    expect(corpo).not.toHaveProperty("cnpj");
    expect(corpo).not.toHaveProperty("tax_regime");
    expect(corpo.segment).toBeUndefined();
  });

  test("CPF inválido não libera o cadastro e avisa", async () => {
    const tree = await montarNoPasso2();
    await act(async () => { byTestId(tree, "cadastro-sem-cnpj").props.onPress(); });
    await act(async () => {
      byTestId(tree, "cadastro-cpf").props.onChangeText("52998224726");
      byPlaceholder(tree, "Loja da Maria").props.onChangeText("Loja da Maria");
      byPlaceholder(tree, "(12) 99999-0000").props.onChangeText("12999990000");
    });
    expect(hasText(tree, "CPF inválido. Confira os números.")).toBe(true);
    await act(async () => { pressText(tree, "Criar conta"); });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test("CPF de outra conta: fica no passo 2 com a mensagem do backend", async () => {
    mockRegister.mockRejectedValueOnce(new (ApiError as any)(
      "Ja existe uma conta Aura com este CPF. Entre com ela ou peca acesso ao responsavel.", 409, { code: "CPF_ALREADY_REGISTERED" },
    ));
    const tree = await montarNoPasso2();
    await act(async () => { byTestId(tree, "cadastro-sem-cnpj").props.onPress(); });
    await act(async () => {
      byTestId(tree, "cadastro-cpf").props.onChangeText("52998224725");
      byPlaceholder(tree, "Loja da Maria").props.onChangeText("Loja da Maria");
      byPlaceholder(tree, "(12) 99999-0000").props.onChangeText("12999990000");
    });
    await act(async () => { pressText(tree, "Criar conta"); });
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/conta Aura com este CPF/));
    expect(byTestId(tree, "cadastro-cpf")).toBeDefined(); // continua no passo 2
    expect(hasText(tree, "Esse e-mail já tem conta na Aura.")).toBe(false);
  });

  test("Tenho CNPJ volta ao fluxo de sempre: consulta a Receita e manda cnpj + regime, sem cpf", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ legal_name: "LOJA DA MARIA LTDA", suggested_regime: "simples_nacional" }),
    })) as any;
    mockRegister.mockResolvedValueOnce({});
    const tree = await montarNoPasso2();
    await act(async () => { byTestId(tree, "cadastro-sem-cnpj").props.onPress(); });
    await act(async () => { byTestId(tree, "cadastro-cpf").props.onChangeText("52998224725"); });
    await act(async () => { byTestId(tree, "cadastro-tenho-cnpj").props.onPress(); });
    expect(byTestId(tree, "cadastro-cpf")).toBeUndefined();
    expect(hasText(tree, "CNPJ *")).toBe(true);

    await act(async () => {
      byPlaceholder(tree, "00.000.000/0000-00").props.onChangeText(CNPJ_OK);
    });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/onboarding\/cnpj-lookup$/), expect.anything());
    await act(async () => {
      byPlaceholder(tree, "(12) 99999-0000").props.onChangeText("12999990000");
    });
    await act(async () => { pressText(tree, "Criar conta"); });
    expect(mockRegister).toHaveBeenCalledTimes(1);
    const corpo = mockRegister.mock.calls[0][0];
    expect(corpo.cnpj).toBe(CNPJ_OK);
    expect(corpo.tax_regime).toBe("simples_nacional");
    expect(corpo.company_name).toBe("LOJA DA MARIA LTDA");
    expect(corpo).not.toHaveProperty("cpf");
  });
});
