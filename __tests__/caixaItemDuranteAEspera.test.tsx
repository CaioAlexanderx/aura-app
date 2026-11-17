// ============================================================
// 17/11/2026 (p-146, R3c): item lançado durante a espera da venda não some.
//
// O POST /pdv/sale leva de 3 a 6 s. Antes, o produto bipado ou clicado para
// o próximo cliente nesse meio-tempo entrava no carrinho em voo e sumia
// quando a resposta esvaziava o carrinho. O que este arquivo trava:
//   1. bipe e clique durante a espera NÃO vão na venda que está sendo gravada
//      (nem no body do POST, nem no carrinho da tela)
//   2. venda aceita: "Nova venda" abre com o que foi lançado na espera
//   3. venda recusada: o carrinho original volta intacto, sem o item novo;
//      o item novo continua esperando a próxima venda
//   4. sem nada na espera, a venda nova é o carrinho vazio de sempre
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, user: { id: "user-1" }, isDemo: false }),
}));

// O POST fica pendurado até o teste decidir: `responder` aceita, `recusar`
// devolve erro. `mockChamadas` guarda o body que o useCart mandou.
let mockPendente: { resolve: (v: any) => void; reject: (e: any) => void } | null = null;
const mockChamadas: any[] = [];
jest.mock("@/services/api", () => ({
  pdvApi: {
    createSale: (_cid: string, body: any) => {
      mockChamadas.push(JSON.parse(JSON.stringify(body)));
      return new Promise((resolve, reject) => { mockPendente = { resolve, reject }; });
    },
  },
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (cfg: any) => ({
    mutate: (body: any, cbs: any) => {
      Promise.resolve()
        .then(() => cfg.mutationFn(body))
        .then((r: any) => { cfg.onSuccess?.(r); cbs?.onSuccess?.(r); }, (e: any) => { cbs?.onError?.(e); });
    },
  }),
}));

import { useCart } from "@/hooks/useCart";
import { __zerarParaTestes } from "@/utils/vendaGuardada";

let api: ReturnType<typeof useCart>;
function Harness() {
  api = useCart();
  return null;
}
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness />); });
  return tree;
}
const microtarefas = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
async function finalizar() {
  await act(async () => { api.finalizeSale(); });
  await act(microtarefas); // o POST saiu e está pendurado
}
async function responder(r: any) {
  await act(async () => { mockPendente!.resolve(r); await microtarefas(); });
}
async function recusar(e: any) {
  await act(async () => { mockPendente!.reject(e); await microtarefas(); });
}
const ids = (itens: { productId: string; qty: number }[]) => itens.map(i => i.productId + "×" + i.qty);

const PISO = { id: "piso", name: "Porcelanato", price: 64.8 };
const CIMENTO = { id: "cim", name: "Cimento", price: 38 };
const ARGAMASSA = { id: "arg", name: "Argamassa", price: 22.5 };

beforeEach(() => {
  jest.useFakeTimers();
  __zerarParaTestes();
  window.localStorage.clear();
  mockPendente = null;
  mockChamadas.length = 0;
});
afterEach(() => { jest.useRealTimers(); });

describe("Caixa: item lançado durante a espera da venda", () => {
  test("bipe e clique na espera não entram na venda em voo e abrem a próxima", async () => {
    const t = montar();
    act(() => { api.addToCart(PISO); });
    await finalizar();
    expect(mockChamadas).toHaveLength(1);
    expect(api.isProcessing).toBe(true);

    // bipe (o leitor chama addToCart) e clique no cartão, o mesmo produto duas vezes
    act(() => { api.addToCart(CIMENTO); });
    act(() => { api.addToCart(ARGAMASSA); });
    act(() => { api.addToCart(CIMENTO); });

    // a venda em voo continua só com o piso, na tela e no POST
    expect(ids(api.cart)).toEqual(["piso×1"]);
    expect(mockChamadas[0].items.map((i: any) => i.product_name_snapshot)).toEqual(["Porcelanato"]);
    expect(ids(api.itensDaProximaVenda)).toEqual(["cim×2", "arg×1"]);

    await responder({ sale: { id: "venda-1", sale_number: 7 } });
    expect(api.lastSale?.id).toBe("venda-1");
    expect(api.lastSale?.items.map(i => i.productId)).toEqual(["piso"]);
    expect(api.cart).toHaveLength(0);
    // continua esperando até "Nova venda"
    expect(ids(api.itensDaProximaVenda)).toEqual(["cim×2", "arg×1"]);

    act(() => { api.newSale(); });
    expect(api.lastSale).toBeNull();
    expect(ids(api.cart)).toEqual(["cim×2", "arg×1"]);
    expect(api.itensDaProximaVenda).toHaveLength(0);

    // e a próxima venda manda só esses itens
    await finalizar();
    expect(mockChamadas[1].items.map((i: any) => [i.product_name_snapshot, i.quantity])).toEqual([["Cimento", 2], ["Argamassa", 1]]);
    await responder({ sale: { id: "venda-2" } });
    act(() => { t.unmount(); });
  });

  test("venda recusada: o carrinho original volta intacto, sem o item da espera", async () => {
    const t = montar();
    act(() => { api.addToCart(PISO); api.addToCart(PISO); });
    await finalizar();
    act(() => { api.addToCart(CIMENTO); });

    await recusar({ status: 409, data: { error: "Estoque insuficiente" } });
    expect(api.isProcessing).toBe(false);
    expect(api.lastSale).toBeNull();
    expect(ids(api.cart)).toEqual(["piso×2"]);
    expect(ids(api.itensDaProximaVenda)).toEqual(["cim×1"]);

    // depois da espera, lançar de novo vai para o carrinho da tela, normal
    act(() => { api.addToCart(ARGAMASSA); });
    expect(ids(api.cart)).toEqual(["piso×2", "arg×1"]);
    expect(ids(api.itensDaProximaVenda)).toEqual(["cim×1"]);

    // tentou de novo e passou: o cimento abre a venda seguinte
    await finalizar();
    expect(mockChamadas[1].items.map((i: any) => i.product_name_snapshot)).toEqual(["Porcelanato", "Argamassa"]);
    await responder({ sale: { id: "venda-1" } });
    act(() => { api.newSale(); });
    expect(ids(api.cart)).toEqual(["cim×1"]);
    act(() => { t.unmount(); });
  });

  test("a venda guardada no aparelho nunca leva o item da espera", async () => {
    const t = montar();
    act(() => { api.addToCart(PISO); });
    await finalizar();
    act(() => { api.addToCart(CIMENTO); });
    act(() => { jest.advanceTimersByTime(1000); });
    await recusar({ status: 409, data: { error: "Estoque insuficiente" } });
    act(() => { jest.advanceTimersByTime(1000); });
    const bruto = window.localStorage.getItem("aura:caixa:venda:empresa-1:user-1");
    const guardada = bruto ? JSON.parse(bruto) : null;
    expect(guardada?.dados?.cart?.map((i: any) => i.productId)).toEqual(["piso"]);
    act(() => { t.unmount(); });
  });

  test("sem nada na espera, a venda nova é o carrinho vazio de sempre", async () => {
    const t = montar();
    act(() => { api.addToCart(PISO); });
    await finalizar();
    await responder({ sale: { id: "venda-1" } });
    expect(api.itensDaProximaVenda).toHaveLength(0);
    act(() => { api.newSale(); });
    expect(api.cart).toHaveLength(0);
    act(() => { t.unmount(); });
  });
});
