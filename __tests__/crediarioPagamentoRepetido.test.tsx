// ============================================================
// Crediário — pagamento repetido pede confirmação (23/11/2026)
//
// Caso Looks Da Jenny (21/11): o mesmo recebimento entrou duas vezes na
// ficha, o segundo de outro computador com a data voltada um dia. O backend
// passa a responder 409 PAGAMENTO_REPETIDO (mesma cliente, mesma loja, mesmo
// valor, mesma data de pagamento) sem gravar; a tela pergunta e o
// "Lançar mesmo assim" reenvia com confirmar_repetido: true.
//
// Cobre:
//   - leitura do 409 e os textos (hoje: texto aprovado; outro dia: dd/mm)
//   - ReceberPagamentoModal (lista de clientes) renderizado: pergunta,
//     reenvia confirmado, Cancelar não grava, outro erro segue igual
//   - ClienteCrediarioModal (ficha) pela fonte — o modal arrasta
//     react-native-svg e não carrega no jest (mesmo método de
//     crediarioRecebimento.test.ts)
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  pagamentoRepetidoDoErro, mensagemPagamentoRepetido, hojeEmBrasilia, CODIGO_PAGAMENTO_REPETIDO,
  recebimentoRecente, confirmarRepetidoNoEnvio,
} from "@/utils/crediarioRecebimento";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

const mockReceivePayment = jest.fn();
jest.mock("@/services/creditApi", () => ({
  creditApi: { receivePayment: (...a: any[]) => mockReceivePayment(...a) },
}));

import { ReceberPagamentoModal } from "@/components/screens/clientes/ReceberPagamentoModal";

// O ApiError do app (services/api.ts): status + data com o corpo do backend.
function erro409(data_pagamento: string, valor = 100) {
  const e: any = new Error("Já existe um pagamento igual nesta data.");
  e.status = 409;
  e.data = { error: e.message, code: "PAGAMENTO_REPETIDO", data_pagamento, valor };
  return e;
}

describe("pagamentoRepetidoDoErro", () => {
  test("lê o 409 PAGAMENTO_REPETIDO", () => {
    expect(pagamentoRepetidoDoErro(erro409("2026-11-20", 150))).toEqual({ data_pagamento: "2026-11-20", valor: 150 });
    expect(CODIGO_PAGAMENTO_REPETIDO).toBe("PAGAMENTO_REPETIDO");
  });

  test("qualquer outro erro: null", () => {
    expect(pagamentoRepetidoDoErro(null)).toBeNull();
    expect(pagamentoRepetidoDoErro(new Error("rede"))).toBeNull();
    expect(pagamentoRepetidoDoErro({ status: 409, data: { code: "PAYMENT_TOO_OLD" } })).toBeNull();
    expect(pagamentoRepetidoDoErro({ status: 500, data: { code: "PAGAMENTO_REPETIDO" } })).toBeNull();
  });
});

describe("mensagemPagamentoRepetido", () => {
  test("hoje: texto aprovado pelo Caio", () => {
    expect(mensagemPagamentoRepetido("2026-11-21", "2026-11-21"))
      .toBe("Já existe um pagamento igual hoje. Lançar mesmo assim?");
  });

  test("outro dia: em dd/mm", () => {
    expect(mensagemPagamentoRepetido("2026-11-20", "2026-11-21"))
      .toBe("Já existe um pagamento igual em 20/11. Lançar mesmo assim?");
    expect(mensagemPagamentoRepetido("2026-01-05", "2026-11-21"))
      .toBe("Já existe um pagamento igual em 05/01. Lançar mesmo assim?");
  });

  test("data ilegível nunca vira 'em undefined'", () => {
    expect(mensagemPagamentoRepetido("", "2026-11-21"))
      .toBe("Já existe um pagamento igual nesta data. Lançar mesmo assim?");
  });

  test("hoje é o dia de Brasília", () => {
    // 01h30 UTC de 21/11 = 22h30 de 20/11 em Brasília
    expect(hojeEmBrasilia(new Date("2026-11-21T01:30:00Z"))).toBe("2026-11-20");
    expect(hojeEmBrasilia(new Date("2026-11-21T15:00:00Z"))).toBe("2026-11-21");
  });
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
const achar = (tree: any, testID: string) => tree.root.findAllByProps({ testID })[0];
const acharPorTitulo = (tree: any, title: string) =>
  tree.root.findAllByProps({ title }).find((n: any) => typeof n.props.onPress !== "undefined" || n.props.disabled !== undefined);

const BASE = {
  visible: true,
  onClose: jest.fn(),
  companyId: "empresa-1",
  customerId: "cliente-1",
  customerName: "Ana Souza",
  balance: 100,
  onSuccess: jest.fn(),
};

describe("ReceberPagamentoModal — pagamento repetido", () => {
  beforeEach(() => { mockReceivePayment.mockReset(); BASE.onClose.mockReset(); });
  // O ConfirmGate fica montado (Collapsible com altura 0): vale o `visible`.
  const gateRepetido = (tree: any) => tree.root.findAll((n: any) => n.props.confirmLabel === "Lançar mesmo assim")[0];

  it("409 pergunta; 'Lançar mesmo assim' reenvia com confirmar_repetido", async () => {
    mockReceivePayment
      .mockRejectedValueOnce(erro409(hojeEmBrasilia()))
      .mockResolvedValueOnce({ new_balance: 0, mode: "global" });
    const onSuccess = jest.fn();
    let tree: any;
    await act(async () => { tree = renderer.create(<ReceberPagamentoModal {...BASE} onSuccess={onSuccess} />); });
    await flush();

    await act(async () => { acharPorTitulo(tree, "Confirmar").props.onPress(); });
    await flush();

    expect(mockReceivePayment).toHaveBeenCalledTimes(1);
    expect(mockReceivePayment.mock.calls[0][2]).toEqual({ amount: 100, payment_method: "dinheiro" });
    expect(onSuccess).not.toHaveBeenCalled();
    const texto = JSON.stringify(tree.toJSON());
    expect(texto).toContain("Já existe um pagamento igual hoje. Lançar mesmo assim?");
    expect(gateRepetido(tree).props.visible).toBe(true);
    // não vira mensagem de erro
    expect(achar(tree, "receber-pagamento-erro")).toBeUndefined();

    await act(async () => { acharPorTitulo(tree, "Lançar mesmo assim").props.onPress(); });
    await flush();

    expect(mockReceivePayment).toHaveBeenCalledTimes(2);
    expect(mockReceivePayment.mock.calls[1][2]).toEqual({ amount: 100, payment_method: "dinheiro", confirmar_repetido: true });
    expect(onSuccess).toHaveBeenCalledWith(0);
    tree.unmount();
  });

  it("outro dia mostra dd/mm; Cancelar não grava nada", async () => {
    mockReceivePayment.mockRejectedValueOnce(erro409("2026-11-20"));
    let tree: any;
    await act(async () => { tree = renderer.create(<ReceberPagamentoModal {...BASE} onSuccess={jest.fn()} />); });
    await flush();

    await act(async () => { acharPorTitulo(tree, "Confirmar").props.onPress(); });
    await flush();
    expect(JSON.stringify(tree.toJSON())).toContain("Já existe um pagamento igual em 20/11. Lançar mesmo assim?");

    // A pergunta é um ConfirmGate: o "Cancelar" dele fecha a pergunta.
    const gate = () => gateRepetido(tree);
    expect(gate().props.visible).toBe(true);
    expect(gate().props.cancelLabel).toBe("Cancelar");
    await act(async () => { gate().props.onCancel(); });
    await flush();

    expect(gate().props.visible).toBe(false);
    expect(mockReceivePayment).toHaveBeenCalledTimes(1);
    expect(BASE.onClose).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("outro erro continua como antes (mensagem na tela)", async () => {
    mockReceivePayment.mockRejectedValueOnce(new Error("Saldo já quitado"));
    let tree: any;
    await act(async () => { tree = renderer.create(<ReceberPagamentoModal {...BASE} onSuccess={jest.fn()} />); });
    await flush();

    await act(async () => { acharPorTitulo(tree, "Confirmar").props.onPress(); });
    await flush();

    expect(achar(tree, "receber-pagamento-erro").props.children).toBe("Saldo já quitado");
    expect(gateRepetido(tree).props.visible).toBe(false);
    tree.unmount();
  });
});

describe("ClienteCrediarioModal (ficha) usa a regra", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");

  test("o 409 abre a pergunta em vez do toast de erro", () => {
    expect(fonte).toContain("const rep = pagamentoRepetidoDoErro(err);\n      if (rep) { setRepetidoServidor(rep); return; }");
  });

  test("pergunta com 'Lançar mesmo assim' e 'Cancelar'; confirmar reenvia com confirmar_repetido", () => {
    expect(fonte).toContain("message={mensagemPagamentoRepetido(repetidoServidor?.data_pagamento ?? \"\")}");
    expect(fonte).toContain('confirmLabel="Lançar mesmo assim"');
    expect(fonte).toContain("onConfirm={() => confirmFreePayment(true)}");
    expect(fonte).toContain("...(confirmarRepetido ? { confirmar_repetido: true } : {}),");
  });

  test("a chave de idempotência não é trocada no 409 (é o mesmo pedido)", () => {
    // freeKeyRef só zera no sucesso e quando valor/forma/data/carnê mudam
    const catchBloco = fonte.slice(fonte.indexOf("const rep = pagamentoRepetidoDoErro(err);"));
    expect(catchBloco.slice(0, 120)).not.toContain("freeKeyRef.current = null");
  });

  test("uma pergunta só: 'Sim, é outro' já envia com confirmar_repetido", () => {
    // O aviso de 07/10 acusa R$260 há 25 s no razão → a lojista vê "Sim, é outro"…
    const T0 = Date.parse("2026-11-23T15:00:00.000Z");
    const recente = recebimentoRecente(
      [{ type: "payment", amount: 260, payment_method: "pix", created_at: new Date(T0 - 25_000).toISOString() }],
      null, 260, T0,
    );
    expect(recente).not.toBeNull();
    // …e esse "sim" vira confirmar_repetido no envio (o backend não procura
    // o igual e não manda 409: credito.pagamentoRepetido.test.js no backend).
    expect(confirmarRepetidoNoEnvio(recente)).toBe(true);
    // Sem aviso local, o envio vai sem confirmar: a pergunta é a do servidor.
    expect(confirmarRepetidoNoEnvio(recebimentoRecente([], null, 260, T0))).toBe(false);

    // A ficha liga o "Sim, é outro" a esse envio, e o gate do servidor só
    // abre a partir de um 409.
    expect(fonte).toContain('confirmLabel={repetido ? "Sim, é outro" : undefined}');
    expect(fonte).toContain("onConfirm={() => { setReceberGate(false); confirmFreePayment(confirmarRepetidoNoEnvio(repetido)); }}");
    expect(fonte).toContain("...(confirmarRepetido ? { confirmar_repetido: true } : {}),");
    expect(fonte.match(/setRepetidoServidor\(rep\)/g)).toHaveLength(1);
  });

  test("não usa window.confirm/alert", () => {
    expect(fonte).not.toMatch(/window\.(confirm|alert)\(/);
  });
});
