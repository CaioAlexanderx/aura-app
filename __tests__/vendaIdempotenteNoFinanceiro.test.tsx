// ============================================================
// 18/10/2026 (tq-18): venda idempotente fora do Caixa — a venda retroativa
// lançada pelo Financeiro (TransactionModal → POST /pdv/sale).
//
// O que este arquivo trava:
//   1. timeout e "Registrar venda retroativa" de novo: a MESMA chave
//   2. timeout, fecha o modal (o WebPortal desmonta) e lança de novo: a MESMA
//   3. venda registrada: a próxima manda outra chave
//   4. 409 IDEMPOTENCY_KEY_REUSED troca a chave; erro comum não
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, TextInput } from "react-native";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: (...a: any[]) => mockToastError(...a) },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1" }, user: { id: "user-1" }, isDemo: false }),
}));
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [{ id: "camisa", name: "Camisa Polo", price: 89.9, stock: 5, is_active: true }] }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {} }) }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: () => ({ data: undefined }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
}));

type Resposta = { ok: any } | { erro: any };
let mockRespostas: Resposta[] = [];
const mockChamadas: { body: any; opts: any }[] = [];
jest.mock("@/services/api", () => {
  return {
    request: jest.fn(),
    pdvApi: {
      createSale: (_cid: string, body: any, opts: any) => {
        mockChamadas.push({ body, opts });
        const r = mockRespostas.shift() || { ok: { sale: { id: "venda-x" } } };
        return "ok" in r ? Promise.resolve(r.ok) : Promise.reject(r.erro);
      },
    },
    companiesApi: { customers: jest.fn(() => Promise.resolve({ customers: [] })), variants: jest.fn() },
    employeesApi: { list: jest.fn(() => Promise.resolve({ employees: [] })) },
  };
});

import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { __zerarChavesDaVendaParaTestes } from "@/hooks/useChaveDaVenda";

const TIMEOUT = { status: 0, isNetworkError: true, code: "timeout", message: "Não recebemos resposta a tempo." };
const chaveDa = (i: number) => mockChamadas[i].opts?.idempotencyKey;

const onClose = jest.fn();
function montar() {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<TransactionModal visible onClose={onClose} onSave={jest.fn()} onSaleCreated={jest.fn()} />); });
  return t;
}
/** O Pressable que contém o texto (sobe da Text até quem tem onPress). */
function botao(t: renderer.ReactTestRenderer, texto: string) {
  const txt = t.root.findAll((n: any) => n.type === Text && n.props.children === texto)[0];
  if (!txt) throw new Error("sem o texto " + texto);
  let n: any = txt;
  while (n && !n.props?.onPress) n = n.parent;
  return n;
}
function montarVenda(t: renderer.ReactTestRenderer) {
  act(() => { botao(t, "Venda").props.onPress(); });
  const busca = t.root.findAll((n: any) => n.type === TextInput && n.props.placeholder === "Buscar por nome, código de barras ou SKU...")[0];
  act(() => { busca.props.onChangeText("polo"); });
  act(() => { botao(t, "Camisa Polo").props.onPress(); });
}
async function registrar(t: renderer.ReactTestRenderer) {
  await act(async () => { await botao(t, "Registrar venda retroativa").props.onPress(); });
}

beforeEach(() => {
  __zerarChavesDaVendaParaTestes();
  mockRespostas = [];
  mockChamadas.length = 0;
  onClose.mockClear();
  mockToastError.mockClear();
});

describe("Financeiro: venda retroativa com chave de idempotência", () => {
  test("timeout e nova tentativa: mesma chave; nova depois da venda registrada", async () => {
    let t = montar();
    montarVenda(t);
    mockRespostas.push({ erro: TIMEOUT });
    await registrar(t);
    expect(onClose).not.toHaveBeenCalled();

    mockRespostas.push({ ok: { sale: { id: "venda-1" }, idempotent_replay: true } });
    await registrar(t);
    expect(mockChamadas).toHaveLength(2);
    expect(chaveDa(0)).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(mockChamadas[0].body.items[0]).toMatchObject({ product_id: "camisa", quantity: 1 });
    expect(mockChamadas[0].body.idempotency_key).toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => { t.unmount(); });

    // próxima venda retroativa: outra chave
    t = montar();
    montarVenda(t);
    mockRespostas.push({ ok: { sale: { id: "venda-2" } } });
    await registrar(t);
    expect(chaveDa(2)).not.toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("timeout, fecha o modal e lança de novo: mesma chave", async () => {
    let t = montar();
    montarVenda(t);
    mockRespostas.push({ erro: TIMEOUT });
    await registrar(t);
    act(() => { botao(t, "x").props.onPress(); });
    act(() => { t.unmount(); });

    t = montar();
    montarVenda(t);
    mockRespostas.push({ ok: { sale: { id: "venda-1" } } });
    await registrar(t);
    expect(chaveDa(1)).toBe(chaveDa(0));
    act(() => { t.unmount(); });
  });

  test("409 IDEMPOTENCY_KEY_REUSED troca a chave e mostra a mensagem; erro comum não troca", async () => {
    const t = montar();
    montarVenda(t);
    mockRespostas.push({ erro: { status: 409, data: { error: "Estoque insuficiente" }, message: "Estoque insuficiente" } });
    await registrar(t);
    const msg = "Esta venda já foi registrada (venda 7) com outros itens.";
    mockRespostas.push({ erro: { status: 409, data: { code: "IDEMPOTENCY_KEY_REUSED", error: msg }, message: msg } });
    await registrar(t);
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(mockToastError).toHaveBeenLastCalledWith(msg);
    mockRespostas.push({ ok: { sale: { id: "venda-2" } } });
    await registrar(t);
    expect(chaveDa(2)).not.toBe(chaveDa(1));
    act(() => { t.unmount(); });
  });
});
