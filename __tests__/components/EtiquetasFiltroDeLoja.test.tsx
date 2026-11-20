// ============================================================
// INC-2026-11-18-01 — Etiquetas: filtro "Loja" e selo da loja dona.
//
// Lojista com matriz e filial: a lista mostrava os produtos das duas lojas
// sem dizer de qual era cada um. Agora, quando a lista mistura lojas:
//   · o filtro "Loja" aparece com "Todas as lojas" (padrão) + cada loja;
//   · cada produto mostra a loja dona;
//   · a escolha fica lembrada por empresa.
// Fora de grupo, nada aparece. A etiqueta impressa sai idêntica.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
let mockAuth: any = {};
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: jest.fn(() => Promise.resolve({ variants: [] })) },
  pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})), saveLabelConfig: jest.fn(() => Promise.resolve({})) },
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));

import { PrintLabels } from "@/components/PrintLabels";

const EMPRESAS = [
  { id: "loja-filial", trade_name: "Loja Filial", name: "Loja Filial" },
  { id: "loja-matriz", trade_name: "Loja Matriz", name: "Loja Matriz" },
];
const base = { category: "Blusas", price: 59.9, stock: 3, unit: "un", size: "", color: "", has_variants: false };
const DA_FILIAL: any = { ...base, id: "p1", name: "Blusa da filial", code: "1001", barcode: "7891033948208", lojaDonaId: "loja-filial" };
const DA_MATRIZ: any = { ...base, id: "p2", name: "Blusa da matriz", code: "1002", barcode: "7896004000012", lojaDonaId: "loja-matriz" };

function Tela({ products }: { products: any[] }) {
  const [sel, setSel] = useState<string[]>([]);
  return <PrintLabels products={products} selectedIds={sel} onSelectionChange={setSel} />;
}

const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
// O selo desenhado (a View com o nome); SeloDaLoja sem nome não desenha nada.
const selo = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id && typeof n.props.accessibilityLabel === "string", { deep: false });
const aperta = (t: renderer.ReactTestRenderer, id: string) => act(() => { acha(t, id)[0].props.onPress(); });
const html = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => n.props && typeof n.props.html === "string", { deep: false })[0]?.props.html as string | undefined;

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("aura:etiquetas:so-com-estoque", "0");
  mockAuth = { company: { id: "loja-filial", name: "Loja Filial" }, token: "t", availableCompanies: EMPRESAS };
});

test("fora de grupo: sem filtro e sem selo (tela de hoje)", () => {
  mockAuth = { company: { id: "loja-filial", name: "Loja Filial" }, token: "t" };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[{ ...DA_FILIAL, lojaDonaId: undefined }, { ...DA_MATRIZ, lojaDonaId: undefined }]} />); });
  expect(acha(t, "etiquetas-filtro-loja")).toHaveLength(0);
  expect(selo(t, "etiquetas-loja-do-p1")).toHaveLength(0);
  expect(acha(t, "etiquetas-marcar-p2")).toHaveLength(1);
  t.unmount();
});

test("grupo sem compartilhamento (tudo da própria loja): sem filtro", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, { ...DA_MATRIZ, lojaDonaId: "loja-filial" }]} />); });
  expect(acha(t, "etiquetas-filtro-loja")).toHaveLength(0);
  t.unmount();
});

test("lista mistura lojas: selo em cada produto, filtro com Todas as lojas por padrão", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, DA_MATRIZ]} />); });
  expect(acha(t, "etiquetas-filtro-loja")).toHaveLength(1);
  expect(acha(t, "etiquetas-loja-todas")[0].props.accessibilityState.selected).toBe(true);
  expect(selo(t, "etiquetas-loja-do-p1")[0].props.accessibilityLabel).toBe("Loja: Loja Filial");
  expect(selo(t, "etiquetas-loja-do-p2")[0].props.accessibilityLabel).toBe("Loja: Loja Matriz");
  expect(acha(t, "etiquetas-marcar-p1")).toHaveLength(1);
  expect(acha(t, "etiquetas-marcar-p2")).toHaveLength(1);
  t.unmount();
});

test("escolher a matriz mostra só os dela, e a escolha volta ao abrir de novo", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, DA_MATRIZ]} />); });
  aperta(t, "etiquetas-loja-loja-matriz");
  expect(acha(t, "etiquetas-marcar-p1")).toHaveLength(0);
  expect(acha(t, "etiquetas-marcar-p2")).toHaveLength(1);
  t.unmount();

  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, DA_MATRIZ]} />); });
  expect(acha(t, "etiquetas-loja-loja-matriz")[0].props.accessibilityState.selected).toBe(true);
  expect(acha(t, "etiquetas-marcar-p1")).toHaveLength(0);
  // Outra empresa não herda a escolha.
  t.unmount();
  mockAuth = { ...mockAuth, company: { id: "loja-matriz", name: "Loja Matriz" } };
  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, DA_MATRIZ]} />); });
  expect(acha(t, "etiquetas-loja-todas")[0].props.accessibilityState.selected).toBe(true);
  t.unmount();
});

test("marcado fora do filtro de loja: 'Mostrar' volta para Todas as lojas", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, DA_MATRIZ]} />); });
  aperta(t, "etiquetas-marcar-p1");
  aperta(t, "etiquetas-loja-loja-matriz");
  expect(acha(t, "etiquetas-aviso-fora-da-lista")).toHaveLength(1);
  aperta(t, "etiquetas-mostrar-fora");
  expect(acha(t, "etiquetas-loja-todas")[0].props.accessibilityState.selected).toBe(true);
  expect(acha(t, "etiquetas-marcar-p1")).toHaveLength(1);
  t.unmount();
});

test("a etiqueta impressa sai idêntica com e sem o contexto de lojas", () => {
  function previa(auth: any, produto: any) {
    mockAuth = auth;
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela products={[produto]} />); });
    aperta(t, "etiquetas-marcar-" + produto.id);
    aperta(t, "etiquetas-ver-tamanho-real");
    const h = html(t);
    t.unmount();
    return h;
  }
  const semGrupo = previa({ company: { id: "loja-filial", name: "Loja Filial" }, token: "t" }, { ...DA_MATRIZ, lojaDonaId: undefined });
  window.localStorage.setItem("aura:filtro-loja:etiquetas:loja-filial", "loja-matriz");
  mockAuth = { company: { id: "loja-filial", name: "Loja Filial" }, token: "t", availableCompanies: EMPRESAS };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[DA_FILIAL, DA_MATRIZ]} />); });
  aperta(t, "etiquetas-marcar-p2");
  aperta(t, "etiquetas-ver-tamanho-real");
  const comGrupo = html(t);
  t.unmount();
  expect(semGrupo).toBeTruthy();
  expect(comGrupo).toBe(semGrupo);
});
