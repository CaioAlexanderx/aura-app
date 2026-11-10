// ============================================================
// NFS-e no cadastro do serviço (10/11/2026)
// Mockup aprovado: docs/mockups/nfse-cadastro-servico.html (telas 1 e 2).
//
// O que estes testes seguram:
//   1. regras: formatação, validação igual à do backend (só dígitos, 6/9/3/6),
//      código pela metade trava o Salvar, vazio vira null no corpo;
//   2. a Lista de Serviços Nacional oficial: 338 códigos de 6 dígitos sem
//      repetição, sinônimos só para códigos que existem, busca por palavra;
//   3. o modal: a seção aparece só em serviço e só para quem emite NFS-e;
//      vazio não trava, 5 dígitos → erro e Salvar travado; o Salvar manda os campos (vazio → null) e o produto não
//      manda nenhum; a alíquota do ISS não aparece; nota do grupo;
//   4. a lista do Estoque: selo só em serviço sem código e só para quem
//      emite NFS-e.
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

// useQuery: só a config de NFS-e responde (is_active controlado pelo teste).
let mockEmiteNfse = true;
const mockChavesConsultadas: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    mockChavesConsultadas.push({ key: o.queryKey, enabled: o.enabled, queryFn: o.queryFn });
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
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  companiesApi: { checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }) },
  request: (...a: any[]) => mockRequest(...a),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: jest.fn(), list: jest.fn() } }));
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: jest.fn().mockResolvedValue({}) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));
// O import() sob demanda não roda no Jest sem --experimental-vm-modules: aqui
// a lista chega na hora, a mesma do arquivo gerado.
jest.mock("@/hooks/useListaServicosNfse", () => {
  const m = jest.requireActual("@/constants/nfseListaServicos");
  const lista = { linhas: m.LISTA_SERVICOS_NACIONAL, itens: m.ITENS_DA_LISTA };
  return {
    carregarListaServicosNfse: () => Promise.resolve(lista),
    useListaServicosNfse: () => ({ lista, erro: false }),
  };
});

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { servicosSemCodigoNfse, avisoDoFiltroNfse } from "@/components/screens/estoque/nfseNaLista";
import { motivosQueBloqueiam, textoDoBloqueio } from "@/components/screens/estoque/item-form/types";
import { camposNfseDoCorpo } from "@/hooks/useProducts";
import { useEmiteNfse } from "@/hooks/useEmiteNfse";
import { LISTA_SERVICOS_NACIONAL, ITENS_DA_LISTA, FONTE_LISTA_SERVICOS } from "@/constants/nfseListaServicos";
import { SINONIMOS_NFSE } from "@/constants/nfseSinonimos";
import {
  NFSE_VAZIO, acharServico, bloqueiosDaNfse, buscarServicos, faltaCodigoNfse, fmtCodigoNfse, fmtNbs,
  gravacaoDaNfse, lerAliquotaIss, nfseDoProduto, seloDaNfse, statusDoCodigo, sugestaoPeloNome,
  type ListaNfse,
} from "@/utils/nfseServico";

const LISTA: ListaNfse = { linhas: LISTA_SERVICOS_NACIONAL, itens: ITENS_DA_LISTA };

// ── 1. Regras ────────────────────────────────────────────────
describe("regras da NFS-e do serviço", () => {
  test("formatação do código e do NBS (aceita pela metade)", () => {
    expect(fmtCodigoNfse("060101")).toBe("06.01.01");
    expect(fmtCodigoNfse("0601")).toBe("06.01");
    expect(fmtCodigoNfse("06.01.01")).toBe("06.01.01");
    expect(fmtNbs("115031000")).toBe("1.1503.10.00");
    expect(fmtNbs("11503")).toBe("1.1503");
  });

  test("estado e selo: vazio, parcial (5 dígitos), ok", () => {
    expect(statusDoCodigo("")).toBe("vazio");
    expect(statusDoCodigo("06010")).toBe("parcial");
    expect(statusDoCodigo("060101")).toBe("ok");
    expect(seloDaNfse("06010", true)).toEqual({ tom: "err", texto: "código incompleto" });
    expect(seloDaNfse("060101", false).tom).toBe("ok");
    expect(seloDaNfse("", true)).toEqual({ tom: "rec", texto: "falta o código" });
    expect(seloDaNfse("", false)).toEqual({ tom: "", texto: "opcional" });
  });

  test("5 dígitos trava o Salvar; vazio não trava (como o NCM)", () => {
    expect(bloqueiosDaNfse({ ...NFSE_VAZIO, ctribnac: "06010" })).toEqual(["o código da nota de serviço com 6 números"]);
    expect(bloqueiosDaNfse({ ...NFSE_VAZIO })).toEqual([]);
    expect(bloqueiosDaNfse({ ...NFSE_VAZIO, ctribnac: "060101", cnbs: "1150" })).toEqual(["o NBS com 9 números"]);
    expect(bloqueiosDaNfse({ ...NFSE_VAZIO, cst: "00", cclasstrib: "0001", cindop: "1" })).toHaveLength(3);
    const motivos = [...motivosQueBloqueiam({ nome: "Corte", preco: 80, isProduto: false }), ...bloqueiosDaNfse({ ...NFSE_VAZIO, ctribnac: "06010" })];
    expect(textoDoBloqueio(motivos)).toBe("Falta o código da nota de serviço com 6 números para salvar");
  });

  test("gravação: vazio vira null; a alíquota só entra quando está na tela", () => {
    const g = gravacaoDaNfse({ ...NFSE_VAZIO, ctribnac: "060101", descricao: "  Corte de cabelo feminino ", aliquotaIss: "5" });
    expect(g).toEqual({
      nfseCtribnac: "060101", nfseCnbs: null, nfseDescricao: "Corte de cabelo feminino",
      ibscbsCst: null, ibscbsCclasstrib: null, ibscbsCindop: null,
    });
    expect("nfseAliquotaIss" in g).toBe(false);
    expect(gravacaoDaNfse({ ...NFSE_VAZIO, aliquotaIss: "2,5" }, true).nfseAliquotaIss).toBe(2.5);
    expect(lerAliquotaIss("6")).toBeNull();
    expect(lerAliquotaIss("2.5%")).toBe(2.5);
  });

  test("corpo da requisição: snake_case do backend; undefined some, null limpa", () => {
    const corpo = camposNfseDoCorpo({ nfseCtribnac: "060101", nfseCnbs: null, nfseDescricao: "" } as any);
    expect(corpo).toEqual({ nfse_ctribnac: "060101", nfse_cnbs: null, nfse_descricao: null });
    expect(camposNfseDoCorpo({ name: "Vestido" } as any)).toEqual({});
  });

  test("semente a partir do produto gravado", () => {
    expect(nfseDoProduto({ nfseCtribnac: "060101", nfseAliquotaIss: 2.5, ibscbsCst: "000" })).toMatchObject({
      ctribnac: "060101", aliquotaIss: "2,5", cst: "000", cnbs: "", descricao: "",
    });
    expect(nfseDoProduto(null)).toEqual(NFSE_VAZIO);
  });

  test("selo da lista: serviço sem código, só para quem emite NFS-e", () => {
    expect(faltaCodigoNfse({ unit: "srv", nfseCtribnac: null }, true)).toBe(true);
    expect(faltaCodigoNfse({ unit: "srv", nfseCtribnac: "06010" }, true)).toBe(true);
    expect(faltaCodigoNfse({ unit: "srv", nfseCtribnac: "060101" }, true)).toBe(false);
    expect(faltaCodigoNfse({ unit: "un", nfseCtribnac: null }, true)).toBe(false);
    expect(faltaCodigoNfse({ unit: "srv", nfseCtribnac: null }, false)).toBe(false);
    const itens = [{ unit: "srv", nfseCtribnac: null }, { unit: "srv", nfseCtribnac: "060101" }, { unit: "un" }];
    expect(servicosSemCodigoNfse(itens, true)).toHaveLength(1);
    expect(servicosSemCodigoNfse(itens, false)).toHaveLength(0);
    expect(avisoDoFiltroNfse(2, true).forte).toBe("2 serviços estão sem o código da nota de serviço.");
    expect(avisoDoFiltroNfse(1, false).resto).not.toContain("grupo");
  });
});

// ── 2. Lista oficial ─────────────────────────────────────────
describe("Lista de Serviços Nacional (Anexo B v1.01)", () => {
  test("338 códigos de 6 dígitos, sem repetição, com o item no título", () => {
    expect(FONTE_LISTA_SERVICOS.versao).toBe("v1.01-20260122");
    expect(LISTA_SERVICOS_NACIONAL).toHaveLength(338);
    const codigos = LISTA_SERVICOS_NACIONAL.map((l) => l[0]);
    codigos.forEach((c) => expect(c).toMatch(/^\d{6}$/));
    expect(new Set(codigos).size).toBe(codigos.length);
    codigos.forEach((c) => expect(ITENS_DA_LISTA[c.slice(0, 2)]).toBeTruthy());
    expect(acharServico(LISTA, "060101")?.descricao).toBe("Barbearia, cabeleireiros, manicuros, pedicuros e congêneres.");
  });

  test("todo sinônimo aponta para um código que existe na lista oficial", () => {
    const existe = new Set(LISTA_SERVICOS_NACIONAL.map((l) => l[0]));
    Object.keys(SINONIMOS_NFSE).forEach((c) => expect(existe.has(c)).toBe(true));
  });

  test("busca por palavra e pelo começo do código", () => {
    expect(buscarServicos(LISTA, "corte de cabelo")[0].codigo).toBe("060101");
    expect(buscarServicos(LISTA, "manutenção de computador").map((r) => r.codigo)).toContain("010701");
    expect(buscarServicos(LISTA, "consultoria").map((r) => r.codigo)).toContain("170101");
    expect(buscarServicos(LISTA, "0601").map((r) => r.codigo)).toEqual(["060101"]);
    expect(buscarServicos(LISTA, "xyzw")).toEqual([]);
    expect(sugestaoPeloNome(LISTA, "Corte feminino")?.codigo).toBe("060101");
    expect(sugestaoPeloNome(LISTA, "Limpeza de pele")?.codigo).toBe("060201");
  });

  test("o hook carrega a lista com import() sob demanda (fora do bundle inicial)", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "hooks/useListaServicosNfse.ts"), "utf8");
    expect(src).toContain('import("@/constants/nfseListaServicos")');
    const util = require("fs").readFileSync(require("path").join(__dirname, "..", "utils/nfseServico.ts"), "utf8");
    expect(util).toMatch(/import type \{ LinhaDaLista \} from "@\/constants\/nfseListaServicos"/);
  });
});

// ── 3. O modal ───────────────────────────────────────────────
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
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
function preencherServico(tree: any) {
  act(() => { inputPorPlaceholder(tree, "Ex.: Corte feminino, Manicure, Consultoria").props.onChangeText("Corte feminino"); });
  const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
  act(() => { precos[0].props.onChangeText("8000"); });
}

const SERVICO: any = {
  id: "srv-1", name: "Corte feminino", code: "SRV-1", barcode: "", category: "Servicos", price: 80,
  cost: 0, stock: 0, minStock: 0, unit: "srv", brand: "", notes: "", color: "", size: "",
  durationMinutes: 45, nfseCtribnac: null, isGroupShared: false,
};

beforeEach(() => {
  mockAuth = { company: { id: "empresa-1" }, token: "t" };
  mockRequest.mockReset();
  mockEmiteNfse = true;
  mockChavesConsultadas.length = 0;
  mockAddProduct.mockReset().mockResolvedValue({ id: "novo-1" });
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  (global as any).innerWidth = 1024;
});

describe("ItemFormModal — seção Nota de serviço (NFS-e)", () => {
  test("aparece no serviço, com o aviso âmbar e a ajuda do contador/WhatsApp", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    expect(tem(tree, "secao-nfse")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("Nota de serviço (NFS-e)");
    expect(t).toContain("Você emite nota de serviço.");
    expect(t).toContain("Em caso de dúvidas, acione seu contador ou o suporte Aura");
    expect(t).toContain("WhatsApp (11) 95630-5269");
    // Exceção ao mockup: a alíquota do ISS não aparece.
    expect(t).not.toContain("Alíquota de ISS");
    expect(tem(tree, "nfse-iss")).toBe(false);
    tree.unmount();
  });

  test("não aparece no produto, e o produto nem pergunta pela config de NFS-e", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    expect(tem(tree, "secao-nfse")).toBe(false);
    expect(texto(tree)).not.toContain("NFS-e");
    expect(mockChavesConsultadas.filter((c) => c.key[0] === "nfse-config" && c.enabled)).toHaveLength(0);
    tree.unmount();
  });

  test("quem não emite NFS-e: a seção some e o Salvar não manda nem trava nada dela", async () => {
    mockEmiteNfse = false;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    expect(tem(tree, "secao-nfse")).toBe(false);
    expect(texto(tree)).not.toContain("NFS-e");
    preencherServico(tree);
    await act(async () => { await botao(tree, "Salvar serviço").props.onPress(); });
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo.unit).toBe("srv");
    expect(camposNfseDoCorpo(corpo)).toEqual({});
    tree.unmount();
  });

  test("código vazio não trava o Salvar do serviço", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    preencherServico(tree);
    expect(botao(tree, "Salvar serviço").props.disabled).toBeFalsy();
    await act(async () => { await botao(tree, "Salvar serviço").props.onPress(); });
    expect(mockAddProduct.mock.calls[0][0].nfseCtribnac).toBeNull();
    tree.unmount();
  });

  test("5 dígitos: erro no campo e Salvar travado", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    preencherServico(tree);
    act(() => { campo(tree, "nfse-codigo").props.onChangeText("06.01.0"); });
    expect(tem(tree, "nfse-codigo-erro")).toBe(true);
    expect(texto(tree)).toContain("Falta o código da nota de serviço com 6 números para salvar");
    const salvar = botao(tree, "Salvar serviço");
    expect(salvar.props.disabled).toBe(true);
    tree.unmount();
  });

  test("o Salvar manda os campos: código com 6 dígitos e o resto vazio como null", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    preencherServico(tree);
    act(() => { campo(tree, "nfse-codigo").props.onChangeText("060101"); });
    expect(tem(tree, "nfse-codigo-escolhido")).toBe(true);
    await act(async () => { await botao(tree, "Salvar serviço").props.onPress(); });
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    const corpo = mockAddProduct.mock.calls[0][0];
    expect(corpo.unit).toBe("srv");
    expect(corpo).toMatchObject({
      nfseCtribnac: "060101", nfseCnbs: null, nfseDescricao: null,
      ibscbsCst: null, ibscbsCclasstrib: null, ibscbsCindop: null,
    });
    expect(corpo.nfseAliquotaIss).toBeUndefined();
    expect(camposNfseDoCorpo(corpo)).toEqual({
      nfse_ctribnac: "060101", nfse_cnbs: null, nfse_descricao: null,
      ibscbs_cst: null, ibscbs_cclasstrib: null, ibscbs_cindop: null,
    });
    tree.unmount();
  });

  test("busca por palavra: escolher na lista preenche o código", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" />);
    preencherServico(tree);
    act(() => { campo(tree, "nfse-codigo").props.onChangeText("corte de cabelo"); });
    expect(tem(tree, "nfse-busca-resultados")).toBe(true);
    const op = porId(tree, "nfse-opcao-060101");
    expect(op).toBeTruthy();
    act(() => { op.props.onPress(); });
    expect(campo(tree, "nfse-codigo").props.value).toBe("06.01.01");
    expect(tem(tree, "nfse-busca-resultados")).toBe(false);
    tree.unmount();
  });

  test("produto: o Salvar não manda nenhum campo de NFS-e", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="product" />);
    act(() => { inputPorPlaceholder(tree, "Ex.: Vestido midi floral").props.onChangeText("Vestido midi"); });
    const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
    act(() => { precos[0].props.onChangeText("18990"); });
    await act(async () => { await botao(tree, "Salvar produto").props.onPress(); });
    const corpo = mockAddProduct.mock.calls[0][0];
    ["nfseCtribnac", "nfseCnbs", "nfseDescricao", "nfseAliquotaIss", "ibscbsCst", "ibscbsCclasstrib", "ibscbsCindop"]
      .forEach((k) => expect(k in corpo).toBe(false));
    expect(camposNfseDoCorpo(corpo)).toEqual({});
    tree.unmount();
  });

  test("edição: semeia o que está gravado; serviço do grupo mostra a nota do grupo", async () => {
    const tree = await montar(
      <ItemFormModal visible onClose={jest.fn()} editProduct={{ ...SERVICO, nfseCtribnac: "060101", nfseCnbs: "115031000", isGroupShared: true }} />
    );
    expect(campo(tree, "nfse-codigo").props.value).toBe("06.01.01");
    expect(campo(tree, "nfse-nbs").props.value).toBe("1.1503.10.00");
    expect(tem(tree, "nfse-nota-grupo")).toBe(true);
    expect(texto(tree)).toContain("valem para todas as lojas do grupo");
    tree.unmount();
  });

  test("serviço só desta loja: sem a nota do grupo", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={SERVICO} />);
    expect(tem(tree, "secao-nfse")).toBe(true);
    expect(tem(tree, "nfse-nota-grupo")).toBe(false);
    tree.unmount();
  });
});

// ── critério "emite NFS-e" no multi-CNPJ ─────────────────────
describe("useEmiteNfse — consolidado: basta uma loja do grupo emitir", () => {
  function Sonda({ ativo }: { ativo: boolean }) {
    useEmiteNfse(ativo);
    return null;
  }
  function consultaDoGrupo() {
    return mockChavesConsultadas.filter((c) => c.key[0] === "nfse-config-grupo" && c.enabled).pop();
  }

  test("uma loja: só a config da empresa ativa; o grupo nem é consultado", async () => {
    const tree = await montar(<Sonda ativo />);
    expect(mockChavesConsultadas.some((c) => c.key[0] === "nfse-config" && c.key[1] === "empresa-1" && c.enabled)).toBe(true);
    expect(consultaDoGrupo()).toBeUndefined();
    tree.unmount();
  });

  test("consolidado: true se ao menos uma loja emite; falha conta como não emite", async () => {
    mockAuth = { company: null, token: "t", consolidatedView: true, availableCompanies: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    const tree = await montar(<Sonda ativo />);
    const q = consultaDoGrupo();
    expect(q).toBeTruthy();
    mockRequest.mockImplementation((url: string) => {
      if (url.includes("/a/")) return Promise.reject(new Error("403"));
      if (url.includes("/b/")) return Promise.resolve({ config: { is_active: true } });
      return Promise.resolve({ config: null, has_config: false });
    });
    await expect(q.queryFn()).resolves.toBe(true);
    mockRequest.mockImplementation(() => Promise.resolve({ config: { is_active: false } }));
    await expect(q.queryFn()).resolves.toBe(false);
    expect(mockChavesConsultadas.some((c) => c.key[0] === "nfse-config" && c.enabled)).toBe(false);
    tree.unmount();
  });

  test("desligado (produto, loja sem serviço): nenhuma consulta", async () => {
    const tree = await montar(<Sonda ativo={false} />);
    expect(mockChavesConsultadas.some((c) => c.enabled)).toBe(false);
    tree.unmount();
  });
});

// ── 4. Lista do Estoque ──────────────────────────────────────
describe("lista do Estoque — selo 'Falta código da NFS-e'", () => {
  test("serviço sem código, loja que emite: selo", async () => {
    const tree = await montar(<ProductRow product={SERVICO} emiteNfse />);
    expect(tem(tree, "selo-falta-nfse")).toBe(true);
    expect(texto(tree)).toContain("Falta código da NFS-e");
    tree.unmount();
  });

  test("serviço com código, produto e loja que não emite: sem selo", async () => {
    for (const el of [
      <ProductRow key="a" product={{ ...SERVICO, nfseCtribnac: "060101" }} emiteNfse />,
      <ProductRow key="b" product={{ ...SERVICO, unit: "un", category: "Roupas", stock: 5 }} emiteNfse />,
      <ProductRow key="c" product={SERVICO} emiteNfse={false} />,
      <ProductRow key="d" product={SERVICO} />,
    ]) {
      const tree = await montar(el);
      expect(tem(tree, "selo-falta-nfse")).toBe(false);
      tree.unmount();
    }
  });
});
