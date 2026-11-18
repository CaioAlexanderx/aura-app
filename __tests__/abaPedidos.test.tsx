// ============================================================
// Vendas › Pedidos: a lista (A5a, 17/11/2026)
//
// O que o mockup aprovado em 17/11 pede da aba:
//   1. os quatro números com os textos do mockup;
//   2. os chips com as contagens; trocar de chip pede a situação certa;
//   3. a linha atrasada vem marcada (vermelha) e na ordem do backend;
//   4. sem pedido nenhum: "Nenhum pedido aberto" e "Abrir o Caixa";
//   5. atrasados sem resultado: "Nenhum pedido atrasado";
//   6. consolidado: selo da loja e números por loja;
//   7. celular: cartão com "Atrasado N dias".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockResposta: any = null;
const mockUsePedidos = jest.fn();
let mockLargura = 1280;
const mockPush = jest.fn();

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock("@/hooks/usePedidos", () => ({
  usePedidos: (...a: any[]) => { mockUsePedidos(...a); return mockResposta; },
  // A5b: ações e gaveta (testadas em pedidosGaveta.test.tsx).
  useMudarSituacaoDoPedido: () => ({ mudarSituacao: jest.fn(), mudando: false, emQual: null }),
  usePedidoDetalhe: () => ({ pedido: null, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null) }));
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return new Proxy(rn, {
    get(alvo: any, k: string) {
      if (k === "useWindowDimensions") return () => ({ width: mockLargura, height: 900, scale: 1, fontScale: 1 });
      return alvo[k];
    },
  });
});

import { AbaPedidos } from "@/components/screens/vendas/pedidos/AbaPedidos";

function pedido(over: any = {}) {
  return {
    id: "o1", company_id: "c1", company_name: "Loja Centro", order_number: "P-0012", status: "confirmed",
    customer_id: null, customer_name: "Marina Duarte", customer_phone: "(12) 99731-0952",
    subtotal: 389.7, discount_amount: 0, total: 389.7, sinal_pago: 100, falta: 289.7,
    promised_date: "2026-11-20", atrasado: false, dias_de_atraso: 0, item_count: 3, pecas: 3,
    first_item_name: "Vestido Midi Linho", first_item_image: null, notes: null, created_by: null,
    created_at: "2026-11-17T13:42:00Z", delivered_at: null, cancelled_at: null, sale_id: null,
    ...over,
  };
}

function resposta(over: any = {}) {
  return {
    pedidos: [],
    numeros: { abertos: 7, pecas_reservadas: 12, atrasados: 2, sinais_recebidos: 640, falta_receber: 1230.4 },
    contagem: { abertos: 7, aguardando: 3, separando: 2, prontos: 2, concluidos: 4, cancelados: 1, atrasados: 2, todos: 12 },
    porEmpresa: [], lojas: 1, total: 0, consolidado: false,
    isLoading: false, isFetching: false, error: null, refetch: jest.fn(),
    ...over,
  };
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

function porId(tree: any, id: string) {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}

function montar() {
  let tree: any;
  act(() => { tree = renderer.create(<AbaPedidos />); });
  return tree;
}

// 18/11/2026: relógio fixo no dia em que o teste foi escrito (17/11). Com o
// relógio de verdade o "atrasado 3 dias" (data prometida 14/11) virou
// "atrasado 4 dias" no dia seguinte e a suíte quebrou em todo PR.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date("2026-11-17T15:00:00-03:00"),
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask"],
  });
});
afterAll(() => { jest.useRealTimers(); });

beforeEach(() => {
  mockLargura = 1280;
  mockUsePedidos.mockClear();
  mockPush.mockClear();
  mockResposta = resposta();
});

describe("Vendas › Pedidos: a lista", () => {
  it("1. os quatro números com os textos do mockup", () => {
    mockResposta = resposta({ pedidos: [pedido()] });
    const t = texto(montar());
    expect(t).toContain("Abertos | 7 | 12 peças reservadas");
    expect(t).toContain("Atrasados | 2 | passaram da data prometida");
    expect(t).toContain("Sinais recebidos | R$ 640,00 | dos pedidos abertos");
    expect(t).toContain("Falta receber | R$ 1.230,40 | na retirada");
  });

  it("2. chips com contagem; trocar de chip pede a situação", () => {
    mockResposta = resposta({ pedidos: [pedido()] });
    const tree = montar();
    const t = texto(tree);
    expect(t).toContain("Abertos | 7");
    expect(t).toContain("Separando ou em produção | 2");
    expect(t).toContain("Concluídos");
    expect(mockUsePedidos).toHaveBeenLastCalledWith("abertos", "");
    act(() => { porId(tree, "chip-atrasados")[0].props.onPress(); });
    expect(mockUsePedidos).toHaveBeenLastCalledWith("atrasados", "");
    act(() => { porId(tree, "chip-prontos")[0].props.onPress(); });
    expect(mockUsePedidos).toHaveBeenLastCalledWith("prontos", "");
  });

  it("3. a linha atrasada vem marcada e na ordem do backend", () => {
    mockResposta = resposta({
      pedidos: [
        pedido({ id: "atr", order_number: "P-0009", status: "ready", atrasado: true, dias_de_atraso: 3, promised_date: "2026-11-14", customer_name: "Carla Menezes", first_item_name: "Jaqueta Sarja Preta · G", pecas: 1, sinal_pago: 80, falta: 179.9 }),
        pedido(),
      ],
    });
    const tree = montar();
    const linhas = tree.root.findAll((n: any) => n.props && typeof n.props.testID === "string" && n.props.testID.indexOf("pedido-") === 0, { deep: false });
    expect(linhas.map((l: any) => l.props.testID)).toEqual(["pedido-atr", "pedido-o1"]);
    const t = texto(tree);
    expect(t).toContain("Jaqueta Sarja Preta · G · 1 peça");
    expect(t).toContain("atrasado 3 dias");
    expect(t).toContain("Pronto");
    expect(t).toContain("R$ 80,00 | R$ 179,90");
    // A linha atrasada leva o fundo vermelho do mockup.
    const estilo = [].concat(linhas[0].props.style).filter(Boolean);
    expect(estilo.some((e: any) => e && e.borderLeftWidth === 3)).toBe(true);
  });

  it("3b. sem sinal e a data futura", () => {
    mockResposta = resposta({ pedidos: [pedido({ sinal_pago: 0, falta: 289.8 })] });
    const t = texto(montar());
    expect(t).toContain("sem sinal");
    expect(t).toMatch(/sex, 20\/11/);
  });

  it("4. sem pedido nenhum: o convite do mockup e Abrir o Caixa", () => {
    mockResposta = resposta({ contagem: { abertos: 0, aguardando: 0, separando: 0, prontos: 0, concluidos: 0, cancelados: 0, atrasados: 0, todos: 0 } });
    const tree = montar();
    const t = texto(tree);
    expect(t).toContain("Nenhum pedido aberto");
    expect(t).toContain("Quando uma cliente quiser deixar uma peça separada, monte a venda no Caixa e toque em Guardar, depois em Pedido. Ela aparece aqui.");
    act(() => { porId(tree, "pedidos-abrir-caixa")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/pdv");
  });

  it("5. atrasados sem resultado: Nenhum pedido atrasado", () => {
    const tree = montar();
    act(() => { porId(tree, "chip-atrasados")[0].props.onPress(); });
    const t = texto(tree);
    expect(t).toContain("Nenhum pedido atrasado");
    expect(t).toContain("Tudo em dia por aqui.");
  });

  it("6. consolidado: selo da loja e números por loja", () => {
    mockResposta = resposta({
      consolidado: true, lojas: 2,
      porEmpresa: [
        { company_id: "c1", company_name: "Centro", abertos: 7, atrasados: 2, pecas_reservadas: 9, sinais_recebidos: 600, falta_receber: 1000 },
        { company_id: "c2", company_name: "Shopping", abertos: 4, atrasados: 1, pecas_reservadas: 3, sinais_recebidos: 310, falta_receber: 884.2 },
      ],
      numeros: { abertos: 11, pecas_reservadas: 12, atrasados: 3, sinais_recebidos: 910, falta_receber: 1884.2 },
      pedidos: [pedido({ company_name: "Loja Shopping" })],
    });
    const t = texto(montar());
    expect(t).toContain("Abertos | 11 | Centro 7 · Shopping 4");
    expect(t).toContain("Atrasados | 3 | Centro 2 · Shopping 1");
    expect(t).toContain("R$ 910,00 | soma das lojas");
    expect(t).toContain("Loja Shopping");
  });

  it("7. celular: cartão com o selo de atraso", () => {
    mockLargura = 375;
    mockResposta = resposta({ pedidos: [pedido({ status: "ready", atrasado: true, dias_de_atraso: 3, promised_date: "2026-11-14" })] });
    const t = texto(montar());
    expect(t).toContain("Atrasado 3 dias");
    expect(t).toContain("Prometido");
  });

  it("8. erro: a frase do servidor e Tentar de novo", () => {
    const refetch = jest.fn();
    mockResposta = resposta({ error: new Error("Não conseguimos carregar os pedidos agora. Tente de novo em instantes."), refetch, contagem: null, numeros: null });
    const tree = montar();
    expect(texto(tree)).toContain("Não conseguimos carregar os pedidos agora.");
    const erro = porId(tree, "pedidos-erro")[0];
    const botao = erro.findAll((n: any) => n.props && n.props.accessibilityRole === "button", { deep: false })[0];
    act(() => { botao.props.onPress(); });
    expect(refetch).toHaveBeenCalled();
  });
});
