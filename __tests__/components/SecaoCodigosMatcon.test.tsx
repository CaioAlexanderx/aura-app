// ============================================================
// SecaoCodigos / SecaoNotaFiscal — Matcon M2 (22/09/2026,
// docs/CONTRACT_MATCON.md §M2) no cadastro por perfil
// (docs/mockups/matcon-cadastro-produto.html, ponto ⑦).
//
// Sem perfil, "Códigos e fiscal" é IDÊNTICA à de hoje: nenhum texto de
// CEST nem da pergunta do imposto. Com o perfil Matcon o card se divide:
// "Nota fiscal" (as três perguntas numeradas, selo "N de 3") e "Códigos"
// (barras + código interno com exemplo tirado do nome). Zero jargão:
// nunca CSOSN/CST/CFOP/SKU em texto de usuário.
//
// Padrão de mocks/renderização: __tests__/components/CustomerRowBotoes.test.tsx.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";
import { Text, Pressable } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoCodigos, SecaoNotaFiscal } from "@/components/screens/estoque/item-form/SecaoCodigos";
import { PERFIL_MATCON } from "@/components/screens/estoque/item-form/perfis";

function Codigos({ matcon, nome = "Cimento CP-II 50kg" }: { matcon?: boolean; nome?: string }) {
  const [ncm, setNcm] = useState("");
  const [sku, setSku] = useState("");
  return (
    <SecaoCodigos
      type="product"
      emiteNota={false}
      nome={nome}
      preco={30}
      categoriaEscolhida={null}
      material=""
      cores={[]}
      tamanhos={[]}
      sku={sku} onSku={setSku}
      barcode="" onBarcode={() => {}}
      ncm={ncm} onNcm={setNcm}
      perfil={matcon ? PERFIL_MATCON : undefined}
    />
  );
}

function Nota({ ncmInicial = "", emiteNota = false }: { ncmInicial?: string; emiteNota?: boolean }) {
  const [ncm, setNcm] = useState(ncmInicial);
  const [cest, setCest] = useState("");
  const [icmsStPaid, setIcmsStPaid] = useState<boolean | null>(null);
  const [origem, setOrigem] = useState<number | null>(null);
  return (
    <SecaoNotaFiscal
      emiteNota={emiteNota}
      nome="Cimento CP-II 50kg"
      categoriaEscolhida={null}
      material=""
      ncm={ncm} onNcm={setNcm}
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

describe("SecaoCodigos — sem perfil: a seção de hoje", () => {
  test("'Códigos e fiscal' com SKU e NCM; nenhum texto de CEST nem de imposto", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Codigos />); });

    const t = texto(tree);
    expect(t).toContain("Códigos e fiscal");
    expect(t).toContain("Código interno (SKU)");
    expect(t).toContain("VES-001");
    expect(t).not.toContain("CEST");
    expect(t).not.toContain("imposto");
    expect(t).not.toContain("Fabricado no Brasil");

    tree.unmount();
  });
});

describe("SecaoCodigos — perfil Matcon: 'Códigos' num card próprio", () => {
  test("barras e código interno, sem SKU e sem NCM; exemplo nasce do nome", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Codigos matcon nome="Porcelanato Bianco 60x60" />); });

    const t = texto(tree);
    expect(t).toContain("Códigos");
    expect(t).not.toContain("Códigos e fiscal");
    expect(t).toContain("Código interno");
    expect(t).toContain("o seu código de prateleira");
    expect(t).toContain("POR-001");
    expect(t).not.toContain("SKU");
    expect(t).not.toContain("NCM");
    expect(t).not.toContain("VES-001");

    tree.unmount();
  });
});

describe("SecaoNotaFiscal — as três perguntas", () => {
  test("três perguntas numeradas, 'Fabricado no Brasil?' e selo '0 de 3'", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Nota />); });

    const t = texto(tree);
    expect(t).toContain("Nota fiscal");
    expect(t).toContain("Código do produto na nota (NCM)");
    expect(t).toContain("Código do imposto antecipado (CEST)");
    expect(t).toContain("O imposto deste produto já veio pago na nota do fornecedor?");
    expect(t).toContain("Fabricado no Brasil?");
    // 23/09/2026: resposta coerente com a pergunta ("Importado" sozinho não
    // respondia "Fabricado no Brasil?").
    expect(t).toContain("Não, importado");
    expect(t).toContain("0 de 3");
    expect(porLabel(tree, "Sim, já veio")).toBeTruthy();
    expect(porLabel(tree, "Não")).toBeTruthy();

    tree.unmount();
  });

  test("zero jargão: nunca CSOSN/CFOP/substituição tributária", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Nota emiteNota />); });

    const t = texto(tree).toUpperCase();
    expect(t).not.toContain("CSOSN");
    expect(t).not.toContain("CFOP");
    expect(t).not.toContain("SUBSTITUIÇÃO TRIBUTÁRIA");
    expect(t).not.toContain("SKU");

    tree.unmount();
  });

  test('"Sugerir" do CEST com NCM de cimento preenche 0500100 e o selo sobe', () => {
    let tree: any;
    act(() => { tree = renderer.create(<Nota ncmInicial="25232910" />); });
    expect(texto(tree)).toContain("1 de 3");

    // O NCM ("Cimento" não sugere pelo nome) fica desabilitado; o do CEST é
    // o último "Sugerir" habilitado. (23/09/2026: "Gerar" virou "Sugerir" —
    // o botão sugere um código, não inventa um.)
    const botoesGerar = tree.root.findAllByType(Pressable).filter((n: any) => {
      if (n.props.disabled) return false;
      const textos = n.findAllByType(Text).map((t: any) => t.props.children);
      return textos.includes("Sugerir");
    });
    expect(botoesGerar.length).toBeGreaterThan(0);
    act(() => { botoesGerar[botoesGerar.length - 1].props.onPress(); });

    expect(texto(tree)).toContain("0500100");
    expect(texto(tree)).toContain("2 de 3");

    act(() => { porLabel(tree, "Sim, já veio").props.onPress(); });
    expect(texto(tree)).toContain("3 de 3 ✓");

    tree.unmount();
  });

  test("sugestão 'já veio pago' aparece para NCM de cimento sem resposta", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Nota ncmInicial="25232910" />); });
    expect(texto(tree)).toContain("sugerimos");
    tree.unmount();
  });

  test("quem emite nota vê o aviso das três respostas", () => {
    let tree: any;
    act(() => { tree = renderer.create(<Nota emiteNota />); });
    expect(texto(tree)).toContain("Sem estas três respostas");
    tree.unmount();
  });
});
