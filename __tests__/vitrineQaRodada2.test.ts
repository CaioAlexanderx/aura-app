// ============================================================
// QA pós-deploy 28/09 · regras puras da segunda rodada
//
// - legenda do mockup na foto com campo de cor (a foto não muda de cor);
// - a etapa do checkout por entrada do histórico (o roteador apaga a
//   marca do state a cada popstate);
// - acompanhamento: a etapa atual preenchida e o texto do "Pronto";
// - o slogan não se repete na primeira dobra;
// - no papel, a tinta sobre a cor da loja é o papel quente.
// ============================================================
import { LEGENDA_DA_COR_NA_FOTO, legendaDoMockup } from "@/components/studio/storefront/produto/regrasDaPagina";
import { etapaDaEntrada, MARCA_DA_ETAPA, type EtapaNoHistorico } from "@/components/studio/storefront/historicoDaVitrine";
import { estadoDaEtapa, textoDoPronto } from "@/components/studio/storefront/posCompra/posCompra";
import { fraseDoDestaque } from "@/components/studio/storefront/home/regrasDaHome";
import { AURA, contraste, montarTema } from "@/components/studio/storefront/theme";

describe("legenda do mockup na foto", () => {
  test("foto marcada + campo de cor: avisa que a cor vai na produção", () => {
    expect(legendaDoMockup({ fonte: "foto", temCampoDeCor: true })).toBe(LEGENDA_DA_COR_NA_FOTO);
    expect(LEGENDA_DA_COR_NA_FOTO).toBe("A foto mostra a peça na cor fotografada; a sua cor vai na produção.");
  });
  test("sem campo de cor, ou fora da foto marcada: a legenda de sempre", () => {
    expect(legendaDoMockup({ fonte: "foto", temCampoDeCor: false })).toBeNull();
    expect(legendaDoMockup({ fonte: "banco", temCampoDeCor: true })).toBeNull();
    expect(legendaDoMockup({ fonte: "nenhuma", temCampoDeCor: true })).toBeNull();
    expect(legendaDoMockup({ fonte: null, temCampoDeCor: true })).toBeNull();
  });
});

describe("a etapa do checkout por entrada", () => {
  const mapa = new Map<string, EtapaNoHistorico>([["k2", 2], ["k3", 3]]);
  test("a marca do state manda", () => {
    expect(etapaDaEntrada({ estado: { id: "x", [MARCA_DA_ETAPA]: 3 }, chave: "k2", mapa })).toBe(3);
  });
  test("o roteador apagou a marca: vale o que o mapa lembra da entrada", () => {
    expect(etapaDaEntrada({ estado: { id: "x" }, chave: "k2", mapa })).toBe(2);
    expect(etapaDaEntrada({ estado: null, chave: "k3", mapa })).toBe(3);
  });
  test("sem marca e sem lembrança: etapa 1 (null)", () => {
    expect(etapaDaEntrada({ estado: { id: "x" }, chave: null, mapa })).toBeNull();
    expect(etapaDaEntrada({ estado: { id: "x" }, chave: "outra", mapa })).toBeNull();
  });
});

describe("acompanhamento", () => {
  test("a etapa atual é 'atual' (preenchida com anel), inclusive a última", () => {
    expect(estadoDaEtapa(3, 3, false)).toBe("atual");
    expect(estadoDaEtapa(2, 3, false)).toBe("feita");
    expect(estadoDaEtapa(3, 2, false)).toBe("futura");
    expect(estadoDaEtapa(3, 3, true)).toBe("feita");
  });
  test("o texto do Pronto: o número do pedido, sem 'qualquer pessoa'", () => {
    expect(textoDoPronto({ pedido: "00003", retirada: true })).toBe("Leve o número do pedido (00003) na retirada.");
    expect(textoDoPronto({ pedido: "#00003", retirada: true, porApp: true })).toBe("Quem for buscar leva o número do pedido (00003).");
    expect(textoDoPronto({ pedido: "00003", retirada: false })).toBe("A loja fala com você para combinar a entrega.");
    expect(textoDoPronto({ pedido: "00003", retirada: true })).not.toMatch(/Qualquer pessoa/);
  });
});

describe("o slogan na primeira dobra", () => {
  const loja: any = { site: { tagline: "Presentes que ninguém mais tem", name: "Aura QA" }, products: [], categories: [] };
  test("sem banner automático, o subtítulo é o slogan", () => {
    expect(fraseDoDestaque(loja)).toBe("Presentes que ninguém mais tem");
  });
  test("o banner automático já mostra o slogan: o subtítulo usa a frase do Studio", () => {
    const f = fraseDoDestaque(loja, { sloganNoBanner: true });
    expect(f).not.toBe("Presentes que ninguém mais tem");
    expect(f).toMatch(/Você vê como fica antes de pagar\.$/);
  });
});

describe("a tinta sobre a cor da loja no papel", () => {
  test("cor escura da loja: o texto é o papel quente, não o lavanda do painel", () => {
    const t = montarTema("#1a1612", "papel");
    expect(t.sobreMarca).not.toBe(AURA.ink);
    expect(t.sobreMarca).toBe("#FBF8F3");
    expect(contraste(t.marcaFill, t.sobreMarca)).toBeGreaterThanOrEqual(4.5);
  });
  test("no modo escuro nada muda", () => {
    expect(montarTema("#1a1612", "escuro" as any).sobreMarca).toBe(AURA.ink);
  });
});
