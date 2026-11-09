// ============================================================
// Pix pela maquininha (09/11/2026, decisão do Caio)
//
// Campo novo "Pix pela maquininha %" (card_fee_pix_pct), logo abaixo do
// Débito, com a ajuda "Se o Pix cai direto na chave da loja, deixe 0."
// O backend (aura-backend, PR da taxa no Pix) cobra a taxa em toda venda Pix
// quando o campo é > 0.
//
//   1. validação do campo: vírgula e ponto, teto de 100, vazio/inválido = 0,
//      sair sem digitar não grava;
//   2. render da tela de Configurações (PdvSettingsCard com a seção real):
//      o campo aparece abaixo do Débito e grava card_fee_pix_pct pelo save.
// Mocks do padrão do repo (expo-font, FpktLogo, Icon); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    () => ({ company: { id: "loja-1", vertical_active: "retail" }, token: "t", isStaff: false, isDemo: false }),
    { getState: () => ({ token: "t", company: { id: "loja-1" } }) },
  ),
}));
jest.mock("@/services/api", () => ({
  pdvSettingsApi: { get: jest.fn(), save: jest.fn() },
  companiesApi: { products: jest.fn() },
}));
// Sub-seções que não fazem parte deste teste. A CardFeeSection é a REAL.
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));
jest.mock("@/components/screens/configuracoes/FrenteDaLoja", () => ({ FrenteDaLoja: () => null, nomeDaFrente: () => "" }));

import { CardFeeSection } from "@/components/screens/configuracoes/CardFeeSection";
import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { pdvSettingsApi } from "@/services/api";

const api = pdvSettingsApi as unknown as Record<string, jest.Mock>;

jest.setTimeout(30000);

const palette = {
  label: "#000", desc: "#000", hint: "#000", trackOff: "#000", trackOn: "#000",
  thumbOff: "#000", thumbOn: "#000", inputBg: "#fff", inputBorder: "#000", inputText: "#000", boxBorder: "#000",
};

const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });

function montarSecao(display: any, onToggle = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CardFeeSection display={display} saving={false} onToggle={onToggle} palette={palette} />);
  });
  const campo = () => porId(tree, "card-fee-pix")[0];
  return { tree, campo, onToggle };
}

function digitarESair(campo: () => any, texto: string) {
  act(() => { campo().props.onChangeText(texto); });
  act(() => { campo().props.onBlur(); });
}

const base = { card_fee_enabled: true, card_fee_credit_pct: 3, card_fee_debit_pct: 1 };

describe("Pix pela maquininha — validação do campo", () => {
  it.each([
    ["0,99", 0.99],
    ["0.99", 0.99],
    ["1,5%", 1.5],
    ["100", 100],
    ["150", 100],
    ["", 0],
    ["abc", 0],
    ["-5", 0],
  ])("%p grava %p", (texto, esperado) => {
    const { campo, onToggle } = montarSecao({ ...base, card_fee_pix_pct: 2 });
    digitarESair(campo, texto);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("card_fee_pix_pct", esperado);
  });

  it("digitar o mesmo valor salvo não grava de novo", () => {
    const { campo, onToggle } = montarSecao({ ...base, card_fee_pix_pct: 0.99 });
    digitarESair(campo, "0,99");
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("entrar no campo e sair sem digitar não grava", () => {
    const { campo, onToggle } = montarSecao({ ...base, card_fee_pix_pct: 0.99 });
    act(() => { campo().props.onBlur(); });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("sem a chave salva fica vazio com o 0 de placeholder, e mexer no Pix não toca no crédito/débito", () => {
    const { campo, onToggle } = montarSecao(base);
    expect(campo().props.value).toBe("");
    expect(campo().props.placeholder).toBe("0");
    digitarESair(campo, "1,2");
    expect(onToggle.mock.calls).toEqual([["card_fee_pix_pct", 1.2]]);
  });

  it("mostra o valor salvo com vírgula", () => {
    const { campo } = montarSecao({ ...base, card_fee_pix_pct: 0.99 });
    expect(campo().props.value).toBe("0,99");
  });

  it("taxa desligada: o campo do Pix some junto com crédito e débito", () => {
    const { tree } = montarSecao({ ...base, card_fee_enabled: false, card_fee_pix_pct: 0.99 });
    expect(porId(tree, "card-fee-pix")).toHaveLength(0);
    expect(porId(tree, "card-fee-debit")).toHaveLength(0);
  });
});

async function flush(vezes = 5) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function montarCartao(settings: any) {
  api.get.mockResolvedValue({ settings });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PdvSettingsCard /></QueryClientProvider>);
  });
  await flush();
  return tree;
}

// Ordem em que os testIDs aparecem na árvore (busca em profundidade).
function ordemDosIds(tree: renderer.ReactTestRenderer, ids: string[]) {
  const vistos: string[] = [];
  const visitar = (n: any) => {
    if (!n || typeof n === "string") return;
    const id = n.props && n.props.testID;
    if (ids.includes(id) && !vistos.includes(id)) vistos.push(id);
    (n.children || []).forEach(visitar);
  };
  visitar(tree.root);
  return vistos;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  api.save.mockImplementation(async (_id: string, s: any) => ({ settings: s }));
});

describe("Configurações › Taxa da maquininha › Pix (tela)", () => {
  it("o campo do Pix aparece logo abaixo do Débito, com a ajuda", async () => {
    const tree = await montarCartao({ crediario_enabled: true, card_fee_enabled: true, card_fee_credit_pct: 3, card_fee_debit_pct: 1 });
    expect(ordemDosIds(tree, ["card-fee-credit", "card-fee-debit", "card-fee-pix"]))
      .toEqual(["card-fee-credit", "card-fee-debit", "card-fee-pix"]);
    const linha = porId(tree, "card-fee-pix-row")[0];
    const textos = linha.findAll((n: any) => typeof n.props?.children === "string").map((n: any) => n.props.children);
    expect(textos).toEqual(expect.arrayContaining(["Pix pela maquininha", "Se o Pix cai direto na chave da loja, deixe 0."]));
    tree.unmount();
  });

  it("digitar 0,99 no Pix salva card_fee_pix_pct sem mexer no resto", async () => {
    const tree = await montarCartao({ crediario_enabled: true, card_fee_enabled: true, card_fee_credit_pct: 3, card_fee_debit_pct: 1 });
    const campo = () => porId(tree, "card-fee-pix")[0];
    await act(async () => { campo().props.onChangeText("0,99"); });
    await act(async () => { campo().props.onBlur(); });
    await flush();
    expect(api.save).toHaveBeenCalledTimes(1);
    const enviado = api.save.mock.calls[0][1];
    expect(enviado).toMatchObject({ card_fee_pix_pct: 0.99, card_fee_credit_pct: 3, card_fee_debit_pct: 1, card_fee_enabled: true });
    tree.unmount();
  });
});
