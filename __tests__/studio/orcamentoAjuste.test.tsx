// ============================================================
// Orçamento em vídeo · "Cliente pediu ajuste" (28/09/2026, backend 362)
//
// Regras que os testes seguram:
//   - "O que o cliente pediu" é obrigatório e vai até 500 caracteres;
//   - o selo "Ajuste pedido" só acende em draft com ajuste pendente;
//   - a versão 1 não aparece; a 2 em diante, sim;
//   - a folha não chama a API com texto vazio e manda o texto aparado.
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  LIMITE_DO_AJUSTE, erroDoAjuste, temAjustePendente, rotuloDaVersao,
} from "@/components/studio/orcamentoVideo/ajusteDoOrcamento";
import { PedidoDeAjusteModal } from "@/components/studio/orcamentoVideo/PedidoDeAjusteModal";

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  // O Modal do RNW usa portal: aqui ele só passa os filhos adiante.
  const Modal = ({ visible, children }: any) => (visible ? children : null);
  return { ...RN, Modal };
});
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

const t: any = new Proxy({}, { get: () => "#000" });

describe("regras do ajuste", () => {
  test("texto obrigatório, aparado e até 500 caracteres", () => {
    expect(LIMITE_DO_AJUSTE).toBe(500);
    expect(erroDoAjuste("")).toBeTruthy();
    expect(erroDoAjuste("   ")).toBeTruthy();
    expect(erroDoAjuste("Trocar para azul")).toBeNull();
    expect(erroDoAjuste("x".repeat(500))).toBeNull();
    expect(erroDoAjuste("x".repeat(501))).toBeTruthy();
  });

  test("selo só em draft com ajuste pendente", () => {
    expect(temAjustePendente({ status: "draft", ajuste_pedido_em: "2026-09-28T12:00:00Z" })).toBe(true);
    expect(temAjustePendente({ status: "draft", ajuste_pedido_em: null })).toBe(false);
    expect(temAjustePendente({ status: "sent", ajuste_pedido_em: "2026-09-28T12:00:00Z" })).toBe(false);
    expect(temAjustePendente(null)).toBe(false);
  });

  test("versão 1 fica calada; 2 em diante aparece", () => {
    expect(rotuloDaVersao(undefined)).toBeNull();
    expect(rotuloDaVersao(1)).toBeNull();
    expect(rotuloDaVersao(2)).toBe("Versão 2");
    expect(rotuloDaVersao(3)).toBe("Versão 3");
  });
});

describe("folha Cliente pediu ajuste", () => {
  function montar(onConfirmar: jest.Mock) {
    const onClose = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <PedidoDeAjusteModal visible t={t} versao={1} onClose={onClose} onConfirmar={onConfirmar} />,
      );
    });
    const campo = () => r.root.findAll((n) => n.props.accessibilityLabel === "O que o cliente pediu" && typeof n.props.onChangeText === "function")[0];
    const registrar = () => r.root.findAll((n) => n.props.accessibilityLabel === "Registrar ajuste" && typeof n.props.onPress === "function")[0];
    return { r, onClose, campo, registrar };
  }

  test("texto vazio não chama a API", async () => {
    const onConfirmar = jest.fn(async () => true);
    const { registrar, onClose } = montar(onConfirmar);
    await act(async () => { await registrar().props.onPress(); });
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("manda o texto aparado e fecha quando registrou", async () => {
    const onConfirmar = jest.fn(async () => true);
    const { campo, registrar, onClose } = montar(onConfirmar);
    act(() => { campo().props.onChangeText("  Quer a caneca preta  "); });
    expect(campo().props.maxLength).toBe(500);
    await act(async () => { await registrar().props.onPress(); });
    expect(onConfirmar).toHaveBeenCalledWith("Quer a caneca preta");
    expect(onClose).toHaveBeenCalled();
  });

  test("se a API falhar, a folha fica aberta com o texto", async () => {
    const onConfirmar = jest.fn(async () => false);
    const { campo, registrar, onClose } = montar(onConfirmar);
    act(() => { campo().props.onChangeText("Mudar a cor"); });
    await act(async () => { await registrar().props.onPress(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(campo().props.value).toBe("Mudar a cor");
  });
});
