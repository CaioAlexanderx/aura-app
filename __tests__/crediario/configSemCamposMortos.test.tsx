// ============================================================
// RA-12 — Configurações do Crediário sem require_score_min e
// auto_block_days.
//
// Nenhum código do backend lê esses dois campos: o score só avisa (pelo
// score_warn_min) e o único bloqueio é o manual. A tela não pode
// prometer o que não acontece. Estes testes seguram:
//
// 1. require_score_min (NOT NULL DEFAULT 300 no banco) não liga o aviso
//    de score na tela quando score_warn_min está vazio;
// 2. a tela não fala em bloqueio automático nem em dias para bloquear;
// 3. salvar não envia require_score_min nem auto_block_days (o PUT
//    mantém o valor gravado), e desligar o aviso envia 0, não null;
// 4. score_warn_min gravado continua aparecendo ligado, com o valor.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1", name: "Loja Exemplo" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

var mockConfig: any = {};
var mockUpdatePlan = jest.fn((_id: string, _body: any) => Promise.resolve({}));
jest.mock("@/services/creditApi", () => ({
  creditApi: {
    getPlanConfig: () => Promise.resolve(mockConfig),
    getCollectionRules: () => Promise.resolve({ enabled: true, rules: [], pix_key: "", whatsapp_auto: false }),
    updatePlanConfig: (id: string, body: any) => mockUpdatePlan(id, body),
    updateCollectionRules: jest.fn(() => Promise.resolve({})),
  },
}));

jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return { ...actual, waApi: { getStatus: () => Promise.resolve(null), getPreview: jest.fn() } };
});

import CrediarioSettingsScreen from "@/app/(tabs)/crediario/settings";

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <CrediarioSettingsScreen />
      </QueryClientProvider>
    );
  });
  await flush();
  return tree;
}

// deep:false — o testID se repete nos nós host do react-native-web.
function porTestId(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id }, { deep: false })[0];
}

const LEGADO = {
  max_installments: 12, min_installment_value: 20,
  require_score_min: 300, auto_block_days: 30, score_warn_min: null,
};

describe("RA-12: configurações do crediário sem campos que nada usa", () => {
  beforeEach(() => { mockUpdatePlan.mockClear(); });

  it("require_score_min de 300 não liga o aviso de score", async () => {
    mockConfig = { ...LEGADO };
    const tree = await montar();
    const sw = porTestId(tree, "crediario-score-aviso-switch");
    expect(sw).toBeTruthy();
    expect(sw.props.value).toBe(false);
    tree.unmount();
  });

  it("a tela não promete bloqueio automático nem score mínimo para bloquear", async () => {
    mockConfig = { ...LEGADO };
    const tree = await montar();
    const txt = JSON.stringify(tree.toJSON()).toLowerCase();
    expect(txt).not.toContain("bloqueio automático");
    expect(txt).not.toContain("bloquear automaticamente");
    expect(txt).not.toContain("dias para bloqueio");
    expect(txt).not.toContain("score mínimo");
    // O que existe é o aviso, e a tela diz que ele nunca bloqueia.
    expect(txt).toContain("nunca bloqueia");
    tree.unmount();
  });

  it("salvar não envia require_score_min nem auto_block_days; aviso desligado vai 0", async () => {
    mockConfig = { ...LEGADO };
    const tree = await montar();
    // Liga e desliga o aviso só para deixar a tela "suja".
    await act(async () => { porTestId(tree, "crediario-score-aviso-switch").props.onValueChange(true); });
    await act(async () => { porTestId(tree, "crediario-score-aviso-switch").props.onValueChange(false); });
    await act(async () => { porTestId(tree, "crediario-config-salvar").props.onPress(); });
    await flush();

    expect(mockUpdatePlan).toHaveBeenCalledTimes(1);
    const body = mockUpdatePlan.mock.calls[0][1];
    expect(body).not.toHaveProperty("require_score_min");
    expect(body).not.toHaveProperty("auto_block_days");
    expect(body.score_warn_min).toBe(0);
    // Nada de parcela muda por causa disto.
    expect(body.max_installments).toBe(12);
    expect(body.min_installment_value).toBe(20);
    tree.unmount();
  });

  it("score_warn_min gravado aparece ligado, com o valor", async () => {
    mockConfig = { ...LEGADO, score_warn_min: 450 };
    const tree = await montar();
    expect(porTestId(tree, "crediario-score-aviso-switch").props.value).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("450");
    tree.unmount();
  });
});
