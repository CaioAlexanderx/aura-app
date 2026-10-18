// ============================================================
// Cadastro de item › seção Estoque › aviso quando a grade está vazia
// (INC-2026-10-17-02, ti-04).
//
// Com "Por cor e tamanho" marcado e nenhuma cor nem tamanho, a seção não
// dizia que faltava adicionar — a pessoa salvava o produto achando que a
// grade aparecia sozinha. O que estes testes seguram:
//  1. variants + sem cor e sem tamanho → o aviso aparece (perfil padrão
//     com "tamanhos", Matcon com "medidas");
//  2. com só um eixo (cores ou tamanhos) o aviso some (aparece a grade de
//     um eixo); com cor + tamanho também some (aparece a matriz);
//  3. em "Quantidade única" o aviso não existe.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoEstoque } from "@/components/screens/estoque/item-form/SecaoEstoque";
import { PERFIL_PADRAO, PERFIL_MATCON } from "@/components/screens/estoque/item-form/perfis";

const COR = { hex: "#EF4444", name: "Vermelho" };

function montar(extra: Record<string, any> = {}) {
  const noop = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SecaoEstoque
        narrow={false}
        modoEdicao={false}
        unidade="un" onUnidade={noop}
        stockMode="variants" onStockMode={noop}
        estoque="" onEstoque={noop}
        minimo="" onMinimo={noop}
        cores={[]} onCores={noop}
        tamanhos={[]} onTamanhos={noop}
        celulas={{}} onCelula={noop}
        barras={{}} onBarra={noop}
        onSubmit={noop}
        {...extra}
      />
    );
  });
  return tree;
}
function aviso(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll((n) => n.props.testID === "estoque-sem-grade", { deep: false })[0];
}
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node.children || []).map(texto).join("");
}

describe("SecaoEstoque — aviso da grade vazia", () => {
  it("por cor e tamanho, sem cor nem tamanho: o aviso aparece", () => {
    const tree = montar();
    expect(aviso(tree)).toBeTruthy();
    expect(texto(aviso(tree))).toBe("Adicione as cores e os tamanhos acima para preencher o estoque de cada variação.");
  });

  it("perfil Matcon: fala em medidas", () => {
    const tree = montar({ perfil: PERFIL_MATCON });
    expect(texto(aviso(tree))).toBe("Adicione as cores e as medidas acima para preencher o estoque de cada variação.");
  });

  it("com cor e tamanho o aviso some (vem a grade)", () => {
    const tree = montar({ cores: [COR], tamanhos: ["P", "M"] });
    expect(aviso(tree)).toBeUndefined();
  });

  it("com só um eixo o aviso some (vem a grade de um eixo)", () => {
    expect(aviso(montar({ cores: [COR] }))).toBeUndefined();
    expect(aviso(montar({ tamanhos: ["P"] }))).toBeUndefined();
  });

  it("quantidade única não mostra o aviso", () => {
    expect(aviso(montar({ stockMode: "single" }))).toBeUndefined();
  });

  it("o perfil padrão segue com o rótulo de sempre", () => {
    expect(PERFIL_PADRAO.estoque.rotuloDaGrade).toBe("Por cor e tamanho");
  });
});
