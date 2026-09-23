// ============================================================
// Matcon M3 — a folha "Calcular ambiente" (components/matcon/CalculadoraAmbiente).
//
// O que o vendedor faz no balcão, na ordem: digita 3,5 e 4,2, lê "14,70 m²"
// na linha da sala, vê 15,88 m² → 7 caixas no resultado e toca num dos dois
// botões. O teste é isso.
//
// Icon e ResponsiveSheet são mockados no padrão do
// __tests__/components/ReceberPagamentoModal.test.tsx (react-native-svg e
// Modal não passam pelo transformIgnorePatterns do projeto).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
// Janela de notebook (o jsdom mede 0×0, que seria "celular").
let mockJanela = { width: 1366, height: 768 };
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return new Proxy(rn, {
    get(alvo, chave) {
      if (chave === "useWindowDimensions") return () => ({ ...mockJanela, scale: 1, fontScale: 1 });
      return alvo[chave as any];
    },
  });
});
jest.mock("@/components/ResponsiveSheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    SHEET_NARROW_BP: 500,
    // Passa-adiante, mas guarda o sheetStyle num View para o teste da
    // altura fixa (QA 23/09/2026).
    ResponsiveSheet: ({ visible, children, sheetStyle }: any) =>
      visible ? <View testID="matcon-calc-folha" style={sheetStyle}>{children}</View> : null,
  };
});

import React from "react";
import renderer, { act } from "react-test-renderer";

import { CalculadoraAmbiente } from "@/components/matcon/CalculadoraAmbiente";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  // Elemento React (props.children) ou nó do toJSON (.children).
  if (node.props && node.props.children !== undefined) return flattenText(node.props.children);
  return flattenText(node.children);
}

const BASE = {
  visible: true,
  productName: "Porcelanato Bianco 60×60",
  unit: "m²",
  purchaseUnitLabel: null as string | null,
  purchaseFactor: 2.32 as number | null,
  defaultWastePct: 8,
};

type Extras = { onUse?: any; onClose?: any; unitPrice?: number | null; otherUnitPrice?: number | null; otherLabel?: string };

function montar(props: Partial<typeof BASE> & Extras = {}) {
  const onUse = props.onUse || jest.fn();
  const onClose = props.onClose || jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CalculadoraAmbiente {...BASE} {...props} onUse={onUse} onClose={onClose} />
    );
  });
  return { tree, onUse, onClose };
}

function campo(tree: renderer.ReactTestRenderer, testID: string): any {
  return tree.root.findAllByProps({ testID })[0];
}
function texto(tree: renderer.ReactTestRenderer): string {
  return flattenText(tree.toJSON());
}

/** Preenche a primeira linha com a sala do mockup: 3,5 × 4,2. */
function digitarSala(tree: renderer.ReactTestRenderer) {
  act(() => { campo(tree, "matcon-calc-largura-0").props.onChangeText("3,5"); });
  act(() => { campo(tree, "matcon-calc-comprimento-0").props.onChangeText("4,2"); });
}

describe("CalculadoraAmbiente · Matcon M3", () => {
  it("digitar 3,5 e 4,2 mostra 14,70 m² na linha do ambiente", () => {
    const { tree } = montar();
    digitarSala(tree);

    expect(flattenText(campo(tree, "matcon-calc-area-0").props.children)).toContain("14,70 m²");
    expect(texto(tree)).toContain("14,70 m² somados");

    tree.unmount();
  });

  it("o resultado ao vivo: 15,88 m² → 7 caixas, com a sobra de 0,36 m²", () => {
    const { tree } = montar();
    digitarSala(tree);

    const t = texto(tree);
    expect(t).toContain("15,88 m²");
    expect(t).toContain("7 caixas");
    expect(t).toContain("7 caixas fechadas dão 16,24 m² · sobra 0,36 m²");

    tree.unmount();
  });

  it("'Usar 15,88 m²' chama onUse(15.88) e fecha a folha", () => {
    const { tree, onUse, onClose } = montar();
    digitarSala(tree);

    const btn = campo(tree, "matcon-calc-usar-area");
    expect(flattenText(btn.props.children)).toContain("Usar 15,88 m²");
    act(() => { btn.props.onPress(); });

    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledWith(15.88);
    expect(onClose).toHaveBeenCalled();

    tree.unmount();
  });

  it("'Usar 7 caixas fechadas' chama onUse(16.24) — a caixa cheia", () => {
    const { tree, onUse, onClose } = montar();
    digitarSala(tree);

    const btn = campo(tree, "matcon-calc-usar-caixas");
    expect(flattenText(btn.props.children)).toContain("Usar 7 caixas fechadas");
    act(() => { btn.props.onPress(); });

    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledWith(16.24);
    expect(onClose).toHaveBeenCalled();

    tree.unmount();
  });

  it("a perda vem da config e é editável só para esta venda", () => {
    const { tree } = montar({ defaultWastePct: 10 });
    expect(campo(tree, "matcon-calc-perda").props.value).toBe("10");
    digitarSala(tree);
    // 14,70 × 1,10 = 16,17 (o número do §5.8 da pesquisa).
    expect(texto(tree)).toContain("16,17 m²");

    act(() => { campo(tree, "matcon-calc-perda").props.onChangeText("8"); });
    expect(texto(tree)).toContain("15,88 m²");

    tree.unmount();
  });

  it("+ ambiente soma a segunda linha, e 'remover' desfaz", () => {
    const { tree } = montar();
    digitarSala(tree);

    act(() => { campo(tree, "matcon-calc-add").props.onPress(); });
    act(() => { campo(tree, "matcon-calc-largura-1").props.onChangeText("2"); });
    act(() => { campo(tree, "matcon-calc-comprimento-1").props.onChangeText("3"); });

    expect(texto(tree)).toContain("20,70 m² somados");

    act(() => { campo(tree, "matcon-calc-remover-1").props.onPress(); });
    expect(texto(tree)).toContain("14,70 m² somados");
    // A primeira linha nunca ganha "remover": a folha sempre tem um ambiente.
    expect(tree.root.findAllByProps({ testID: "matcon-calc-remover-0" }).length).toBe(0);

    tree.unmount();
  });

  it("sem purchaseFactor: só o botão dos m², sem falar em caixa", () => {
    const { tree } = montar({ purchaseFactor: null });
    digitarSala(tree);

    expect(flattenText(campo(tree, "matcon-calc-usar-area").props.children)).toContain("Usar 15,88 m²");
    expect(tree.root.findAllByProps({ testID: "matcon-calc-usar-caixas" }).length).toBe(0);
    expect(texto(tree)).not.toContain("caixa");

    tree.unmount();
  });

  it("sem medida digitada o botão fica travado e não devolve nada", () => {
    const { tree, onUse } = montar();
    const btn = campo(tree, "matcon-calc-usar-area");
    expect(btn.props.disabled).toBe(true);
    act(() => { btn.props.onPress(); });
    expect(onUse).not.toHaveBeenCalled();

    tree.unmount();
  });

  // ── QA 23/09/2026 ────────────────────────────────────────────────
  function estilo(node: any) {
    const st = node.props.style;
    return Object.assign({}, ...(Array.isArray(st) ? st.flat(5) : [st]).filter(Boolean));
  }

  it("no computador o balão tem altura fixa: o que cresce rola por dentro", () => {
    const { tree } = montar();
    const folha = () => tree.root.findAllByProps({ testID: "matcon-calc-folha" }, { deep: false } as any)[0];
    const antes = estilo(folha()).height;
    expect(typeof antes).toBe("number");
    expect(antes).toBeGreaterThan(0);

    digitarSala(tree);
    act(() => { campo(tree, "matcon-calc-add").props.onPress(); });
    act(() => { campo(tree, "matcon-calc-largura-1").props.onChangeText("2"); });
    act(() => { campo(tree, "matcon-calc-comprimento-1").props.onChangeText("3"); });

    // Mais linhas e o resultado cheio: a altura do balão não muda.
    expect(estilo(folha()).height).toBe(antes);
    tree.unmount();
  });

  it("'considero [10] % de perda' fica numa linha só, com o campo de largura fixa", () => {
    const { tree } = montar({ defaultWastePct: 10 });
    const linha = tree.root.findAllByProps({ testID: "matcon-calc-perda-linha" })[0];
    expect(estilo(linha).flexWrap).toBe("nowrap");
    expect(flattenText(linha.props.children)).toContain("% de perda");
    const perda = campo(tree, "matcon-calc-perda");
    expect(estilo(perda).width).toBe(52);
    tree.unmount();
  });

  it("cada opção mostra quanto custa no preço do carrinho", () => {
    // 15,88 m² × R$ 64,80 = R$ 1.029,02 · 7 caixas = 16,24 m² × 64,80 = R$ 1.052,35
    const { tree } = montar({ unitPrice: 64.8 });
    digitarSala(tree);
    expect(flattenText(campo(tree, "matcon-calc-valor-area").props.children)).toBe("R$ 1.029,02");
    expect(flattenText(campo(tree, "matcon-calc-valor-caixas").props.children)).toBe("16,24 m² · R$ 1.052,35");
    tree.unmount();
  });

  it("com o preço no cartão, as opções mostram os dois métodos", () => {
    const { tree } = montar({ unitPrice: 64.8, otherUnitPrice: 72, otherLabel: "cartão" });
    digitarSala(tree);
    expect(flattenText(campo(tree, "matcon-calc-valor-area").props.children)).toBe("R$ 1.029,02 · cartão R$ 1.143,36");
    expect(flattenText(campo(tree, "matcon-calc-valor-caixas").props.children))
      .toBe("16,24 m² · R$ 1.052,35 · cartão R$ 1.169,28");
    tree.unmount();
  });

  it("no celular (folha ancorada embaixo) não trava a altura", () => {
    mockJanela = { width: 390, height: 844 };
    try {
      const { tree } = montar();
      const folha = tree.root.findAllByProps({ testID: "matcon-calc-folha" }, { deep: false } as any)[0];
      expect(estilo(folha).height).toBeUndefined();
      tree.unmount();
    } finally {
      mockJanela = { width: 1366, height: 768 };
    }
  });

  it("sem preço nem medida, nada de valor inventado", () => {
    const semPreco = montar();
    digitarSala(semPreco.tree);
    expect(semPreco.tree.root.findAllByProps({ testID: "matcon-calc-valor-area" }).length).toBe(0);
    expect(flattenText(campo(semPreco.tree, "matcon-calc-valor-caixas").props.children)).toBe("16,24 m²");
    semPreco.tree.unmount();

    const semMedida = montar({ unitPrice: 64.8 });
    expect(semMedida.tree.root.findAllByProps({ testID: "matcon-calc-valor-area" }).length).toBe(0);
    semMedida.tree.unmount();
  });
});
