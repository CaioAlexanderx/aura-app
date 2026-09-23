// ============================================================
// ItemFormModal — cadastro de produto por perfil (22/09/2026).
// Mockup aprovado: docs/mockups/matcon-cadastro-produto.html.
//
// O modal inteiro montado, com o que está em volta mockado:
//   1. NÃO VAZA: sem Matcon, nenhum rótulo nem exemplo do perfil Matcon
//      aparece — é o modal de antes;
//   2. Matcon: "Vendo por" antes do preço; ordem do celular (balcão antes
//      da vitrine); ficha com 4 campos; "Compro por" em un;
//   3. o Salvar grava weight_kg (peso), a marca e a 4ª linha da ficha em
//      `cuidados`; por lote, o produto nasce com o total e cada pilha vira
//      um lote;
//   4. lote × cor e medida pela unidade e pela config;
//   5. "Salvar e cadastrar outro" mantém categoria, unidade, "compro por"
//      e as respostas fiscais, e limpa o resto.
//
// Mocks obrigatórios do repo para render (expo-font, FpktLogo) ficam aqui
// mesmo que o modal não os puxe hoje — memória "testar render no aura-app".
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

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t" }),
}));

let mockPdvSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

const mockAddProduct = jest.fn();
const mockUpdateProduct = jest.fn();
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [], addProduct: mockAddProduct, updateProduct: mockUpdateProduct }),
}));
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({
  useProductCategories: () => ({ categories: [] }),
}));

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
const mockCreateLot = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: { createLot: (...a: any[]) => mockCreateLot(...a) },
}));

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";

// Rótulos, exemplos e perguntas que só o perfil Matcon mostra.
const SO_DO_MATCON = [
  "materiais de construção", "Como você vende", "Vendo por", "Como chega do fornecedor",
  "Compro por", "Entrega", "pesa", "Nota fiscal", "Código do imposto antecipado",
  "O imposto deste produto", "Fabricado no Brasil", "Porcelanato", "Cerâmica Vila Nova",
  "Onde usar", "Por lote e tonalidade", "Por cor e medida", "o seu código de prateleira",
  "Foto da caixa", "Tenho",
];

function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}

function porLabel(tree: any, label: string): any {
  return tree.root.findAllByProps({ accessibilityLabel: label })[0];
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

// O input pelo placeholder (o nome e o preço não têm accessibilityLabel).
function inputPorPlaceholder(tree: any, ph: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.placeholder === ph && typeof n.props.onChangeText === "function")[0];
}

function montar() {
  let tree: any;
  act(() => { tree = renderer.create(<ItemFormModal visible onClose={jest.fn()} />); });
  return tree;
}

async function clicar(node: any) {
  await act(async () => { await node.props.onPress(); });
}

function preencherNomeEPreco(tree: any, nome: string, preco: string, exemploDoNome: string) {
  act(() => { inputPorPlaceholder(tree, exemploDoNome).props.onChangeText(nome); });
  const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
  act(() => { precos[0].props.onChangeText(preco); });
}

const EX_MATCON = "Ex.: Porcelanato Bianco 60×60 acetinado";

beforeEach(() => {
  mockPdvSettings = {};
  mockAddProduct.mockReset().mockResolvedValue({ id: "novo-1" });
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  mockCreateLot.mockReset().mockResolvedValue({ lot: {} });
  (global as any).innerWidth = 1024;
});

describe("ItemFormModal — sem Matcon: não vaza nada do perfil", () => {
  test("nenhum rótulo nem exemplo do Matcon; o modal de antes", () => {
    const tree = montar();
    const t = texto(tree);
    SO_DO_MATCON.forEach((r) => expect(t).not.toContain(r));
    expect(t).toContain("Unidade de venda");
    expect(t).toContain("Códigos e fiscal");
    expect(t).toContain("Ex.: Vestido midi floral");
    expect(t).toContain("Por cor e tamanho");
    tree.unmount();
  });

  test("Ótica ligada sozinha também não muda o cadastro", () => {
    mockPdvSettings = { otica_enabled: true };
    const tree = montar();
    const t = texto(tree);
    SO_DO_MATCON.forEach((r) => expect(t).not.toContain(r));
    tree.unmount();
  });

  test("o Salvar não manda peso nem marca (as colunas nem entram no PATCH/POST)", async () => {
    const tree = montar();
    preencherNomeEPreco(tree, "Vestido midi", "18990", "Ex.: Vestido midi floral");
    await clicar(botao(tree, "Salvar produto"));
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo.weightKg).toBeUndefined();
    expect(corpo.marca).toBeUndefined();
    expect(corpo.unit).toBe("un");
    tree.unmount();
  });
});

describe("ItemFormModal — perfil Matcon", () => {
  beforeEach(() => {
    mockPdvSettings = { matcon_enabled: true, matcon_units: ["m²", "m³", "sc", "pç"] };
  });

  test("etiqueta no título e 'Vendo por' antes do preço", () => {
    const tree = montar();
    const t = texto(tree);
    expect(t).toContain("materiais de construção");
    expect(t.indexOf("Vendo por")).toBeGreaterThan(-1);
    expect(t.indexOf("Vendo por")).toBeLessThan(t.indexOf("Preço de venda"));
    expect(t).not.toContain("Unidade de venda");
    expect(t).toContain(EX_MATCON);
    // 23/09/2026 (QA em produção): "un" por extenso na frase da Entrega —
    // "Cada un pesa" não dizia nada pra quem não é do ramo.
    expect(t).toContain("Cada unidade pesa");
    tree.unmount();
  });

  test("com Ótica ligada junto, vale o Matcon", () => {
    mockPdvSettings = { ...mockPdvSettings, otica_enabled: true };
    const tree = montar();
    expect(texto(tree)).toContain("Vendo por");
    tree.unmount();
  });

  test("celular: item → como vende → estoque → entrega → nota fiscal → códigos → fotos → descrição", () => {
    (global as any).innerWidth = 390;
    const tree = montar();
    const t = texto(tree);
    const ordem = ["O item", "Como você vende", "Como você controla o estoque", "Entrega", "Nota fiscal", "Código interno", "Fotos principais", "Descrição e ficha"]
      .map((r) => t.indexOf(r));
    ordem.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    tree.unmount();
  });

  test("'Compro por' aparece também para un", () => {
    const tree = montar();
    expect(porLabel(tree, "un")).toBeTruthy();
    act(() => { porLabel(tree, "Em caixa, saco ou fardo").props.onPress(); });
    expect(texto(tree)).toContain("Compro por");
    tree.unmount();
  });

  // 23/09/2026 (QA em produção): a dica da ficha citava a frase "Compro
  // por" mesmo quando ela não estava na tela ("do mesmo jeito que vendo").
  test("dica da ficha só cita 'Compro por' quando a frase está visível", () => {
    const tree = montar();
    // "Do mesmo jeito que vendo" (estado inicial): sem "Compro por" na
    // tela, a dica não deve falar nele.
    expect(texto(tree)).not.toContain("Compro por");
    expect(texto(tree)).toContain("Para tinta e argamassa, escreva o rendimento aqui");
    expect(texto(tree)).not.toContain("Rendimento de piso não precisa digitar");
    expect(texto(tree)).not.toContain("Tinta e argamassa escrevem aqui");

    act(() => { porLabel(tree, "Em caixa, saco ou fardo").props.onPress(); });
    const t = texto(tree);
    // texto() serializa via JSON.stringify: aspas internas viram \" — o
    // trecho sem aspas evita depender do escaping.
    expect(t).toContain("Rendimento de piso não precisa digitar: sai da frase");
    expect(t).toContain("Para tinta e argamassa, escreva o rendimento aqui");
    tree.unmount();
  });

  test("ficha com 4 campos; Salvar grava peso, marca, 'onde usar' em cuidados e a compra", async () => {
    const tree = montar();
    preencherNomeEPreco(tree, "Porcelanato Bianco 60x60", "5490", EX_MATCON);
    act(() => { porLabel(tree, "m²").props.onPress(); });
    act(() => { porLabel(tree, "Em caixa, saco ou fardo").props.onPress(); });
    act(() => { porLabel(tree, "Quanto vem em 1 cx, em m²").props.onChangeText("2,32"); });
    act(() => { porLabel(tree, "Peso de cada m², em kg").props.onChangeText("21,5"); });

    ["Marca", "Medidas", "Material", "Onde usar e rendimento"].forEach((r) => expect(porLabel(tree, r)).toBeTruthy());
    act(() => { porLabel(tree, "Marca").props.onChangeText("Cerâmica Vila Nova"); });
    act(() => { porLabel(tree, "Onde usar e rendimento").props.onChangeText("piso interno"); });

    // A prévia mostra a caixa e o peso sozinhos.
    const t = texto(tree);
    expect(t).toContain("2,32 m² (automático)");
    expect(t).toContain("21,5 kg por m² (automático)");

    await clicar(botao(tree, "Salvar produto"));
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo.unit).toBe("m²");
    expect(corpo.weightKg).toBe(21.5);
    expect(corpo.marca).toBe("Cerâmica Vila Nova");
    expect(corpo.cuidados).toBe("piso interno");
    expect(corpo.purchaseUnit).toBe("cx");
    expect(corpo.purchaseFactor).toBe(2.32);
    tree.unmount();
  });

  test("peso vazio grava null (limpa), não undefined", async () => {
    const tree = montar();
    preencherNomeEPreco(tree, "Cimento CP-II", "3690", EX_MATCON);
    await clicar(botao(tree, "Salvar produto"));
    expect(mockAddProduct.mock.calls[0][0].weightKg).toBeNull();
    tree.unmount();
  });

  test("lote × cor e medida: a unidade e a config decidem", () => {
    // Lote desligado: piso em m² só tem "Por cor e medida".
    let tree = montar();
    act(() => { porLabel(tree, "m²").props.onPress(); });
    expect(texto(tree)).not.toContain("Por lote e tonalidade");
    expect(texto(tree)).toContain("Por cor e medida");
    tree.unmount();

    // Lote ligado: m² troca a opção; sc volta para cor e medida.
    mockPdvSettings = { ...mockPdvSettings, matcon_lots_enabled: true };
    tree = montar();
    act(() => { porLabel(tree, "m²").props.onPress(); });
    expect(texto(tree)).toContain("Por lote e tonalidade");
    expect(texto(tree)).not.toContain("Por cor e medida");
    act(() => { porLabel(tree, "sc").props.onPress(); });
    expect(texto(tree)).not.toContain("Por lote e tonalidade");
    expect(texto(tree)).toContain("Por cor e medida");
    tree.unmount();
  });

  test("por lote: o produto nasce com o total e cada pilha vira um lote", async () => {
    mockPdvSettings = { ...mockPdvSettings, matcon_lots_enabled: true };
    const tree = montar();
    preencherNomeEPreco(tree, "Porcelanato Bianco 60x60", "5490", EX_MATCON);
    act(() => { porLabel(tree, "m²").props.onPress(); });
    act(() => { porLabel(tree, "Por lote e tonalidade").props.onPress(); });
    act(() => { porLabel(tree, "Lote da linha 1").props.onChangeText("27B"); });
    act(() => { porLabel(tree, "Tonalidade da linha 1").props.onChangeText("A2"); });
    act(() => { porLabel(tree, "Quanto tenho na linha 1").props.onChangeText("95,12"); });
    act(() => { porLabel(tree, "+ outro lote na prateleira").props.onPress(); });
    act(() => { porLabel(tree, "Lote da linha 2").props.onChangeText("28A"); });
    act(() => { porLabel(tree, "Quanto tenho na linha 2").props.onChangeText("53,36"); });

    await clicar(botao(tree, "Salvar produto"));
    expect(mockAddProduct.mock.calls[0][0].stock).toBe(148.48);
    expect(mockCreateLot).toHaveBeenCalledTimes(2);
    expect(mockCreateLot).toHaveBeenNthCalledWith(1, "empresa-1", "novo-1", { lot_code: "27B", shade: "A2", caliber: null, qty: 95.12 });
    expect(mockCreateLot).toHaveBeenNthCalledWith(2, "empresa-1", "novo-1", { lot_code: "28A", shade: null, caliber: null, qty: 53.36 });
    tree.unmount();
  });

  test("'Salvar e cadastrar outro' mantém unidade, compra e fiscal; limpa nome, preço e estoque", async () => {
    const tree = montar();
    preencherNomeEPreco(tree, "Cimento CP-II 50 kg", "3690", EX_MATCON);
    act(() => { porLabel(tree, "sc").props.onPress(); });
    act(() => { porLabel(tree, "Em caixa, saco ou fardo").props.onPress(); });
    act(() => { porLabel(tree, "Quanto vem em 1 cx, em sc").props.onChangeText("10"); });
    act(() => { porLabel(tree, "Quanto tenho em estoque").props.onChangeText("120"); });
    act(() => { porLabel(tree, "Código do produto na nota (NCM)").props.onChangeText("25232910"); });
    act(() => { porLabel(tree, "Código do imposto antecipado (CEST)").props.onChangeText("0500100"); });
    act(() => { porLabel(tree, "Sim, já veio").props.onPress(); });
    act(() => { porLabel(tree, "Peso de cada sc, em kg").props.onChangeText("50"); });

    await clicar(botao(tree, "Salvar e cadastrar outro"));
    expect(mockAddProduct).toHaveBeenCalledTimes(1);

    // Mantidos.
    expect(porLabel(tree, "Quanto vem em 1 cx, em sc").props.value).toBe("10");
    expect(porLabel(tree, "Código do produto na nota (NCM)").props.value).toBe("25232910");
    expect(porLabel(tree, "Código do imposto antecipado (CEST)").props.value).toBe("0500100");
    expect(texto(tree)).toContain("3 de 3 ✓");
    expect(texto(tree)).toContain("sc em estoque");
    // Limpos.
    expect(inputPorPlaceholder(tree, EX_MATCON).props.value).toBe("");
    expect(porLabel(tree, "Quanto tenho em estoque").props.value).toBe("");
    expect(porLabel(tree, "Peso de cada sc, em kg").props.value).toBe("");
    const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
    expect(precos[0].props.value).toBe("");
    tree.unmount();
  });
});

describe("ItemFormModal — sem Matcon, 'Salvar e cadastrar outro' continua limpando tudo", () => {
  test("NCM não passa para o próximo produto", async () => {
    const tree = montar();
    preencherNomeEPreco(tree, "Vestido midi", "18990", "Ex.: Vestido midi floral");
    act(() => { inputPorPlaceholder(tree, "00000000").props.onChangeText("62044400"); });
    await clicar(botao(tree, "Salvar e cadastrar outro"));
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(inputPorPlaceholder(tree, "00000000").props.value).toBe("");
    tree.unmount();
  });
});
