// ============================================================
// ConfirmGate fechado não existe (QA da ficha do crediário, 23/11/2026)
//
// A pergunta fechada ficava no DOM com altura 0 e os botões focáveis: Tab +
// Enter em "Sim, remover" escondido removeu um pagamento sem pergunta.
// Vale para "Sim, remover", "Sim, devolver", "Sim, excluir" (Movimentações)
// e "Lançar mesmo assim" / "Sim, é outro" (Receber pagamento).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));

import { ConfirmGate } from "@/components/ConfirmGate";

function montar(visible: boolean, confirmLabel: string) {
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <ConfirmGate visible={visible} message="Remover este pagamento?" confirmLabel={confirmLabel} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
  });
  return t;
}
const botoes = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n: any) => n.props && typeof n.props.onPress === "function", { deep: true } as any);

describe("ConfirmGate", () => {
  test.each(["Sim, remover", "Sim, devolver", "Sim, excluir", "Lançar mesmo assim"])("fechado, '%s' não existe (nem focável)", (rotulo) => {
    const t = montar(false, rotulo);
    expect(t.toJSON()).toBeNull();
    expect(botoes(t)).toHaveLength(0);
  });
  test("aberto, mostra a pergunta e os dois botões", () => {
    const t = montar(true, "Sim, remover");
    expect(JSON.stringify(t.toJSON())).toContain("Remover este pagamento?");
    expect(botoes(t).length).toBeGreaterThanOrEqual(2);
  });
});
