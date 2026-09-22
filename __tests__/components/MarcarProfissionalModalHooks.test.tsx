// ============================================================
// Matcon M3 — MarcarProfissionalModal: ordem dos hooks (22/09/2026, QA)
//
// Regressao real vista no QA: o `if (!visible) return null` ficava ANTES do
// useMemo dos resultados, entao o primeiro render (fechado) rodava 5 hooks
// e o segundo (aberto) rodava 6 — React derrubava o modal no ErrorBoundary
// com "Rendered more hooks than during the previous render" no primeiro
// toque em "Marcar como profissional". Este teste abre o modal a partir do
// estado fechado, que e exatamente o caminho que quebrava.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito do Zé" } }),
}));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: [
    { id: "cli-1", name: "João Batista", phone: "11987650001" },
    { id: "cli-2", name: "Maria Souza", phone: "11955550002" },
  ] }),
}));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: (props: any) => (props.visible ? props.children : null),
}));
jest.mock("@/services/matconApi", () => ({
  matconApi: { createProfessional: jest.fn() },
  TRADE_LABELS: { pedreiro: "pedreiro", eletricista: "eletricista", outro: "profissional" },
}));

import { MarcarProfissionalModal } from "@/components/matcon/MarcarProfissionalModal";

function textos(tree: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n && n.children) n.children.forEach(walk);
  };
  walk(tree.toJSON());
  return out;
}

describe("MarcarProfissionalModal — abre a partir do estado fechado", () => {
  test("fechado -> aberto com cliente pre-escolhido nao derruba a arvore", () => {
    const props = { onClose: jest.fn(), onMarked: jest.fn(), presetCustomer: { id: "cli-2", name: "Maria Souza" } };
    let tree: any;
    act(() => { tree = renderer.create(<MarcarProfissionalModal visible={false} {...props} />); });
    expect(tree.toJSON()).toBeNull();

    expect(() => {
      act(() => { tree.update(<MarcarProfissionalModal visible {...props} />); });
    }).not.toThrow();

    const t = textos(tree);
    expect(t).toContain("Marcar como profissional");
    expect(t).toContain("Maria Souza");
    expect(t).toContain("Qual é o ofício dele?");
  });

  test("fechado -> aberto sem cliente mostra a busca e filtra por nome", () => {
    const props = { onClose: jest.fn(), onMarked: jest.fn() };
    let tree: any;
    act(() => { tree = renderer.create(<MarcarProfissionalModal visible={false} {...props} />); });
    act(() => { tree.update(<MarcarProfissionalModal visible {...props} />); });

    const busca = tree.root.findByProps({ testID: "marcarprof-busca" });
    act(() => { busca.props.onChangeText("joão"); });
    expect(tree.root.findAllByProps({ testID: "marcarprof-cliente-cli-1" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "marcarprof-cliente-cli-2" }).length).toBe(0);

    // fecha e reabre: os hooks continuam na mesma ordem
    act(() => { tree.update(<MarcarProfissionalModal visible={false} {...props} />); });
    expect(() => { act(() => { tree.update(<MarcarProfissionalModal visible {...props} />); }); }).not.toThrow();
  });
});
