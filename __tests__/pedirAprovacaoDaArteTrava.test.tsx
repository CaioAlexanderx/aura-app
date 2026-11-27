// ============================================================
// Pedir aprovação da arte: a trava do modal novo (27/11/2026)
//
// O Studio no ar (6 lojas reais) segue com o modal de sempre, intacto
// (ApprovalRequestModalAtual). O novo só aparece com PERSONALIZADOS_LIBERADO
// ou na empresa de teste (is_sandbox). Aqui:
//   1. a regra pura e as props do <Modal> hospedeiro (fade transparente só com
//      o novo; slide opaco com o atual);
//   2. o escolhedor: trava desligada + empresa real = modal atual; sandbox =
//      novo; consolidado nunca libera; trava geral ligada = novo;
//   3. o caminho antigo do render (createMugViewer) fica atrás da ausência da
//      opção `giro`, que só o modal novo passa.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockAuth: { estado: any } = { estado: {} };
const mockTrava = { liberado: false };

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth.estado }));
jest.mock("@/utils/personalizados", () => ({
  get PERSONALIZADOS_LIBERADO() { return mockTrava.liberado; },
}));
jest.mock("@/components/studio/ApprovalRequestModalAtual", () => ({
  ApprovalRequestModalAtual: () => {
    const { View } = jest.requireActual("react-native");
    return <View testID="modal-atual" />;
  },
}));
jest.mock("@/components/studio/ApprovalRequestModalNovo", () => ({
  ApprovalRequestModalNovo: () => {
    const { View } = jest.requireActual("react-native");
    return <View testID="modal-novo" />;
  },
}));

import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import { aprovacaoNovaLiberada, propsDoModalDeAprovacao } from "@/components/studio/aprovacaoDaArte/trava";

const PEDIDO: any = { id: "o1", order_number: "00020", customer_name: "Ana" };
const LOJA_REAL = { id: "c1", trade_name: "Sheid" };
const SANDBOX = { id: "c2", trade_name: "Conta de teste", is_sandbox: true };

async function abrir() {
  let r!: renderer.ReactTestRenderer;
  await act(async () => { r = renderer.create(<ApprovalRequestModal order={PEDIDO} onClose={jest.fn()} onSent={jest.fn()} />); });
  return r;
}
const tem = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false }).length === 1;

beforeEach(() => {
  mockTrava.liberado = false;
  mockAuth.estado = { company: LOJA_REAL, consolidatedView: false };
});

describe("a regra", () => {
  it("só a trava geral ou a empresa de teste liberam o modal novo", () => {
    expect(aprovacaoNovaLiberada(LOJA_REAL, false, false)).toBe(false);
    expect(aprovacaoNovaLiberada(null, false, false)).toBe(false);
    expect(aprovacaoNovaLiberada({ is_sandbox: "true" }, false, false)).toBe(false);
    expect(aprovacaoNovaLiberada(SANDBOX, false, false)).toBe(true);
    expect(aprovacaoNovaLiberada(LOJA_REAL, false, true)).toBe(true);
  });
  it("no consolidado a flag de uma loja nunca libera as outras", () => {
    expect(aprovacaoNovaLiberada(SANDBOX, true, false)).toBe(false);
  });
  it("o Modal hospedeiro: fade transparente só com o novo, slide opaco com o atual", () => {
    expect(propsDoModalDeAprovacao(true)).toEqual({ transparent: true, animationType: "fade" });
    expect(propsDoModalDeAprovacao(false)).toEqual({ animationType: "slide" });
    expect(propsDoModalDeAprovacao(false).transparent).toBeUndefined();
  });
});

describe("o escolhedor", () => {
  it("trava desligada e empresa real: aparece o modal atual", async () => {
    const r = await abrir();
    expect(tem(r, "modal-atual")).toBe(true);
    expect(r.root.findAllByProps({ testID: "modal-novo" })).toHaveLength(0);
  });

  it("empresa de teste (sandbox): aparece o modal novo", async () => {
    mockAuth.estado = { company: SANDBOX, consolidatedView: false };
    const r = await abrir();
    expect(tem(r, "modal-novo")).toBe(true);
    expect(r.root.findAllByProps({ testID: "modal-atual" })).toHaveLength(0);
  });

  it("sandbox no consolidado: continua o modal atual", async () => {
    mockAuth.estado = { company: SANDBOX, consolidatedView: true };
    const r = await abrir();
    expect(tem(r, "modal-atual")).toBe(true);
  });

  it("trava geral ligada: aparece o modal novo para qualquer empresa", async () => {
    mockTrava.liberado = true;
    const r = await abrir();
    expect(tem(r, "modal-novo")).toBe(true);
  });
});

describe("o caminho antigo do render", () => {
  const raiz = path.join(__dirname, "..", "components", "studio");
  it("o modal atual chama o gerador como no main (sem a opção giro)", () => {
    const fonte = fs.readFileSync(path.join(raiz, "ApprovalRequestModalAtual.tsx"), "utf8");
    expect(fonte).toContain("gerarRenderDoPedido(company.id, order.id, setEtapa)");
    expect(fonte).not.toContain("giro");
    expect(fonte).toContain("export function ApprovalRequestModalAtual(");
  });
  it("o gerador só usa o gravarGiro com a opção giro; senão, createMugViewer", () => {
    const fonte = fs.readFileSync(path.join(raiz, "visualEngine", "gerarRenderAprovacao.ts"), "utf8");
    expect(fonte).toContain("if (opcoes.giro) {");
    expect(fonte).toContain("createMugViewer(cv, template.spec, valores3d");
    expect(fonte).toContain("recordTurntable(3600)");
  });
  it("só o modal novo passa a opção giro", () => {
    const novo = fs.readFileSync(path.join(raiz, "ApprovalRequestModalNovo.tsx"), "utf8");
    expect(novo).toContain("giro: {");
  });
});
