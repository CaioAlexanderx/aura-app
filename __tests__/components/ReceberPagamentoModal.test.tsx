// ============================================================
// I0.5 — "Receber pagamento" trocou window.prompt/window.confirm por
// modal de verdade (ReceberPagamentoModal). Mesma chamada de API de
// antes (creditApi.receivePayment) — só a UI virou modal.
//
// Cobre:
//   - valor inválido (0,00 ou vazio) trava o botão Confirmar
//   - valor válido chama creditApi.receivePayment com o valor e a forma
//     de pagamento selecionada, e propaga o novo saldo via onSuccess
//   - valor MAIOR que o saldo em aberto pede confirmação extra
//     (ConfirmGate) em vez do window.confirm nativo antigo
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

const mockReceivePayment = jest.fn();
jest.mock("@/services/creditApi", () => ({
  creditApi: { receivePayment: (...a: any[]) => mockReceivePayment(...a) },
}));

import { ReceberPagamentoModal } from "@/components/screens/clientes/ReceberPagamentoModal";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function achar(tree: any, testID: string): any {
  return tree.root.findAllByProps({ testID })[0];
}
function acharPorTitulo(tree: any, title: string): any {
  return tree.root.findAllByProps({ title }).find((n: any) => typeof n.props.onPress !== "undefined" || n.props.disabled !== undefined);
}

const BASE = {
  visible: true,
  onClose: jest.fn(),
  companyId: "empresa-1",
  customerId: "cliente-1",
  customerName: "Ana Souza",
  balance: 150.5,
  onSuccess: jest.fn(),
};

describe("ReceberPagamentoModal", () => {
  beforeEach(() => {
    mockReceivePayment.mockReset();
    BASE.onSuccess.mockReset?.();
  });

  it("valor inválido (zerado) trava o botão Confirmar", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<ReceberPagamentoModal {...BASE} onSuccess={jest.fn()} />); });
    await flush();

    const input = achar(tree, "receber-pagamento-input");
    await act(async () => { input.props.onChangeText("0"); });
    await flush();

    const confirmar = acharPorTitulo(tree, "Confirmar");
    expect(confirmar.props.disabled).toBe(true);
    expect(mockReceivePayment).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("valor válido chama receivePayment e propaga o novo saldo", async () => {
    mockReceivePayment.mockResolvedValue({ new_balance: 0, mode: "global" });
    const onSuccess = jest.fn();
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ReceberPagamentoModal {...BASE} balance={100} onSuccess={onSuccess} />);
    });
    await flush();

    // Input já vem pré-preenchido com o saldo cheio (mesmo comportamento do
    // window.prompt antigo, que sugeria o saldo como valor). Troca a forma
    // de pagamento pra pix antes de confirmar.
    await act(async () => { achar(tree, "receber-pagamento-metodo-pix").props.onPress(); });
    await flush();
    await act(async () => { acharPorTitulo(tree, "Confirmar").props.onPress(); });
    await flush();

    expect(mockReceivePayment).toHaveBeenCalledTimes(1);
    expect(mockReceivePayment).toHaveBeenCalledWith("empresa-1", "cliente-1", {
      amount: 100,
      payment_method: "pix",
    });
    expect(onSuccess).toHaveBeenCalledWith(0);
    tree.unmount();
  });

  it("valor maior que o saldo pede confirmação extra (não window.confirm)", async () => {
    mockReceivePayment.mockResolvedValue({ new_balance: -49.5, mode: "global" });
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ReceberPagamentoModal {...BASE} balance={100} onSuccess={jest.fn()} />);
    });
    await flush();

    const input = achar(tree, "receber-pagamento-input");
    // 150,00 > saldo de 100 → overpay
    await act(async () => { input.props.onChangeText("15000"); });
    await flush();
    await act(async () => { acharPorTitulo(tree, "Confirmar").props.onPress(); });
    await flush();

    // Primeiro clique só abre o gate — ainda não chamou a API.
    expect(mockReceivePayment).not.toHaveBeenCalled();
    const texto = JSON.stringify(tree.toJSON());
    expect(texto).toContain("crédito a favor do cliente");

    // Segundo clique (confirmar no gate) aplica de fato.
    await act(async () => { acharPorTitulo(tree, "Sim, confirmar").props.onPress(); });
    await flush();
    expect(mockReceivePayment).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it("erro da API aparece na tela e não fecha o modal", async () => {
    mockReceivePayment.mockRejectedValue(new Error("Saldo já quitado"));
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ReceberPagamentoModal {...BASE} balance={100} onSuccess={jest.fn()} />);
    });
    await flush();

    await act(async () => { acharPorTitulo(tree, "Confirmar").props.onPress(); });
    await flush();

    expect(achar(tree, "receber-pagamento-erro").props.children).toBe("Saldo já quitado");
    expect(mockReceivePayment).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
});
