// ============================================================
// Estoque · Últimos reajustes (03/11/2026).
//
//   1. Lista da empresa ativa: o que mudou, quando, quem, quantos e prazo.
//   2. Lista vazia e erro (404 de backend antigo) em texto gentil.
//   3. Detalhe com os itens (preço antes e depois).
//   4. Desfazer pede confirmação dentro da tela (sem confirm() do
//      navegador); "Voltar" não desfaz; "Desfazer" desfaz, avisa o Estoque
//      e explica quem ficou como está porque mudou depois.
//   5. Lote vencido ou já desfeito não oferece Desfazer.
//   6. Erro do desfazer em texto gentil.
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 375, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: true }));

const mockLista = jest.fn();
const mockDetalhe = jest.fn();
const mockDesfazer = jest.fn();
jest.mock("@/services/priceAdjustmentsApi", () => ({
  priceAdjustmentsApi: {
    lista: (...a: any[]) => mockLista(...a),
    detalhe: (...a: any[]) => mockDetalhe(...a),
    desfazer: (...a: any[]) => mockDesfazer(...a),
  },
  codigoDoErro: (e: any) => (e && e.data && e.data.code) || (e && e.code) || null,
}));

import { UltimosReajustesModal } from "@/components/screens/estoque/reajuste/UltimosReajustesModal";
import type { DetalheDoReajuste, ItemDoLote, LoteReajuste } from "@/services/priceAdjustmentsApi";

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
function tudo(tree: renderer.ReactTestRenderer): string {
  return flattenText(tree.toJSON() as any);
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}
function erroApi(status: number, data: any) {
  return Object.assign(new Error((data && data.error) || "erro"), { status, data });
}

function lote(extra: Partial<LoteReajuste> = {}): LoteReajuste {
  return {
    id: "a1", created_at: "2026-10-30T14:05:00", user: { id: "u1", name: "Caio" },
    mode: "percent", direction: "up", value: 10, rounding: "90", allow_below_cost: false,
    items_count: 2, products_count: 2, skipped_count: 0, below_cost_count: 0, group_shared_count: 0,
    undo_deadline: "2026-11-06T14:05:00", can_undo: true, undone_at: null, undone_by: null,
    undo_restored_count: null, undo_changed_count: null,
    ...extra,
  };
}
function itemDoLote(extra: Partial<ItemDoLote>): ItemDoLote {
  return {
    product_id: "p1", variant_id: null, name: "Vestido midi floral", variant_label: null, cost_price: 92,
    price_before: 189.9, price_after: 208.9, card_price_before: null, card_price_after: null,
    below_cost: false, group_shared: false, undo_status: null, ...extra,
  };
}
function detalhe(l: LoteReajuste, items: ItemDoLote[]): DetalheDoReajuste {
  return { ...l, items };
}

const ITENS = [
  itemDoLote({}),
  itemDoLote({ product_id: "p2", name: "Bolsa tiracolo", price_before: 129, price_after: 141.9 }),
];

async function montar(lotes: LoteReajuste[], total?: number) {
  let tree!: renderer.ReactTestRenderer;
  const onFechar = jest.fn();
  const onPrecosMudaram = jest.fn();
  mockLista.mockResolvedValueOnce({ adjustments: lotes, total: total ?? lotes.length });
  await act(async () => {
    tree = renderer.create(<UltimosReajustesModal companyId="c1" onFechar={onFechar} onPrecosMudaram={onPrecosMudaram} />);
  });
  return { tree, onFechar, onPrecosMudaram };
}

beforeEach(() => {
  mockLista.mockReset();
  mockDetalhe.mockReset();
  mockDesfazer.mockReset();
});

describe("lista", () => {
  it("mostra os reajustes da empresa ativa com prazo", async () => {
    const { tree } = await montar([
      lote(),
      lote({ id: "a2", mode: "fixed", direction: "down", value: 5, rounding: "none", can_undo: false, products_count: 1 }),
      lote({ id: "a3", undone_at: "2026-10-31T10:00:00", can_undo: false }),
    ]);
    expect(mockLista).toHaveBeenCalledWith("c1", 20, 0);
    const primeiro = textoDe(tree, "ultimos-lote-a1");
    expect(primeiro).toContain("Aumento de 10%, final ,90");
    expect(primeiro).toContain("30/10 às 14:05 · Caio · 2 produtos");
    expect(textoDe(tree, "ultimos-prazo-a1")).toBe("Dá para desfazer até 06/11 às 14:05");
    expect(textoDe(tree, "ultimos-lote-a2")).toContain("Redução de R$ 5,00");
    expect(textoDe(tree, "ultimos-prazo-a2")).toBe("Passou o prazo de 7 dias para desfazer");
    expect(textoDe(tree, "ultimos-prazo-a3")).toBe("Desfeito em 31/10");
    expect(textoDe(tree, "ultimos-rodape")).toBe("3 reajustes");
    expect(porTestID(tree, "ultimos-ver-mais")).toHaveLength(0);
  });

  it("carrega os mais antigos quando há mais", async () => {
    const { tree } = await montar([lote()], 2);
    mockLista.mockResolvedValueOnce({ adjustments: [lote({ id: "a9" })], total: 2 });
    await tocar(tree, "ultimos-ver-mais");
    expect(mockLista).toHaveBeenLastCalledWith("c1", 20, 1);
    expect(porTestID(tree, "ultimos-lote-a9")).toHaveLength(1);
    expect(porTestID(tree, "ultimos-ver-mais")).toHaveLength(0);
  });

  it("lista vazia explica onde os reajustes aparecem", async () => {
    const { tree } = await montar([]);
    expect(textoDe(tree, "ultimos-vazio")).toContain("Nenhum reajuste por aqui ainda");
  });

  it("backend antigo (404) mostra texto gentil e tentar de novo", async () => {
    let tree!: renderer.ReactTestRenderer;
    mockLista.mockRejectedValueOnce(erroApi(404, null));
    await act(async () => {
      tree = renderer.create(<UltimosReajustesModal companyId="c1" onFechar={jest.fn()} />);
    });
    expect(textoDe(tree, "ultimos-erro-lista")).toBe("Esta lista ainda não está disponível na sua conta.");
    mockLista.mockResolvedValueOnce({ adjustments: [lote()], total: 1 });
    await tocar(tree, "ultimos-tentar");
    expect(porTestID(tree, "ultimos-lote-a1")).toHaveLength(1);
  });
});

describe("detalhe e desfazer", () => {
  it("abre o detalhe com preço antes e depois", async () => {
    const { tree } = await montar([lote({ group_shared_count: 1 })]);
    mockDetalhe.mockResolvedValueOnce(detalhe(lote({ group_shared_count: 1 }), ITENS));
    await tocar(tree, "ultimos-lote-a1");
    expect(mockDetalhe).toHaveBeenCalledWith("c1", "a1");
    expect(textoDe(tree, "ultimos-sub")).toBe("Aumento de 10%, final ,90");
    expect(textoDe(tree, "ultimos-detalhe-prazo")).toBe("Dá para desfazer até 06/11 às 14:05");
    expect(textoDe(tree, "ultimos-item-p1:")).toContain("Vestido midi floral");
    expect(textoDe(tree, "ultimos-item-p1:")).toContain("R$ 189,90 → R$ 208,90");
    expect(textoDe(tree, "ultimos-item-p2:")).toContain("R$ 129,00 → R$ 141,90");
    expect(textoDe(tree, "ultimos-grupo")).toContain("todas as lojas do grupo");
    expect(porTestID(tree, "ultimos-desfazer")).toHaveLength(1);

    await tocar(tree, "ultimos-voltar");
    expect(porTestID(tree, "ultimos-lote-a1")).toHaveLength(1);
  });

  it("desfazer pede confirmação na tela; Voltar não desfaz", async () => {
    const confirmSpy = jest.fn();
    (global as any).confirm = confirmSpy;
    const { tree } = await montar([lote()]);
    mockDetalhe.mockResolvedValueOnce(detalhe(lote(), ITENS));
    await tocar(tree, "ultimos-lote-a1");
    await tocar(tree, "ultimos-desfazer");
    expect(textoDe(tree, "ultimos-confirmar-texto")).toContain("2 produtos");
    expect(textoDe(tree, "ultimos-confirmar-texto")).toContain("fica como está");
    await tocar(tree, "ultimos-confirmar-nao");
    expect(porTestID(tree, "ultimos-confirmar")).toHaveLength(0);
    expect(mockDesfazer).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("desfaz, avisa o Estoque e explica quem ficou como está", async () => {
    const { tree, onPrecosMudaram } = await montar([lote()]);
    mockDetalhe.mockResolvedValueOnce(detalhe(lote(), ITENS));
    await tocar(tree, "ultimos-lote-a1");
    await tocar(tree, "ultimos-desfazer");
    mockDesfazer.mockResolvedValueOnce({
      adjustment_id: "a1", undone_at: "2026-10-31T10:00:00", restored_count: 1, changed_after_count: 1,
      restored: [{ product_id: "p1", variant_id: null }],
      changed_after: [{ product_id: "p2", variant_id: null, name: "Bolsa tiracolo", variant_label: null, price_after: 141.9, price_now: 149.9, reason: "changed" }],
    });
    const desfeito = lote({ can_undo: false, undone_at: "2026-10-31T10:00:00" });
    mockDetalhe.mockResolvedValueOnce(detalhe(desfeito, [
      itemDoLote({ undo_status: "restored" }),
      itemDoLote({ product_id: "p2", name: "Bolsa tiracolo", price_before: 129, price_after: 141.9, undo_status: "changed_after" }),
    ]));
    await tocar(tree, "ultimos-confirmar-sim");

    expect(mockDesfazer).toHaveBeenCalledWith("c1", "a1");
    expect(onPrecosMudaram).toHaveBeenCalled();
    expect(textoDe(tree, "ultimos-desfeito")).toBe("Preços de volta ao que eram em 1 produto.");
    const depois = textoDe(tree, "ultimos-mudaram-depois");
    expect(depois).toContain("1 produto ficou como está agora");
    expect(depois).toContain("Bolsa tiracolo: agora R$ 149,90");
    expect(textoDe(tree, "ultimos-item-p1:")).toContain("Voltou ao preço de antes");
    expect(textoDe(tree, "ultimos-item-p2:")).toContain("Ficou como está: o preço mudou depois do reajuste");
    expect(textoDe(tree, "ultimos-detalhe-prazo")).toBe("Desfeito em 31/10");
    expect(porTestID(tree, "ultimos-desfazer")).toHaveLength(0);

    // A lista acompanha o detalhe.
    await tocar(tree, "ultimos-voltar");
    expect(textoDe(tree, "ultimos-prazo-a1")).toBe("Desfeito em 31/10");
  });

  it("lote vencido não oferece Desfazer", async () => {
    const vencido = lote({ can_undo: false });
    const { tree } = await montar([vencido]);
    mockDetalhe.mockResolvedValueOnce(detalhe(vencido, ITENS));
    await tocar(tree, "ultimos-lote-a1");
    expect(porTestID(tree, "ultimos-desfazer")).toHaveLength(0);
    expect(textoDe(tree, "ultimos-detalhe-prazo")).toBe("Passou o prazo de 7 dias para desfazer");
  });

  it("erro do desfazer em texto gentil e a tela mostra a situação real", async () => {
    const { tree, onPrecosMudaram } = await montar([lote()]);
    mockDetalhe.mockResolvedValueOnce(detalhe(lote(), ITENS));
    await tocar(tree, "ultimos-lote-a1");
    await tocar(tree, "ultimos-desfazer");
    mockDesfazer.mockRejectedValueOnce(erroApi(410, { code: "EXPIRED" }));
    mockDetalhe.mockResolvedValueOnce(detalhe(lote({ can_undo: false }), ITENS));
    await tocar(tree, "ultimos-confirmar-sim");
    expect(textoDe(tree, "ultimos-erro-desfazer")).toBe("Passou o prazo de 7 dias para desfazer este reajuste.");
    expect(onPrecosMudaram).not.toHaveBeenCalled();
    expect(porTestID(tree, "ultimos-desfazer")).toHaveLength(0);
    expect(tudo(tree)).not.toContain("undefined");
  });
});
