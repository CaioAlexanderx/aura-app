// tq-11 (14/10/2026): o banner de indicação do sino abre Configurações já
// focado no cartão "Indique e ganhe" (rola + spotlight).
import React from "react";
import renderer, { act } from "react-test-renderer";
import * as fs from "fs";
import * as path from "path";
import {
  TITULO_BANNER_INDICACAO, ROTA_CONFIGURACOES_INDICACAO, ALVO_INDICACAO,
  ehBannerDeIndicacao, rotaDoCtaDoBanner, focoDoParametro, pedeFocoNaIndicacao,
} from "@/utils/focoIndicacao";
import { tourSelector } from "@/utils/tourTarget";

jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));

const lerFonte = (...p: string[]) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

describe("ehBannerDeIndicacao", () => {
  it("a constante nomeada é o título da campanha", () => {
    expect(TITULO_BANNER_INDICACAO).toBe("Indique um lojista");
  });
  it("reconhece o título da campanha, com ou sem caixa e acento", () => {
    expect(ehBannerDeIndicacao("Indique um lojista e ganhe 1 mês grátis")).toBe(true);
    expect(ehBannerDeIndicacao("INDIQUE UM LOJISTA")).toBe(true);
    expect(ehBannerDeIndicacao("Novidade: indique um lojista!")).toBe(true);
  });
  it("não confunde com outros banners", () => {
    expect(ehBannerDeIndicacao("Black Friday chegando")).toBe(false);
    expect(ehBannerDeIndicacao("")).toBe(false);
    expect(ehBannerDeIndicacao(null)).toBe(false);
    expect(ehBannerDeIndicacao(undefined)).toBe(false);
  });
});

describe("rotaDoCtaDoBanner", () => {
  const indicacao = { title: "Indique um lojista e ganhe 1 mês grátis" };

  it("banner de indicação para /configuracoes vira /configuracoes?foco=indicacao", () => {
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: "/configuracoes" })).toBe("/configuracoes?foco=indicacao");
    expect(ROTA_CONFIGURACOES_INDICACAO).toBe("/configuracoes?foco=indicacao");
  });
  it("aceita a forma com grupo e barra final", () => {
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: "/(tabs)/configuracoes" })).toBe(ROTA_CONFIGURACOES_INDICACAO);
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: "/configuracoes/" })).toBe(ROTA_CONFIGURACOES_INDICACAO);
  });
  it("respeita rota que já traz parâmetro", () => {
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: "/configuracoes?foco=equipe" })).toBe("/configuracoes?foco=equipe");
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: "/configuracoes?foco=indicacao" })).toBe("/configuracoes?foco=indicacao");
  });
  it("outro banner para /configuracoes fica como está", () => {
    expect(rotaDoCtaDoBanner({ title: "Novo plano", cta_route: "/configuracoes" })).toBe("/configuracoes");
  });
  it("banner de indicação para outra rota fica como está", () => {
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: "/planos" })).toBe("/planos");
  });
  it("sem rota: null (o clique cai no cta_url)", () => {
    expect(rotaDoCtaDoBanner({ ...indicacao })).toBeNull();
    expect(rotaDoCtaDoBanner({ ...indicacao, cta_route: null })).toBeNull();
  });
});

describe("parâmetro foco em Configurações", () => {
  it("lê string, array e descarta lixo", () => {
    expect(focoDoParametro("indicacao")).toBe("indicacao");
    expect(focoDoParametro(["indicacao", "x"])).toBe("indicacao");
    expect(focoDoParametro(" Indicacao ")).toBe("indicacao");
    expect(focoDoParametro(undefined)).toBeNull();
    expect(focoDoParametro("undefined")).toBeNull();
    expect(focoDoParametro("")).toBeNull();
    expect(focoDoParametro(42)).toBeNull();
  });
  it("só foco=indicacao pede o destaque", () => {
    expect(pedeFocoNaIndicacao("indicacao")).toBe(true);
    expect(pedeFocoNaIndicacao("equipe")).toBe(false);
    expect(pedeFocoNaIndicacao(undefined)).toBe(false);
  });
});

describe("ligações na fonte", () => {
  it("Configurações lê o parâmetro e monta o destaque depois do cartão", () => {
    const src = lerFonte("app", "(tabs)", "configuracoes.tsx");
    expect(src).toContain("useLocalSearchParams");
    // 18/10/2026 (p-19): o foco virou genérico (utils/focoNaSecao.ts).
    expect(src).toContain("secaoDoFoco(params?.foco)");
    expect(src.indexOf("<ReferralCard />")).toBeGreaterThan(-1);
    expect(src.indexOf("<FocoNaSecao")).toBeGreaterThan(src.indexOf("<ReferralCard />"));
  });
  it("o cartão carrega a marca que o spotlight procura, nos dois estados", () => {
    const src = lerFonte("components", "ReferralCard.tsx");
    expect(src.split("tourTarget(ALVO_INDICACAO)").length - 1).toBe(2);
  });
  it("o banner do sino usa a função que decide a rota", () => {
    const src = lerFonte("components", "NotificationDrawer.tsx");
    expect(src).toContain("rotaDoCtaDoBanner(b)");
  });
  it("o SpotlightTour respeita prefers-reduced-motion", () => {
    const src = lerFonte("components", "onboarding", "SpotlightTour.tsx");
    expect(src).toContain("prefers-reduced-motion: reduce");
  });
});

describe("destaque do cartão de indicação (FocoNaSecao)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  function montaCartao(visivel = true) {
    const d = document.createElement("div");
    d.setAttribute("data-tour", ALVO_INDICACAO);
    (d as any).scrollIntoView = jest.fn();
    (d as any).getBoundingClientRect = () => ({
      left: 10, top: 500, width: visivel ? 300 : 0, height: visivel ? 200 : 0,
      right: 310, bottom: 700, x: 10, y: 500,
    });
    document.body.appendChild(d);
    return d;
  }

  // 18/10/2026 (p-19): o destaque é o FocoNaSecao genérico com a seção
  // "indicacao" do registro, exatamente o que Configurações monta.
  function renderiza(ativo: boolean) {
    const { FocoNaSecao } = require("@/components/screens/configuracoes/FocoNaSecao");
    const { secaoDoFoco } = require("@/utils/focoNaSecao");
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<FocoNaSecao secao={secaoDoFoco(ativo ? "indicacao" : undefined)} />); });
    return tree;
  }

  it("com o cartão na tela: rola até ele e mostra a dica ancorada", () => {
    const cartao = montaCartao();
    const tree = renderiza(true);
    act(() => { jest.advanceTimersByTime(600); });
    expect((cartao as any).scrollIntoView).toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("Seu código de indicação fica aqui");
    tree.unmount();
  });

  it("some sozinho em poucos segundos", () => {
    montaCartao();
    const tree = renderiza(true);
    act(() => { jest.advanceTimersByTime(600); });
    expect(JSON.stringify(tree.toJSON())).toContain("Seu código de indicação fica aqui");
    act(() => { jest.advanceTimersByTime(8000); });
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("sem o cartão (sem alvo): não rola, não mostra nada e não quebra", () => {
    const tree = renderiza(true);
    act(() => { jest.advanceTimersByTime(6000); });
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("sem o parâmetro: nada acontece", () => {
    const cartao = montaCartao();
    const tree = renderiza(false);
    act(() => { jest.advanceTimersByTime(2000); });
    expect((cartao as any).scrollIntoView).not.toHaveBeenCalled();
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("o seletor usado é o do marcador de tour", () => {
    expect(tourSelector(ALVO_INDICACAO)).toBe('[data-tour="configuracoes.indicacao"]');
  });
});
