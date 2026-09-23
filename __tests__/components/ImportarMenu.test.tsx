// ============================================================
// Estoque · botão "Importar" (components/screens/estoque/ImportarMenu).
// QA 23/09/2026 (Matcon): "o primeiro clique às vezes não abre o menu".
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
// O portal do react-dom não roda no react-test-renderer: passa-adiante.
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => (active ? children : null),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ImportarMenu, TRAVA_DO_FUNDO_MS } from "@/components/screens/estoque/ImportarMenu";

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function estilo(node: any) {
  const st = node.props.style;
  const lista = Array.isArray(st) ? st.flat(5) : [st];
  return Object.assign({}, ...lista.filter((x: any) => x && typeof x === "object"));
}
function montar() {
  const onNota = jest.fn();
  const onPlanilha = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ImportarMenu onNota={onNota} onPlanilha={onPlanilha} />); });
  return { tree, onNota, onPlanilha };
}
const aberto = (tree: renderer.ReactTestRenderer) => porTestID(tree, "importar-menu").length > 0;
const clicar = (tree: renderer.ReactTestRenderer, id: string) =>
  act(() => { porTestID(tree, id)[0].props.onPress(); });

let agora = 1_000_000;
beforeEach(() => {
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
});
afterEach(() => { (Date.now as jest.Mock).mockRestore?.(); });

describe("ImportarMenu", () => {
  test("um clique abre; escolher uma opção fecha e chama a ação", () => {
    const { tree, onPlanilha } = montar();
    expect(aberto(tree)).toBe(false);
    clicar(tree, "importar-botao");
    expect(aberto(tree)).toBe(true);
    clicar(tree, "importar-opcao-planilha");
    expect(aberto(tree)).toBe(false);
    expect(onPlanilha).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("o botão não deixa selecionar o próprio texto (a seleção cancelava o clique no navegador)", () => {
    const { tree } = montar();
    const botao = porTestID(tree, "importar-botao")[0];
    expect(estilo(botao).userSelect).toBe("none");
    tree.unmount();
  });

  test("clique duplo: o 2º clique (no fundo) não fecha o menu que o 1º abriu", () => {
    const { tree } = montar();
    clicar(tree, "importar-botao");
    agora += 120;
    clicar(tree, "importar-menu-fundo");
    expect(aberto(tree)).toBe(true);

    // Depois da trava, tocar fora fecha, como sempre.
    agora += TRAVA_DO_FUNDO_MS;
    clicar(tree, "importar-menu-fundo");
    expect(aberto(tree)).toBe(false);
    tree.unmount();
  });

  test("resize (teclado do celular fechando) não fecha o menu", () => {
    const { tree } = montar();
    clicar(tree, "importar-botao");
    act(() => { window.dispatchEvent(new Event("resize")); });
    expect(aberto(tree)).toBe(true);
    // Esc continua fechando.
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(aberto(tree)).toBe(false);
    tree.unmount();
  });
});
