// ============================================================
// Caixa — carrinho (CartPanel), QA em produção de 23/09/2026.
// Texto na língua do lojista: nada de "CARTAO", "1× SPLIT", "ITENS 510".
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React from "react";
import renderer, { act } from "react-test-renderer";

let mockPdvSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Depósito São Jorge", initial: "D" }),
}));

import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";

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
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  const achados = porTestID(tree, id);
  return achados.length ? flattenText(achados[0].children) : "";
}

const PISO: CartDisplayItem = { productId: "piso", productBaseId: "piso", name: "Piso", price: 64.8, qty: 10, listPrice: 64.8, unit: "m²" };
const TIJOLO: CartDisplayItem = { productId: "tij", productBaseId: "tij", name: "Tijolo", price: 1392, qty: 0.5, listPrice: 1392, unit: "mlh" };

const METODOS = [
  { key: "dinheiro", label: "Dinheiro", icon: "wallet" },
  { key: "pix", label: "PIX", icon: "dollar" },
  { key: "debito", label: "Débito", icon: "trending_up" },
  { key: "cartao", label: "Crédito", icon: "receipt" },
  { key: "crediario", label: "Crediário", icon: "clock" },
];

function props(extra: Record<string, any> = {}) {
  return {
    items: [PISO, TIJOLO],
    subtotal: 1344, discountAmount: 0, total: 1344, itemCount: 10.5,
    payMethods: METODOS,
    activePay: "pix",
    onPay: jest.fn(), onInc: jest.fn(), onDec: jest.fn(), onRemove: jest.fn(), onClear: jest.fn(), onFinalize: jest.fn(),
    onToggleSplit: jest.fn(), onAddSplitPayment: jest.fn(), onUpdateSplitPayment: jest.fn(), onRemoveSplitPayment: jest.fn(),
    ...extra,
  };
}
function montar(extra: Record<string, any> = {}) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<CartPanel {...props(extra)} />); });
  return tree;
}

beforeEach(() => { mockPdvSettings = {}; });

describe("Produtos no topo", () => {
  test("10 m² de piso + 500 tijolos = 2 produtos (não 510), com ou sem Matcon", () => {
    for (const cfg of [{}, { matcon_enabled: true }]) {
      mockPdvSettings = cfg;
      const tree = montar();
      expect(textoDe(tree, "carrinho-produtos")).toBe("2");
      tree.unmount();
    }
  });
});

describe("par de totais (preço no cartão)", () => {
  const PAR = { cash: 1142.4, card: 1268.16, active: "cash" as const };
  test("'Dinheiro ou PIX' e 'Cartão'", () => {
    const tree = montar({ pricePair: PAR });
    expect(textoDe(tree, "carrinho-par-dinheiro")).toBe("Dinheiro ou PIX");
    expect(textoDe(tree, "carrinho-par-cartao")).toBe("Cartão");
    tree.unmount();
  });
  test("com Crediário o destaque cita o crediário", () => {
    const tree = montar({ activePay: "crediario", pricePair: PAR });
    expect(textoDe(tree, "carrinho-par-dinheiro")).toBe("Dinheiro, PIX ou crediário");
    tree.unmount();
  });
  test("sem pricePair (opção desligada): nada do par", () => {
    const tree = montar({ activePay: "crediario" });
    expect(porTestID(tree, "carrinho-par-dinheiro")).toHaveLength(0);
    expect(flattenText(tree.toJSON())).not.toMatch(/Dinheiro ou PIX|Dinheiro, PIX/);
    tree.unmount();
  });
});

describe("dividido: métodos numa linha e a conta em frase de balcão", () => {
  function montarDividido(fill: boolean) {
    return montar({
      fill,
      splitMode: true, splitIsBalanced: true, splitRemaining: 0,
      splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 824.13, auto: true }],
      splitStatusText: "Pronto · a conta fecha em R$ 1.224,13. No cartão, os R$ 742,40 que faltavam ficam R$ 824,13 (11% a mais).",
    });
  }
  function estilo(node: any) {
    const st = node.props.style;
    return Object.assign({}, ...(Array.isArray(st) ? st.flat(5) : [st]).filter(Boolean));
  }

  test("cada pagamento: os cinco métodos numa faixa só, sem quebrar, com o nome inteiro", () => {
    const tree = montarDividido(false);
    const faixas = porTestID(tree, "carrinho-dividido-metodos");
    expect(faixas).toHaveLength(2);
    for (const faixa of faixas) {
      expect(estilo(faixa).flexWrap).toBe("nowrap");
      expect(flattenText(faixa.children)).toBe("DinheiroPIXDébitoCréditoCrediário");
    }
    tree.unmount();
  });

  test("a conta é uma frase só, sem equação", () => {
    const tree = montarDividido(false);
    const t = flattenText(tree.toJSON());
    expect(t).toContain("Pronto · a conta fecha em R$ 1.224,13. No cartão, os R$ 742,40 que faltavam ficam R$ 824,13 (11% a mais).");
    expect(t).not.toMatch(/Faltam/);
    expect(textoDe(tree, "carrinho-dividido-falta")).toBe("o que falta, com o acréscimo do cartão");
    expect(textoDe(tree, "carrinho-pagamento")).toBe("Dividido em 2");
    tree.unmount();
  });

  test("QA 23/09: 'Faltam…' e 'Pronto' nunca aparecem juntos, mesmo com uma nota avulsa", () => {
    // Chamador antigo que ainda manda a nota: com a conta fechada, ela some.
    const fechada = montar({
      splitMode: true, splitIsBalanced: true, splitRemaining: 0,
      splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 824.13, auto: true }],
      splitNote: "Faltam R$ 742,40. No cartão fica R$ 824,13 (11% a mais).",
      splitStatusText: "Pronto · a conta fecha em R$ 1.224,13",
    });
    expect(porTestID(fechada, "carrinho-dividido-conta")).toHaveLength(0);
    const t = flattenText(fechada.toJSON());
    expect(t).toContain("Pronto · a conta fecha em R$ 1.224,13");
    expect(t).not.toMatch(/Faltam/);
    fechada.unmount();

    // Conta aberta: só o "Faltam", nada de "Pronto".
    const aberta = montar({
      splitMode: true, splitIsBalanced: false, splitRemaining: 600,
      splitPayments: [{ method: "pix", value: 400 }],
    });
    const ta = flattenText(aberta.toJSON());
    expect(ta).toContain("Faltam R$ 600,00");
    expect(ta).not.toMatch(/Pronto/);
    aberta.unmount();
  });

  test("painel de altura limitada: ligar o dividido rola o corpo até a conta (uma vez só)", () => {
    jest.useFakeTimers();
    // Nó "de verdade" para o ScrollView do react-native-web: o scrollToEnd
    // dele termina em node.scroll({ top: scrollHeight }).
    const scroll = jest.fn();
    const opcoes = {
      createNodeMock: () => ({
        scrollHeight: 900, scrollWidth: 0, scroll,
        addEventListener: () => {}, removeEventListener: () => {},
      }),
    };
    const base = {
      splitMode: true, splitIsBalanced: true, splitRemaining: 0,
      splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 824.13, auto: true }],
      splitNote: "Faltam R$ 742,40. No cartão fica R$ 824,13 (11% a mais).",
    };
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<CartPanel {...props({ ...base, fill: true })} />, opcoes); });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 900 }));

    // QA 23/09/2026: enquanto o lojista digita, a linha "o que falta" entra
    // e sai e os valores mudam — o painel NÃO rola mais sozinho.
    scroll.mockClear();
    const digitando = [
      [{ method: "pix", value: 1224.13 }],
      [{ method: "pix", value: 40 }, { method: "cartao", value: 1180, auto: true }],
      [{ method: "pix", value: 400 }, { method: "dinheiro", value: 100 }, { method: "cartao", value: 700, auto: true }],
    ];
    for (const splitPayments of digitando) {
      act(() => { tree.update(<CartPanel {...props({ ...base, splitPayments, fill: true })} />); });
      act(() => { jest.runOnlyPendingTimers(); });
    }
    expect(scroll).not.toHaveBeenCalled();

    // Desligar e ligar de novo conta como abrir: rola outra vez.
    act(() => { tree.update(<CartPanel {...props({ ...base, splitMode: false, fill: true })} />); });
    act(() => { tree.update(<CartPanel {...props({ ...base, fill: true })} />); });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(scroll).toHaveBeenCalledTimes(1);
    tree.unmount();

    // Sem fill (celular: a página rola inteira), nada de rolar o corpo.
    scroll.mockClear();
    act(() => { tree = renderer.create(<CartPanel {...props({ ...base, fill: false })} />, opcoes); });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(scroll).not.toHaveBeenCalled();
    tree.unmount();
    jest.useRealTimers();
  });
});

describe("Pagamento no topo", () => {
  test.each([
    ["cartao", "Crédito"], ["debito", "Débito"], ["crediario", "Crediário"], ["dinheiro", "Dinheiro"], ["pix", "PIX"],
  ])("%s → %s", (key, rotulo) => {
    const tree = montar({ activePay: key });
    expect(textoDe(tree, "carrinho-pagamento")).toBe(rotulo);
    expect(flattenText(tree.toJSON())).not.toMatch(/CARTAO|DEBITO|CREDIARIO|SPLIT/);
    tree.unmount();
  });

  test("dividido com um pagamento só: o nome da forma, não 'Dividido em 1' (QA 23/09)", () => {
    const tree = montar({
      splitMode: true, splitIsBalanced: false, splitRemaining: 100,
      splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 0 }],
    });
    expect(textoDe(tree, "carrinho-pagamento")).toBe("PIX");
    expect(flattenText(tree.toJSON())).not.toMatch(/SPLIT|Dividido em 1/);
    tree.unmount();
  });

  test("dividido com dois pagamentos com valor: 'Dividido em 2'", () => {
    const tree = montar({
      splitMode: true, splitIsBalanced: false, splitRemaining: 100,
      splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 300 }],
    });
    expect(textoDe(tree, "carrinho-pagamento")).toBe("Dividido em 2");
    tree.unmount();
  });
});
