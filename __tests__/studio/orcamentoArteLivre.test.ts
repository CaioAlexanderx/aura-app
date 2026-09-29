// ============================================================
// Arte LIVRE na peça do orçamento (29/09/2026)
//
// O PO: "Temos que dar liberdade total para encaixar a arte na camisa,
// sem delimitar cm ou posição da arte." Só no orçamento; a vitrine segue
// presa à área de impressão.
//
// O que os testes seguram:
//   - o painel inteiro em UV: a constante da camiseta bate com o gerador
//     da malha; a caneca dá a volta toda, centrada no lado;
//   - livre sem corte na área: o pintor recorta só na borda do painel,
//     sem margem, e a arte pode passar do tamanho da área de impressão;
//   - o limite do painel: centro dentro do painel, tamanho até cobrir;
//   - compatibilidade: o ajuste antigo ({ escala, dx, dy }) continua lido
//     e escrito igual; a posição livre convive com ele por lado;
//   - a ficha diz "posição livre, veja a prévia" e recebe a prévia.
// ============================================================
/* eslint-disable @typescript-eslint/no-var-requires */
import { painelLivre, PAINEIS_DA_CAMISETA_BASICA } from "@/components/studio/visualEngine/painelDaPeca";
import { retangulosNaTextura } from "@/components/studio/visualEngine/areasDaPeca";
import { pintarArteNaArea } from "@/components/studio/visualEngine/pintarArte";
import type { ArteDoLado } from "@/components/studio/visualEngine/layoutDaArte";
import {
  ajusteLivreValido, ehLivre, rotacaoValida, encaixarNoPainel, escalaMaxima, centralizar, moverLivre, escalarLivre,
  girarLivre, alvoDoToque, livreDaArea, ajusteDoLayout, alturaNoPainel, ESCALA_LIVRE_MIN,
} from "@/components/studio/orcamentoVideo/arteLivre";
import {
  artesDoItem, customizacaoComArtes, motorDasArtes, ajustarLado, ajusteDoLado, livreDoLado, comLivre, comPrevia,
  comImagem, CHAVE_DOS_AJUSTES, PREFIXO_DA_PREVIA, type ArtesDaPeca,
} from "@/components/studio/orcamentoVideo/artesPorLado";
import { rotuloDaChave, textoDosAjustesDoOrcamento } from "@/components/studio/customizationConfig";

jest.mock("@/services/studioApi", () => ({ studioApi: {} }));
jest.mock("@/services/studioVisualApi", () => ({ studioVisualApi: {} }));
jest.mock("@/components/studio/visualEngine/compose3dMug", () => ({ createModelViewer: jest.fn() }));
jest.mock("@/components/studio/visualEngine/compose2d", () => ({ exportPng: jest.fn() }));
jest.mock("@/components/studio/visualEngine/specDaFotoDoProduto", () => ({ specDaFotoDoProdutoMedida: jest.fn() }));

const PAINEL = { id: "panel", width_cm: 9, height_cm: 9.7, uv: { u0: 0.285, v0: 0.18, u1: 0.715, v1: 0.82 } };
const WRAP = { id: "wrap", width_cm: 21, height_cm: 9.7, uv: { u0: 0.02, v0: 0.18, u1: 0.98, v1: 0.82 } };
const CANECA: any = { schema: 1, model: { kind: "procedural" }, areas: [PAINEL, WRAP] };
// A spec publicada (docs/studio/visual-templates/camiseta-basica-3d.json).
const CAMISETA: any = require("../../docs/studio/visual-templates/camiseta-basica-3d.json").spec;

const cfg = (extra: any = {}): any => ({
  print_area: { width_cm: 28, height_cm: 35 },
  has_back: true, back_print_area: { width_cm: 28, height_cm: 35 },
  fields: [{ id: "image", type: "image", side: "front", label: "Arte", config: {} }],
  ...extra,
});

describe("o painel inteiro em UV", () => {
  test("a constante da camiseta é a caixa dos painéis da malha gerada (frente e costas)", () => {
    const { construirCamiseta } = require("../../scripts/studio/camisetaParametrica.js");
    const malha = construirCamiseta();
    const caixa: Record<string, { u0: number; u1: number; v0: number; v1: number }> = {};
    malha.uv.forEach((q: number[], i: number) => {
      const g = malha.grupos[i];
      if (g !== "frente" && g !== "costas") return;
      const u = q[0], v = 1 - q[1]; // o arquivo guarda 1 - v
      const c = (caixa[g] = caixa[g] || { u0: 9, u1: -9, v0: 9, v1: -9 });
      c.u0 = Math.min(c.u0, u); c.u1 = Math.max(c.u1, u); c.v0 = Math.min(c.v0, v); c.v1 = Math.max(c.v1, v);
    });
    for (const [lado, g] of [["front", "frente"], ["back", "costas"]] as const) {
      const k = PAINEIS_DA_CAMISETA_BASICA[lado];
      expect(k.u0).toBeCloseTo(caixa[g].u0, 3);
      expect(k.u1).toBeCloseTo(caixa[g].u1, 3);
      expect(k.v0).toBeCloseTo(caixa[g].v0, 3);
      expect(k.v1).toBeCloseTo(caixa[g].v1, 3);
    }
  });

  test("o painel da camiseta contém a área de impressão da spec, com folga para o ombro, a barra e as laterais", () => {
    for (const lado of ["front", "back"] as const) {
      const area = CAMISETA.areas.find((a: any) => a.id === lado).uv;
      const p = painelLivre(CAMISETA, lado)!;
      expect(p.uv).toEqual(PAINEIS_DA_CAMISETA_BASICA[lado]);
      expect(p.uv.u0).toBeLessThan(area.u0 - 0.05);
      expect(p.uv.u1).toBeGreaterThan(area.u1 + 0.05);
      expect(p.uv.v0).toBeLessThan(area.v0 - 0.1); // até a barra
      expect(p.uv.v1).toBeGreaterThan(area.v1 + 0.05); // até o ombro
      expect(p.pixel).toBeNull();
      // 52 × 70 cm na peça (textura quadrada, cm por UV igual nos dois eixos)
      expect(p.aspecto).toBeCloseTo(70 / 52, 2);
    }
  });

  test("outro GLB fica com a área da spec (sem constante)", () => {
    const outro = { ...CAMISETA, model: { ...CAMISETA.model, url: "https://cdn/moletom.glb" } };
    expect(painelLivre(outro, "front")!.uv).toEqual(CAMISETA.areas[0].uv);
  });

  test("caneca: a volta inteira centrada no lado, de baixo a cima; o verso atravessa a emenda", () => {
    const frente = painelLivre(CANECA, "panel")!;
    expect(frente.uv).toEqual({ u0: 0, v0: 0, u1: 1, v1: 1 });
    expect(frente.pixel).toBeGreaterThan(0);
    // a altura da caneca ÷ a volta (2πr)
    expect(frente.aspecto).toBeGreaterThan(0.2);
    expect(frente.aspecto).toBeLessThan(0.6);
    const verso = painelLivre(CANECA, "back")!;
    expect(verso.uv.u0).toBeCloseTo(0.5, 6);
    expect(verso.uv.u1).toBeCloseTo(1.5, 6);
    expect(retangulosNaTextura(verso.uv, 2048, 1024)).toHaveLength(2);
    expect(painelLivre(CANECA, "wrap")!.uv).toEqual({ u0: 0, v0: 0, u1: 1, v1: 1 });
    expect(painelLivre(CANECA, "nada")).toBeNull();
  });
});

// Um contexto 2D de mentira, que guarda o que o pintor fez.
function ctxFalso() {
  const chamadas: Array<[string, any[]]> = [];
  const ctx: any = new Proxy({}, {
    get(alvo: any, k: string) {
      if (k in alvo) return alvo[k];
      if (k === "measureText") return (t: string) => ({ width: String(t).length * 50 });
      return (...a: any[]) => { chamadas.push([k, a]); };
    },
    set(alvo: any, k: string, v: any) { alvo[k] = v; return true; },
  });
  return { ctx, chamadas };
}

const IMG: any = { width: 400, height: 200 }; // deitada: aspecto 0,5

function arteLivre(u: number, v: number, escala: number, extra: Partial<ArteDoLado> = {}): ArteDoLado {
  return {
    v: 1, lado: "front", areaCm: { w: 28, h: 35 }, tecnica: "dtf", livre: true,
    imagens: [{ campo: "image", url: "https://r2/a.png", ajuste: ajusteDoLayout(ajusteLivreValido({ u, v, escala })), arquivo: null }],
    textos: [],
    ...extra,
  };
}

describe("o pintor na posição livre", () => {
  const painel = { x: 100, y: 50, w: 800, h: 1000 };

  test("sem corte na área: o recorte é o painel inteiro e a arte passa do tamanho da área de impressão", () => {
    const { ctx, chamadas } = ctxFalso();
    pintarArteNaArea(ctx, painel, arteLivre(0.5, 0.3, 0.9), new Map([["https://r2/a.png", IMG]]), { livre: true });
    const recortes = chamadas.filter(([k]) => k === "rect").map(([, a]) => a);
    expect(recortes).toEqual([[100, 50, 800, 1000]]);
    const desenho = chamadas.find(([k]) => k === "drawImage")!;
    // largura = 0,9 do painel (unidade do painel: px, pixel quadrado)
    expect(desenho[1][3]).toBeCloseTo(720, 6);
    expect(desenho[1][4]).toBeCloseTo(360, 6);
    // nenhuma margem de segurança desenhada
    expect(chamadas.some(([k]) => k === "strokeRect")).toBe(false);
    // e o centro vai para onde a lojista pôs (translate do item)
    const t = chamadas.find(([k]) => k === "translate")!;
    expect(t[1]).toEqual([100 + 0.5 * 800, 50 + 0.3 * 1000]);
  });

  test("pixel não quadrado (caneca): a arte sai na proporção dela na peça", () => {
    const { ctx, chamadas } = ctxFalso();
    pintarArteNaArea(ctx, painel, arteLivre(0.5, 0.5, 0.5), new Map([["https://r2/a.png", IMG]]), { livre: true, pixel: 2 });
    const esc = chamadas.find(([k]) => k === "scale")!;
    // pixel 2 = dois pixels da textura por unidade na horizontal para um na
    // vertical: o painel de 800 px mede 400 na peça, e a textura estica 2×.
    expect(esc[1][0]).toBeCloseTo(2, 6);
    expect(esc[1][1]).toBeCloseTo(1, 6);
    const d = chamadas.find(([k]) => k === "drawImage")!;
    // na peça (em pixels verticais): largura = metade dos 400; altura = metade disso (aspecto 0,5)
    expect(d[1][3]).toBeCloseTo(200, 6);
    expect(d[1][4]).toBeCloseTo(100, 6);
  });

  test("editando: a caixa e as quatro alças da arte, sem a margem da área", () => {
    const { ctx, chamadas } = ctxFalso();
    pintarArteNaArea(ctx, painel, arteLivre(0.5, 0.5, 0.4, { editando: true, selecionado: "image" }), new Map([["https://r2/a.png", IMG]]), { livre: true });
    expect(chamadas.filter(([k]) => k === "fillRect")).toHaveLength(4);
  });

  test("sem `livre`, o pintor segue igual (área de impressão com recorte na sub-área)", () => {
    const { ctx, chamadas } = ctxFalso();
    const arte = { ...arteLivre(0.5, 0.5, 0.4), livre: undefined };
    pintarArteNaArea(ctx, painel, arte, new Map([["https://r2/a.png", IMG]]), { areaCmDoMotor: { w: 28, h: 35 } });
    expect(chamadas.filter(([k]) => k === "rect").map(([, a]) => a)).toEqual([[100, 50, 800, 1000]]);
  });
});

describe("os limites da posição livre", () => {
  test("o centro fica dentro do painel e o tamanho nos limites", () => {
    expect(ajusteLivreValido({ u: -0.4, v: 1.7, escala: 9 })).toEqual({ livre: true, u: 0, v: 1, escala: 3 });
    expect(ajusteLivreValido({ u: 0.2, v: 0.2, escala: 0 }).escala).toBe(ESCALA_LIVRE_MIN);
    expect(ajusteLivreValido({ u: "x" as any, v: NaN, escala: undefined })).toEqual({ livre: true, u: 0.5, v: 0.5, escala: 0.5 });
    expect(moverLivre(ajusteLivreValido({ u: 0.95, v: 0.5, escala: 0.2 }), 0.2, 0).u).toBe(1);
  });

  test("rotação em graus, entre -180 e 180, sem -0", () => {
    expect(rotacaoValida(375)).toBe(15);
    expect(rotacaoValida(-195)).toBe(165);
    expect(rotacaoValida(-360)).toBe(0);
    expect(girarLivre(ajusteLivreValido({}), -15).rotacao).toBe(-15);
    expect(girarLivre(girarLivre(ajusteLivreValido({}), 15), -15).rotacao).toBeUndefined();
  });

  test("encaixar no painel: inteira, o maior possível; o teto do tamanho cobre o painel", () => {
    // arte deitada (0,5) num painel em pé (1,35): cabe pela largura
    expect(encaixarNoPainel(0.5, 1.35)).toEqual({ livre: true, u: 0.5, v: 0.5, escala: 1 });
    // arte alta (2) no mesmo painel: cabe pela altura
    const alta = encaixarNoPainel(2, 1.35);
    expect(alturaNoPainel(alta.escala, 2, 1.35)).toBeCloseTo(1, 3);
    // cobrir o painel com a arte deitada pede 2,7 larguras de painel
    expect(escalaMaxima(0.5, 1.35)).toBeCloseTo(2.7, 3);
    expect(escalarLivre(ajusteLivreValido({ escala: 1 }), 10, escalaMaxima(0.5, 1.35)).escala).toBeCloseTo(2.7, 3);
    expect(centralizar(ajusteLivreValido({ u: 0.1, v: 0.9, escala: 0.3 }))).toEqual({ livre: true, u: 0.5, v: 0.5, escala: 0.3 });
  });

  test("o toque pega o canto (tamanho), o miolo (mover) ou nada (a peça gira)", () => {
    const a = ajusteLivreValido({ u: 0.5, v: 0.5, escala: 0.4 });
    // arte quadrada num painel quadrado: caixa de 0,3 a 0,7
    expect(alvoDoToque(a, 1, 1, 0.5, 0.5, 0.02)).toBe("miolo");
    expect(alvoDoToque(a, 1, 1, 0.7, 0.3, 0.02)).toBe("canto");
    expect(alvoDoToque(a, 1, 1, 0.9, 0.9, 0.02)).toBeNull();
    // girada 45°: o canto de antes fica fora da arte
    const g = girarLivre(a, 45);
    expect(alvoDoToque(g, 1, 1, 0.69, 0.31, 0.01)).toBeNull();
  });

  test("ao liberar, a arte começa onde o encaixe da área a punha", () => {
    const area = CAMISETA.areas[0].uv;
    const p = painelLivre(CAMISETA, "front")!;
    const a = livreDaArea(null, area, p.uv, 1, p.aspecto);
    const pw = p.uv.u1 - p.uv.u0, ph = p.uv.v1 - p.uv.v0;
    // o centro da área de impressão, medido no painel (v para baixo)
    expect(a.u).toBeCloseTo(((area.u0 + area.u1) / 2 - p.uv.u0) / pw, 2);
    expect(a.v).toBeCloseTo((p.uv.v1 - (area.v0 + area.v1) / 2) / ph, 2);
    // arte quadrada na área de 28 × 35: a largura da área menos a margem
    expect(a.escala).toBeLessThan((area.u1 - area.u0) / pw);
    expect(a.escala).toBeGreaterThan(0.8 * (area.u1 - area.u0) / pw);
  });
});

describe("dados e compatibilidade", () => {
  const base: ArtesDaPeca = { imagens: { front: "https://r2/f.png", back: "https://r2/b.png" }, ajustes: {}, estendida: false, cor: null };

  test("o ajuste antigo continua lido e escrito igual", () => {
    const antigo = { orcamento_ajustes: { front: { escala: 1.2, dx: 0.1, dy: 0 } }, image: "https://r2/f.png" };
    const a = artesDoItem(cfg(), antigo);
    expect(a.ajustes.front).toEqual({ escala: 1.2, dx: 0.1, dy: 0 });
    expect(livreDoLado(a, "front")).toBeNull();
    expect(customizacaoComArtes(cfg(), antigo, a)[CHAVE_DOS_AJUSTES]).toEqual({ front: { escala: 1.2, dx: 0.1, dy: 0 } });
  });

  test("livre e antigo convivem por lado, e a prévia só vai com a posição livre", () => {
    let a = comLivre(base, "front", { u: 0.3, v: 0.2, escala: 0.25, rotacao: 15 });
    a = ajustarLado(a, "back", { escala: 0.8 });
    a = comPrevia(a, "front", "https://r2/previa-f.png");
    a = comPrevia(a, "back", "https://r2/nao-vai.png"); // o verso não está livre
    const c = customizacaoComArtes(cfg(), {}, a);
    expect(c[CHAVE_DOS_AJUSTES]).toEqual({
      front: { livre: true, u: 0.3, v: 0.2, escala: 0.25, rotacao: 15 },
      back: { escala: 0.8, dx: 0, dy: 0 },
    });
    expect(c[PREFIXO_DA_PREVIA + "front"]).toBe("https://r2/previa-f.png");
    expect(c[PREFIXO_DA_PREVIA + "back"]).toBeUndefined();
    // e volta do item igual
    const lido = artesDoItem(cfg(), c);
    expect(livreDoLado(lido, "front")).toEqual({ livre: true, u: 0.3, v: 0.2, escala: 0.25, rotacao: 15 });
    expect(lido.previas).toEqual({ front: "https://r2/previa-f.png" });
    expect(ajusteDoLado(lido, "back")).toEqual({ escala: 0.8, dx: 0, dy: 0 });
    expect(ajusteDoLado(lido, "front")).toEqual({ escala: 1, dx: 0, dy: 0 });
  });

  test("mexer na arte livre apaga a prévia velha; voltar à área apaga a posição livre", () => {
    let a = comPrevia(comLivre(base, "front", { u: 0.3, v: 0.2, escala: 0.25 }), "front", "https://r2/p.png");
    expect(comLivre(a, "front", { u: 0.4, v: 0.2, escala: 0.25 }).previas).toEqual({});
    expect(comImagem(a, "front", "https://r2/outra.png").ajustes.front).toBeUndefined();
    a = ajustarLado(a, "front", null);
    expect(a.ajustes.front).toBeUndefined();
    const c = customizacaoComArtes(cfg(), { [PREFIXO_DA_PREVIA + "front"]: "https://r2/p.png" }, a);
    expect(c[PREFIXO_DA_PREVIA + "front"]).toBeUndefined();
    expect(c[CHAVE_DOS_AJUSTES]).toBeUndefined();
    expect(ehLivre({ livre: "sim" })).toBe(false);
  });

  test("o motor pinta o lado livre no painel inteiro: só a imagem, sem caixa-alvo nem aparar", () => {
    const a = comLivre(base, "front", { u: 0.5, v: 0.3, escala: 0.6 });
    const m = motorDasArtes(cfg(), { texto_antigo: "x" }, a, CAMISETA, "camiseta", "front");
    const frente = m.values.__artePorArea.front as ArteDoLado;
    expect(frente.livre).toBe(true);
    expect(frente.textos).toEqual([]);
    expect(frente.imagens).toHaveLength(1);
    expect(frente.imagens[0].ajuste).toEqual({ v: 1, cx: 0.5, cy: 0.3, larg: 0.6, rot: 0, encaixe: "livre" });
    expect(frente.imagens[0].caixa).toBeUndefined();
    expect(frente.imagens[0].aparar).toBeUndefined();
    expect(frente.editando).toBe(true);
    // o verso segue no encaixe da área, e sem as alças
    const verso = m.values.__artePorArea.back as ArteDoLado;
    expect(verso.livre).toBeUndefined();
    expect(verso.imagens[0].caixa).toBeDefined();
    // o vídeo e o pedido (sem edição) usam a mesma posição, sem alças
    const video = motorDasArtes(cfg(), {}, a, CAMISETA, "camiseta");
    expect(video.values.__artePorArea.front.editando).toBe(false);
    expect(video.values.__artePorArea.front.imagens[0].ajuste).toEqual(frente.imagens[0].ajuste);
  });

  test("a ficha diz \"posição livre, veja a prévia\" e rotula a prévia", () => {
    expect(textoDosAjustesDoOrcamento({ front: { livre: true, u: 0.5, v: 0.5, escala: 0.4 }, back: { escala: 1.2, dx: 0, dy: 0 } }))
      .toBe("Frente: posição livre, veja a prévia · Verso 120%");
    expect(rotuloDaChave(PREFIXO_DA_PREVIA + "front", {})).toBe("Prévia da arte livre — Frente");
  });
});
