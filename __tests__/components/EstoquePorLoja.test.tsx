// ============================================================
// Estoque consolidado · Por loja (10/11/2026) + histórico de transferências.
//
//   1. Largo: tabela com uma coluna por loja e o total.
//   2. 375 px: cartões com chips "Loja A: 12 · Loja B: 3".
//   3. Produto com grade abre o detalhe por variante (rótulo × lojas),
//      em tabela no largo e em cartões no estreito.
//   4. Busca vai ao backend; paginação.
//   5. Transferências: lista (data, origem → destino, peças) e detalhe.
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

var mockLargura = 1280;
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: mockLargura, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: true }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));

const mockPorLoja = jest.fn();
const mockVariantes = jest.fn();
const mockHistorico = jest.fn();
jest.mock("@/services/estoqueTransferenciasApi", () => ({
  estoqueTransferenciasApi: {
    porLoja: (...a: any[]) => mockPorLoja(...a),
    variantesPorLoja: (...a: any[]) => mockVariantes(...a),
    historico: (...a: any[]) => mockHistorico(...a),
  },
}));

import { EstoquePorLoja } from "@/components/screens/estoque/transferencia/EstoquePorLoja";
import { TransferenciasModal } from "@/components/screens/estoque/transferencia/TransferenciasModal";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function um(tree: renderer.ReactTestRenderer, id: string) {
  const nos = porTestID(tree, id);
  expect(nos.length).toBeGreaterThan(0);
  return nos[0];
}
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  return porTestID(tree, id).map((n) => flattenText(n.children)).join("");
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}

const LOJAS = [{ id: "c1", nome: "Centro" }, { id: "c2", nome: "Shopping" }];
const RESPOSTA = {
  lojas: LOJAS,
  itens: [
    {
      chave: "k-vestido", nome: "Vestido midi", sku: "VM-1", barcode: null, imagem_url: null, preco: 189.9,
      por_loja: [{ company_id: "c1", product_id: "p1", estoque: 12 }, { company_id: "c2", product_id: "p8", estoque: 3 }],
      total: 15, tem_variantes: true,
    },
    {
      chave: "k-cinto", nome: "Cinto", sku: null, barcode: "789", imagem_url: null, preco: 49,
      por_loja: [{ company_id: "c1", product_id: "p2", estoque: 4 }],
      total: 4, tem_variantes: false,
    },
  ],
  total_itens: 65,
};
const VARIANTES = {
  lojas: LOJAS,
  variantes: [
    { rotulo: "Azul · P", sku: "VM-1-AP", barcode: null, por_loja: [{ company_id: "c1", variant_id: "v1", estoque: 7 }, { company_id: "c2", variant_id: "v9", estoque: 1 }], total: 8 },
    { rotulo: "Azul · M", sku: null, barcode: null, por_loja: [{ company_id: "c1", variant_id: "v2", estoque: 5 }, { company_id: "c2", variant_id: "v8", estoque: 2 }], total: 7 },
  ],
};

async function montar() {
  let tree!: renderer.ReactTestRenderer;
  mockPorLoja.mockResolvedValue(RESPOSTA);
  await act(async () => { tree = renderer.create(<EstoquePorLoja />); });
  return tree;
}

beforeEach(() => {
  mockLargura = 1280;
  mockPorLoja.mockReset();
  mockVariantes.mockReset();
  mockHistorico.mockReset();
});

describe("por loja", () => {
  it("largo: uma coluna por loja e o total", async () => {
    const tree = await montar();
    expect(mockPorLoja).toHaveBeenCalledWith({ q: undefined, limit: 30, offset: 0 });
    expect(porTestID(tree, "por-loja-tabela")).toHaveLength(1);
    expect(porTestID(tree, "por-loja-cartoes")).toHaveLength(0);
    expect(textoDe(tree, "por-loja-col-c1")).toBe("Centro");
    expect(textoDe(tree, "por-loja-col-c2")).toBe("Shopping");
    expect(textoDe(tree, "por-loja-celula-k-vestido-c1")).toBe("12");
    expect(textoDe(tree, "por-loja-celula-k-vestido-c2")).toBe("3");
    expect(textoDe(tree, "por-loja-total-k-vestido")).toBe("15");
    // Produto que não existe na loja: traço, não zero.
    expect(textoDe(tree, "por-loja-celula-k-cinto-c2")).toBe("—");
    expect(porTestID(tree, "por-loja-variantes-k-vestido")).toHaveLength(1);
    expect(porTestID(tree, "por-loja-variantes-k-cinto")).toHaveLength(0);
  });

  it("375 px: cartões com chips por loja", async () => {
    mockLargura = 375;
    const tree = await montar();
    expect(porTestID(tree, "por-loja-tabela")).toHaveLength(0);
    expect(porTestID(tree, "por-loja-cartoes")).toHaveLength(1);
    expect(textoDe(tree, "por-loja-chip-k-vestido-0")).toBe("Centro: 12");
    expect(textoDe(tree, "por-loja-chip-k-vestido-1")).toBe("Shopping: 3");
    expect(textoDe(tree, "por-loja-chip-k-cinto-1")).toBe("Shopping: —");
    expect(textoDe(tree, "por-loja-total-k-vestido")).toBe("15");
  });

  it("detalhe de variantes no largo: rótulo × lojas", async () => {
    const tree = await montar();
    mockVariantes.mockResolvedValueOnce(VARIANTES);
    await tocar(tree, "por-loja-variantes-k-vestido");
    expect(mockVariantes).toHaveBeenCalledWith("k-vestido");
    expect(porTestID(tree, "por-loja-variantes-modal")).toHaveLength(1);
    expect(porTestID(tree, "por-loja-variantes-tabela")).toHaveLength(1);
    expect(textoDe(tree, "por-loja-variante-0")).toContain("Azul · P");
    expect(textoDe(tree, "por-loja-variante-0-c1")).toBe("7");
    expect(textoDe(tree, "por-loja-variante-1-c2")).toBe("2");
    await tocar(tree, "por-loja-variantes-x");
    expect(porTestID(tree, "por-loja-variantes-modal")).toHaveLength(0);
  });

  it("detalhe de variantes em 375 px: cartões com chips", async () => {
    mockLargura = 375;
    const tree = await montar();
    mockVariantes.mockResolvedValueOnce(VARIANTES);
    await tocar(tree, "por-loja-variantes-k-vestido");
    expect(porTestID(tree, "por-loja-variantes-cartoes")).toHaveLength(1);
    expect(textoDe(tree, "por-loja-variante-chip-1-0")).toBe("Centro: 5");
    expect(textoDe(tree, "por-loja-variante-chip-1-1")).toBe("Shopping: 2");
  });

  it("busca vai ao backend e a paginação pede a página seguinte", async () => {
    const tree = await montar();
    await act(async () => { um(tree, "por-loja-busca").props.onChangeText("vestido"); });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(mockPorLoja).toHaveBeenLastCalledWith({ q: "vestido", limit: 30, offset: 0 });
    // 65 itens / 30 por página: "Proxima" pede o offset 30.
    const proxima = tree.root.findAll((n) => typeof n.props.onPress === "function" && flattenText(n.children).includes("Proxima"), { deep: false });
    expect(proxima).toHaveLength(1);
    await act(async () => { proxima[0].props.onPress(); });
    expect(mockPorLoja).toHaveBeenLastCalledWith({ q: "vestido", limit: 30, offset: 30 });
  });

  it("erro em texto gentil", async () => {
    let tree!: renderer.ReactTestRenderer;
    mockPorLoja.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    await act(async () => { tree = renderer.create(<EstoquePorLoja />); });
    expect(textoDe(tree, "por-loja-erro")).toBe("Não conseguimos carregar o estoque por loja agora.");
  });
});

describe("histórico de transferências", () => {
  const T = {
    id: "t1", numero: 41, origem_company_id: "c1", destino_company_id: "c2", criada_em: "2026-11-10T14:05:00",
    itens: [
      { product_id: "p1", variant_id: "v1", destino_product_id: "q1", destino_variant_id: "w1", quantidade: 3, criado_no_destino: true, nome: "Vestido midi", rotulo: "Azul · P" },
      { product_id: "p2", variant_id: null, destino_product_id: "q2", destino_variant_id: null, quantidade: 2, criado_no_destino: false },
    ],
  };

  it("lista com data, origem → destino e peças; toque abre o detalhe", async () => {
    let tree!: renderer.ReactTestRenderer;
    mockHistorico.mockResolvedValueOnce({ transferencias: [T, { ...T, id: "t2", numero: 42, origem_company_id: "c2", destino_company_id: "c1", itens: undefined, total_pecas: 9 }], total: 2 });
    await act(async () => {
      tree = renderer.create(<TransferenciasModal companyId="c1" nomes={{ c1: "Centro", c2: "Shopping" }} onFechar={jest.fn()} />);
    });
    expect(mockHistorico).toHaveBeenCalledWith("c1", 20, 0);
    const primeira = textoDe(tree, "transferencias-item-t1");
    expect(primeira).toContain("Nº 41 · 10/11/2026 às 14:05");
    expect(primeira).toContain("Centro → Shopping");
    expect(primeira).toContain("5 peças · 2 itens");
    expect(primeira).toContain("Saiu");
    expect(textoDe(tree, "transferencias-item-t2")).toContain("9 peças");
    expect(textoDe(tree, "transferencias-item-t2")).toContain("Chegou");
    expect(porTestID(tree, "transferencias-mais")).toHaveLength(0);

    await tocar(tree, "transferencias-item-t1");
    const det = textoDe(tree, "transferencias-detalhe");
    expect(det).toContain("Transferência nº 41");
    expect(textoDe(tree, "transferencias-detalhe-item-0")).toContain("Vestido midi");
    expect(textoDe(tree, "transferencias-detalhe-item-0")).toContain("Azul · P");
    expect(textoDe(tree, "transferencias-detalhe-item-0")).toContain("Criado em Shopping");
    expect(textoDe(tree, "transferencias-detalhe-item-1")).toContain("Produto");
    await tocar(tree, "transferencias-voltar");
    expect(porTestID(tree, "transferencias-detalhe")).toHaveLength(0);
  });

  it("vazio e erro em texto gentil", async () => {
    let tree!: renderer.ReactTestRenderer;
    mockHistorico.mockResolvedValueOnce({ transferencias: [], total: 0 });
    await act(async () => { tree = renderer.create(<TransferenciasModal companyId="c1" nomes={{}} onFechar={jest.fn()} />); });
    expect(textoDe(tree, "transferencias-vazio")).toContain("Nenhuma transferência ainda");
    mockHistorico.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 404 }));
    await act(async () => { tree = renderer.create(<TransferenciasModal companyId="c9" nomes={{}} onFechar={jest.fn()} />); });
    expect(textoDe(tree, "transferencias-erro")).toContain("ainda não está disponível");
  });
});
