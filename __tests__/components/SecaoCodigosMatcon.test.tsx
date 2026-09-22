// ============================================================
// SecaoCodigos — contrato de zero impacto do Matcon M2 (22/09/2026,
// docs/CONTRACT_MATCON.md §M2).
//
// Sem matconOn a seção é IDÊNTICA à de hoje: nenhum texto de código
// fiscal (CEST) nem da pergunta do imposto aparece. Com matconOn, a
// pergunta e o campo CEST entram no mesmo desenho do NCM (selo, botão
// Gerar, frase de sugestão) — regra 7 do CLAUDE.md (zero jargão: nunca
// CSOSN/CST/ST/CFOP em texto de usuário).
//
// Padrão de mocks/renderização: __tests__/components/CustomerRowBotoes.test.tsx
// (mesmo do SecaoEstoqueMatcon.test.tsx, que cobre a seção irmã).
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";
import { Text, Pressable } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoCodigos } from "@/components/screens/estoque/item-form/SecaoCodigos";

function Harness({ matconOn, ncmInicial = "" }: { matconOn?: boolean; ncmInicial?: string }) {
  const [ncm, setNcm] = useState(ncmInicial);
  const [cest, setCest] = useState("");
  const [icmsStPaid, setIcmsStPaid] = useState<boolean | null>(null);
  const [origem, setOrigem] = useState<number | null>(null);
  return (
    <SecaoCodigos
      type="product"
      emiteNota={false}
      nome="Cimento CP-II 50kg"
      preco={30}
      categoriaEscolhida={null}
      material=""
      cores={[]}
      tamanhos={[]}
      sku="" onSku={() => {}}
      barcode="" onBarcode={() => {}}
      ncm={ncm} onNcm={setNcm}
      matconOn={matconOn}
      cest={cest} onCest={setCest}
      icmsStPaid={icmsStPaid} onIcmsStPaid={setIcmsStPaid}
      origem={origem} onOrigem={setOrigem}
    />
  );
}

function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}

function porLabel(tree: any, label: string): any {
  return tree.root.findAllByProps({ accessibilityLabel: label })[0];
}

describe("SecaoCodigos — Matcon M2: contrato de zero impacto", () => {
  test("sem matconOn: nenhum texto de código fiscal nem de imposto", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness />); });

    const t = texto(tree);
    expect(t).not.toContain("código fiscal");
    expect(t).not.toContain("imposto");
    expect(t).not.toContain("Fabricado no Brasil");

    tree.unmount();
  });

  test("matconOn=false explícito tem o mesmo resultado", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matconOn={false} />); });

    const t = texto(tree);
    expect(t).not.toContain("código fiscal");
    expect(t).not.toContain("imposto");

    tree.unmount();
  });

  test("com matconOn: mostra a pergunta e o campo CEST", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matconOn />); });

    const t = texto(tree);
    expect(t).toContain("Código fiscal do produto (CEST)");
    expect(t).toContain("O imposto deste produto já veio recolhido na nota do fornecedor?");
    expect(t).toContain("Fabricado no Brasil?");
    expect(porLabel(tree, "Sim, já veio")).toBeTruthy();
    expect(porLabel(tree, "Não")).toBeTruthy();

    tree.unmount();
  });

  test("zero jargão: nunca CSOSN/CST/ST/CFOP em texto de usuário", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matconOn />); });

    const t = texto(tree).toUpperCase();
    expect(t).not.toContain("CSOSN");
    expect(t).not.toContain("CFOP");
    expect(t).not.toContain("SUBSTITUIÇÃO TRIBUTÁRIA");

    tree.unmount();
  });

  test('"Gerar" do CEST com NCM 2523.29.10 (cimento) chama onCest("0500100")', () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matconOn ncmInicial="25232910" />); });

    // Vários botões "Gerar" na tela (SKU, código de barras, NCM, CEST).
    // O do NCM fica desabilitado ("Cimento" não sugere nada pelo nome —
    // suggestNcm é o dicionário de roupas); o do CEST é o ÚLTIMO habilitado,
    // porque suggestCest("25232910") acha a família cimento.
    const botoesGerar = tree.root.findAllByType(Pressable).filter((n: any) => {
      if (n.props.disabled) return false;
      const textos = n.findAllByType(Text).map((t: any) => t.props.children);
      return textos.includes("Gerar");
    });
    expect(botoesGerar.length).toBeGreaterThan(0);

    const botaoCest = botoesGerar[botoesGerar.length - 1];
    act(() => { botaoCest.props.onPress(); });

    expect(tree.toJSON()).toBeTruthy();
    expect(texto(tree)).toContain("0500100");

    tree.unmount();
  });

  test("sugestão de imposto recolhido aparece pra NCM de cimento sem resposta ainda", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Harness matconOn ncmInicial="25232910" />); });

    expect(texto(tree)).toContain("sugerimos");

    tree.unmount();
  });
});
