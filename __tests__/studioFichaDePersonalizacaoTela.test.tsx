// ============================================================
// Ficha de personalização redesenhada (29/09/2026) — o painel de verdade
// (StudioPersonalizacaoPanel) com a API e o motor em stub.
//
// Confere o que o mockup aprovado promete e o que se grava:
//   - produto novo nasce com arte obrigatória + nome opcional e o aviso;
//   - ligar "Verso" cria a linha do verso e o aviso de lado sem campo;
//   - "8,00" em "a mais" grava back_charge_enabled + back_price_delta;
//   - serviço de arte que segue a loja mostra o selo "padrão da loja";
//   - loja sem padrão: o Salvar também grava o padrão da loja;
//   - "Não salvo" vira "Salvo" depois de salvar;
//   - interruptor desligado mostra só ele.
// Receita de render: testID + findAllByProps(..., { deep: false }).
// ============================================================
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";

// O Icon avisa em __DEV__; o jest não define a global.
(global as any).__DEV__ = false;

// O Modal do react-native-web abre um portal no document, que o
// renderizador de teste não tem: aqui ele só passa os filhos adiante.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  const R = require("react");
  const Modal = ({ visible, children }: any) => (visible === false ? null : R.createElement(R.Fragment, null, children));
  return new Proxy(RN, { get: (alvo: any, k: string) => (k === "Modal" ? Modal : alvo[k]) });
});
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return { __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"), Polygon: stub("Polygon") };
});
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/studio/visualEngine/EnginePreview", () => ({
  EnginePreview: () => null,
  invalidateProductTemplate: jest.fn(),
}));
jest.mock("@/components/studio/mockupPorProduto/MiniaturaDoModelo", () => ({ MiniaturaDoModelo: () => null }));
jest.mock("@/components/studio/mockupPorProduto/useSpecsDosModelos", () => ({ useSpecsDosModelos: () => ({}) }));
jest.mock("@/components/studio/mockupPorProduto/regras", () => ({ metaDoModelo: () => "Frente e costas" }));
jest.mock("@/components/studio/PreviewWhatsAppModal", () => ({ PreviewWhatsAppModal: () => null }));
jest.mock("@/components/studio/EscolherDaGaleriaModal", () => ({ EscolherDaGaleriaModal: () => null }));
jest.mock("@/components/studio/MockupNaFotoSecao", () => ({ MockupNaFotoSecao: () => null }));

const mockGet = jest.fn();
const mockSave = jest.fn();
const mockToggle = jest.fn();
const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    getCustomizationConfig: (...a: any[]) => mockGet(...a),
    saveCustomizationConfig: (...a: any[]) => mockSave(...a),
    togglePersonalizable: (...a: any[]) => mockToggle(...a),
    suggestTemplates: jest.fn(),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    saveSettings: (...a: any[]) => mockSaveSettings(...a),
  },
}));
jest.mock("@/services/studioVisualApi", () => ({
  studioVisualApi: {
    getProductVisualTemplate: () => Promise.resolve({ product_id: "p1", visual_template_key: null, template: null }),
    listVisualTemplates: () => Promise.resolve({ templates: [], count: 0 }),
    setProductVisualTemplate: jest.fn(),
  },
}));

import { StudioPersonalizacaoPanel } from "@/components/studio/StudioPersonalizacaoPanel";
import { makeArtServiceFields } from "@/components/studio/customizationConfig";

let arvore: ReactTestRenderer;

async function esperar() {
  for (let i = 0; i < 4; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

async function montar(opts: { config: any; personalizavel?: boolean; settings?: any }) {
  mockGet.mockResolvedValue({
    product_id: "p1", name: "Camiseta", is_personalizable: opts.personalizavel ?? true, config: opts.config,
  });
  mockGetSettings.mockResolvedValue({ settings: opts.settings ?? {} });
  await act(async () => {
    arvore = create(
      <StudioPersonalizacaoPanel productId="p1" companyId="c1" productName="Camiseta" productPrice={59.9} slug="aura-qa" fotos={[]} />
    );
  });
  await esperar();
}

const todos = (testID: string) => arvore.root.findAllByProps({ testID }, { deep: false });
const um = (testID: string) => {
  const achados = todos(testID);
  if (achados.length !== 1) throw new Error(`testID ${testID}: ${achados.length} nós`);
  return achados[0];
};
const textoDe = (testID: string): string => {
  const c = um(testID).props.children;
  return Array.isArray(c) ? c.join("") : String(c);
};
// Componentes próprios (Interruptor, EntradaDecimal) recebem o testID e o
// repassam: o nó que interessa é o primeiro que tem o handler.
const comProp = (testID: string, prop: string) => {
  const achados = arvore.root.findAll((n) => n.props.testID === testID && n.props[prop] !== undefined, { deep: false });
  if (achados.length !== 1) throw new Error(`testID ${testID} com ${prop}: ${achados.length} nós`);
  return achados[0];
};
async function tocar(testID: string) {
  await act(async () => { comProp(testID, "onPress").props.onPress(); });
  await esperar();
}
async function digitar(testID: string, txt: string) {
  await act(async () => { comProp(testID, "onChangeText").props.onChangeText(txt); });
}

const CONFIGURADO = {
  print_area: { width_cm: 28, height_cm: 38, position: "center" },
  fields: [
    { id: "image", type: "image", label: "Sua arte", required: true, side: "front", config: {} },
    { id: "text", type: "text", label: "Nome na peça", required: false, side: "front", config: { max_chars: 30 } },
  ],
};

beforeEach(() => {
  mockGet.mockReset();
  mockSave.mockReset();
  mockToggle.mockReset();
  mockGetSettings.mockReset();
  mockSaveSettings.mockReset();
  mockSave.mockImplementation((_c: string, _p: string, cfg: any) =>
    Promise.resolve({ product_id: "p1", name: "Camiseta", is_personalizable: true, config: cfg }));
  mockSaveSettings.mockImplementation((_c: string, patch: any) => Promise.resolve({ settings: patch }));
});
afterEach(() => { act(() => { arvore?.unmount(); }); });

it("produto novo: arte obrigatória + nome opcional, o aviso, e 'Não salvo' vira 'Salvo'", async () => {
  await montar({ config: null });
  expect(todos("ficha-aviso-novo")).toHaveLength(1);
  expect(todos("ficha-campo-arte-front")).toHaveLength(1);
  expect(todos("ficha-campo-text")).toHaveLength(1);
  expect(todos("ficha-bloco-aparencia")).toHaveLength(1);
  expect(textoDe("ficha-status")).toBe("Não salvo · Frente: 2 campos");
  expect(um("ficha-salvar").props.disabled).toBe(false);

  await tocar("ficha-salvar");
  expect(mockSave).toHaveBeenCalledTimes(1);
  const [cid, pid, cfg] = mockSave.mock.calls[0];
  expect([cid, pid]).toEqual(["c1", "p1"]);
  const arte = cfg.fields.find((f: any) => f.id === "image");
  const nome = cfg.fields.find((f: any) => f.id === "text");
  expect(arte).toMatchObject({ type: "image", side: "front", required: true });
  expect(nome).toMatchObject({ type: "text", label: "Nome na peça", required: false });

  expect(textoDe("ficha-status")).toBe("Salvo · Frente: 2 campos");
  expect(um("ficha-salvar").props.disabled).toBe(true);
  expect(todos("ficha-aviso-novo")).toHaveLength(0);
});

it("produto já configurado abre salvo e sem o aviso de produto novo", async () => {
  await montar({ config: CONFIGURADO });
  expect(todos("ficha-aviso-novo")).toHaveLength(0);
  expect(textoDe("ficha-status")).toBe("Salvo · Frente: 2 campos");
  expect(um("ficha-salvar").props.disabled).toBe(true);
});

it("ligar 'Verso' cria a linha do verso e o aviso de lado sem campo; '8,00' em 'a mais' grava a cobrança", async () => {
  await montar({ config: CONFIGURADO });
  expect(todos("ficha-lado-back")).toHaveLength(0);

  await tocar("ficha-chip-lado-back");
  expect(todos("ficha-lado-back")).toHaveLength(1);
  expect(todos("verso-sem-campo")).toHaveLength(1);
  expect(textoDe("ficha-status")).toBe("Não salvo · Frente: 2 campos · Verso: 0 campos");

  await digitar("ficha-amais-back", "8,00");
  // O texto digitado fica como está (não vira "8").
  expect(comProp("ficha-amais-back", "value").props.value).toBe("8,00");

  await tocar("ficha-salvar");
  expect(mockSave).toHaveBeenCalledTimes(1);
  const cfg = mockSave.mock.calls[0][2];
  expect(cfg.has_back).toBe(true);
  expect(cfg.back_charge_enabled).toBe(true);
  expect(cfg.back_price_delta).toBe(8);
});

it("'a mais' vazio desliga a cobrança (o backend recusa delta 0 com a cobrança ligada)", async () => {
  await montar({
    config: {
      ...CONFIGURADO,
      has_back: true, back_print_area: { width_cm: 28, height_cm: 38, position: "center" },
      back_charge_enabled: true, back_price_delta: 5,
    },
  });
  expect(comProp("ficha-amais-back", "value").props.value).toBe("5,00");
  await digitar("ficha-amais-back", "");
  await tocar("ficha-salvar");
  const cfg = mockSave.mock.calls[0][2];
  expect(cfg.has_back).toBe(true);
  expect(cfg.back_charge_enabled).toBeUndefined();
  expect(cfg.back_price_delta).toBeUndefined();
});

it("serviço de arte que segue a loja: resumo com o selo 'padrão da loja'", async () => {
  await montar({
    config: { ...CONFIGURADO, art_service_use_store_default: true, fields: [...CONFIGURADO.fields, ...makeArtServiceFields(15, 40)] },
    settings: { art_service_defaults: { adjust_price: 15, design_price: 40 } },
  });
  expect(todos("ficha-servico-padrao-da-loja")).toHaveLength(1);
  expect(todos("ficha-servico-precos")).toHaveLength(0);

  // "Mudar só neste produto" abre os preços e grava a flag false.
  await tocar("ficha-servico-mudar-produto");
  expect(todos("ficha-servico-padrao-da-loja")).toHaveLength(0);
  expect(todos("ficha-servico-voltar-padrao")).toHaveLength(1);
  await digitar("ficha-servico-ajuste", "20,00");
  await tocar("ficha-salvar");
  const cfg = mockSave.mock.calls[0][2];
  expect(cfg.art_service_use_store_default).toBe(false);
  const choices = cfg.fields.find((f: any) => f.id === "art_service").config.choices;
  expect(choices.find((c: any) => c.value === "adjust").price_delta).toBe(20);
  expect(mockSaveSettings).not.toHaveBeenCalled();
});

it("loja ainda sem padrão: os valores do produto viram o padrão da loja ao salvar", async () => {
  await montar({
    config: { ...CONFIGURADO, fields: [...CONFIGURADO.fields, ...makeArtServiceFields(15, 40)] },
    settings: {},
  });
  expect(todos("ficha-servico-vira-padrao")).toHaveLength(1);
  await digitar("ficha-servico-criacao", "45");
  await tocar("ficha-salvar");
  expect(mockSaveSettings).toHaveBeenCalledWith("c1", { art_service_defaults: { adjust_price: 15, design_price: 45 } });
  const cfg = mockSave.mock.calls[0][2];
  expect(cfg.art_service_use_store_default).toBe(true);
  expect(todos("ficha-servico-padrao-da-loja")).toHaveLength(1);
});

it("interruptor desligado mostra só ele; ligar chama togglePersonalizable", async () => {
  mockToggle.mockResolvedValue({ product_id: "p1", is_personalizable: true });
  await montar({ config: CONFIGURADO, personalizavel: false });
  expect(todos("ficha-interruptor")).toHaveLength(1);
  expect(todos("ficha-bloco-aparencia")).toHaveLength(0);
  expect(todos("ficha-previa")).toHaveLength(0);
  expect(todos("ficha-salvar")).toHaveLength(0);

  await tocar("ficha-interruptor");
  expect(mockToggle).toHaveBeenCalledWith("c1", "p1", true);
  expect(todos("ficha-bloco-aparencia")).toHaveLength(1);
  expect(todos("ficha-previa")).toHaveLength(1);
});

it("arte da cliente: galeria ligada junta o campo template no mesmo cartão", async () => {
  await montar({ config: CONFIGURADO });
  await tocar("ficha-campo-arte-front-cab");
  await tocar("ficha-arte-galeria-front");
  expect(todos("ficha-campo-arte-front")).toHaveLength(1);
  expect(todos("ficha-escolher-da-galeria")).toHaveLength(1);
  // Não dá para desligar os dois: o arquivo sai, a galeria fica.
  await tocar("ficha-arte-arquivo-front");
  await tocar("ficha-arte-galeria-front");
  await tocar("ficha-salvar");
  const cfg = mockSave.mock.calls[0][2];
  const arte = cfg.fields.filter((f: any) => f.type === "image" || f.type === "template");
  expect(arte).toHaveLength(1);
  expect(arte[0]).toMatchObject({ id: "template", type: "template", required: true });
});
