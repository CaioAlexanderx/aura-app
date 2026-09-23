// ============================================================
// CategoriaSeletor — a linha de categoria do cadastro de item.
//
// 23/09/2026 (QA final Matcon): o selo "última usada" confundia quando a
// categoria herdada não tinha nada a ver com o produto ("Calçados" num
// cadastro de cimento). Agora a linha explica de onde veio e convida a
// trocar.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/catalog/CategoryTreePicker", () => ({ CategoryTreePicker: "CategoryTreePicker" }));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [], tree: [] }) }));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));

import { CategoriaSeletor } from "@/components/screens/estoque/item-form/CategorySelector";

function texto(el: React.ReactElement): string {
  let tree: any;
  act(() => { tree = renderer.create(el); });
  const t = JSON.stringify(tree.toJSON());
  tree.unmount();
  return t;
}

describe("CategoriaSeletor", () => {
  test("categoria herdada do último cadastro: explica e convida a trocar", () => {
    const t = texto(<CategoriaSeletor rotulo="Calçados" ultimaUsada onAbrir={() => {}} />);
    expect(t).toContain("Calçados");
    expect(t).toContain("A mesma do último cadastro. Se não combina, toque para trocar.");
    expect(t).toContain("Trocar");
    expect(t).not.toContain("última usada");
  });

  test("categoria escolhida agora: só o nome e o Trocar", () => {
    const t = texto(<CategoriaSeletor rotulo="Cimento" ultimaUsada={false} onAbrir={() => {}} />);
    expect(t).toContain("Cimento");
    expect(t).not.toContain("último cadastro");
  });

  test("sem categoria: convite para escolher", () => {
    const t = texto(<CategoriaSeletor rotulo="" ultimaUsada onAbrir={() => {}} />);
    expect(t).toContain("Escolher categoria");
    expect(t).not.toContain("último cadastro");
  });
});
