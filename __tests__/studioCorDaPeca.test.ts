// ============================================================
// AURA Studio — 27/09/2026: a cor da peça chega ao 2D, e as dobras
// seguem a cor.
//
// A camiseta vetorial ficava bege com "preto" escolhido: a cor só
// alimentava o 3D. E mesmo com a cor, contorno e dobras eram preto com
// alfa — numa camiseta preta somem todos. As duas regras puras que
// resolvem isso ficam aqui.
// ============================================================
import { corDaPeca } from "@/components/studio/visualEngine/corDaPeca";
import { dobrasParaCor, luminanciaRelativa } from "@/components/studio/visualEngine/compose2d";

describe("corDaPeca — a escolha do cliente no campo de cor", () => {
  const cfg = { fields: [{ id: "nome", type: "text" }, { id: "cor", type: "color" }] };

  it("devolve o hex escolhido", () => {
    expect(corDaPeca(cfg, { cor: "#111111", nome: "Ana" })).toBe("#111111");
    expect(corDaPeca(cfg, { cor: "  #abc " })).toBe("#abc");
  });

  it("sem campo de cor, sem escolha ou com valor inválido, undefined (o motor usa o default)", () => {
    expect(corDaPeca({ fields: [{ id: "nome", type: "text" }] }, { nome: "Ana" })).toBeUndefined();
    expect(corDaPeca(cfg, {})).toBeUndefined();
    expect(corDaPeca(cfg, { cor: "preto" })).toBeUndefined();
    expect(corDaPeca(null, { cor: "#000" })).toBeUndefined();
    expect(corDaPeca(cfg, null)).toBeUndefined();
  });
});

describe("dobrasParaCor — tinta escura em peça clara, clara em peça escura", () => {
  it("a bege de sempre continua com as dobras pretas (o desenho de antes)", () => {
    expect(dobrasParaCor("#F5F2EA")).toEqual({ escura: false, sombra: "0,0,0", realce: "255,255,255" });
    expect(dobrasParaCor("#FFFFFF").escura).toBe(false);
  });

  it("preto e o violeta da marca invertem a tinta", () => {
    expect(dobrasParaCor("#000000")).toEqual({ escura: true, sombra: "255,255,255", realce: "0,0,0" });
    expect(dobrasParaCor("#7c3aed").escura).toBe(true);
    expect(dobrasParaCor("#111").escura).toBe(true);
  });

  it("vermelho conta como escuro; amarelo, como claro", () => {
    expect(dobrasParaCor("#EF4444").escura).toBe(true);
    expect(dobrasParaCor("#FACC15").escura).toBe(false);
  });

  it("cor inválida é tratada como clara — o desenho de antes, sem lançar", () => {
    expect(dobrasParaCor("preto").escura).toBe(false);
    expect(dobrasParaCor("").escura).toBe(false);
  });

  it("luminância relativa nos extremos", () => {
    expect(luminanciaRelativa("#000000")).toBe(0);
    expect(luminanciaRelativa("#FFFFFF")).toBeCloseTo(1, 6);
    expect(luminanciaRelativa("#808080")).toBeCloseTo(0.2158, 3);
  });
});
