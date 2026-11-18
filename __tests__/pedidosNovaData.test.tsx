// ============================================================
// Vendas › Pedidos: "Nova data" (17/11/2026)
//
// Com o hook de verdade (react-query) e só o `request` falso:
//   1. "Nova data" na linha abre o diálogo com as escolhas do mockup e grava
//      na loja DONA do pedido (consolidado); fecha e recarrega a lista, e o
//      atrasado sai do topo quando a lista nova chega;
//   2. na gaveta também, com "Outra data" digitada (dd/mm/aaaa);
//   3. erro de rede: o diálogo fica aberto, com a data escolhida, e mostra a
//      frase; a lista não é recarregada;
//   4. data que já passou: aviso e Salvar desligado; nada sai para o servidor;
//   5. 409 (concluído enquanto isso): frase no toast e a lista se atualiza;
//   6. pedido concluído: sem "Nova data" na gaveta.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRequest = jest.fn();
const mockToastError = jest.fn();

jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { error: (...a: any[]) => mockToastError(...a), success: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null) }));
// O Modal do react-native-web sai em portal, que o react-test-renderer não
// monta. O foco dentro da janela de verdade é provado em
// __tests__/components/NovaDataFocoDentroDeJanela.test.tsx.
jest.mock("@/components/JanelaEmpilhada", () => ({ JanelaEmpilhada: ({ children }: any) => children }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = { token: "t", company: { id: "c1" }, consolidatedView: true, user: { id: "u" } };
    return typeof sel === "function" ? sel(st) : st;
  },
}));

import { AbaPedidos } from "@/components/screens/vendas/pedidos/AbaPedidos";
import { hojeEmSaoPaulo, opcoesDeData, somarDias, dataCurta } from "@/components/screens/vendas/pedidos/regrasDosPedidos";

const HOJE = hojeEmSaoPaulo();

function linha(over: any = {}) {
  return {
    id: "o1", company_id: "c2", company_name: "Loja Shopping", order_number: "P-0009", status: "ready",
    customer_id: null, customer_name: "Carla Menezes", customer_phone: "(12) 98114-2210",
    subtotal: 259.9, discount_amount: 0, total: 259.9, sinal_pago: 80, falta: 179.9,
    promised_date: somarDias(HOJE, -3), atrasado: true, dias_de_atraso: 3, item_count: 1, pecas: 1,
    first_item_name: "Jaqueta Sarja Preta", first_item_image: null, notes: null, created_by: null,
    created_at: "2026-11-14T13:42:00Z", delivered_at: null, cancelled_at: null, sale_id: null,
    ...over,
  };
}

let mockLinhas: any[] = [];

function lista() {
  return {
    orders: mockLinhas, situacao: "abertos",
    kpis: { abertos: mockLinhas.length, pecas_reservadas: 2, atrasados: mockLinhas.filter((l) => l.atrasado).length, sinais_recebidos: 80, falta_receber: 179.9 },
    counts: { abertos: mockLinhas.length, aguardando: 0, separando: 0, prontos: 1, concluidos: 0, cancelados: 0, atrasados: 1, todos: 2 },
    pagination: { page: 1, limit: 100, total: mockLinhas.length, pages: 1 },
    por_empresa: [], company_count: 2,
  };
}

function detalheDe(l: any) {
  return {
    id: l.id, order_number: l.order_number, origem: "balcao", status: l.status, customer_id: null,
    customer_name: l.customer_name, customer_phone: l.customer_phone, subtotal: l.total, discount_amount: 0,
    total: l.total, promised_date: l.promised_date, notes: null, created_by: null, created_at: l.created_at,
    sinal_pago: l.sinal_pago, falta: l.falta,
    items: [{ id: "1", product_id: "p1", variant_id: null, variant_label: "G", product_name: "Jaqueta Sarja Preta", quantity: 1, unit_price: 259.9, item_discount: 0, subtotal: 259.9 }],
  };
}

let mockPatch: (path: string, body: any) => Promise<any>;

async function esperar() {
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
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

const listas = () => mockRequest.mock.calls.filter((c) => /^\/me\/pedidos/.test(c[0])).length;
const patches = () => mockRequest.mock.calls.filter((c) => c[1] && c[1].method === "PATCH");

beforeEach(() => {
  mockLinhas = [linha(), linha({ id: "o2", order_number: "P-0012", status: "confirmed", customer_name: "Marina Duarte", promised_date: somarDias(HOJE, 3), atrasado: false, dias_de_atraso: 0 })];
  mockToastError.mockReset();
  mockRequest.mockReset();
  mockPatch = (_path, body) => {
    // O backend grava e a lista nova vem na ordem dele: o atrasado com data
    // futura deixa de ser atrasado e desce.
    const l = mockLinhas.find((x) => x.id === "o1");
    const nova = { ...l, promised_date: body.promised_date, atrasado: false, dias_de_atraso: 0 };
    mockLinhas = [mockLinhas.find((x) => x.id === "o2"), nova];
    return Promise.resolve({ order: detalheDe(nova), ja_estava: false });
  };
  mockRequest.mockImplementation((path: string, opts?: any) => {
    if (opts && opts.method === "PATCH") return mockPatch(path, opts.body);
    const m = /\/pedidos\/([^/?]+)$/.exec(path);
    if (m) return Promise.resolve({ order: detalheDe(mockLinhas.find((x) => x.id === m[1]) || mockLinhas[0]) });
    return Promise.resolve(lista());
  });
});

describe("Vendas › Pedidos: Nova data", () => {
  it("1. na linha: escolhas do mockup, grava na loja dona, fecha e o atrasado sai do topo", async () => {
    const tree = await montar();
    const ordem = () => tree.root.findAll((n: any) => n.props && /^pedido-o\d$/.test(String(n.props.testID || "")), { deep: false }).map((n: any) => n.props.testID);
    expect(ordem()[0]).toBe("pedido-o1");

    await act(async () => { porId(tree, "pedido-nova-data-o1")[0].props.onPress(); });
    const t = texto(tree);
    expect(t).toContain("Nova data");
    expect(t).toContain("Pedido P-0009 · Carla Menezes");
    expect(t).toContain("Prometido para");
    expect(t).toContain("Quando ela vem buscar");
    expect(t).toContain("Amanhã");
    expect(t).toContain(dataCurta(somarDias(HOJE, 1)));
    expect(t).toContain("Em 7 dias");
    expect(t).toContain("Outra data");
    // Atrasado: nenhuma escolha vem marcada, então Salvar fica desligado.
    expect(porId(tree, "nova-data-salvar")[0].props.disabled).toBe(true);

    const antes = listas();
    await act(async () => { porId(tree, "nova-data-em7")[0].props.onPress(); });
    expect(porId(tree, "nova-data-salvar")[0].props.disabled).toBe(false);
    await act(async () => { porId(tree, "nova-data-salvar")[0].props.onPress(); });
    await esperar();

    const p = patches();
    expect(p.length).toBe(1);
    expect(p[0][0]).toBe("/companies/c2/pedidos/o1/data");
    expect(p[0][1].body).toEqual({ promised_date: somarDias(HOJE, 7) });
    expect(porId(tree, "nova-data").length).toBe(0);
    expect(listas()).toBeGreaterThan(antes);
    expect(ordem()[0]).toBe("pedido-o2");
  });

  it("2. na gaveta: Outra data digitada", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-mais-o1")[0].props.onPress(); });
    await esperar();
    // A linha e a gaveta têm o botão; o da gaveta é o último.
    const botoes = porId(tree, "pedido-nova-data-o1");
    expect(botoes.length).toBe(2);
    await act(async () => { botoes[1].props.onPress(); });
    await act(async () => { porId(tree, "nova-data-outra")[0].props.onPress(); });
    const futuro = somarDias(HOJE, 12);
    const br = futuro.slice(8, 10) + "/" + futuro.slice(5, 7) + "/" + futuro.slice(0, 4);
    await act(async () => { porId(tree, "nova-data-campo")[0].props.onChangeText(br); });
    await act(async () => { porId(tree, "nova-data-salvar")[0].props.onPress(); });
    await esperar();
    expect(patches()[0][1].body).toEqual({ promised_date: futuro });
    expect(mockRequest.mock.calls.filter((c) => c[0] === "/companies/c2/pedidos/o1").length).toBeGreaterThan(1);
  });

  it("3. erro de rede: o diálogo fica aberto e preenchido, sem recarregar a lista", async () => {
    mockPatch = () => Promise.reject(Object.assign(new Error("Sem conexão com a internet. Confira o Wi-Fi e tente de novo."), { status: 0 }));
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-nova-data-o1")[0].props.onPress(); });
    await act(async () => { porId(tree, "nova-data-em7")[0].props.onPress(); });
    const antes = listas();
    await act(async () => { porId(tree, "nova-data-salvar")[0].props.onPress(); });
    await esperar();
    expect(porId(tree, "nova-data").length).toBe(1);
    expect(porId(tree, "nova-data-em7")[0].props.on).toBe(true);
    expect(texto(tree)).toContain("Sem conexão com a internet. Confira o Wi-Fi e tente de novo.");
    expect(listas()).toBe(antes);
    expect(mockToastError).not.toHaveBeenCalled();
    // De novo, agora com a rede de volta: grava a mesma escolha.
    mockPatch = (_p, body) => Promise.resolve({ order: detalheDe({ ...linha(), promised_date: body.promised_date }) });
    await act(async () => { porId(tree, "nova-data-salvar")[0].props.onPress(); });
    await esperar();
    expect(patches().length).toBe(2);
    expect(patches()[1][1].body).toEqual({ promised_date: somarDias(HOJE, 7) });
    expect(porId(tree, "nova-data").length).toBe(0);
  });

  it("4. data que já passou: aviso e Salvar desligado", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-nova-data-o2")[0].props.onPress(); });
    // A data do pedido (em 3 dias) vem marcada.
    const marcado = opcoesDeData(HOJE).find((o) => o.dia === somarDias(HOJE, 3));
    if (marcado) expect(porId(tree, "nova-data-" + marcado.key)[0].props.on).toBe(true);
    else expect(porId(tree, "nova-data-campo").length).toBe(1);
    await act(async () => { porId(tree, "nova-data-outra")[0].props.onPress(); });
    const ontem = somarDias(HOJE, -1);
    await act(async () => { porId(tree, "nova-data-campo")[0].props.onChangeText(ontem.slice(8, 10) + "/" + ontem.slice(5, 7) + "/" + ontem.slice(0, 4)); });
    expect(texto(tree)).toContain("A data em que ela vem buscar já passou. Escolha hoje ou um dia depois.");
    expect(porId(tree, "nova-data-salvar")[0].props.disabled).toBe(true);
    await act(async () => { porId(tree, "nova-data-salvar")[0].props.onPress(); });
    expect(patches().length).toBe(0);
    await act(async () => { porId(tree, "nova-data-cancelar")[0].props.onPress(); });
    expect(porId(tree, "nova-data").length).toBe(0);
  });

  it("5. 409: a frase vai para o toast e a lista se atualiza", async () => {
    mockPatch = () => Promise.reject(Object.assign(new Error("Este pedido está concluído e a data não muda mais."), { status: 409 }));
    const tree = await montar();
    await act(async () => { porId(tree, "pedido-nova-data-o1")[0].props.onPress(); });
    await act(async () => { porId(tree, "nova-data-amanha")[0].props.onPress(); });
    const antes = listas();
    await act(async () => { porId(tree, "nova-data-salvar")[0].props.onPress(); });
    await esperar();
    expect(mockToastError).toHaveBeenCalledWith("Este pedido está concluído e a data não muda mais.");
    expect(listas()).toBeGreaterThan(antes);
  });

  it("6. pedido concluído: sem Nova data", async () => {
    mockLinhas = [linha({ status: "delivered", atrasado: false })];
    const tree = await montar();
    expect(porId(tree, "pedido-nova-data-o1").length).toBe(0);
    await act(async () => { porId(tree, "pedido-o1")[0].props.onPress(); });
    await esperar();
    expect(porId(tree, "pedido-nova-data-o1").length).toBe(0);
  });
});

describe("opcoesDeData", () => {
  it("terça 17/11: Amanhã qua, 18/11 · Sexta 20/11 · Em 7 dias 24/11 (o mockup)", () => {
    expect(opcoesDeData("2026-11-17").map((o) => [o.label, o.detalhe, o.dia])).toEqual([
      ["Amanhã", "qua, 18/11", "2026-11-18"],
      ["Sexta", "20/11", "2026-11-20"],
      ["Em 7 dias", "24/11", "2026-11-24"],
    ]);
  });
  it("quinta (sexta é amanhã) e sexta (a outra sexta é em 7 dias): sem o chip Sexta", () => {
    expect(opcoesDeData("2026-11-19").map((o) => o.key)).toEqual(["amanha", "em7"]);
    expect(opcoesDeData("2026-11-20").map((o) => o.key)).toEqual(["amanha", "em7"]);
    expect(opcoesDeData("2026-11-21").map((o) => o.key)).toEqual(["amanha", "sexta", "em7"]);
  });
  it("vira o mês e o ano", () => {
    expect(opcoesDeData("2026-12-31")[0].dia).toBe("2027-01-01");
  });
});
