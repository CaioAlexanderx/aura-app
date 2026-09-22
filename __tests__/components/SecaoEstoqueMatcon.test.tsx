// ============================================================
// SecaoEstoque — contrato de zero impacto e o perfil Matcon.
//
// 22/09/2026 (Matcon M0): o grupo "Materiais" e a frase "Compro por"
// nasceram aqui. No mesmo dia, o cadastro por perfil
// (docs/mockups/matcon-cadastro-produto.html) levou a unidade e a compra
// para o card "Como você vende" (SecaoPreco — ver SecaoPrecoMatcon.test)
// e deixou no Estoque só o controle:
//
//   - sem perfil (loja sem Matcon): os 9 chips de UNITS, "Quantidade
//     única / Por cor e tamanho" e as duas caixas de hoje. Nada de lote,
//     nada de "Compro por";
//   - perfil Matcon: sem chips de unidade, a frase "Tenho … em estoque",
//     vírgula só em unidade fracionada, e a unidade decide a 2ª opção:
//     lote (m²/m³ com lote ligado) OU "Por cor e medida" — nunca as duas;
//   - lote desligado: a opção nem aparece (nada desabilitado).
//
// Padrão de mocks/renderização: __tests__/components/CustomerRowBotoes.test.tsx.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoEstoque } from "@/components/screens/estoque/item-form/SecaoEstoque";
import { PERFIL_MATCON } from "@/components/screens/estoque/item-form/perfis";
import { novaLinhaDeLote, type LinhaDeLote, type StockMode } from "@/components/screens/estoque/item-form/types";
import { UNITS } from "@/components/screens/estoque/types";

type HarnessProps = {
  matcon?: boolean;
  unidade?: string;
  lotesDisponiveis?: boolean;
  modo?: StockMode;
  lotesIniciais?: LinhaDeLote[];
  purchaseFactor?: string;
  estoqueInicial?: string;
};

// SecaoEstoque é controlada por props; o Harness faz o papel do modal.
function Harness(h: HarnessProps) {
  const [unidade, setUnidade] = useState(h.unidade || "un");
  const [stockMode, setStockMode] = useState<StockMode>(h.modo || "single");
  const [estoque, setEstoque] = useState(h.estoqueInicial || "");
  const [minimo, setMinimo] = useState("");
  const [lotes, setLotes] = useState<LinhaDeLote[]>(h.lotesIniciais || []);
  return (
    <SecaoEstoque
      narrow={false}
      modoEdicao={false}
      unidade={unidade}
      onUnidade={setUnidade}
      stockMode={stockMode}
      onStockMode={(v) => { if (v === "lots" && lotes.length === 0) setLotes([novaLinhaDeLote()]); setStockMode(v); }}
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
      perfil={h.matcon ? PERFIL_MATCON : undefined}
      purchaseUnit={null}
      purchaseFactor={h.purchaseFactor}
      lotesDisponiveis={h.lotesDisponiveis}
      lotes={lotes}
      onLotes={setLotes}
    />
  );
}

function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}

function porLabel(tree: any, label: string): any {
  return tree.root.findAllByProps({ accessibilityLabel: label })[0];
}

describe("SecaoEstoque — sem perfil (loja sem Matcon): a seção de hoje", () => {
  it("9 chips de UNITS, 'Por cor e tamanho', sem lote nem 'Compro por'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness />); });

    UNITS.forEach((u) => expect(porLabel(tree, u)).toBeTruthy());
    const t = texto(tree);
    expect(t).toContain("Unidade de venda");
    expect(t).toContain("Por cor e tamanho");
    expect(t).toContain("Quantidade atual");
    expect(t).not.toContain("Materiais");
    expect(t).not.toContain("Compro por");
    expect(t).not.toContain("lote");
    expect(t).not.toContain("medida");
    expect(t).not.toContain("Tenho");

    tree.unmount();
  });

  it("lotesDisponiveis sem o perfil não muda nada", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness unidade="m²" lotesDisponiveis />); });
    expect(texto(tree)).not.toContain("Por lote e tonalidade");
    tree.unmount();
  });
});

describe("SecaoEstoque — perfil Matcon", () => {
  it("sem chips de unidade (moraram no 'Vendo por') e com a frase 'Tenho … em estoque'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidade="sc" />); });

    const t = texto(tree);
    expect(t).not.toContain("Unidade de venda");
    expect(t).toContain("Tenho");
    expect(t).toContain("sc em estoque");
    expect(t).toContain("Por cor e medida");
    expect(t).not.toContain("Por lote e tonalidade");

    tree.unmount();
  });

  it("saco é inteiro: o campo não aceita vírgula; m² aceita", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidade="sc" />); });
    act(() => { porLabel(tree, "Quanto tenho em estoque").props.onChangeText("12,5"); });
    expect(porLabel(tree, "Quanto tenho em estoque").props.value).toBe("125");
    tree.unmount();

    act(() => { tree = renderer.create(<Harness matcon unidade="m²" />); });
    act(() => { porLabel(tree, "Quanto tenho em estoque").props.onChangeText("12,5"); });
    expect(porLabel(tree, "Quanto tenho em estoque").props.value).toBe("12,5");
    tree.unmount();
  });

  it("'(≈ 64 caixas)' ao lado do estoque com a frase 'Compro por'", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<Harness matcon unidade="m²" purchaseFactor="2,32" estoqueInicial="148,48" />);
    });
    expect(texto(tree)).toContain("(≈ 64 caixas)");
    tree.unmount();
  });

  it("m² com lote ligado: 'Por lote e tonalidade' no lugar de 'Por cor e medida'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidade="m²" lotesDisponiveis />); });

    const t = texto(tree);
    expect(t).toContain("Por lote e tonalidade");
    expect(t).not.toContain("Por cor e medida");

    tree.unmount();
  });

  it("lote desligado: a opção nem aparece (nada desabilitado)", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidade="m²" lotesDisponiveis={false} />); });

    const t = texto(tree);
    expect(t).not.toContain("lote");
    expect(t).toContain("Por cor e medida");

    tree.unmount();
  });

  it("por lote: tabela com as pilhas, total e caixas; '+ outro lote na prateleira'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidade="m²" lotesDisponiveis purchaseFactor="2,32" />); });

    act(() => { porLabel(tree, "Por lote e tonalidade").props.onPress(); });
    act(() => { porLabel(tree, "Lote da linha 1").props.onChangeText("27B"); });
    act(() => { porLabel(tree, "Quanto tenho na linha 1").props.onChangeText("95,12"); });
    act(() => { porLabel(tree, "+ outro lote na prateleira").props.onPress(); });
    act(() => { porLabel(tree, "Lote da linha 2").props.onChangeText("28A"); });
    act(() => { porLabel(tree, "Quanto tenho na linha 2").props.onChangeText("53,36"); });

    const t = texto(tree);
    expect(t).toContain("Total 148,48 m² em 2 lotes");
    expect(t).toContain("(= 64 caixas)");
    expect(t).toContain("41 caixas");
    expect(t).toContain("Me avise abaixo de");
    expect(t).toContain("o lote entra sozinho");

    tree.unmount();
  });

  it("'Por cor e medida' abre a grade com 'Medidas' e '+ Medida'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matcon unidade="rolo" />); });
    act(() => { porLabel(tree, "Por cor e medida").props.onPress(); });

    const t = texto(tree);
    expect(t).toContain("Medidas");
    expect(porLabel(tree, "+ Medida")).toBeTruthy();
    expect(t).not.toContain("Tamanhos");

    tree.unmount();
  });
});
