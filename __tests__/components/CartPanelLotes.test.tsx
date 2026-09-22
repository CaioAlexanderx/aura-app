// ============================================================
// Matcon M4 — o lote no item do carrinho (docs/CONTRACT_MATCON.md, M4;
// mockup matcon-m4-profundidade.html #carrinho).
//
// O que importa aqui é o contrato de zero impacto e o aviso:
//   - `matcon_lots_enabled` OFF: nenhuma linha de lote, nenhum aviso — e
//     nenhuma busca de lotes (a listLots nem é chamada).
//   - ON com 2 lotes (27B 95,12 m² e 28A 53,36 m²) e 100 m² no carrinho:
//     a linha violeta do 27B e o aviso "Precisa de 2 lotes: …".
//   - cimento em "sc" continua sem lote, mesmo com o toggle ligado.
//   - as alocações sobem pro carrinho (items[].lot_allocations da venda).
//
// Mocks no mesmo padrão do CartPanelMatcon.test.tsx (Icon + usePdvSettings
// + MerchantLogo), mais o matconApi e o auth store — os dois que a linha do
// lote precisa e que o M0 não usava.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Depósito do Zé", initial: "D" }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "co-1" }, isDemo: false, token: "t" }),
}));

const LOTES = [
  { id: "l-27b", lot_code: "27B", qty: 95.12, caliber: "03" },
  { id: "l-28a", lot_code: "28A", qty: 53.36, caliber: "03" },
];
const mockListLots = jest.fn(() => Promise.resolve({ lots: LOTES }));
jest.mock("@/services/matconApi", () => ({
  matconApi: { listLots: (...a: any[]) => (mockListLots as any)(...a) },
}));

import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

const PISO: CartDisplayItem = {
  productId: "prod-piso", productBaseId: "prod-piso",
  name: "Porcelanato Bianco 60×60", price: 54.9, qty: 100, listPrice: 54.9,
  unit: "m²", purchaseUnit: "cx", purchaseFactor: 2.32,
};

const CIMENTO: CartDisplayItem = {
  productId: "prod-cimento", productBaseId: "prod-cimento",
  name: "Cimento CP-II 50 kg", price: 32.9, qty: 10, listPrice: 32.9,
  unit: "sc", purchaseUnit: null, purchaseFactor: null,
};

function painel(items: CartDisplayItem[], onLotAllocations?: any) {
  return (
        <CartPanel
          items={items}
          subtotal={100}
          discountAmount={0}
          total={100}
          itemCount={items.reduce((s, i) => s + i.qty, 0)}
          payMethods={[{ key: "pix", label: "PIX", icon: "dollar" }]}
          activePay="pix"
          onPay={jest.fn()}
          onInc={jest.fn()}
          onDec={jest.fn()}
          onSetQty={jest.fn()}
          onRemove={jest.fn()}
          onClear={jest.fn()}
          onFinalize={jest.fn()}
          onLotAllocations={onLotAllocations}
        />
  );
}

async function flush(tree: renderer.ReactTestRenderer) {
  // deixa a query dos lotes resolver (react-query resolve em microtask +
  // agenda o render; alguns ciclos de timer dão conta).
  for (let i = 0; i < 3; i++) {
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  }
  return tree;
}

async function montar(items: CartDisplayItem[], onLotAllocations?: any) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        {painel(items, onLotAllocations)}
      </QueryClientProvider>
    );
  });
  // `atualizar` re-renderiza com outra quantidade no MESMO cliente de query
  // (o carrinho não remonta quando o vendedor digita outro número).
  (tree as any).atualizar = async (novos: CartDisplayItem[]) => {
    await act(async () => {
      tree.update(
        <QueryClientProvider client={qc}>
          {painel(novos, onLotAllocations)}
        </QueryClientProvider>
      );
    });
    await flush(tree);
  };
  await flush(tree);
  return tree;
}

describe("CartPanel · Matcon M4 — lote e tonalidade no item", () => {
  beforeEach(() => { mockListLots.mockClear(); });
  afterEach(() => { mockPdvSettings = { matcon_enabled: false }; });

  it("gate OFF: sem linha de lote, sem aviso e sem buscar lotes", async () => {
    mockPdvSettings = { matcon_enabled: true, matcon_lots_enabled: false };
    const tree = await montar([PISO]);

    expect(tree.root.findAllByProps({ testID: "carrinho-lote-prod-piso" })).toHaveLength(0);
    expect(flattenText(tree.toJSON())).not.toContain("lote");
    expect(mockListLots).not.toHaveBeenCalled();

    tree.unmount();
  });

  it("gate ON, 100 m² e 2 lotes: linha do 27B + aviso dos 2 lotes", async () => {
    mockPdvSettings = { matcon_enabled: true, matcon_lots_enabled: true };
    const tree = await montar([PISO]);

    expect(mockListLots).toHaveBeenCalledWith("co-1", "prod-piso");

    const texto = flattenText(tree.toJSON());
    expect(texto).toContain("lote 27B · 95,12 m² disponíveis");
    expect(texto).toContain(
      "Precisa de 2 lotes: 27B (95,12 m²) + 28A (4,88 m²). " +
      "Lotes diferentes podem ter tom diferente — avise o cliente ou escolha outro lote."
    );
    // "trocar lote" é botão sempre visível — nada de hover-reveal.
    expect(tree.root.findAllByProps({ testID: "carrinho-trocar-lote-prod-piso" }).length).toBeGreaterThan(0);

    tree.unmount();
  });

  it("cabe no lote: linha violeta sem aviso nenhum", async () => {
    mockPdvSettings = { matcon_enabled: true, matcon_lots_enabled: true };
    const tree = await montar([{ ...PISO, qty: 50 }]);

    expect(flattenText(tree.toJSON())).toContain("lote 27B · 95,12 m² disponíveis");
    expect(tree.root.findAllByProps({ testID: "carrinho-lote-aviso-prod-piso" })).toHaveLength(0);

    tree.unmount();
  });

  it("cimento em sc não tem lote nem com o gate ligado", async () => {
    mockPdvSettings = { matcon_enabled: true, matcon_lots_enabled: true };
    const tree = await montar([CIMENTO]);

    expect(mockListLots).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: "carrinho-lote-prod-cimento" })).toHaveLength(0);

    tree.unmount();
  });

  it("as alocações sobem pro carrinho (lot_allocations da venda)", async () => {
    mockPdvSettings = { matcon_enabled: true, matcon_lots_enabled: true };
    const onLotAllocations = jest.fn();
    const tree = await montar([PISO], onLotAllocations);

    expect(onLotAllocations).toHaveBeenLastCalledWith("prod-piso", [
      { lot_id: "l-27b", lot_code: "27B", quantity: 95.12 },
      { lot_id: "l-28a", lot_code: "28A", quantity: 4.88 },
    ]);

    tree.unmount();
  });

  it("mudou a quantidade, recalcula e reporta o novo rateio", async () => {
    mockPdvSettings = { matcon_enabled: true, matcon_lots_enabled: true };
    const onLotAllocations = jest.fn();
    const tree: any = await montar([PISO], onLotAllocations);
    onLotAllocations.mockClear();

    // 100 m² não cabiam no 27B; 50 m² cabem — o rateio vira um lote só.
    await tree.atualizar([{ ...PISO, qty: 50 }]);

    expect(onLotAllocations).toHaveBeenLastCalledWith("prod-piso", [
      { lot_id: "l-27b", lot_code: "27B", quantity: 50 },
    ]);
    expect(flattenText(tree.toJSON())).not.toContain("Precisa de 2 lotes");

    tree.unmount();
  });
});
