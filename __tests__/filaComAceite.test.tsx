// ============================================================
// Fila do pedido com aceite (tq-47, 29/10/2026 — desenho da Nina, 19/10)
//
// Aguardando aceite -> em preparo (com tempo) -> saiu para entrega ->
// entregue; recusado com motivo; aviso à cliente pelo WhatsApp da lojista.
// Acréscimos da Nina: pedido parado há 10 min ganha destaque e repete o
// aviso UMA vez; nada cancela sozinho; recusa de Pix pago diz para devolver
// por fora.
// ============================================================
import React from "react";
import { render, screen, fireEvent, configure, act } from "@testing-library/react-native";
import {
  podeAceitar, textoDoPedidoParado, pedidosParaRepetirAviso, horaPrevista, proximoPasso,
  lembreteNaEntrega, tituloDoAviso, minutosDesde,
} from "@/utils/filaComAceite";
import {
  situacaoDoPedido, filtrarPorGrupo, contagemDosGrupos, rotuloDoPagamento, type PedidoDaFila,
} from "@/utils/filaDePedidos";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

const AGORA = new Date("2026-10-29T21:30:00").getTime();
const p = (over: Partial<PedidoDaFila>): PedidoDaFila => ({
  id: over.id || "o1",
  order_number: over.order_number || "0412",
  status: over.status || "aguardando_aceite",
  created_at: over.created_at || new Date(AGORA - 2 * 60000).toISOString(),
  payment_method: over.payment_method === undefined ? "on_delivery" : over.payment_method,
  delivery_type: "delivery",
  ...over,
});

describe("regras da fila", () => {
  test("aguardando aceite pede ação; recusado e saiu para entrega têm rótulo próprio", () => {
    expect(situacaoDoPedido(p({}))).toEqual({ rotulo: "Aguardando aceite", tom: "ambar", precisaAgir: true });
    expect(situacaoDoPedido(p({ status: "out_for_delivery" })).rotulo).toBe("Saiu para entrega");
    expect(situacaoDoPedido(p({ status: "cancelled", cancel_kind: "recusado_pela_loja" })).rotulo).toBe("Recusado");
    expect(situacaoDoPedido(p({ status: "cancelled", cancel_kind: "cancelado_pela_loja" })).rotulo).toBe("Cancelado");
  });

  test("grupos e contagens incluem os estados novos", () => {
    const lista = [p({ id: "a" }), p({ id: "b", status: "out_for_delivery" }), p({ id: "c", status: "delivered" })];
    expect(filtrarPorGrupo(lista, "precisa-agir").map((o) => o.id)).toEqual(["a"]);
    expect(filtrarPorGrupo(lista, "em-curso").map((o) => o.id)).toEqual(["b"]);
    expect(contagemDosGrupos({ aguardando_aceite: 2, pending_payment: 1, out_for_delivery: 3, preparing: 1 }))
      .toMatchObject({ precisaAgir: 3, emCurso: 4 });
  });

  test("pagamento na entrega com a forma", () => {
    expect(rotuloDoPagamento("on_delivery", "cash")).toBe("Na entrega, dinheiro");
    expect(rotuloDoPagamento("on_delivery")).toBe("Na entrega");
    expect(rotuloDoPagamento("pix", "cash")).toBe("Pix");
  });

  test("quem pode aceitar: pagar na entrega sempre; Pix pago só na loja com a fila", () => {
    expect(podeAceitar(p({}))).toBe(true);
    const pago = p({ status: "confirmed", payment_method: "pix", aceite_na_fila: true });
    // (1) loja sem formas: nem o pedido marcado entra na fila.
    expect(podeAceitar(pago)).toBe(false);
    expect(podeAceitar(pago, true)).toBe(true);
    expect(podeAceitar({ ...pago, accepted_at: "x" }, true)).toBe(false);
    // (2) pago antes de a loja ligar as formas (sem a marca do checkout): como hoje.
    expect(podeAceitar({ ...pago, aceite_na_fila: null }, true)).toBe(false);
    expect(podeAceitar({ ...pago, aceite_na_fila: undefined }, true)).toBe(false);
  });

  test("pedido parado: destaque a partir de 10 min", () => {
    expect(textoDoPedidoParado(p({}), false, AGORA)).toBeNull();
    expect(textoDoPedidoParado(p({ created_at: new Date(AGORA - 12 * 60000).toISOString() }), false, AGORA)).toBe("há 12 min sem resposta");
    expect(textoDoPedidoParado(p({ status: "preparing", created_at: new Date(AGORA - 30 * 60000).toISOString() }), false, AGORA)).toBeNull();
  });

  test("aviso repete uma vez, só para pedido parado entre 10 e 30 min", () => {
    const parado = p({ id: "a", created_at: new Date(AGORA - 11 * 60000).toISOString() });
    const velho = p({ id: "b", created_at: new Date(AGORA - 3 * 3600000).toISOString() });
    const novo = p({ id: "c" });
    const ja = new Set<string>();
    expect(pedidosParaRepetirAviso([parado, velho, novo], ja, AGORA).map((o) => o.id)).toEqual(["a"]);
    ja.add("a");
    expect(pedidosParaRepetirAviso([parado], ja, AGORA)).toEqual([]);
  });

  test("hora prevista e próximo passo", () => {
    const aceito = p({ status: "preparing", accepted_at: new Date(AGORA - 20 * 60000).toISOString(), prep_minutes: 45 });
    expect(horaPrevista(aceito)).toBe("21:55");
    expect(proximoPasso(aceito)).toEqual({ acao: "saiu", rotulo: "Saiu para entrega" });
    expect(proximoPasso({ ...aceito, delivery_type: "pickup" })).toEqual({ acao: "status", status: "ready", rotulo: "Marcar como pronto" });
    expect(proximoPasso(p({ status: "out_for_delivery" }))).toEqual({ acao: "status", status: "delivered", rotulo: "Marcar como entregue" });
  });

  test("lembrete na porta e título do aviso", () => {
    expect(lembreteNaEntrega(p({ status: "out_for_delivery", pay_on_delivery_method: "cash" }))).toBe("Pagamento em dinheiro: confirme o recebimento ao entregar.");
    expect(lembreteNaEntrega(p({ status: "preparing", pay_on_delivery_method: "cash" }))).toBeNull();
    expect(tituloDoAviso("aceito", "0412")).toBe("Pedido #0412 aceito.");
    expect(minutosDesde(null, AGORA)).toBe(0);
  });
});

// ── a tela ─────────────────────────────────────────────────
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Rect: stub("Rect"), Ellipse: stub("Ellipse"), G: stub("G"),
    Defs: stub("Defs"), LinearGradient: stub("LinearGradient"), Stop: stub("Stop"),
  };
});
jest.mock("@/components/Toast", () => ({ toast: { show: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/somDePedido", () => ({ tocarAvisoDePedido: jest.fn(() => true) }));

const mockFila: any = {};
jest.mock("@/hooks/useDigitalOrders", () => ({
  useDigitalOrders: () => mockFila,
  useDigitalOrderDetail: () => ({ data: null, isLoading: false }),
}));

import { TabPedidos } from "@/components/screens/canal/TabPedidos";
const mockSom = jest.requireMock("@/utils/somDePedido").tocarAvisoDePedido as jest.Mock;

function preparar(orders: any[], extra: any = {}) {
  Object.assign(mockFila, {
    orders, counts: {}, kpi: { revenue_today: 0 }, isLoading: false, isFetching: false, refetch: jest.fn(),
    updateStatus: jest.fn(), isUpdating: false, cancelOrder: jest.fn(), isCancelling: false,
    deleteOrder: jest.fn(), isDeleting: false, approvePayment: jest.fn(), rejectPayment: jest.fn(),
    filaComAceite: true,
    acceptOrder: jest.fn().mockResolvedValue({
      aviso_whatsapp: { passo: "aceito", texto: "Oi! Recebemos o seu pedido #0412.", link: "https://wa.me/5511900000000?text=x" },
    }),
    refuseOrder: jest.fn(), markOutForDelivery: jest.fn().mockResolvedValue({}), markRefunded: jest.fn(), markDelivered: jest.fn(),
    ...extra,
  });
}

describe("TabPedidos com aceite", () => {
  beforeEach(() => mockSom.mockClear());

  test("pedido esperando aceite: forma e troco, tempo e Aceitar; depois, a faixa para avisar a cliente", async () => {
    preparar([{
      id: "o1", order_number: "0412", status: "aguardando_aceite", payment_method: "on_delivery",
      pay_on_delivery_method: "cash", delivery_type: "delivery", total: 78, created_at: new Date().toISOString(),
      customer_name: "Cliente Teste", pagamento_na_entrega: "Dinheiro. Paga com R$ 100,00: levar R$ 22,00 de troco.",
    }]);
    render(<TabPedidos />);
    expect(screen.getByText("Dinheiro. Paga com R$ 100,00: levar R$ 22,00 de troco.")).toBeTruthy();
    fireEvent.press(screen.getByText("60 min"));
    await act(async () => { fireEvent.press(screen.getByText("Aceitar")); });
    expect(mockFila.acceptOrder).toHaveBeenCalledWith("o1", 60);
    expect(screen.getByText(/Pedido #0412 aceito\. Avise a cliente:/)).toBeTruthy();
    expect(screen.getByText("Avisar no WhatsApp")).toBeTruthy();
  });

  test("pedido parado há mais de 10 min: destaque e o aviso toca uma vez", () => {
    preparar([{
      id: "o2", order_number: "0413", status: "aguardando_aceite", payment_method: "on_delivery",
      delivery_type: "delivery", total: 40, created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    }]);
    render(<TabPedidos />);
    expect(screen.getByText("há 12 min sem resposta")).toBeTruthy();
    expect(mockSom).toHaveBeenCalledTimes(1);
  });

  test("em preparo aceito: previsão e Saiu para entrega", async () => {
    preparar([{
      id: "o3", order_number: "0414", status: "preparing", payment_method: "on_delivery", delivery_type: "delivery",
      total: 40, created_at: new Date().toISOString(), accepted_at: new Date().toISOString(), prep_minutes: 45,
    }]);
    render(<TabPedidos />);
    expect(screen.getByText(/Previsto até \d\d:\d\d/)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Saiu para entrega")); });
    expect(mockFila.markOutForDelivery).toHaveBeenCalledWith("o3");
  });

  // Revisão do #930: o histórico de pedidos pagos não vira "aguardando aceite".
  const PAGO = {
    id: "o5", order_number: "0300", status: "confirmed", payment_method: "pix", payment_status: "confirmed",
    delivery_type: "pickup", total: 50, created_at: new Date(Date.now() - 20 * 60000).toISOString(),
  };

  test("(1) loja sem formas: Pix pago aparece como hoje, mesmo marcado", () => {
    preparar([{ ...PAGO, aceite_na_fila: true }], { filaComAceite: false });
    render(<TabPedidos />);
    expect(screen.queryByText("Aceitar")).toBeNull();
    expect(screen.queryByText("Recusar")).toBeNull();
    expect(screen.queryByText(/sem resposta/)).toBeNull();
    expect(screen.getByText("Confirmado")).toBeTruthy();
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  test("(2) loja com formas: Pix pago antes de ligar as formas aparece como hoje", () => {
    preparar([{ ...PAGO, aceite_na_fila: null }], { filaComAceite: true });
    render(<TabPedidos />);
    expect(screen.queryByText("Aceitar")).toBeNull();
    expect(screen.queryByText(/sem resposta/)).toBeNull();
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  test("loja com formas: Pix pago nascido na fila ganha Aceitar e Recusar", () => {
    preparar([{ ...PAGO, aceite_na_fila: true }], { filaComAceite: true });
    render(<TabPedidos />);
    expect(screen.getByText("Aceitar")).toBeTruthy();
    expect(screen.getByText("Recusar")).toBeTruthy();
    expect(screen.queryByText("Cancelar")).toBeNull();
  });
});
