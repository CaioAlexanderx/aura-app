// ============================================================
// p-108 (entrega C): tela de Diferenças da conferência.
//
//   1. Resumo (batem, faltam/sobram com peças, não contados), valor a custo
//      e o aviso dos itens sem custo; custo some para quem não vê custo.
//   2. Listas por grupo; "zerar não contados" começa desmarcado.
//   3. Ajustar só para quem edita o estoque, pelo ConfirmDialog (texto das
//      vendas mantidas e prévia do estoque depois); desmarcados vão em
//      ignorar_item_ids; o motivo começa com o gravado e vai no corpo.
//      JA_APLICADA (clique duplo) é sucesso.
//   4. Transferir só com 2+ lojas e para quem edita, num modo à parte (botão
//      "Transferir" na linha, não a caixa do ajuste); sobras escolhidas; o
//      TransferirModal recebe itens pré-preenchidos e stock_count_id.
//   5. 503 MIGRATION_PENDING: texto gentil.
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
jest.mock("@/components/screens/estoque/transferencia/TransferirModal", () => ({
  TransferirModal: (p: any) => require("react").createElement("TransferirModal", { ...p, testID: "transferir-mock" }),
}));

let mockCtx: any;
jest.mock("@/hooks/useConferenciaResultado", () => ({ useConferenciaContexto: () => mockCtx }));

const mockObter = jest.fn();
const mockDiferencas = jest.fn();
const mockAplicar = jest.fn();
jest.mock("@/services/conferenciaEstoqueResultadoApi", () => ({
  ...jest.requireActual("@/services/conferenciaEstoqueResultadoApi"),
  conferenciaEstoqueResultadoApi: {
    obter: (...a: any[]) => mockObter(...a),
    diferencas: (...a: any[]) => mockDiferencas(...a),
    aplicar: (...a: any[]) => mockAplicar(...a),
  },
}));

import { DiferencasScreen } from "@/components/screens/conferencia/diferencas/DiferencasScreen";

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

const LOJAS = {
  origem: { id: "c1", nome: "Loja Centro" },
  destinos: [{ id: "c2", nome: "Loja Shopping" }],
  nomes: { c1: "Loja Centro", c2: "Loja Shopping" },
};
function contexto(extra: any = {}) {
  return {
    companyId: "c1", nomeDaLoja: "Loja Centro", consolidado: false, lojasParaEscolher: [],
    podeEditar: true, carregandoPermissao: false, semCusto: false, lojasTransferencia: LOJAS, ...extra,
  };
}
const CONF = { id: "k9", numero: 3, status: "rascunho", escopo: { tipo: "categoria", category_ids: ["cat1"], category_names: ["Camisetas"] }, motivo: "Inventário do mês" };
const DIF = {
  resumo: { faltam: 2, sobram: 1, batem: 1, nao_contados: 2, valor_faltam: 72, valor_sobram: 38, itens_sem_custo: 1 },
  itens: [
    { item_id: "i1", product_id: "p1", variant_id: "v1", nome: "Camiseta Básica", variante: "Preta · G", codigo: null, contado: 3, estoque_no_bipe: 4, estoque_atual: 4, diferenca: -1, estoque_depois: 3, custo: 24, valor: -24, grupo: "faltam" },
    { item_id: "i2", product_id: "p1", variant_id: "v2", nome: "Camiseta Básica", variante: "Branca · G", codigo: null, contado: 1, estoque_no_bipe: 3, estoque_atual: 2, diferenca: -2, custo: 24, valor: -48, grupo: "faltam" },
    { item_id: "i3", product_id: "p2", variant_id: null, nome: "Camiseta Flor", variante: null, codigo: "FL-1", contado: 3, estoque_no_bipe: 2, estoque_atual: 2, diferenca: 1, custo: null, valor: null, grupo: "sobram" },
    { item_id: "i4", product_id: "p3", variant_id: null, nome: "Regata", variante: null, codigo: null, contado: 5, estoque_no_bipe: 5, estoque_atual: 5, diferenca: 0, custo: 19, valor: 0, grupo: "batem" },
  ],
  nao_contados: [
    { product_id: "p4", variant_id: null, nome: "Oversize", variante: null, estoque_atual: 7, custo: 38 },
    { product_id: "p5", variant_id: null, nome: "Camiseta Lisa", variante: null, estoque_atual: 0, custo: 20 },
  ],
};

async function montar() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<DiferencasScreen countId="k9" />); });
  return tree;
}

beforeEach(() => {
  mockCtx = contexto();
  mockPush.mockReset();
  mockObter.mockReset().mockResolvedValue({ conferencia: CONF, transferencias: [] });
  mockDiferencas.mockReset().mockResolvedValue(DIF);
  mockAplicar.mockReset();
});

it("resumo, valor a custo e itens sem custo", async () => {
  const tree = await montar();
  expect(mockDiferencas).toHaveBeenCalledWith("c1", "k9");
  expect(textoDe(tree, "dif-subtitulo")).toBe("Conferência nº 3 · Camisetas · Loja Centro");
  expect(textoDe(tree, "dif-resumo")).toBe("1batem2faltam · 3 peças1sobram · 1 peça2não contados");
  expect(textoDe(tree, "dif-valor-faltam")).toBe("Falta a custo: R$ 72,00");
  expect(textoDe(tree, "dif-valor-sobram")).toBe("Sobra a custo: R$ 38,00");
  expect(textoDe(tree, "dif-sem-custo")).toBe("1 item sem custo cadastrado ficou fora desta conta.");
  expect(textoDe(tree, "dif-nota-venda")).toBe("Desmarque o que você não quer ajustar. A venda feita depois que você contou cada item é mantida: a Aura só soma ou tira a diferença.");
  // listas por grupo; "batem" abre num toque
  expect(textoDe(tree, "dif-grupo-faltam")).toContain("Preta · G · sistema 4, contado 3");
  expect(textoDe(tree, "dif-num-v:p1:v1")).toBe("−1");
  expect(textoDe(tree, "dif-num-p:p2")).toBe("+1");
  expect(textoDe(tree, "dif-mudou-v:p1:v2")).toMatch(/Agora tem 2/);
  expect(existe(tree, "dif-grupo-batem")).toBe(false);
  await tocar(tree, "dif-ver-batem");
  expect(textoDe(tree, "dif-grupo-batem")).toContain("Regata");
  // item que bate não tem caixa de ajustar
  expect(existe(tree, "dif-ajustar-p:p3")).toBe(false);
  // motivo começa com o gravado ao começar
  expect(um(tree, "dif-motivo").props.value).toBe("Inventário do mês");
  expect(um(tree, "dif-motivo").props.maxLength).toBe(200);
});

it("quem não vê custo não vê o valor (nem R$ 0)", async () => {
  mockCtx = contexto({ semCusto: true });
  let tree = await montar();
  expect(existe(tree, "dif-custo")).toBe(false);
  // backend com custos_ocultos: valores nulos, cartão some mesmo com o contexto liberado
  mockCtx = contexto();
  mockDiferencas.mockResolvedValue({ ...DIF, custos_ocultos: true, resumo: { ...DIF.resumo, valor_faltam: null, valor_sobram: null } });
  tree = await montar();
  expect(existe(tree, "dif-custo")).toBe(false);
  expect(textoDe(tree, "dif-tela")).not.toContain("R$");
});

it("ajustar: zerar desmarcado; confirmação gentil com prévia; corpo certo", async () => {
  mockAplicar.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer_ate: "2026-11-18T13:00:00.000Z", pode_desfazer: true }, ajustados: 3, sem_mudanca: 0, zerados: 1, ignorados: [], movimentos: 4 });
  const tree = await montar();
  expect(um(tree, "dif-zerar").props.marcado).toBe(false);
  expect(textoDe(tree, "dif-ajustar")).toBe("Ajustar 3 itens");
  await tocar(tree, "dif-zerar");
  expect(textoDe(tree, "dif-zerar-aviso")).toMatch(/vão para 0\. Dá para desfazer por 7 dias/);
  // só o não contado com estoque conta (Camiseta Lisa já está em 0)
  expect(textoDe(tree, "dif-ajustar")).toBe("Ajustar 4 itens");
  await tocar(tree, "dif-ajustar");
  const dialogo = um(tree, "confirm");
  expect(dialogo.props.title).toBe("Ajustar o estoque?");
  expect(dialogo.props.message).toMatch(/As vendas feitas depois que você contou cada item ficam mantidas/);
  expect(dialogo.props.message).toContain("Fica assim: Camiseta Básica · Preta · G: 4 → 3; Camiseta Básica · Branca · G: 2 → 0; Camiseta Flor: 2 → 3.");
  expect(dialogo.props.message).toMatch(/1 item não contado vai para 0/);
  expect(mockAplicar).not.toHaveBeenCalled();
  mockObter.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer_ate: "2026-11-18T13:00:00.000Z", pode_desfazer: true } });
  await act(async () => { dialogo.props.onConfirm(); });
  expect(mockAplicar).toHaveBeenCalledWith("c1", "k9", { zerar_nao_contados: true, ignorar_item_ids: [], motivo: "Inventário do mês" });
  expect(textoDe(tree, "dif-ajustado")).toMatch(/Estoque ajustado em 3 itens\./);
  expect(textoDe(tree, "dif-ajustado")).toMatch(/“Conferência nº 3 · Inventário do mês”.*desfazer tudo até 18\/11/);
  expect(existe(tree, "dif-ajustar")).toBe(false);
  expect(existe(tree, "dif-motivo")).toBe(false);
  await tocar(tree, "dif-historico");
  expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/historico");
});

it("desmarcar para não ajustar: vai em ignorar_item_ids, com o motivo editado", async () => {
  mockAplicar.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer: true }, ajustados: 2, ignorados: [{ item_id: "i1", motivo: "desmarcado" }] });
  const tree = await montar();
  expect(um(tree, "dif-ajustar-v:p1:v1").props.marcado).toBe(true);
  await tocar(tree, "dif-ajustar-v:p1:v1");
  expect(um(tree, "dif-ajustar-v:p1:v1").props.marcado).toBe(false);
  expect(textoDe(tree, "dif-fora-v:p1:v1")).toBe("Fica como está: não será ajustado.");
  expect(textoDe(tree, "dif-ajustar")).toBe("Ajustar 2 itens");
  await act(async () => { um(tree, "dif-motivo").props.onChangeText("Contagem de novembro"); });
  await tocar(tree, "dif-ajustar");
  const dialogo = um(tree, "confirm");
  expect(dialogo.props.message).toMatch(/1 item desmarcado fica como está/);
  expect(dialogo.props.message).not.toContain("Preta · G");
  mockObter.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", motivo: "Contagem de novembro", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer: true } });
  await act(async () => { dialogo.props.onConfirm(); });
  expect(mockAplicar).toHaveBeenCalledWith("c1", "k9", { zerar_nao_contados: false, ignorar_item_ids: ["i1"], motivo: "Contagem de novembro" });
  expect(textoDe(tree, "dif-ajustado")).toMatch(/1 item desmarcado ficou como estava/);
});

it("segundo clique (JA_APLICADA) aparece como ajustada, sem erro", async () => {
  mockAplicar.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer: true }, ja_aplicada: true });
  const tree = await montar();
  await tocar(tree, "dif-ajustar");
  mockObter.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer: true } });
  await act(async () => { um(tree, "confirm").props.onConfirm(); });
  expect(textoDe(tree, "dif-ajustado")).toMatch(/já tinha ajustado o estoque/);
  expect(existe(tree, "dif-erro-aplicar")).toBe(false);
});

it("cancelar a confirmação não aplica", async () => {
  const tree = await montar();
  await tocar(tree, "dif-ajustar");
  await act(async () => { um(tree, "confirm").props.onCancel(); });
  expect(existe(tree, "confirm")).toBe(false);
  expect(mockAplicar).not.toHaveBeenCalled();
});

it("quem não edita o estoque não ajusta nem transfere", async () => {
  mockCtx = contexto({ podeEditar: false });
  const tree = await montar();
  expect(existe(tree, "dif-ajustar")).toBe(false);
  expect(existe(tree, "dif-ajustar-v:p1:v1")).toBe(false);
  expect(existe(tree, "dif-zerar")).toBe(false);
  expect(existe(tree, "dif-transferir")).toBe(false);
  expect(existe(tree, "dif-motivo")).toBe(false);
  expect(textoDe(tree, "dif-motivo-lido")).toContain("Inventário do mês");
  expect(textoDe(tree, "dif-so-quem-edita")).toMatch(/Só quem pode editar o estoque/);
});

it("uma loja só: sem transferir", async () => {
  mockCtx = contexto({ lojasTransferencia: null });
  const tree = await montar();
  expect(existe(tree, "dif-transferir")).toBe(false);
});

it("transferir é um modo à parte: não mexe nas caixas do ajuste", async () => {
  const tree = await montar();
  await tocar(tree, "dif-ajustar-v:p1:v2"); // desmarcado para o ajuste
  await tocar(tree, "dif-transferir");
  expect(textoDe(tree, "dif-modo-transferir")).toMatch(/Isso não muda o que será ajustado/);
  // no modo transferir, as caixas do ajuste somem; cada linha tem o botão "Transferir"
  expect(existe(tree, "dif-ajustar-v:p1:v1")).toBe(false);
  expect(um(tree, "dif-escolher-p:p2").props.accessibilityState).toEqual({ checked: true });
  expect(textoDe(tree, "dif-escolher-p:p2")).toBe("⇄ Vai para outra loja");
  expect(um(tree, "dif-escolher-v:p1:v1").props.accessibilityState).toEqual({ checked: false });
  expect(textoDe(tree, "dif-escolher-v:p1:v1")).toBe("⇄ Transferir");
  await tocar(tree, "dif-escolher-v:p1:v1");
  expect(textoDe(tree, "dif-abrir-transferir")).toBe("Transferir 2 itens");
  await tocar(tree, "dif-abrir-transferir");
  const modal = um(tree, "transferir-mock");
  expect(modal.props.origem).toEqual({ id: "c1", nome: "Loja Centro" });
  expect(modal.props.stockCountId).toBe("k9");
  expect(modal.props.produtos.map((p: any) => [p.id, p.has_variants])).toEqual([["p1", true], ["p2", false]]);
  expect(modal.props.quantidadesIniciais).toEqual({ "p:p2": "1" });
  // saiu do modo: o ajuste segue como estava
  await tocar(tree, "dif-cancelar-escolha");
  expect(um(tree, "dif-ajustar-v:p1:v2").props.marcado).toBe(false);
  expect(um(tree, "dif-ajustar-v:p1:v1").props.marcado).toBe(true);
  expect(textoDe(tree, "dif-ajustar")).toBe("Ajustar 2 itens");
});

it("transferir depois de ajustar também aparece", async () => {
  mockObter.mockResolvedValue({ conferencia: { ...CONF, status: "aplicada", aplicada_em: "2026-11-11T13:00:00.000Z", pode_desfazer: false }, transferencias: [{ id: "t1", numero: 12, destino_nome: "Loja Shopping", total_pecas: 2 }] });
  const tree = await montar();
  expect(existe(tree, "dif-transferir")).toBe(true);
  expect(textoDe(tree, "dif-transferencias")).toBe("Transferências desta conferência: nº 12 para Loja Shopping (2 peças).");
  // pode_desfazer: false (do servidor) = sem "desfazer até"
  expect(textoDe(tree, "dif-ajustado")).not.toMatch(/desfazer tudo até/);
});

it("503 MIGRATION_PENDING: texto gentil e tentar de novo", async () => {
  mockDiferencas.mockRejectedValue({ status: 503, data: { code: "MIGRATION_PENDING" } });
  const tree = await montar();
  expect(textoDe(tree, "dif-erro")).toMatch(/está chegando para a sua loja/);
  mockDiferencas.mockResolvedValue(DIF);
  await tocar(tree, "dif-tentar");
  expect(existe(tree, "dif-resumo")).toBe(true);
});
