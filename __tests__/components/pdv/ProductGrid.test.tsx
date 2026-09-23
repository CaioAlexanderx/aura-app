// Fase 0 · I0.3 — "EST. 11 UN" (abreviação de sistema, caixa alta) virou
// "11 em estoque" (frase, singular natural, unidade só aparece quando não é
// "un"/"unidade": "3 kg em estoque").
//
// Icon é mockado porque react-native-svg não passa pelo transformIgnorePatterns
// do projeto (mesma razão de __tests__/studio/dataBR.test.ts falhar ao carregar).
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ProductGrid, stockLabel, GridProduct } from "@/components/screens/pdv/ProductGrid";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

describe("stockLabel", () => {
  it("unidade implícita (un / vazia): '11 em estoque', sem a unidade repetida", () => {
    expect(stockLabel(11, "un")).toBe("11 em estoque");
    expect(stockLabel(11, "")).toBe("11 em estoque");
    expect(stockLabel(11, undefined)).toBe("11 em estoque");
  });

  it("singular natural: '1 em estoque', não '1 uns em estoque'", () => {
    expect(stockLabel(1, "un")).toBe("1 em estoque");
  });

  it("unidade diferente de un segue a unidade: '3 kg em estoque'", () => {
    expect(stockLabel(3, "kg")).toBe("3 kg em estoque");
  });

  it("nunca usa a abreviação antiga 'EST.' ou caixa alta de sistema", () => {
    const label = stockLabel(11, "un");
    expect(label).not.toMatch(/EST\./i);
    expect(label).not.toBe(label.toUpperCase());
  });

  it("sem estoque informado (null/undefined), devolve string vazia", () => {
    expect(stockLabel(null)).toBe("");
    expect(stockLabel(undefined)).toBe("");
  });

  it("milheiro com Matcon ligado, por extenso: '18,5 milheiros em estoque (18.500 peças)'", () => {
    expect(stockLabel(18.5, "mlh", true)).toBe("18,5 milheiros em estoque (18.500 peças)");
    expect(stockLabel(20, "mlh", true)).toBe("20 milheiros em estoque (20.000 peças)");
    expect(stockLabel(1, "mlh", true)).toBe("1 milheiro em estoque (1.000 peças)");
    // Sem Matcon, "mlh" não é milheiro no Caixa: fica como estava.
    expect(stockLabel(20, "mlh")).toBe("20 mlh em estoque");
  });

  it("Matcon ligado: unidade por extenso e no plural certo (QA 23/09/2026)", () => {
    expect(stockLabel(16, "sc", true)).toBe("16 sacos em estoque");
    expect(stockLabel(12.5, "m²", true)).toBe("12,5 m² em estoque");
    expect(stockLabel(11, "un", true)).toBe("11 em estoque");
    // Loja sem Matcon: exatamente o de antes.
    expect(stockLabel(16, "sc")).toBe("16 sc em estoque");
  });
});

describe("ProductGrid — card mostra a frase, não a abreviação", () => {
  const produto: GridProduct = {
    id: "p1", name: "Vestido midi floral", price: 189.9, stock: 11, unit: "un",
  };
  const produtoKg: GridProduct = {
    id: "p2", name: "Tecido avulso", price: 42, stock: 3, unit: "kg",
  };

  it("renderiza '11 em estoque' pro produto em unidade, '3 kg em estoque' pro produto em kg", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <ProductGrid products={[produto, produtoKg]} qtyById={{}} onAdd={jest.fn()} />,
      );
    });
    const text = flattenText(t.toJSON());
    expect(text).toContain("11 em estoque");
    expect(text).toContain("3 kg em estoque");
    expect(text).not.toMatch(/EST\./i);
  });
});

// QA 23/09/2026: duas "MANTA ALUMINIZADA 10CM" (Dryko e Denver) idênticas no
// grid. Com marca, uma linha pequena debaixo do nome; sem marca, o card de
// sempre (nada de linha vazia, mesma altura mínima do nome).
describe("ProductGrid — marca no card", () => {
  function porTestID(t: renderer.ReactTestRenderer, id: string) {
    return t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
  }
  const DRYKO: GridProduct = { id: "m1", name: "MANTA ALUMINIZADA 10CM", price: 39.9, stock: 16, unit: "rolo", brand: "Dryko" };
  const DENVER: GridProduct = { id: "m2", name: "MANTA ALUMINIZADA 10CM", price: 42.5, stock: 8, unit: "rolo", brand: "Denver" };
  const SEM: GridProduct = { id: "m3", name: "MANTA ALUMINIZADA 10CM", price: 42.5, stock: 8, unit: "rolo", brand: "  " };

  it("mostra a marca de cada um", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<ProductGrid products={[DRYKO, DENVER]} qtyById={{}} onAdd={jest.fn()} />); });
    expect(flattenText(porTestID(t, "grid-marca-m1")[0].children)).toBe("Dryko");
    expect(flattenText(porTestID(t, "grid-marca-m2")[0].children)).toBe("Denver");
    t.unmount();
  });

  it("sem marca (vazia ou só espaço): nenhuma linha a mais", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<ProductGrid products={[SEM, { ...SEM, id: "m4", brand: undefined }]} qtyById={{}} onAdd={jest.fn()} />); });
    expect(porTestID(t, "grid-marca-m3")).toHaveLength(0);
    expect(porTestID(t, "grid-marca-m4")).toHaveLength(0);
    t.unmount();
  });
});
