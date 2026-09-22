// ============================================================
// Matcon M0 (22/09/2026) — contrato de zero impacto em SecaoEstoque.
//
// Toggle off: renderiza exatamente os 9 chips de UNITS de hoje, sem o
// grupo "Materiais" e sem a frase "Compro por" (docs/matcon-faseamento-
// po-ux.md §1 e §3, regra 3 do CLAUDE.md).
// Toggle on: o grupo "Materiais" mostra as unidades habilitadas na
// config (matcon_units, na ordem dela) + o chip "+ …" com o resto de
// MATCON_UNITS; escolher uma unidade de material revela a frase "Compro
// por" (a conversão de compra só faz sentido pra unidade de material).
//
// Padrão de mocks/renderização: __tests__/components/CustomerRowBotoes.test.tsx.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoEstoque } from "@/components/screens/estoque/item-form/SecaoEstoque";
import { UNITS } from "@/components/screens/estoque/types";

// Wrapper controlado: SecaoEstoque é 100% controlado por props, então o
// teste precisa de um dono de estado pra simular a lojista clicando num
// chip (igual ao ItemFormModal faria).
function Harness({ matconEnabled, matconUnits }: { matconEnabled?: boolean; matconUnits?: string[] }) {
  const [unidade, setUnidade] = useState("un");
  const [estoque, setEstoque] = useState("");
  const [minimo, setMinimo] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState<string | null>(null);
  const [purchaseFactor, setPurchaseFactor] = useState("");
  return (
    <SecaoEstoque
      narrow={false}
      modoEdicao={false}
      unidade={unidade}
      onUnidade={setUnidade}
      stockMode="single"
      onStockMode={() => {}}
      estoque={estoque}
      onEstoque={setEstoque}
      minimo={minimo}
      onMinimo={setMinimo}
      cores={[]}
      onCores={() => {}}
      tamanhos={[]}
      onTamanhos={() => {}}
      celulas={{}}
      onCelula={() => {}}
      barras={{}}
      onBarra={() => {}}
      onSubmit={() => {}}
      matconEnabled={matconEnabled}
      matconUnits={matconUnits}
      purchaseUnit={purchaseUnit}
      onPurchaseUnit={setPurchaseUnit}
      purchaseFactor={purchaseFactor}
      onPurchaseFactor={setPurchaseFactor}
    />
  );
}

function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}

function chip(tree: any, label: string): any {
  return tree.root.findAllByProps({ accessibilityLabel: label })[0];
}

describe("SecaoEstoque — Matcon M0: contrato de zero impacto", () => {
  it("toggle off: só os 9 chips de UNITS, sem grupo Materiais nem frase Compro por", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness />); });

    UNITS.forEach((u) => expect(chip(tree, u)).toBeTruthy());
    expect(texto(tree)).not.toContain("Materiais");
    expect(texto(tree)).not.toContain("Compro por");

    tree.unmount();
  });

  it("toggle off explícito (matconEnabled=false) tem o mesmo resultado", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matconEnabled={false} />); });

    expect(texto(tree)).not.toContain("Materiais");
    expect(texto(tree)).not.toContain("Compro por");

    tree.unmount();
  });

  it("toggle on: grupo Materiais mostra m² e sc (matcon_units) + chip '+'; ainda sem 'Compro por'", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<Harness matconEnabled matconUnits={["m²", "sc"]} />);
    });

    expect(texto(tree)).toContain("Materiais");
    expect(chip(tree, "m²")).toBeTruthy();
    expect(chip(tree, "sc")).toBeTruthy();

    const chipMais = tree.root.findAll(
      (node: any) => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.indexOf("+ ") === 0
    );
    expect(chipMais.length).toBeGreaterThan(0);

    // Unidade inicial é "un": a frase de conversão ainda não aparece.
    expect(texto(tree)).not.toContain("Compro por");

    tree.unmount();
  });

  it("toggle on: escolher m² no grupo Materiais mostra a frase 'Compro por'", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<Harness matconEnabled matconUnits={["m²", "sc"]} />);
    });

    act(() => { chip(tree, "m²").props.onPress(); });

    expect(texto(tree)).toContain("Compro por");

    tree.unmount();
  });
});
