// ============================================================
// 17/11/2026 (p-147): os avisos da tela final e do carrinho.
//   1. Tela final: "Pode bipar o próximo produto…" embaixo dos botões; com
//      itens esperando a próxima venda, quantos são
//   2. Tela final: enquanto a nota é enviada, "A nota continua sendo
//      enviada mesmo que você comece a próxima venda."
//   3. Carrinho durante a espera: "Finalizando a venda…" no botão e no aviso
//      em cima dos itens, com o que foi guardado para a próxima venda
// Mocks do padrão do repo; testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api" }));
jest.mock("@/components/screens/pdv/NfceActions", () => ({ NfceActions: () => null }));
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/utils/clipboard", () => ({ copyText: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Loja", initial: "L" }),
}));
const mockEmit = jest.fn((..._a: any[]) => new Promise(() => {}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: (...a: any[]) => mockEmit(...a), get: jest.fn() } }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";
import { chaveDaNotaDaVenda, emitirNota, __zerarNotasParaTestes } from "@/services/emissaoDaNfce";
import type { SaleResult } from "@/hooks/useCart";

function comQuery(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{el}</QueryClientProvider>;
}
function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
const textoDe = (t: renderer.ReactTestRenderer, id: string) => { const a = porId(t, id); return a.length ? texto(a[0].children) : ""; };

const VENDA: SaleResult = {
  id: "0f6c1d2e-aaaa-bbbb-cccc-000000001048",
  saleNumber: 1048, total: 179.9, payment: "pix",
  items: [{ productId: "blusa", name: "Blusa", price: 179.9, qty: 1 }],
  date: "17/11/2026",
} as any;

beforeEach(() => { __zerarNotasParaTestes(); jest.clearAllMocks(); });

describe("tela final", () => {
  function montar(extra: Partial<React.ComponentProps<typeof SaleComplete>> = {}) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(comQuery(<SaleComplete sale={VENDA} onNewSale={jest.fn()} {...extra} />)); });
    return t;
  }

  it("embaixo dos botões: pode bipar o próximo produto", () => {
    const t = montar();
    expect(textoDe(t, "venda-pode-bipar")).toBe("Pode bipar o próximo produto: a venda nova começa sozinha.");
  });

  it("com itens esperando a próxima venda: quantos (singular e plural)", () => {
    expect(textoDe(montar({ itensEsperando: 1 }), "venda-pode-bipar")).toBe("1 produto já está esperando na próxima venda.");
    expect(textoDe(montar({ itensEsperando: 2 }), "venda-pode-bipar")).toBe("2 produtos já estão esperando na próxima venda.");
  });

  it("nota sendo enviada: a linha avisa que ela continua; sem nota, nada", () => {
    const t = montar();
    expect(porId(t, "venda-nota-continua")).toHaveLength(0);
    act(() => { emitirNota(chaveDaNotaDaVenda(VENDA.id), "empresa-1", { items: [] } as any); });
    expect(textoDe(t, "venda-nota-continua")).toBe("A nota continua sendo enviada mesmo que você comece a próxima venda.");
  });
});

describe("carrinho durante a espera da venda", () => {
  const A: CartDisplayItem = { productId: "a", productBaseId: "a", name: "Camiseta", price: 50, qty: 1, listPrice: 50 } as any;
  function montar(isProcessing: boolean, proximaVenda?: { name: string; qty: number }[]) {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <CartPanel
          items={[A]} subtotal={50} discountAmount={0} total={50} itemCount={1}
          payMethods={[{ key: "pix", label: "PIX", icon: "dollar" }] as any} activePay="pix"
          onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
          isProcessing={isProcessing} proximaVenda={proximaVenda}
        />,
      );
    });
    return t;
  }

  it("fora da espera: sem aviso", () => {
    expect(porId(montar(false), "carrinho-finalizando")).toHaveLength(0);
  });

  it("na espera: aviso em cima dos itens e o botão diz Finalizando a venda…", () => {
    const t = montar(true);
    const aviso = textoDe(t, "carrinho-finalizando");
    expect(aviso).toContain("Finalizando a venda…");
    expect(aviso).toContain("Pode atender o próximo cliente: o que for bipado agora entra na próxima venda.");
    expect(porId(t, "carrinho-guardado")).toHaveLength(0);
    const botao = t.root.findAll((n: any) => n.props && n.props.accessibilityState && n.props.accessibilityState.busy === true, { deep: false });
    expect(texto(botao[0].children)).toContain("Finalizando a venda…");
  });

  it("com item bipado na espera: a lista do que foi guardado", () => {
    const t = montar(true, [{ name: "Cinto Couro Fino", qty: 1 }, { name: "Meia", qty: 2 }]);
    expect(textoDe(t, "carrinho-guardado")).toBe("Guardado para a próxima venda: Cinto Couro Fino, Meia (2)");
  });
});
