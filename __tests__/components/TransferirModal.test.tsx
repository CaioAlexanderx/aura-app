// ============================================================
// Estoque · Transferir para outra loja (10/11/2026).
//
//   1. Botão "Transferir para outra loja" só com 2 lojas ou mais, numa loja
//      específica (nunca no consolidado, consulta ou demo).
//   2. Modal sem variantes e com variantes (um campo por cor/tamanho).
//   3. "Tudo" preenche o estoque atual.
//   4. Validação (texto, acima do disponível, peça inteira, sem destino).
//   5. Corpo do POST.
//   6. ESTOQUE_INSUFICIENTE destaca a linha com o disponível do servidor.
//   7. Lotes de 1.000: regra aqui; o envio em partes, com progresso, em
//      TransferirLotes.test.tsx (lote reduzido para a lista caber no teste).
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

var mockLargura = 1024;
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
jest.mock("@/components/screens/estoque/VariantesConsulta", () => ({ rotuloDaVariante: (v: any) => v.rotulo || "Variante" }));

const mockVariantes = jest.fn();
jest.mock("@/services/api", () => ({ companiesApi: { variants: (...a: any[]) => mockVariantes(...a) } }));
const mockCriar = jest.fn();
jest.mock("@/services/estoqueTransferenciasApi", () => ({
  estoqueTransferenciasApi: { criar: (...a: any[]) => mockCriar(...a) },
  codigoDoErro: (e: any) => (e && e.data && e.data.code) || null,
}));

import { TransferirModal, type ProdutoParaTransferir } from "@/components/screens/estoque/transferencia/TransferirModal";
import { BotaoTransferir } from "@/components/screens/estoque/transferencia/BotaoTransferir";
import { lojasDaTransferencia, lerQuantidade, dividirEmLotes, itensSemEstoque } from "@/utils/transferenciaEstoque";

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
async function digitar(tree: renderer.ReactTestRenderer, id: string, v: string) {
  await act(async () => { um(tree, id).props.onChangeText(v); });
}
function estilo(no: any): any {
  const st = no.props.style;
  return Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st;
}
function erroApi(status: number, data: any) {
  return Object.assign(new Error((data && data.error) || "erro"), { status, data });
}

const ORIGEM = { id: "c1", nome: "Loja Centro" };
const DESTINOS = [{ id: "c2", nome: "Loja Shopping" }];

const SIMPLES: ProdutoParaTransferir[] = [
  { id: "p1", name: "Cinto de couro", stock: 12, unit: "un", sku: "CIN-1" },
  { id: "p2", name: "Lenço de seda", stock: 3, unit: "un" },
];
const VESTIDO: ProdutoParaTransferir = { id: "p9", name: "Vestido midi", stock: 7, unit: "un", has_variants: true };

async function montar(produtos: ProdutoParaTransferir[], extra: any = {}) {
  let tree!: renderer.ReactTestRenderer;
  const onFechar = jest.fn();
  const onEstoqueMudou = jest.fn();
  const onConcluido = jest.fn();
  await act(async () => {
    tree = renderer.create(
      <TransferirModal origem={ORIGEM} destinos={extra.destinos || DESTINOS} produtos={produtos}
        onFechar={onFechar} onEstoqueMudou={onEstoqueMudou} onConcluido={onConcluido} />,
    );
  });
  return { tree, onFechar, onEstoqueMudou, onConcluido };
}

beforeEach(() => {
  mockLargura = 1024;
  mockVariantes.mockReset();
  mockCriar.mockReset();
});

describe("botão na barra da seleção", () => {
  const DUAS = [{ id: "c1", trade_name: "Loja Centro" }, { id: "c2", name: "Loja Shopping" }];
  function montarBotao(lojas: any) {
    let tree!: renderer.ReactTestRenderer;
    const onPress = jest.fn();
    act(() => { tree = renderer.create(<BotaoTransferir lojas={lojas} selecionados={2} onPress={onPress} />); });
    return { tree, onPress };
  }
  const ctx = { consolidado: false, consulta: false, demo: false };

  it("aparece com 2 lojas ou mais, numa loja específica", () => {
    const lojas = lojasDaTransferencia(DUAS, "c1", ctx);
    expect(lojas).not.toBeNull();
    expect(lojas!.origem).toEqual({ id: "c1", nome: "Loja Centro" });
    expect(lojas!.destinos).toEqual([{ id: "c2", nome: "Loja Shopping" }]);
    const { tree, onPress } = montarBotao(lojas);
    expect(textoDe(tree, "estoque-transferir")).toBe("Transferir para outra loja");
    act(() => { um(tree, "estoque-transferir").props.onPress(); });
    expect(onPress).toHaveBeenCalled();
  });

  it("some com uma loja só, no consolidado, em consulta e no demo", () => {
    expect(lojasDaTransferencia([DUAS[0]], "c1", ctx)).toBeNull();
    expect(lojasDaTransferencia(DUAS, "c1", { ...ctx, consolidado: true })).toBeNull();
    expect(lojasDaTransferencia(DUAS, null, ctx)).toBeNull();
    expect(lojasDaTransferencia(DUAS, "c1", { ...ctx, consulta: true })).toBeNull();
    expect(lojasDaTransferencia(DUAS, "c1", { ...ctx, demo: true })).toBeNull();
    const { tree } = montarBotao(lojasDaTransferencia([DUAS[0]], "c1", ctx));
    expect(porTestID(tree, "estoque-transferir")).toHaveLength(0);
  });

  it("com 3 lojas, o destino lista as outras duas", () => {
    const lojas = lojasDaTransferencia([...DUAS, { id: "c3", legal_name: "Loja Nova LTDA" }], "c2", ctx);
    expect(lojas!.destinos.map((d) => d.nome)).toEqual(["Loja Centro", "Loja Nova LTDA"]);
  });
});

describe("modal sem variantes", () => {
  it("mostra cada item com o disponível e o campo vazio", async () => {
    const { tree } = await montar(SIMPLES);
    expect(porTestID(tree, "transferir-modal")).toHaveLength(1);
    expect(textoDe(tree, "transferir-disp-p:p1")).toBe("Tem 12");
    expect(um(tree, "transferir-qtd-p:p1").props.value).toBe("");
    // Destino único já vem marcado.
    expect(um(tree, "transferir-destino-c2").props.accessibilityState.checked).toBe(true);
    expect(textoDe(tree, "transferir-rodape")).toBe("2 produtos selecionados");
  });

  it('"Tudo" preenche o estoque atual', async () => {
    const { tree } = await montar(SIMPLES);
    await tocar(tree, "transferir-tudo-p:p1");
    expect(um(tree, "transferir-qtd-p:p1").props.value).toBe("12");
    expect(textoDe(tree, "transferir-rodape")).toBe("1 item · 12 peças");
  });

  it("valida texto, quantidade acima do disponível e peça quebrada", async () => {
    const { tree } = await montar(SIMPLES);
    await digitar(tree, "transferir-qtd-p:p1", "abc");
    expect(textoDe(tree, "transferir-erro-p:p1")).toContain("Use só números");
    await digitar(tree, "transferir-qtd-p:p1", "13");
    expect(textoDe(tree, "transferir-erro-p:p1")).toBe("Só tem 12 nesta loja.");
    await digitar(tree, "transferir-qtd-p:p1", "1,5");
    expect(textoDe(tree, "transferir-erro-p:p1")).toContain("Peça inteira");
    await tocar(tree, "transferir-revisar");
    expect(porTestID(tree, "transferir-resumo")).toHaveLength(0);
    expect(um(tree, "transferir-revisar").props.accessibilityState.disabled).toBe(true);
  });

  it("sem nada digitado e sem destino, não avança e explica", async () => {
    const { tree } = await montar(SIMPLES, { destinos: [{ id: "c2", nome: "B" }, { id: "c3", nome: "C" }] });
    await tocar(tree, "transferir-revisar");
    expect(textoDe(tree, "transferir-erro-destino")).toBe("Escolha a loja que vai receber.");
    expect(textoDe(tree, "transferir-erro-vazio")).toContain("pelo menos um item");
    expect(porTestID(tree, "transferir-resumo")).toHaveLength(0);
  });

  it("resumo e corpo do POST", async () => {
    const { tree, onConcluido, onEstoqueMudou } = await montar(SIMPLES);
    await digitar(tree, "transferir-qtd-p:p1", "5");
    await digitar(tree, "transferir-qtd-p:p2", "3");
    await tocar(tree, "transferir-revisar");
    expect(textoDe(tree, "transferir-resumo-total")).toBe("2 itens · 8 peças");
    expect(textoDe(tree, "transferir-resumo-rota")).toBe("De Loja Centro para Loja Shopping");
    expect(textoDe(tree, "transferir-aviso-cria")).toContain("Produto que ainda não existe em Loja Shopping é criado lá com os mesmos dados");
    expect(porTestID(tree, "transferir-aviso-lotes")).toHaveLength(0);
    await digitar(tree, "transferir-observacao", " abertura ");
    mockCriar.mockResolvedValueOnce({ transferencia: { id: "t1", numero: 41, origem_company_id: "c1", destino_company_id: "c2", criada_em: "2026-11-10T10:00:00", itens: [] } });
    await tocar(tree, "transferir-confirmar");
    expect(mockCriar).toHaveBeenCalledTimes(1);
    expect(mockCriar).toHaveBeenCalledWith("c1", {
      destino_company_id: "c2",
      itens: [
        { product_id: "p1", variant_id: null, quantidade: 5 },
        { product_id: "p2", variant_id: null, quantidade: 3 },
      ],
      observacao: "abertura",
    });
    expect(onEstoqueMudou).toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledWith([41], 8, DESTINOS[0]);
  });

  it("ESTOQUE_INSUFICIENTE volta às quantidades e destaca a linha", async () => {
    const { tree, onConcluido } = await montar(SIMPLES);
    await digitar(tree, "transferir-qtd-p:p1", "5");
    await digitar(tree, "transferir-qtd-p:p2", "3");
    await tocar(tree, "transferir-revisar");
    mockCriar.mockRejectedValueOnce(erroApi(409, {
      error: "Estoque insuficiente", code: "ESTOQUE_INSUFICIENTE",
      itens: [{ product_id: "p2", variant_id: null, solicitado: 3, disponivel: 1 }],
    }));
    await tocar(tree, "transferir-confirmar");
    expect(onConcluido).not.toHaveBeenCalled();
    expect(porTestID(tree, "transferir-resumo")).toHaveLength(0);
    expect(textoDe(tree, "transferir-erro-envio")).toContain("Marcamos as linhas em vermelho");
    expect(textoDe(tree, "transferir-erro-p:p2")).toBe("Só tem 1 nesta loja.");
    expect(estilo(um(tree, "transferir-linha-p:p2")).borderColor).toBe("red");
    expect(porTestID(tree, "transferir-erro-p:p1")).toHaveLength(0);
    expect(estilo(um(tree, "transferir-linha-p:p1")).borderColor).not.toBe("red");
    // Ajustou: a marca sai e dá para conferir de novo.
    await digitar(tree, "transferir-qtd-p:p2", "1");
    expect(porTestID(tree, "transferir-erro-p:p2")).toHaveLength(0);
    expect(textoDe(tree, "transferir-disp-p:p2")).toBe("Tem 1");
  });

  it("outros erros em texto gentil", async () => {
    const { tree } = await montar(SIMPLES);
    await digitar(tree, "transferir-qtd-p:p1", "2");
    await tocar(tree, "transferir-revisar");
    mockCriar.mockRejectedValueOnce(erroApi(403, { error: "x", code: "NAO_E_DO_GRUPO" }));
    await tocar(tree, "transferir-confirmar");
    expect(textoDe(tree, "transferir-erro-envio")).toBe("Essa loja não faz parte do mesmo grupo. Escolha uma das lojas da lista.");
    expect(porTestID(tree, "transferir-resumo")).toHaveLength(1);
  });

  it("busca dentro do modal quando a seleção é grande", async () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({ id: "x" + i, name: i === 7 ? "Bolsa tiracolo" : "Camiseta " + i, stock: 2, unit: "un" }));
    const { tree } = await montar(muitos);
    await digitar(tree, "transferir-busca", "bolsa");
    expect(porTestID(tree, "transferir-linha-p:x7")).toHaveLength(1);
    expect(porTestID(tree, "transferir-linha-p:x1")).toHaveLength(0);
  });
});

describe("modal com variantes", () => {
  const GRADE = {
    variants: [
      { id: "v1", rotulo: "Azul · P", stock_qty: "4" },
      { id: "v2", rotulo: "Azul · M", stock_qty: "3" },
      { id: "v3", rotulo: "Inativa", stock_qty: "9", is_active: false },
    ],
  };

  it("abre um campo por cor/tamanho e o POST leva o variant_id", async () => {
    mockVariantes.mockResolvedValueOnce(GRADE);
    const { tree } = await montar([VESTIDO, SIMPLES[0]]);
    expect(mockVariantes).toHaveBeenCalledWith("c1", "p9");
    expect(porTestID(tree, "transferir-linha-v:p9:v1")).toHaveLength(1);
    expect(porTestID(tree, "transferir-linha-v:p9:v2")).toHaveLength(1);
    expect(porTestID(tree, "transferir-linha-v:p9:v3")).toHaveLength(0);
    expect(textoDe(tree, "transferir-linha-v:p9:v1")).toContain("Azul · P");
    expect(textoDe(tree, "transferir-disp-v:p9:v2")).toBe("Tem 3");
    await tocar(tree, "transferir-tudo-v:p9:v2");
    expect(um(tree, "transferir-qtd-v:p9:v2").props.value).toBe("3");
    await digitar(tree, "transferir-qtd-v:p9:v1", "1");
    await tocar(tree, "transferir-revisar");
    expect(textoDe(tree, "transferir-resumo-total")).toBe("2 itens · 4 peças");
    mockCriar.mockResolvedValueOnce({ transferencia: { id: "t", numero: 7 } });
    await tocar(tree, "transferir-confirmar");
    expect(mockCriar.mock.calls[0][1].itens).toEqual([
      { product_id: "p9", variant_id: "v1", quantidade: 1 },
      { product_id: "p9", variant_id: "v2", quantidade: 3 },
    ]);
  });

  it('"Tudo em todos os tamanhos e cores" preenche a grade inteira', async () => {
    mockVariantes.mockResolvedValueOnce(GRADE);
    const { tree } = await montar([VESTIDO]);
    await tocar(tree, "transferir-tudo-produto-p9");
    expect(um(tree, "transferir-qtd-v:p9:v1").props.value).toBe("4");
    expect(um(tree, "transferir-qtd-v:p9:v2").props.value).toBe("3");
  });

  it("variante sem estoque suficiente é destacada e o produto fica aberto", async () => {
    mockVariantes.mockResolvedValueOnce(GRADE);
    const { tree } = await montar([VESTIDO]);
    await tocar(tree, "transferir-tudo-produto-p9");
    await tocar(tree, "transferir-revisar");
    mockCriar.mockRejectedValueOnce(erroApi(409, {
      code: "ESTOQUE_INSUFICIENTE", items: [{ product_id: "p9", variant_id: "v1", available: 2 }],
    }));
    await tocar(tree, "transferir-confirmar");
    expect(textoDe(tree, "transferir-erro-v:p9:v1")).toBe("Só tem 2 nesta loja.");
    expect(estilo(um(tree, "transferir-linha-v:p9:v1")).borderColor).toBe("red");
    expect(porTestID(tree, "transferir-erro-v:p9:v2")).toHaveLength(0);
  });

  it("com muitos produtos com grade, abre sob demanda", async () => {
    const grades = Array.from({ length: 6 }, (_, i) => ({ id: "g" + i, name: "Saia " + i, stock: 5, unit: "un", has_variants: true }));
    const { tree } = await montar(grades);
    expect(mockVariantes).not.toHaveBeenCalled();
    mockVariantes.mockResolvedValue({ variants: [{ id: "a", rotulo: "Única", stock_qty: 5 }] });
    await tocar(tree, "transferir-abrir-g2");
    expect(mockVariantes).toHaveBeenCalledWith("c1", "g2");
    expect(porTestID(tree, "transferir-linha-v:g2:a")).toHaveLength(1);
    await tocar(tree, "transferir-abrir-todos");
    expect(mockVariantes).toHaveBeenCalledTimes(6);
    expect(porTestID(tree, "transferir-linha-v:g5:a")).toHaveLength(1);
  });
});

describe("regras", () => {
  it("lerQuantidade", () => {
    expect(lerQuantidade("")).toBeNull();
    expect(lerQuantidade("0")).toBeNull();
    expect(lerQuantidade("3")).toBe(3);
    expect(lerQuantidade("2,5")).toBe(2.5);
    expect(lerQuantidade("1.234,5")).toBe(1234.5);
    expect(lerQuantidade("-2")).toBeNaN();
    expect(lerQuantidade("x")).toBeNaN();
  });
  it("dividirEmLotes", () => {
    expect(dividirEmLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(dividirEmLotes(Array.from({ length: 1000 }, (_, i) => i))).toHaveLength(1);
    expect(dividirEmLotes(Array.from({ length: 1001 }, (_, i) => i))).toHaveLength(2);
    expect(dividirEmLotes(Array.from({ length: 2300 }, (_, i) => i)).map((l) => l.length)).toEqual([1000, 1000, 300]);
  });
  it("itensSemEstoque aceita itens/items e disponivel/available", () => {
    expect(itensSemEstoque(erroApi(409, { itens: [{ product_id: "a", variant_id: "b", disponivel: 2 }] }))).toEqual({ "v:a:b": 2 });
    expect(itensSemEstoque(erroApi(409, { items: [{ product_id: "a", available: 0 }] }))).toEqual({ "p:a": 0 });
    expect(itensSemEstoque(erroApi(409, {}))).toEqual({});
  });
});
