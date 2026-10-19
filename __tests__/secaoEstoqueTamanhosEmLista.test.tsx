// ============================================================
// Cadastro de item › seção Estoque › tamanhos digitados em lista (p-35).
// "P, M, G" virava um tamanho só e o campo fechava a cada adição. O que
// estes testes seguram: o texto vira vários tamanhos, mesclados e em
// ordem; o campo continua aberto; a dica aparece; o Matcon divide só em
// ";", quebra de linha e "vírgula + espaço".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { SecaoEstoque } from "@/components/screens/estoque/item-form/SecaoEstoque";
import { PERFIL_MATCON } from "@/components/screens/estoque/item-form/perfis";

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
const achar = (tree: renderer.ReactTestRenderer, f: (n: any) => boolean) => tree.root.findAll(f, { deep: false });
const campo = (tree: renderer.ReactTestRenderer) => achar(tree, (n) => n.props.nativeID === "estoque-novo-tamanho")[0];
const dica = (tree: renderer.ReactTestRenderer) => achar(tree, (n) => n.props.testID === "dica-tamanhos")[0];
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node.children || []).map(texto).join("");
}
function abrirCampo(tree: renderer.ReactTestRenderer, rotulo = "+ Tamanho") {
  const botao = achar(tree, (n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === "function")[0];
  act(() => { botao.props.onPress(); });
}
function digitarEnter(tree: renderer.ReactTestRenderer, t: string) {
  act(() => { campo(tree).props.onChangeText(t); });
  act(() => { campo(tree).props.onSubmitEditing(); });
}

describe("SecaoEstoque — tamanhos digitados em lista", () => {
  it("\"P, M, G\" vira três tamanhos e o campo continua aberto e vazio", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos });
    abrirCampo(tree);
    digitarEnter(tree, "P, M, G");
    expect(onTamanhos).toHaveBeenCalledWith(["P", "M", "G"]);
    expect(campo(tree)).toBeTruthy();
    expect(campo(tree).props.value).toBe("");
    expect(campo(tree).props.blurOnSubmit).toBe(false); // Enter não tira o foco
  });

  it("mescla com os que já existem, sem duplicar, e ordena", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos, tamanhos: ["G", "P"] });
    abrirCampo(tree);
    digitarEnter(tree, "gg, p, M");
    expect(onTamanhos).toHaveBeenCalledWith(["P", "M", "G", "gg"]);
  });

  it("numeração sem espaço também divide", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos });
    abrirCampo(tree);
    digitarEnter(tree, "40,36,38");
    expect(onTamanhos).toHaveBeenCalledWith(["36", "38", "40"]);
  });

  it("decimal com unidade fica inteiro", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos });
    abrirCampo(tree);
    digitarEnter(tree, "1,200L");
    expect(onTamanhos).toHaveBeenCalledWith(["1,200L"]);
  });

  it("texto vazio não chama nada", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos });
    abrirCampo(tree);
    digitarEnter(tree, "  ,  ");
    expect(onTamanhos).not.toHaveBeenCalled();
  });

  it("a dica aparece com o campo aberto e some com ele fechado", () => {
    const tree = montar();
    expect(dica(tree)).toBeUndefined();
    abrirCampo(tree);
    expect(texto(dica(tree))).toBe("Separe por vírgula");
    abrirCampo(tree); // o "+ Tamanho" fecha
    expect(dica(tree)).toBeUndefined();
  });

  it("Matcon: só \"vírgula + espaço\" separa, a vírgula decimal fica", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos, perfil: PERFIL_MATCON });
    abrirCampo(tree, "+ Medida");
    expect(texto(dica(tree))).toContain("Separe por vírgula e espaço");
    digitarEnter(tree, "2,5 mm, 1,5 mm");
    expect(onTamanhos).toHaveBeenCalledWith(["1,5 mm", "2,5 mm"]);
  });

  it("o × de cada tamanho tem área de toque de 32 px", () => {
    const tree = montar({ tamanhos: ["P"] });
    const x = achar(tree, (n) => n.props.accessibilityLabel === "Remover P" && typeof n.props.onPress === "function")[0];
    const estilo = Array.isArray(x.props.style) ? Object.assign({}, ...x.props.style) : x.props.style;
    expect(estilo.minWidth).toBeGreaterThanOrEqual(32);
    expect(estilo.minHeight).toBeGreaterThanOrEqual(32);
  });
});

// p-35 (PR C): atalhos de um toque "P M G GG" e "34 a 44".
const atalho = (tree: renderer.ReactTestRenderer, rotulo: string) =>
  achar(tree, (n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === "function")[0];
const PMG = "Adicionar P, M, G e GG";
const NUM = "Adicionar 34, 36, 38, 40, 42 e 44";

describe("SecaoEstoque — atalhos de tamanho", () => {
  it("\"P M G GG\" adiciona os quatro de uma vez, mesclando com os existentes", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos, tamanhos: ["PP", "m"] });
    act(() => { atalho(tree, PMG).props.onPress(); });
    expect(onTamanhos).toHaveBeenCalledWith(["PP", "P", "m", "G", "GG"]);
  });

  it("\"34 a 44\" adiciona 34, 36, 38, 40, 42 e 44", () => {
    const onTamanhos = jest.fn();
    const tree = montar({ onTamanhos, tamanhos: ["38"] });
    act(() => { atalho(tree, NUM).props.onPress(); });
    expect(onTamanhos).toHaveBeenCalledWith(["34", "36", "38", "40", "42", "44"]);
  });

  it("some quando todos os tamanhos do atalho já estão na lista", () => {
    const tree = montar({ tamanhos: ["P", "M", "G", "gg"] });
    expect(atalho(tree, PMG)).toBeUndefined();
    expect(atalho(tree, NUM)).toBeTruthy();
  });

  it("no Matcon os atalhos não aparecem", () => {
    const tree = montar({ perfil: PERFIL_MATCON });
    expect(atalho(tree, PMG)).toBeUndefined();
    expect(atalho(tree, NUM)).toBeUndefined();
  });
});
