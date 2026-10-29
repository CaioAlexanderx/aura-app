// ============================================================
// Taxa da maquininha aceita vírgula decimal (incidente 29/10/2026):
// "11,52" no crédito gravou 100% porque o campo jogava a vírgula fora.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Switch: "Switch",
  TextInput: "TextInput",
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
}));

import { CardFeeSection } from "@/components/screens/configuracoes/CardFeeSection";

const palette = {
  label: "#000", desc: "#000", hint: "#000", trackOff: "#000", trackOn: "#000",
  thumbOff: "#000", thumbOn: "#000", inputBg: "#fff", inputBorder: "#000", inputText: "#000", boxBorder: "#000",
};

function montar(display: any, onToggle = jest.fn()) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CardFeeSection display={display} saving={false} onToggle={onToggle} palette={palette} />
    );
  });
  const campo = (id: string) => tree!.root.findByProps({ testID: id });
  return { campo, onToggle };
}

const base = { card_fee_enabled: true, card_fee_credit_pct: 0, card_fee_debit_pct: 0 };

describe("CardFeeSection — vírgula decimal", () => {
  it("11,52 no crédito grava 11.52 (e não 100)", () => {
    const { campo, onToggle } = montar(base);
    act(() => { campo("card-fee-credit").props.onChangeText("11,52"); });
    act(() => { campo("card-fee-credit").props.onBlur(); });
    expect(onToggle).toHaveBeenCalledWith("card_fee_credit_pct", 11.52);
  });

  it("11.52 com ponto continua valendo", () => {
    const { campo, onToggle } = montar(base);
    act(() => { campo("card-fee-debit").props.onChangeText("11.52"); });
    act(() => { campo("card-fee-debit").props.onBlur(); });
    expect(onToggle).toHaveBeenCalledWith("card_fee_debit_pct", 11.52);
  });

  it("acima de 100 trava em 100", () => {
    const { campo, onToggle } = montar(base);
    act(() => { campo("card-fee-credit").props.onChangeText("150"); });
    act(() => { campo("card-fee-credit").props.onBlur(); });
    expect(onToggle).toHaveBeenCalledWith("card_fee_credit_pct", 100);
  });

  it("mostra o valor salvo com vírgula", () => {
    const { campo } = montar({ ...base, card_fee_credit_pct: 11.52, card_fee_debit_pct: "1.99" });
    expect(campo("card-fee-credit").props.value).toBe("11,52");
    expect(campo("card-fee-debit").props.value).toBe("1,99");
  });

  it("entrar no campo e sair sem digitar não zera a taxa salva", () => {
    const { campo, onToggle } = montar({ ...base, card_fee_credit_pct: 11.52 });
    act(() => { campo("card-fee-credit").props.onBlur(); });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("apagar o campo de propósito grava 0", () => {
    const { campo, onToggle } = montar({ ...base, card_fee_credit_pct: 11.52 });
    act(() => { campo("card-fee-credit").props.onChangeText(""); });
    act(() => { campo("card-fee-credit").props.onBlur(); });
    expect(onToggle).toHaveBeenCalledWith("card_fee_credit_pct", 0);
  });
});
