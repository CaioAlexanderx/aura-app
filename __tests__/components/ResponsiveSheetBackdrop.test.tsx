// ============================================================
// ResponsiveSheet · toque no fundo (12/10/2026)
//
// O sheet é compartilhado por ~28 telas: o padrão NÃO muda (fundo e Esc/voltar
// chamam onClose). A prop opcional `onBackdropPress` só troca o toque no fundo;
// Esc/voltar (onRequestClose do Modal) seguem em onClose.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// O Modal do react-native-web usa portal, que o react-test-renderer não monta.
let mockOnRequestClose: (() => void) | undefined;
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native-web");
  return {
    ...rn,
    Modal: ({ visible, children, onRequestClose }: any) => {
      mockOnRequestClose = onRequestClose;
      return visible ? children : null;
    },
  };
});
jest.mock("@/components/anim", () => ({
  ModalPop: ({ children }: any) => children,
}));

import { ResponsiveSheet } from "@/components/ResponsiveSheet";

function montar(props: Record<string, any>) {
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <ResponsiveSheet visible onClose={props.onClose} onBackdropPress={props.onBackdropPress}>
        {null}
      </ResponsiveSheet>
    );
  });
  return t;
}
const fundo = (t: renderer.ReactTestRenderer) => t.root.findAllByProps({ accessibilityLabel: "Fechar" })[0];

describe("ResponsiveSheet · fundo escurecido", () => {
  it("sem onBackdropPress: o toque no fundo chama onClose (comportamento de sempre)", () => {
    const onClose = jest.fn();
    const t = montar({ onClose });
    act(() => { fundo(t).props.onPress(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("com onBackdropPress: o toque no fundo chama só ele", () => {
    const onClose = jest.fn();
    const onBackdropPress = jest.fn();
    const t = montar({ onClose, onBackdropPress });
    act(() => { fundo(t).props.onPress(); });
    expect(onBackdropPress).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc/voltar continuam em onClose mesmo com onBackdropPress", () => {
    const onClose = jest.fn();
    const onBackdropPress = jest.fn();
    montar({ onClose, onBackdropPress });
    act(() => { mockOnRequestClose!(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBackdropPress).not.toHaveBeenCalled();
  });
});
