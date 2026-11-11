// ============================================================
// Cadastro de item › "Códigos e fiscal" › complemento fiscal (11/11/2026)
//
// A auditoria das NFC-e mostrou todo item saindo como imposto normal,
// sem CEST e como nacional: fora do perfil Matcon não havia onde dizer.
// O que estes testes seguram:
//  1. quem emite nota vê a pergunta do imposto e a origem; quem não emite
//     e não tem nada preenchido não vê (cadastro limpo);
//  2. o CEST só aparece com "Sim" (ou já preenchido) e avisa que falta;
//  3. tocar nas opções devolve os valores que o motor da nota usa
//     (icms_st_paid true/false, origem 0/2/1), e tocar de novo desmarca;
//  4. sem os callbacks (perfil Matcon usa a SecaoNotaFiscal) nada aparece.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/BarcodeQRSection", () => ({ BarcodeQRSection: "BarcodeQRSection" }));

import { SecaoCodigos, mostrarComplementoFiscal, faltaCest, ORIGENS } from "@/components/screens/estoque/item-form/SecaoCodigos";

function montar(extra: Record<string, any> = {}) {
  const fns = { onCest: jest.fn(), onIcmsStPaid: jest.fn(), onOrigem: jest.fn() };
  const noop = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SecaoCodigos
        type="product" emiteNota nome="Biscoito" preco={5}
        categoriaEscolhida={null} material="" cores={[]} tamanhos={[]}
        sku="" onSku={noop} barcode="" onBarcode={noop}
        ncm="19053100" onNcm={noop}
        cest="" icmsStPaid={null} origem={null}
        {...fns}
        {...extra}
      />
    );
  });
  return { tree, fns };
}

// Todo o texto renderizado, numa string só (os pedaços de um <Text> vêm
// como filhos separados no JSON; juntamos sem separador).
function textos(tree: renderer.ReactTestRenderer): string {
  const out: string[] = [];
  const andar = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(andar); return; }
    andar(n.children);
  };
  andar(tree.toJSON());
  return out.join("");
}
const botao = (tree: renderer.ReactTestRenderer, rotulo: string) =>
  tree.root.find((n: any) => n.props && n.props.accessibilityLabel === rotulo && typeof n.props.onPress === "function");

describe("complemento fiscal do cadastro padrão", () => {
  test("quem emite nota vê a pergunta do imposto e a origem; sem 'Sim' não há CEST", () => {
    const { tree } = montar();
    const t = textos(tree);
    expect(t).toContain("já veio pago pelo fornecedor?");
    expect(t).toContain("Origem do produto");
    expect(t).not.toContain("Código do imposto antecipado (CEST)");
  });

  test("quem não emite e não preencheu nada não vê o complemento", () => {
    const { tree } = montar({ emiteNota: false });
    expect(tree.root.findAll((n: any) => n.props && n.props.testID === "complemento-fiscal")).toHaveLength(0);
  });

  test("item que já tem resposta mostra mesmo sem emitir nota", () => {
    const { tree } = montar({ emiteNota: false, origem: 2 });
    expect(tree.root.findAll((n: any) => n.props && n.props.testID === "complemento-fiscal").length).toBeGreaterThan(0);
  });

  test("com 'Sim' aparece o CEST e o aviso de que falta", () => {
    const { tree } = montar({ icmsStPaid: true });
    const t = textos(tree);
    expect(t).toContain("Código do imposto antecipado (CEST)");
    expect(t).toContain("Sem ele a nota deste produto pode ser recusada");
  });

  test("tocar nas opções devolve o que o motor usa; tocar de novo desmarca", () => {
    const { tree, fns } = montar();
    act(() => { botao(tree, "Sim, o imposto já veio pago").props.onPress(); });
    expect(fns.onIcmsStPaid).toHaveBeenLastCalledWith(true);
    act(() => { botao(tree, "Não, o imposto não veio pago").props.onPress(); });
    expect(fns.onIcmsStPaid).toHaveBeenLastCalledWith(false);
    act(() => { botao(tree, "Importado, comprei no Brasil").props.onPress(); });
    expect(fns.onOrigem).toHaveBeenLastCalledWith(2);

    const marcado = montar({ icmsStPaid: true });
    act(() => { botao(marcado.tree, "Sim, o imposto já veio pago").props.onPress(); });
    expect(marcado.fns.onIcmsStPaid).toHaveBeenLastCalledWith(null);
  });

  test("origem fora da lista aparece como 'Outra (código N)'", () => {
    const { tree } = montar({ origem: 5 });
    expect(textos(tree)).toContain("Outra (código 5)");
  });
});

describe("regras puras", () => {
  test("mostrarComplementoFiscal exige os três callbacks", () => {
    expect(mostrarComplementoFiscal({ emiteNota: true })).toBe(false);
    const cb = { onCest: () => {}, onIcmsStPaid: () => {}, onOrigem: () => {} };
    expect(mostrarComplementoFiscal({ emiteNota: true, ...cb })).toBe(true);
    expect(mostrarComplementoFiscal({ emiteNota: false, ...cb })).toBe(false);
    expect(mostrarComplementoFiscal({ emiteNota: false, cest: "1705300", ...cb })).toBe(true);
    expect(mostrarComplementoFiscal({ emiteNota: false, icmsStPaid: false, ...cb })).toBe(true);
  });

  test("faltaCest só com 'Sim' e CEST incompleto", () => {
    expect(faltaCest(true, "")).toBe(true);
    expect(faltaCest(true, "17053")).toBe(true);
    expect(faltaCest(true, "1705300")).toBe(false);
    expect(faltaCest(false, "")).toBe(false);
    expect(faltaCest(null, "")).toBe(false);
  });

  test("origens: nacional 0, importado no Brasil 2, importado direto 1", () => {
    expect(ORIGENS.map((o) => o.codigo)).toEqual([0, 2, 1]);
  });
});
