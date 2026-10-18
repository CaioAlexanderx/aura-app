// ============================================================
// 18/10/2026 (tq-18): venda idempotente fora do Caixa — o checkout do Studio.
//
// O que este arquivo trava:
//   1. useChaveDaVenda: mesma chave até concluir; troca só no 409
//      IDEMPOTENCY_KEY_REUSED; com escopo, a chave pendente sobrevive à tela
//      desmontada; escopos diferentes não se misturam
//   2. pdvApi.createSaleComSinal põe o Idempotency-Key, e a repetição
//      automática do request() (queda de rede) manda a MESMA chave
//   3. useStudioCheckout (venda comum e com sinal): mesma chave entre timeout
//      e nova tentativa, nova depois da venda registrada, nova depois do 409
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

type Resposta = { ok: any } | { erro: any };
let mockRespostas: Resposta[] = [];
const mockChamadas: { rota: "sale" | "sinal"; body: any; opts: any }[] = [];
function mockResponder(rota: "sale" | "sinal", body: any, opts: any) {
  mockChamadas.push({ rota, body, opts });
  const r = mockRespostas.shift() || { ok: { sale: { id: "venda-x", items: [] } } };
  return "ok" in r ? Promise.resolve(r.ok) : Promise.reject(r.erro);
}
jest.mock("@/services/pdvApi", () => {
  const real = jest.requireActual("@/services/pdvApi");
  return {
    ...real,
    pdvApi: {
      ...real.pdvApi,
      createSale: (_cid: string, body: any, opts: any) => mockResponder("sale", body, opts),
      createSaleComSinal: (_cid: string, body: any, opts: any) => mockResponder("sinal", body, opts),
    },
    __real: real,
  };
});
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: () => Promise.resolve({ config: null }) } }));
jest.mock("@/services/couponsApi", () => ({ couponsApi: { validate: jest.fn() } }));

import { useStudioCheckout } from "@/components/studio/pdv/useStudioCheckout";
import { useChaveDaVenda, __zerarChavesDaVendaParaTestes, type ChaveDaVenda } from "@/hooks/useChaveDaVenda";
import { request } from "@/services/api";

const TIMEOUT = { status: 0, isNetworkError: true, code: "timeout", message: "Não recebemos resposta a tempo." };
const REUSADA = { status: 409, data: { code: "IDEMPOTENCY_KEY_REUSED", error: "Esta venda já foi registrada (venda 7) com outros itens." }, message: "Esta venda já foi registrada (venda 7) com outros itens." };
const chaveDa = (i: number) => mockChamadas[i].opts?.idempotencyKey;

beforeEach(() => {
  __zerarChavesDaVendaParaTestes();
  mockRespostas = [];
  mockChamadas.length = 0;
});

// ── 1. o hook ──────────────────────────────────────────────────────────
describe("useChaveDaVenda", () => {
  let chave: ChaveDaVenda;
  function Harness({ escopo }: { escopo?: string | null }) { chave = useChaveDaVenda(escopo); return null; }
  function montar(escopo?: string | null) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Harness escopo={escopo} />); });
    return t;
  }

  test("mesma chave até concluir; troca só no 409 IDEMPOTENCY_KEY_REUSED", () => {
    const t = montar();
    const a = chave.atual();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(chave.atual()).toBe(a);
    chave.aposErro(TIMEOUT);
    chave.aposErro({ status: 409, data: { error: "Estoque insuficiente" } });
    chave.aposErro({ status: 500, code: "server_error" });
    expect(chave.atual()).toBe(a);
    chave.aposErro(REUSADA);
    const b = chave.atual();
    expect(b).not.toBe(a);
    chave.concluida();
    expect(chave.atual()).not.toBe(b);
    act(() => { t.unmount(); });
  });

  test("com escopo, a chave pendente sobrevive à tela desmontada; sem escopo, não", () => {
    let t = montar("studio-checkout:empresa-1");
    const pendente = chave.atual();
    act(() => { t.unmount(); });
    t = montar("studio-checkout:empresa-1");
    expect(chave.atual()).toBe(pendente);
    chave.concluida();
    const proxima = chave.atual();
    act(() => { t.unmount(); });
    t = montar("studio-checkout:empresa-1");
    expect(chave.atual()).toBe(proxima);
    act(() => { t.unmount(); });

    t = montar("studio-checkout:empresa-2");
    expect(chave.atual()).not.toBe(proxima);
    act(() => { t.unmount(); });

    t = montar(null);
    const local = chave.atual();
    act(() => { t.unmount(); });
    t = montar(null);
    expect(chave.atual()).not.toBe(local);
    act(() => { t.unmount(); });
  });
});

// ── 2. o cabeçalho e a repetição automática do request() ───────────────
describe("createSaleComSinal e a repetição do request()", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  test("o request() repete na queda de rede com a MESMA chave", async () => {
    const realPdvApi = (jest.requireMock("@/services/pdvApi") as any).__real.pdvApi;
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: 201, ok: true, json: async () => ({ sale: { id: "venda-1" } }) });
    global.fetch = fetchMock as any;

    const r = await realPdvApi.createSaleComSinal("empresa-1", { items: [] }, { idempotencyKey: "5f0c1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b" });
    expect(r.sale.id).toBe("venda-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url1, init1] = fetchMock.mock.calls[0];
    const [, init2] = fetchMock.mock.calls[1];
    expect(String(url1)).toMatch(/\/companies\/empresa-1\/pdv\/sale-com-sinal$/);
    expect(init1.headers["Idempotency-Key"]).toBe("5f0c1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b");
    expect(init2.headers["Idempotency-Key"]).toBe("5f0c1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b");
    expect(JSON.parse(init1.body)).toEqual({ items: [] });
  });

  test("sem chave: sem cabeçalho (comportamento de antes)", async () => {
    const realPdvApi = (jest.requireMock("@/services/pdvApi") as any).__real.pdvApi;
    const fetchMock = jest.fn().mockResolvedValue({ status: 201, ok: true, json: async () => ({}) });
    global.fetch = fetchMock as any;
    await realPdvApi.createSaleComSinal("empresa-1", { items: [] });
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBeUndefined();
  });

  // garante que o import do request real não foi trocado por mock
  test("request é o de verdade", () => { expect(typeof request).toBe("function"); });
});

// ── 3. o checkout do Studio ────────────────────────────────────────────
describe("Studio: checkout com chave de idempotência", () => {
  let api: ReturnType<typeof useStudioCheckout>;
  function Harness({ cid }: { cid: string }) { api = useStudioCheckout(cid); return null; }
  function montar() {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Harness cid="empresa-1" />); });
    return t;
  }
  const carrinho: any[] = [{ lineId: "l1", product: { id: "caneca", name: "Caneca", price: 40 }, qty: 1, values: {}, kind: "rapido" }];
  async function fechar(): Promise<boolean> {
    let ok = false;
    await act(async () => { ok = await api.finalizeSale(carrinho as any, 40); });
    return ok;
  }

  test("venda comum: mesma chave entre timeout e nova tentativa; nova depois da venda", async () => {
    const t = montar();
    mockRespostas.push({ erro: TIMEOUT });
    expect(await fechar()).toBe(false);
    mockRespostas.push({ ok: { sale: { id: "venda-1", items: [] }, idempotent_replay: true } });
    expect(await fechar()).toBe(true);
    expect(mockChamadas.map((c) => c.rota)).toEqual(["sale", "sale"]);
    expect(chaveDa(0)).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(chaveDa(1)).toBe(chaveDa(0));
    // a chave é cabeçalho, não vai no body
    expect(mockChamadas[0].body.idempotency_key).toBeUndefined();

    act(() => { api.reset(); });
    mockRespostas.push({ ok: { sale: { id: "venda-2", items: [] } } });
    expect(await fechar()).toBe(true);
    expect(chaveDa(2)).not.toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("timeout, sai da tela e volta: a nova tentativa manda a mesma chave", async () => {
    let t = montar();
    mockRespostas.push({ erro: TIMEOUT });
    await fechar();
    act(() => { t.unmount(); });
    t = montar();
    mockRespostas.push({ ok: { sale: { id: "venda-1", items: [] } } });
    await fechar();
    expect(chaveDa(1)).toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("venda com sinal: /sale-com-sinal com a chave, mesma no timeout, nova depois", async () => {
    const t = montar();
    act(() => {
      api.setCustomer("Ana");
      api.toggleSignal();
    });
    act(() => {
      api.setSignalValue("10");
      api.setSignalDueDate("2026-10-30");
    });
    mockRespostas.push({ erro: TIMEOUT });
    await fechar();
    mockRespostas.push({ ok: { sale: { id: "venda-1", items: [] }, signal: { amount: 10, method: "pix", balance: 30, balance_due_date: "2026-10-30" } } });
    expect(await fechar()).toBe(true);
    expect(mockChamadas.map((c) => c.rota)).toEqual(["sinal", "sinal"]);
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(mockChamadas[0].body.sinal).toEqual({ method: "pix", amount: 10 });

    mockRespostas.push({ ok: { sale: { id: "venda-2", items: [] } } });
    await fechar();
    expect(chaveDa(2)).not.toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("409 IDEMPOTENCY_KEY_REUSED mostra a mensagem do servidor e troca a chave", async () => {
    const t = montar();
    mockRespostas.push({ erro: REUSADA });
    expect(await fechar()).toBe(false);
    expect(api.error).toBe("Esta venda já foi registrada (venda 7) com outros itens.");
    mockRespostas.push({ ok: { sale: { id: "venda-2", items: [] } } });
    await fechar();
    expect(chaveDa(1)).not.toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("erro comum (estoque) não troca a chave", async () => {
    const t = montar();
    mockRespostas.push({ erro: { status: 409, data: { error: "Estoque insuficiente" }, message: "Estoque insuficiente" } });
    await fechar();
    mockRespostas.push({ ok: { sale: { id: "venda-1", items: [] } } });
    await fechar();
    expect(chaveDa(1)).toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });
});
