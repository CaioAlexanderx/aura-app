// ============================================================
// Painel Studio · bloco "Pagamento" do detalhe do pedido (A1, 26/09/2026)
//
// Teste de TELA do P0 da lojista: o pedido da vitrine pago pela chave Pix
// precisa de um lugar no painel Studio para conferir o comprovante e dar
// baixa, senão o job de 72 h o cancela. Trava:
//   - forma, situação e valor em reais ("R$ 89,82", nunca "89.82");
//   - comprovante em miniatura; PDF abre fora;
//   - confirmar SÓ depois da confirmação, na empresa DO PEDIDO (multi-CNPJ),
//     com toast e recarga do pedido;
//   - recusar com motivo; erro do servidor vira toast e não recarrega;
//   - pedido pago e cartão: sem botão.
// ============================================================
import React from "react";
import { Linking } from "react-native";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Rect: stub("Rect"), G: stub("G"),
  };
});

// O Modal do react-native-web vira portal no document, e a Testing
// Library quebra ali ("parentInstance.children.indexOf"). A confirmação é
// desenhada no lugar, só quando visível — mesmo arranjo de
// vitrineStudioPosCompraTela.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  const R = require("react");
  const Modal = ({ visible, children }: any) => (visible ? R.createElement(R.Fragment, null, children) : null);
  return { ...rn, Modal };
});

const mockToast = { success: jest.fn(), error: jest.fn() };
// Getter: o factory roda no import, antes de `mockToast` existir.
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));

const mockAprovar = jest.fn();
const mockRecusar = jest.fn();
jest.mock("@/hooks/useDigitalOrders", () => ({
  pagamentoDoPedidoDigitalApi: {
    aprovar: (...a: any[]) => mockAprovar(...a),
    recusar: (...a: any[]) => mockRecusar(...a),
  },
}));

import { BlocoPagamentoDoPedido } from "@/components/studio/BlocoPagamentoDoPedido";
import { SeloDoPagamento } from "@/components/studio/SeloDoPagamento";

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

const PEDIDO = {
  id: "o-42", company_id: "filial-2", source: "digital", status: "pending_payment",
  payment_method: "pix", payment_status: "pending", total: 89.82, total_amount: 89.82,
  order_number: 42, customer_name: "Helena Teste", payment_proof_url: null as string | null,
};

function montar(pedido: any = PEDIDO, onAtualizado = jest.fn()) {
  render(<BlocoPagamentoDoPedido pedido={pedido} companyIdDaSessao="matriz-1" onAtualizado={onAtualizado} />);
  return onAtualizado;
}

beforeEach(() => {
  mockAprovar.mockReset().mockResolvedValue({ approved: true });
  mockRecusar.mockReset().mockResolvedValue({ rejected: true });
  mockToast.success.mockClear();
  mockToast.error.mockClear();
});

test("Pix pendente: forma, situação e valor em reais", () => {
  montar();
  expect(naTela("PAGAMENTO")).toBe(true);
  expect(naTela("Pix")).toBe(true);
  expect(naTela("Aguardando pagamento")).toBe(true);
  expect(naTela("R$ 89,82")).toBe(true);
  expect(naTela("89.82")).toBe(false);
  expect(screen.getByText("Confirmar pagamento recebido")).toBeTruthy();
  expect(screen.getByText("Recusar pagamento")).toBeTruthy();
});

test("confirmar pede confirmação, grava na empresa DO PEDIDO, avisa e recarrega", async () => {
  const onAtualizado = montar();
  fireEvent.press(screen.getByText("Confirmar pagamento recebido"));
  // Ainda não gravou: primeiro a confirmação, com o valor.
  expect(mockAprovar).not.toHaveBeenCalled();
  expect(naTela("Confirmar o Pix de R$ 89,82?")).toBe(true);

  fireEvent.press(screen.getByText("Sim, confirmar"));
  await waitFor(() => expect(mockAprovar).toHaveBeenCalledWith("filial-2", "o-42"));
  await waitFor(() => expect(onAtualizado).toHaveBeenCalledTimes(1));
  expect(mockToast.success).toHaveBeenCalledWith("Pagamento confirmado · pedido #42");
});

test("voltar na confirmação não grava nada", () => {
  montar();
  fireEvent.press(screen.getByText("Confirmar pagamento recebido"));
  fireEvent.press(screen.getByText("Voltar"));
  expect(mockAprovar).not.toHaveBeenCalled();
  expect(naTela("Confirmar o Pix de")).toBe(false);
});

test("comprovante enviado + Já paguei: Aprovar pagamento e miniatura que amplia", () => {
  montar({ ...PEDIDO, status: "awaiting_approval", payment_proof_url: "https://cdn/filial-2/orders/o-42/proof.jpg?v=1" });
  expect(naTela("Comprovante enviado")).toBe(true);
  expect(screen.getByText("Aprovar pagamento")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Ver comprovante em tamanho real"));
  expect(screen.getByText("Abrir original")).toBeTruthy();
});

test("comprovante em PDF abre fora", () => {
  const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
  montar({ ...PEDIDO, payment_proof_url: "https://cdn/filial-2/orders/o-42/proof.pdf?v=2" });
  fireEvent.press(screen.getByText("Abrir comprovante (PDF)"));
  expect(abrir).toHaveBeenCalledWith("https://cdn/filial-2/orders/o-42/proof.pdf?v=2");
  abrir.mockRestore();
});

test("recusar com motivo: confirma, grava o motivo e recarrega", async () => {
  const onAtualizado = montar({ ...PEDIDO, status: "awaiting_approval" });
  fireEvent.press(screen.getByText("Recusar pagamento"));
  expect(naTela("O pedido #42 será cancelado.")).toBe(true);
  fireEvent.changeText(screen.getByLabelText("Motivo da recusa"), "Valor do comprovante não confere");
  fireEvent.press(screen.getByText("Recusar e cancelar"));
  await waitFor(() => expect(mockRecusar).toHaveBeenCalledWith("filial-2", "o-42", "Valor do comprovante não confere"));
  await waitFor(() => expect(onAtualizado).toHaveBeenCalledTimes(1));
});

test("erro do servidor: toast com o motivo e o pedido não é recarregado", async () => {
  mockAprovar.mockRejectedValueOnce(new Error("Pedido nao esta aguardando aprovacao"));
  const onAtualizado = montar();
  fireEvent.press(screen.getByText("Confirmar pagamento recebido"));
  fireEvent.press(screen.getByText("Sim, confirmar"));
  await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(
    "Não foi possível confirmar o pagamento: Pedido nao esta aguardando aprovacao"
  ));
  expect(onAtualizado).not.toHaveBeenCalled();
});

test("sem company_id no pedido, usa a empresa da sessão", async () => {
  montar({ ...PEDIDO, company_id: undefined });
  fireEvent.press(screen.getByText("Confirmar pagamento recebido"));
  fireEvent.press(screen.getByText("Sim, confirmar"));
  await waitFor(() => expect(mockAprovar).toHaveBeenCalledWith("matriz-1", "o-42"));
});

test("pago e cartão: sem botão de baixa", () => {
  montar({ ...PEDIDO, status: "confirmed", payment_status: "confirmed" });
  expect(naTela("Pago")).toBe(true);
  expect(screen.queryByText("Confirmar pagamento recebido")).toBeNull();
  screen.unmount();

  montar({ ...PEDIDO, payment_method: "card" });
  expect(naTela("Cartão")).toBe(true);
  expect(screen.queryByText("Confirmar pagamento recebido")).toBeNull();
  expect(screen.queryByText("Recusar pagamento")).toBeNull();
});

// ── QA rodada 2 (28/09/2026): "Pagamento e entrega" (LJ-32) ──────────────
test("CPF/CNPJ na nota, entrega e frete aparecem quando o backend manda", () => {
  montar({
    ...PEDIDO,
    request_nfce: true,
    customer_cpf_cnpj: "52998224725",
    delivery_type: "delivery",
    delivery_address: "Rua das Flores, 123 - Centro, São José dos Campos/SP",
    shipping_fee: 12.5,
    pix_discount: 4.48,
  });
  expect(naTela("PAGAMENTO E ENTREGA")).toBe(true);
  expect(naTela("CPF/CNPJ na nota")).toBe(true);
  expect(naTela("529.982.247-25")).toBe(true);
  expect(naTela("Receber em casa · Rua das Flores, 123 - Centro, São José dos Campos/SP")).toBe(true);
  expect(naTela("Frete")).toBe(true);
  expect(naTela("R$ 12,50")).toBe(true);
  expect(naTela("Desconto do Pix")).toBe(true);
  expect(naTela("R$ 4,48")).toBe(true);
});

test("retirada na loja e retirada por app, com fallback de quem busca", () => {
  montar({ ...PEDIDO, delivery_type: "pickup", retirada_endereco: "Av Napoleão Bonaparte, 123" });
  expect(naTela("Retirada na loja · Av Napoleão Bonaparte, 123")).toBe(true);
  screen.unmount();

  montar({ ...PEDIDO, delivery_type: "courier", courier_name: "João Motoboy", courier_plate: "ABC1D23" });
  expect(naTela("Retirada por app · João Motoboy · ABC1D23")).toBe(true);
  screen.unmount();

  montar({ ...PEDIDO, delivery_type: "courier", courier_a_informar: true });
  expect(naTela("Retirada por app · a cliente informa quem busca")).toBe(true);
});

test("sem os campos novos (backend antigo), o bloco não aparece", () => {
  montar(PEDIDO);
  expect(naTela("PAGAMENTO E ENTREGA")).toBe(false);
});

test("Pix vencido conta por que não cancelou sozinho (LJ-34)", () => {
  montar({ ...PEDIDO, pix_cancelamento: { vencido: true, motivo: "producao" } });
  expect(naTela("Este pedido não cancela sozinho porque a produção já começou.")).toBe(true);
});

test("Pix vencido sem o campo: nada muda", () => {
  montar(PEDIDO);
  expect(naTela("não cancela sozinho")).toBe(false);
});

// ── QA rodada 2: "Recusar pagamento" nunca falha calado ──────────────────
test("recusar com erro do servidor: mensagem na folha, folha aberta, motivo mantido", async () => {
  mockRecusar.mockRejectedValueOnce(new Error("Erro ao rejeitar pagamento"));
  const onAtualizado = montar({ ...PEDIDO, status: "awaiting_approval" });
  fireEvent.press(screen.getByText("Recusar pagamento"));
  fireEvent.changeText(screen.getByLabelText("Motivo da recusa"), "não confere");
  fireEvent.press(screen.getByText("Recusar e cancelar"));
  await waitFor(() => expect(naTela("Erro ao rejeitar pagamento")).toBe(true));
  // a folha continua aberta com o motivo digitado
  expect(screen.getByLabelText("Motivo da recusa").props.value).toBe("não confere");
  expect(onAtualizado).not.toHaveBeenCalled();
});

test("recusar com erro sem mensagem do servidor: texto padrão", async () => {
  mockRecusar.mockRejectedValueOnce({});
  montar({ ...PEDIDO, status: "awaiting_approval" });
  fireEvent.press(screen.getByText("Recusar pagamento"));
  fireEvent.press(screen.getByText("Recusar e cancelar"));
  await waitFor(() => expect(naTela("Não deu para recusar o pagamento. Tente de novo.")).toBe(true));
});

test("selo da fila: Pagamento a conferir só quando há o que conferir", () => {
  render(<SeloDoPagamento item={{ status: "pending_art", order_status: "awaiting_approval", payment_method: "pix" }} />);
  expect(naTela("Pagamento a conferir")).toBe(true);
  screen.unmount();
  render(<SeloDoPagamento item={{ status: "pending_art", order_status: "confirmed", payment_method: "pix" }} />);
  expect(screen.toJSON()).toBeNull();
});
