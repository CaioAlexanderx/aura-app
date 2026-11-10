// ============================================================
// "Sai em" no cadastro do item (10/11/2026, migration 442 do backend)
// Decisão do dono, aprovada sem mockup: a nota é separada do tipo do item.
//
// O que estes testes seguram:
//   1. o seletor "Sai em" só aparece para quem emite NFS-e (produto e serviço);
//   2. o padrão marcado vem do tipo: produto → NFC-e, serviço → NFS-e;
//   3. Produto + NFS-e: a seção "Nota de serviço (NFS-e)" aparece e o estoque
//      continua o de sempre (campo na tela e quantidade no corpo);
//   4. o corpo: só a escolha diferente do tipo vai (notaFiscal); voltar ao
//      padrão na edição manda null; sem mexer, nada vai;
//   5. serviço com NFC-e: a seção NFS-e some.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/components/BarcodeQRSection", () => ({ BarcodeQRSection: () => null }));
jest.mock("@/components/catalog/CategoryTreePicker", () => ({ CategoryTreePicker: () => null }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: () => null }));

let mockEmiteNfse = true;
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    if (o.queryKey && o.queryKey[0] === "nfse-config" && o.enabled) {
      return { data: { config: { is_active: mockEmiteNfse }, has_config: true }, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
let mockAuth: any = { company: { id: "empresa-1" }, token: "t" };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
const mockAddProduct = jest.fn();
const mockUpdateProduct = jest.fn();
jest.mock("@/hooks/useProducts", () => {
  const real = jest.requireActual("@/hooks/useProducts");
  return {
    camposNfseDoCorpo: real.camposNfseDoCorpo,
    useProducts: () => ({ products: [], addProduct: mockAddProduct, updateProduct: mockUpdateProduct }),
  };
});
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));
jest.mock("@/services/api", () => ({
  companiesApi: { checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }) },
  request: jest.fn(),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: jest.fn(), list: jest.fn() } }));
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: jest.fn().mockResolvedValue({}) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));
jest.mock("@/hooks/useListaServicosNfse", () => {
  const m = jest.requireActual("@/constants/nfseListaServicos");
  const lista = { linhas: m.LISTA_SERVICOS_NACIONAL, itens: m.ITENS_DA_LISTA };
  return {
    carregarListaServicosNfse: () => Promise.resolve(lista),
    useListaServicosNfse: () => ({ lista, erro: false }),
  };
});

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { AJUDA_SAI_EM } from "@/utils/notaDoItem";

function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}
function porId(tree: any, id: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false })[0];
}
function tem(tree: any, id: string): boolean {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false }).length > 0;
}
function textoDe(node: any): string {
  return node.findAllByType(Text).map((t: any) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join("") : String(c ?? "");
  }).join(" ");
}
function botao(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && textoDe(n).indexOf(rotulo) >= 0)[0];
}
function inputPorPlaceholder(tree: any, ph: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.placeholder === ph && typeof n.props.onChangeText === "function")[0];
}
function campo(tree: any, id: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onChangeText === "function")[0];
}
/** A opção do "Sai em" (o Pressable com o testID). */
function opcao(tree: any, id: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && n.props.testID === id)[0];
}
/** O Radio marca a opção com o segundo estilo ([fr.rd, ativo && fr.rdAtivo]). */
function marcada(tree: any, id: string): boolean {
  return !!opcao(tree, id).props.style[1];
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
function preencherProduto(tree: any, estoque = "12") {
  act(() => { inputPorPlaceholder(tree, "Ex.: Vestido midi floral").props.onChangeText("Carimbo automático 38x14"); });
  const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
  act(() => { precos[0].props.onChangeText("4500"); });
  const qtd = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0" && n.props.keyboardType === "number-pad" && typeof n.props.onChangeText === "function");
  act(() => { qtd[0].props.onChangeText(estoque); });
}
function preencherServico(tree: any) {
  act(() => { inputPorPlaceholder(tree, "Ex.: Corte feminino, Manicure, Consultoria").props.onChangeText("Impressão de banner"); });
  const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
  act(() => { precos[0].props.onChangeText("8000"); });
}

const CARIMBO: any = {
  id: "p-1", name: "Carimbo automático", code: "CAR-1", barcode: "", category: "Produtos", price: 45,
  cost: 12, stock: 7, minStock: 2, unit: "un", brand: "", notes: "", color: "", size: "",
  nfseCtribnac: "130501", notaFiscal: "nfse", isGroupShared: false,
};

beforeEach(() => {
  mockAuth = { company: { id: "empresa-1" }, token: "t" };
  mockEmiteNfse = true;
  mockAddProduct.mockReset().mockResolvedValue({ id: "novo-1" });
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  (global as any).innerWidth = 1024;
});

describe("seletor 'Sai em' — só para quem emite NFS-e", () => {
  test("produto numa loja que emite: seletor com as duas opções, NFC-e marcada, ajuda curta", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    expect(tem(tree, "secao-sai-em")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("Cupom fiscal (NFC-e)");
    expect(t).toContain("Nota de serviço (NFS-e)");
    expect(t).toContain(AJUDA_SAI_EM);
    expect(marcada(tree, "sai-em-nfce")).toBe(true);
    expect(marcada(tree, "sai-em-nfse")).toBe(false);
    expect(tem(tree, "secao-nfse")).toBe(false);
    tree.unmount();
  });

  test("serviço numa loja que emite: NFS-e marcada e a seção da nota de serviço à vista", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    expect(marcada(tree, "sai-em-nfse")).toBe(true);
    expect(tem(tree, "secao-nfse")).toBe(true);
    tree.unmount();
  });

  test("loja que não emite: nem seletor nem campo no corpo (produto e serviço)", async () => {
    mockEmiteNfse = false;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    expect(tem(tree, "secao-sai-em")).toBe(false);
    preencherProduto(tree);
    await act(async () => { await botao(tree, "Salvar produto").props.onPress(); });
    expect(mockAddProduct.mock.calls[0][0].notaFiscal).toBeUndefined();
    tree.unmount();

    const t2 = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    expect(tem(t2, "secao-sai-em")).toBe(false);
    t2.unmount();
  });
});

describe("Produto + Nota de serviço", () => {
  test("escolher NFS-e mostra a seção; o estoque continua normal e vai no corpo", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    preencherProduto(tree, "12");
    act(() => { opcao(tree, "sai-em-nfse").props.onPress(); });
    expect(marcada(tree, "sai-em-nfse")).toBe(true);
    expect(tem(tree, "secao-nfse")).toBe(true);
    // o estoque do produto continua na tela
    expect(texto(tree)).toContain("Quantidade atual");
    act(() => { campo(tree, "nfse-codigo").props.onChangeText("130501"); });
    await act(async () => { await botao(tree, "Salvar produto").props.onPress(); });
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo).toMatchObject({ unit: "un", stock: 12, notaFiscal: "nfse", nfseCtribnac: "130501" });
    tree.unmount();
  });

  test("produto que fica no cupom fiscal: nada de nota no corpo (o padrão não é gravado)", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    preencherProduto(tree);
    await act(async () => { await botao(tree, "Salvar produto").props.onPress(); });
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo.notaFiscal).toBeUndefined();
    expect("nfseCtribnac" in corpo).toBe(false);
    tree.unmount();
  });

  test("edição do carimbo: semeia NFS-e e o código; sem mexer, a nota não vai no corpo", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CARIMBO} />);
    expect(marcada(tree, "sai-em-nfse")).toBe(true);
    expect(tem(tree, "secao-nfse")).toBe(true);
    expect(campo(tree, "nfse-codigo").props.value).toBe("13.05.01");
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    const corpo = mockUpdateProduct.mock.calls[0][0];
    expect(corpo.notaFiscal).toBeUndefined();
    expect(corpo.stock).toBe(7);
    tree.unmount();
  });

  test("edição: voltar para o cupom fiscal manda null (volta a seguir o tipo) e tira a seção", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CARIMBO} />);
    act(() => { opcao(tree, "sai-em-nfce").props.onPress(); });
    expect(tem(tree, "secao-nfse")).toBe(false);
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    const corpo = mockUpdateProduct.mock.calls[0][0];
    expect(corpo.notaFiscal).toBeNull();
    expect("nfseCtribnac" in corpo).toBe(false);
    tree.unmount();
  });
});

describe("Serviço + Cupom fiscal", () => {
  test("escolher NFC-e tira a seção da NFS-e e grava a escolha", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    preencherServico(tree);
    act(() => { opcao(tree, "sai-em-nfce").props.onPress(); });
    expect(tem(tree, "secao-nfse")).toBe(false);
    await act(async () => { await botao(tree, "Salvar serviço").props.onPress(); });
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo).toMatchObject({ unit: "srv", notaFiscal: "nfce" });
    tree.unmount();
  });
});
