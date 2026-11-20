// ============================================================
// "Em quais lojas este produto entra?" no ItemFormModal (20/11/2026, A1).
// Plano empresa-do-produto (D1–D15) e mockup aprovado.
//
//   1. regras puras (lojasDoCadastro.ts): quando o campo existe, rodapé,
//      corpo da cópia, resultado por loja;
//   2. D9: loja sem grupo (ou funcionário de uma loja só) não vê nada e o
//      corpo do POST /products é IDÊNTICO ao de hoje, sem cópia;
//   3. D12: grupo com estoque único mostra só o aviso, sem cópia;
//   4. 2 lojas: a ativa marcada e fixa, estoque por loja, "Salvar nas 2
//      lojas", corpo do POST igual ao de uma loja, cópia SÓ depois da fila
//      de fotos, resultado por loja com "Tentar de novo";
//   5. grade: seletor de loja, cada loja com as suas quantidades, cópia
//      com o id de cada variante da origem.
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

let mockLojasResp: any = undefined;
const mockQueryKeys: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    mockQueryKeys.push({ key: o.queryKey, enabled: o.enabled });
    if (o.queryKey && o.queryKey[0] === "lojas-para-cadastro") {
      return { data: o.enabled === false ? undefined : mockLojasResp, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "matriz" }, token: "t" }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));

const mockAddProduct = jest.fn();
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [], addProduct: mockAddProduct, updateProduct: jest.fn() }),
}));
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));

const mockVariants = jest.fn();
jest.mock("@/services/api", () => ({
  companiesApi: {
    checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }),
    variants: (...a: any[]) => mockVariants(...a),
  },
  request: jest.fn(),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
const mockUpload = jest.fn();
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: (...a: any[]) => mockUpload(...a), list: jest.fn() } }));
const mockSaveVariations = jest.fn();
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: (...a: any[]) => mockSaveVariations(...a) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));
const mockCopiar = jest.fn();
jest.mock("@/services/lojasDoProdutoApi", () => ({
  lojasDoProdutoApi: {
    lojasParaCadastro: jest.fn(),
    copiarParaLojas: (...a: any[]) => mockCopiar(...a),
  },
}));

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import {
  campoDeLojas, fraseDoRodape, pedidoDeCopia, idsDasVariantes, linhaDoResultado, rotuloSalvarNasLojas, linhasDeFalhaGeral,
} from "@/components/screens/estoque/item-form/lojasDoCadastro";

const MATRIZ = { company_id: "matriz", nome: "Matriz", ativa: true, regime: "simples", limite: { usados: 1, maximo: null } };
const FILIAL = { company_id: "filial", nome: "Filial Centro", ativa: false, regime: "simples", limite: { usados: 1, maximo: null } };

// Texto na ordem em que aparece, com os <Text> aninhados no lugar deles.
function textoDe(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node.children || []).map(textoDe).join("");
}
function textoTodo(tree: any): string {
  return textoDe(tree.root);
}
function botao(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && textoDe(n).indexOf(rotulo) >= 0)[0];
}
function porTestID(tree: any, id: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: true })[0];
}
function comProp(tree: any, prop: string): any {
  return tree.root.findAll((n: any) => n.props && typeof n.props[prop] === "function")[0];
}
function inputPorPlaceholder(tree: any, ph: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.placeholder === ph && typeof n.props.onChangeText === "function")[0];
}

function montar(onClose = jest.fn()) {
  let tree: any;
  act(() => { tree = renderer.create(<ItemFormModal visible onClose={onClose} />); });
  return tree;
}

function preencher(tree: any) {
  act(() => { inputPorPlaceholder(tree, "Ex.: Vestido midi floral").props.onChangeText("Vestido midi linho"); });
  const precos = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function");
  act(() => { precos[0].props.onChangeText("18990"); });
  act(() => { comProp(tree, "onEstoque").props.onEstoque("12"); });
  act(() => { comProp(tree, "onMinimo").props.onMinimo("3"); });
}

async function clicar(node: any) {
  await act(async () => { await node.props.onPress(); });
}

async function salvarCom(rotulo: string, tree: any) {
  await clicar(botao(tree, rotulo));
  // a cópia roda solta depois do Salvar: deixa as promessas andarem
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  mockLojasResp = undefined;
  mockQueryKeys.length = 0;
  mockAddProduct.mockReset().mockResolvedValue({ id: "p-novo" });
  mockUpload.mockReset().mockResolvedValue({});
  mockSaveVariations.mockReset().mockResolvedValue({});
  mockVariants.mockReset();
  mockCopiar.mockReset().mockResolvedValue({
    master_sku: "AURA-1",
    resultados: [{ company_id: "filial", nome: "Filial Centro", status: "criado", product_id: "p-filial", stock_qty: 0, avisos: [] }],
  });
  (global as any).innerWidth = 1024;
});

// ── 1. regras puras ───────────────────────────────────────────
describe("lojasDoCadastro — regras", () => {
  test("o campo só existe com 2 ou mais lojas e com a ativa na lista", () => {
    expect(campoDeLojas(undefined, "matriz").modo).toBe("nenhum");
    expect(campoDeLojas({ estoque_unico: false, lojas: [MATRIZ] }, "matriz").modo).toBe("nenhum");
    expect(campoDeLojas({ estoque_unico: false, lojas: [MATRIZ, FILIAL] }, "outra").modo).toBe("nenhum");
    expect(campoDeLojas({ estoque_unico: false, lojas: [MATRIZ, MATRIZ] }, "matriz").modo).toBe("nenhum");
    const c = campoDeLojas({ estoque_unico: false, lojas: [FILIAL, MATRIZ] }, "matriz");
    expect(c.modo).toBe("escolha");
    expect(c.lojas.map((l) => l.company_id)).toEqual(["matriz", "filial"]);
    expect(campoDeLojas({ estoque_unico: true, lojas: [MATRIZ, FILIAL] }, "matriz").modo).toBe("aviso");
  });

  test("rodapé e botão com os textos do mockup", () => {
    expect(fraseDoRodape([{ nome: "Matriz", qtd: 12 }], false)).toEqual({ antes: "Entra na ", forte: "Matriz", depois: "." });
    expect(fraseDoRodape([{ nome: "Matriz", qtd: 12 }, { nome: "Filial Centro", qtd: 0 }], false))
      .toEqual({ antes: "Entra em ", forte: "2 lojas", depois: ": Matriz (12) e Filial Centro (0)." });
    expect(fraseDoRodape([{ nome: "Matriz", qtd: 12 }, { nome: "Filial Centro", qtd: 0 }], true))
      .toEqual({ antes: "Entra em ", forte: "2 lojas", depois: "" });
    expect(rotuloSalvarNasLojas(2)).toBe("Salvar nas 2 lojas");
  });

  test("cópia com grade leva o id de cada variante da origem; sem id com peças, não sai", () => {
    const ids = idsDasVariantes([
      { id: "v1", attributes: [{ attribute: "Cor", value: "#111111" }, { attribute: "Tamanho", value: "P" }] },
      { id: "v2", attributes: [{ attribute: "Cor", value: "#111111" }, { attribute: "Tamanho", value: "M" }] },
    ]);
    expect(ids).toEqual({ "#111111|P": "v1", "#111111|M": "v2" });
    const ok = pedidoDeCopia([{ company_id: "filial", estoque: { tipo: "grade", matriz: { "#111111|P": 2, "#111111|M": 0 } } }], ids);
    expect(ok.faltouVariante).toBe(false);
    expect(ok.pedido).toEqual({ lojas: [{ company_id: "filial", stock_qty: 2, variantes: [{ variant_id: "v1", stock_qty: 2 }, { variant_id: "v2", stock_qty: 0 }] }] });
    const falta = pedidoDeCopia([{ company_id: "filial", estoque: { tipo: "grade", matriz: { "#222222|P": 1 } } }], ids);
    expect(falta.faltouVariante).toBe(true);
  });

  test("resultado: código em uso e limite do plano não oferecem 'Tentar de novo'; erro inesperado sim", () => {
    const uso = linhaDoResultado({
      company_id: "filial", nome: "Filial Centro", status: "erro", product_id: null, stock_qty: 0,
      erro: { code: "BARCODE_EM_USO", message: "O código 7891234567895 já está no produto \"Vestido linho bege\" desta loja." },
    });
    expect(uso.podeTentar).toBe(false);
    expect(uso.texto).toContain("Vestido linho bege");
    const limite = linhaDoResultado({ company_id: "filial", nome: "F", status: "erro", product_id: null, stock_qty: 0, erro: { code: "LIMITE_PLANO", message: "" } });
    expect(limite.podeTentar).toBe(false);
    expect(limite.texto).toBe("Não deu para criar nesta loja. Tente de novo.");
    expect(linhaDoResultado({ company_id: "filial", nome: "F", status: "criado", product_id: "x", stock_qty: 1 }).texto).toBe("Criado com 1 peça");
    // Contrato (Mudanças de 20/11): código interno em uso, sem acesso e limite também não repetem.
    ["CODIGO_EM_USO", "SEM_ACESSO", "LIMITE_PLANO", "MESMA_LOJA"].forEach((code) => {
      expect(linhaDoResultado({ company_id: "f", nome: "F", status: "erro", product_id: null, stock_qty: 0, erro: { code, message: "m" } }).podeTentar).toBe(false);
    });
    expect(linhaDoResultado({ company_id: "f", nome: "F", status: "erro", product_id: null, stock_qty: 0, erro: { code: "ERRO_AO_CRIAR", message: "m" } }).podeTentar).toBe(true);
  });

  test("falha do pedido inteiro: rede repete; recusa com código mostra o texto do servidor e não repete", () => {
    const lojas = [{ company_id: "filial", nome: "Filial Centro" }];
    expect(linhasDeFalhaGeral(lojas, new Error("rede"))[0]).toMatchObject({ podeTentar: true, texto: "Não deu para criar nesta loja. Tente de novo." });
    expect(linhasDeFalhaGeral(lojas, { status: 409, code: "TENTE_DE_NOVO", message: "x" })[0].podeTentar).toBe(true);
    const compart = linhasDeFalhaGeral(lojas, { status: 409, code: "PRODUTO_COMPARTILHADO", message: "Este produto já aparece em todas as lojas." })[0];
    expect(compart).toMatchObject({ podeTentar: false, texto: "Este produto já aparece em todas as lojas." });
  });
});

// ── 2. D9: nada muda para quem tem uma loja só ────────────────
describe("D9 — loja sem grupo: o cadastro é o de hoje", () => {
  async function corpoDoPost(resp: any) {
    mockLojasResp = resp;
    mockAddProduct.mockClear();
    const onClose = jest.fn();
    const tree = montar(onClose);
    expect(textoTodo(tree)).not.toContain("Em quais lojas");
    expect(textoTodo(tree)).not.toContain("Entra na");
    await salvarCom("Salvar produto", (preencher(tree), tree));
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    const corpo = mockAddProduct.mock.calls[0][0];
    tree.unmount();
    return corpo;
  }

  test("sem resposta, com 1 loja, ou com a ativa fora da lista: corpo idêntico e nenhuma cópia", async () => {
    const hoje = await corpoDoPost(undefined);
    const umaLoja = await corpoDoPost({ estoque_unico: false, lojas: [MATRIZ] });
    const semAtiva = await corpoDoPost({ estoque_unico: false, lojas: [{ ...FILIAL }, { ...FILIAL, company_id: "outra" }] });
    const { id: _a, ...a } = hoje;
    const { id: _b, ...b } = umaLoja;
    const { id: _c, ...c } = semAtiva;
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(Object.keys(hoje)).not.toContain("lojas");
    expect(mockCopiar).not.toHaveBeenCalled();
  });

  test("a lista de lojas é pedida ao servidor ao abrir o cadastro, não lida do token", () => {
    const tree = montar();
    const q = mockQueryKeys.find((k) => k.key[0] === "lojas-para-cadastro");
    expect(q).toBeTruthy();
    expect(q.key[1]).toBe("matriz");
    expect(q.enabled).toBe(true);
    tree.unmount();
  });
});

// ── 3. D12: estoque único ─────────────────────────────────────
describe("D12 — grupo com estoque único", () => {
  test("só o aviso, sem caixas; corpo igual e nenhuma cópia", async () => {
    mockLojasResp = { estoque_unico: true, lojas: [MATRIZ, FILIAL] };
    const tree = montar();
    expect(textoTodo(tree)).toContain("As suas lojas usam um estoque só. Este produto aparece em todas.");
    expect(porTestID(tree, "loja-opcao-filial")).toBeUndefined();
    preencher(tree);
    await salvarCom("Salvar produto", tree);
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(mockCopiar).not.toHaveBeenCalled();
    tree.unmount();
  });
});

// ── 4. duas lojas ─────────────────────────────────────────────
describe("duas lojas no grupo", () => {
  beforeEach(() => { mockLojasResp = { estoque_unico: false, lojas: [MATRIZ, FILIAL] }; });

  test("a ativa vem marcada e fixa; a outra desmarcada; o rodapé diz a loja", () => {
    const tree = montar();
    const t = textoTodo(tree);
    expect(t).toContain("Em quais lojas este produto entra?");
    expect(t).toContain("Você está aqui");
    expect(t).toContain("Cada loja tem o seu estoque. Marque outra loja para o produto nascer nela também.");
    // O Pressable de cada loja (o que leva o estado para o leitor de tela).
    const caixa = (id: string) => tree.root.findAll((n: any) => n.props && n.props.testID === id && n.props.accessibilityState)[0];
    const matriz = caixa("loja-opcao-matriz");
    const filial = caixa("loja-opcao-filial");
    expect(matriz.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(filial.props.accessibilityState).toEqual({ checked: false, disabled: false });
    preencher(tree);
    expect(textoDe(porTestID(tree, "rodape-lojas"))).toContain("Entra na Matriz.");
    expect(botao(tree, "Salvar e cadastrar outro")).toBeTruthy();
    tree.unmount();
  });

  test("celular: título curto e rodapé só com o número de lojas", () => {
    (global as any).innerWidth = 375;
    const tree = montar();
    expect(textoTodo(tree)).toContain("Em quais lojas entra?");
    preencher(tree);
    act(() => { porTestID(tree, "loja-opcao-filial").props.onPress(); });
    const rod = textoDe(porTestID(tree, "rodape-lojas"));
    expect(rod).toContain("Entra em 2 lojas");
    expect(rod).not.toContain("Matriz (");
    tree.unmount();
  });

  test("marcar a Filial: estoque por loja, 'Salvar nas 2 lojas', corpo igual ao de uma loja e cópia depois das fotos", async () => {
    // Corpo de referência: o mesmo cadastro com uma loja marcada.
    let tree = montar();
    preencher(tree);
    await salvarCom("Salvar produto", tree);
    const { id: _r, ...referencia } = mockAddProduct.mock.calls[0][0];
    tree.unmount();
    mockAddProduct.mockClear();

    tree = montar();
    preencher(tree);
    act(() => { porTestID(tree, "loja-opcao-filial").props.onPress(); });
    const t = textoTodo(tree);
    expect(t).toContain("O produto nasce nas 2 lojas, com o mesmo código de barras e o mesmo preço. Cada loja controla o seu estoque.");
    expect(t).toContain("Quantas peças em cada loja?");
    expect(t).toContain("Pode deixar 0 e transferir depois");
    expect(t).toContain("Estoque mínimo (vale para as duas)");
    expect(botao(tree, "Salvar e cadastrar outro")).toBeUndefined();
    act(() => { porTestID(tree, "estoque-loja-filial").props.onChangeText("3"); });
    expect(textoDe(porTestID(tree, "rodape-lojas"))).toContain("Entra em 2 lojas: Matriz (12) e Filial Centro (3).");

    // Uma foto na fila: a cópia só pode sair depois dela.
    let soltarFoto: () => void = () => {};
    mockUpload.mockImplementation(() => new Promise((r) => { soltarFoto = () => r({}); }));
    act(() => { comProp(tree, "onAdicionarPendente").props.onAdicionarPendente(null, "QUJD", "image/jpeg"); });

    await salvarCom("Salvar nas 2 lojas", tree);
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    const { id: _x, ...corpo } = mockAddProduct.mock.calls[0][0];
    expect(corpo).toEqual(referencia);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockCopiar).not.toHaveBeenCalled();
    expect(textoDe(porTestID(tree, "resultado-por-loja"))).toContain("Criando nesta loja…");

    await act(async () => { soltarFoto(); await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockCopiar).toHaveBeenCalledTimes(1);
    expect(mockCopiar.mock.calls[0][0]).toBe("matriz");
    expect(mockCopiar.mock.calls[0][1]).toBe("p-novo");
    expect(mockCopiar.mock.calls[0][2]).toEqual({ lojas: [{ company_id: "filial", stock_qty: 3 }] });
    const res = textoDe(porTestID(tree, "resultado-por-loja"));
    expect(res).toContain("Matriz");
    expect(res).toContain("Criado com 12 peças");
    expect(res).toContain("Filial Centro");
    expect(res).toContain("Criado com 0 peças");
    tree.unmount();
  });

  test("loja que falha mostra a mensagem e 'Tentar de novo' repete só ela", async () => {
    mockCopiar.mockReset()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({
        master_sku: "AURA-1",
        resultados: [{ company_id: "filial", nome: "Filial Centro", status: "criado", product_id: "p-filial", stock_qty: 3 }],
      });
    const onClose = jest.fn();
    const tree = montar(onClose);
    preencher(tree);
    act(() => { porTestID(tree, "loja-opcao-filial").props.onPress(); });
    act(() => { porTestID(tree, "estoque-loja-filial").props.onChangeText("3"); });
    await salvarCom("Salvar nas 2 lojas", tree);
    expect(textoDe(porTestID(tree, "resultado-por-loja"))).toContain("Não deu para criar nesta loja. Tente de novo.");
    // Concluir fecha o modal; Tentar de novo repete só a Filial.
    await clicar(porTestID(tree, "tentar-de-novo-filial"));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockCopiar).toHaveBeenCalledTimes(2);
    expect(mockCopiar.mock.calls[1][2]).toEqual({ lojas: [{ company_id: "filial", stock_qty: 3 }] });
    expect(textoDe(porTestID(tree, "resultado-por-loja"))).toContain("Criado com 3 peças");
    expect(onClose).not.toHaveBeenCalled();
    await clicar(porTestID(tree, "resultado-concluir"));
    expect(onClose).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("código já em uso na outra loja: a mensagem do servidor e nenhum 'Tentar de novo'", async () => {
    mockCopiar.mockReset().mockResolvedValue({
      master_sku: "AURA-1",
      resultados: [{
        company_id: "filial", nome: "Filial Centro", status: "erro", product_id: null, stock_qty: 0,
        erro: { code: "BARCODE_EM_USO", message: "O código 7891234567895 já está no produto \"Vestido linho bege\" desta loja.", produto_conflito: { id: "x", name: "Vestido linho bege" } },
      }],
    });
    const tree = montar();
    preencher(tree);
    act(() => { porTestID(tree, "loja-opcao-filial").props.onPress(); });
    await salvarCom("Salvar nas 2 lojas", tree);
    expect(textoDe(porTestID(tree, "resultado-por-loja"))).toContain("Vestido linho bege");
    expect(porTestID(tree, "tentar-de-novo-filial")).toBeUndefined();
    tree.unmount();
  });

  test("grade: seletor de loja, quantidades separadas e cópia com o id das variantes", async () => {
    mockVariants.mockResolvedValue({
      variants: [
        { id: "v-p", attributes: [{ attribute: "Cor", value: "#111111" }, { attribute: "Tamanho", value: "P" }] },
        { id: "v-m", attributes: [{ attribute: "Cor", value: "#111111" }, { attribute: "Tamanho", value: "M" }] },
      ],
    });
    const tree = montar();
    preencher(tree);
    act(() => { porTestID(tree, "loja-opcao-filial").props.onPress(); });
    const est = () => comProp(tree, "onStockMode");
    act(() => { est().props.onStockMode("variants"); });
    act(() => { est().props.onCores([{ hex: "#111111", name: "Preto" }]); });
    act(() => { est().props.onTamanhos(["P", "M"]); });
    // Matriz: P=2, M=3
    act(() => { est().props.onCelula("#111111|P", "2"); });
    act(() => { est().props.onCelula("#111111|M", "3"); });
    expect(textoTodo(tree)).toContain("Quantidades de qual loja?");
    expect(textoDe(porTestID(tree, "grade-seletor-de-loja"))).toContain("Matriz · 5");
    expect(textoTodo(tree)).toContain("As cores e os tamanhos são os mesmos nas duas lojas. Só a quantidade muda.");
    // Filial: P=1
    act(() => { porTestID(tree, "grade-da-loja-filial").props.onPress(); });
    expect(est().props.celulas).toEqual({});
    act(() => { est().props.onCelula("#111111|P", "1"); });
    expect(textoDe(porTestID(tree, "grade-seletor-de-loja"))).toContain("Filial Centro · 1");
    await salvarCom("Salvar nas 2 lojas", tree);
    // O PUT da grade é o da loja ativa, com as quantidades dela.
    expect(mockSaveVariations).toHaveBeenCalledTimes(1);
    expect(mockSaveVariations.mock.calls[0][2].matrix).toEqual({ "#111111|P": 2, "#111111|M": 3 });
    expect(mockAddProduct.mock.calls[0][0].stock).toBe(5);
    expect(mockVariants).toHaveBeenCalledWith("matriz", "p-novo");
    expect(mockCopiar.mock.calls[0][2]).toEqual({
      lojas: [{ company_id: "filial", stock_qty: 1, variantes: [{ variant_id: "v-p", stock_qty: 1 }, { variant_id: "v-m", stock_qty: 0 }] }],
    });
    tree.unmount();
  });
});
