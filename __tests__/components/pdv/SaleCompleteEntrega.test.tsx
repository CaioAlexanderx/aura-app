// ============================================================
// Tela final da venda: a caixinha "Imprimir papel de entrega" (09/11/2026,
// parte 2 — mockup "Entrega no Caixa", F).
//   - com frete e endereço: aparece MARCADA e o botão vira "Imprimir cupom
//     e entrega";
//   - sem frete, cliente com endereço: aparece DESMARCADA;
//   - sem endereço: a tela é a de hoje ("Imprimir cupom");
//   - imprimir abre UM pop-up só: bobina = a rota do cupom com ?entrega=1;
//     A4 = o cupom e o papel encadeados na mesma janela;
//   - desmarcada, o cupom é pedido na rota de sempre, sem parâmetro.
// printWindow é o de verdade: window.open é contado.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api" }));
jest.mock("@/components/screens/pdv/NfceActions", () => ({ NfceActions: () => null }));
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/components/screens/pdv/WarrantySaleActions", () => ({ WarrantySaleActions: () => null }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));
jest.mock("@/utils/clipboard", () => ({ copyText: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
// O vale-troca é outro assunto: aqui o cupom passa intacto.
jest.mock("@/utils/valeTrocaCupom", () => ({ cupomComVale: (html: string) => html }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import type { SaleResult } from "@/hooks/useCart";
import { ENDERECO_VAZIO, type Endereco } from "@/components/endereco/endereco";
import { CHAVE_DO_FORMATO } from "@/utils/entregaDaVenda";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
const porId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const texto = (tree: renderer.ReactTestRenderer, id: string) => {
  const a = porId(tree, id);
  return a.length ? flattenText(a[0].children) : "";
};

const END: Endereco = {
  ...ENDERECO_VAZIO, zip: "01310100", street: "Av. Paulista", number: "1000",
  neighborhood: "Bela Vista", city: "São Paulo", state: "SP",
};
const VENDA: SaleResult = {
  id: "venda-214", saleNumber: 214, total: 189.9, payment: "pix",
  items: [{ productId: "p1", name: "Vestido", price: 174.9, qty: 1 }],
  date: "09/11/2026", subtotal: 189.9, discount: 0,
  customerId: "c1", customerName: "Cliente Teste",
};
const COM_FRETE: SaleResult = { ...VENDA, frete: 15, entrega: END };

function montar(sale: SaleResult, extra: Record<string, any> = {}) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<SaleComplete sale={sale} onNewSale={jest.fn()} {...extra} />); });
  return tree;
}

let opens: number;
let urls: string[];
let janela: any;
const BlobDeVerdade = (global as any).Blob;
afterEach(() => { (global as any).Blob = BlobDeVerdade; });
beforeEach(() => {
  try { localStorage.clear(); } catch {}
  opens = 0;
  urls = [];
  janela = { document: { open: jest.fn(), write: jest.fn(), close: jest.fn() }, location: { href: "" }, close: jest.fn() };
  (window as any).open = jest.fn(() => { opens++; return janela; });
  (global as any).fetch = jest.fn((url: string) => {
    urls.push(url);
    const html = url.includes("/print/delivery/") ? "<html><body>PAPEL A4</body></html>" : "<html><body>CUPOM\n</body></html>";
    return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
  });
  (URL as any).createObjectURL = jest.fn(() => "blob:http://app/" + Math.random().toString(36).slice(2));
  (URL as any).revokeObjectURL = jest.fn();
});

async function imprimir(tree: renderer.ReactTestRenderer) {
  await act(async () => {
    porId(tree, "venda-imprimir")[0].props.onPress();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

describe("caixinha do papel de entrega", () => {
  test("com frete: aparece marcada, linha 'Entrega' e o botão 'Imprimir cupom e entrega'", () => {
    const tree = montar(COM_FRETE);
    const caixa = porId(tree, "venda-papel-caixinha")[0];
    expect(caixa.props.accessibilityState).toEqual({ checked: true });
    expect(texto(tree, "venda-entrega")).toBe("Av. Paulista, 1000 · Bela Vista");
    expect(texto(tree, "venda-imprimir")).toBe("Imprimir cupom e entrega");
    tree.unmount();
  });

  test("sem frete, cliente com endereço: aparece desmarcada e o botão é o de sempre", () => {
    const tree = montar(VENDA, { enderecoDoCliente: END });
    expect(porId(tree, "venda-papel-caixinha")[0].props.accessibilityState).toEqual({ checked: false });
    expect(texto(tree, "venda-imprimir")).toBe("Imprimir cupom");
    act(() => { porId(tree, "venda-papel-caixinha")[0].props.onPress(); });
    expect(texto(tree, "venda-imprimir")).toBe("Imprimir cupom e entrega");
    tree.unmount();
  });

  test("sem endereço: sem caixinha, sem linha de entrega", () => {
    const tree = montar(VENDA, { enderecoDoCliente: null });
    expect(porId(tree, "venda-papel-entrega")).toHaveLength(0);
    expect(porId(tree, "venda-entrega")).toHaveLength(0);
    expect(texto(tree, "venda-imprimir")).toBe("Imprimir cupom");
    tree.unmount();
  });

  test("Bobina / A4 fica lembrado no computador", () => {
    const tree = montar(COM_FRETE);
    act(() => { porId(tree, "venda-papel-a4")[0].props.onPress(); });
    expect(localStorage.getItem(CHAVE_DO_FORMATO)).toBe("a4");
    tree.unmount();
    const outra = montar(COM_FRETE);
    expect(porId(outra, "venda-papel-a4")[0].props.accessibilityState).toEqual({ selected: true });
    outra.unmount();
  });
});

describe("imprimir: um pop-up só", () => {
  test("desmarcada: a rota de sempre, sem parâmetro", async () => {
    const tree = montar(VENDA, { enderecoDoCliente: END });
    await imprimir(tree);
    expect(opens).toBe(1);
    expect(urls).toEqual(["http://api/companies/empresa-1/print/receipt/venda-214/preview"]);
    tree.unmount();
  });

  test("bobina: cupom com ?entrega=1, uma janela", async () => {
    const tree = montar(COM_FRETE);
    await imprimir(tree);
    expect(opens).toBe(1);
    expect(urls).toEqual(["http://api/companies/empresa-1/print/receipt/venda-214/preview?entrega=1"]);
    expect(janela.location.href).toMatch(/^blob:/);
    tree.unmount();
  });

  test("A4: cupom de sempre + papel A4 encadeado na MESMA janela", async () => {
    const tree = montar(COM_FRETE);
    act(() => { porId(tree, "venda-papel-a4")[0].props.onPress(); });
    let blobs: any[] = [];
    (global as any).Blob = class { parts: any[]; constructor(p: any[]) { this.parts = p; blobs.push(this); } };
    await imprimir(tree);
    expect(opens).toBe(1);
    expect(urls).toEqual([
      "http://api/companies/empresa-1/print/receipt/venda-214/preview",
      "http://api/companies/empresa-1/print/delivery/venda-214?format=a4&autoprint=1",
    ]);
    // 1º blob: o papel A4; 2º: o cupom que, depois de imprimir, abre o papel.
    expect(blobs).toHaveLength(2);
    expect(String(blobs[0].parts[0])).toContain("PAPEL A4");
    const cupom = String(blobs[1].parts[0]);
    expect(cupom).toContain("CUPOM");
    expect(cupom).toContain('addEventListener("afterprint"');
    tree.unmount();
  });

  test("caixinha desmarcada numa venda com frete: só o cupom de sempre", async () => {
    const tree = montar(COM_FRETE);
    act(() => { porId(tree, "venda-papel-caixinha")[0].props.onPress(); });
    expect(texto(tree, "venda-imprimir")).toBe("Imprimir cupom");
    await imprimir(tree);
    expect(opens).toBe(1);
    expect(urls).toEqual(["http://api/companies/empresa-1/print/receipt/venda-214/preview"]);
    tree.unmount();
  });
});
