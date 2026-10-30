// ============================================================
// Etiquetas — produto sem código, Gerar código e aviso de marcados fora
// da lista (30/10/2026, card p-75; backend p-74).
//
// · "Sem código" no lugar do '---', fora do "Marcar todos";
// · Gerar código (um e todos), sempre com a PRÉVIA (dry_run) antes de guardar;
// · backend sem a rota (404): o botão não aparece;
// · "N marcados fora da lista por causa do filtro" com Mostrar.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja" }, token: "t" }) }));
const mockVariants = jest.fn();
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
  pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})), saveLabelConfig: jest.fn(() => Promise.resolve({})) },
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));

import { PrintLabels } from "@/components/PrintLabels";
import { toast as mockToast } from "@/components/Toast";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

// Como o useProducts entrega: sem SKU, code "---"; sem código de barras, "".
const COM: any = { id: "a", name: "Brinco argola", code: "221", barcode: "7891033948208", category: "Acessórios", price: 35, stock: 24, unit: "un", size: "", color: "" };
const SEM1: any = { id: "b", name: "Blusa cropped", code: "---", barcode: "", category: "Blusas", price: 69.9, stock: 9, unit: "un", size: "", color: "" };
const SEM2: any = { id: "c", name: "Short jeans", code: "---", barcode: "", category: "Shorts", price: 89.9, stock: 14, unit: "un", size: "", color: "" };
const SEM0: any = { id: "d", name: "Meia lisa", code: "---", barcode: "", category: "Meias", price: 12.9, stock: 0, unit: "un", size: "", color: "" };

let onSel: jest.Mock;
function Tela({ products }: { products: any[] }) {
  const [sel, setSel] = useState<string[]>([]);
  return <PrintLabels products={products} selectedIds={sel} onSelectionChange={(ids) => { onSel(ids); setSel(ids); }} />;
}
const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const aperta = (t: renderer.ReactTestRenderer, id: string) => act(() => { acha(t, id)[0].props.onPress(); });
const texto = (t: renderer.ReactTestRenderer) => flatten(t.toJSON());
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); }

const erro = (status: number) => Object.assign(new Error("x"), { status });
let rotaGerar: "existe" | "ausente" | "sem_permissao_ao_gravar";
let gerarChamadas: any[];
function backend() {
  mockRequest.mockImplementation((path: string, opts: any) => {
    if (path.includes("/barcodes/generate")) {
      if (rotaGerar === "ausente") return Promise.reject(erro(404));
      const body = opts.body;
      if (!body.targets.length) return Promise.reject(erro(400));
      gerarChamadas.push(body);
      if (!body.dry_run && rotaGerar === "sem_permissao_ao_gravar") return Promise.reject(erro(403));
      return Promise.resolve({
        dry_run: body.dry_run,
        items: body.targets.map((tg: any, i: number) => ({ ...tg, barcode: "210000000" + String(i + 1).padStart(3, "0") + "7" })),
        skipped: [],
      });
    }
    return Promise.resolve({ variants_by_product: {} });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  onSel = jest.fn();
  mockRequest.mockReset();
  mockVariants.mockReset();
  Object.values(mockToast as any).forEach((f: any) => f.mockReset());
  rotaGerar = "existe";
  gerarChamadas = [];
  backend();
});

test("'Sem código' no lugar do '---', sem marcar e fora do 'Marcar todos'", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM, SEM1]} />); });
  await flush();
  expect(flatten(acha(t, "etiquetas-sem-codigo-b")[0])).toBe("Sem código");
  expect(texto(t)).not.toContain("---");
  expect(flatten(acha(t, "etiquetas-aviso-sem-codigo")[0])).toContain("1 produto está sem código e não sai na etiqueta.");
  // Tocar no produto sem código não marca.
  aperta(t, "etiquetas-marcar-b");
  expect(onSel).not.toHaveBeenCalled();
  expect(acha(t, "etiquetas-marcar-b")[0].props.accessibilityState).toEqual({ checked: false, disabled: true });
  aperta(t, "etiquetas-marcar-todos");
  expect(onSel).toHaveBeenLastCalledWith(["a"]);
  // Tudo que dá para marcar já está marcado.
  expect(flatten(acha(t, "etiquetas-marcar-todos")[0])).toBe("Desmarcar todos");
  t.unmount();
});

test("backend sem a rota (404): 'Sem código' aparece, o botão Gerar código não", async () => {
  rotaGerar = "ausente";
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM, SEM1]} />); });
  await flush();
  expect(acha(t, "etiquetas-sem-codigo-b")).toHaveLength(1);
  expect(acha(t, "etiquetas-gerar-b")).toHaveLength(0);
  expect(acha(t, "etiquetas-gerar-todos")).toHaveLength(0);
  t.unmount();
});

test("loja sem produto sem código não pergunta nada ao backend", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM]} />); });
  await flush();
  expect(mockRequest.mock.calls.filter((c) => String(c[0]).includes("/barcodes/generate"))).toHaveLength(0);
  expect(acha(t, "etiquetas-aviso-sem-codigo")).toHaveLength(0);
  t.unmount();
});

test("Gerar código de um: prévia antes de guardar; depois o produto fica marcável", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM, SEM1]} />); });
  await flush();
  aperta(t, "etiquetas-gerar-b");
  await flush();
  expect(gerarChamadas[0]).toEqual({ targets: [{ product_id: "b", variant_id: null }], dry_run: true });
  const previa = flatten(acha(t, "etiquetas-previa-codigos")[0]);
  expect(previa).toContain("Antes de guardar, veja os códigos:");
  expect(previa).toContain("Blusa cropped");
  expect(previa).toContain("2100000000017");
  // Prévia não grava nada; ainda sem código.
  expect(acha(t, "etiquetas-sem-codigo-b")).toHaveLength(1);

  aperta(t, "etiquetas-gerar-guardar");
  await flush();
  expect(gerarChamadas[1]).toEqual({ targets: [{ product_id: "b", variant_id: null }], dry_run: false });
  expect(mockToast.success).toHaveBeenCalledWith("Código 2100000000017 guardado no cadastro de Blusa cropped.");
  expect(acha(t, "etiquetas-modal-codigo")).toHaveLength(0);
  expect(acha(t, "etiquetas-sem-codigo-b")).toHaveLength(0);
  expect(texto(t)).toContain("2100000000017");
  aperta(t, "etiquetas-marcar-b");
  expect(onSel).toHaveBeenLastCalledWith(["b"]);
  t.unmount();
});

test("Gerar código de todos: recomendado só os com estoque; 'todos' inclui os sem estoque", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM, SEM1, SEM2, SEM0]} />); });
  await flush();
  // A meia (sem estoque) nem aparece na lista com o interruptor ligado.
  expect(flatten(acha(t, "etiquetas-aviso-sem-codigo")[0])).toContain("2 produtos estão sem código");
  aperta(t, "etiquetas-gerar-todos");
  await flush();
  const modal = flatten(acha(t, "etiquetas-modal-codigo")[0]);
  expect(modal).toContain("Só os 2 com estoque");
  expect(modal).toContain("Todos os 3 sem código");
  expect(acha(t, "etiquetas-gerar-opcao-com")[0].props.accessibilityState).toEqual({ checked: true });
  expect(gerarChamadas[0].targets.map((x: any) => x.product_id)).toEqual(["b", "c"]);

  aperta(t, "etiquetas-gerar-opcao-todos");
  await flush();
  expect(gerarChamadas[1].targets.map((x: any) => x.product_id)).toEqual(["b", "c", "d"]);
  expect(gerarChamadas[1].dry_run).toBe(true);

  aperta(t, "etiquetas-gerar-guardar");
  await flush();
  expect(gerarChamadas[2]).toMatchObject({ dry_run: false });
  expect(gerarChamadas[2].targets).toHaveLength(3);
  expect(mockToast.success).toHaveBeenCalledWith("3 códigos gerados e guardados no cadastro.");
  expect(acha(t, "etiquetas-aviso-sem-codigo")).toHaveLength(0);
  t.unmount();
});

test("'Agora não' fecha sem gravar; sem permissão ao gravar, explica e some o botão", async () => {
  rotaGerar = "sem_permissao_ao_gravar";
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM, SEM1]} />); });
  await flush();
  aperta(t, "etiquetas-gerar-b");
  await flush();
  aperta(t, "etiquetas-gerar-agora-nao");
  expect(acha(t, "etiquetas-modal-codigo")).toHaveLength(0);
  expect(gerarChamadas.every((c) => c.dry_run)).toBe(true);

  aperta(t, "etiquetas-gerar-b");
  await flush();
  aperta(t, "etiquetas-gerar-guardar");
  await flush();
  expect(flatten(acha(t, "etiquetas-modal-codigo")[0])).toContain("Só quem pode editar produtos consegue gerar códigos.");
  expect(acha(t, "etiquetas-gerar-b")).toHaveLength(0);
  t.unmount();
});

test("marcados fora da lista por causa do filtro: aviso com Mostrar, e o total conta todos", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[COM, { ...SEM1, code: "300" }]} />); });
  await flush();
  aperta(t, "etiquetas-marcar-todos");
  expect(flatten(acha(t, "etiquetas-total")[0])).toBe("33 etiquetas");
  const busca = t.root.findAll((n) => n.props && n.props.placeholder === "Buscar por nome ou código", { deep: false })[0];
  act(() => { busca.props.onChangeText("Brinco"); });
  expect(flatten(acha(t, "etiquetas-aviso-fora-da-lista")[0])).toContain("1 produto marcado está fora da lista por causa do filtro. Eles entram no total.");
  expect(flatten(acha(t, "etiquetas-total")[0])).toBe("33 etiquetas");
  aperta(t, "etiquetas-mostrar-fora");
  expect(acha(t, "etiquetas-aviso-fora-da-lista")).toHaveLength(0);
  expect(texto(t)).toContain("Blusa cropped");
  // "Mostrar" não muda a escolha lembrada do interruptor.
  expect(window.localStorage.getItem("aura:etiquetas:so-com-estoque")).toBeNull();
  t.unmount();
});
