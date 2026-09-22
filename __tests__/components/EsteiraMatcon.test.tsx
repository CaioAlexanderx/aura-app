// ============================================================
// Matcon M1 — a esteira compartilhada (22/09/2026).
//
// components/matcon/EsteiraMatcon.tsx serve às DUAS esteiras do módulo
// (Orçamentos agora, Entregas em seguida), então o teste é sobre o
// contrato do componente, não sobre orçamento:
//   1. quatro estações com contagem E dinheiro — a esteira mostra o
//      dinheiro parado, que é o número que faz o dono abrir a tela
//      (docs/matcon-faseamento-po-ux.md §4b regra 2);
//   2. tocar numa estação filtra (onPress chega);
//   3. as ações do card renderizam SEMPRE, sem hover (regra 7 do
//      CLAUDE.md);
//   4. a esteira vazia ensina o primeiro passo numa frase.
//
// Padrão de renderização: __tests__/components/SecaoEstoqueMatcon.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import {
  EsteiraMatcon, EsteiraCard, EsteiraVazia, EsteiraVaziaDestaque, type EsteiraEstacao,
} from "@/components/matcon/EsteiraMatcon";

/** Todo o texto renderizado, achatado — é assim que a loja lê a tela. */
function textos(tree: renderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map((n) => {
    const junta = (c: any): string =>
      Array.isArray(c) ? c.map(junta).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
    return junta(n.props.children);
  });
}

const ESTACOES: EsteiraEstacao[] = [
  { key: "abertos", label: "Abertos", count: 23, money: "R$ 61.300", tone: "violet", active: true },
  { key: "vencendo", label: "Vencendo ≤ 3 dias", count: 7, money: "R$ 18.400", tone: "amber" },
  { key: "aprovados", label: "Aprovados", count: 9, money: "R$ 44.900", tone: "green" },
  { key: "perdidos", label: "Perdidos", count: 4, money: "R$ 9.700", tone: "muted" },
];

describe("EsteiraMatcon: as quatro estações", () => {
  test("mostra contagem e dinheiro de cada estação", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<EsteiraMatcon stations={ESTACOES} testID="esteira" />); });
    const t = textos(tree);

    ESTACOES.forEach((e) => {
      expect(tree.root.findByProps({ testID: `matcon-estacao-${e.key}` })).toBeTruthy();
      expect(t).toContain(String(e.count));
      expect(t).toContain(e.money);
      expect(t).toContain(e.label);
    });
  });

  test("sem resumo ainda, a estação mostra '–' e não um zero mentiroso", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <EsteiraMatcon stations={ESTACOES.map((e) => ({ ...e, count: null, money: null }))} />,
      );
    });
    expect(textos(tree).filter((x) => x === "–").length).toBe(4);
  });

  test("tocar numa estação filtra (onPress chega ao componente)", () => {
    const onPress = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <EsteiraMatcon stations={ESTACOES.map((e) => (e.key === "vencendo" ? { ...e, onPress } : e))} />,
      );
    });
    act(() => { tree.root.findByProps({ testID: "matcon-estacao-vencendo" }).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("EsteiraCard: regra 7 — ação sempre visível", () => {
  test("as ações renderizam sem nenhum hover", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <EsteiraCard
          testID="card"
          tone="amber"
          right={<Text>R$ 1.093,21</Text>}
          actions={<Text>Enviar no WhatsApp</Text>}
        >
          <Text>Marlene Souza</Text>
        </EsteiraCard>,
      );
    });
    const t = textos(tree);
    expect(t).toContain("Marlene Souza");
    expect(t).toContain("R$ 1.093,21");
    expect(t).toContain("Enviar no WhatsApp");
    expect(tree.root.findByProps({ testID: "card-acoes" })).toBeTruthy();
  });
});

describe("EsteiraVazia: a esteira vazia ensina o primeiro passo", () => {
  test("título serifado + a frase que nomeia o botão do próximo passo", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <EsteiraVazia
          testID="vazio"
          titulo="Nenhum orçamento ainda."
          frase={<Text>Monte o carrinho no Caixa e toque em <EsteiraVaziaDestaque>Salvar orçamento</EsteiraVaziaDestaque> — ele aparece aqui, em Abertos.</Text>}
        />,
      );
    });
    const t = textos(tree);
    expect(t).toContain("Nenhum orçamento ainda.");
    expect(t.join(" ")).toContain("Salvar orçamento");
    expect(t.join(" ")).toContain("Monte o carrinho no Caixa");
    expect(tree.root.findByProps({ testID: "vazio" })).toBeTruthy();
  });
});
