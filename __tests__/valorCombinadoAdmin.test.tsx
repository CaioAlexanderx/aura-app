// ============================================================
// Gestão Aura › Valor combinado da assinatura (14/10/2026)
//
// Bloco da ficha do cliente: mostra o valor atual (ou tabela), "Definir"
// abre o modal (valor, plano, ciclo, nota, motivo) → revisão com a
// confirmação → PUT; "Remover" → DELETE com motivo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
var mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));

// O Modal do RN vira portal no react-native-web e não monta no test renderer:
// a casca é trocada por uma que só renderiza corpo e rodapé quando visível.
jest.mock("@/components/admin/painel/PainelModal", () => {
  const R = require("react");
  return {
    PainelModal: (p: any) => (p.visible ? R.createElement(R.Fragment, null, p.children, p.rodape) : null),
  };
});

var mockAdmin = {
  customSubscription: jest.fn(),
  setCustomSubscription: jest.fn(),
  clearCustomSubscription: jest.fn(),
};
jest.mock("@/services/adminApi", () => ({ get adminApi() { return mockAdmin; } }));

import { ValorCombinadoSection } from "@/components/admin/ValorCombinadoSection";

const espera = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { await byTestId(tree, id)[0].props.onPress(); });
  await espera();
}
async function digita(tree: renderer.ReactTestRenderer, id: string, valor: string) {
  await act(async () => { byTestId(tree, id)[0].props.onChangeText(valor); });
}

const EMPRESA = { plan: "negocio", billing_cycle: "annual", billing_status: "active", extra_seats_granted: 1, has_subscription: true };

async function mount(atual: unknown, minimo = 5) {
  mockAdmin.customSubscription.mockResolvedValue({ custom_subscription: atual, company: EMPRESA, min_value: minimo });
  return montar();
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <ValorCombinadoSection companyId="emp-1" nome="Loja do Luis" plano="negocio" ciclo="annual" />
      </QueryClientProvider>
    );
  });
  await espera();
  return tree!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin.setCustomSubscription.mockResolvedValue({});
  mockAdmin.clearCustomSubscription.mockResolvedValue({});
});

describe("Gestão Aura — bloco do valor combinado", () => {
  it("sem valor combinado: mostra tabela e só o botão de definir", async () => {
    const tree = await mount(null);
    expect(text(tree)).toContain("Valor de tabela");
    expect(byTestId(tree, "valor-combinado-definir")).toHaveLength(1);
    expect(byTestId(tree, "valor-combinado-remover")).toHaveLength(0);
    tree.unmount();
  });

  it("lê pelo GET dedicado, com a chave por empresa", async () => {
    const tree = await mount(null);
    expect(mockAdmin.customSubscription).toHaveBeenCalledWith("emp-1");
    tree.unmount();
  });

  it("carregando: mostra o indicador e ainda não oferece os botões", async () => {
    mockAdmin.customSubscription.mockReturnValue(new Promise(() => {}));
    const tree = await montar();
    expect(byTestId(tree, "valor-combinado-carregando")).toHaveLength(1);
    expect(byTestId(tree, "valor-combinado-definir")).toHaveLength(0);
    tree.unmount();
  });

  it("503 (migration pendente): 'indisponível no momento', sem botões e sem quebrar", async () => {
    mockAdmin.customSubscription.mockRejectedValue({ status: 503, message: "migration 386 pendente" });
    const tree = await montar();
    expect(byTestId(tree, "valor-combinado-indisponivel")).toHaveLength(1);
    expect(text(tree)).toContain("indisponível no momento");
    expect(byTestId(tree, "valor-combinado-definir")).toHaveLength(0);
    tree.unmount();
  });

  it("erro comum: avisa e 'tentar de novo' refaz a leitura", async () => {
    mockAdmin.customSubscription.mockRejectedValueOnce({ status: 500, message: "boom" });
    mockAdmin.customSubscription.mockResolvedValue({ custom_subscription: null, company: EMPRESA, min_value: 5 });
    const tree = await montar();
    expect(byTestId(tree, "valor-combinado-erro-carga")).toHaveLength(1);
    await press(tree, "valor-combinado-tentar-de-novo");
    await espera();
    expect(mockAdmin.customSubscription).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "valor-combinado-definir")).toHaveLength(1);
    tree.unmount();
  });

  it("com valor combinado: resumo e botão de remover", async () => {
    const tree = await mount({ value: 211.2, plan: "negocio", cycle: "annual", note: "2 lojas" });
    expect(text(tree)).toContain("R$ 211,20/mês · Negócio · anual");
    expect(text(tree)).toContain("2 lojas");
    expect(byTestId(tree, "valor-combinado-remover")).toHaveLength(1);
    tree.unmount();
  });

  it("definir: valida, mostra a confirmação e só então grava (PUT)", async () => {
    const tree = await mount(null);
    await press(tree, "valor-combinado-definir");

    // Sem valor nem motivo, "Revisar" não avança.
    await press(tree, "valor-combinado-revisar");
    expect(byTestId(tree, "valor-combinado-revisao")).toHaveLength(0);
    expect(mockAdmin.setCustomSubscription).not.toHaveBeenCalled();

    await digita(tree, "valor-combinado-valor", "211,20");
    await digita(tree, "valor-combinado-nota", "2 lojas: R$ 140,83 + R$ 70,37");
    await digita(tree, "valor-combinado-motivo", "fechado por WhatsApp");
    await press(tree, "valor-combinado-ciclo-annual");
    await press(tree, "valor-combinado-revisar");

    expect(byTestId(tree, "valor-combinado-revisao")).toHaveLength(1);
    expect(text(tree)).toContain("Passa a valer no próximo checkout da empresa e protege o valor contra reajuste automático de acessos extras.");
    expect(mockAdmin.setCustomSubscription).not.toHaveBeenCalled();

    await press(tree, "valor-combinado-confirmar");
    expect(mockAdmin.setCustomSubscription).toHaveBeenCalledTimes(1);
    expect(mockAdmin.setCustomSubscription).toHaveBeenCalledWith("emp-1", {
      value: 211.2, plan: "negocio", cycle: "annual", note: "2 lojas: R$ 140,83 + R$ 70,37", reason: "fechado por WhatsApp",
    });
    expect(mockToast.success).toHaveBeenCalled();
    tree.unmount();
  });

  it("valor abaixo do mínimo do servidor (min_value) não grava", async () => {
    const tree = await mount(null, 10);
    await press(tree, "valor-combinado-definir");
    await digita(tree, "valor-combinado-valor", "8");
    await digita(tree, "valor-combinado-motivo", "teste");
    await press(tree, "valor-combinado-revisar");
    expect(byTestId(tree, "valor-combinado-revisao")).toHaveLength(0);
    expect(text(tree)).toContain("O mínimo é R$ 10,00 por mês.");
    expect(mockAdmin.setCustomSubscription).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("erro do backend: mostra a mensagem e volta ao formulário", async () => {
    mockAdmin.setCustomSubscription.mockRejectedValue({ message: "Valor abaixo do mínimo do provedor." });
    const tree = await mount(null);
    await press(tree, "valor-combinado-definir");
    await digita(tree, "valor-combinado-valor", "211,20");
    await digita(tree, "valor-combinado-motivo", "fechado");
    await press(tree, "valor-combinado-revisar");
    await press(tree, "valor-combinado-confirmar");
    expect(text(tree)).toContain("Valor abaixo do mínimo do provedor.");
    expect(byTestId(tree, "valor-combinado-revisao")).toHaveLength(0);
    tree.unmount();
  });

  it("remover: exige motivo e chama o DELETE", async () => {
    const tree = await mount({ value: 211.2, plan: "negocio", cycle: "annual" });
    await press(tree, "valor-combinado-remover");

    await press(tree, "valor-combinado-confirmar-remocao");
    expect(mockAdmin.clearCustomSubscription).not.toHaveBeenCalled();

    await digita(tree, "valor-combinado-motivo", "cliente voltou para a tabela");
    await press(tree, "valor-combinado-confirmar-remocao");
    expect(mockAdmin.clearCustomSubscription).toHaveBeenCalledWith("emp-1", "cliente voltou para a tabela");
    tree.unmount();
  });
});
