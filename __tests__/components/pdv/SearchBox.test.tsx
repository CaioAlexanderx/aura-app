// 28/09/2026 — o leitor global ignora teclas com o foco num campo. Quem bipava
// com o cursor na busca do Caixa ("Buscar produto ou código…") via o código
// parado no campo, sem Enter tratado, e o bipe seguinte grudava no anterior.
// A busca agora repassa o Enter para o Caixa tratar como código.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { SearchBox } from "@/components/screens/pdv/SearchBox";

function render(el: React.ReactElement) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t;
}

describe("SearchBox · Enter do leitor", () => {
  it("Enter repassa o texto para onSubmit e o campo não perde o foco", () => {
    const onSubmit = jest.fn();
    const t = render(<SearchBox value="7891234567895" onChange={() => {}} onSubmit={onSubmit} />);
    const input = t.root.findByType(TextInput);
    expect(input.props.blurOnSubmit).toBe(false);
    act(() => { input.props.onSubmitEditing({ nativeEvent: { text: "7891234567895" } }); });
    expect(onSubmit).toHaveBeenCalledWith("7891234567895");
  });

  it("sem nativeEvent.text, usa o valor controlado", () => {
    const onSubmit = jest.fn();
    const t = render(<SearchBox value="ABC-01" onChange={() => {}} onSubmit={onSubmit} />);
    act(() => { t.root.findByType(TextInput).props.onSubmitEditing({}); });
    expect(onSubmit).toHaveBeenCalledWith("ABC-01");
  });

  it("sem onSubmit, a busca continua só filtrando", () => {
    const t = render(<SearchBox value="" onChange={() => {}} />);
    expect(t.root.findByType(TextInput).props.onSubmitEditing).toBeUndefined();
  });
});
