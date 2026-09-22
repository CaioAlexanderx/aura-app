// ============================================================
// SecaoPreco — "Como você vende" do perfil Matcon (22/09/2026,
// docs/mockups/matcon-cadastro-produto.html, pontos ③ e ④).
//
//   - sem perfil: "Preço" de hoje, sem unidade e sem compra;
//   - perfil Matcon: "Vendo por" (un + matcon_units; o resto em
//     "+ outras") ANTES do preço, preço e custo "por m²", e "Como chega do
//     fornecedor" sempre à vista — inclusive em un/pç (decisão do Caio:
//     caixa com 100 parafusos);
//   - "Compro por cx de 2,32 m²" mostra o preço da caixa.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoPreco } from "@/components/screens/estoque/item-form/SecaoPreco";
import { PERFIL_MATCON } from "@/components/screens/estoque/item-form/perfis";

function Harness({ matcon, unidadeInicial = "un" }: { matcon?: boolean; unidadeInicial?: string }) {
  const [preco, setPreco] = useState("54,90");
  const [custo, setCusto] = useState("31,20");
  const [unidade, setUnidade] = useState(unidadeInicial);
  const [purchaseUnit, setPurchaseUnit] = useState<string | null>(null);
  const [purchaseFactor, setPurchaseFactor] = useState("");
  return (
    <SecaoPreco
      type="product"
      narrow={false}
      preco={preco} onPreco={setPreco}
      custo={custo} onCusto={setCusto}
      duracao="" onDuracao={() => {}}
      onSubmit={() => {}}
      perfil={matcon ? PERFIL_MATCON : undefined}
      unidade={unidade} onUnidade={setUnidade}
      unidadesDaLoja={["m²", "m³", "sc"]}
      purchaseUnit={purchaseUnit} onPurchaseUnit={setPurchaseUnit}
      purchaseFactor={purchaseFactor} onPurchaseFactor={setPurchaseFactor}
    />
  );
}

function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}

function porLabel(tree: any, label: string): any {
  return tree.root.findAllByProps({ accessibilityLabel: label })[0];
}

describe("SecaoPreco — sem perfil", () => {
  test("'Preço' de hoje: sem 'Vendo por' e sem 'Como chega do fornecedor'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness />); });
    const t = texto(tree);
    expect(t).toContain("Preço de venda");
    expect(t).toContain("por \",\"un.");
    expect(t).not.toContain("Vendo por");
    expect(t).not.toContain("Como chega do fornecedor");
    expect(t).not.toContain("Compro por");
    tree.unmount();
  });
});

describe("SecaoPreco — perfil Matcon: 'Como você vende'", () => {
  test("'Vendo por' vem antes do preço; un + unidades da loja; resto em '+ outras'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon />); });
    const t = texto(tree);
    expect(t).toContain("Como você vende");
    expect(t.indexOf("Vendo por")).toBeGreaterThan(-1);
    expect(t.indexOf("Vendo por")).toBeLessThan(t.indexOf("Preço de venda"));
    ["un", "m²", "m³", "sc"].forEach((u) => expect(porLabel(tree, u)).toBeTruthy());
    // kg e rolo não estão na config: só aparecem depois de "+ outras".
    expect(porLabel(tree, "kg")).toBeUndefined();
    act(() => { porLabel(tree, "+ outras").props.onPress(); });
    expect(porLabel(tree, "kg")).toBeTruthy();
    expect(porLabel(tree, "rolo")).toBeTruthy();
    tree.unmount();
  });

  test("preço e custo dizem 'por m²' depois de escolher m²", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon />); });
    act(() => { porLabel(tree, "m²").props.onPress(); });
    const t = texto(tree);
    expect(t).toContain("por m²");
    expect(t).toContain("compro e vendo em m²");
    tree.unmount();
  });

  test("'Compro por' também em un (caixa com 100 parafusos)", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidadeInicial="un" />); });
    expect(texto(tree)).toContain("Nada a converter");
    expect(texto(tree)).not.toContain("Compro por");
    act(() => { porLabel(tree, "Em caixa, saco ou fardo").props.onPress(); });
    expect(texto(tree)).toContain("Compro por");
    act(() => { porLabel(tree, "Quanto vem em 1 cx, em un").props.onChangeText("100"); });
    expect(texto(tree)).toContain("10 cx → 1.000 un");
    tree.unmount();
  });

  test("'Compro por cx de 2,32 m²' calcula o preço da caixa; 'Do mesmo jeito' limpa", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidadeInicial="m²" />); });
    act(() => { porLabel(tree, "Em caixa, saco ou fardo").props.onPress(); });
    act(() => { porLabel(tree, "Quanto vem em 1 cx, em m²").props.onChangeText("2,32"); });
    const t = texto(tree);
    expect(t).toMatch(/A caixa sai a R\$\s?72,38 de custo e R\$\s?127,37 na venda\./);
    expect(t).toContain("10 cx → 23,2 m²");

    act(() => { porLabel(tree, "Do mesmo jeito que vendo").props.onPress(); });
    expect(texto(tree)).not.toContain("Compro por");
    expect(texto(tree)).toContain("Nada a converter");
    tree.unmount();
  });
});
