// ============================================================
// Comanda: "Alguns itens" e a etiqueta Parcial (17/10/2026, card tc-04).
//
// Mockup da Nina aprovado pelo Caio (quadros 3 e 4). O que estes testes seguram:
//  1. As contas: total da seleção, a comanda só com o marcado, os ids e a
//     quantidade (só da linha cobrada em parte) que vão no POST.
//  2. Modal: "Alguns itens" só aparece com o backend que cobra em partes
//     (`parcial` na comanda); sem nada marcado o botão diz "Marque os
//     itens" e não cobra; marcar e ajustar a quantidade mudam "Cobrando
//     agora" e "Fica na comanda"; a taxa sai sobre o que está sendo cobrado.
//  3. Caixa: a venda leva só os itens marcados (comanda_item_ids e, na linha
//     cobrada em parte, comanda_item_qty); "Cobrar tudo" com o backend novo
//     manda os ids da tela; com o backend antigo, nada muda.
//  4. Painel: comanda parcial ganha a etiqueta "Parcial" e o "já pago".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 375, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
// Cada cor vira o próprio nome: dá para ver qual token o estilo usou.
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }) }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));
jest.mock("@/components/screens/pdv/erroNoCaixa", () => ({ textoDoErro: (_e: any, padrao: string) => padrao }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));

const mockApi = { listOpen: jest.fn(), get: jest.fn(), addItems: jest.fn(), removeItem: jest.fn(), cancel: jest.fn() };
jest.mock("@/services/comandaApi", () => ({ get comandaApi() { return mockApi; } }));

let mockAbertas: any[] = [];
const mockBodies: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { comandas: mockAbertas }, isLoading: false, isError: false, refetch: jest.fn(), dataUpdatedAt: Date.now() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 9 } });
    },
  }),
}));

import { FecharComandaModal } from "@/components/screens/pdv/ComandaModals";
import { ComandasAbertasPanel } from "@/components/screens/pdv/ComandasAbertasPanel";
import { useCart } from "@/hooks/useCart";
import { useComandaNoCaixa } from "@/hooks/useComandaNoCaixa";
import {
  totalDaSelecao, comandaSoComOsItens, itensCobrados, temPasso, cobraEmPartes, type Comanda,
} from "@/utils/comanda";

// O exemplo do mockup: comanda 12 do João, 4 itens, R$ 160, backend novo.
const COMANDA: Comanda = {
  id: "c-12", number: 12, name: "João", status: "open", opened_at: "2026-10-17T20:00:00Z", items_count: 4, subtotal: 160,
  parcial: false, paid_subtotal: 0,
  items: [
    { id: "i1", product_id: null, variant_id: null, name: "Heineken 600 ml", unit: null, quantity: 4, unit_price: 14, total: 56 },
    { id: "i2", product_id: null, variant_id: null, name: "Porção de fritas", unit: null, quantity: 1, unit_price: 38, total: 38 },
    { id: "i3", product_id: null, variant_id: null, name: "Caipirinha", unit: null, quantity: 3, unit_price: 18, total: 54 },
    { id: "i4", product_id: null, variant_id: null, name: "Água", unit: null, quantity: 2, unit_price: 6, total: 12 },
  ],
};
const { parcial: _p, paid_subtotal: _ps, ...COMANDA_ANTIGA } = COMANDA;

function porId(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props.testID === id, { deep: false })[0];
}
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  const c = node.children || [];
  return c.map(texto).join("");
}
function estilo(node: any): any {
  const st = node.props.style;
  return Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st || {};
}
async function esperar() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBodies.length = 0;
  mockAbertas = [];
});

describe("as contas de cobrar alguns itens", () => {
  it("total, comanda só com o marcado e o que vai no POST", () => {
    const sel = { i3: 3, i4: 2 };
    expect(totalDaSelecao(COMANDA, sel)).toBe(66);
    const parte = comandaSoComOsItens(COMANDA, sel);
    expect(parte.items.map((i) => [i.id, i.quantity, i.total])).toEqual([["i3", 3, 54], ["i4", 2, 12]]);
    expect(parte.subtotal).toBe(66);
    expect(itensCobrados(COMANDA, sel)).toEqual({ ids: ["i3", "i4"], qtd: {} });
    // parte da linha: 2 das 4 Heineken; acima do lançado não passa do lançado
    expect(itensCobrados(COMANDA, { i1: 2, i2: 0 })).toEqual({ ids: ["i1"], qtd: { i1: 2 } });
    expect(totalDaSelecao(COMANDA, { i1: 9 })).toBe(56);
    expect(itensCobrados(COMANDA, {})).toEqual({ ids: [], qtd: {} });
  });

  it("passo só em linha com mais de uma unidade inteira; backend novo é o que manda `parcial`", () => {
    expect(temPasso(4)).toBe(true);
    expect(temPasso(1)).toBe(false);
    expect(temPasso(1.5)).toBe(false);
    expect(cobraEmPartes(COMANDA)).toBe(true);
    expect(cobraEmPartes(COMANDA_ANTIGA as Comanda)).toBe(false);
    expect(cobraEmPartes(null)).toBe(false);
  });
});

describe("FecharComandaModal — Alguns itens", () => {
  async function abrir(comanda: any = COMANDA, onCobrar = jest.fn()) {
    mockApi.get.mockResolvedValue({ comanda });
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FecharComandaModal visible companyId="e1" loja="Adega" onClose={jest.fn()} onCobrar={onCobrar} numeroInicial={12} />
      );
    });
    await esperar();
    return { tree, onCobrar };
  }

  it("sem o backend novo o modo não aparece", async () => {
    const { tree } = await abrir(COMANDA_ANTIGA);
    expect(porId(tree, "fechar-comanda-modo-dividir")).toBeDefined();
    expect(porId(tree, "fechar-comanda-modo-itens")).toBeUndefined();
  });

  it("marcar, ajustar a quantidade, taxa sobre o cobrado; sem marcação não cobra", async () => {
    const { tree, onCobrar } = await abrir();
    act(() => { porId(tree, "fechar-comanda-modo-itens").props.onPress(); });

    // nada marcado
    expect(texto(porId(tree, "fechar-comanda-cobrar"))).toBe("Marque os itens");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(true);
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).not.toHaveBeenCalled();
    expect(texto(porId(tree, "fechar-comanda-fica"))).toBe("R$ 160,00");

    // o exemplo do mockup: 3 caipirinhas e 2 águas
    act(() => { porId(tree, "itens-marcar-i3").props.onPress(); });
    act(() => { porId(tree, "itens-marcar-i4").props.onPress(); });
    expect(porId(tree, "itens-marcar-i3").props.accessibilityState).toEqual({ checked: true });
    expect(texto(porId(tree, "itens-qtd-i3"))).toBe("3");
    expect(texto(porId(tree, "fechar-comanda-base"))).toBe("R$ 66,00");
    expect(texto(porId(tree, "fechar-comanda-fica"))).toBe("R$ 94,00");
    expect(texto(porId(tree, "fechar-comanda-cobrar"))).toBe("Cobrar R$ 66,00");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(false);

    // a porção (1 unidade) não tem − / +; a Heineken (4) tem
    expect(porId(tree, "itens-mais-i2")).toBeUndefined();
    act(() => { porId(tree, "itens-mais-i1").props.onPress(); });
    act(() => { porId(tree, "itens-mais-i1").props.onPress(); });
    expect(texto(porId(tree, "itens-qtd-i1"))).toBe("2");
    expect(texto(porId(tree, "fechar-comanda-base"))).toBe("R$ 94,00");
    act(() => { porId(tree, "itens-menos-i3").props.onPress(); });
    expect(texto(porId(tree, "fechar-comanda-base"))).toBe("R$ 76,00");

    // taxa de 10% sobre o que está sendo cobrado
    act(() => { porId(tree, "fechar-comanda-taxa").props.onPress(); });
    expect(texto(porId(tree, "fechar-comanda-total"))).toBe("R$ 83,60");
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledWith(COMANDA, 10, { itens: { i1: 2, i3: 2, i4: 2 } });
  });

  it("comanda já parcial avisa o que foi cobrado", async () => {
    const { tree } = await abrir({ ...COMANDA, parcial: true, paid_subtotal: 66 });
    expect(texto(porId(tree, "fechar-comanda-ja-pago"))).toBe("Parte já cobrada: R$ 66,00. Aqui está só o que falta.");
  });
});

describe("no Caixa: a venda leva só os itens marcados", () => {
  let cart: ReturnType<typeof useCart>;
  let comandas: ReturnType<typeof useComandaNoCaixa>;
  function Harness() {
    cart = useCart();
    comandas = useComandaNoCaixa({
      companyId: "empresa-1", enabled: true, isDemo: false,
      cart: cart.cart, comanda: cart.comanda, setComanda: cart.setComanda,
      limpar: cart.newSale, addToCart: cart.addToCart, setQty: cart.setQty,
      products: [], dividir: cart.dividirPagamento,
    });
    return null;
  }
  function montar() {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Harness />); });
    return tree;
  }

  it("cobrar 2 itens: o carrinho e a venda são só eles, com a taxa sobre eles", () => {
    const tree = montar();
    act(() => { comandas.cobrar(COMANDA, 10, { itens: { i3: 3, i4: 2 } }); });
    expect(cart.cart.map((i) => [i.name, i.qty, i.price])).toEqual([
      ["Caipirinha", 3, 18],
      ["Água", 2, 6],
      ["Taxa de serviço (10%)", 1, 6.6],
    ]);
    expect(mockToast.success).toHaveBeenCalledWith("Comanda 12 · João: 2 itens no carrinho. O resto continua na comanda.");
    act(() => { cart.finalizeSale(); });
    expect(mockBodies[0].comanda_id).toBe("c-12");
    expect(mockBodies[0].comanda_item_ids).toEqual(["i3", "i4"]);
    expect(mockBodies[0].comanda_item_qty).toBeUndefined();
    expect(mockBodies[0].comanda_service_fee_pct).toBe(10);
    tree.unmount();
  });

  it("parte de uma linha: manda a quantidade cobrada", () => {
    const tree = montar();
    act(() => { comandas.cobrar(COMANDA, 0, { itens: { i1: 2 } }); });
    expect(cart.cart.map((i) => [i.name, i.qty])).toEqual([["Heineken 600 ml", 2]]);
    act(() => { cart.finalizeSale(); });
    expect(mockBodies[0].comanda_item_ids).toEqual(["i1"]);
    expect(mockBodies[0].comanda_item_qty).toEqual({ i1: 2 });
    tree.unmount();
  });

  it("cobrar tudo: com o backend novo vão os ids da tela; com o antigo, nada muda", () => {
    const tree = montar();
    act(() => { comandas.cobrar(COMANDA, 0); });
    act(() => { cart.finalizeSale(); });
    expect(mockBodies[0].comanda_item_ids).toEqual(["i1", "i2", "i3", "i4"]);
    expect(mockBodies[0].comanda_item_qty).toBeUndefined();

    act(() => { cart.newSale(); });
    act(() => { comandas.cobrar(COMANDA_ANTIGA as Comanda, 0); });
    act(() => { cart.finalizeSale(); });
    expect(mockBodies[1].comanda_id).toBe("c-12");
    expect(mockBodies[1].comanda_item_ids).toBeUndefined();
    tree.unmount();
  });

  it("nada marcado não mexe no carrinho", () => {
    const tree = montar();
    act(() => { comandas.cobrar(COMANDA, 0, { itens: {} }); });
    expect(cart.cart).toEqual([]);
    expect(cart.comanda).toBeNull();
    tree.unmount();
  });
});

describe("ComandasAbertasPanel — etiqueta Parcial", () => {
  it("parcial: etiqueta, borda âmbar, o que resta e o já pago; a outra não muda", () => {
    mockAbertas = [
      { id: "c-12", number: 12, name: "João", status: "open", opened_at: new Date(Date.now() - 130 * 60000).toISOString(), items_count: 2, subtotal: 94, parcial: true, paid_subtotal: 66 },
      { id: "c-7", number: 7, name: "Mesa do fundo", status: "open", opened_at: new Date(Date.now() - 65 * 60000).toISOString(), items_count: 5, subtotal: 211.5, parcial: false, paid_subtotal: 0 },
    ];
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ComandasAbertasPanel visible companyId="e1" cartItemCount={0} onClose={jest.fn()} onCobrar={jest.fn()} onLancar={jest.fn()} />
      );
    });
    expect(texto(porId(tree, "painel-comanda-parcial-12"))).toBe("Parcial");
    expect(texto(porId(tree, "painel-comanda-pago-12"))).toBe("já pago R$ 66,00");
    expect(texto(porId(tree, "painel-comanda-12"))).toContain("R$ 94,00");
    expect(estilo(porId(tree, "painel-comanda-12")).borderColor).toBe("rgba(251,191,36,0.45)");
    expect(porId(tree, "painel-comanda-parcial-7")).toBeUndefined();
    expect(porId(tree, "painel-comanda-pago-7")).toBeUndefined();
    expect(estilo(porId(tree, "painel-comanda-7")).borderColor).toBe("border");
    act(() => { tree.unmount(); });
  });
});
