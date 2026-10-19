// p-19 (18/10/2026): /configuracoes?foco=<chave> rola até a seção marcada
// com a chave e a destaca. Mecanismo genérico (nasceu no tq-11 só para o
// cartão "Indique e ganhe").
import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  ROTA_CONFIGURACOES, PARAM_FOCO, SECOES_COM_FOCO, type SecaoComFoco,
  secaoRegistrada, alvoDaSecao, rotaDeConfiguracoesNaSecao, focoDoParametro, secaoDoFoco,
} from "@/utils/focoNaSecao";
import { ALVO_INDICACAO, ROTA_CONFIGURACOES_INDICACAO } from "@/utils/focoIndicacao";
import { tourSelector } from "@/utils/tourTarget";

jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));

describe("registro das seções", () => {
  it("toda entrada tem chave igual à chave do registro, alvo e textos", () => {
    Object.keys(SECOES_COM_FOCO).forEach((k) => {
      const s = SECOES_COM_FOCO[k];
      expect(s.chave).toBe(k);
      expect(k).toMatch(/^[a-z0-9-]+$/);
      expect(s.alvo.length).toBeGreaterThan(0);
      expect(s.titulo.length).toBeGreaterThan(0);
      expect(s.texto.length).toBeGreaterThan(0);
    });
  });
  it("alvos não se repetem", () => {
    const alvos = Object.keys(SECOES_COM_FOCO).map((k) => SECOES_COM_FOCO[k].alvo);
    expect(new Set(alvos).size).toBe(alvos.length);
  });
  it("a indicação continua com o mesmo alvo e a mesma rota de antes (banner do sino)", () => {
    expect(ALVO_INDICACAO).toBe("configuracoes.indicacao");
    expect(alvoDaSecao("indicacao")).toBe(ALVO_INDICACAO);
    expect(ROTA_CONFIGURACOES_INDICACAO).toBe("/configuracoes?foco=indicacao");
  });
  it("chave desconhecida: null no registro e erro ao pedir o alvo", () => {
    expect(secaoRegistrada("nao-existe")).toBeNull();
    expect(secaoRegistrada("toString")).toBeNull();
    expect(() => alvoDaSecao("nao-existe")).toThrow();
  });
});

describe("rotaDeConfiguracoesNaSecao", () => {
  it("monta /configuracoes?foco=<chave>", () => {
    expect(ROTA_CONFIGURACOES).toBe("/configuracoes");
    expect(PARAM_FOCO).toBe("foco");
    expect(rotaDeConfiguracoesNaSecao("indicacao")).toBe("/configuracoes?foco=indicacao");
    expect(rotaDeConfiguracoesNaSecao("a b")).toBe("/configuracoes?foco=a%20b");
  });
});

describe("focoDoParametro e secaoDoFoco", () => {
  it("lê string e array", () => {
    expect(focoDoParametro("indicacao")).toBe("indicacao");
    expect(focoDoParametro(["indicacao", "outra"])).toBe("indicacao");
    expect(focoDoParametro("  INDICACAO ")).toBe("indicacao");
  });
  it("descarta o lixo do expo-router (\"undefined\", \"null\", vazio, não string)", () => {
    expect(focoDoParametro(undefined)).toBeNull();
    expect(focoDoParametro(null)).toBeNull();
    expect(focoDoParametro("undefined")).toBeNull();
    expect(focoDoParametro("null")).toBeNull();
    expect(focoDoParametro("")).toBeNull();
    expect(focoDoParametro("   ")).toBeNull();
    expect(focoDoParametro([])).toBeNull();
    expect(focoDoParametro(7)).toBeNull();
    expect(focoDoParametro({ foco: "indicacao" })).toBeNull();
  });
  it("secaoDoFoco devolve o objeto do registro (referência estável) ou null", () => {
    expect(secaoDoFoco("indicacao")).toBe(SECOES_COM_FOCO.indicacao);
    expect(secaoDoFoco(["indicacao"])).toBe(secaoDoFoco("indicacao"));
    expect(secaoDoFoco("nao-existe")).toBeNull();
    expect(secaoDoFoco("undefined")).toBeNull();
    expect(secaoDoFoco(undefined)).toBeNull();
  });
});

describe("FocoNaSecao", () => {
  const A: SecaoComFoco = { chave: "secao-a", alvo: "teste.secao-a", titulo: "Dica da seção A", texto: "Texto A" };
  const B: SecaoComFoco = { chave: "secao-b", alvo: "teste.secao-b", titulo: "Dica da seção B", texto: "Texto B" };

  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  function montaAlvo(alvo: string) {
    const d = document.createElement("div");
    d.setAttribute("data-tour", alvo);
    (d as any).scrollIntoView = jest.fn();
    (d as any).getBoundingClientRect = () => ({ left: 8, top: 900, width: 359, height: 160, right: 367, bottom: 1060, x: 8, y: 900 });
    document.body.appendChild(d);
    return d;
  }

  function Tela({ secao }: { secao: SecaoComFoco | null }) {
    const { FocoNaSecao } = require("@/components/screens/configuracoes/FocoNaSecao");
    return <FocoNaSecao secao={secao} />;
  }

  it("rola até a seção pedida e mostra a dica dela", () => {
    const a = montaAlvo(A.alvo);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Tela secao={A} />); });
    act(() => { jest.advanceTimersByTime(600); });
    expect((a as any).scrollIntoView).toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("Dica da seção A");
    tree.unmount();
  });

  it("espera a seção que carrega depois (cartão com dados próprios)", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Tela secao={A} />); });
    act(() => { jest.advanceTimersByTime(3000); });
    expect(tree.toJSON()).toBeNull();
    const a = montaAlvo(A.alvo);
    act(() => { jest.advanceTimersByTime(800); });
    expect((a as any).scrollIntoView).toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("Dica da seção A");
    tree.unmount();
  });

  it("seção que nunca aparece: desiste sem mostrar nada", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Tela secao={A} />); });
    act(() => { jest.advanceTimersByTime(7000); });
    montaAlvo(A.alvo);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("trocar de seção troca o destaque", () => {
    montaAlvo(A.alvo);
    const b = montaAlvo(B.alvo);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Tela secao={A} />); });
    act(() => { jest.advanceTimersByTime(600); });
    expect(JSON.stringify(tree.toJSON())).toContain("Dica da seção A");
    act(() => { tree.update(<Tela secao={B} />); });
    act(() => { jest.advanceTimersByTime(600); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Dica da seção B");
    expect(json).not.toContain("Dica da seção A");
    expect((b as any).scrollIntoView).toHaveBeenCalled();
    tree.unmount();
  });

  it("some sozinho e não volta enquanto o pedido for o mesmo", () => {
    montaAlvo(A.alvo);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Tela secao={A} />); });
    act(() => { jest.advanceTimersByTime(600); });
    expect(JSON.stringify(tree.toJSON())).toContain("Dica da seção A");
    act(() => { jest.advanceTimersByTime(8000); });
    expect(tree.toJSON()).toBeNull();
    act(() => { tree.update(<Tela secao={A} />); });
    act(() => { jest.advanceTimersByTime(2000); });
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("sem seção: nada acontece", () => {
    const a = montaAlvo(A.alvo);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Tela secao={null} />); });
    act(() => { jest.advanceTimersByTime(2000); });
    expect((a as any).scrollIntoView).not.toHaveBeenCalled();
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("o seletor é o do marcador de tour", () => {
    expect(tourSelector(A.alvo)).toBe('[data-tour="teste.secao-a"]');
  });
});
