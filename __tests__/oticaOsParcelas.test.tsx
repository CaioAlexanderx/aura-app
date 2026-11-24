// ============================================================
// p-205 (23/11/2026): quantidade, tipo de serviço e parcelas do saldo na
// nova OS de óculos. O que este arquivo trava:
//   1. padrões do Caio: 1 par; lente + montagem — gravados no snapshot;
//   2. parcelas = 1: o corpo da venda com sinal é o de sempre (sem o campo);
//   3. parcelas = N: vai saldo_installments = N e a tela mostra "Nx de";
//   4. sem sinal não há parcelas.
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
});

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

describe("Ótica: OS com quantidade, serviço e parcelas", () => {
  test("padrões: 1 par e lente + montagem; parcelas 1 = corpo de sempre", async () => {
    const t = montar();
    preencher(t);
    expect(texto(t.toJSON())).toContain("1x de R$ 600,00");
    await salvar(t);
    expect(mockChamadas[0].body).not.toHaveProperty("saldo_installments");
    const optical = (mockCriarOs.mock.calls[0] as any[])[1].optical;
    expect(optical.quantity).toBe("par");
    expect(optical.service_type).toBe("lente_montagem");
    act(() => { t.unmount(); });
  });

  test("escolhe 1 lente, só montagem e 3 parcelas: vai tudo, e a tela mostra 3x", async () => {
    const t = montar();
    preencher(t);
    act(() => { porId(t, "otica-quantidade-unidade").props.onPress(); });
    act(() => { porId(t, "otica-servico-montagem").props.onPress(); });
    act(() => { porId(t, "otica-parcelas-mais").props.onPress(); });
    act(() => { porId(t, "otica-parcelas-mais").props.onPress(); });
    expect(texto(t.toJSON())).toContain("3x de R$ 200,00");
    expect(texto(t.toJSON())).toContain("de 30 em 30 dias");
    await salvar(t);
    expect(mockChamadas[0].body.saldo_installments).toBe(3);
    expect(mockChamadas[0].body.saldo_due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const optical = (mockCriarOs.mock.calls[0] as any[])[1].optical;
    expect(optical.quantity).toBe("unidade");
    expect(optical.service_type).toBe("montagem");
    act(() => { t.unmount(); });
  });

  test("sem sinal não há parcelas", () => {
    const t = montar();
    preencher(t);
    act(() => { porId(t, "otica-sinal").props.onChangeText(""); });
    expect(t.root.findAll((n: any) => n.props?.testID === "otica-parcelas")).toHaveLength(0);
    act(() => { t.unmount(); });
  });
});
