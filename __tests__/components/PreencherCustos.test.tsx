// ============================================================
// Preencher custos em massa: a tela (mockup aprovado em 12/11).
//
//   1. Quem não edita o estoque ou não vê custo nunca vê a tela.
//   2. Lista com o campo de custo de cada linha, sempre editável; atalhos
//      fechados ao abrir; filtro "desta conferência" quando veio dela.
//   3. Sugerir só preenche vazio/sugerido; o digitado fica (e troca só com
//      "Trocar também o que eu digitei"); a loja lembra o último atalho.
//   4. Nada grava sem o ConfirmDialog (no WebPortal); o pedido leva a origem
//      de cada custo, o atalho e a conferência.
//   5. Estados: gravado (E), mudou no meio (G5), não gravou (G4: o que foi
//      digitado fica), não carregou (G6), nada sem custo (G1), sem preço (G2).
//   6. 375 px: o campo desce para baixo do nome.
//   7. Topo (relato do Caio, 12/11): botão de voltar de verdade e "Ir para o
//      Estoque" em todos os estados; voltar vai por router.push a um
//      caminho fixo, nunca router.back() (não confiável na pilha da web).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockLargura = 1024;
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
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@expo-google-fonts/dm-sans", () => ({}), { virtual: true });
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: false }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
// canGoBack diz que sim de propósito: a tela não pode usar router.back().
jest.mock("expo-router", () => ({
  router: { push: (...a: any[]) => mockPush(...a), back: (...a: any[]) => mockBack(...a), replace: (...a: any[]) => mockReplace(...a), canGoBack: () => true },
  Redirect: (p: any) => require("react").createElement("Redirect", { ...p, testID: "redirect" }),
}));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: (p: any) => (p.visible ? require("react").createElement("ConfirmDialog", { ...p, testID: "confirm" }) : null),
}));

let mockCtx: any;
jest.mock("@/hooks/useConferenciaResultado", () => ({ useConferenciaContexto: () => mockCtx }));

const mockPendentes = jest.fn();
const mockGravar = jest.fn();
const mockHistorico = jest.fn();
jest.mock("@/services/custoEmMassaApi", () => ({
  ...jest.requireActual("@/services/custoEmMassaApi"),
  custoEmMassaApi: {
    pendentes: (...a: any[]) => mockPendentes(...a),
    gravar: (...a: any[]) => mockGravar(...a),
    historico: (...a: any[]) => mockHistorico(...a),
  },
}));

import { PreencherCustosScreen } from "@/components/screens/conferencia/custos/PreencherCustosScreen";

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
const existe = (tree: renderer.ReactTestRenderer, id: string) => porTestID(tree, id).length > 0;
const textoDe = (tree: renderer.ReactTestRenderer, id: string) => porTestID(tree, id).map((n) => flattenText(n.children)).join("");
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}
async function escrever(tree: renderer.ReactTestRenderer, id: string, v: string) {
  await act(async () => { um(tree, id).props.onChangeText(v); });
}

function contexto(extra: any = {}) {
  return {
    companyId: "c1", nomeDaLoja: "Loja Centro", consolidado: false, lojasParaEscolher: [],
    podeEditar: true, carregandoPermissao: false, semCusto: false, lojasTransferencia: null, ...extra,
  };
}
const P = (id: string, nome: string, preco: number | null, extra: any = {}) => ({
  product_id: id, nome, codigo: null, preco, preco_min: null, preco_max: null, variantes: 0, compartilhado: false, lojas: 1, ...extra,
});
function lista(extra: any = {}) {
  return {
    itens: [
      P("p1", "Caneca cerâmica 350 ml", 39.9),
      P("p2", "Vela aromática lavanda", 49.9),
      P("p3", "Bolsa tote lona", 89.9, { compartilhado: true, lojas: 3 }),
      P("p4", "Kit presente Natal", null),
    ],
    total: 4, limit: 100, offset: 0, filtro: "todos",
    contagens: { todos: 4, desta_conferencia: 2, sem_preco: 1, produtos: 30 },
    lojas_do_grupo: 3, ultimo_atalho: null, ...extra,
  };
}

async function montar(props: any = {}) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<PreencherCustosScreen {...props} />); });
  return tree;
}

beforeEach(() => {
  jest.useRealTimers();
  mockLargura = 1024;
  mockCtx = contexto();
  mockPendentes.mockReset().mockResolvedValue(lista());
  mockGravar.mockReset();
  mockHistorico.mockReset().mockResolvedValue({ preenchimentos: [], total: 0 });
  mockBack.mockReset();
  mockReplace.mockReset();
  mockPush.mockReset();
});

describe("quem vê", () => {
  test.each([
    ["não edita o estoque", { podeEditar: false }],
    ["não vê custo", { semCusto: true }],
  ])("%s: volta para a conferência e não carrega nada", async (_n, extra) => {
    mockCtx = contexto(extra);
    const tree = await montar();
    expect(um(tree, "redirect").props.href).toBe("/conferencia-estoque");
    expect(existe(tree, "custos-tela")).toBe(false);
    expect(mockPendentes).not.toHaveBeenCalled();
  });
});

describe("lista", () => {
  test("campo de custo em cada linha; atalhos fechados; compartilhado com N lojas", async () => {
    const tree = await montar();
    expect(mockPendentes).toHaveBeenCalledWith("c1", expect.objectContaining({ filtro: "todos", countId: null, limit: 100, offset: 0 }));
    expect(textoDe(tree, "custos-sub")).toBe("4 produtos da Loja Centro estão sem custo. Digite o custo de cada um. Nada é gravado até você confirmar.");
    ["p1", "p2", "p3", "p4"].forEach((id) => expect(existe(tree, "custo-campo-" + id)).toBe(true));
    expect(existe(tree, "custos-painel-atalhos")).toBe(false);
    expect(textoDe(tree, "custo-compartilhado-p3")).toBe("Compartilhado · vale nas 3 lojas");
    expect(textoDe(tree, "custo-etiqueta-p4")).toBe("Sem preço, a Aura não tem de onde sugerir. Digite o custo.");
    expect(um(tree, "custos-revisar").props.desabilitado).toBe(true);
  });

  test("vindo das diferenças: abre filtrada nesta conferência", async () => {
    const tree = await montar({ countId: "k9" });
    expect(mockPendentes).toHaveBeenCalledWith("c1", expect.objectContaining({ filtro: "conferencia", countId: "k9" }));
    expect(textoDe(tree, "custos-filtro-conferencia")).toBe("Desta conferência 2");
    await tocar(tree, "custos-filtro-todos");
    expect(mockPendentes).toHaveBeenLastCalledWith("c1", expect.objectContaining({ filtro: "todos", countId: "k9" }));
    expect(textoDe(tree, "custos-voltar")).toBe("Voltar às diferenças");
  });

  test("G6: não carregou, nada foi alterado, tenta de novo", async () => {
    mockPendentes.mockReset().mockRejectedValueOnce({ isNetworkError: true, code: "network" }).mockResolvedValue(lista());
    const tree = await montar();
    expect(textoDe(tree, "custos-erro-lista")).toContain("Não conseguimos carregar os produtos sem custo");
    expect(textoDe(tree, "custos-erro-lista")).toContain("Pode ser a conexão. Nada foi alterado.");
    await tocar(tree, "custos-tentar-lista");
    expect(existe(tree, "custos-lista")).toBe(true);
  });

  test("G1: nada sem custo", async () => {
    mockPendentes.mockResolvedValue(lista({ itens: [], total: 0, contagens: { todos: 0, desta_conferencia: null, sem_preco: 0, produtos: 312 } }));
    const tree = await montar();
    expect(textoDe(tree, "custos-vazio")).toContain("Tudo com custo por aqui");
    expect(textoDe(tree, "custos-vazio")).toContain("Os 312 produtos da Loja Centro têm custo cadastrado.");
    expect(existe(tree, "custos-barra")).toBe(false);
  });

  test("375 px: o campo desce para baixo do nome", async () => {
    mockLargura = 375;
    const tree = await montar();
    const col = tree.root.findAll((n) => n.props && n.props.testID === "custo-linha-p1", { deep: false })[0];
    const estilos = JSON.stringify(col.findAll((n: any) => n.type === "View").map((n: any) => n.props.style));
    expect(estilos).toContain("\"width\":\"100%\"");
  });
});

describe("digitar e atalhos", () => {
  test("digitado fica; sugerir preenche o resto que tem preço; trocar só com a caixa", async () => {
    const tree = await montar();
    await escrever(tree, "custo-campo-p1", "18,00");
    expect(textoDe(tree, "custo-etiqueta-p1")).toBe("digitado por você · margem 55%");
    expect(textoDe(tree, "custos-barra-texto")).toBe("1 de 4 com custo para gravar");

    await tocar(tree, "custos-atalhos");
    expect(existe(tree, "custos-painel-atalhos")).toBe(true);
    expect(um(tree, "custos-modo-markup").props.accessibilityState).toEqual({ checked: true });
    expect(um(tree, "custos-pct").props.value).toBe("100");
    expect(textoDe(tree, "custos-alvo")).toBe("Vai sugerir o custo para 2 produtos marcados. 1 sem preço de venda fica para você digitar. 1 que você digitou fica como está.");

    await tocar(tree, "custos-sugerir");
    expect(um(tree, "custo-campo-p1").props.value).toBe("18,00");
    expect(um(tree, "custo-campo-p2").props.value).toBe("24,95");
    expect(um(tree, "custo-campo-p3").props.value).toBe("44,95");
    expect(um(tree, "custo-campo-p4").props.value).toBe("");
    expect(textoDe(tree, "custos-aviso-atalho")).toContain("1 produto não tem preço de venda, então o atalho passou por ele.");
    expect(textoDe(tree, "custo-etiqueta-p2")).toBe("sugerido · margem 50% · dá para mudar");

    // depois de sugerir, todo campo continua editável
    await escrever(tree, "custo-campo-p2", "22,00");
    expect(textoDe(tree, "custo-etiqueta-p2")).toBe("digitado por você · margem 56%");

    await tocar(tree, "custos-trocar-digitados");
    await tocar(tree, "custos-sugerir");
    expect(um(tree, "custo-campo-p1").props.value).toBe("19,95");
    expect(um(tree, "custo-campo-p2").props.value).toBe("24,95");
  });

  test("Margem num toque (50%) e a loja lembra o último atalho", async () => {
    mockPendentes.mockResolvedValue(lista({ ultimo_atalho: { modo: "margem", percentual: 40 } }));
    const tree = await montar();
    await tocar(tree, "custos-atalhos");
    expect(um(tree, "custos-modo-margem").props.accessibilityState).toEqual({ checked: true });
    expect(um(tree, "custos-pct").props.value).toBe("40");
    await tocar(tree, "custos-modo-markup");
    expect(um(tree, "custos-pct").props.value).toBe("100");
    await tocar(tree, "custos-modo-margem");
    expect(um(tree, "custos-pct").props.value).toBe("50");
  });

  test("desmarcado não entra nem no atalho nem na gravação", async () => {
    const tree = await montar();
    await tocar(tree, "custo-marcar-p2");
    expect(textoDe(tree, "custo-etiqueta-p2")).toBe("desmarcado: fica como está");
    await tocar(tree, "custos-atalhos");
    await tocar(tree, "custos-sugerir");
    expect(um(tree, "custo-campo-p2").props.value).toBe("");
  });

  test("G3: custo maior que o preço avisa, não bloqueia", async () => {
    const tree = await montar();
    await escrever(tree, "custo-campo-p1", "399,00");
    expect(textoDe(tree, "custo-etiqueta-p1")).toBe("Maior que o preço de venda. Confira se não sobrou um zero.");
    expect(um(tree, "custos-revisar").props.desabilitado).toBe(false);
  });
});

describe("gravar", () => {
  async function prontaParaGravar(props: any = {}) {
    const tree = await montar(props);
    await escrever(tree, "custo-campo-p1", "18,00");
    await tocar(tree, "custos-atalhos");
    await tocar(tree, "custos-sugerir");
    return tree;
  }

  test("nada grava sem o ConfirmDialog; o pedido leva origem, atalho e conferência", async () => {
    const tree = await prontaParaGravar({ countId: "k9" });
    expect(mockGravar).not.toHaveBeenCalled();
    await tocar(tree, "custos-revisar");
    const dlg = um(tree, "confirm");
    expect(dlg.props.title).toBe("Gravar os custos?");
    expect(dlg.props.confirmLabel).toBe("Gravar custos");
    expect(dlg.props.cancelLabel).toBe("Voltar e conferir");
    expect(dlg.props.message).toContain("Vamos gravar o custo de 3 produtos. Dá para desfazer por 7 dias.");
    expect(dlg.props.message).toContain("1 produto fica sem custo, como está. 1 é compartilhado com o grupo: o custo vale nas 3 lojas.");

    await act(async () => { dlg.props.onCancel(); });
    expect(existe(tree, "confirm")).toBe(false);
    expect(mockGravar).not.toHaveBeenCalled();

    mockGravar.mockResolvedValue({
      dry_run: false, fill_id: "f1", resumo: { gravar: 3 }, itens: [
        { product_id: "p1", status: "grava" }, { product_id: "p2", status: "grava" }, { product_id: "p3", status: "grava" },
      ], undo_deadline: "2026-11-19T17:32:00.000Z", itens_de_conferencia_atualizados: 2,
    });
    mockPendentes.mockResolvedValue(lista({ itens: [P("p4", "Kit presente Natal", null)], total: 1, contagens: { todos: 1, desta_conferencia: 0, sem_preco: 1, produtos: 30 } }));
    await tocar(tree, "custos-revisar");
    await act(async () => { um(tree, "confirm").props.onConfirm(); });
    expect(mockGravar).toHaveBeenCalledWith("c1", {
      itens: [
        { product_id: "p1", custo: 18, origem: "digitado" },
        { product_id: "p2", custo: 24.95, origem: "sugerido" },
        { product_id: "p3", custo: 44.95, origem: "sugerido" },
      ],
      atalho: { modo: "markup", percentual: 100 },
      count_id: "k9",
      dry_run: false,
    });
    const ok = textoDe(tree, "custos-gravado");
    expect(ok).toContain("Custo gravado em 3 produtos.");
    expect(ok).toContain("Na conferência, o valor do que falta e do que sobra já conta com eles.");
    expect(ok).toContain("Se precisar, dá para desfazer até 19/11, às 14:32, aqui embaixo.");
    // a lista "Últimos preenchimentos" recarrega depois de gravar
    expect(mockHistorico).toHaveBeenCalledTimes(2);
    expect(existe(tree, "custo-linha-p1")).toBe(false);
    await tocar(tree, "custos-voltar-diferencas");
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/k9/diferencas");
    expect(mockBack).not.toHaveBeenCalled();
    // o topo continua lá depois de gravar
    expect(existe(tree, "custos-voltar")).toBe(true);
    expect(existe(tree, "custos-ir-estoque")).toBe(true);
  });

  test("G5: quem ganhou custo no meio do caminho fica com o custo da entrada", async () => {
    const tree = await prontaParaGravar();
    mockGravar.mockResolvedValue({
      dry_run: false, fill_id: "f1", resumo: { gravar: 1 }, itens: [
        { product_id: "p1", status: "grava" },
        { product_id: "p2", status: "mudou_no_meio", nome: "Vela aromática lavanda" },
        { product_id: "p3", status: "mudou_no_meio", nome: "Bolsa tote lona" },
      ],
    });
    await tocar(tree, "custos-revisar");
    await act(async () => { um(tree, "confirm").props.onConfirm(); });
    expect(textoDe(tree, "custos-gravado")).toContain("Custo gravado em 1 produto.");
    expect(textoDe(tree, "custos-mudou-no-meio")).toBe(
      "2 ganharam custo enquanto você preenchia (por uma entrada de mercadoria) e ficaram com o custo da entrada: Vela aromática lavanda e Bolsa tote lona.");
  });

  test("G4: não gravou — nada mudou e o que foi digitado continua", async () => {
    const tree = await prontaParaGravar();
    mockGravar.mockRejectedValueOnce({ isNetworkError: true, code: "network" });
    await tocar(tree, "custos-revisar");
    await act(async () => { um(tree, "confirm").props.onConfirm(); });
    expect(textoDe(tree, "custos-erro-gravar")).toContain("Não deu para gravar agora.");
    expect(textoDe(tree, "custos-erro-gravar")).toContain("Nenhum custo foi alterado e o que você digitou continua aqui.");
    expect(um(tree, "custo-campo-p1").props.value).toBe("18,00");
    mockGravar.mockResolvedValue({ dry_run: false, fill_id: "f1", resumo: { gravar: 3 }, itens: [] });
    await tocar(tree, "custos-tentar-gravar");
    expect(mockGravar).toHaveBeenCalledTimes(2);
  });
});

describe("topo: voltar e Ir para o Estoque", () => {
  function confereTopo(tree: renderer.ReactTestRenderer, rotulo: string) {
    expect(textoDe(tree, "custos-voltar")).toBe(rotulo);
    expect(textoDe(tree, "custos-ir-estoque")).toBe("Ir para o Estoque");
    // botão de verdade, com área de toque de 44 px
    const btn = um(tree, "custos-voltar");
    expect(btn.props.accessibilityRole).toBe("button");
    expect(JSON.stringify(btn.props.style)).toContain("\"minHeight\":44");
    expect(JSON.stringify(um(tree, "custos-ir-estoque").props.style)).toContain("\"minHeight\":44");
  }
  async function tocaVoltar(tree: renderer.ReactTestRenderer, esperado: string) {
    mockPush.mockReset();
    await tocar(tree, "custos-voltar");
    expect(mockPush).toHaveBeenCalledWith(esperado);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    mockPush.mockReset();
    await tocar(tree, "custos-ir-estoque");
    expect(mockPush).toHaveBeenCalledWith("/estoque");
  }

  test("conferindo a permissão", async () => {
    mockCtx = contexto({ carregandoPermissao: true });
    const tree = await montar({ countId: "k9", lojaDaRota: "l2" });
    expect(existe(tree, "custos-permissao")).toBe(true);
    confereTopo(tree, "Voltar às diferenças");
    await tocaVoltar(tree, "/conferencia-estoque/k9/diferencas?loja=l2");
  });

  test("consolidado sem loja", async () => {
    mockCtx = contexto({ companyId: null });
    const tree = await montar();
    expect(existe(tree, "custos-sem-loja")).toBe(true);
    confereTopo(tree, "Voltar à conferência");
    await tocaVoltar(tree, "/conferencia-estoque");
  });

  test("carregando a lista", async () => {
    mockPendentes.mockReset().mockReturnValue(new Promise(() => {}));
    const tree = await montar({ lojaDaRota: "l2" });
    expect(existe(tree, "custos-carregando")).toBe(true);
    confereTopo(tree, "Voltar à conferência");
    await tocaVoltar(tree, "/conferencia-estoque?loja=l2");
  });

  test("erro ao carregar", async () => {
    mockPendentes.mockReset().mockRejectedValue({ isNetworkError: true, code: "network" });
    const tree = await montar({ countId: "k9" });
    expect(existe(tree, "custos-erro-lista")).toBe(true);
    confereTopo(tree, "Voltar às diferenças");
    await tocaVoltar(tree, "/conferencia-estoque/k9/diferencas");
  });

  test("nada sem custo (vazio)", async () => {
    mockPendentes.mockResolvedValue(lista({ itens: [], total: 0, contagens: { todos: 0, desta_conferencia: null, sem_preco: 0, produtos: 312 } }));
    const tree = await montar();
    expect(existe(tree, "custos-vazio")).toBe(true);
    confereTopo(tree, "Voltar à conferência");
    await tocaVoltar(tree, "/conferencia-estoque");
  });

  test("lista com a barra fixa de baixo, em 375 px: o topo fica fora da rolagem", async () => {
    mockLargura = 375;
    const tree = await montar({ countId: "k 9", lojaDaRota: "l2" });
    expect(existe(tree, "custos-lista")).toBe(true);
    expect(existe(tree, "custos-barra")).toBe(true);
    confereTopo(tree, "Voltar às diferenças");
    // o topo não está dentro do ScrollView: não some quando a lista rola
    const rolagem = tree.root.findAll((n: any) => n.type === "ScrollView")[0];
    expect(rolagem.findAll((n: any) => n.props && n.props.testID === "custos-voltar").length).toBe(0);
    await tocaVoltar(tree, "/conferencia-estoque/k%209/diferencas?loja=l2");
  });
});
