// ============================================================
// 18/10/2026 (tq-18): venda idempotente fora do Caixa — a OS de óculos da
// Ótica, que registra a venda com sinal (POST /pdv/sale-com-sinal).
//
// O depositSaleId só protege depois que a resposta da venda chega. O que
// este arquivo trava:
//   1. timeout na venda e "Abrir OS" de novo: a MESMA chave
//   2. timeout, sai da tela e abre a OS de novo: a MESMA chave
//   3. venda registrada: a próxima OS manda outra chave
//   4. 409 IDEMPOTENCY_KEY_REUSED troca a chave; erro comum não
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: (...a: any[]) => mockToastError(...a) },
}));
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...a: any[]) => mockReplace(...a), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ customer_id: "cli-1" }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "otica-1" }, user: { id: "user-1" } }),
}));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: [{ id: "cli-1", name: "Maria Souza", phone: "11999990000" }] }),
}));
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [{ id: "arm-1", name: "Armação Ray-Ban", price: 300, code: "RB1" }] }),
}));

function isoDaqui(dias: number) {
  const d = new Date(); d.setDate(d.getDate() + dias);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const mockReceita = {
  id: "rx-1", customer_id: "cli-1",
  od_sph: -1, od_cyl: null, od_axis: null, od_add: null, od_prism: null, od_base: null,
  oe_sph: -1.25, oe_cyl: null, oe_axis: null, oe_add: null, oe_prism: null, oe_base: null,
  od_pd: null, oe_pd: null, od_height: null, oe_height: null,
  prescriber_type: "oftalmologista", prescriber_name: "Dr. Lima", prescriber_registry: "CRM 1",
  issued_at: isoDaqui(-10), valid_until: isoDaqui(300),
};
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: (cfg: any) => {
    const k = cfg.queryKey?.[0];
    if (k === "otica-prescriptions") return { data: { prescriptions: [mockReceita] } };
    if (k === "otica-labs") return { data: { labs: [] } };
    return { data: undefined };
  },
}));

type Resposta = { ok: any } | { erro: any };
let mockRespostas: Resposta[] = [];
const mockChamadas: { body: any; opts: any }[] = [];
jest.mock("@/services/pdvApi", () => ({
  pdvApi: {
    createSale: jest.fn(),
    createSaleComSinal: (_cid: string, body: any, opts: any) => {
      mockChamadas.push({ body, opts });
      const r = mockRespostas.shift() || { ok: { sale: { id: "venda-x" } } };
      return "ok" in r ? Promise.resolve(r.ok) : Promise.reject(r.erro);
    },
  },
}));
const mockCriarOs = jest.fn(() => Promise.resolve({ order: { id: "os-1", os_number: 12 } }));
jest.mock("@/services/serviceOrdersApi", () => ({
  serviceOrdersApi: { create: (...a: any[]) => (mockCriarOs as any)(...a) },
}));

import OticaNovaScreen from "@/app/(tabs)/otica/nova";
import { __zerarChavesDaVendaParaTestes } from "@/hooks/useChaveDaVenda";

const TIMEOUT = { status: 0, isNetworkError: true, code: "timeout", message: "Não recebemos resposta a tempo." };
const chaveDa = (i: number) => mockChamadas[i].opts?.idempotencyKey;

function montar() {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<OticaNovaScreen />); });
  return t;
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.find((n: any) => n.props?.testID === id && (n.props.onPress || n.props.onChangeText));
function preencher(t: renderer.ReactTestRenderer) {
  act(() => { porId(t, "otica-busca-armacao").props.onChangeText("ray"); });
  act(() => { porId(t, "otica-armacao-arm-1").props.onPress(); });
  act(() => { porId(t, "otica-lente-marca").props.onChangeText("Essilor"); });
  act(() => { porId(t, "otica-lente-valor").props.onChangeText("500,00"); });
  const [y, m, d] = isoDaqui(10).split("-");
  act(() => { porId(t, "otica-prometido").props.onChangeText(`${d}/${m}/${y}`); });
  act(() => { porId(t, "otica-sinal").props.onChangeText("200,00"); });
}
async function salvar(t: renderer.ReactTestRenderer) {
  await act(async () => { await porId(t, "otica-salvar").props.onPress(); });
}

beforeEach(() => {
  __zerarChavesDaVendaParaTestes();
  mockRespostas = [];
  mockChamadas.length = 0;
  mockCriarOs.mockClear();
  mockReplace.mockClear();
});

describe("Ótica: OS de óculos com sinal e a chave da venda", () => {
  test("timeout e nova tentativa: mesma chave; a OS abre com a venda", async () => {
    const t = montar();
    preencher(t);
    mockRespostas.push({ erro: TIMEOUT });
    await salvar(t);
    expect(mockCriarOs).not.toHaveBeenCalled();

    mockRespostas.push({ ok: { sale: { id: "venda-1" }, idempotent_replay: true } });
    await salvar(t);
    expect(mockChamadas).toHaveLength(2);
    expect(chaveDa(0)).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(mockChamadas[0].body.sinal).toEqual({ method: "pix", amount: 200 });
    expect((mockCriarOs.mock.calls[0] as any[])[1].deposit_sale_id).toBe("venda-1");
    act(() => { t.unmount(); });
  });

  test("timeout, sai da tela e abre a OS de novo: mesma chave; depois da venda, outra", async () => {
    let t = montar();
    preencher(t);
    mockRespostas.push({ erro: TIMEOUT });
    await salvar(t);
    act(() => { t.unmount(); });

    t = montar();
    preencher(t);
    mockRespostas.push({ ok: { sale: { id: "venda-1" } } });
    await salvar(t);
    expect(chaveDa(1)).toBe(chaveDa(0));
    act(() => { t.unmount(); });

    // próxima OS (venda concluída): outra chave
    t = montar();
    preencher(t);
    mockRespostas.push({ ok: { sale: { id: "venda-2" } } });
    await salvar(t);
    expect(chaveDa(2)).not.toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("409 IDEMPOTENCY_KEY_REUSED troca a chave e mostra a mensagem; erro comum não troca", async () => {
    const t = montar();
    preencher(t);
    mockRespostas.push({ erro: { status: 422, data: { error: "Sinal inválido" } } });
    await salvar(t);
    mockRespostas.push({ erro: { status: 409, data: { code: "IDEMPOTENCY_KEY_REUSED", error: "Esta venda já foi registrada (venda 7) com outros itens." } } });
    await salvar(t);
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(mockToastError).toHaveBeenLastCalledWith("Esta venda já foi registrada (venda 7) com outros itens.");
    mockRespostas.push({ ok: { sale: { id: "venda-2" } } });
    await salvar(t);
    expect(chaveDa(2)).not.toBe(chaveDa(1));
    act(() => { t.unmount(); });
  });
});
