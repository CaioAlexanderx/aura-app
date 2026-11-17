// ============================================================
// p-178 (17/11/2026): insumos e ficha técnica (composição) no shell Negócio.
//
// O que estes testes seguram:
//   1. com a trava PERSONALIZADOS_LIBERADO em false (como está no código):
//      a rota /personalizados/insumos manda todo mundo para o Painel, e o
//      cadastro do item no Estoque é o de hoje (sem a seção Ficha técnica);
//   2. com a trava ligada: a rota abre a MESMA tela do /studio
//      (TelaDeInsumos), dentro do tema do Negócio, refaz /auth/me e lê os
//      insumos da loja; tocar numa ficha abre o editor do Studio
//      (StudioFichaTecnicaPanel) por cima, com o customization_config;
//   3. some no Essencial, no shell /studio, sem a frente; no consolidado
//      pede para escolher uma loja e não lê nada;
//   4. o /studio continua igual: mesmos textos, a ficha vai ao produto em
//      /studio/estoque;
//   5. o cadastro do item ganha a seção Ficha técnica só com a frente e o
//      módulo; item do grupo de outra loja mostra só o aviso;
//   6. o item "Insumos" sai dos ocultos do menu (a tela nasceu).
//
// Mocks no padrão de __tests__/personalizacaoNoEstoque.test.tsx (p-173).
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
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn() }));
jest.mock("@/components/BarcodeQRSection", () => ({ BarcodeQRSection: () => null }));
jest.mock("@/components/catalog/CategoryTreePicker", () => ({ CategoryTreePicker: () => null }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => "/personalizados/insumos",
}));
// Peças visuais do Studio que a tela usa: marcadores simples. A tela em si
// (TelaDeInsumos) roda de verdade.
jest.mock("@/components/studio/StudioScreen", () => ({
  StudioScreen: ({ children }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="studio-screen">{children}</View>;
  },
}));
jest.mock("@/components/studio/StudioPageHeader", () => ({
  StudioPageHeader: ({ title, rightSlot }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="cabecalho" accessibilityLabel={title}>{rightSlot}</View>;
  },
}));
jest.mock("@/components/studio/StudioEmpty", () => {
  const Vazio = ({ title, desc, primaryCta }: any) => {
    const { View, Text, Pressable } = jest.requireActual("react-native");
    return (
      <View testID="vazio" accessibilityLabel={title}>
        <Text>{desc}</Text>
        {primaryCta ? <Pressable testID="vazio-cta" accessibilityLabel={primaryCta.label} onPress={primaryCta.onPress} /> : null}
      </View>
    );
  };
  return { __esModule: true, StudioEmpty: Vazio, default: Vazio };
});
jest.mock("@/components/studio/StudioLoading", () => ({ __esModule: true, StudioLoading: () => null, default: () => null }));
jest.mock("@/components/studio/AnimatedKpiCounter", () => ({ AnimatedKpiCounter: () => null }));
jest.mock("@/components/studio/NovoInsumoModal", () => ({ __esModule: true, default: () => null }));
// O editor da composição é o do Studio: aqui um marcador que guarda as props.
jest.mock("@/components/studio/StudioFichaTecnicaPanel", () => {
  const { View } = jest.requireActual("react-native");
  const Painel = (props: any) => <View testID="painel-da-ficha" {...{ dados: props }} />;
  return { __esModule: true, default: Painel };
});
const mockTema = { montou: 0 };
jest.mock("@/components/personalizados/TemaDoNegocio", () => ({
  TemaDoNegocio: ({ children }: any) => {
    mockTema.montou += 1;
    return children;
  },
}));
const mockListInputs = jest.fn();
const mockListFichas = jest.fn();
const mockGetConfig = jest.fn();
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    listInputs: (...a: any[]) => mockListInputs(...a),
    listCompositionsSummary: (...a: any[]) => mockListFichas(...a),
    getCustomizationConfig: (...a: any[]) => mockGetConfig(...a),
    deleteInput: jest.fn(),
  },
}));
jest.mock("@/components/CompanyPickerModal", () => ({
  CompanyPickerModal: () => null,
  getRememberedCompanyId: () => null,
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
const mockRefreshMe = jest.fn().mockResolvedValue(undefined);
let mockAuth: any;
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth) : mockAuth),
}));
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
jest.mock("@/hooks/useDigitalChannel", () => ({ useDigitalChannel: () => ({ config: { slug: "loja-qa" } }) }));
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

import fs from "fs";
import path from "path";
import TelaDeInsumosNoNegocio from "@/app/(tabs)/personalizados/insumos";
import StudioInsumos from "@/app/studio/(estudio)/insumos";
import { TEXTOS_DOS_INSUMOS_NO_STUDIO } from "@/components/studio/TelaDeInsumos";
import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import {
  insumosNoNegocioLigados, MOD_DOS_INSUMOS, TEXTOS_DA_COMPOSICAO, TEXTOS_DOS_INSUMOS_NO_NEGOCIO,
} from "@/components/personalizados/regrasDosInsumos";
import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { MODULOS_OCULTOS } from "@/constants/modulosOcultos";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };
const INSUMO = {
  id: "i-1", name: "Caneca branca 325 ml", unit: "un", unit_cost: 9.5, stock_qty: 40, stock_min: 10,
  is_active: true, is_low_stock: false, supplier_name: null,
};
const FICHA = {
  composition_id: "c-1", product_id: "p-1", product_name: "Caneca com nome", product_price: 39.9,
  total_cost: 12.3, margin_pct: 69.2, item_count: 3, image_url: null,
};
const CANECA: any = {
  id: "p-1", name: "Caneca com nome", code: "CAN-1", barcode: "", category: "Canecas", price: 39.9,
  cost: 12, stock: 7, minStock: 2, unit: "un", brand: "", notes: "", color: "", size: "",
  isGroupShared: false, ownerCompanyId: "loja-1",
};

function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
function tem(tree: any, id: string): boolean {
  return porId(tree, id).length > 0;
}
function porRotulo(tree: any, rotulo: string): any[] {
  return tree.root.findAll(
    (n: any) => n.props && n.props.accessibilityLabel === rotulo && typeof n.props.onPress === "function",
    { deep: false },
  );
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
async function abrirAbaFichas(tree: any) {
  const aba = tree.root.findAll(
    (n: any) => n.props && typeof n.props.onPress === "function"
      && n.findAll((f: any) => f.children && f.children.includes && f.children.includes("Fichas Técnicas")).length > 0,
    { deep: false },
  );
  await act(async () => { aba[0].props.onPress(); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}
function ligarTudo() {
  mockTrava.liberado = true;
  mockSettings = { studio_enabled: true };
  mockVisiveis.set = new Set<string>([MOD_DOS_INSUMOS, "estoque"]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTrava.liberado = false;
  mockSettings = { studio_enabled: true };
  mockVisiveis.set = new Set<string>([MOD_DOS_INSUMOS, "estoque"]);
  mockVisiveis.prontos = true;
  mockTema.montou = 0;
  mockAuth = {
    company: { ...LOJA }, consolidatedView: false, user: { id: "u1" }, token: "t",
    refreshMe: mockRefreshMe, switchCompany: jest.fn(),
  };
  mockListInputs.mockResolvedValue({ inputs: [INSUMO] });
  mockListFichas.mockResolvedValue({ compositions: [FICHA], count: 1 });
  mockGetConfig.mockResolvedValue({ product_id: "p-1", name: "Caneca com nome", is_personalizable: true, config: { fields: [{ id: "cor", type: "color", label: "Cor" }] } });
  (global as any).innerWidth = 1024;
});

describe("trava PERSONALIZADOS_LIBERADO desligada: nada muda", () => {
  test("a trava está em false no código", () => {
    expect(jest.requireActual("@/utils/personalizados").PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("a rota manda para o Painel mesmo com a frente e o módulo, e não lê insumo", async () => {
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    expect(porId(tree, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(tem(tree, "personalizados-insumos")).toBe(false);
    expect(mockListInputs).not.toHaveBeenCalled();
  });

  test("o cadastro do item é o de uma loja sem a frente, sem a Ficha técnica", async () => {
    const comFrente = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(comFrente, "secao-composicao")).toBe(false);
    const arvoreComFrente = JSON.stringify(comFrente.toJSON());
    expect(arvoreComFrente).not.toContain(TEXTOS_DA_COMPOSICAO.botao);

    mockSettings = {};
    mockVisiveis.set = new Set<string>(["estoque"]);
    const semFrente = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(JSON.stringify(semFrente.toJSON())).toBe(arvoreComFrente);
    expect(mockRefreshMe).not.toHaveBeenCalled();
  });
});

describe("trava ligada: a rota /personalizados/insumos", () => {
  test("abre a tela do Studio no tema do Negócio, refaz /auth/me e lê os insumos da loja", async () => {
    ligarTudo();
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    expect(tem(tree, "redirect")).toBe(false);
    expect(tem(tree, "personalizados-insumos")).toBe(true);
    expect(tem(tree, "studio-screen")).toBe(true);
    expect(mockTema.montou).toBeGreaterThan(0);
    expect(porId(tree, "cabecalho")[0].props.accessibilityLabel).toBe(TEXTOS_DOS_INSUMOS_NO_NEGOCIO.titulo);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(mockListInputs).toHaveBeenCalledWith("loja-1");
    expect(JSON.stringify(tree.toJSON())).toContain("Caneca branca 325 ml");
  });

  test("tocar numa ficha abre a ficha técnica do Studio por cima, com o customization_config", async () => {
    ligarTudo();
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    await abrirAbaFichas(tree);
    expect(mockListFichas).toHaveBeenCalledWith("loja-1");
    expect(JSON.stringify(tree.toJSON())).toContain(TEXTOS_DOS_INSUMOS_NO_NEGOCIO.dicaDasFichas);

    const rotulo = TEXTOS_DOS_INSUMOS_NO_NEGOCIO.rotuloDaFicha.replace("{produto}", "Caneca com nome");
    await act(async () => { porRotulo(tree, rotulo)[0].props.onPress(); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(mockPush).not.toHaveBeenCalled();
    expect(tem(tree, "editor-composicao")).toBe(true);
    expect(mockGetConfig).toHaveBeenCalledWith("loja-1", "p-1");
    const painel = porId(tree, "painel-da-ficha")[0];
    expect(painel.props.dados).toEqual(expect.objectContaining({
      productId: "p-1", companyId: "loja-1", productName: "Caneca com nome", productPrice: 39.9,
      customizationConfig: { fields: [{ id: "cor", type: "color", label: "Cor" }] },
    }));

    // Fechar relê as fichas (o custo e a margem podem ter mudado).
    mockListFichas.mockClear();
    await act(async () => { porId(tree, "fechar-composicao")[0].props.onPress(); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(tem(tree, "editor-composicao")).toBe(false);
    expect(mockListFichas).toHaveBeenCalledWith("loja-1");
  });

  test("sem fichas, o botão leva ao Estoque do Negócio (não ao /studio)", async () => {
    ligarTudo();
    mockListFichas.mockResolvedValue({ compositions: [], count: 0 });
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    await abrirAbaFichas(tree);
    const cta = porId(tree, "vazio-cta");
    expect(cta[0].props.accessibilityLabel).toBe(TEXTOS_DOS_INSUMOS_NO_NEGOCIO.irParaOCatalogo);
    await act(async () => { cta[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/estoque");
  });

  test("a leitura do customization_config falha: o painel abre mesmo assim, sem as opções", async () => {
    ligarTudo();
    mockGetConfig.mockRejectedValue(new Error("Sem conexão"));
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    await abrirAbaFichas(tree);
    const rotulo = TEXTOS_DOS_INSUMOS_NO_NEGOCIO.rotuloDaFicha.replace("{produto}", "Caneca com nome");
    await act(async () => { porRotulo(tree, rotulo)[0].props.onPress(); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(porId(tree, "painel-da-ficha")[0].props.dados.customizationConfig).toBeNull();
  });

  test("Essencial ou membro sem permissão: volta ao Painel, sem cadeado", async () => {
    ligarTudo();
    mockVisiveis.set = new Set<string>(["painel", "pdv"]);
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    expect(porId(tree, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(mockListInputs).not.toHaveBeenCalled();
    const fonte = ler("app/(tabs)/personalizados/insumos.tsx");
    const semComentario = fonte.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
    expect(semComentario).not.toMatch(/upgrade|cadeado|"lock"|Assine|\/planos/i);
  });

  test("empresa no shell /studio ou sem a frente: volta ao Painel", async () => {
    ligarTudo();
    mockAuth.company = { ...LOJA, vertical_active: "studio" };
    const noStudio = await montar(<TelaDeInsumosNoNegocio />);
    expect(tem(noStudio, "redirect")).toBe(true);

    mockAuth.company = { ...LOJA };
    mockSettings = { studio_enabled: false };
    const desligada = await montar(<TelaDeInsumosNoNegocio />);
    expect(tem(desligada, "redirect")).toBe(true);
    expect(mockListInputs).not.toHaveBeenCalled();
  });

  test("consolidado multi-CNPJ: pede para escolher uma loja e não lê nada", async () => {
    ligarTudo();
    mockAuth = { ...mockAuth, consolidatedView: true, company: null };
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    const textos = JSON.stringify(tree.toJSON());
    expect(textos).toContain("Escolha uma loja");
    expect(textos).toContain("Os insumos e as fichas técnicas são de cada loja.");
    expect(tem(tree, "personalizados-insumos")).toBe(false);
    expect(mockListInputs).not.toHaveBeenCalled();
  });

  test("enquanto as permissões carregam, não decide nem redireciona", async () => {
    ligarTudo();
    mockVisiveis.prontos = false;
    const tree = await montar(<TelaDeInsumosNoNegocio />);
    expect(tem(tree, "personalizados-insumos-esperando")).toBe(true);
    expect(tem(tree, "redirect")).toBe(false);
  });
});

describe("o /studio continua igual", () => {
  test("mesmos textos de sempre e a ficha vai ao produto em /studio/estoque", async () => {
    // A trava não vale aqui: o /studio não passa por ela.
    const tree = await montar(<StudioInsumos />);
    expect(porId(tree, "cabecalho")[0].props.accessibilityLabel).toBe("Estoque do estúdio");
    expect(mockListInputs).toHaveBeenCalledWith("loja-1");
    await abrirAbaFichas(tree);
    expect(JSON.stringify(tree.toJSON())).toContain(
      "Toque numa ficha para editar no Catálogo. O editor canônico fica na tela de produto.",
    );
    await act(async () => { porRotulo(tree, "Editar ficha de Caneca com nome no Catálogo")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/studio/estoque?action=edit-product&id=p-1");
    expect(tem(tree, "editor-composicao")).toBe(false);
    expect(mockTema.montou).toBe(0);
  });

  test("sem fichas: 'Ir para o Catálogo' leva a /studio/estoque", async () => {
    mockListFichas.mockResolvedValue({ compositions: [], count: 0 });
    const tree = await montar(<StudioInsumos />);
    await abrirAbaFichas(tree);
    const cta = porId(tree, "vazio-cta");
    expect(cta[0].props.accessibilityLabel).toBe("Ir para o Catálogo");
    await act(async () => { cta[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/studio/estoque");
  });

  test("os textos padrão são os do Studio de antes do p-178", () => {
    expect(TEXTOS_DOS_INSUMOS_NO_STUDIO).toEqual({
      titulo: "Estoque do estúdio",
      dicaDasFichas: "Toque numa ficha para editar no Catálogo. O editor canônico fica na tela de produto.",
      semFichas: "Crie fichas técnicas pelo Catálogo — abra um produto e expanda a seção Ficha Técnica.",
      irParaOCatalogo: "Ir para o Catálogo",
      rotuloDaFicha: "Editar ficha de {produto} no Catálogo",
    });
  });

  test("o painel da ficha técnica vai a /studio/insumos quando ninguém passa outro destino", () => {
    const fonte = ler("components/studio/StudioFichaTecnicaPanel.tsx");
    expect(fonte).toMatch(/if \(aoIrParaInsumos\) aoIrParaInsumos\(\);\s*else router\.push\("\/studio\/insumos"\);/);
    expect(fonte.match(/router\.push\("\/studio\/insumos"\)/g)?.length).toBe(1);
  });
});

describe("trava ligada: a Ficha técnica no cadastro do item", () => {
  test("edição do produto mostra a seção e abre a ficha do Studio por cima", async () => {
    ligarTudo();
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(tree, "secao-composicao")).toBe(true);
    expect(mockRefreshMe).toHaveBeenCalled();
    await act(async () => { porId(tree, "abrir-composicao")[0].props.onPress(); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(tem(tree, "editor-composicao")).toBe(true);
    expect(porId(tree, "painel-da-ficha")[0].props.dados).toEqual(expect.objectContaining({
      productId: "p-1", companyId: "loja-1", productName: "Caneca com nome",
    }));
    await act(async () => { porId(tree, "fechar-composicao")[0].props.onPress(); });
    expect(tem(tree, "editor-composicao")).toBe(false);
  });

  test("Escape com a ficha aberta não fecha o cadastro", async () => {
    ligarTudo();
    const onClose = jest.fn();
    const tree = await montar(<ItemFormModal visible onClose={onClose} editProduct={CANECA} />);
    await act(async () => { porId(tree, "abrir-composicao")[0].props.onPress(); });
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();
    expect(tem(tree, "editor-composicao")).toBe(true);
  });

  test("Essencial (sem personalizados.insumos), consolidado ou cadastro novo: some", async () => {
    ligarTudo();
    mockVisiveis.set = new Set<string>(["estoque"]);
    const essencial = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(essencial, "secao-composicao")).toBe(false);

    ligarTudo();
    mockAuth.consolidatedView = true;
    const consolidado = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} />);
    expect(tem(consolidado, "secao-composicao")).toBe(false);

    mockAuth.consolidatedView = false;
    const novo = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    expect(tem(novo, "secao-composicao")).toBe(false);
  });

  test("item do grupo que é de outra loja: só o aviso, sem o botão", async () => {
    ligarTudo();
    const doGrupo = { ...CANECA, isGroupShared: true, ownerCompanyId: "loja-matriz" };
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={doGrupo} />);
    expect(tem(tree, "secao-composicao")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain(TEXTOS_DA_COMPOSICAO.doGrupo);
    expect(tem(tree, "abrir-composicao")).toBe(false);
  });
});

describe("chaves e menu", () => {
  test("personalizados.insumos: plano Negócio, permissão personalizados.access e fora dos ocultos", () => {
    expect(MODULE_PLAN_MAP[MOD_DOS_INSUMOS]).toBe("negocio");
    expect(PERM_TO_MODULES["personalizados.access"]).toContain(MOD_DOS_INSUMOS);
    expect(MODULOS_OCULTOS.has(MOD_DOS_INSUMOS)).toBe(false);
    expect(ler("app/(tabs)/_layout.tsx")).toContain('{ r: "/personalizados/insumos", l: "Insumos", ic: "package", mod: "personalizados.insumos", personalizadosToggle: true }');
  });

  test("regras: frente, módulo e loja única", () => {
    mockTrava.liberado = true;
    const base = { settings: { studio_enabled: true }, verticalActive: null, visiveis: new Set([MOD_DOS_INSUMOS]), consolidado: false };
    expect(insumosNoNegocioLigados(base)).toBe(true);
    expect(insumosNoNegocioLigados({ ...base, consolidado: true })).toBe(false);
    expect(insumosNoNegocioLigados({ ...base, visiveis: new Set<string>() })).toBe(false);
    expect(insumosNoNegocioLigados({ ...base, verticalActive: "studio" })).toBe(false);
    expect(insumosNoNegocioLigados({ ...base, settings: {} })).toBe(false);
    mockTrava.liberado = false;
    expect(insumosNoNegocioLigados(base)).toBe(false);
  });
});
