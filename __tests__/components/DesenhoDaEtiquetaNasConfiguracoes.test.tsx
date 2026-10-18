// ============================================================
// Desenho da etiqueta nas Políticas do Caixa (18/10/2026, card f1-16)
//
// pdv_settings.label_design ("classico" | "editorial" | null; Aura-backend
// #862). Sem escolha, a opção marcada é o padrão do modelo da loja — o que
// ela imprime hoje. Escolher grava pelo mesmo caminho dos outros toggles.
// Mocks do padrão do repo (expo-font, Icon); testID + deep:false.
// ============================================================
import fs from "fs";
import path from "path";
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
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardFeeSection", () => ({ CardFeeSection: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));
jest.mock("@/components/screens/configuracoes/FrenteDaLoja", () => ({ FrenteDaLoja: () => null, nomeDaFrente: () => "" }));

import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { _resetMigracaoDoVale } from "@/hooks/usePdvSettings";
import { pdvSettingsApi } from "@/services/api";

const api = pdvSettingsApi as unknown as Record<string, jest.Mock>;

jest.setTimeout(30000);

async function flush(vezes = 5) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function montarCartao(settings: any) {
  api.get.mockResolvedValue({ settings });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><PdvSettingsCard /></QueryClientProvider>); });
  await flush();
  return tree;
}

const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const marcado = (t: renderer.ReactTestRenderer) =>
  ["classico", "editorial"].filter((d) => porId(t, "desenho-etiqueta-" + d)[0].props.accessibilityState.selected);

beforeEach(() => {
  jest.clearAllMocks();
  _resetMigracaoDoVale();
  window.localStorage.clear();
  api.save.mockImplementation(async (_id: string, s: any) => ({ settings: s }));
});

describe("Configurações › Políticas do Caixa › Desenho da etiqueta", () => {
  it.each([
    [{}, ["classico"]],
    [{ label_design: null, label_size: "99x21" }, ["classico"]],
    [{ label_design: null, label_size: "30x25" }, ["classico"]],
    [{ label_design: null, label_size: "105x21" }, ["editorial"]],
    [{ label_design: null, label_size: "40x25" }, ["editorial"]],
    [{ label_design: "editorial", label_size: "99x21" }, ["editorial"]],
    [{ label_design: "classico", label_size: "105x21" }, ["classico"]],
  ])("sem escolha marca o padrão do modelo; com escolha, a escolha (%j)", async (settings, esperado) => {
    const tree = await montarCartao(settings);
    expect(marcado(tree)).toEqual(esperado);
    tree.unmount();
  });

  it("escolher Editorial grava label_design no pdv_settings, junto com o resto", async () => {
    const tree = await montarCartao({ caixa_enabled: true, label_size: "30x25", label_design: null });
    await act(async () => { porId(tree, "desenho-etiqueta-editorial")[0].props.onPress(); });
    await flush();
    expect(api.save).toHaveBeenCalledTimes(1);
    const [empresa, corpo] = api.save.mock.calls[0];
    expect(empresa).toBe("loja-1");
    expect(corpo).toMatchObject({ caixa_enabled: true, label_size: "30x25", label_design: "editorial" });
    tree.unmount();
  });

  it("escolher o Clássico no 105x21 grava a escolha (mesmo sendo outro que o padrão)", async () => {
    const tree = await montarCartao({ label_size: "105x21", label_design: null });
    await act(async () => { porId(tree, "desenho-etiqueta-classico")[0].props.onPress(); });
    await flush();
    expect(api.save.mock.calls[0][1]).toMatchObject({ label_design: "classico" });
    tree.unmount();
  });

  it("tocar no desenho já escolhido não grava nada", async () => {
    const tree = await montarCartao({ label_design: "editorial" });
    await act(async () => { porId(tree, "desenho-etiqueta-editorial")[0].props.onPress(); });
    await flush();
    expect(api.save).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("modelo sem a opção (40x25, 58mm) diz que continua com o desenho de hoje", async () => {
    let tree = await montarCartao({ label_size: "40x25" });
    expect(JSON.stringify(tree.toJSON())).toContain("continua com o desenho de hoje");
    tree.unmount();
    tree = await montarCartao({ label_size: "99x21" });
    expect(JSON.stringify(tree.toJSON())).not.toContain("continua com o desenho de hoje");
    tree.unmount();
  });
});

describe("a impressão lê o desenho da loja", () => {
  const ler = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
  it("PrintLabels passa pdv_settings.label_design na etiqueta, no teste e na prévia", () => {
    const src = ler("components/PrintLabels.tsx");
    expect(src).toMatch(/var labelDesign = pdvSettings\.label_design;/);
    expect(src.match(/offsetMm: labelOffsetMm, design: labelDesign, \.\.\.printerOpts/g) || []).toHaveLength(3);
  });
});
