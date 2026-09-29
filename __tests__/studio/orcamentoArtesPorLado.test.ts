// ============================================================
// Orçamento com o vídeo em primeiro plano (29/09/2026)
//
// Mockup: docs/mockups/studio-orcamento-video-primeiro-plano.html
//
// O que os testes seguram:
//   - o motor pinta várias áreas na mesma textura; a caneca ganha um verso
//     DERIVADO do painel (meia volta), que atravessa a emenda — e as áreas
//     das specs seguem como antes (a vitrine não muda);
//   - a peça só oferece os lados que o produto E o modelo têm;
//   - as artes por lado vão para o `customization` no formato do pedido
//     (campo do lado ou id canônico, opt-in de verso e de volta inteira);
//   - a estendida substitui frente e verso;
//   - o tamanho e a posição por lado (o ajuste do #1013, por lado).
// ============================================================
import {
  versoDoPainel, areaParaPintar, areaDoLadoNoModelo, retangulosNaTextura, areaParaLado,
} from "@/components/studio/visualEngine/areasDaPeca";
import {
  ladosDaPeca, ladosEmUso, chaveDaImagem, artesDoItem, customizacaoComArtes, motorDasArtes,
  ajustarLado, ajusteDoLado, comImagem, quantasArtes, textoDasArtes, ARTES_VAZIAS, CHAVE_DOS_AJUSTES,
  type ArtesDaPeca,
} from "@/components/studio/orcamentoVideo/artesPorLado";
import { rotuloDaChave, valorDaChave, textoDosAjustesDoOrcamento } from "@/components/studio/customizationConfig";
import type { ArteDoLado } from "@/components/studio/visualEngine/layoutDaArte";

jest.mock("@/services/studioApi", () => ({ studioApi: {} }));
jest.mock("@/services/studioVisualApi", () => ({ studioVisualApi: {} }));
jest.mock("@/components/studio/visualEngine/compose3dMug", () => ({ createModelViewer: jest.fn() }));
jest.mock("@/components/studio/visualEngine/compose2d", () => ({ exportPng: jest.fn() }));
jest.mock("@/components/studio/visualEngine/specDaFotoDoProduto", () => ({ specDaFotoDoProdutoMedida: jest.fn() }));

// As áreas de sempre (docs/studio/visual-templates/teste-3d.html e camiseta-basica-3d.json).
const PAINEL = { id: "panel", width_cm: 9, height_cm: 9.7, uv: { u0: 0.285, v0: 0.18, u1: 0.715, v1: 0.82 } };
const WRAP = { id: "wrap", width_cm: 21, height_cm: 9.7, uv: { u0: 0.02, v0: 0.18, u1: 0.98, v1: 0.82 } };
const CANECA: any = { schema: 1, model: { kind: "procedural" }, areas: [PAINEL, WRAP] };
const CAMISETA: any = {
  schema: 1,
  model: { kind: "glb", url: "https://cdn/camiseta.glb" },
  areas: [
    { id: "front", width_cm: 28, height_cm: 35, uv: { u0: 0.13, v0: 0.6, u1: 0.37, v1: 0.9 } },
    { id: "back", width_cm: 28, height_cm: 35, uv: { u0: 0.6333, v0: 0.6025, u1: 0.8667, v1: 0.8942 } },
  ],
};

const cfgCaneca = (extra: any = {}): any => ({
  print_area: { width_cm: 9, height_cm: 9.7 },
  has_back: true, back_print_area: { width_cm: 9, height_cm: 9.7 },
  has_middle: true, middle_print_area: { width_cm: 21, height_cm: 9.7 },
  fields: [
    { id: "image", type: "image", side: "front", label: "Arte", config: {} },
    { id: "color", type: "color", side: "front", label: "Cor", config: { colors: ["#FFFFFF", "#111827"] } },
  ],
  ...extra,
});

describe("motor: várias áreas na mesma textura", () => {
  test("o verso da caneca é o painel com meia volta, do outro lado da alça", () => {
    const v = versoDoPainel([PAINEL, WRAP])!;
    expect(v.id).toBe("back");
    expect(v.uv!.u0).toBeCloseTo(0.785);
    expect(v.uv!.u1).toBeCloseTo(1.215);
    expect(v.uv!.v0).toBe(0.18);
    expect(v.width_cm).toBe(9);
    // centro em u = 1 ≡ 0: a meia volta do centro do painel (0,5)
    expect((v.uv!.u0 + v.uv!.u1) / 2).toBeCloseTo(1);
  });

  test("painel na outra metade: o verso volta para dentro de [0, 1)", () => {
    const v = versoDoPainel([{ id: "panel", uv: { u0: 0.6, v0: 0, u1: 0.9, v1: 1 } }])!;
    expect(v.uv!.u0).toBeCloseTo(0.1);
    expect(v.uv!.u1).toBeCloseTo(0.4);
  });

  test("áreas da spec saem como antes; o verso derivado só na caneca", () => {
    expect(areaParaPintar(CANECA.areas, "panel", false)).toBe(PAINEL);
    expect(areaParaPintar(CANECA.areas, "wrap", false)).toBe(WRAP);
    expect(areaParaPintar(CANECA.areas, "back", false)!.uv!.u0).toBeCloseTo(0.785);
    expect(areaParaPintar(CAMISETA.areas, "back", true)).toBe(CAMISETA.areas[1]);
    // GLB sem costas não inventa verso; id desconhecido continua null
    expect(areaParaPintar([CAMISETA.areas[0]], "back", true)).toBeNull();
    expect(areaParaPintar(CANECA.areas, "xyz", false)).toBeNull();
    expect(versoDoPainel([{ id: "panel" }])).toBeNull();
  });

  test("a área que atravessa a emenda é pintada duas vezes; as da spec, uma", () => {
    const W = 2000, H = 1000;
    expect(retangulosNaTextura(PAINEL.uv, W, H)).toHaveLength(1);
    expect(retangulosNaTextura(WRAP.uv, W, H)).toHaveLength(1);
    const [a, b] = retangulosNaTextura(versoDoPainel([PAINEL])!.uv!, W, H);
    expect(a.x).toBeCloseTo(1570);
    expect(a.w).toBeCloseTo(860);
    expect(b.x).toBeCloseTo(-430); // uma volta antes: cobre u 0 → 0,215
    expect(b.w).toBe(a.w);
    expect(b.y).toBe(a.y);
  });

  test("lado → área no vídeo: frente e estendida como a vitrine; verso pela área back", () => {
    expect(areaDoLadoNoModelo(CANECA, "front")).toBe("panel");
    expect(areaDoLadoNoModelo(CANECA, "back")).toBe("back");
    expect(areaDoLadoNoModelo(CANECA, "middle")).toBe("wrap");
    expect(areaDoLadoNoModelo(CAMISETA, "front")).toBe("front");
    expect(areaDoLadoNoModelo(CAMISETA, "back")).toBe("back");
    expect(areaDoLadoNoModelo(CAMISETA, "middle")).toBeNull();
    // a vitrine segue igual: o verso da caneca cai no painel
    expect(areaParaLado(CANECA.areas, "back")).toBe("panel");
  });
});

describe("lados da peça: produto ∩ modelo", () => {
  test("caneca com verso e volta inteira", () => {
    expect(ladosDaPeca(cfgCaneca(), CANECA)).toEqual({ faces: ["front", "back"], estendida: true });
  });

  test("produto sem verso nem meio: só a frente", () => {
    expect(ladosDaPeca(cfgCaneca({ has_back: false, has_middle: false }), CANECA)).toEqual({ faces: ["front"], estendida: false });
    expect(ladosDaPeca(null, CANECA)).toEqual({ faces: ["front"], estendida: false });
  });

  test("camiseta: frente e verso; o meio não existe no modelo", () => {
    expect(ladosDaPeca(cfgCaneca(), CAMISETA)).toEqual({ faces: ["front", "back"], estendida: false });
    const soFrente: any = { ...CAMISETA, areas: [CAMISETA.areas[0]] };
    expect(ladosDaPeca(cfgCaneca(), soFrente).faces).toEqual(["front"]);
  });

  test("sem modelo 3D (foto): vale o produto", () => {
    expect(ladosDaPeca(cfgCaneca(), null)).toEqual({ faces: ["front", "back"], estendida: true });
  });

  test("estendida em uso troca frente e verso pela volta inteira", () => {
    const lados = ladosDaPeca(cfgCaneca(), CANECA);
    expect(ladosEmUso({ ...ARTES_VAZIAS, estendida: true }, lados)).toEqual(["middle"]);
    expect(ladosEmUso(ARTES_VAZIAS, lados)).toEqual(["front", "back"]);
    // estendida guardada num produto que não tem mais o meio: frente e verso
    expect(ladosEmUso({ ...ARTES_VAZIAS, estendida: true }, { faces: ["front"], estendida: false })).toEqual(["front"]);
  });
});

describe("artes no customization, no formato do pedido", () => {
  test("a chave é o campo de imagem do lado, ou o id canônico", () => {
    const cfg = cfgCaneca({ fields: [{ id: "f_1", type: "image", side: "front", config: {} }] });
    expect(chaveDaImagem(cfg, "front")).toBe("f_1");
    expect(chaveDaImagem(cfg, "back")).toBe("image_back");
    expect(chaveDaImagem(cfg, "middle")).toBe("image_middle");
    expect(chaveDaImagem(null, "front")).toBe("image");
  });

  test("frente e verso: imagens, opt-in do verso, ajustes e cor", () => {
    const artes: ArtesDaPeca = {
      imagens: { front: "https://r2/frente.png", back: "https://r2/verso.png", middle: "https://r2/volta.png" },
      ajustes: { back: { escala: 1.2, dx: 0.05, dy: 0 } },
      estendida: false,
      cor: "#111827",
    };
    const c = customizacaoComArtes(cfgCaneca(), { image: "velha", text: "Helena", has_middle_selected: true }, artes);
    expect(c.image).toBe("https://r2/frente.png");
    expect(c.image_back).toBe("https://r2/verso.png");
    expect(c.image_middle).toBeUndefined(); // a estendida não vai com frente e verso
    expect(c.has_back_selected).toBe(true);
    expect(c.has_middle_selected).toBeUndefined();
    expect(c[CHAVE_DOS_AJUSTES]).toEqual({ back: { escala: 1.2, dx: 0.05, dy: 0 } });
    expect(c.color).toBe("#111827");
    expect(c.text).toBe("Helena"); // texto que já estava fica
  });

  test("estendida: só a volta inteira vai; frente e verso saem do item", () => {
    const artes: ArtesDaPeca = {
      imagens: { front: "f", back: "b", middle: "https://r2/volta.png" },
      ajustes: { front: { escala: 0.8, dx: 0, dy: 0 } },
      estendida: true,
      cor: null,
    };
    const c = customizacaoComArtes(cfgCaneca(), { has_back_selected: true }, artes);
    expect(c.image_middle).toBe("https://r2/volta.png");
    expect(c.image).toBeUndefined();
    expect(c.image_back).toBeUndefined();
    expect(c.has_middle_selected).toBe(true);
    expect(c.has_back_selected).toBeUndefined();
    expect(c[CHAVE_DOS_AJUSTES]).toBeUndefined(); // o ajuste da frente não vale sem a frente
  });

  test("verso com texto da cliente mantém o opt-in mesmo sem imagem", () => {
    const cfg = cfgCaneca({ fields: [{ id: "text_back", type: "text", side: "back", config: {} }] });
    const c = customizacaoComArtes(cfg, { text_back: "Equipe", has_back_selected: true }, ARTES_VAZIAS);
    expect(c.has_back_selected).toBe(true);
  });

  test("ida e volta: o que foi escrito é o que se lê", () => {
    const artes: ArtesDaPeca = {
      imagens: { front: "https://r2/f.png", back: "https://r2/b.png" },
      ajustes: { front: { escala: 1.3, dx: 0, dy: -0.1 } },
      estendida: false,
      cor: "#FFFFFF",
    };
    const lido = artesDoItem(cfgCaneca(), customizacaoComArtes(cfgCaneca(), {}, artes));
    expect(lido).toEqual(artes);
  });

  test("a chave legível do orçamento antigo (`imagem`) vira a frente", () => {
    const lido = artesDoItem(null, { imagem: "https://r2/antiga.png", cor_da_peca: "#000000" });
    expect(lido.imagens.front).toBe("https://r2/antiga.png");
    expect(lido.cor).toBe("#000000");
    const c = customizacaoComArtes(null, { imagem: "https://r2/antiga.png" }, lido);
    expect(c.imagem).toBeUndefined();
    expect(c.image).toBe("https://r2/antiga.png");
    expect(c.cor_da_peca).toBe("#000000");
  });
});

describe("tamanho e posição por lado", () => {
  test("cada lado tem o seu ajuste; null volta ao automático", () => {
    let a = comImagem(comImagem(ARTES_VAZIAS, "front", "f"), "back", "b");
    a = ajustarLado(a, "front", { escala: 1.2 });
    a = ajustarLado(a, "back", { dx: -0.1 });
    expect(ajusteDoLado(a, "front")).toEqual({ escala: 1.2, dx: 0, dy: 0 });
    expect(ajusteDoLado(a, "back")).toEqual({ escala: 1, dx: -0.1, dy: 0 });
    a = ajustarLado(a, "front", null);
    expect(a.ajustes.front).toBeUndefined();
    expect(a.ajustes.back).toBeDefined();
  });

  test("limites do #1013 valem por lado; voltar ao padrão apaga", () => {
    const a = ajustarLado(ARTES_VAZIAS, "front", { escala: 9, dx: 3 });
    expect(ajusteDoLado(a, "front")).toEqual({ escala: 1.5, dx: 0.5, dy: 0 });
    expect(ajustarLado(a, "front", { escala: 1, dx: 0 }).ajustes.front).toBeUndefined();
  });

  test("trocar a imagem volta o tamanho ao automático", () => {
    const a = ajustarLado(comImagem(ARTES_VAZIAS, "back", "b"), "back", { escala: 0.7 });
    expect(comImagem(a, "back", "b2").ajustes.back).toBeUndefined();
    expect(comImagem(a, "back", null).imagens.back).toBeUndefined();
  });

  test("o selo da peça", () => {
    const lados = ladosDaPeca(cfgCaneca(), CANECA);
    expect(textoDasArtes(ARTES_VAZIAS, lados)).toBe("sem arte");
    expect(textoDasArtes(comImagem(ARTES_VAZIAS, "front", "f"), lados)).toBe("1 arte");
    expect(textoDasArtes(comImagem(comImagem(ARTES_VAZIAS, "front", "f"), "back", "b"), lados)).toBe("2 artes");
    const est = { ...comImagem(ARTES_VAZIAS, "middle", "m"), estendida: true };
    expect(textoDasArtes(est, lados)).toBe("estendida");
    expect(quantasArtes({ ...est, imagens: { front: "f", back: "b", middle: "m" } }, lados)).toBe(1);
  });
});

describe("motorDasArtes: todas as artes no vídeo", () => {
  const artes2: ArtesDaPeca = {
    imagens: { front: "https://r2/f.png", back: "https://r2/b.png" },
    ajustes: { back: { escala: 0.5, dx: 0, dy: 0 } },
    estendida: false,
    cor: "#111827",
  };

  test("caneca frente e verso: painel e verso derivado na mesma textura", () => {
    const m = motorDasArtes(cfgCaneca(), {}, artes2, CANECA, "caneca");
    const porArea = m.values.__artePorArea as Record<string, ArteDoLado>;
    expect(Object.keys(porArea).sort()).toEqual(["back", "panel"]);
    expect(porArea.panel.imagens[0].url).toBe("https://r2/f.png");
    expect(porArea.back.imagens[0].url).toBe("https://r2/b.png");
    expect(porArea.back.lado).toBe("back");
    // o ajuste do verso encolhe só o verso
    expect(porArea.back.imagens[0].caixa!.w).toBeLessThan(porArea.panel.imagens[0].caixa!.w);
    expect(m.opts.garmentColor).toBe("#111827");
    // o plano B (foto 2D) recebe a frente
    expect((m.values.__arte as ArteDoLado).imagens[0].url).toBe("https://r2/f.png");
  });

  test("caneca estendida: só a volta inteira", () => {
    const m = motorDasArtes(cfgCaneca(), {}, { ...artes2, imagens: { ...artes2.imagens, middle: "https://r2/m.png" }, estendida: true }, CANECA, "caneca");
    const porArea = m.values.__artePorArea as Record<string, ArteDoLado>;
    expect(Object.keys(porArea)).toEqual(["wrap"]);
    expect(porArea.wrap.imagens[0].url).toBe("https://r2/m.png");
  });

  test("camiseta: front e back do GLB", () => {
    const m = motorDasArtes(cfgCaneca(), {}, artes2, CAMISETA, "camiseta");
    expect(Object.keys(m.values.__artePorArea).sort()).toEqual(["back", "front"]);
  });

  test("produto sem verso: a arte do verso não entra no vídeo", () => {
    const m = motorDasArtes(cfgCaneca({ has_back: false }), {}, artes2, CANECA, "caneca");
    expect(Object.keys(m.values.__artePorArea)).toEqual(["panel"]);
  });

  test("sem arte: a peça lisa (nenhuma área), sem cair no desenho antigo", () => {
    const m = motorDasArtes(cfgCaneca(), {}, ARTES_VAZIAS, CANECA, "caneca");
    expect(m.values.__artePorArea).toEqual({});
    expect(m.values.__arte).toBeUndefined();
  });
});

describe("a Produção lê as artes do orçamento", () => {
  test("rótulos das chaves canônicas sem campo no produto", () => {
    expect(rotuloDaChave("image_back", {})).toBe("Arte do verso");
    expect(rotuloDaChave("image_middle", {})).toBe("Arte da volta inteira");
    expect(rotuloDaChave("image", {})).toBe("Arte da frente");
    // com campo, vale o rótulo da lojista
    expect(rotuloDaChave("image", { image: { label: "Sua foto", type: "image" } })).toBe("Sua foto");
    expect(rotuloDaChave(CHAVE_DOS_AJUSTES, {})).toBe("Tamanho e posição no orçamento");
  });

  test("o tamanho por lado em uma linha para a oficina", () => {
    const v = { front: { escala: 1.2, dx: 0.05, dy: 0 }, back: { escala: 0.8, dx: 0, dy: -0.1 } };
    expect(textoDosAjustesDoOrcamento(v)).toBe("Frente 120%, 5% à direita · Verso 80%, 10% para cima");
    expect(valorDaChave(v)).toBe("Frente 120%, 5% à direita · Verso 80%, 10% para cima");
    // o ajuste da vitrine (v: 1) segue com o texto de antes
    expect(textoDosAjustesDoOrcamento({ v: 1, cx: 0.5, cy: 0.5 })).toBeNull();
    expect(valorDaChave({ v: 1, cx: 0.5, cy: 0.5 })).toBe("posicionada pela cliente");
  });
});
