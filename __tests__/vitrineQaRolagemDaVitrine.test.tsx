// ============================================================
// QA 28/09 · a rolagem da vitrine (home/rolagemDaVitrine.ts e
// home/useRolagemGuardada.ts)
//
// 1. Voltar da peça devolvia scrollTop 0 em /c/outras, /c/canecas e na
//    home. A posição passou a ser guardada por CAMINHO, e quem diz "a
//    cliente voltou" é o popstate (marca com o caminho, vale por uma
//    janela curta). A posição só some quando é aplicada: duas montagens
//    seguidas da tela restauram as duas.
// 2. "Todas as peças" vindo de outra página desistia em 1,5 s. O pedido
//    agora espera o layout da grade (sem prazo curto).
// ============================================================
import React, { useRef } from "react";
import { act, render, configure } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);
import {
  JANELA_DA_VOLTA_MS, VALIDADE_DA_ROLAGEM_MS, VALIDADE_DO_PEDIDO_DA_GRADE_MS,
  alvoDaRolagem, chaveDaRolagem, concluirPedidoDaGrade, esquecerRolagem, esquecerVolta, guardarRolagem,
  haPedidoDaGrade, marcarVolta, normalizarCaminho, pedirAGradeNaHome, rolagemGuardada, rolagemParaRestaurar,
  veioDoHistorico,
} from "@/components/studio/storefront/home/rolagemDaVitrine";
import { useRolagemGuardada } from "@/components/studio/storefront/home/useRolagemGuardada";

const agora = 1_000_000;

afterEach(() => {
  esquecerVolta();
  concluirPedidoDaGrade();
});

describe("a posição por caminho", () => {
  test("a chave é da loja e da tela", () => {
    expect(chaveDaRolagem(" Aura-QA ", "home")).toBe("aura-qa|home");
    expect(chaveDaRolagem("aura-qa", "c:canecas")).toBe("aura-qa|c:canecas");
  });

  test("o caminho ignora a barra do fim, a consulta e o #", () => {
    expect(normalizarCaminho("/aura-qa/c/outras/")).toBe("/aura-qa/c/outras");
    expect(normalizarCaminho("/aura-qa?v2=1#x")).toBe("/aura-qa");
    expect(normalizarCaminho("/")).toBe("/");
  });

  test("guardar não depende de id do histórico; no topo apaga; vence em 30 min", () => {
    const k = chaveDaRolagem("loja", "c:x");
    guardarRolagem(k, 812.6, agora);
    expect(rolagemGuardada(k, agora + 10)).toBe(813);
    guardarRolagem(k, 0, agora);
    expect(rolagemGuardada(k, agora)).toBeNull();
    guardarRolagem(k, 500, agora);
    expect(rolagemGuardada(k, agora + VALIDADE_DA_ROLAGEM_MS + 1)).toBeNull();
  });
});

describe("restaurar só na volta pelo histórico", () => {
  const k = chaveDaRolagem("aura-qa", "c:outras");
  beforeEach(() => { guardarRolagem(k, 800, agora); });
  afterEach(() => esquecerRolagem(k));

  test("sem popstate (toque em link): começa no topo", () => {
    expect(rolagemParaRestaurar(k, "/aura-qa/c/outras", agora + 50)).toBeNull();
  });

  test("popstate para o mesmo caminho, logo antes: restaura", () => {
    marcarVolta("/aura-qa/c/outras/", agora);
    expect(rolagemParaRestaurar(k, "/aura-qa/c/outras", agora + 40)).toBe(800);
  });

  test("ler não gasta: a segunda montagem da mesma volta também restaura", () => {
    marcarVolta("/aura-qa/c/outras", agora);
    expect(rolagemParaRestaurar(k, "/aura-qa/c/outras", agora + 10)).toBe(800);
    expect(rolagemParaRestaurar(k, "/aura-qa/c/outras", agora + 20)).toBe(800);
  });

  test("popstate para outro caminho, ou velho demais, não vale", () => {
    expect(veioDoHistorico({ caminho: "/aura-qa/p/1", ts: agora }, "/aura-qa/c/outras", agora)).toBe(false);
    expect(veioDoHistorico({ caminho: "/aura-qa/c/outras", ts: agora }, "/aura-qa/c/outras", agora + JANELA_DA_VOLTA_MS + 1)).toBe(false);
    expect(veioDoHistorico(null, "/aura-qa/c/outras", agora)).toBe(false);
    expect(veioDoHistorico({ caminho: "/aura-qa/c/outras", ts: agora }, "", agora)).toBe(false);
  });
});

describe("Todas as peças de fora da home", () => {
  test("o pedido não expira antes do layout da grade", () => {
    pedirAGradeNaHome(agora);
    // O 1,5 s de antes já teria desistido aqui.
    expect(haPedidoDaGrade(agora + 1_600)).toBe(true);
    expect(haPedidoDaGrade(agora + 10_000)).toBe(true);
    // Quem gasta é a home, depois de rolar.
    concluirPedidoDaGrade();
    expect(haPedidoDaGrade(agora + 10_001)).toBe(false);
  });

  test("perguntar não gasta (montagem que sai antes do layout não leva o pedido)", () => {
    pedirAGradeNaHome(agora);
    expect(haPedidoDaGrade(agora + 1)).toBe(true);
    expect(haPedidoDaGrade(agora + 2)).toBe(true);
  });

  test("teto largo só para não ficar pendurado", () => {
    pedirAGradeNaHome(agora);
    expect(haPedidoDaGrade(agora + VALIDADE_DO_PEDIDO_DA_GRADE_MS + 1)).toBe(false);
  });

  test("o alvo desconta o cabeçalho preso e nunca é negativo", () => {
    expect(alvoDaRolagem(1840, 120)).toBe(1721);
    expect(alvoDaRolagem(40, 120)).toBe(0);
    expect(alvoDaRolagem(NaN, 120)).toBe(0);
  });
});

// ── O gancho: restaura quando o conteúdo tem altura ─────────────
describe("useRolagemGuardada", () => {
  let quadros: Array<() => void> = [];
  const rafOriginal = (global as any).requestAnimationFrame;
  const cafOriginal = (global as any).cancelAnimationFrame;
  beforeEach(() => {
    quadros = [];
    (global as any).requestAnimationFrame = (fn: () => void) => { quadros.push(fn); return quadros.length; };
    (global as any).cancelAnimationFrame = () => undefined;
  });
  afterEach(() => {
    (global as any).requestAnimationFrame = rafOriginal;
    (global as any).cancelAnimationFrame = cafOriginal;
  });
  const rodarQuadros = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const fila = quadros; quadros = [];
      act(() => { fila.forEach((f) => f()); });
    }
  };

  function caixaFalsa(alturaDoConteudo: number) {
    const no: any = { scrollHeight: alturaDoConteudo, clientHeight: 700, scrollTop: 0 };
    const scroll = { getScrollableNode: () => no, scrollTo: jest.fn(({ y }: { y: number }) => { no.scrollTop = y; }) };
    return { no, scroll };
  }

  function Tela({ chave, scroll }: { chave: string; scroll: any }) {
    const ref = useRef<any>(scroll);
    useRolagemGuardada(chave, ref);
    return null;
  }

  test("volta pelo histórico: espera o conteúdo crescer e rola uma vez", () => {
    const chave = chaveDaRolagem("aura-qa", "home");
    guardarRolagem(chave, 2000);
    window.history.replaceState(null, "", "/aura-qa");
    marcarVolta("/aura-qa");
    const { no, scroll } = caixaFalsa(900);
    render(<Tela chave={chave} scroll={scroll} />);
    rodarQuadros(3);
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    no.scrollHeight = 3200; // a grade chegou
    rodarQuadros(1);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 2000, animated: false });
    expect(rolagemGuardada(chave)).toBeNull();
  });

  test("toque em link (sem popstate): fica no topo e guarda a posição ao sair", () => {
    const chave = chaveDaRolagem("aura-qa", "c:canecas");
    window.history.replaceState(null, "", "/aura-qa/c/canecas");
    const { no, scroll } = caixaFalsa(3000);
    const r = render(<Tela chave={chave} scroll={scroll} />);
    rodarQuadros(2);
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    no.scrollTop = 500;
    r.unmount();
    expect(rolagemGuardada(chave)).toBe(500);
  });

  test("montagem que sai antes de restaurar não apaga a posição (a seguinte restaura)", () => {
    const chave = chaveDaRolagem("aura-qa", "c:outras");
    guardarRolagem(chave, 800);
    window.history.replaceState(null, "", "/aura-qa/c/outras");
    marcarVolta("/aura-qa/c/outras");
    const primeira = caixaFalsa(100);
    const r = render(<Tela chave={chave} scroll={primeira.scroll} />);
    rodarQuadros(1);
    r.unmount();
    expect(rolagemGuardada(chave)).toBe(800);
    const segunda = caixaFalsa(2500);
    render(<Tela chave={chave} scroll={segunda.scroll} />);
    rodarQuadros(1);
    expect(segunda.scroll.scrollTo).toHaveBeenCalledWith({ y: 800, animated: false });
  });
});
