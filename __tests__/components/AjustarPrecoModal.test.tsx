// ============================================================
// Estoque · Ajustar preço em lote (p-52): passos 1 e 2 do modal.
//
//   1. Passo 1: quatro modos, aumentar/diminuir só em percentual e valor
//      fixo, terminação com exemplo, valor inválido trava "Ver como fica".
//   2. Markup/margem avisam quantos sem custo ficam de fora; produto de
//      grupo avisado já no passo 1 (prévia silenciosa ao abrir).
//   3. "Ver como fica" pede a prévia com o corpo certo (empresa ativa).
//   4. Passo 2: produtos que mudam, de fora, margem média; abaixo do custo
//      em vermelho; aviso de grupo; filtro "Só os que ficam de fora".
//   5. A 375 px a lista vira cartões (sem tabela larga).
//   6. Erro da prévia aparece no passo 1, sem avançar.
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockLargura = 1280;
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: mockLargura, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: true }));

const mockPrevia = jest.fn();
jest.mock("@/services/priceAdjustmentsApi", () => ({
  priceAdjustmentsApi: { previa: (...a: any[]) => mockPrevia(...a) },
}));

import { AjustarPrecoModal } from "@/components/screens/estoque/reajuste/AjustarPrecoModal";
import type { RespostaReajuste, ItemReajuste } from "@/services/priceAdjustmentsApi";

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
  return porTestID(tree, id).map(n => flattenText(n.children)).join("");
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}

function item(extra: Partial<ItemReajuste>): ItemReajuste {
  return {
    product_id: "p1", variant_id: null, name: "Vestido midi floral", variant_label: null, sku: null,
    cost_price: 92, price_before: 189.9, price_after: 208.9, change_abs: 19, change_pct: 0.1001,
    margin_before: 0.5155, margin_after: 0.5596, card_price_mode: "auto", card_price_before: null, card_price_after: null,
    below_cost: false, group_shared: false, owner_company_id: "c1", owner_is_other: false, status: "change", skip_reason: null,
    ...extra,
  };
}

function resposta(items: ItemReajuste[], extra: Partial<RespostaReajuste["summary"]> = {}): RespostaReajuste {
  return {
    dry_run: true, adjustment_id: null, mode: "percent", direction: "up", value: 10, rounding: "none", allow_below_cost: false,
    summary: {
      selected: 4, not_found: 0, products_changed: 2, variants_changed: 0, items_changed: 2, unchanged: 0,
      skipped_no_cost: 0, skipped_not_positive: 0, below_cost: 0, group_shared: 0, owner_is_other: 0, card_price_changed: 0,
      margin_avg_before: 0.48, margin_avg_after: 0.53, ...extra,
    },
    items, not_found_ids: [],
  };
}

const PRODUTOS = [
  { id: "p1", cost: 92 },
  { id: "p2", cost: 0 },
  { id: "p3", cost: 61 },
  { id: "p4", cost: null },
];

const PREVIA_PASSO2 = resposta([
  item({ product_id: "p1" }),
  item({ product_id: "p2", name: "Sandália rasteira", status: "skipped", skip_reason: "no_cost", cost_price: null, price_after: null, change_pct: null, margin_before: null, margin_after: null }),
  item({ product_id: "p3", name: "Bolsa tiracolo", group_shared: true, below_cost: true, cost_price: 61, price_before: 70, price_after: 55, change_pct: -0.2143, margin_before: 0.1286, margin_after: -0.1091 }),
], { group_shared: 1, below_cost: 1, skipped_no_cost: 1 });

async function montar() {
  let tree!: renderer.ReactTestRenderer;
  const onFechar = jest.fn();
  await act(async () => {
    tree = renderer.create(<AjustarPrecoModal companyId="c1" produtos={PRODUTOS} onFechar={onFechar} />);
  });
  return { tree, onFechar };
}

beforeEach(() => {
  mockLargura = 1280;
  mockPrevia.mockReset();
  // Prévia silenciosa ao abrir: só o número de produtos de grupo importa.
  mockPrevia.mockResolvedValue(resposta([], { group_shared: 2 }));
});

describe("passo 1: o que mudar", () => {
  it("quatro modos, direção só em percentual e valor fixo", async () => {
    const { tree } = await montar();
    ["percent", "fixed", "markup", "margin"].forEach(m => expect(porTestID(tree, "reajuste-modo-" + m)).toHaveLength(1));
    expect(porTestID(tree, "reajuste-direcao-up")).toHaveLength(1);
    expect(um(tree, "reajuste-valor").props.value).toBe("10");
    await tocar(tree, "reajuste-modo-markup");
    expect(porTestID(tree, "reajuste-direcao-up")).toHaveLength(0);
    expect(um(tree, "reajuste-valor").props.value).toBe("60");
    await tocar(tree, "reajuste-modo-fixed");
    expect(porTestID(tree, "reajuste-direcao-down")).toHaveLength(1);
    expect(textoDe(tree, "reajuste-rodape")).toBe("4 produtos selecionados");
  });

  it("terminação mostra o exemplo para cima", async () => {
    const { tree } = await montar();
    expect(porTestID(tree, "reajuste-exemplo-terminacao")).toHaveLength(0);
    await tocar(tree, "reajuste-terminacao-90");
    expect(textoDe(tree, "reajuste-exemplo-terminacao")).toContain("R$ 53,20 vira R$ 53,90");
  });

  it("sem custo fica de fora só no markup e na margem; grupo avisado ao abrir", async () => {
    const { tree } = await montar();
    expect(porTestID(tree, "reajuste-aviso-sem-custo")).toHaveLength(0);
    expect(textoDe(tree, "reajuste-aviso-grupo")).toContain("2 produtos valem para todas as lojas do grupo");
    await tocar(tree, "reajuste-modo-margin");
    expect(textoDe(tree, "reajuste-aviso-sem-custo")).toContain("2 produtos sem custo ficam de fora");
    // A prévia silenciosa vai para a empresa ativa, sem gravar nada.
    expect(mockPrevia.mock.calls[0][0]).toBe("c1");
    expect(mockPrevia.mock.calls[0][1]).toMatchObject({ product_ids: ["p1", "p2", "p3", "p4"] });
  });

  it("valor inválido trava o botão e explica no campo", async () => {
    const { tree } = await montar();
    await act(async () => { um(tree, "reajuste-valor").props.onChangeText("abc"); });
    expect(um(tree, "reajuste-ver").props.disabled).toBe(true);
    expect(textoDe(tree, "reajuste-erro-valor")).toContain("Use só números");
    await act(async () => { um(tree, "reajuste-direcao-down").props.onPress(); um(tree, "reajuste-valor").props.onChangeText("100"); });
    expect(textoDe(tree, "reajuste-erro-valor")).toContain("menos de 100%");
  });

  it("erro da prévia aparece no passo 1, sem avançar", async () => {
    const { tree } = await montar();
    mockPrevia.mockRejectedValueOnce(new Error("Não conseguimos calcular agora."));
    await tocar(tree, "reajuste-ver");
    expect(textoDe(tree, "reajuste-erro")).toContain("Não conseguimos calcular agora.");
    expect(porTestID(tree, "reajuste-modo-percent")).toHaveLength(1);
  });
});

describe("passo 2: conferir", () => {
  it("pede a prévia com o corpo certo e mostra o resumo", async () => {
    const { tree } = await montar();
    mockPrevia.mockResolvedValueOnce(PREVIA_PASSO2);
    await act(async () => { um(tree, "reajuste-valor").props.onChangeText("10,5"); um(tree, "reajuste-terminacao-99").props.onPress(); });
    await tocar(tree, "reajuste-ver");
    const ultimo = mockPrevia.mock.calls[mockPrevia.mock.calls.length - 1];
    expect(ultimo[0]).toBe("c1");
    expect(ultimo[1]).toEqual({ product_ids: ["p1", "p2", "p3", "p4"], mode: "percent", direction: "up", value: 10.5, rounding: "99" });

    expect(textoDe(tree, "reajuste-n-mudam")).toBe("2produtos mudam");
    expect(textoDe(tree, "reajuste-n-fora")).toBe("1fica de fora");
    expect(textoDe(tree, "reajuste-margem-media")).toContain("48% → 53%");
    expect(textoDe(tree, "reajuste-aviso-abaixo")).toContain("1 produto ficaria abaixo do custo");
    expect(textoDe(tree, "reajuste-aviso-grupo-previa")).toContain("o novo vale em todas elas");
    expect(textoDe(tree, "reajuste-rodape")).toBe("2 produtos vão mudar");
  });

  it("preço abaixo do custo em vermelho; grupo e fora marcados na linha", async () => {
    const { tree } = await montar();
    mockPrevia.mockResolvedValueOnce(PREVIA_PASSO2);
    await tocar(tree, "reajuste-ver");
    const linha = um(tree, "reajuste-item-p3");
    const novo = linha.findAll((n) => n.props && n.props.testID === "reajuste-preco-novo", { deep: false })[0];
    const estilo = [].concat(novo.props.style).filter(Boolean);
    expect(estilo).toContainEqual({ color: "red" });
    expect(flattenText(linha.children)).toContain("grupo");
    expect(flattenText(linha.children)).toContain("abaixo do custo");
    expect(flattenText(um(tree, "reajuste-item-p2").children)).toContain("fora: sem custo");
    expect(flattenText(linha.children)).toContain("13% → -11%");
  });

  it("filtro só os que ficam de fora; Voltar mantém a escolha", async () => {
    const { tree } = await montar();
    mockPrevia.mockResolvedValueOnce(PREVIA_PASSO2);
    await tocar(tree, "reajuste-ver");
    await tocar(tree, "reajuste-filtro-fora");
    expect(porTestID(tree, "reajuste-item-p1")).toHaveLength(0);
    expect(porTestID(tree, "reajuste-item-p2")).toHaveLength(1);
    await tocar(tree, "reajuste-voltar");
    expect(um(tree, "reajuste-valor").props.value).toBe("10");
  });

  it("a 375 px cada item vira um cartão", async () => {
    mockLargura = 375;
    const { tree } = await montar();
    mockPrevia.mockResolvedValueOnce(PREVIA_PASSO2);
    await tocar(tree, "reajuste-ver");
    const txt = flattenText(um(tree, "reajuste-lista").children);
    expect(txt).not.toContain("Variação");
    expect(flattenText(um(tree, "reajuste-item-p1").children)).toContain("Custo R$ 92,00 · Margem 52% → 56%");
  });
});
