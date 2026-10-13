// ============================================================
// Gestão Aura › Hoje (13/10/2026)
//
// Tela única de blocos: três seções, um card expandido por vez, alerta que
// expande o bloco dele (ou abre a ficha da loja), catálogo que liga e
// desliga blocos. Dados estáticos de 13/10 via usePainelHoje.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Line: stub("Line"), Text: stub("SvgText"),
  };
});
// O Modal do react-native-web usa portal, que o test renderer não monta.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return Object.setPrototypeOf({ Modal: ({ visible, children }: any) => (visible ? children : null) }, RN);
});

import { PainelHoje } from "@/components/admin/painel/PainelHoje";
import { DEFINICOES } from "@/components/admin/painel/blocos";
import { PAINEL_HOJE } from "@/components/admin/painel/dadosEstaticos";
import { toast } from "@/components/Toast";

// A grade se mede pelo onLayout da própria tela.
async function medir(tree: renderer.ReactTestRenderer, width: number) {
  await act(async () => {
    tree.root.findAllByProps({ testID: "painel-hoje" }, { deep: false })[0].props.onLayout({ nativeEvent: { layout: { width } } });
  });
}

async function mount(width = 1200) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje /></QueryClientProvider>);
  });
  await act(async () => { await Promise.resolve(); });
  await medir(tree!, width);
  return tree!;
}

// testID no nível do componente (deep:false), como os outros testes de tela.
const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const idsStartingWith = (tree: renderer.ReactTestRenderer, prefix: string) =>
  tree.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith(prefix) && typeof n.type !== "string")
    .map((n) => n.props.testID as string)
    .filter((v, i, a) => a.indexOf(v) === i);
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
const estilo = (tree: renderer.ReactTestRenderer, id: string) =>
  Object.assign({}, ...[byTestId(tree, id)[0].props.style].flat(Infinity as 1).filter(Boolean));

async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { byTestId(tree, id)[0].props.onPress(); });
  await act(async () => { await Promise.resolve(); });
}

describe("Gestão Aura › Hoje", () => {
  it("renderiza cabeçalho, faixa, alertas e as três seções com os blocos do dia", async () => {
    const tree = await mount();
    for (const sec of ["negocio", "produto", "operacao"]) expect(byTestId(tree, "painel-secao-" + sec)).toHaveLength(1);

    const out = text(tree);
    expect(out).toContain("Terça, 13 de outubro");
    expect(out).toContain("06:00");
    expect(out).toContain("12:00");
    for (const t of ["Negócio", "Produto e uso", "Operação", "MRR real · Asaas", "Sheid Mania vence amanhã", "Trials por degrau"]) {
      expect(out).toContain(t);
    }
    expect(idsStartingWith(tree, "destaque-")).toHaveLength(4);
    expect(idsStartingWith(tree, "alerta-")).toHaveLength(3);
    // Um card por bloco calculado, nenhum detalhe aberto.
    for (const b of PAINEL_HOJE.blocos) expect(byTestId(tree, "bloco-" + b.id)).toHaveLength(1);
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual([]);
    tree.unmount();
  });

  it("todo bloco calculado tem definição de apresentação", () => {
    const ids = DEFINICOES.map((d) => d.id);
    for (const b of PAINEL_HOJE.blocos) expect(ids).toContain(b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("expandir um card mostra o detalhe, ocupa a largura toda e recolhe o anterior", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-trials_degrau");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-trials_degrau"]);
    expect(text(tree)).toContain("Infortech Group");
    expect(text(tree)).toContain("Oferecer plano");

    await press(tree, "bloco-expandir-pagantes");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-pagantes"]);
    expect(text(tree)).toContain("Jenniffer Rocha");
    expect(text(tree)).not.toContain("Infortech Group");
    expect(estilo(tree, "bloco-pagantes").width).toBe("100%");
    expect(estilo(tree, "bloco-cadastros").width).not.toBe("100%");

    // O mesmo botão recolhe.
    await press(tree, "bloco-expandir-pagantes");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual([]);
    expect(estilo(tree, "bloco-pagantes").width).not.toBe("100%");
    tree.unmount();
  });

  it("grade de 12 colunas: 4 e 6 no desktop, 2 por linha no tablet, coluna única no celular", async () => {
    const tree = await mount(1200);
    // (1200 - 2 vãos de 12) / 3 e (1200 - 12) / 2
    expect(estilo(tree, "bloco-cadastros").width).toBe(392);
    expect(estilo(tree, "bloco-receita").width).toBe(594);
    await medir(tree, 800);
    expect(estilo(tree, "bloco-cadastros").width).toBe(394);
    expect(estilo(tree, "bloco-receita").width).toBe(394);
    await medir(tree, 343);   // 375 px menos as margens
    for (const b of PAINEL_HOJE.blocos) expect(estilo(tree, "bloco-" + b.id).width).toBe("100%");
    for (const d of PAINEL_HOJE.destaques!) expect(estilo(tree, "destaque-" + d.id).width).toBe("100%");
    for (const i of [0, 1, 2]) expect(estilo(tree, "alerta-" + i).width).toBe("100%");
    tree.unmount();
  });

  it("clicar num alerta expande o bloco dele; alerta de loja abre a ficha", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-cadastros");
    await press(tree, "alerta-1");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-trials_degrau"]);
    await press(tree, "alerta-2");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-receita"]);
    expect(text(tree)).toContain("Conciliação com o banco");

    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    expect(text(tree)).toContain("Sheid Mania Personalizados");
    expect(text(tree)).toContain("Módulos que usa");
    await press(tree, "ficha-modal-fechar");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);
    // A ficha não mexe no card aberto.
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-receita"]);
    tree.unmount();
  });

  it("nome de loja numa lista abre a ficha", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-pagantes");
    await press(tree, "loja-sheid-mania");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    tree.unmount();
  });

  it("o catálogo abre, fecha e liga ou desliga blocos ao salvar", async () => {
    const tree = await mount();
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(0);
    await press(tree, "painel-abrir-catalogo");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(1);
    expect(text(tree)).toContain("Catálogo de blocos");
    expect(byTestId(tree, "catalogo-item-nps")[0].props.disabled).toBe(true);

    // Cancelar descarta o que foi marcado.
    await press(tree, "catalogo-item-fiscal");
    await press(tree, "catalogo-cancelar");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(0);
    expect(byTestId(tree, "bloco-fiscal")).toHaveLength(1);

    // Salvar aplica: Fiscal sai, Telas visitadas entra sem cálculo.
    await press(tree, "painel-adicionar-bloco");
    await press(tree, "catalogo-item-fiscal");
    await press(tree, "catalogo-item-telas_visitadas");
    await press(tree, "catalogo-salvar");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(0);
    expect(byTestId(tree, "bloco-fiscal")).toHaveLength(0);
    expect(byTestId(tree, "bloco-telas_visitadas")).toHaveLength(1);
    expect(byTestId(tree, "bloco-sem-dados-telas_visitadas")).toHaveLength(1);
    expect(byTestId(tree, "bloco-expandir-telas_visitadas")).toHaveLength(0);
    tree.unmount();
  });

  it("Reordenar fica desabilitado e Recalcular avisa que os dados são de exemplo", async () => {
    const tree = await mount();
    expect(byTestId(tree, "painel-reordenar")[0].props.disabled).toBe(true);
    await press(tree, "painel-recalcular");
    expect((toast.info as jest.Mock).mock.calls[0][0]).toContain("exemplo");
    tree.unmount();
  });
});
