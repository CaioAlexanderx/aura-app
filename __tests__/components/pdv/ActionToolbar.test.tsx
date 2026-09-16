// Fase 0 · I0.3 — a barra de ações virou botões de TEXTO (Cliente, Vendedora,
// Cupom, Troca ou devolução), 40px, sem truncar em nenhuma largura real, com
// ponto âmbar enquanto o campo obrigatório está vazio e o valor escrito
// depois de preenchido ("Cliente: Simone").
//
// Icon é mockado porque react-native-svg não passa pelo transformIgnorePatterns
// do projeto (mesma razão de __tests__/studio/dataBR.test.ts falhar ao carregar).
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  ACT_LABELS,
  ActPerson,
  ActTroca,
  rotuloDoBotao,
  a11yDoBotao,
} from "@/components/screens/pdv/ActionToolbar";

// React quebra texto interpolado em nós separados — achatamos a árvore
// RENDERIZADA (toJSON, já mapeada pro DOM via react-native-web) pra afirmar
// sobre a frase inteira que o lojista lê. Mesmo padrão de
// __tests__/financeiroResumoHero.test.tsx.
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

function renderText(el: React.ReactElement): { t: renderer.ReactTestRenderer; text: string } {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return { t, text: flattenText(t.toJSON()) };
}

describe("ActionToolbar — rótulos escritos", () => {
  it("nenhum rótulo curto usa reticências ou fica abreviado (regra: nunca trunca)", () => {
    // "Mais…" é intencional — é o botão de overflow do mobile, não uma frase
    // truncada; as reticências ali fazem parte do rótulo, não cortam texto.
    Object.entries(ACT_LABELS)
      .filter(([key]) => key !== "mais")
      .forEach(([, { curto }]) => {
        expect(curto).not.toMatch(/…/);
        expect(curto).not.toMatch(/[.][.][.]/);
      });
  });

  it("o rótulo completo de troca é 'Troca ou devolução', não 'Trocar'", () => {
    expect(ACT_LABELS.troca.curto).toBe("Troca ou devolução");
  });

  it("rotuloDoBotao: vazio mostra só o rótulo, preenchido mostra 'Rótulo: valor'", () => {
    expect(rotuloDoBotao("Cliente", null)).toBe("Cliente");
    expect(rotuloDoBotao("Cliente", "  ")).toBe("Cliente");
    expect(rotuloDoBotao("Vendedora", "Simone")).toBe("Vendedora: Simone");
  });

  it("a11yDoBotao: frase inteira + atalho, com e sem valor", () => {
    expect(a11yDoBotao("Selecionar a vendedora da venda", "F2")).toBe(
      "Selecionar a vendedora da venda (F2)",
    );
    expect(a11yDoBotao("Selecionar a vendedora da venda", "F2", "Simone")).toBe(
      "Selecionar a vendedora da venda. Agora: Simone (F2)",
    );
  });
});

describe("ActTroca — botão de texto simples", () => {
  it("renderiza o rótulo por extenso e o atalho F5, sem ícone como identidade", () => {
    const { text } = renderText(<ActTroca onOpen={jest.fn()} />);
    expect(text).toContain("Troca ou devolução");
    expect(text).toContain("F5");
  });

  it("accessibilityLabel carrega a frase inteira, não o rótulo curto", () => {
    const { t } = renderText(<ActTroca onOpen={jest.fn()} />);
    const pressable = t.root.findByProps({ accessibilityRole: "button" });
    expect(pressable.props.accessibilityLabel).toBe(
      "Iniciar uma troca ou devolução (F5)",
    );
  });
});

describe("ActPerson (Cliente) — obrigatório ganha ponto âmbar até ser preenchido", () => {
  function findPendingDot(root: renderer.ReactTestInstance) {
    // O "ponto âmbar" é a View de 7x7 renderizada só quando `pendente` é true
    // (ActBtn → s.pendente: { width: 7, height: 7, borderRadius: 4, ... }).
    return root.findAll((n: any) => {
      const st = n.props && n.props.style;
      if (!st) return false;
      const flat = Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st;
      return flat.width === 7 && flat.height === 7;
    });
  }

  it("obrigatório e vazio: mostra o ponto âmbar e o rótulo sem valor", () => {
    const { t, text } = renderText(
      <ActPerson
        kind="cliente"
        shortcut="F3"
        value={null}
        onChange={jest.fn()}
        options={[]}
        required
      />,
    );
    expect(findPendingDot(t.root).length).toBeGreaterThan(0);
    expect(text).toContain("Cliente");
    expect(text).not.toContain("Cliente:");
  });

  it("preenchido: some o ponto e o botão mostra 'Cliente: Simone'", () => {
    const { t, text } = renderText(
      <ActPerson
        kind="cliente"
        shortcut="F3"
        value={{ id: "c1", name: "Simone" }}
        onChange={jest.fn()}
        options={[]}
        required
      />,
    );
    expect(findPendingDot(t.root).length).toBe(0);
    expect(text).toContain("Cliente:");
    expect(text).toContain("Simone");
  });

  it("não obrigatório e vazio: nunca mostra o ponto âmbar", () => {
    const { t } = renderText(
      <ActPerson
        kind="vendedora"
        shortcut="F2"
        value={null}
        onChange={jest.fn()}
        options={[]}
      />,
    );
    expect(findPendingDot(t.root).length).toBe(0);
  });
});
