// ============================================================
// DanfeImportModal — INC-2026-10-15-01 (15/10/2026)
//
// A loja Geisiane importou 397 produtos por XML e todos ficaram com custo 0
// e estoque 0: o modal mandava `cost`/`stock`, o backend lê `cost_price` e
// `stock_qty`. Este arquivo segura:
//  1. o corpo de criação leva cost_price e stock_qty com os valores da linha
//     (inclusive depois de aplicar margem, que só mexe no preço de venda);
//  2. a categoria nasce vazia (nada de "Calçados" fixo) e "aplicar categoria
//     às linhas selecionadas" usa as categorias DA LOJA, só nas selecionadas;
//  3. a troca linha a linha continua;
//  4. o resumo conta falhas ("X importados, Y com erro").
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s, absoluteFillObject: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
}));
jest.mock("@/constants/colors", () => ({
  Colors: { ink: "#111", ink3: "#666", violet: "#7c3aed", violet3: "#a78bfa" },
  IS_DARK_MODE: false,
}));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: false }, isLoading: false, error: null, invalidate: jest.fn() }),
}));

const mockCategorias = { categories: [{ id: "c1", name: "Ferragens" }, { id: "c2", name: "Tintas" }], total: 2, type: "product" };
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => ({
    data: opts.queryKey[0] === "product-categories" ? mockCategorias : undefined,
  }),
}));

const mockCreateProduct = jest.fn((..._a: any[]) => Promise.resolve({ id: "prod-novo" }));
jest.mock("@/services/api", () => ({
  companiesApi: {
    products: jest.fn(),
    productCategories: jest.fn(),
    updateProduct: jest.fn(),
    createProduct: (...a: any[]) => mockCreateProduct(...a),
  },
}));
jest.mock("@/services/matconApi", () => ({
  matconApi: { registerPurchaseReceipt: jest.fn(), createLot: jest.fn() },
}));

import { DanfeImportModal } from "@/components/screens/estoque/DanfeImportModal";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>
  <ide><nNF>501</nNF></ide>
  <emit><CNPJ>11111111000111</CNPJ><xNome>Fornecedor Teste</xNome></emit>
  <det nItem="1"><prod><xProd>Martelo 500g</xProd><NCM>82052000</NCM><qCom>12</qCom><vUnCom>25.00</vUnCom><vProd>300.00</vProd></prod></det>
  <det nItem="2"><prod><xProd>Tinta Branca 18L</xProd><NCM>32091000</NCM><qCom>3</qCom><vUnCom>199.90</vUnCom><vProd>599.70</vProd></prod></det>
  <det nItem="3"><prod><xProd>Parafuso 6mm</xProd><NCM>73181500</NCM><qCom>100</qCom><vUnCom>0.35</vUnCom><vProd>35.00</vProd></prod></det>
</infNFe></NFe></nfeProc>`;

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

async function flush(fn: () => void) {
  await act(async () => { fn(); for (let i = 0; i < 10; i++) await Promise.resolve(); });
}

function one(t: renderer.ReactTestRenderer, testID: string) {
  return t.root.findAllByProps({ testID }, { deep: false })[0];
}

async function montar() {
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(<DanfeImportModal visible companyId="loja-9" onClose={jest.fn()} onSuccess={jest.fn()} />);
  });
  const input = t.root.findByType("input" as any);
  await act(async () => {
    input.props.onChange({ target: { files: [new File([XML], "nota.xml", { type: "text/xml" })] } });
    await new Promise((r) => setTimeout(r, 30));
  });
  return t;
}

// Botão de margem ("100%") do bloco "Aplicar margem".
function botaoMargem(t: renderer.ReactTestRenderer, rotulo: string) {
  return t.root.findAll((n: any) => {
    if (n.type !== "Pressable") return false;
    const txt = n.findAllByType("Text" as any)[0];
    return !!txt && flattenText(txt.props.children) === rotulo;
  })[0];
}

// Checkbox de cada linha (o "todos" do cabeçalho usa o estilo num array).
function checks(t: renderer.ReactTestRenderer) {
  return t.root.findAll((n: any) => n.type === "Pressable" && n.props.style && n.props.style.width === 36);
}

// <select> de categoria de cada linha.
function selectsDeCategoria(t: renderer.ReactTestRenderer) {
  return t.root.findAllByType("select" as any);
}

const importar = (t: renderer.ReactTestRenderer) => flush(() => one(t, "danfe-importar").props.onPress());

beforeEach(() => {
  mockCreateProduct.mockReset();
  mockCreateProduct.mockImplementation(() => Promise.resolve({ id: "prod-novo" }));
});

describe("DanfeImportModal → corpo de criação do produto", () => {
  it("manda cost_price e stock_qty com os valores da linha (e não cost/stock)", async () => {
    const t = await montar();
    await importar(t);

    expect(mockCreateProduct).toHaveBeenCalledTimes(3);
    expect(mockCreateProduct).toHaveBeenNthCalledWith(1, "loja-9", {
      name: "Martelo 500g", price: 25, cost_price: 25, ncm: "82052000", color: null, category: null, stock_qty: 12,
    });
    expect(mockCreateProduct).toHaveBeenNthCalledWith(2, "loja-9", expect.objectContaining({ cost_price: 199.9, stock_qty: 3 }));
    expect(mockCreateProduct).toHaveBeenNthCalledWith(3, "loja-9", expect.objectContaining({ cost_price: 0.35, stock_qty: 100 }));
    for (const [, corpo] of mockCreateProduct.mock.calls as any[]) {
      expect(corpo).not.toHaveProperty("cost");
      expect(corpo).not.toHaveProperty("stock");
    }
  });

  it("depois de aplicar margem o preço de venda muda, custo e estoque seguem os da nota", async () => {
    const t = await montar();
    await flush(() => botaoMargem(t, "100%").props.onPress());
    await importar(t);

    expect(mockCreateProduct).toHaveBeenNthCalledWith(1, "loja-9", expect.objectContaining({ price: 50, cost_price: 25, stock_qty: 12 }));
    expect(mockCreateProduct).toHaveBeenNthCalledWith(2, "loja-9", expect.objectContaining({ price: 399.8, cost_price: 199.9, stock_qty: 3 }));
  });
});

describe("DanfeImportModal → categoria", () => {
  it("nasce sem categoria: nada de Calçados fixo na tela nem no corpo enviado", async () => {
    const t = await montar();
    expect(JSON.stringify(t.toJSON())).not.toContain("Calçados");
    expect(selectsDeCategoria(t)).toHaveLength(3);
    selectsDeCategoria(t).forEach((sel: any) => expect(sel.props.value).toBe(""));

    await importar(t);
    for (const [, corpo] of mockCreateProduct.mock.calls as any[]) expect(corpo.category).toBeNull();
  });

  it("as opções são as categorias da loja (não a lista fixa)", async () => {
    const t = await montar();
    const valores = selectsDeCategoria(t)[0].findAllByType("option" as any).map((o: any) => o.props.value);
    expect(valores).toEqual(["", "Ferragens", "Tintas"]);
    expect(JSON.stringify(t.toJSON())).not.toContain("Bolsas");
  });

  it("aplicar categoria em massa vale só para as linhas selecionadas", async () => {
    const t = await montar();
    await flush(() => checks(t)[2].props.onPress()); // desmarca o parafuso
    await flush(() => one(t, "danfe-categoria-massa-Ferragens").props.onPress());

    expect(selectsDeCategoria(t).map((sel: any) => sel.props.value)).toEqual(["Ferragens", "Ferragens", ""]);

    await importar(t);
    expect(mockCreateProduct).toHaveBeenCalledTimes(2);
    expect(mockCreateProduct).toHaveBeenNthCalledWith(1, "loja-9", expect.objectContaining({ category: "Ferragens" }));
    expect(mockCreateProduct).toHaveBeenNthCalledWith(2, "loja-9", expect.objectContaining({ category: "Ferragens" }));
  });

  it("a troca linha a linha continua depois do aplicar em massa", async () => {
    const t = await montar();
    await flush(() => one(t, "danfe-categoria-massa-Ferragens").props.onPress());
    await flush(() => selectsDeCategoria(t)[1].props.onChange({ target: { value: "Tintas" } }));
    await importar(t);

    const categorias = (mockCreateProduct.mock.calls as any[]).map(([, corpo]) => corpo.category);
    expect(categorias).toEqual(["Ferragens", "Tintas", "Ferragens"]);
  });
});

describe("DanfeImportModal → resumo com falhas", () => {
  it("sem erro: texto de sempre", async () => {
    const t = await montar();
    await importar(t);
    const tudo = flattenText(t.toJSON());
    expect(tudo).toContain("3 produtos importados");
    expect(tudo).not.toContain("com erro");
    expect(tudo).toContain("O estoque foi atualizado com sucesso.");
  });

  it("um item que falha é contado: 2 importados, 1 com erro", async () => {
    mockCreateProduct
      .mockImplementationOnce(() => Promise.resolve({ id: "a" }))
      .mockImplementationOnce(() => Promise.reject(new Error("500")))
      .mockImplementationOnce(() => Promise.resolve({ id: "c" }));
    const t = await montar();
    await importar(t);
    const tudo = flattenText(t.toJSON());
    expect(tudo).toContain("2 produtos importados, 1 com erro");
    expect(tudo).not.toContain("O estoque foi atualizado com sucesso.");
    expect(tudo).toContain("não foram cadastrados");
  });

  it("tudo falhando: 0 importados, 3 com erro", async () => {
    mockCreateProduct.mockImplementation(() => Promise.reject(new Error("fora do ar")));
    const t = await montar();
    await importar(t);
    expect(flattenText(t.toJSON())).toContain("0 produtos importados, 3 com erro");
  });
});
