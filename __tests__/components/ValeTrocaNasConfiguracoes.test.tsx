// ============================================================
// Vale-troca no cupom: a preferência mora em pdv_settings (13/10/2026)
//
// Aura-backend#813: pdv_settings.vale_troca_enabled (boolean, default false desde 08/11/2026).
// Antes (app#1056) ela era guardada só no navegador; esse valor não é mais lido.
//   · o interruptor das Políticas do Caixa lê e grava vale_troca_enabled pelo
//     mesmo caminho dos outros toggles (pdvSettingsApi.save com o merge);
//   · só liga com true; chave ausente = desligado.
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
import { pdvSettingsApi } from "@/services/api";

const api = pdvSettingsApi as unknown as Record<string, jest.Mock>;

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
  window.localStorage.clear();
  api.save.mockImplementation(async (_id: string, s: any) => ({ settings: s }));
});

describe("Configurações › Políticas do Caixa › Vale-troca", () => {
  it("lê o valor de pdv_settings: desligado por padrão, ligado só quando o servidor diz true", async () => {
    let tree = await montarCartao({ crediario_enabled: true, caixa_enabled: true });
    expect(porId(tree, "toggle-vale-troca")[0].props.value).toBe(false);
    tree.unmount();

    tree = await montarCartao({ crediario_enabled: true, caixa_enabled: true, vale_troca_enabled: true });
    expect(porId(tree, "toggle-vale-troca")[0].props.value).toBe(true);
    tree.unmount();
  });

  it("desligar grava vale_troca_enabled:false em pdv_settings (merge com o resto)", async () => {
    const tree = await montarCartao({ crediario_enabled: true, caixa_enabled: true, vale_troca_enabled: true });
    await act(async () => { porId(tree, "toggle-vale-troca")[0].props.onValueChange(false); });
    await flush();

    expect(api.save).toHaveBeenCalledTimes(1);
    const [empresa, corpo] = api.save.mock.calls[0];
    expect(empresa).toBe("loja-1");
    expect(corpo).toMatchObject({ crediario_enabled: true, caixa_enabled: true, vale_troca_enabled: false });
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

describe("Políticas do Caixa › Vale-troca › prazo para troca (12/11/2026)", () => {
  const prazo = (t: renderer.ReactTestRenderer) => porId(t, "vale-troca-prazo");
  const textoDe = (n: any): string =>
    n == null ? "" : typeof n === "string" ? n : Array.isArray(n) ? n.map(textoDe).join("") : textoDe(n.children);

  it("desligado: sem o campo de prazo", async () => {
    const tree = await montarCartao({ vale_troca_enabled: false, vale_troca_prazo_dias: 15 });
    expect(prazo(tree)).toHaveLength(0);
    tree.unmount();
  });

  it("ligado: atalhos 7/15/30/60/90 e o campo livre; sem escolha, 30 marcado", async () => {
    const tree = await montarCartao({ vale_troca_enabled: true });
    expect(prazo(tree)).toHaveLength(1);
    [7, 15, 30, 60, 90].forEach((d) => expect(porId(tree, "vale-troca-prazo-atalho-" + d)).toHaveLength(1));
    expect(porId(tree, "vale-troca-prazo-atalho-30")[0].props.accessibilityState.selected).toBe(true);
    expect(porId(tree, "vale-troca-prazo-livre")).toHaveLength(1);
    expect(textoDe(porId(tree, "vale-troca-prazo-efeito")[0])).toBe("No cupom: troca em até 30 dias após a compra");
    tree.unmount();
  });

  it("o texto do efeito é hoje + o prazo escolhido", async () => {
    jest.useFakeTimers({ now: new Date("2026-11-12T15:00:00Z"), doNotFake: ["nextTick", "setImmediate", "queueMicrotask", "setTimeout"] });
    try {
      const tree = await montarCartao({ vale_troca_enabled: true, vale_troca_prazo_dias: 15 });
      expect(textoDe(porId(tree, "vale-troca-prazo-efeito")[0])).toBe("No cupom: troca em até 15 dias após a compra");
      tree.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("atalho grava vale_troca_prazo_dias (merge com o resto)", async () => {
    const tree = await montarCartao({ caixa_enabled: true, vale_troca_enabled: true });
    await act(async () => { porId(tree, "vale-troca-prazo-atalho-90")[0].props.onPress(); });
    await flush();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0][1]).toMatchObject({ caixa_enabled: true, vale_troca_enabled: true, vale_troca_prazo_dias: 90 });
    tree.unmount();
  });

  it("campo livre: 45 grava 45 ao sair do campo; prazo fora dos atalhos aparece no campo", async () => {
    const tree = await montarCartao({ vale_troca_enabled: true });
    const livre = () => porId(tree, "vale-troca-prazo-livre")[0];
    await act(async () => { livre().props.onChangeText("45"); });
    await act(async () => { livre().props.onBlur(); });
    await flush();
    expect(api.save.mock.calls[0][1]).toMatchObject({ vale_troca_prazo_dias: 45 });
    expect(livre().props.value).toBe("45");
    tree.unmount();
  });

  it("campo livre: 0 ou 400 não grava e avisa a faixa", async () => {
    const tree = await montarCartao({ vale_troca_enabled: true });
    const livre = () => porId(tree, "vale-troca-prazo-livre")[0];
    for (const v of ["0", "400"]) {
      await act(async () => { livre().props.onChangeText(v); });
      await act(async () => { livre().props.onSubmitEditing(); });
      await flush();
      expect(textoDe(porId(tree, "vale-troca-prazo-erro")[0])).toBe("Use um número de 1 a 365 dias.");
    }
    expect(api.save).not.toHaveBeenCalled();
    tree.unmount();
  });
});

describe("quem imprime o cupom lê a preferência do servidor", () => {
  const ler = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");

  it("a tela final do Caixa e a 2ª via em Vendas passam o pdv_settings ao cupomComVale", () => {
    const final = ler("components/screens/pdv/SaleComplete.tsx");
    expect(final).toMatch(/cupomComVale\(await res\.text\(\), \{ companyId, saleId, vendaEm, config \}\)/);
    expect(ler("app/(tabs)/pdv.tsx")).toMatch(/pdvSettings=\{pdvSettingsGarantia\}/);
    // 12/11/2026: a 2ª via lê o pdv_settings da loja QUE VENDEU (consolidado).
    const segunda = ler("components/screens/vendas/SaleDetailModal.tsx");
    expect(segunda).toMatch(/usePdvSettings\(effectiveCompanyId\)/);
    expect(segunda).toMatch(/config: pdvDaLojaDaVenda,/);
  });

  it("o tipo PdvSettings conhece as chaves", () => {
    expect(ler("services/authApi.ts")).toMatch(/vale_troca_enabled\?: boolean;/);
    expect(ler("services/authApi.ts")).toMatch(/vale_troca_prazo_dias\?: number;/);
  });
});
