// ============================================================
// "Deixar a loja pronta" — o que sobe e o que a tela mostra.
//
// A Finesse tem 143 peças publicadas, 37 sem tamanho e 143 sem marca.
// Mandar a lojista abrir 37 cadastros pra digitar "M" é o mesmo que não
// avisar; esta tela existe pra ela preencher tudo numa lista e salvar
// uma vez.
//
// O QUE ESTES TESTES GUARDAM:
//
// 1. Só sobe o que foi PREENCHIDO. O backend trata string vazia como
//    "limpa a coluna" — mandar o rascunho inteiro apagaria descrição de
//    peça que ela nem tocou.
// 2. "Aplicar em todas" NÃO sobrescreve o que já foi digitado à mão.
//    Não haveria como desfazer.
// 3. Campo de foto não vira campo de texto: foto se resolve por upload.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (n: string) => (p: any) => R.createElement(n, p, p.children);
  return {
    __esModule: true, default: stub("Svg"),
    Svg: stub("Svg"), Path: stub("Path"), Circle: stub("Circle"),
    Rect: stub("Rect"), Ellipse: stub("Ellipse"), G: stub("G"),
    Defs: stub("Defs"), LinearGradient: stub("LinearGradient"), Stop: stub("Stop"),
  };
});
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockSalvar = jest.fn().mockResolvedValue({ atualizados: 2 });
let mockResumo: any = null;
let mockLista: any = { produtos: [] };

jest.mock("@/hooks/usePendenciasDaVitrine", () => ({
  usePendencias: () => ({ data: mockResumo, isLoading: false }),
  useProdutosPendentes: () => ({ data: mockLista, isLoading: false }),
  useSalvarEmLote: () => ({ mutateAsync: mockSalvar, isPending: false }),
  POR_LEVA: 50,
}));

import {
  montarLote, quantasVaoSubir, aplicarEmTodos, ehEditavel, COLUNA_DO_CAMPO, AJUDA,
} from "@/components/screens/canal/loteDaVitrine";
import { DeixarLojaPronta } from "@/components/screens/canal/DeixarLojaPronta";

// ── o que sobe ──────────────────────────────────────────

describe("montarLote — só o que foi preenchido", () => {
  test("campo vazio não sobe", () => {
    // Se subisse, o backend limparia a coluna dessas peças.
    const r = montarLote({ a: "", b: "   ", c: "M" }, "tamanho");
    expect(r).toEqual([{ id: "c", size: "M" }]);
  });

  test("apara o texto antes de mandar", () => {
    expect(montarLote({ a: "  Finesse  " }, "marca")).toEqual([{ id: "a", brand: "Finesse" }]);
  });

  test("usa a coluna certa do backend em cada campo", () => {
    expect(montarLote({ a: "x" }, "descricao")[0]).toHaveProperty("description");
    expect(montarLote({ a: "x" }, "tamanho")[0]).toHaveProperty("size");
    expect(montarLote({ a: "x" }, "marca")[0]).toHaveProperty("brand");
    expect(Object.keys(COLUNA_DO_CAMPO).sort()).toEqual(["descricao", "marca", "tamanho"]);
  });

  test("rascunho vazio gera lote vazio — e a tela não chama a API", () => {
    expect(montarLote({}, "marca")).toEqual([]);
    expect(quantasVaoSubir({ a: "", b: "  " })).toBe(0);
  });

  test("o contador do botão bate com o que sobe", () => {
    const rascunho = { a: "M", b: "", c: "G" };
    expect(quantasVaoSubir(rascunho)).toBe(montarLote(rascunho, "tamanho").length);
  });
});

describe("aplicar em todas", () => {
  test("preenche só o que está vazio", () => {
    // Ela ajustou 'b' à mão. Aplicar não pode atropelar.
    const r = aplicarEmTodos(["a", "b", "c"], "Finesse", { b: "Outra marca" });
    expect(r).toEqual({ a: "Finesse", b: "Outra marca", c: "Finesse" });
  });

  test("valor em branco não faz nada", () => {
    const antes = { a: "x" };
    expect(aplicarEmTodos(["a", "b"], "   ", antes)).toBe(antes);
  });

  test("não inventa id que não está na leva", () => {
    const r = aplicarEmTodos(["a"], "U", {});
    expect(Object.keys(r)).toEqual(["a"]);
  });
});

describe("campo de upload não vira campo de texto", () => {
  test("foto e segunda foto não são editáveis", () => {
    expect(ehEditavel("foto")).toBe(false);
    expect(ehEditavel("foto2")).toBe(false);
    expect(ehEditavel("qualquer")).toBe(false);
  });

  test("o texto de 'aplicar em todas' concorda em gênero", () => {
    // Era montado com `Mesmo ${rotulo}` e saía "Mesmo marca para todas".
    // Em português o adjetivo concorda com o substantivo; template que
    // junta pedaços de frase não sabe disso.
    expect(AJUDA.marca.emMassa).toBe("Mesma marca para todas");
    expect(AJUDA.tamanho.emMassa).toBe("Mesmo tamanho para todas");
    for (const campo of ["descricao", "tamanho", "marca"] as const) {
      expect(AJUDA[campo].emMassa).not.toContain("${");
    }
  });

  test("descrição é o único multilinha", () => {
    expect(AJUDA.descricao.multilinha).toBe(true);
    expect(AJUDA.tamanho.multilinha).toBe(false);
    expect(AJUDA.marca.multilinha).toBe(false);
  });
});

// ── a tela ──────────────────────────────────────────────

function nos(arvore: any): any[] {
  const out: any[] = [];
  const anda = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(anda);
    out.push(n);
    if (n.children) anda(n.children);
  };
  anda(arvore);
  return out;
}
const temTestId = (a: any, id: string) =>
  nos(a).some((n) => n.props && n.props["data-testid"] === id);
const textos = (a: any) =>
  nos(a).filter((n) => typeof n === "object" && n.children)
    .flatMap((n) => n.children).filter((c: any) => typeof c === "string").join(" ");

function montar() {
  let r: any;
  act(() => { r = renderer.create(<DeixarLojaPronta />); });
  return r;
}

describe("a tela", () => {
  beforeEach(() => {
    mockSalvar.mockClear();
    mockLista = { produtos: [] };
  });

  test("loja sem buraco nenhum mostra que está pronta, sem lista", () => {
    mockResumo = {
      total: 143, publicadas: 143,
      campos: [{ chave: "marca", titulo: "Marca", editavel: true, faltando: 0 }],
    };
    const r = montar();
    expect(textos(r.toJSON())).toContain("pronta");
    expect(temTestId(r.toJSON(), "pendencia-marca")).toBe(false);
  });

  test("só lista campo que tem pendência", () => {
    mockResumo = {
      total: 1303, publicadas: 143,
      campos: [
        { chave: "foto", titulo: "Foto do produto", editavel: false, faltando: 1160 },
        { chave: "descricao", titulo: "Descrição", editavel: true, faltando: 0 },
        { chave: "tamanho", titulo: "Tamanho", editavel: true, faltando: 37 },
      ],
    };
    const r = montar();
    expect(temTestId(r.toJSON(), "pendencia-foto")).toBe(true);
    expect(temTestId(r.toJSON(), "pendencia-tamanho")).toBe(true);
    // Descrição está zerada: não pode aparecer como tarefa.
    expect(temTestId(r.toJSON(), "pendencia-descricao")).toBe(false);
  });

  test("abrir campo de foto NÃO abre editor — foto é upload", () => {
    mockResumo = {
      total: 1303, publicadas: 143,
      campos: [{ chave: "foto", titulo: "Foto do produto", editavel: false, faltando: 1160 }],
    };
    mockLista = { produtos: [{ id: "p1", name: "Vestido", image_url: null }] };
    const r = montar();
    const alvo = r.root.findAllByProps({ testID: "pendencia-foto" })[0];
    act(() => { alvo.props.onPress(); });
    expect(temTestId(r.toJSON(), "entrada-p1")).toBe(false);
    expect(temTestId(r.toJSON(), "salvar-lote")).toBe(false);
  });

  test("abrir tamanho lista as peças e salva só o preenchido", async () => {
    mockResumo = {
      total: 1303, publicadas: 143,
      campos: [{ chave: "tamanho", titulo: "Tamanho", editavel: true, faltando: 2 }],
    };
    mockLista = {
      produtos: [
        { id: "p1", name: "Vestido A", image_url: null },
        { id: "p2", name: "Vestido B", image_url: null },
      ],
    };
    const r = montar();
    act(() => { r.root.findAllByProps({ testID: "pendencia-tamanho" })[0].props.onPress(); });
    expect(temTestId(r.toJSON(), "entrada-p1")).toBe(true);
    expect(temTestId(r.toJSON(), "entrada-p2")).toBe(true);

    // Preenche só a primeira.
    act(() => { r.root.findAllByProps({ testID: "entrada-p1" })[0].props.onChangeText("M"); });
    await act(async () => { r.root.findAllByProps({ testID: "salvar-lote" })[0].props.onPress(); });

    expect(mockSalvar).toHaveBeenCalledTimes(1);
    expect(mockSalvar).toHaveBeenCalledWith([{ id: "p1", size: "M" }]);
  });

  test("o botão vazio diz só 'Salvar' — sem instruir a lojista", async () => {
    // "Preencha ao menos uma" lia como cobrança. O estado desabilitado já
    // diz que não dá pra salvar ainda; a frase sobrava.
    mockResumo = {
      total: 10, publicadas: 10,
      campos: [{ chave: "marca", titulo: "Marca", editavel: true, faltando: 1 }],
    };
    mockLista = { produtos: [{ id: "p1", name: "Vestido", image_url: null }] };
    const r = montar();
    act(() => { r.root.findAllByProps({ testID: "pendencia-marca" })[0].props.onPress(); });
    const t = textos(r.toJSON());
    expect(t).toContain("Salvar");
    expect(t).not.toContain("Preencha ao menos uma");
  });

  test("sem nada preenchido, o botão não chama a API", async () => {
    mockResumo = {
      total: 10, publicadas: 10,
      campos: [{ chave: "marca", titulo: "Marca", editavel: true, faltando: 1 }],
    };
    mockLista = { produtos: [{ id: "p1", name: "Vestido", image_url: null }] };
    const r = montar();
    act(() => { r.root.findAllByProps({ testID: "pendencia-marca" })[0].props.onPress(); });
    await act(async () => { r.root.findAllByProps({ testID: "salvar-lote" })[0].props.onPress(); });
    expect(mockSalvar).not.toHaveBeenCalled();
  });

  test("aplicar em todas preenche a leva e salva todas", async () => {
    mockResumo = {
      total: 10, publicadas: 10,
      campos: [{ chave: "marca", titulo: "Marca", editavel: true, faltando: 2 }],
    };
    mockLista = {
      produtos: [
        { id: "p1", name: "A", image_url: null },
        { id: "p2", name: "B", image_url: null },
      ],
    };
    const r = montar();
    act(() => { r.root.findAllByProps({ testID: "pendencia-marca" })[0].props.onPress(); });
    act(() => { r.root.findAllByProps({ testID: "valor-para-todos" })[0].props.onChangeText("Finesse"); });
    act(() => { r.root.findAllByProps({ testID: "aplicar-em-todas" })[0].props.onPress(); });
    await act(async () => { r.root.findAllByProps({ testID: "salvar-lote" })[0].props.onPress(); });

    expect(mockSalvar).toHaveBeenCalledWith([
      { id: "p1", brand: "Finesse" },
      { id: "p2", brand: "Finesse" },
    ]);
  });

  test("descrição não oferece aplicar em todas", () => {
    // Uma descrição igual pra 143 peças é pior que descrição nenhuma.
    mockResumo = {
      total: 10, publicadas: 10,
      campos: [{ chave: "descricao", titulo: "Descrição", editavel: true, faltando: 3 }],
    };
    mockLista = { produtos: [{ id: "p1", name: "A", image_url: null }] };
    const r = montar();
    act(() => { r.root.findAllByProps({ testID: "pendencia-descricao" })[0].props.onPress(); });
    expect(temTestId(r.toJSON(), "entrada-p1")).toBe(true);
    expect(temTestId(r.toJSON(), "aplicar-em-todas")).toBe(false);
  });
});
