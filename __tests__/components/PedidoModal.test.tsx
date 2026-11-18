// ============================================================
// Novo pedido (A2, p-63b): os três passos, a chave de idempotência e os
// erros. Mockup "Pedido separado de venda", partes 2 e 7.
//   - o carrinho só esvazia quando o servidor guardou (onGuardado);
//   - erro de rede mantém tudo preenchido e o "Tentar de novo" manda a MESMA
//     Idempotency-Key; itens diferentes, chave nova;
//   - 409 PEDIDO_SEM_SALDO mostra as peças que faltam;
//   - sem sinal (o sinal é o A3).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => (active ? children : null),
}));
jest.mock("@/components/CalendarioDoDia", () => ({ CalendarioDoDia: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", trade_name: "Loja Centro" }, availableCompanies: [], token: "t" }),
}));
const mockClientes = [
  { id: "c-1", name: "Marina Duarte", phone: "(12) 99731-0952" },
  { id: "c-2", name: "Carla Menezes", phone: null },
];
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: mockClientes, isLoading: false }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(), getQueriesData: () => [] }),
}));
jest.mock("@/services/api", () => ({ companiesApi: { createCustomer: jest.fn() }, request: jest.fn() }));
const mockGuardar = jest.fn();
jest.mock("@/services/pedidosApi", () => {
  const real = jest.requireActual("@/services/pedidosApi");
  return { ...real, pedidosApi: { guardar: (...a: any[]) => mockGuardar(...a) } };
});

import React from "react";
import renderer, { act } from "react-test-renderer";
import { PedidoModal } from "@/components/screens/pdv/pedido/PedidoModal";
import { TEXTOS_DO_PEDIDO as T } from "@/components/screens/pdv/pedido/textosDoPedido";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function texto(tree: renderer.ReactTestRenderer) {
  return flattenText(tree.toJSON() as any);
}

const VESTIDO = "11111111-1111-4111-8111-111111111111";
const BLUSA = "33333333-3333-4333-8333-333333333333";
const ITENS = [
  { productId: VESTIDO, name: "Vestido Midi Linho", price: 189.9, qty: 1 },
  { productId: BLUSA, name: "Blusa Tricot Bege", price: 139.9, qty: 1 },
];
const RESPOSTA = {
  order: {
    id: "o-1", order_number: 12, origem: "balcao", status: "confirmed", customer_id: "c-1",
    customer_name: "Marina Duarte", customer_phone: "12997310952", subtotal: 329.8, discount_amount: 0,
    total: 329.8, promised_date: "2026-11-20", items: [],
  },
  avisos: [],
};

type Montagem = { tree: renderer.ReactTestRenderer; onGuardado: jest.Mock; onClose: jest.Mock; render: (p?: any) => void };

function montar(extra: Record<string, any> = {}): Montagem {
  const onGuardado = jest.fn();
  const onClose = jest.fn();
  const base = {
    visible: true, companyId: "empresa-1", itens: ITENS, desconto: 0,
    clienteDoCarrinho: { id: "c-1", name: "Marina Duarte", phone: "(12) 99731-0952" },
    onGuardado, onClose, hoje: "2026-11-17", ...extra,
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<PedidoModal {...base} />); });
  return {
    tree, onGuardado, onClose,
    render: (p: any = {}) => act(() => { tree.update(<PedidoModal {...base} {...p} />); }),
  };
}

function aperta(tree: renderer.ReactTestRenderer, id: string) {
  const n = porTestID(tree, id)[0];
  if (!n) throw new Error("sem " + id);
  act(() => { n.props.onPress(); });
}

async function guardar(tree: renderer.ReactTestRenderer) {
  await act(async () => { await porTestID(tree, "pedido-guardar")[0].props.onPress(); });
}

beforeEach(() => { mockGuardar.mockReset(); });

describe("passo 1: itens e cliente", () => {
  test("as peças vêm do carrinho e a cliente do Caixa já vem escolhida", () => {
    const { tree } = montar();
    const t = texto(tree);
    expect(t).toContain(T.titulo);
    expect(t).toContain(T.oQueFicaSeparado);
    expect(t).toContain("Vestido Midi Linho");
    expect(t).toContain("Marina Duarte");
    expect(t).toContain(T.cliente.rotulo);
    expect(t).toContain(T.avisoTelefone);
    expect(t).toContain(T.reservadas(2));
    expect(flattenText(porTestID(tree, "pedido-rodape-info")[0].children)).toBe("2 peças · para Marina Duarte");
    expect(porTestID(tree, "pedido-continuar")[0].props.disabled).toBe(false);
    // Sem sinal neste card.
    expect(t).not.toContain("Sinal agora");
  });

  test("sem cliente no Caixa: a busca abre e o Continuar espera a escolha", () => {
    const { tree } = montar({ clienteDoCarrinho: null });
    expect(porTestID(tree, "pedido-continuar")[0].props.disabled).toBe(true);
    expect(flattenText(porTestID(tree, "pedido-rodape-info")[0].children)).toBe(T.rodapeEscolherCliente);
    expect(porTestID(tree, "pedido-cliente-busca")).toHaveLength(1);
    // "Seguir sem cliente" com o nome digitado na busca.
    const busca = porTestID(tree, "pedido-cliente-q")[0];
    act(() => { busca.props.onChangeText("Patrícia Gomes"); });
    expect(texto(tree)).toContain(T.seguirSemCliente);
    aperta(tree, "pedido-cliente-sem-cliente");
    expect(flattenText(porTestID(tree, "pedido-sem-cliente")[0].children)).toContain("Patrícia Gomes");
    expect(porTestID(tree, "pedido-continuar")[0].props.disabled).toBe(false);
  });

  test("+ Novo cliente troca o miolo pelo cadastro com os textos do pedido", () => {
    const { tree } = montar({ clienteDoCarrinho: null });
    act(() => { porTestID(tree, "pedido-cliente-q")[0].props.onChangeText("Patrícia"); });
    aperta(tree, "pedido-cliente-novo");
    const t = texto(tree);
    expect(t).toContain(T.cliente.voltarParaTroca);
    expect(t).toContain(T.cliente.novoClienteIntro());
    expect(t).toContain(T.cliente.campoTelefoneDica);
    expect(t).toContain(T.cliente.rodapeNovoCliente);
    expect(porTestID(tree, "pedido-continuar")).toHaveLength(0);
  });

  test("Voltar ao carrinho fecha sem guardar nada", () => {
    const { tree, onClose } = montar();
    aperta(tree, "pedido-voltar-carrinho");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockGuardar).not.toHaveBeenCalled();
  });
});

describe("passo 2 e guardar", () => {
  function irAoPasso2(m: Montagem) {
    aperta(m.tree, "pedido-continuar");
    expect(porTestID(m.tree, "pedido-passo-2")).toHaveLength(1);
  }

  test("atalhos de data do mockup; sem data, o Guardar espera", () => {
    const m = montar();
    irAoPasso2(m);
    const t = texto(m.tree);
    expect(t).toContain(T.quandoVemBuscar);
    expect(t).toContain("Amanhã" + "qua, 18/11");
    expect(t).toContain("Sexta" + "20/11");
    expect(t).toContain("Em 7 dias" + "24/11");
    expect(t).toContain(T.outraData);
    expect(porTestID(m.tree, "pedido-guardar")[0].props.disabled).toBe(true);
    aperta(m.tree, "pedido-data-sexta");
    expect(flattenText(porTestID(m.tree, "pedido-rodape-info")[0].children)).toBe("Sem sinal · falta R$ 329,80 na retirada");
    expect(texto(m.tree)).toContain("Vem buscar sexta, 20/11");
  });

  test("guardou: manda o corpo com a chave, avisa o Caixa e mostra o Pronto", async () => {
    mockGuardar.mockResolvedValueOnce(RESPOSTA);
    const m = montar();
    irAoPasso2(m);
    aperta(m.tree, "pedido-data-sexta");
    await guardar(m.tree);
    expect(mockGuardar).toHaveBeenCalledTimes(1);
    const [cid, corpo, chave] = mockGuardar.mock.calls[0];
    expect(cid).toBe("empresa-1");
    expect(corpo).toEqual({
      items: [
        { product_id: VESTIDO, variant_id: null, product_name: "Vestido Midi Linho", quantity: 1, unit_price: 189.9 },
        { product_id: BLUSA, variant_id: null, product_name: "Blusa Tricot Bege", quantity: 1, unit_price: 139.9 },
      ],
      promised_date: "2026-11-20",
      customer_id: "c-1",
    });
    expect(typeof chave).toBe("string");
    expect(chave.length).toBeGreaterThanOrEqual(8);
    expect(m.onGuardado).toHaveBeenCalledWith(RESPOSTA.order);
    // O Caixa esvazia o carrinho: o Pronto continua com o retrato do pedido.
    m.render({ itens: [] });
    const t = texto(m.tree);
    expect(t).toContain(T.tituloPronto);
    expect(t).toContain("Pedido P-0012 guardado");
    expect(t).toContain("As 2 peças estão reservadas para a Marina até sexta, 20/11.");
    expect(t).toContain(T.faltaNaRetirada + "R$ 329,80");
    expect(porTestID(m.tree, "pedido-enviar")).toHaveLength(1);
    aperta(m.tree, "pedido-nova-venda");
    expect(m.onClose).toHaveBeenCalledTimes(1);
  });

  test("erro de rede: nada esvazia, tudo continua, e o Tentar de novo usa a MESMA chave", async () => {
    mockGuardar.mockRejectedValueOnce(Object.assign(new Error("Sem conexão"), { isNetworkError: true, status: 0 }));
    const m = montar();
    irAoPasso2(m);
    aperta(m.tree, "pedido-data-amanha");
    await guardar(m.tree);
    expect(m.onGuardado).not.toHaveBeenCalled();
    expect(flattenText(porTestID(m.tree, "pedido-erro")[0].children)).toBe(T.erroDeRede);
    expect(flattenText(porTestID(m.tree, "pedido-guardar")[0].children)).toBe(T.tentarDeNovo);
    expect(porTestID(m.tree, "pedido-passo-2")).toHaveLength(1);

    mockGuardar.mockResolvedValueOnce(RESPOSTA);
    await guardar(m.tree);
    expect(mockGuardar).toHaveBeenCalledTimes(2);
    expect(mockGuardar.mock.calls[1][2]).toBe(mockGuardar.mock.calls[0][2]);
    expect(mockGuardar.mock.calls[1][1]).toEqual(mockGuardar.mock.calls[0][1]);
    expect(m.onGuardado).toHaveBeenCalledTimes(1);
  });

  test("erro 500 do servidor: mesma frase do mockup, nada cobrado", async () => {
    mockGuardar.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    const m = montar();
    irAoPasso2(m);
    aperta(m.tree, "pedido-data-amanha");
    await guardar(m.tree);
    expect(flattenText(porTestID(m.tree, "pedido-erro")[0].children)).toBe(T.erroDeRede);
  });

  test("itens mudaram depois do erro: chave nova", async () => {
    mockGuardar.mockRejectedValueOnce(Object.assign(new Error("x"), { isNetworkError: true, status: 0 }));
    const m = montar();
    irAoPasso2(m);
    aperta(m.tree, "pedido-data-amanha");
    await guardar(m.tree);
    m.render({ itens: [ITENS[0]] });
    mockGuardar.mockResolvedValueOnce(RESPOSTA);
    await guardar(m.tree);
    expect(mockGuardar.mock.calls[1][2]).not.toBe(mockGuardar.mock.calls[0][2]);
  });

  test("409 PEDIDO_SEM_SALDO: mostra as peças que faltam e não guarda", async () => {
    const faltas = [
      { product_id: VESTIDO, variant_id: null, nome: "Vestido Midi Linho (P)", quantidade: 1, estoque: 1, reservado: 1, livre: 0 },
      { product_id: BLUSA, variant_id: null, nome: "Blusa Tricot Bege", quantidade: 2, estoque: 1, reservado: 0, livre: 1 },
    ];
    mockGuardar.mockRejectedValueOnce(Object.assign(new Error("Não dá para separar"), { status: 409, data: { code: "PEDIDO_SEM_SALDO", faltas } }));
    const m = montar();
    irAoPasso2(m);
    aperta(m.tree, "pedido-data-amanha");
    await guardar(m.tree);
    expect(m.onGuardado).not.toHaveBeenCalled();
    const linhas = porTestID(m.tree, "pedido-falta").map((n) => flattenText(n.children));
    expect(linhas).toEqual([
      "\"Vestido Midi Linho (P)\": só 0 livres (1 já separada em outro pedido).",
      "\"Blusa Tricot Bege\": só 1 no estoque.",
    ]);
    expect(texto(m.tree)).toContain(T.semSaldoTitulo);
  });

  test("422 com a frase do servidor", async () => {
    mockGuardar.mockRejectedValueOnce(Object.assign(new Error("\"Piso\": o pedido aceita só quantidade inteira (peças)."), { status: 422, data: { code: "PEDIDO_QUANTIDADE" } }));
    const m = montar();
    irAoPasso2(m);
    aperta(m.tree, "pedido-data-amanha");
    await guardar(m.tree);
    expect(flattenText(porTestID(m.tree, "pedido-erro")[0].children)).toBe("\"Piso\": o pedido aceita só quantidade inteira (peças).");
  });
});

test("fechado: não renderiza nada", () => {
  const { tree } = montar({ visible: false });
  expect(tree.toJSON()).toBeNull();
});
