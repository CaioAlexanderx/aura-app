// ============================================================
// Remover empresa — INC-2026-10-22-01, tq-103 (22/10/2026)
//
// Uma lojista em teste removeu a própria e única empresa e a conta abriu
// vazia. O que este teste segura:
//   1. regras puras (utils/removerEmpresa): botão só para empresa do dono,
//      não principal, com 2+ empresas do dono; nome confere sem diferenciar
//      maiúsculas; mensagem do servidor no erro
//   2. a tela /empresas: com 1 empresa o botão "Remover" não existe; com 2
//      aparece na secundária; a confirmação só libera depois de digitar o
//      nome; o 409 LAST_COMPANY mostra a mensagem do servidor
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/AddCompanyModal", () => ({ AddCompanyModal: () => null }));
jest.mock("@/components/StockSharingCard", () => ({ StockSharingCard: () => null }));

const mockToastSuccess = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { error: jest.fn(), success: (...a: any[]) => mockToastSuccess(...a), info: jest.fn() },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: { id: "c1" },
    switchCompany: jest.fn(),
    switching: false,
    loadCompanies: jest.fn(async () => {}),
    logout: jest.fn(),
  }),
}));

// Modal do RNW usa portal: vira passa-adiante quando visível.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  const ReactReal = jest.requireActual("react");
  return new Proxy(RN, {
    get(target, prop) {
      if (prop === "Modal") {
        return ({ visible, children }: any) =>
          visible ? ReactReal.createElement(ReactReal.Fragment, null, children) : null;
      }
      return target[prop as any];
    },
  });
});

const mockList = jest.fn();
const mockRemove = jest.fn();
jest.mock("@/services/multicnpj", () => {
  const real = jest.requireActual("@/services/multicnpj");
  return {
    ...real,
    userCompaniesApi: {
      list: (...a: any[]) => mockList(...a),
      billingPreview: jest.fn(async () => null),
      remove: (...a: any[]) => mockRemove(...a),
      transferPrimary: jest.fn(),
    },
  };
});

import {
  podeRemoverEmpresa,
  nomeConfere,
  mensagemDoErroAoRemover,
  ehUltimaEmpresa,
} from "@/utils/removerEmpresa";
import MinhasEmpresasScreen from "@/app/empresas";

const empresa = (over: any) => ({
  id: "c1", name: "Loja da Ana", legal_name: "Ana Comércio LTDA", trade_name: "Loja da Ana",
  cnpj: "11222333000181", vertical: null, plan: "negocio", is_primary: false,
  billing_owner_company_id: null, billing_status: null, logo_url: null, role: "owner",
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

const MSG_ULTIMA =
  "Esta é a sua única empresa. Para trocar o CNPJ ou os dados, edite em Configurações → Dados da empresa.";

describe("regras de remover empresa", () => {
  test("única empresa do dono (sem principal, o caso real): sem botão", () => {
    const lista = [empresa({})];
    expect(podeRemoverEmpresa(lista[0], lista)).toBe(false);
  });

  test("duas empresas do dono: botão só na que não é principal", () => {
    const lista = [empresa({ id: "c1", is_primary: true }), empresa({ id: "c2", name: "Filial" })];
    expect(podeRemoverEmpresa(lista[0], lista)).toBe(false);
    expect(podeRemoverEmpresa(lista[1], lista)).toBe(true);
  });

  test("empresa em que é membro não conta e não ganha botão", () => {
    const lista = [empresa({ id: "c1" }), empresa({ id: "c2", role: "vendedor" })];
    expect(podeRemoverEmpresa(lista[0], lista)).toBe(false);
    expect(podeRemoverEmpresa(lista[1], lista)).toBe(false);
  });

  test("nome confere sem diferenciar maiúsculas e espaços extras; vazio nunca confere", () => {
    expect(nomeConfere("  loja   DA ana ", "Loja da Ana")).toBe(true);
    expect(nomeConfere("Loja da", "Loja da Ana")).toBe(false);
    expect(nomeConfere("", "")).toBe(false);
  });

  test("erro: mensagem do servidor; LAST_COMPANY reconhecido pelo code", () => {
    const err = { message: "Request failed", data: { error: "LAST_COMPANY", code: "LAST_COMPANY", message: MSG_ULTIMA } };
    expect(mensagemDoErroAoRemover(err)).toBe(MSG_ULTIMA);
    expect(ehUltimaEmpresa(err)).toBe(true);
    expect(mensagemDoErroAoRemover({ message: "Erro de conexão" })).toBe("Erro de conexão");
    expect(ehUltimaEmpresa({ data: { error: "HAS_SALES" } })).toBe(false);
  });
});

async function montar(companies: any[]) {
  mockList.mockResolvedValue({ companies });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<MinhasEmpresasScreen />);
  });
  await act(async () => {});
  return tree!;
}
const porTestID = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
// Conta os botões pelo texto também, para não depender só do testID.
const botoesRemover = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll((n) => n.props && n.props.children === "Remover", { deep: false }).length;

describe("tela /empresas — botão Remover", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockRemove.mockReset();
    mockToastSuccess.mockReset();
  });

  test("com 1 empresa o botão Remover não existe", async () => {
    const tree = await montar([empresa({ id: "c1" })]);
    expect(porTestID(tree, "empresa-remover-c1")).toHaveLength(0);
    expect(botoesRemover(tree)).toBe(0);
  });

  test("com 2 empresas o botão aparece só na secundária", async () => {
    const tree = await montar([
      empresa({ id: "c1", is_primary: true }),
      empresa({ id: "c2", name: "Filial Centro" }),
    ]);
    expect(porTestID(tree, "empresa-remover-c1")).toHaveLength(0);
    expect(porTestID(tree, "empresa-remover-c2").length).toBeGreaterThan(0);
    expect(botoesRemover(tree)).toBeGreaterThan(0);
  });

  test("confirmação exige o nome; o 409 LAST_COMPANY mostra a mensagem do servidor", async () => {
    const tree = await montar([
      empresa({ id: "c1", is_primary: true }),
      empresa({ id: "c2", name: "Filial Centro" }),
    ]);
    await act(async () => { porTestID(tree, "empresa-remover-c2")[0].props.onPress(); });

    // sem o nome: confirmar desabilitado e nada chamado
    const confirmar = () => porTestID(tree, "remover-empresa-confirmar")[0];
    expect(confirmar().props.disabled).toBe(true);
    await act(async () => { confirmar().props.onPress(); });
    expect(mockRemove).not.toHaveBeenCalled();

    // nome errado continua travado
    await act(async () => { porTestID(tree, "remover-empresa-nome")[0].props.onChangeText("Filial"); });
    expect(confirmar().props.disabled).toBe(true);

    // nome certo libera
    await act(async () => { porTestID(tree, "remover-empresa-nome")[0].props.onChangeText("filial centro"); });
    expect(confirmar().props.disabled).toBe(false);

    mockRemove.mockRejectedValueOnce({
      message: "Request failed",
      status: 409,
      data: { error: "LAST_COMPANY", code: "LAST_COMPANY", message: MSG_ULTIMA },
    });
    await act(async () => { confirmar().props.onPress(); });
    expect(mockRemove).toHaveBeenCalledWith("c2");
    const erro = porTestID(tree, "remover-empresa-erro");
    expect(erro.length).toBeGreaterThan(0);
    const textos = erro[0].findAll((n) => typeof n.props?.children === "string").map((n) => n.props.children);
    expect(textos).toContain(MSG_ULTIMA);
  });
});
