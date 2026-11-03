// ============================================================
// Caixa — modal do caixa (OpenCloseCashModal): retirada e reforço
// (30/10/2026, mockup docs/mockups/sangria-no-caixa.html).
//
//   1. caixa aberto: o passo 1 mostra Reforços/Retiradas e o esperado já
//      descontado; a lista do dia aparece com "desfazer";
//   2. "Retirar dinheiro" abre o formulário sem stepper; valor acima do
//      que há na gaveta avisa e trava; valor dentro registra, invalida a
//      lista e avisa o pai (status do caixa);
//   3. backend antigo (rota inexistente): sem linhas novas, esperado de
//      sempre.
// react-query mockado: useQuery devolve o que o teste define.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "u1", name: "Dona Lúcia" }, isStaff: true, company: { id: "empresa-1", member_role: "owner" } }),
}));
jest.mock("@/services/api", () => ({ employeesApi: { list: jest.fn() } }));
jest.mock("@/utils/cashClosePdf", () => ({ openCashClosePdf: jest.fn() }));

const mockRegistrar = jest.fn();
const mockRemover = jest.fn();
jest.mock("@/services/caixaApi", () => ({
  caixaApi: {
    abrir: jest.fn(), fechar: jest.fn(),
    movimentos: { list: jest.fn(), registrar: (...a: any[]) => mockRegistrar(...a), remover: (...a: any[]) => mockRemover(...a) },
  },
}));

let mockMovData: any = undefined;
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    const key = String(opts.queryKey?.[0] || "");
    if (key === "caixa-movimentos") return { data: mockMovData, isFetching: false };
    return { data: undefined, isFetching: false };
  },
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { toast } from "@/components/Toast";
import { OpenCloseCashModal } from "@/components/screens/pdv/OpenCloseCashModal";

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

const SESSAO = {
  id: "sessao-1", opened_at: "2026-10-30T11:02:00Z", troco_inicial: 100,
  opened_by: { id: "u1", name: "Dona Lúcia" },
  totais_ao_vivo: { pix: 0, cartao_debito: 0, cartao_credito: 0, dinheiro: 250, fiado: 0, outros: 0, geral: 250 },
};

function montar(onSuccess = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <OpenCloseCashModal visible companyId="empresa-1" companyName="Doce Encanto" companyCnpj={null}
        sessaoAtiva={SESSAO as any} onClose={jest.fn()} onSuccess={onSuccess} />
    );
  });
  return tree;
}

beforeEach(() => {
  mockMovData = undefined;
  mockRegistrar.mockReset(); mockRemover.mockReset(); mockInvalidate.mockReset();
  (toast.error as jest.Mock).mockReset(); (toast.success as jest.Mock).mockReset();
});

test("1. passo 1: reforços, retiradas, esperado descontado e a lista do dia", () => {
  mockMovData = {
    sessao_id: "sessao-1", sangrias: 200, suprimentos: 50, dinheiro_em_caixa: 200,
    movimentos: [
      { id: "m2", tipo: "sangria", valor: 200, motivo: "depósito no banco", created_at: "2026-10-30T17:10:00Z" },
      { id: "m1", tipo: "suprimento", valor: 50, motivo: "troco a mais", created_at: "2026-10-30T13:35:00Z" },
    ],
  };
  const tree = montar();
  expect(flattenText(porTestID(tree, "caixa-reforcos")[0].children)).toBe("Reforços de troco+ R$ 50,00");
  expect(flattenText(porTestID(tree, "caixa-retiradas")[0].children)).toBe("Retiradas− R$ 200,00");
  expect(flattenText(porTestID(tree, "caixa-esperado")[0].children)).toBe("R$ 200,00");
  expect(flattenText(porTestID(tree, "caixa-movimentos")[0].children)).toContain("14:10 · Retirada · depósito no banco− R$ 200,00desfazer");
  expect(porTestID(tree, "caixa-retirar")).toHaveLength(1);
  expect(porTestID(tree, "caixa-reforcar")).toHaveLength(1);
  tree.unmount();
});

test("2. retirar: avisa acima da gaveta, registra dentro dela e avisa o pai", async () => {
  mockMovData = { sessao_id: "sessao-1", sangrias: 0, suprimentos: 0, dinheiro_em_caixa: 350, movimentos: [] };
  mockRegistrar.mockResolvedValue({ movimento: { id: "m9" }, sangrias: 200, suprimentos: 0, dinheiro_em_caixa: 150 });
  const onSuccess = jest.fn();
  const tree = montar(onSuccess);

  act(() => { porTestID(tree, "caixa-retirar")[0].props.onPress(); });
  expect(porTestID(tree, "caixa-mov-valor")).toHaveLength(1);
  expect(flattenText(porTestID(tree, "caixa-mov-em-caixa")[0].children)).toBe("R$ 350,00 em dinheiro na gaveta agora");
  // sem stepper no formulário
  expect(tree.root.findAll((n) => n.props && n.props.children === "CONTAGEM")).toHaveLength(0);

  act(() => { porTestID(tree, "caixa-mov-valor")[0].props.onChangeText("400"); });
  expect(porTestID(tree, "caixa-mov-aviso")).toHaveLength(1);
  expect(porTestID(tree, "caixa-mov-confirmar")[0].props.disabled).toBe(true);

  act(() => { porTestID(tree, "caixa-mov-valor")[0].props.onChangeText("200,00"); });
  act(() => { porTestID(tree, "caixa-mov-motivo")[0].props.onChangeText("depósito no banco"); });
  expect(porTestID(tree, "caixa-mov-aviso")).toHaveLength(0);
  expect(porTestID(tree, "caixa-mov-confirmar")[0].props.disabled).toBe(false);

  await act(async () => { await porTestID(tree, "caixa-mov-confirmar")[0].props.onPress(); });
  expect(mockRegistrar).toHaveBeenCalledWith("empresa-1", { tipo: "sangria", valor: 200, motivo: "depósito no banco" });
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["caixa-movimentos", "empresa-1"] });
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledWith("Retirada registrada");
  // voltou ao passo 1
  expect(porTestID(tree, "caixa-mov-valor")).toHaveLength(0);
  expect(porTestID(tree, "caixa-retirar")).toHaveLength(1);
  tree.unmount();
});

test("2b. reforço: sem teto, e o erro do servidor vira toast", async () => {
  mockMovData = { sessao_id: "sessao-1", sangrias: 0, suprimentos: 0, dinheiro_em_caixa: 350, movimentos: [] };
  mockRegistrar.mockRejectedValue({ data: { error: "Nenhum caixa aberto para esta empresa." } });
  const tree = montar();
  act(() => { porTestID(tree, "caixa-reforcar")[0].props.onPress(); });
  act(() => { porTestID(tree, "caixa-mov-valor")[0].props.onChangeText("5000"); });
  expect(porTestID(tree, "caixa-mov-aviso")).toHaveLength(0);
  await act(async () => { await porTestID(tree, "caixa-mov-confirmar")[0].props.onPress(); });
  expect(mockRegistrar).toHaveBeenCalledWith("empresa-1", { tipo: "suprimento", valor: 5000, motivo: null });
  expect(toast.error).toHaveBeenCalledWith("Nenhum caixa aberto para esta empresa.");
  // continua no formulário para corrigir
  expect(porTestID(tree, "caixa-mov-valor")).toHaveLength(1);
  tree.unmount();
});

test("2c. desfazer chama o DELETE e avisa o pai", async () => {
  mockMovData = { sessao_id: "sessao-1", sangrias: 200, suprimentos: 0, dinheiro_em_caixa: 150,
    movimentos: [{ id: "m2", tipo: "sangria", valor: 200, motivo: null, created_at: "2026-10-30T17:10:00Z" }] };
  mockRemover.mockResolvedValue({ sessao_id: "sessao-1", movimentos: [], sangrias: 0, suprimentos: 0, dinheiro_em_caixa: 350 });
  const onSuccess = jest.fn();
  const tree = montar(onSuccess);
  await act(async () => { await porTestID(tree, "caixa-mov-desfazer-m2")[0].props.onPress(); });
  expect(mockRemover).toHaveBeenCalledWith("empresa-1", "m2");
  expect(onSuccess).toHaveBeenCalledTimes(1);
  tree.unmount();
});

test("3. backend antigo: sem linhas novas e o esperado de sempre", () => {
  mockMovData = undefined;
  const tree = montar();
  expect(porTestID(tree, "caixa-reforcos")).toHaveLength(0);
  expect(porTestID(tree, "caixa-retiradas")).toHaveLength(0);
  expect(porTestID(tree, "caixa-movimentos")).toHaveLength(0);
  expect(flattenText(porTestID(tree, "caixa-esperado")[0].children)).toBe("R$ 350,00");
  tree.unmount();
});
