// ============================================================
// 17/10/2026 (tq-15, Aura-backend#850): chave de idempotência da venda.
//
// O Caixa manda `Idempotency-Key` no POST /pdv/sale. O que este arquivo trava:
//   1. a chave é a MESMA entre tentativas da mesma venda (erro/timeout e
//      tentar de novo) e muda depois de uma venda concluída
//   2. ela vai junto na venda guardada: a segunda aba que restaura o mesmo
//      carrinho manda a mesma chave
//   3. venda guardada antes disto (sem chave) restaura com a chave da aba
//   4. 409 IDEMPOTENCY_KEY_REUSED troca a chave (o próximo clique é venda nova)
//   5. pdvApi.createSale põe o cabeçalho só quando há chave
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
// O POST: cada teste diz como o servidor responde; `mockChamadas` guarda o
// que o useCart mandou (body e opções, onde vai a chave).
type Resposta = { ok: any } | { erro: any };
let mockRespostas: Resposta[] = [];
const mockChamadas: { body: any; opts: any }[] = [];
jest.mock("@/services/api", () => ({
  pdvApi: {
    createSale: (_cid: string, body: any, opts: any) => {
      mockChamadas.push({ body, opts });
      const r = mockRespostas.shift() || { ok: { sale: { id: "venda-x" } } };
      return "ok" in r ? Promise.resolve(r.ok) : Promise.reject(r.erro);
    },
  },
}));
// useMutation de verdade o bastante: chama o mutationFn do hook (é ele que
// lê a chave) e devolve pelo onSuccess/onError do mutate.
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

import { useCart, novaChaveDaVenda } from "@/hooks/useCart";
import { __zerarParaTestes } from "@/utils/vendaGuardada";

const CHAVE_STORAGE = "aura:caixa:venda:empresa-1:user-1";

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
async function finalizar() {
  await act(async () => { api.finalizeSale(); });
  // o mutate resolve em microtarefas
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}
function guardado(): any {
  const bruto = window.localStorage.getItem(CHAVE_STORAGE);
  return bruto ? JSON.parse(bruto) : null;
}
const chaveDa = (i: number) => mockChamadas[i].opts?.idempotencyKey;

beforeEach(() => {
  jest.useFakeTimers();
  __zerarParaTestes();
  window.localStorage.clear();
  mockRespostas = [];
  mockChamadas.length = 0;
});
afterEach(() => { jest.useRealTimers(); });

describe("Caixa: chave de idempotência da venda", () => {
  test("mesma chave entre tentativas; muda depois da venda concluída", async () => {
    const t = montar();
    act(() => { api.addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });

    // 1a tentativa: timeout (a venda pode ter sido gravada)
    mockRespostas.push({ erro: { status: 0, isNetworkError: true, code: "timeout", message: "Não recebemos resposta a tempo." } });
    await finalizar();
    expect(api.cart).toHaveLength(1); // o carrinho fica para tentar de novo

    // 2a tentativa: o servidor devolve a venda (repetição ou não)
    mockRespostas.push({ ok: { sale: { id: "venda-1", sale_number: 7 }, idempotent_replay: true } });
    await finalizar();
    expect(mockChamadas).toHaveLength(2);
    expect(typeof chaveDa(0)).toBe("string");
    expect(chaveDa(0).length).toBeGreaterThanOrEqual(8);
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(api.cart).toHaveLength(0);
    expect(api.lastSale?.id).toBe("venda-1");

    // próxima venda: outra chave
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    mockRespostas.push({ ok: { sale: { id: "venda-2" } } });
    await finalizar();
    expect(chaveDa(2)).not.toBe(chaveDa(0));
    // a chave não vai no body (é cabeçalho)
    expect(mockChamadas[2].body.idempotency_key).toBeUndefined();
    act(() => { t.unmount(); });
  });

  test("a chave vai na venda guardada e a outra aba que restaura manda a mesma", async () => {
    const abaA = montar();
    act(() => { api.addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });
    act(() => { jest.advanceTimersByTime(500); });
    const chaveGuardada = guardado()?.dados?.idempotencyKey;
    expect(typeof chaveGuardada).toBe("string");
    act(() => { abaA.unmount(); });

    // "outra aba": monta com o carrinho vazio e restaura do storage
    const abaB = montar();
    expect(api.cart).toHaveLength(1);
    mockRespostas.push({ ok: { sale: { id: "venda-1" } } });
    await finalizar();
    expect(chaveDa(0)).toBe(chaveGuardada);
    act(() => { abaB.unmount(); });
  });

  test("venda guardada antes da chave restaura com a chave da aba", async () => {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify({
      v: 2, empresa: "empresa-1", usuario: "user-1", em: Date.now(),
      dados: { cart: [{ productId: "piso", name: "Porcelanato", price: 64.8, qty: 1 }], payment: "pix" },
    }));
    const t = montar();
    expect(api.cart).toHaveLength(1);
    mockRespostas.push({ ok: { sale: { id: "venda-1" } } });
    await finalizar();
    expect(typeof chaveDa(0)).toBe("string");
    expect(chaveDa(0).length).toBeGreaterThanOrEqual(8);
    act(() => { t.unmount(); });
  });

  test("409 IDEMPOTENCY_KEY_REUSED troca a chave; o carrinho continua", async () => {
    const t = montar();
    act(() => { api.addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });
    mockRespostas.push({ erro: { status: 409, data: { code: "IDEMPOTENCY_KEY_REUSED", error: "Esta venda já foi registrada (venda 7) com outros itens." } } });
    await finalizar();
    expect(api.cart).toHaveLength(1);
    mockRespostas.push({ ok: { sale: { id: "venda-2" } } });
    await finalizar();
    expect(chaveDa(1)).not.toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("erro comum (cupom, estoque) NÃO troca a chave", async () => {
    const t = montar();
    act(() => { api.addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });
    mockRespostas.push({ erro: { status: 409, data: { error: "Estoque insuficiente" } } });
    await finalizar();
    mockRespostas.push({ ok: { sale: { id: "venda-1" } } });
    await finalizar();
    expect(chaveDa(1)).toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("novaChaveDaVenda: única e no formato que o backend aceita", () => {
    const a = novaChaveDaVenda();
    const b = novaChaveDaVenda();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    const original = (globalThis as any).crypto;
    try {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
      const c = novaChaveDaVenda();
      expect(c).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });
    }
  });
});
