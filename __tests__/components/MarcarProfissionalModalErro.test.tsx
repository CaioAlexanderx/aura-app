// ============================================================
// Matcon M3 — "Marcar como parceiro" quando a chamada falha (QA 23/09/2026).
//
// Em produção o modal mostrava o toast técnico "Rota nao encontrada".
// Agora:
//   - falhou: frase simples (no toast E dentro do modal), o modal continua
//     aberto com o cliente e a profissão escolhidos, e o botão vira "Tentar
//     de novo"; onMarked NÃO é chamado (a tela não fica achando que marcou).
//   - deu certo: confirmação clara, onMarked com o profissional e fecha.
//   - multi-CNPJ: `companyId` da ficha vence a empresa da sessão.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-sessao", name: "Depósito do Zé" } }),
}));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: (props: any) => (props.visible ? props.children : null),
}));
const mockCreateProfessional = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: { createProfessional: (...a: any[]) => mockCreateProfessional(...a) },
  TRADE_LABELS: { pedreiro: "pedreiro", eletricista: "eletricista", outro: "profissional" },
}));

import { toast } from "@/components/Toast";
import { MarcarProfissionalModal } from "@/components/matcon/MarcarProfissionalModal";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

const JOAO = { id: "cli-1", name: "João Batista", phone: "11987650001" };

function montar(props: any = {}) {
  const onMarked = jest.fn();
  const onClose = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <MarcarProfissionalModal visible presetCustomer={JOAO} onMarked={onMarked} onClose={onClose} {...props} />,
    );
  });
  // Escolhe a profissão.
  const chip = tree.root.findAllByProps({ testID: "marcarprof-oficio-pedreiro" }, { deep: false })[0];
  act(() => { chip.props.onPress(); });
  return { tree, onMarked, onClose };
}

async function confirmar(tree: renderer.ReactTestRenderer) {
  const botao = tree.root.findAll((n) => n.props && n.props.accessibilityLabel === "Confirmar profissional parceiro" && typeof n.props.onPress === "function")[0];
  await act(async () => { await botao.props.onPress(); });
}

beforeEach(() => { jest.clearAllMocks(); });

test("falhou (404): frase simples, modal aberto, 'Tentar de novo', sem onMarked", async () => {
  mockCreateProfessional.mockRejectedValueOnce(Object.assign(new Error("Rota nao encontrada"), { status: 404, data: { error: "Rota nao encontrada" } }));
  const { tree, onMarked, onClose } = montar();
  await confirmar(tree);

  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui marcar João Batista como parceiro agora.");
  expect(texto).toContain("Tentar de novo");
  expect(texto).not.toContain("Rota nao encontrada");
  expect(JSON.stringify((toast.error as jest.Mock).mock.calls)).not.toContain("Rota");
  expect(onMarked).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: "marcarprof-erro" }).length).toBeGreaterThan(0);

  // Tenta de novo e dá certo.
  const PROF = { id: "prof-1", customer_id: "cli-1", customer_name: "João Batista", trade: "pedreiro" };
  mockCreateProfessional.mockResolvedValueOnce({ professional: PROF });
  await confirmar(tree);
  expect(onMarked).toHaveBeenCalledWith(PROF);
  expect(onClose).toHaveBeenCalled();
  expect((toast.success as jest.Mock).mock.calls[0][0]).toContain("João Batista agora é profissional parceiro");
  tree.unmount();
});

test("multi-CNPJ: usa a empresa do cliente, não a da sessão", async () => {
  mockCreateProfessional.mockResolvedValueOnce({ professional: { id: "prof-1" } });
  const { tree } = montar({ companyId: "empresa-do-cliente" });
  await confirmar(tree);
  expect(mockCreateProfessional).toHaveBeenCalledWith("empresa-do-cliente", { customer_id: "cli-1", trade: "pedreiro" });
  tree.unmount();
});
