// ============================================================
// Cadastro de item › seção Estoque › grade cor × tamanho no celular (p-201)
//
// Em 375 px a tabela cor × tamanho cortava a última coluna. Mockup
// aprovado em 23/11/2026: até 560 px, um cartão por cor (total da cor no
// cabeçalho, tamanhos em grade que quebra linha, total do produto acima);
// acima de 560 px, a tabela de sempre. O que estes testes seguram:
//  1. em 375 px aparecem os cartões, sem a tabela (sem rolagem lateral),
//     com os MESMOS valores das células (matrixKey) e os totais certos;
//  2. digitar num campo do cartão chama onCelula com a mesma chave e o
//     mesmo filtro da tabela;
//  3. com 2 lojas o seletor "Quantidades de qual loja?" continua;
//  4. acima de 560 px a tabela de hoje continua, sem os cartões.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockLargura = 375;
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return new Proxy(rn, {
    get(alvo: any, k: string) {
      if (k === "useWindowDimensions") return () => ({ width: mockLargura, height: 800, scale: 1, fontScale: 1 });
      return alvo[k];
    },
  });
});

import { SecaoEstoque, totalComUnidadeDaGrade } from "@/components/screens/estoque/item-form/SecaoEstoque";
import { usaGradeEmCartoes, LARGURA_GRADE_EM_CARTOES } from "@/components/screens/estoque/item-form/types";
import { matrixKey } from "@/services/productsVariationsApi";

const PRETO = { hex: "#111111", name: "Preto" };
const CREME = { hex: "#F5ECD9", name: "Creme" };
const TAMANHOS = ["34", "36", "38", "40", "42", "44"];
const QTD: Record<string, number[]> = { [PRETO.hex]: [2, 4, 6, 5, 3, 1], [CREME.hex]: [3, 5, 4, 0, 2, 6] };

function celulas(): Record<string, string> {
  const c: Record<string, string> = {};
  [PRETO, CREME].forEach((cor) => TAMANHOS.forEach((z, j) => { c[matrixKey(cor.hex, z)] = String(QTD[cor.hex][j]); }));
  return c;
}

function montar(extra: Record<string, any> = {}) {
  const noop = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SecaoEstoque
        narrow
        modoEdicao
        unidade="par" onUnidade={noop}
        stockMode="variants" onStockMode={noop}
        estoque="" onEstoque={noop}
        minimo="" onMinimo={noop}
        cores={[PRETO, CREME]} onCores={noop}
        tamanhos={TAMANHOS} onTamanhos={noop}
        celulas={celulas()} onCelula={noop}
        barras={{}} onBarra={noop}
        onSubmit={noop}
        {...extra}
      />
    );
  });
  return tree;
}
const porTestID = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props.testID === id, { deep: false });
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node.children || []).map(texto).join("");
}
// Os campos de estoque da matriz (os dois desenhos usam o mesmo rótulo).
function campos(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll(
    (n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Estoque de ") && typeof n.props.onChangeText === "function",
    { deep: false },
  );
}
// A tabela de hoje é a única ScrollView horizontal da seção.
function tabela(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll((n) => n.props.horizontal === true && n.props.contentContainerStyle != null, { deep: false });
}

beforeEach(() => { mockLargura = 375; });

describe("grade cor × tamanho no celular (p-201)", () => {
  it("o corte é em 560 px: até lá cartões, acima tabela; largura desconhecida fica na tabela", () => {
    expect(LARGURA_GRADE_EM_CARTOES).toBe(560);
    expect(usaGradeEmCartoes(320)).toBe(true);
    expect(usaGradeEmCartoes(375)).toBe(true);
    expect(usaGradeEmCartoes(560)).toBe(true);
    expect(usaGradeEmCartoes(561)).toBe(false);
    expect(usaGradeEmCartoes(1280)).toBe(false);
    expect(usaGradeEmCartoes(0)).toBe(false);
  });

  it("em 375 px: um cartão por cor, sem a tabela, com os mesmos valores", () => {
    const tree = montar();
    expect(porTestID(tree, "grade-em-cartoes")).toHaveLength(1);
    expect(tabela(tree)).toHaveLength(0);
    expect(porTestID(tree, "grade-cartao-" + PRETO.hex)).toHaveLength(1);
    expect(porTestID(tree, "grade-cartao-" + CREME.hex)).toHaveLength(1);

    const cs = campos(tree);
    expect(cs).toHaveLength(12);
    [PRETO, CREME].forEach((cor) => TAMANHOS.forEach((z, j) => {
      const c = cs.find((n) => n.props.accessibilityLabel === "Estoque de " + cor.name + " " + z);
      expect(c).toBeTruthy();
      expect(c!.props.value).toBe(String(QTD[cor.hex][j]));
    }));
  });

  it("totais: da cor no cabeçalho e do produto acima da lista, na unidade do produto", () => {
    const tree = montar();
    expect(texto(porTestID(tree, "grade-total-" + PRETO.hex)[0])).toBe("21 pares");
    expect(texto(porTestID(tree, "grade-total-" + CREME.hex)[0])).toBe("20 pares");
    expect(texto(porTestID(tree, "grade-total-do-produto")[0])).toBe("41 pares");
  });

  it("os tamanhos aparecem escritos em cima, na ordem da grade", () => {
    const tree = montar();
    const cartao = porTestID(tree, "grade-cartao-" + PRETO.hex)[0];
    const rotulos = cartao
      .findAll((n) => n.props.numberOfLines === 1 && TAMANHOS.includes(n.props.children), { deep: false })
      .map((n) => n.props.children);
    expect(rotulos).toEqual(TAMANHOS);
  });

  it("digitar no cartão vai para a mesma célula, com o mesmo filtro da tabela", () => {
    const onCelula = jest.fn();
    const tree = montar({ onCelula });
    const c = campos(tree).find((n) => n.props.accessibilityLabel === "Estoque de Creme 40")!;
    act(() => { c.props.onChangeText("1a2"); });
    expect(onCelula).toHaveBeenCalledWith(matrixKey(CREME.hex, "40"), "12");
  });

  it("os campos do cartão têm 44 px de altura (alvo de toque)", () => {
    const tree = montar();
    const c = campos(tree)[0];
    const estilo = [c.props.style].flat(Infinity).filter(Boolean).reduce((a: any, b: any) => ({ ...a, ...b }), {});
    expect(estilo.height).toBe(44);
  });

  it("produto em 'un' fora do Matcon conta peças", () => {
    expect(totalComUnidadeDaGrade(12, "un", false)).toBe("12 peças");
    expect(totalComUnidadeDaGrade(1, "un", false)).toBe("1 peça");
    expect(totalComUnidadeDaGrade(1, "par", false)).toBe("1 par");
    const tree = montar({ unidade: "un" });
    expect(texto(porTestID(tree, "grade-total-do-produto")[0])).toBe("41 peças");
  });

  it("com 2 lojas o seletor 'Quantidades de qual loja?' continua acima dos cartões", () => {
    const tree = montar({
      lojas: {
        linhas: [
          { id: "a", nome: "Matriz", ativa: true, qtd: "" },
          { id: "b", nome: "Loja 2", ativa: false, qtd: "" },
        ],
        onQtd: jest.fn(),
        gradeDe: "a",
        onGradeDe: jest.fn(),
        totais: { a: 41, b: 0 },
      },
    });
    expect(porTestID(tree, "grade-seletor-de-loja")).toHaveLength(1);
    expect(porTestID(tree, "grade-em-cartoes")).toHaveLength(1);
  });

  it("acima de 560 px a tabela de hoje continua, sem os cartões, com os mesmos valores", () => {
    mockLargura = 1280;
    const tree = montar({ narrow: false });
    expect(porTestID(tree, "grade-em-cartoes")).toHaveLength(0);
    expect(tabela(tree)).toHaveLength(1);
    const cs = campos(tree);
    expect(cs).toHaveLength(12);
    const c = cs.find((n) => n.props.accessibilityLabel === "Estoque de Preto 44")!;
    expect(c.props.value).toBe("1");
  });

  it("em 561 px (tablet estreito) também é a tabela", () => {
    mockLargura = 561;
    const tree = montar();
    expect(porTestID(tree, "grade-em-cartoes")).toHaveLength(0);
    expect(tabela(tree)).toHaveLength(1);
  });
});
