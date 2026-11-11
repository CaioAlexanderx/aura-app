// ============================================================
// p-108 (entrega C): histórico das conferências e Desfazer por 7 dias.
//
//   1. Aplicadas, desfeitas e rascunhos com resumo e selo.
//   2. Desfazer dentro do prazo mostra até quando e pede confirmação no
//      ConfirmDialog; fora do prazo o botão some e fica o texto.
//   3. Só quem edita o estoque desfaz.
//   4. Consolidado: pede a loja. 404 (backend antigo): texto gentil.
//
// Mocks do padrão do repo (expo-font, expo-secure-store, fontes, FpktLogo,
// Modal); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  ActivityIndicator: "ActivityIndicator",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 375, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@expo-google-fonts/dm-sans", () => ({}), { virtual: true });
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: false }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: (p: any) => (p.visible ? require("react").createElement("ConfirmDialog", { ...p, testID: "confirm" }) : null),
}));

let mockCtx: any;
let mockLojaPedida: any[] = [];
jest.mock("@/hooks/useConferenciaResultado", () => ({
  useConferenciaContexto: (loja: any) => { mockLojaPedida.push(loja); return typeof mockCtx === "function" ? mockCtx(loja) : mockCtx; },
}));

const mockHistorico = jest.fn();
const mockDesfazer = jest.fn();
jest.mock("@/services/conferenciaEstoqueResultadoApi", () => ({
  ...jest.requireActual("@/services/conferenciaEstoqueResultadoApi"),
  conferenciaEstoqueResultadoApi: {
    historico: (...a: any[]) => mockHistorico(...a),
    desfazer: (...a: any[]) => mockDesfazer(...a),
  },
}));

import { HistoricoConferenciasScreen } from "@/components/screens/conferencia/historico/HistoricoConferenciasScreen";
import { toast } from "@/components/Toast";
const mockToast = toast as any;

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
function existe(tree: renderer.ReactTestRenderer, id: string) { return porTestID(tree, id).length > 0; }
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  return porTestID(tree, id).map((n) => flattenText(n.children)).join("");
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}

function contexto(extra: any = {}) {
  return {
    companyId: "c1", nomeDaLoja: "Loja Centro", consolidado: false, lojasParaEscolher: [],
    podeEditar: true, carregandoPermissao: false, semCusto: false, lojasTransferencia: null, ...extra,
  };
}
const AGORA = new Date("2026-11-11T15:00:00.000Z");
const LISTA = [
  { id: "a1", numero: 5, status: "aplicada", escopo: { tipo: "categoria", category_names: ["Calçados"] }, criada_em: "2026-11-10T12:00:00.000Z",
    aplicada_em: "2026-11-10T13:00:00.000Z", pode_desfazer_ate: "2026-11-17T13:00:00.000Z", pode_desfazer: true, itens_contados: 31, faltam: 3, sobram: 1, valor_faltam: 90, valor_sobram: 20, criada_por_nome: "Ana" },
  { id: "a2", numero: 4, status: "aplicada", escopo: { tipo: "loja_toda" }, criada_em: "2026-10-30T12:00:00.000Z",
    aplicada_em: "2026-10-30T13:00:00.000Z", pode_desfazer_ate: "2026-11-06T13:00:00.000Z", pode_desfazer: false, itens_contados: 200, faltam: 10, sobram: 2 },
  { id: "d1", numero: 3, status: "desfeita", escopo: { tipo: "com_estoque" }, criada_em: "2026-10-20T12:00:00.000Z", aplicada_em: "2026-10-20T13:00:00.000Z", desfeita_em: "2026-10-21T10:00:00.000Z" },
  // Rascunho às cegas: faltam/sobram/batem e valor_* nulos.
  { id: "r1", numero: 6, status: "rascunho", escopo: { tipo: "categoria", category_names: ["Vestidos"] }, criada_em: "2026-11-08T12:00:00.000Z", itens_contados: 23, faltam: null, sobram: null, batem: null, valor_faltam: null, valor_sobram: null },
];

async function montar(props: any = {}) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<HistoricoConferenciasScreen agora={() => AGORA} {...props} />); });
  return tree;
}

beforeEach(() => {
  mockCtx = contexto();
  mockLojaPedida = [];
  mockPush.mockReset();
  mockToast.success.mockReset();
  mockHistorico.mockReset().mockResolvedValue({ conferencias: LISTA, proximo: null });
  mockDesfazer.mockReset();
});

it("lista com resumo, selo e prazo do desfazer", async () => {
  const tree = await montar();
  expect(mockHistorico).toHaveBeenCalledWith("c1", { limit: 20 });
  expect(textoDe(tree, "hist-status-a1")).toBe("Ajustada");
  expect(textoDe(tree, "hist-resumo-a1")).toBe("31 contados · 4 diferenças · por Ana");
  expect(textoDe(tree, "hist-faltam-sobram-a1")).toBe("Faltaram 3 · sobraram 1 · a custo: R$ 90,00 de falta, R$ 20,00 de sobra");
  expect(textoDe(tree, "hist-prazo-a1")).toBe("Dá para desfazer até 17/11 às 10:00.");
  expect(existe(tree, "hist-desfazer-a1")).toBe(true);
  // fora do prazo: sem botão, com o texto
  expect(existe(tree, "hist-desfazer-a2")).toBe(false);
  expect(textoDe(tree, "hist-prazo-acabou-a2")).toMatch(/O prazo de 7 dias para desfazer acabou em 06\/11/);
  expect(textoDe(tree, "hist-desfeita-d1")).toMatch(/Desfeita em 21\/10/);
  expect(textoDe(tree, "hist-status-r1")).toBe("Em andamento");
  await tocar(tree, "hist-continuar-r1");
  expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/r1");
  await tocar(tree, "hist-diferencas-r1");
  expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/r1/diferencas");
});

it("rascunho às cegas: sem diferenças nem valor; sem custo: sem R$", async () => {
  let tree = await montar();
  expect(textoDe(tree, "hist-resumo-r1")).toBe("23 contados");
  expect(existe(tree, "hist-faltam-sobram-r1")).toBe(false);
  mockHistorico.mockResolvedValue({ conferencias: [{ ...LISTA[0], valor_faltam: null, valor_sobram: null }], proximo: null });
  tree = await montar();
  expect(textoDe(tree, "hist-faltam-sobram-a1")).toBe("Faltaram 3 · sobraram 1");
});

it("pode_desfazer do servidor decide; carregar mais usa o cursor", async () => {
  mockHistorico.mockResolvedValueOnce({ conferencias: [{ ...LISTA[0], pode_desfazer: false }], proximo: "2026-11-10T12:00:00.000Z" });
  const tree = await montar();
  expect(existe(tree, "hist-desfazer-a1")).toBe(false);
  expect(existe(tree, "hist-prazo-acabou-a1")).toBe(true);
  mockHistorico.mockResolvedValueOnce({ conferencias: [LISTA[2]], proximo: null });
  await tocar(tree, "hist-mais");
  expect(mockHistorico).toHaveBeenLastCalledWith("c1", { limit: 20, before: "2026-11-10T12:00:00.000Z" });
  expect(existe(tree, "hist-conf-d1")).toBe(true);
  expect(existe(tree, "hist-mais")).toBe(false);
});

it("desfazer pede confirmação e marca como desfeita", async () => {
  mockDesfazer.mockResolvedValue({ conferencia: { id: "a1", status: "desfeita", desfeita_em: "2026-11-11T15:00:00.000Z" } });
  const tree = await montar();
  await tocar(tree, "hist-desfazer-a1");
  const d = um(tree, "confirm");
  expect(d.props.title).toBe("Desfazer a conferência nº 5?");
  expect(d.props.message).toMatch(/As vendas feitas desde então ficam mantidas/);
  expect(d.props.message).toMatch(/\(4 itens\)/);
  expect(mockDesfazer).not.toHaveBeenCalled();
  await act(async () => { d.props.onConfirm(); });
  expect(mockDesfazer).toHaveBeenCalledWith("c1", "a1");
  expect(textoDe(tree, "hist-status-a1")).toBe("Desfeita");
  expect(existe(tree, "hist-desfazer-a1")).toBe(false);
  expect(mockToast.success).toHaveBeenCalledWith("Conferência nº 5 desfeita. O estoque voltou ao que era.");
});

it("409 PRAZO_ENCERRADO do desfazer mostra o texto do backend", async () => {
  mockDesfazer.mockRejectedValue({ status: 409, data: { code: "PRAZO_ENCERRADO", error: "O prazo para desfazer acabou." } });
  const tree = await montar();
  await tocar(tree, "hist-desfazer-a1");
  await act(async () => { um(tree, "confirm").props.onConfirm(); });
  expect(textoDe(tree, "hist-erro-desfazer-a1")).toBe("O prazo para desfazer acabou.");
});

it("quem não edita o estoque não desfaz", async () => {
  mockCtx = contexto({ podeEditar: false });
  const tree = await montar();
  expect(existe(tree, "hist-desfazer-a1")).toBe(false);
  expect(textoDe(tree, "hist-so-quem-edita-a1")).toMatch(/Quem pode editar o estoque consegue desfazer/);
});

it("consolidado: escolhe a loja antes de listar", async () => {
  mockCtx = (loja: any) => contexto({
    consolidado: true, companyId: loja || null,
    lojasParaEscolher: [{ id: "c1", nome: "Loja Centro" }, { id: "c2", nome: "Loja Shopping" }],
  });
  const tree = await montar();
  expect(mockHistorico).not.toHaveBeenCalled();
  expect(existe(tree, "hist-escolher-loja")).toBe(true);
  await tocar(tree, "hist-loja-c2");
  expect(mockHistorico).toHaveBeenCalledWith("c2", { limit: 20 });
  expect(existe(tree, "hist-escolher-loja")).toBe(true);
  await tocar(tree, "hist-continuar-r1");
  expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/r1?loja=c2");
});

it("backend antigo (404): texto gentil", async () => {
  mockHistorico.mockRejectedValue({ status: 404, data: { error: "Not found" } });
  const tree = await montar();
  expect(textoDe(tree, "hist-erro")).toMatch(/está chegando para a sua loja/);
});

it("vazio: convite gentil", async () => {
  mockHistorico.mockResolvedValue({ conferencias: [], proximo: null });
  const tree = await montar();
  expect(textoDe(tree, "hist-vazio")).toMatch(/Nenhuma conferência nesta loja ainda/);
});

// QA em produção (11/11): nenhuma tela lista as movimentações do produto,
// então nada de prometer "histórico do produto".
it("textos verdadeiros: registro no histórico de conferências", async () => {
  mockDesfazer.mockResolvedValue({ conferencia: { id: "a1", status: "desfeita", desfeita_em: "2026-11-11T15:00:00.000Z" } });
  const tree = await montar();
  expect(textoDe(tree, "hist-sub")).toBe("Cada conferência ajustada fica registrada aqui; em “Ver diferenças” você vê o que mudou em cada item. Se precisar, dá para desfazer a conferência inteira por 7 dias.");
  expect(textoDe(tree, "hist-prazo-acabou-a2")).toMatch(/Os ajustes continuam valendo, e a conferência segue registrada aqui\.$/);
  expect(textoDe(tree, "hist-desfeita-d1")).toMatch(/e a conferência segue registrada aqui\.$/);
  await tocar(tree, "hist-desfazer-a1");
  expect(um(tree, "confirm").props.message).toMatch(/A conferência continua registrada aqui, marcada como desfeita\./);
  expect(flattenText(tree.toJSON()) + um(tree, "confirm").props.message).not.toMatch(/histórico (do|de cada) produto/);
});
