// ============================================================
// Vale-troca no cupom: a preferência mora em pdv_settings (13/10/2026)
//
// Aura-backend#813: pdv_settings.vale_troca_enabled (boolean, default true).
// Antes (app#1056) ela era guardada só no navegador (utils/valeTroca.ts).
//   · o interruptor das Políticas do Caixa lê e grava vale_troca_enabled pelo
//     mesmo caminho dos outros toggles (pdvSettingsApi.save com o merge);
//   · o "desligado" que a loja deixou no navegador sobe uma vez para o
//     servidor (usePdvSettings) e depois é ignorado.
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
// Sub-seções que não fazem parte deste teste.
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardFeeSection", () => ({ CardFeeSection: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));
jest.mock("@/components/screens/configuracoes/FrenteDaLoja", () => ({ FrenteDaLoja: () => null, nomeDaFrente: () => "" }));

import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { usePdvSettings, _resetMigracaoDoVale } from "@/hooks/usePdvSettings";
import { pdvSettingsApi } from "@/services/api";

const api = pdvSettingsApi as unknown as Record<string, jest.Mock>;
const LEGADA = "aura:vale-troca-no-cupom:loja-1";
const MIGRADO = "aura:vale-troca-migrado:loja-1";

jest.setTimeout(30000);

async function flush(vezes = 5) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

function comProvider(children: React.ReactNode, qc: QueryClient) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function montarCartao(settings: any) {
  api.get.mockResolvedValue({ settings });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(comProvider(<PdvSettingsCard />, qc)); });
  await flush();
  return tree;
}

const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });

beforeEach(() => {
  jest.clearAllMocks();
  _resetMigracaoDoVale();
  window.localStorage.clear();
  api.save.mockImplementation(async (_id: string, s: any) => ({ settings: s }));
});

describe("Configurações › Políticas do Caixa › Vale-troca", () => {
  it("lê o valor de pdv_settings: ligado por padrão, desligado quando o servidor diz false", async () => {
    let tree = await montarCartao({ crediario_enabled: true, caixa_enabled: true });
    expect(porId(tree, "toggle-vale-troca")[0].props.value).toBe(true);
    tree.unmount();

    tree = await montarCartao({ crediario_enabled: true, caixa_enabled: true, vale_troca_enabled: false });
    expect(porId(tree, "toggle-vale-troca")[0].props.value).toBe(false);
    tree.unmount();
  });

  it("desligar grava vale_troca_enabled:false em pdv_settings (merge com o resto) e marca a loja como migrada", async () => {
    const tree = await montarCartao({ crediario_enabled: true, caixa_enabled: true, vale_troca_enabled: true });
    await act(async () => { porId(tree, "toggle-vale-troca")[0].props.onValueChange(false); });
    await flush();

    expect(api.save).toHaveBeenCalledTimes(1);
    const [empresa, corpo] = api.save.mock.calls[0];
    expect(empresa).toBe("loja-1");
    expect(corpo).toMatchObject({ crediario_enabled: true, caixa_enabled: true, vale_troca_enabled: false });
    expect(window.localStorage.getItem(MIGRADO)).toBe("1");
    tree.unmount();
  });

  it("ligar de novo grava true", async () => {
    const tree = await montarCartao({ vale_troca_enabled: false });
    await act(async () => { porId(tree, "toggle-vale-troca")[0].props.onValueChange(true); });
    await flush();
    expect(api.save.mock.calls[0][1]).toMatchObject({ vale_troca_enabled: true });
    tree.unmount();
  });

  it("a frase não diz mais que vale só para este computador", async () => {
    const tree = await montarCartao({});
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Vale-troca no cupom");
    expect(json).not.toContain("Vale para este computador");
    tree.unmount();
  });
});

describe("usePdvSettings: migração do 'desligado' guardado no navegador", () => {
  function Sonda() {
    usePdvSettings();
    return null;
  }
  async function montarSonda() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(comProvider(<Sonda />, qc)); });
    await flush();
    return tree;
  }

  it("servidor ainda 'ligado' e navegador 'desligado': sobe false uma vez e depois ignora o navegador", async () => {
    window.localStorage.setItem(LEGADA, "0");
    api.get.mockResolvedValue({ settings: { vale_troca_enabled: true } });
    const tree = await montarSonda();

    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledWith("loja-1", { vale_troca_enabled: false });
    expect(window.localStorage.getItem(MIGRADO)).toBe("1");
    expect(window.localStorage.getItem(LEGADA)).toBeNull();
    tree.unmount();
  });

  it("sem valor antigo no navegador não escreve nada no servidor", async () => {
    api.get.mockResolvedValue({ settings: { vale_troca_enabled: true } });
    const tree = await montarSonda();
    expect(api.save).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("se o PUT falha, o 'desligado' do navegador continua valendo e nada é marcado", async () => {
    window.localStorage.setItem(LEGADA, "0");
    api.get.mockResolvedValue({ settings: { vale_troca_enabled: true } });
    api.save.mockRejectedValue({ status: 403 });
    const tree = await montarSonda();
    expect(window.localStorage.getItem(MIGRADO)).toBeNull();
    expect(window.localStorage.getItem(LEGADA)).toBe("0");
    tree.unmount();
  });
});

describe("quem imprime o cupom lê a preferência do servidor", () => {
  const ler = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");

  it("a tela final do Caixa e a 2ª via em Vendas passam o pdv_settings ao cupomComVale", () => {
    const final = ler("components/screens/pdv/SaleComplete.tsx");
    expect(final).toMatch(/cupomComVale\(await res\.text\(\), \{ companyId, saleId, vendaEm, config \}\)/);
    expect(ler("app/(tabs)/pdv.tsx")).toMatch(/pdvSettings=\{pdvSettingsGarantia\}/);
    expect(ler("components/screens/vendas/SaleDetailModal.tsx")).toMatch(/config: pdvSettings,/);
  });

  it("o tipo PdvSettings conhece a chave", () => {
    expect(ler("services/authApi.ts")).toMatch(/vale_troca_enabled\?: boolean;/);
  });
});
