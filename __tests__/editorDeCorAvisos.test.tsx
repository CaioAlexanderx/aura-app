// ============================================================
// Editor de cor: avisos e "como sai" (CP4b da revisão de cores, 14/11/2026)
//
// Telas 2 e 3 do mockup aprovado: o nome ou a amostra repetidos AVISAM
// (nunca bloqueiam), e a prévia mostra o nome no Caixa, na etiqueta, na
// vitrine e na nota, pelas regras de verdade.
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

// Uma cor antiga (color_name NULL: o GET manda name null e o pedaço do
// sufixo em name_sugerido) e uma com nome gravado.
const mockVariacoes = {
  product_id: "p-1",
  product_name: "Vestido",
  colors: [
    { hex: "#FAF9F6", name: null, name_sugerido: "OFF WHITE" },
    { hex: "#C3B091", name: "Caqui", name_sugerido: null },
  ],
  sizes: ["M"],
  matrix: { "#FAF9F6|M": 3, "#C3B091|M": 2 },
  barcodes: {},
  images: {},
  mode: "matrix",
  total_variants: 2,
};
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    if (o.queryKey && o.queryKey[0] === "productVariations" && o.enabled) {
      return { data: mockVariacoes, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t" }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
const mockUpdateProduct = jest.fn();
jest.mock("@/hooks/useProducts", () => {
  const real = jest.requireActual("@/hooks/useProducts");
  return {
    camposNfseDoCorpo: real.camposNfseDoCorpo,
    useProducts: () => ({ products: [], addProduct: jest.fn(), updateProduct: mockUpdateProduct }),
  };
});
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));
jest.mock("@/hooks/useEmiteNfse", () => ({ useEmiteNfse: () => false }));
jest.mock("@/services/api", () => ({
  companiesApi: { checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }) },
  request: jest.fn(),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: jest.fn(), list: jest.fn() } }));
const mockSave = jest.fn();
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: (...a: any[]) => mockSave(...a) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { SecaoEstoque } from "@/components/screens/estoque/item-form/SecaoEstoque";

function textoDe(node: any): string {
  return node.findAllByType(Text).map((t: any) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join("") : String(c ?? "");
  }).join(" ");
}
function botao(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && textoDe(n).indexOf(rotulo) >= 0)[0];
}
function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
function secao(tree: any): any {
  return tree.root.findByType(SecaoEstoque);
}

import { EditorDeCor } from "@/components/screens/estoque/item-form/EditorDeCor";
import { repeticoes, avisoDaCor, comoSai } from "@/components/screens/estoque/item-form/regrasDaCor";
import { TextInput } from "react-native";

const VESTIDO: any = {
  id: "p-1", name: "Vestido Midi", code: "VES-1", barcode: "", category: "Roupas", price: 189.9,
  cost: 60, stock: 5, minStock: 0, unit: "un", brand: "", notes: "", color: "", size: "",
  has_variants: true, isGroupShared: false,
};

function porRotulo(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && n.props.accessibilityLabel === rotulo)[0];
}
function campo(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === TextInput && n.props.accessibilityLabel === rotulo)[0];
}

beforeEach(() => {
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  mockSave.mockReset().mockResolvedValue({});
});

const AZUL = { hex: "#3B82F6", name: "Azul" };
const AZUL2 = { hex: "#06B6D4", name: "azul" };
const PRETA = { hex: "#111111", name: "Preta" };
const PRETO = { hex: "#141414", name: "Preto" };

describe("regras: repetidas", () => {
  test("mesmo nome (sem acento nem caixa) e amostra quase igual", () => {
    const r = repeticoes([AZUL, AZUL2, PRETA, PRETO]);
    expect(r.map((x) => [x.tipo, x.primeira.name, x.segunda.name])).toEqual([
      ["nome", "Azul", "azul"],
      ["amostra", "Preta", "Preto"],
    ]);
  });
  test("o par marcado como diferente sai da lista", () => {
    const chave = repeticoes([AZUL, AZUL2])[0].chave;
    expect(repeticoes([AZUL, AZUL2], new Set([chave]))).toEqual([]);
  });
  test("aviso da cor que vai entrar ou ser renomeada (a própria não conta)", () => {
    expect(avisoDaCor([AZUL, PRETA], "AZUL", "#FF0000")).toContain("já tem uma cor \"Azul\"");
    expect(avisoDaCor([AZUL, PRETA], "Grafite", "#121212")).toContain("quase igual à de \"Preta\"");
    expect(avisoDaCor([AZUL, PRETA], "Azul", AZUL.hex, AZUL.hex)).toBeNull();
    expect(avisoDaCor([AZUL, PRETA], "Caqui", "#C3B091")).toBeNull();
  });
});

describe("regras: como sai", () => {
  test("nome gravado: Caixa, etiqueta, vitrine e nota", () => {
    expect(comoSai({ hex: "#FAF9F6", nome: "Off White", produto: "Vestido Midi Lua", tamanho: "M" })).toEqual({
      caixa: "Off White · M", etiqueta: "Off White • Tam M", vitrine: "Off White",
      nota: "Vestido Midi Lua (Off White · M)", notaTamanho: 32,
    });
  });
  test("cor antiga sem nome gravado sai como hoje (o cortado vira a paleta)", () => {
    expect(comoSai({ hex: "#1F2A44", nome: null, nomeNaTela: "AZUL ESCUR", produto: "Vestido", tamanho: "M" }))
      .toMatchObject({ caixa: "Cinza escuro · M", etiqueta: "Cinza escuro • Tam M", vitrine: "Cinza escuro" });
    expect(comoSai({ hex: "#C3B091", nome: null, nomeNaTela: "CAQUI", tamanho: "P" }).caixa).toBe("Caqui · P");
  });
  test("todo maiúsculo: Caixa em caixa de frase; a nota mostra o tamanho e corta em 120", () => {
    const longo = "x".repeat(130);
    const r = comoSai({ hex: "#FAF9F6", nome: "OFF WHITE", produto: longo, tamanho: null });
    expect(r.vitrine).toBe("Off white");
    expect(r.nota).toHaveLength(120);
    expect(r.notaTamanho).toBe(130 + " (Off white)".length);
  });
});

describe("no editor", () => {
  test("avisa nome e amostra repetidos, e 'manter' some com o aviso", async () => {
    const tree = await montar(<EditorDeCor cores={[AZUL, AZUL2, PRETA, PRETO]} onCores={jest.fn()} />);
    expect(porId(tree, "aviso-de-cor")).toHaveLength(2);
    await act(async () => { porRotulo(tree, "Manter Azul e azul").props.onPress(); });
    expect(porId(tree, "aviso-de-cor")).toHaveLength(1);
    await act(async () => { porRotulo(tree, "Renomear Preto").props.onPress(); });
    expect(porId(tree, "renomear-cor")).toHaveLength(1);
    tree.unmount();
  });

  test("renomear mostra como sai e o que sai hoje; nome repetido avisa mas salva", async () => {
    const onCores = jest.fn();
    const tree = await montar(<EditorDeCor cores={[AZUL, { hex: "#1F2A44", name: "AZUL ESCUR", nomeSoParaMostrar: true }]} onCores={onCores} produto="Vestido Midi" tamanhoExemplo="M" />);
    await act(async () => { porRotulo(tree, "Nome da cor AZUL ESCUR").props.onPress(); });
    const previa = () => textoDe(porId(tree, "como-sai")[0]);
    expect(previa()).toContain("Cinza escuro · M");
    await act(async () => { campo(tree, "Novo nome da cor").props.onChangeText("Azul"); });
    expect(porId(tree, "aviso-de-cor").map(textoDe).join(" ")).toContain("já tem uma cor \"Azul\"");
    expect(previa()).toContain("Vestido Midi (Azul · M)");
    expect(previa()).toContain("Hoje: Cinza escuro · M");
    await act(async () => { porRotulo(tree, "Salvar o nome da cor").props.onPress(); });
    expect(onCores).toHaveBeenCalledWith([AZUL, { hex: "#1F2A44", name: "Azul", nomeConfirmado: true }]);
    tree.unmount();
  });

  test("nome próprio mostra a prévia e avisa amostra parecida sem travar o Adicionar", async () => {
    const onCores = jest.fn();
    const tree = await montar(<EditorDeCor cores={[PRETA]} onCores={onCores} produto="Saia" tamanhoExemplo="P" />);
    await act(async () => { botao(tree, "+ Cor").props.onPress(); });
    await act(async () => { campo(tree, "Nome da cor").props.onChangeText("Grafite fosco"); });
    await act(async () => { campo(tree, "Hex da amostra").props.onChangeText("#121212"); });
    expect(porId(tree, "aviso-de-cor").map(textoDe).join(" ")).toContain("quase igual à de \"Preta\"");
    expect(textoDe(porId(tree, "como-sai")[0])).toContain("Saia (Grafite fosco · P)");
    await act(async () => { porRotulo(tree, "Adicionar a cor com nome próprio").props.onPress(); });
    expect(onCores).toHaveBeenCalledWith([PRETA, { hex: "#121212", name: "Grafite fosco", nomeConfirmado: true }]);
    tree.unmount();
  });
});

describe("no modal do item: aviso nunca bloqueia o Salvar", () => {
  test("duas cores com o mesmo nome gravam", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    const atuais = secao(tree).props.cores;
    act(() => { secao(tree).props.onCores([...atuais, { hex: "#D9C7A7", name: "Caqui" }]); });
    expect(porId(tree, "aviso-de-cor").length).toBeGreaterThan(0);
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
});
