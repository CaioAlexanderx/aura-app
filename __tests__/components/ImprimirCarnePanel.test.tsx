// ============================================================
// Ficha do crediário · escolha do formato ao imprimir (10/10/2026)
//
//   - começa na bobina (quem já imprime não muda de papel sem pedir);
//   - escolher A4 e imprimir chama onPrint("a4") e lembra a escolha;
//   - sem chave Pix (null) o aviso aparece, com atalho; com chave ou sem
//     saber ainda (undefined), não aparece.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// Icon puxa react-native-svg, que não carrega no Jest.
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));

import { ImprimirCarnePanel } from "@/components/crediario/ficha/ImprimirCarnePanel";

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

function montar(props: Partial<React.ComponentProps<typeof ImprimirCarnePanel>> = {}) {
  const base = {
    titulo: "Compra de 13/09", parcelas: 2, pixKey: "chave@loja.com",
    onPrint: jest.fn(), onBack: jest.fn(), onClose: jest.fn(), onCadastrarPix: jest.fn(),
  };
  const all = { ...base, ...props };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<ImprimirCarnePanel {...all} />); });
  return { t, props: all };
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const apertar = (t: renderer.ReactTestRenderer, id: string) => act(() => { porId(t, id)[0].props.onPress(); });

describe("ImprimirCarnePanel", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("mostra o carnê e as parcelas, e começa na bobina", () => {
    const { t, props } = montar();
    expect(texto(t.toJSON())).toContain("Compra de 13/09 · 2 parcelas a pagar");
    apertar(t, "imprimir-carne-confirmar");
    expect(props.onPrint).toHaveBeenCalledWith("bobina");
  });

  it("A4 escolhido vai no onPrint e fica lembrado", () => {
    const { t, props } = montar();
    apertar(t, "imprimir-carne-a4");
    apertar(t, "imprimir-carne-confirmar");
    expect(props.onPrint).toHaveBeenCalledWith("a4");
    // Reabrindo, já vem no A4.
    const outra = montar();
    apertar(outra.t, "imprimir-carne-confirmar");
    expect(outra.props.onPrint).toHaveBeenCalledWith("a4");
  });

  it("sem chave Pix, avisa e oferece o atalho", () => {
    const { t, props } = montar({ pixKey: null });
    expect(porId(t, "imprimir-carne-sem-pix")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("Sem chave Pix cadastrada");
    apertar(t, "imprimir-carne-cadastrar-pix");
    expect(props.onCadastrarPix).toHaveBeenCalled();
  });

  it("com chave, ou sem saber ainda, não acusa falta de Pix", () => {
    expect(porId(montar({ pixKey: "abc" }).t, "imprimir-carne-sem-pix")).toHaveLength(0);
    expect(porId(montar({ pixKey: undefined }).t, "imprimir-carne-sem-pix")).toHaveLength(0);
  });
});
