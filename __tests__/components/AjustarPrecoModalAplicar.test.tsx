// ============================================================
// Estoque · Ajustar preço em lote (p-53): passo 3.
//
//   1. Aplicar grava com allow_below_cost=false e mostra quantos mudaram,
//      quantos ficaram de fora e o aviso de grupo; o Estoque recarrega.
//   2. Prévia com item abaixo do custo: "Aplicar mesmo assim" pede
//      confirmação e só então reenvia com allow_below_cost=true.
//   3. 409 BELOW_COST no aplicar (custo mudou no meio): confirmação com a
//      prévia nova do corpo do 409.
//   4. Desfazer em um toque; explica quem ficou como está porque mudou
//      depois; "Reimprimir" passa a ser dos que voltaram.
//   5. Erros do aplicar e do desfazer em texto gentil, sem avançar.
//   6. "Reimprimir etiquetas" entrega os produtos reajustados ao Estoque.
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: true }));

const mockPrevia = jest.fn();
const mockAplicar = jest.fn();
const mockDesfazer = jest.fn();
jest.mock("@/services/priceAdjustmentsApi", () => ({
  priceAdjustmentsApi: {
    previa: (...a: any[]) => mockPrevia(...a),
    aplicar: (...a: any[]) => mockAplicar(...a),
    desfazer: (...a: any[]) => mockDesfazer(...a),
  },
  codigoDoErro: (e: any) => (e && e.data && e.data.code) || (e && e.code) || null,
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
function erroApi(status: number, data: any) {
  return Object.assign(new Error((data && data.error) || "erro"), { status, data });
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
function resposta(items: ItemReajuste[], extra: Partial<RespostaReajuste["summary"]> = {}, topo: Partial<RespostaReajuste> = {}): RespostaReajuste {
  return {
    dry_run: true, adjustment_id: null, mode: "percent", direction: "up", value: 10, rounding: "none", allow_below_cost: false,
    summary: {
      selected: 3, not_found: 0, products_changed: 2, variants_changed: 0, items_changed: 2, unchanged: 0,
      skipped_no_cost: 0, skipped_not_positive: 0, below_cost: 0, group_shared: 0, owner_is_other: 0, card_price_changed: 0,
      margin_avg_before: 0.48, margin_avg_after: 0.53, ...extra,
    },
    items, not_found_ids: [], ...topo,
  };
}

const ITENS_OK = [
  item({ product_id: "p1" }),
  item({ product_id: "p2", name: "Sandália rasteira", status: "skipped", skip_reason: "no_cost", cost_price: null, price_after: null, change_pct: null, margin_before: null, margin_after: null }),
  item({ product_id: "p3", name: "Bolsa tiracolo", group_shared: true, price_before: 129, price_after: 141.9 }),
];
const ITENS_ABAIXO = [
  item({ product_id: "p1" }),
  item({ product_id: "p3", name: "Bolsa tiracolo", below_cost: true, cost_price: 61, price_before: 70, price_after: 55, change_pct: -0.2143 }),
];
const PEDIDO = { product_ids: ["p1", "p2", "p3"], mode: "percent", direction: "up", value: 10, rounding: "none" };

async function montarNoPasso2(previa: RespostaReajuste) {
  let tree!: renderer.ReactTestRenderer;
  const onFechar = jest.fn();
  const onPrecosMudaram = jest.fn();
  const onReimprimir = jest.fn();
  mockPrevia.mockResolvedValueOnce(resposta([], { group_shared: 0 })); // prévia silenciosa ao abrir
  await act(async () => {
    tree = renderer.create(
      <AjustarPrecoModal
        companyId="c1"
        produtos={[{ id: "p1", cost: 92 }, { id: "p2", cost: 0 }, { id: "p3", cost: 61 }]}
        onFechar={onFechar}
        onPrecosMudaram={onPrecosMudaram}
        onReimprimir={onReimprimir}
      />,
    );
  });
  mockPrevia.mockResolvedValueOnce(previa);
  await tocar(tree, "reajuste-ver");
  return { tree, onFechar, onPrecosMudaram, onReimprimir };
}

beforeEach(() => {
  mockPrevia.mockReset();
  mockAplicar.mockReset();
  mockDesfazer.mockReset();
});

describe("aplicar", () => {
  it("grava sem permitir abaixo do custo e mostra o resultado", async () => {
    const { tree, onPrecosMudaram } = await montarNoPasso2(resposta(ITENS_OK, { group_shared: 1, skipped_no_cost: 1 }));
    expect(textoDe(tree, "reajuste-aplicar")).toBe("Aplicar em 2 produtos");
    mockAplicar.mockResolvedValueOnce(resposta(ITENS_OK, { group_shared: 1, skipped_no_cost: 1 }, { dry_run: false, adjustment_id: "adj-1" }));
    await tocar(tree, "reajuste-aplicar");
    expect(mockAplicar).toHaveBeenCalledWith("c1", PEDIDO, false);
    expect(textoDe(tree, "reajuste-resultado-titulo")).toBe("Preços atualizados");
    expect(textoDe(tree, "reajuste-resultado-resumo")).toBe("2 produtos mudaram · 1 ficou de fora.");
    expect(textoDe(tree, "reajuste-resultado-grupo")).toContain("as outras lojas já veem o preço novo");
    expect(textoDe(tree, "reajuste-reimprimir")).toBe("Reimprimir etiquetas (2)");
    expect(onPrecosMudaram).toHaveBeenCalledTimes(1);
  });

  it("abaixo do custo na prévia: confirma antes e reenvia com allow_below_cost", async () => {
    const { tree } = await montarNoPasso2(resposta(ITENS_ABAIXO, { below_cost: 1 }));
    expect(textoDe(tree, "reajuste-aplicar")).toBe("Aplicar mesmo assim");
    await tocar(tree, "reajuste-aplicar");
    expect(mockAplicar).not.toHaveBeenCalled();
    expect(textoDe(tree, "reajuste-confirmar-texto")).toContain("1 produto vai ficar com o preço menor que o custo");
    await tocar(tree, "reajuste-confirmar-nao");
    expect(porTestID(tree, "reajuste-confirmar-abaixo")).toHaveLength(0);
    await tocar(tree, "reajuste-aplicar");
    mockAplicar.mockResolvedValueOnce(resposta(ITENS_ABAIXO, { below_cost: 1 }, { dry_run: false, adjustment_id: "adj-2", allow_below_cost: true }));
    await tocar(tree, "reajuste-confirmar-sim");
    expect(mockAplicar).toHaveBeenCalledTimes(1);
    expect(mockAplicar.mock.calls[0][2]).toBe(true);
    expect(textoDe(tree, "reajuste-resultado-abaixo")).toContain("1 produto ficou abaixo do custo, como você confirmou");
  });

  it("409 BELOW_COST (custo mudou no meio): mostra a prévia nova e pede confirmação", async () => {
    const { tree } = await montarNoPasso2(resposta(ITENS_OK));
    const nova = resposta(ITENS_ABAIXO, { below_cost: 1 });
    mockAplicar.mockRejectedValueOnce(erroApi(409, { ...nova, error: "Alguns produtos ficariam abaixo do custo", code: "BELOW_COST" }));
    await tocar(tree, "reajuste-aplicar");
    expect(porTestID(tree, "reajuste-confirmar-abaixo")).toHaveLength(1);
    expect(porTestID(tree, "reajuste-tag-abaixo").length).toBeGreaterThan(0);
    mockAplicar.mockResolvedValueOnce(resposta(ITENS_ABAIXO, { below_cost: 1 }, { dry_run: false, adjustment_id: "adj-3" }));
    await tocar(tree, "reajuste-confirmar-sim");
    expect(mockAplicar.mock.calls.map(c => c[2])).toEqual([false, true]);
    expect(textoDe(tree, "reajuste-resultado-titulo")).toBe("Preços atualizados");
  });

  it("erro do aplicar fica no passo 2 em texto gentil", async () => {
    const { tree, onPrecosMudaram } = await montarNoPasso2(resposta(ITENS_OK));
    mockAplicar.mockRejectedValueOnce(erroApi(503, { error: "x", code: "MIGRATION_PENDING" }));
    await tocar(tree, "reajuste-aplicar");
    expect(textoDe(tree, "reajuste-erro-aplicar")).toContain("ainda está sendo ligada");
    expect(porTestID(tree, "reajuste-resultado-titulo")).toHaveLength(0);
    expect(onPrecosMudaram).not.toHaveBeenCalled();
  });

  it("nada mudou no aplicar (adjustment_id nulo): avisa e não avança", async () => {
    const { tree } = await montarNoPasso2(resposta(ITENS_OK));
    mockAplicar.mockResolvedValueOnce(resposta([item({ status: "unchanged" })], { items_changed: 0, products_changed: 0 }, { dry_run: false, adjustment_id: null }));
    await tocar(tree, "reajuste-aplicar");
    expect(textoDe(tree, "reajuste-erro-aplicar")).toContain("Nada foi gravado");
    expect(um(tree, "reajuste-aplicar").props.disabled).toBe(true);
  });
});

describe("resultado", () => {
  async function aplicado() {
    const m = await montarNoPasso2(resposta(ITENS_OK, { group_shared: 1 }));
    mockAplicar.mockResolvedValueOnce(resposta(ITENS_OK, { group_shared: 1 }, { dry_run: false, adjustment_id: "adj-9" }));
    await tocar(m.tree, "reajuste-aplicar");
    return m;
  }

  it("Reimprimir etiquetas entrega os produtos que mudaram", async () => {
    const { tree, onReimprimir } = await aplicado();
    await tocar(tree, "reajuste-reimprimir");
    expect(onReimprimir).toHaveBeenCalledWith(["p1", "p3"]);
  });

  it("Desfazer em um toque e explica quem mudou depois", async () => {
    const { tree, onPrecosMudaram, onReimprimir } = await aplicado();
    mockDesfazer.mockResolvedValueOnce({
      adjustment_id: "adj-9", undone_at: "2026-10-30T15:00:00.000Z", restored_count: 1, changed_after_count: 1,
      restored: [{ product_id: "p1", variant_id: null }],
      changed_after: [{ product_id: "p3", variant_id: null, name: "Bolsa tiracolo", variant_label: null, price_after: 141.9, price_now: 149.9, reason: "changed" }],
    });
    await tocar(tree, "reajuste-desfazer");
    expect(mockDesfazer).toHaveBeenCalledWith("c1", "adj-9");
    expect(textoDe(tree, "reajuste-resultado-titulo")).toBe("Reajuste desfeito");
    expect(textoDe(tree, "reajuste-resultado-resumo")).toBe("Preços de volta ao que eram em 1 produto.");
    const depois = textoDe(tree, "reajuste-mudaram-depois");
    expect(depois).toContain("1 produto ficou como está agora");
    expect(depois).toContain("Bolsa tiracolo: agora R$ 149,90");
    expect(porTestID(tree, "reajuste-desfazer")).toHaveLength(0);
    expect(onPrecosMudaram).toHaveBeenCalledTimes(2);
    await tocar(tree, "reajuste-reimprimir");
    expect(onReimprimir).toHaveBeenCalledWith(["p1"]);
  });

  it("erro do desfazer em texto gentil", async () => {
    const { tree } = await aplicado();
    mockDesfazer.mockRejectedValueOnce(erroApi(410, { error: "x", code: "EXPIRED" }));
    await tocar(tree, "reajuste-desfazer");
    expect(textoDe(tree, "reajuste-erro-desfazer")).toContain("Passou o prazo de 7 dias");
    expect(porTestID(tree, "reajuste-desfazer")).toHaveLength(1);
    mockDesfazer.mockRejectedValueOnce(erroApi(404, {}));
    await tocar(tree, "reajuste-desfazer");
    expect(textoDe(tree, "reajuste-erro-desfazer")).toContain("ainda não está disponível");
  });
});
