// ============================================================
// Collapsible e Presenca (25/11/2026, movimento do crediário)
//
//  · Collapsible fechado não deixa botão escondido alcançável (QA 23/11: Tab
//    + Enter em "Receber" escondido): no padrão fica montado e inerte (o
//    estado das telas de fora do crediário fica); com `desmontarFechado`
//    some no fim da animação.
//  · Presenca: o painel continua montado durante a saída (200 ms) e some
//    depois; com "menos movimento" some na hora.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";
import { Collapsible } from "@/components/anim/Collapsible";
import { Presenca } from "@/components/anim/Presenca";
import { Motion } from "@/constants/motion";

const achatar = (st: any): any => (Array.isArray(st) ? Object.assign({}, ...st.map(achatar)) : st || {});

const matchMediaOriginal = (window as any).matchMedia;
function menosMovimento(ligado: boolean) {
  (window as any).matchMedia = jest.fn(() => ({
    matches: ligado, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }));
}

beforeEach(() => { jest.useFakeTimers(); menosMovimento(false); });
afterEach(() => {
  jest.useRealTimers();
  (window as any).matchMedia = matchMediaOriginal;
});

// Só os nós do DOM (o RNW grava o testID como data-testid): o componente
// que recebe testID existe mesmo quando não desenha nada.
const porId = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => typeof n.type === "string" && n.props["data-testid"] === id);
// A camada animada (Animated.View) com as props de inércia.
const camada = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => typeof n.type !== "string" && n.props.testID === id && "aria-hidden" in n.props)[0];
const passar = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

function Sanfona({ aberta, desmontar = true }: { aberta: boolean; desmontar?: boolean }) {
  return (
    <Collapsible open={aberta} testID="sanfona" desmontarFechado={desmontar}>
      <Pressable testID="botao-escondido" accessibilityRole="button" onPress={() => {}}>
        <Text>Receber</Text>
      </Pressable>
    </Collapsible>
  );
}

describe("Collapsible (padrão: fica montado, inerte)", () => {
  const inerte = (t: renderer.ReactTestRenderer) => {
    expect(porId(t, "sanfona")[0].props["aria-hidden"]).toBe(true);
    const caixa = camada(t, "sanfona");
    expect(achatar(caixa.props.style).pointerEvents).toBe("none");
    expect(caixa.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(caixa.props.accessibilityElementsHidden).toBe(true);
  };

  test("fechada desde o início: conteúdo montado, mas inerte", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Sanfona aberta={false} desmontar={false} />); });
    expect(porId(t, "botao-escondido")).toHaveLength(1);
    inerte(t);
  });

  test("abre sem inércia; fechada de novo continua montada e inerte", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Sanfona aberta={false} desmontar={false} />); });
    act(() => { t.update(<Sanfona aberta desmontar={false} />); });
    expect(porId(t, "sanfona")[0].props["aria-hidden"]).toBeFalsy();
    expect(achatar(camada(t, "sanfona")?.props.style ?? {}).pointerEvents).toBeUndefined();
    passar(Motion.slow + 50);
    act(() => { t.update(<Sanfona aberta={false} desmontar={false} />); });
    passar(Motion.slow + 50);
    expect(porId(t, "botao-escondido")).toHaveLength(1);
    inerte(t);
  });

  test("menos movimento: fechada fica montada e inerte do mesmo jeito", () => {
    menosMovimento(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Sanfona aberta desmontar={false} />); });
    act(() => { t.update(<Sanfona aberta={false} desmontar={false} />); });
    expect(porId(t, "botao-escondido")).toHaveLength(1);
    inerte(t);
  });
});

describe("Collapsible com desmontarFechado", () => {
  test("fechada desde o início: o botão não existe (nada para o Tab achar)", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Sanfona aberta={false} />); });
    expect(porId(t, "botao-escondido")).toHaveLength(0);
    expect(porId(t, "sanfona")[0].props["aria-hidden"]).toBe(true);
  });

  test("abre montando o conteúdo; ao fechar fica inerte e some no fim da animação", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Sanfona aberta={false} />); });
    act(() => { t.update(<Sanfona aberta />); });
    expect(porId(t, "botao-escondido")).toHaveLength(1);
    expect(porId(t, "sanfona")[0].props["aria-hidden"]).toBeFalsy();
    passar(Motion.slow + 50);

    act(() => { t.update(<Sanfona aberta={false} />); });
    // Fechando: ainda na tela, mas sem toque e fora da leitura de tela.
    expect(porId(t, "sanfona")[0].props["aria-hidden"]).toBe(true);
    expect(porId(t, "botao-escondido")).toHaveLength(1);
    const caixa = camada(t, "sanfona");
    expect(achatar(caixa.props.style).pointerEvents).toBe("none");
    expect(caixa.props.importantForAccessibility).toBe("no-hide-descendants");

    passar(Motion.slow + 50);
    expect(porId(t, "botao-escondido")).toHaveLength(0);
  });

  test("menos movimento: fecha na hora", () => {
    menosMovimento(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Sanfona aberta />); });
    expect(porId(t, "botao-escondido")).toHaveLength(1);
    act(() => { t.update(<Sanfona aberta={false} />); });
    expect(porId(t, "botao-escondido")).toHaveLength(0);
  });
});

function Painel({ alvo }: { alvo: { nome: string } | null }) {
  return (
    <Presenca visivel={!!alvo} testID="painel">
      {/* O estado que alimenta o painel vira null ao fechar: a saída mostra
          o último conteúdo de quando estava aberto. */}
      {!!alvo && <Text testID="painel-texto">{alvo.nome}</Text>}
    </Presenca>
  );
}

describe("Presenca", () => {
  test("continua montado durante a saída, com o último conteúdo, e some depois", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Painel alvo={null} />); });
    expect(porId(t, "painel")).toHaveLength(0);

    act(() => { t.update(<Painel alvo={{ nome: "Receber pagamento" }} />); });
    expect(porId(t, "painel-texto")[0].props.children).toBe("Receber pagamento");
    passar(Motion.slow + 50);

    act(() => { t.update(<Painel alvo={null} />); });
    expect(porId(t, "painel")).toHaveLength(1);
    expect(achatar(camada(t, "painel").props.style).pointerEvents).toBe("none");
    expect(porId(t, "painel-texto")[0].props.children).toBe("Receber pagamento");

    passar(Motion.base / 2);
    expect(porId(t, "painel")).toHaveLength(1);

    passar(Motion.base);
    expect(porId(t, "painel")).toHaveLength(0);
  });

  test("reabrir durante a saída volta a valer o conteúdo novo", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Painel alvo={{ nome: "A" }} />); });
    passar(Motion.slow + 50);
    act(() => { t.update(<Painel alvo={null} />); });
    passar(50);
    act(() => { t.update(<Painel alvo={{ nome: "B" }} />); });
    passar(Motion.base + 50);
    expect(porId(t, "painel")).toHaveLength(1);
    expect(porId(t, "painel-texto")[0].props.children).toBe("B");
  });

  test("menos movimento: some na hora", () => {
    menosMovimento(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Painel alvo={{ nome: "A" }} />); });
    act(() => { t.update(<Painel alvo={null} />); });
    expect(porId(t, "painel")).toHaveLength(0);
  });
});
