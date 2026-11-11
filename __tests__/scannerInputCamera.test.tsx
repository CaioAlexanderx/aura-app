// p-108: o ScannerInput ganhou três props opcionais. Quem não as passa (o
// Caixa) segue igual: botão da câmera sempre. Com `cameraSoComDetector`, o
// botão só aparece onde o navegador tem BarcodeDetector. onChangeText
// acompanha o texto e volta a "" depois do Enter.
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import { ScannerInput } from "@/components/ScannerInput";

function botoesDeCamera(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll((n) => n.props && n.props.accessibilityLabel === "Ler código com a câmera", { deep: false });
}
function montar(props: any) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ScannerInput onScan={jest.fn()} {...props} />); });
  return tree;
}

afterEach(() => { delete (window as any).BarcodeDetector; });

describe("câmera do ScannerInput", () => {
  it("sem a prop (Caixa): botão sempre", () => {
    expect(botoesDeCamera(montar({})).length).toBe(1);
  });
  it("cameraSoComDetector sem BarcodeDetector: sem botão", () => {
    expect(botoesDeCamera(montar({ cameraSoComDetector: true })).length).toBe(0);
  });
  it("cameraSoComDetector com BarcodeDetector: botão", () => {
    (window as any).BarcodeDetector = function () {};
    expect(botoesDeCamera(montar({ cameraSoComDetector: true })).length).toBe(1);
  });
  it("onChangeText acompanha e o Enter limpa", () => {
    const onScan = jest.fn();
    const onChangeText = jest.fn();
    const tree = montar({ onScan, onChangeText, testID: "campo" });
    const campo = tree.root.findAll((n) => n.props && n.props.testID === "campo" && typeof n.props.onSubmitEditing === "function", { deep: false })[0];
    act(() => { campo.props.onChangeText("789100"); });
    expect(onChangeText).toHaveBeenLastCalledWith("789100");
    const campo2 = tree.root.findAll((n) => n.props && n.props.testID === "campo" && typeof n.props.onSubmitEditing === "function", { deep: false })[0];
    act(() => { campo2.props.onSubmitEditing(); });
    expect(onScan).toHaveBeenCalledWith({ code: "789100", source: "scanner" });
    expect(onChangeText).toHaveBeenLastCalledWith("");
  });
});
