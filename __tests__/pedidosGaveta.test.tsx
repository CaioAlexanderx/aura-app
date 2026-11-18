// ============================================================
// Vendas › Pedidos: ações e gaveta (A5b, 17/11/2026)
//
// Com o hook de verdade (react-query) e só o `request` falso:
//   1. Separar manda PATCH status=preparing para a loja DONA do pedido
//      (consolidado) e atualiza a lista;
//   2. Pronto só aparece no Separando; no Pronto não há Separar nem Pronto;
//   3. Avisar abre o wa.me com o texto do mockup; atrasado vira
//      "Lembrar a cliente"; sem telefone, sem botão;
//   4. "Mais ações" abre a gaveta com peças, pagamento e "O que aconteceu";
//   5. nada de Concluir, Cancelar nem Nova data (A6a, A7 e sem rota no B3);
//   6. pedido concluído na gaveta: sem ações;
//   7. erro do servidor no Separar vira toast com a frase dele.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Linking } from "react-native";

const mockRequest = jest.fn();
const mockToastError = jest.fn();
let mockConsolidado = true;

jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { error: (...a: any[]) => mockToastError(...a), success: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = { token: "t", company: { id: "c1" }, consolidatedView: mockConsolidado, user: { id: "u" } };
    return typeof sel === "function" ? sel(st) : st;
  },
}));

import { AbaPedidos } from "@/components/screens/vendas/pedidos/AbaPedidos";
import { hojeEmSaoPaulo } from "@/components/screens/vendas/pedidos/regrasDosPedidos";

function somarDias(dia: string, n: number) {
  const d = new Date(dia + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const HOJE = hojeEmSaoPaulo();

function linha(over: any = {}) {
  return {
    id: "o1", company_id: "c2", company_name: "Loja Shopping", order_number: "P-0012", status: "confirmed",
    customer_id: null, customer_name: "Marina Duarte", customer_phone: "(12) 99731-0952",
    subtotal: 389.7, discount_amount: 0, total: 389.7, sinal_pago: 100, falta: 289.7,
    promised_date: somarDias(HOJE, 3), atrasado: false, dias_de_atraso: 0, item_count: 3, pecas: 3,
    first_item_name: "Vestido Midi Linho", first_item_image: null, notes: null, created_by: null,
    created_at: "2026-11-17T13:42:00Z", delivered_at: null, cancelled_at: null, sale_id: null,
    ...over,
  };
}

let mockLinhas: any[] = [];
let mockDetalhe: any = null;

function lista() {
  return {
    orders: mockLinhas, situacao: "abertos",
    kpis: { abertos: mockLinhas.length, pecas_reservadas: 3, atrasados: 0, sinais_recebidos: 100, falta_receber: 289.7 },
    counts: { abertos: 1, aguardando: 1, separando: 0, prontos: 0, concluidos: 0, cancelados: 0, atrasados: 0, todos: 1 },
    pagination: { page: 1, limit: 100, total: mockLinhas.length, pages: 1 },
    por_empresa: [], company_count: 2,
  };
}

function detalhe(over: any = {}) {
  return {
    id: "o1", order_number: "P-0012", origem: "balcao", status: "confirmed", customer_id: null,
    customer_name: "Marina Duarte", customer_phone: "(12) 99731-0952", subtotal: 389.7, discount_amount: 0,
    total: 389.7, promised_date: somarDias(HOJE, 3), notes: null, created_by: null,
    created_at: "2026-11-17T13:42:00Z", sinal_pago: 100, falta: 289.7,
    items: [
      { id: "1", product_id: "p1", variant_id: "v1", variant_label: "Areia P", product_name: "Vestido Midi Linho", quantity: 1, unit_price: 189.9, item_discount: 0, subtotal: 189.9 },
      { id: "2", product_id: "p2", variant_id: null, variant_label: "M", product_name: "Blusa Tricot Bege", quantity: 1, unit_price: 139.9, item_discount: 0, subtotal: 139.9 },
      { id: "3", product_id: "p3", variant_id: null, variant_label: null, product_name: "Cinto Couro Caramelo", quantity: 1, unit_price: 59.9, item_discount: 0, subtotal: 59.9 },
    ],
    ...over,
  };
}

async function esperar() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><AbaPedidos /></QueryClientProvider>);
  });
  await esperar();
  return tree;
}

function porId(tree: any, id: string) {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}

function texto(tree: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.children) n.children.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(" | ");
}

beforeEach(() => {
  mockConsolidado = true;
  mockLinhas = [linha()];
  mockDetalhe = detalhe();
  mockToastError.mockReset();
  mockRequest.mockReset();
  mockRequest.mockImplementation((path: string, opts?: any) => {
    if (opts && opts.method === "PATCH") return Promise.resolve({ order: { ...mockDetalhe, status: opts.body.status } });
    if (/\/pedidos\/[^?]+$/.test(path)) return Promise.resolve({ order: mockDetalhe });
    return Promise.resolve(lista());
  });
  jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true) as any);
});

afterEach(() => { jest.restoreAllMocks(); });

describe("Vendas › Pedidos: ações e gaveta", () => {
  it("1. Separar vai para a loja dona do pedido e recarrega a lista", async () => {
    const tree = await montar();
    expect(mockRequest.mock.calls[0][0]).toBe("/me/pedidos?situacao=abertos&limit=100");
    const antes = mockRequest.mock.calls.length;
    await act(async () => { porId(tree, "pedido-preparing-o1")[0].props.onPress(); });
    await esperar();
    const patch = mockRequest.mock.calls.find((c) => c[1] && c[1].method === "PATCH");
    expect(patch[0]).toBe("/companies/c2/pedidos/o1/status");
    expect(patch[1].body).toEqual({ status: "preparing" });
    const depois = mockRequest.mock.calls.slice(antes).map((c) => c[0]);
    expect(depois).toContain("/me/pedidos?situacao=abertos&limit=100");
  });

  it("2. Pronto só no Separando; no Pronto, nem Separar nem Pronto", async () => {
    mockLinhas = [linha({ id: "a", status: "preparing" }), linha({ id: "b", status: "ready" })];
    const tree = await montar();
    expect(porId(tree, "pedido-ready-a").length).toBe(1);
    expect(porId(tree, "pedido-preparing-a").length).toBe(0);
    expect(porId(tree, "pedido-ready-b").length).toBe(0);
    expect(porId(tree, "pedido-preparing-b").length).toBe(0);
  });

  it("3. Avisar abre o wa.me com o texto do mockup; atrasado vira Lembrar a cliente; sem telefone some", async () => {
    mockLinhas = [
      linha({ id: "a" }),
      linha({ id: "b", status: "ready", atrasado: true, dias_de_atraso: 3, promised_date: somarDias(HOJE, -3), customer_name: "Carla Menezes", first_item_name: "Jaqueta Sarja Preta" }),
      linha({ id: "c", customer_phone: null }),
    ];
    const tree = await montar();
    const avisar = porId(tree, "pedido-avisar-a")[0];
    expect(avisar.props.title).toBe("Avisar");
    act(() => { avisar.props.onPress(); });
    const url = String((Linking.openURL as jest.Mock).mock.calls[0][0]);
    expect(url.indexOf("https://wa.me/5512997310952?text=")).toBe(0);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(
      "Oi, Marina! Suas peças estão separadas aqui na loja esperando por você. Quando fica bom passar?"
    );
    expect(porId(tree, "pedido-avisar-b")[0].props.title).toBe("Lembrar a cliente");
    expect(porId(tree, "pedido-avisar-c").length).toBe(0);
  });

  it("4. Mais ações abre a gaveta com peças, pagamento e o que aconteceu", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-mais-o1")[0].props.onPress(); });
    await esperar();
    expect(mockRequest.mock.calls.map((c) => c[0])).toContain("/companies/c2/pedidos/o1");
    const t = texto(tree);
    expect(t).toContain("Pedido P-0012");
    expect(t).toContain("Loja Shopping");
    expect(t).toContain("Peças reservadas");
    expect(t).toContain("Vestido Midi Linho · Areia P");
    expect(t).toContain("Cinto Couro Caramelo");
    expect(t).toContain("Total do pedido | R$ 389,70");
    expect(t).toContain("− R$ 100,00");
    expect(t).toContain("Falta na retirada | R$ 289,70");
    expect(t).toContain("O que aconteceu");
    expect(t).toContain("Pedido guardado");
    expect(t).toContain("Sinal de R$ 100,00");
    expect(t).toContain("Separar as peças");
    expect(t).toContain("Concluir: vira venda e baixa o estoque");
    expect(t).toContain("Vem buscar");
  });

  it("5. nada de Concluir, Cancelar nem Nova data, na lista e na gaveta", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-mais-o1")[0].props.onPress(); });
    await esperar();
    const titulos = tree.root.findAll((n: any) => n.props && typeof n.props.title === "string").map((n: any) => n.props.title);
    expect(titulos.some((x: string) => /Concluir|Cancelar|Nova data/.test(x))).toBe(false);
    const t = texto(tree);
    expect(t).not.toContain("Concluir e cobrar");
    expect(t).not.toContain("Cancelar pedido");
    expect(t).not.toContain("Nova data");
  });

  it("6. pedido concluído: a gaveta não tem ações", async () => {
    mockLinhas = [linha({ status: "delivered" })];
    mockDetalhe = detalhe({ status: "delivered" });
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-o1")[0].props.onPress(); });
    await esperar();
    expect(texto(tree)).toContain("Concluído");
    expect(porId(tree, "pedido-preparing-o1").length).toBe(0);
    expect(porId(tree, "pedido-avisar-o1").length).toBe(0);
  });

  it("7. erro do servidor no Separar vira toast com a frase dele", async () => {
    mockRequest.mockImplementation((path: string, opts?: any) => {
      if (opts && opts.method === "PATCH") return Promise.reject(new Error("Este pedido está pronto e não pode ir para separando."));
      return Promise.resolve(lista());
    });
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-preparing-o1")[0].props.onPress(); });
    await esperar();
    expect(mockToastError).toHaveBeenCalledWith("Este pedido está pronto e não pode ir para separando.");
  });
});
