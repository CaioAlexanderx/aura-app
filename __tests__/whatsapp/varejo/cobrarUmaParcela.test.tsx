// ============================================================
// Cobrar UMA parcela pelo WhatsApp oficial (Fase 6k).
//
// O botão "Cobrar" sempre abriu o wa.me: grátis, manual, e nada sai sem
// o lojista tocar em enviar. O canal oficial é o oposto — a mensagem sai
// da fila e a Meta cobra. Por isso estes testes seguram:
//
// 1. o caminho oficial só APARECE quando todas as guardas passam (e some
//    quando falta plano, conexão, template ou a parcela);
// 2. um clique nunca gasta: primeiro a confirmação "isto envia 1
//    mensagem real e paga", só o segundo dispara;
// 3. `queued: false` — uma guarda do backend tendo funcionado — vira
//    motivo em português, nunca um código cru nem um "enviado!" falso;
// 4. o wa.me continua intacto ao lado.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

import { CobrancaPreviewModal } from "@/components/crediario/CobrancaPreviewModal";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

function acharPorTestId(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}

const BASE = {
  visible: true,
  recipientName: "Ana Souza",
  phone: "5511912345678",
  valorLabel: "R$ 150,00",
  valorDesc: "Parcela 2/6 · vence 10/10",
  initialMessage: "Olá, Ana!",
  onClose: jest.fn(),
};

describe("CobrancaPreviewModal — o caminho do WhatsApp oficial", () => {
  it("sem as guardas liberadas o caminho oficial nem aparece", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<CobrancaPreviewModal {...BASE} />); });
    await flush();
    expect(temTestId(tree, "cobranca-oficial")).toBe(false);
    tree.unmount();
  });

  it("sem o handler (parcela ausente) o caminho oficial não aparece", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<CobrancaPreviewModal {...BASE} podeEnviarOficial />);
    });
    await flush();
    expect(temTestId(tree, "cobranca-oficial")).toBe(false);
    tree.unmount();
  });

  it("um clique não gasta: só depois de confirmar o envio sai", async () => {
    const enviar = jest.fn(() => Promise.resolve({ queued: true, reason: null }));
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CobrancaPreviewModal {...BASE} podeEnviarOficial onEnviarOficial={enviar} />
      );
    });
    await flush();

    expect(temTestId(tree, "cobranca-oficial-abrir")).toBe(true);
    await act(async () => { acharPorTestId(tree, "cobranca-oficial-abrir").props.onPress(); });
    await flush();

    // Escolheu o canal — e ainda não gastou nada.
    expect(temTestId(tree, "cobranca-oficial-confirmar")).toBe(true);
    expect(enviar).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("1 mensagem real e paga");

    await act(async () => { acharPorTestId(tree, "cobranca-oficial-enviar").props.onPress(); });
    await flush();

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(temTestId(tree, "cobranca-oficial-ok")).toBe(true);
    tree.unmount();
  });

  it("queued false vira o motivo em português, não um código", async () => {
    const enviar = jest.fn(() => Promise.resolve({ queued: false, reason: "LIMITE_POR_CONTATO" }));
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CobrancaPreviewModal {...BASE} podeEnviarOficial onEnviarOficial={enviar} />
      );
    });
    await flush();

    await act(async () => { acharPorTestId(tree, "cobranca-oficial-abrir").props.onPress(); });
    await flush();
    await act(async () => { acharPorTestId(tree, "cobranca-oficial-enviar").props.onPress(); });
    await flush();

    expect(temTestId(tree, "cobranca-oficial-nao-enviou")).toBe(true);
    expect(temTestId(tree, "cobranca-oficial-ok")).toBe(false);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("máximo de mensagens do dia");
    expect(txt).not.toContain("LIMITE_POR_CONTATO");
    tree.unmount();
  });

  it("erro do backend já traduzido pelo pai aparece como está", async () => {
    const enviar = jest.fn(() => Promise.resolve({
      queued: false, erro: "O envio automático por WhatsApp não está no seu plano.",
    }));
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CobrancaPreviewModal {...BASE} podeEnviarOficial onEnviarOficial={enviar} />
      );
    });
    await flush();
    await act(async () => { acharPorTestId(tree, "cobranca-oficial-abrir").props.onPress(); });
    await flush();
    await act(async () => { acharPorTestId(tree, "cobranca-oficial-enviar").props.onPress(); });
    await flush();

    expect(JSON.stringify(tree.toJSON())).toContain("não está no seu plano");
    tree.unmount();
  });

  it("o wa.me continua ali, intacto, ao lado do canal oficial", async () => {
    const enviar = jest.fn(() => Promise.resolve({ queued: true }));
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CobrancaPreviewModal {...BASE} podeEnviarOficial onEnviarOficial={enviar} />
      );
    });
    await flush();
    expect(JSON.stringify(tree.toJSON())).toContain("Enviar pelo WhatsApp");
    expect(JSON.stringify(tree.toJSON())).toContain("Envio segue manual pelo WhatsApp");
    tree.unmount();
  });
});
