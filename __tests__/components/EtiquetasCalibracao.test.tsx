// ============================================================
// Etiquetas — calibração da impressora na aba (13/10/2026, Divina D'Lux).
//
// Trava: o cartão (modo contínuo, passo, deslocamento vertical, linha de
// teste) só aparece nos modelos com vão entre linhas; os ajustes ficam no
// navegador por empresa; a linha de teste e a impressão levam os ajustes; e
// a pré-visualização abre sem imprimir.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja", trade_name: "Divina D'Lux" }, token: "t" }) }));
jest.mock("@/services/api", () => ({ companiesApi: {}, pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})) } }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));

import { PrintLabels } from "@/components/PrintLabels";

const PRODUTOS: any[] = [
  { id: "p1", name: "Blusa Canelada", code: "001", barcode: "7891033948208", category: "Blusas", price: 59.9, stock: 4, unit: "un", size: "", color: "" },
];

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const aperta = (t: renderer.ReactTestRenderer, id: string) => act(() => { acha(t, id)[0].props.onPress(); });

// A página de impressão vai num Blob; guarda o HTML para o teste ler.
let htmlsAbertos: string[] = [];
const BlobDeVerdade = global.Blob;
beforeEach(() => {
  window.localStorage.clear();
  htmlsAbertos = [];
  (global as any).Blob = function (partes: any[]) { htmlsAbertos.push(String(partes[0])); return {}; };
  (URL as any).createObjectURL = jest.fn(() => "blob:teste");
  window.open = jest.fn(() => ({} as any));
});
afterAll(() => { (global as any).Blob = BlobDeVerdade; });

function monta(modelo: string | null, selecionados: string[] = []) {
  if (modelo) window.localStorage.setItem("aura_label_print_size", modelo);
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={PRODUTOS} selectedIds={selecionados} onSelectionChange={() => {}} />); });
  return t;
}

test("modelo colado (33x21 da Finesse) e bobina 58mm não mostram o cartão de calibração", () => {
  const t = monta(null);
  expect(acha(t, "etiquetas-calibracao")).toHaveLength(0);
  t.unmount();
  const t2 = monta("58mm");
  expect(acha(t2, "etiquetas-calibracao")).toHaveLength(0);
  t2.unmount();
});

test("modelo com vão: cartão com o modo contínuo desligado, a ajuda e o passo padrão", () => {
  const t = monta("105x21");
  expect(acha(t, "etiquetas-calibracao")).toHaveLength(1);
  const texto = flatten(t.toJSON());
  expect(texto).toContain("Minha impressora está em modo contínuo");
  expect(texto).toContain("Use o modo contínuo quando a impressora estiver configurada como mídia contínua e o avanço entre linhas sair errado (ex.: Elgin L42 Pro)");
  expect(acha(t, "etiquetas-modo-continuo")[0].props.accessibilityState).toEqual({ checked: false });
  expect(flatten(acha(t, "etiquetas-passo-valor")[0].props.children)).toBe("23,5 mm");
  expect(flatten(acha(t, "etiquetas-desloc-vertical-valor")[0].props.children)).toBe("0,0 mm");
  expect(acha(t, "etiquetas-calibracao-restaurar")).toHaveLength(0);
  expect(window.localStorage.getItem("aura_label_printer_empresa-1")).toBeNull();
  t.unmount();
});

test("ajustes ficam guardados no navegador por empresa e voltam ao reabrir", () => {
  const t = monta("105x21");
  aperta(t, "etiquetas-modo-continuo");
  aperta(t, "etiquetas-passo-menos");
  aperta(t, "etiquetas-passo-menos");
  aperta(t, "etiquetas-desloc-vertical-mais");
  expect(JSON.parse(window.localStorage.getItem("aura_label_printer_empresa-1")!)).toEqual({ "105x21": { continuous: true, rowPitchMm: 23.3, offsetYMm: 0.1 } });
  t.unmount();

  const t2 = monta("105x21");
  expect(acha(t2, "etiquetas-modo-continuo")[0].props.accessibilityState).toEqual({ checked: true });
  expect(flatten(acha(t2, "etiquetas-passo-valor")[0].props.children)).toBe("23,3 mm");
  aperta(t2, "etiquetas-calibracao-restaurar");
  expect(window.localStorage.getItem("aura_label_printer_empresa-1")).toBeNull();
  expect(flatten(acha(t2, "etiquetas-passo-valor")[0].props.children)).toBe("23,5 mm");
  t2.unmount();
});

test("linha de teste abre 3 etiquetas de exemplo com os ajustes; 2 linhas no contínuo = uma página de 2 passos", () => {
  const t = monta("105x21");
  aperta(t, "etiquetas-linha-de-teste");
  expect(htmlsAbertos).toHaveLength(1);
  expect((htmlsAbertos[0].match(/<td class="cell">/g) || []).length).toBe(3);
  expect(htmlsAbertos[0]).toContain("@page{margin:0;size:105mm 23.5mm}");
  expect(htmlsAbertos[0]).toContain(".cell{background-image:");
  expect(htmlsAbertos[0]).toContain("DIVINA D'LUX");

  aperta(t, "etiquetas-modo-continuo");
  aperta(t, "etiquetas-passo-menos");
  aperta(t, "etiquetas-duas-linhas-de-teste");
  expect(htmlsAbertos[1]).toContain("@page{margin:0;size:105mm 46.8mm}");
  expect((htmlsAbertos[1].match(/<tr>/g) || []).length).toBe(2);
  t.unmount();
});

test("'Ver em tamanho real' abre a prévia sem imprimir; Fechar fecha; Imprimir abre a página de impressão", () => {
  const t = monta("105x21", ["p1"]);
  expect(acha(t, "etiquetas-previa")).toHaveLength(0);
  aperta(t, "etiquetas-ver-tamanho-real");
  expect(acha(t, "etiquetas-previa")).toHaveLength(1);
  expect(htmlsAbertos).toHaveLength(0);
  const frame = t.root.findAll((n) => n.type === "iframe")[0];
  expect(frame.props.srcDoc).toContain(".pv-page{");
  expect(frame.props.srcDoc).toContain('data-code="7891033948208"');
  // largura em px = (105mm da página + 10mm de régua + 6mm de folga) a 96 px/pol
  expect(frame.props.style.width).toBe(Math.ceil((121 * 96) / 25.4));
  expect(flatten(t.toJSON())).toContain("Página de 105 × 23,5 mm");

  aperta(t, "etiquetas-previa-fechar");
  expect(acha(t, "etiquetas-previa")).toHaveLength(0);

  aperta(t, "etiquetas-ver-tamanho-real");
  aperta(t, "etiquetas-previa-imprimir");
  expect(acha(t, "etiquetas-previa")).toHaveLength(0);
  expect(htmlsAbertos).toHaveLength(1);
  expect(htmlsAbertos[0]).not.toContain(".pv-page{");
  expect(htmlsAbertos[0]).not.toContain(".cell{background-image:");
  t.unmount();
});

test("modelo da Finesse: a prévia existe, e a impressão não leva nenhuma opção nova", () => {
  // Calibração de OUTRO modelo salva no navegador não vaza para o 99x21.
  window.localStorage.setItem("aura_label_printer_empresa-1", JSON.stringify({ "105x21": { continuous: true, rowPitchMm: 23, offsetYMm: 1 }, "99x21": { continuous: true, rowPitchMm: 20, offsetYMm: 1 } }));
  const t = monta(null, ["p1"]);
  expect(acha(t, "etiquetas-ver-tamanho-real")).toHaveLength(1);
  const imprimir = t.root.findAll((n) => n.props && n.props.onPress && flatten(n.children).startsWith("Imprimir 1 etiqueta"), { deep: false })[0];
  act(() => { imprimir.props.onPress(); });
  expect(htmlsAbertos).toHaveLength(1);
  expect(htmlsAbertos[0]).toContain("@page{margin:0;size:99mm 21mm}");
  expect(htmlsAbertos[0]).toContain("table-layout:fixed}tr{height:21mm;page-break-inside:avoid}");
  expect(htmlsAbertos[0]).not.toContain("tr:last-child");
  expect(flatten(t.toJSON())).toContain("papel 99x21mm, Margens: Nenhuma");
  t.unmount();
});
