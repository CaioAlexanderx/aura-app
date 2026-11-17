// ============================================================
// p-173 (17/11/2026): a ficha de personalização do Studio no cadastro do
// item do Estoque do Negócio.
//
// O que estes testes seguram:
//   1. com a trava PERSONALIZADOS_LIBERADO em false (como está no código),
//      o cadastro é o de hoje: a mesma árvore de uma loja sem a frente, sem
//      a seção e sem ida extra ao /auth/me;
//   2. com a trava ligada, a frente ligada e o módulo personalizados.ficha
//      visível, a seção aparece na edição do produto e abre o editor do
//      Studio (o mesmo StudioPersonalizacaoPanel), com a loja e o produto;
//   3. some no Essencial (sem o módulo), no shell /studio (vertical_active),
//      no consolidado, no serviço e no cadastro novo;
//   4. item do grupo que é de outra loja: só o aviso, sem o botão;
//   5. o Escape não fecha o cadastro com o editor aberto.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/components/BarcodeQRSection", () => ({ BarcodeQRSection: () => null }));
jest.mock("@/components/catalog/CategoryTreePicker", () => ({ CategoryTreePicker: () => null }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));
// O editor é o do Studio: aqui um marcador que guarda as props recebidas.
jest.mock("@/components/studio/StudioPersonalizacaoPanel", () => {
  const { View } = jest.requireActual("react-native");
  const Painel = (props: any) => <View testID="painel-do-studio" {...{ dados: props }} />;
  return { __esModule: true, default: Painel, StudioPersonalizacaoPanel: Painel };
});
jest.mock("@/components/personalizados/TemaDoNegocio", () => ({
  TemaDoNegocio: ({ children }: any) => children,
}));
jest.mock("@/hooks/useDigitalChannel", () => ({ useDigitalChannel: () => ({ config: { slug: "loja-qa" } }) }));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
const mockRefreshMe = jest.fn().mockResolvedValue(undefined);
let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
let mockSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
const mockVisiveis = { set: new Set<string>(), prontos: true };
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => mockVisiveis.set,
  useVisibleModulesProntos: () => mockVisiveis.prontos,
}));
// A trava geral fica desligada no código (Caio, 16/11). Aqui ela é ligada de
// propósito; o primeiro bloco prova que, como está no código, nada muda.
const mockTrava = { liberado: false };
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  return { ...real, personalizadosAtivo: (s: any, v: any) => real.personalizadosAtivo(s, v, mockTrava.liberado) };
});
jest.mock("@/hooks/useProducts", () => {
  const real = jest.requireActual("@/hooks/useProducts");
  return {
    camposNfseDoCorpo: real.camposNfseDoCorpo,
    useProducts: () => ({ products: [], addProduct: jest.fn(), updateProduct: jest.fn() }),
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

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { fichaNoEstoqueLigada, situacaoDoItem, MOD_DA_FICHA, TEXTOS_DA_FICHA } from "@/components/personalizados/regrasDaFicha";

const CANECA: any = {
  id: "p-1", name: "Caneca branca", code: "CAN-1", barcode: "", category: "Canecas", price: 39.9,
  cost: 12, stock: 7, minStock: 2, unit: "un", brand: "", notes: "", color: "", size: "",
  isGroupShared: false, ownerCompanyId: "empresa-1",
};
const SERVICO: any = { ...CANECA, id: "s-1", name: "Arte do zero", unit: "srv" };

function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
function tem(tree: any, id: string): boolean {
  return porId(tree, id).length > 0;
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
function ligarTudo() {
  mockTrava.liberado = true;
  mockSettings = { studio_enabled: true };
  mockVisiveis.set = new Set<string>([MOD_DA_FICHA, "estoque"]);
}

beforeEach(() => {
  mockTrava.liberado = false;
  mockSettings = { studio_enabled: true };
  mockVisiveis.set = new Set<string>([MOD_DA_FICHA, "estoque"]);
  mockVisiveis.prontos = true;
  mockRefreshMe.mockClear();
  mockAuth = {
    company: { id: "empresa-1", plan: "negocio", vertical_active: null },
    consolidatedView: false, token: "t", refreshMe: mockRefreshMe,
  };
  (global as any).innerWidth = 1024;
});

describe("trava PERSONALIZADOS_LIBERADO desligada: nada muda", () => {
  test("a trava está em false no código", () => {
    expect(jest.requireActual("@/utils/personalizados").PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("mesmo com studio_enabled e o módulo, a edição do produto é a de uma loja sem a frente", async () => {
    const comFrente = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(comFrente, "secao-personalizacao")).toBe(false);
    expect(JSON.stringify(comFrente.toJSON())).not.toContain(TEXTOS_DA_FICHA.titulo);
    const arvoreComFrente = JSON.stringify(comFrente.toJSON());

    mockSettings = {};
    mockVisiveis.set = new Set<string>(["estoque"]);
    const semFrente = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(JSON.stringify(semFrente.toJSON())).toBe(arvoreComFrente);
    // Ninguém paga a ida extra ao /auth/me.
    expect(mockRefreshMe).not.toHaveBeenCalled();
  });
});

describe("trava ligada: a entrada aparece", () => {
  test("edição do produto mostra a seção e abre o editor do Studio com a loja e o produto", async () => {
    ligarTudo();
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(tree, "secao-personalizacao")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain(TEXTOS_DA_FICHA.botao);
    expect(mockRefreshMe).toHaveBeenCalled();
    expect(tem(tree, "editor-personalizacao")).toBe(false);

    await act(async () => { porId(tree, "abrir-personalizacao")[0].props.onPress(); });
    expect(tem(tree, "editor-personalizacao")).toBe(true);
    const painel = porId(tree, "painel-do-studio")[0];
    expect(painel.props.dados).toEqual(expect.objectContaining({
      productId: "p-1", companyId: "empresa-1", productName: "Caneca branca", productPrice: 39.9, slug: "loja-qa",
    }));

    await act(async () => { porId(tree, "fechar-personalizacao")[0].props.onPress(); });
    expect(tem(tree, "editor-personalizacao")).toBe(false);
    expect(tem(tree, "secao-personalizacao")).toBe(true);
  });

  test("Escape com o editor aberto não fecha o cadastro", async () => {
    ligarTudo();
    const onClose = jest.fn();
    const tree = await montar(<ItemFormModal visible onClose={onClose} editProduct={CANECA} />);
    const escape = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // Sem o editor, o Escape fecha o cadastro (como hoje).
    await act(async () => { escape(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { porId(tree, "abrir-personalizacao")[0].props.onPress(); });
    await act(async () => { escape(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tem(tree, "editor-personalizacao")).toBe(true);
  });

  test("Essencial (sem o módulo personalizados.ficha): some, sem cadeado", async () => {
    ligarTudo();
    mockVisiveis.set = new Set<string>(["estoque"]);
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(tree, "secao-personalizacao")).toBe(false);
    expect(JSON.stringify(tree.toJSON())).not.toContain(TEXTOS_DA_FICHA.titulo);
  });

  test("empresa no shell /studio (vertical_active) ou sem studio_enabled: some", async () => {
    ligarTudo();
    mockAuth.company.vertical_active = "studio";
    const noStudio = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(noStudio, "secao-personalizacao")).toBe(false);

    mockAuth.company.vertical_active = null;
    mockSettings = { studio_enabled: false };
    const desligada = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(desligada, "secao-personalizacao")).toBe(false);
  });

  test("consolidado (Todas as empresas): some", async () => {
    ligarTudo();
    mockAuth.consolidatedView = true;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(tree, "secao-personalizacao")).toBe(false);
  });

  test("serviço e cadastro novo: some", async () => {
    ligarTudo();
    const servico = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={SERVICO} />);
    expect(tem(servico, "secao-personalizacao")).toBe(false);
    const novo = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    expect(tem(novo, "secao-personalizacao")).toBe(false);
  });

  test("item do grupo que é de outra loja: só o aviso, sem o botão", async () => {
    ligarTudo();
    const doGrupo = { ...CANECA, isGroupShared: true, ownerCompanyId: "empresa-matriz" };
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={doGrupo} />);
    expect(tem(tree, "secao-personalizacao")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain(TEXTOS_DA_FICHA.doGrupo);
    expect(tem(tree, "abrir-personalizacao")).toBe(false);
  });

  test("antes de as permissões chegarem, nada aparece (sem piscar)", async () => {
    ligarTudo();
    mockVisiveis.prontos = false;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(tree, "secao-personalizacao")).toBe(false);
  });
});

describe("regras da ficha (components/personalizados/regrasDaFicha.ts)", () => {
  beforeEach(() => { mockTrava.liberado = true; });
  const base = { settings: { studio_enabled: true }, verticalActive: null, visiveis: new Set([MOD_DA_FICHA]), consolidado: false };

  test("frente, módulo e loja única", () => {
    expect(fichaNoEstoqueLigada(base)).toBe(true);
    expect(fichaNoEstoqueLigada({ ...base, consolidado: true })).toBe(false);
    expect(fichaNoEstoqueLigada({ ...base, visiveis: new Set<string>() })).toBe(false);
    expect(fichaNoEstoqueLigada({ ...base, verticalActive: "studio" })).toBe(false);
    expect(fichaNoEstoqueLigada({ ...base, settings: {} })).toBe(false);
    mockTrava.liberado = false;
    expect(fichaNoEstoqueLigada(base)).toBe(false);
  });

  test("o item", () => {
    const item = { produtoId: "p-1", isProduto: true, companyId: "c-1" };
    expect(situacaoDoItem(item)).toBe("editar");
    expect(situacaoDoItem({ ...item, ownerCompanyId: "c-1" })).toBe("editar");
    expect(situacaoDoItem({ ...item, ownerCompanyId: null })).toBe("editar");
    expect(situacaoDoItem({ ...item, ownerCompanyId: "c-2" })).toBe("do-grupo");
    expect(situacaoDoItem({ ...item, isProduto: false })).toBe("fora");
    expect(situacaoDoItem({ ...item, produtoId: null })).toBe("fora");
  });
});
