// ============================================================
// AURA Studio — 04/09/2026: a cena "foto de estúdio" do mockup 3D
//
// O mockup era um cilindro sobre um fundo chapado. Ganhou fundo em
// gradiente, chão com sombra, câmera que recua para o modelo alto e
// vidro com arte opaca. A parte three.js só dá para conferir olhando
// (CDN, web); estes testes cobrem a aritmética que decide onde cada
// coisa fica — que é onde um número errado passa despercebido.
// ============================================================
import {
  hexToRgb, mixHex, hexToRgba, backdropPalette,
  cameraDistance, floorLevel, contactShadowRadius, alturaDaCena,
  CAMERA_DISTANCIA_PADRAO,
  cenarioPalette, perfilDoCiclorama, brilhoDoCiclorama, CICLORAMA, giroMaisCurto, luminancia,
} from "@/components/studio/visualEngine/mugScene";
import { MUG_GEOMETRY_PADRAO, readMugGeometry } from "@/components/studio/visualEngine/mugGeometry";

const SEM_ACESSORIO = { spoon: false, saucer: false };

describe("cores do fundo", () => {
  it("lê #RGB e #RRGGBB; recusa o resto", () => {
    expect(hexToRgb("#FFF")).toEqual([255, 255, 255]);
    expect(hexToRgb("#fbf8f3")).toEqual([251, 248, 243]);
    expect(hexToRgb("papel")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });

  it("mistura na proporção pedida e devolve hex", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#ffffff");
  });

  it("cor inválida na mistura devolve a primeira, sem lançar", () => {
    expect(mixHex("#ABCDEF", "azul", 0.5)).toBe("#ABCDEF");
  });

  // O vidro pinta o fundo da textura com alfa e a arte opaca por cima.
  it("hexToRgba embute o alfa, limitado a 0–1", () => {
    expect(hexToRgba("#FFFFFF", 0.34)).toBe("rgba(255,255,255,0.34)");
    expect(hexToRgba("#000", 7)).toBe("rgba(0,0,0,1)");
    expect(hexToRgba("vidro", 0.5)).toBe("vidro");
  });

  it("a paleta clareia em cima e escurece embaixo a partir da base", () => {
    const p = backdropPalette("#FBF8F3");
    const base = hexToRgb("#FBF8F3")!;
    expect(hexToRgb(p.top)![0]).toBeGreaterThanOrEqual(base[0]);
    expect(hexToRgb(p.bottom)![0]).toBeLessThan(base[0]);
  });

  it("base inválida cai no papel da vitrine em vez de quebrar a cena", () => {
    expect(backdropPalette("qualquer")).toEqual(backdropPalette("#FBF8F3"));
  });
});

describe("câmera — a distância de sempre, e mais longe só quando precisa", () => {
  it("a caneca padrão fica na distância que sempre teve", () => {
    expect(cameraDistance(MUG_GEOMETRY_PADRAO, SEM_ACESSORIO)).toBe(CAMERA_DISTANCIA_PADRAO);
  });

  it("modelo baixo (xícara) NÃO aproxima a câmera", () => {
    const xicara = readMugGeometry({ model: { geometry: { body: { height: 1.6 } } } });
    expect(cameraDistance(xicara, SEM_ACESSORIO)).toBe(CAMERA_DISTANCIA_PADRAO);
  });

  // Chopp: altura 3.3 não cabia no enquadramento fixo.
  it("modelo alto afasta a câmera na proporção da altura", () => {
    const chopp = readMugGeometry({ model: { geometry: { body: { height: 3.3 } } } });
    const d = cameraDistance(chopp, SEM_ACESSORIO);
    expect(d).toBeGreaterThan(CAMERA_DISTANCIA_PADRAO);
    expect(d).toBeCloseTo(CAMERA_DISTANCIA_PADRAO * (3.3 / 2.3), 1);
  });

  it("colher e pires contam na altura da cena", () => {
    const g = MUG_GEOMETRY_PADRAO;
    expect(alturaDaCena(g, { spoon: true, saucer: false })).toBeGreaterThan(alturaDaCena(g, SEM_ACESSORIO));
    expect(alturaDaCena(g, { spoon: false, saucer: true })).toBeGreaterThan(alturaDaCena(g, SEM_ACESSORIO));
  });
});

describe("chão e sombra de contato", () => {
  it("o chão é a base da caneca", () => {
    expect(floorLevel(MUG_GEOMETRY_PADRAO, SEM_ACESSORIO)).toBeCloseTo(-1.15, 6);
  });

  it("com pires, o chão desce para a base do pires", () => {
    expect(floorLevel(MUG_GEOMETRY_PADRAO, { spoon: false, saucer: true })).toBeLessThan(-1.15);
  });

  it("a mancha é maior que a base, e segue o pires quando existe", () => {
    const semPires = contactShadowRadius(MUG_GEOMETRY_PADRAO, SEM_ACESSORIO);
    expect(semPires).toBeGreaterThan(MUG_GEOMETRY_PADRAO.body.bottomRadius);
    expect(contactShadowRadius(MUG_GEOMETRY_PADRAO, { spoon: false, saucer: true })).toBeGreaterThan(semPires);
  });
});

// ── 28/09/2026 — o cenário (ciclorama) e os chips absolutos ─────────
describe("cenário — a paleta do ciclorama a partir do fundo da página", () => {
  it("no papel da vitrine, o chão junto da peça é quase o papel e o quadro escurece de leve", () => {
    const p = cenarioPalette("#FBF8F3");
    expect(p.escuro).toBe(false);
    // base a menos de 3% do papel
    const base = hexToRgb(p.base)!, papel = hexToRgb("#FBF8F3")!;
    for (let c = 0; c < 3; c++) expect(Math.abs(base[c] - papel[c])).toBeLessThanOrEqual(3);
    expect(luminancia(p.fundo)).toBeLessThan(luminancia(p.base));
    expect(p.halo).toBeGreaterThanOrEqual(1);
    expect(p.vinheta).toBeGreaterThan(0);
    expect(p.vinheta).toBeLessThan(0.3);
  });

  it("no tema escuro, o estúdio fica um degrau acima do fundo e o halo é forte", () => {
    const p = cenarioPalette("#060816");
    expect(p.escuro).toBe(true);
    expect(luminancia(p.base)).toBeGreaterThan(luminancia("#060816"));
    expect(luminancia(p.base)).toBeLessThan(0.2);
    expect(p.halo).toBeGreaterThan(1.5);
    expect(p.sombra).toBeGreaterThan(cenarioPalette("#FBF8F3").sombra);
  });

  it("cor inválida cai no papel da vitrine", () => {
    expect(cenarioPalette("papel")).toEqual(cenarioPalette("#FBF8F3"));
  });
});

describe("cenário — o perfil e o brilho do ciclorama", () => {
  it("o perfil vai do chão (na frente da câmera) à parede, sem degrau em y", () => {
    const inicio = perfilDoCiclorama(0);
    expect(inicio.y).toBe(0);
    expect(inicio.z).toBe(CICLORAMA.frente);
    const fim = perfilDoCiclorama(1);
    expect(fim.z).toBeCloseTo(CICLORAMA.fimDoChao - CICLORAMA.raio, 6);
    expect(fim.y).toBeCloseTo(CICLORAMA.raio + CICLORAMA.parede, 6);
    let anterior = perfilDoCiclorama(0);
    for (let i = 1; i <= 200; i++) {
      const p = perfilDoCiclorama(i / 200);
      expect(p.y).toBeGreaterThanOrEqual(anterior.y - 1e-9); // nunca desce
      expect(p.z).toBeLessThanOrEqual(anterior.z + 1e-9);    // nunca volta para a câmera
      anterior = p;
    }
  });

  it("a curva é tangente ao chão e à parede (quarto de círculo)", () => {
    const C = CICLORAMA;
    const chao = C.frente - C.fimDoChao, curva = (Math.PI / 2) * C.raio, total = chao + curva + C.parede;
    const fimDoChao = perfilDoCiclorama(chao / total);
    expect(fimDoChao.y).toBeCloseTo(0, 6);
    expect(fimDoChao.z).toBeCloseTo(C.fimDoChao, 6);
    const inicioDaParede = perfilDoCiclorama((chao + curva) / total);
    expect(inicioDaParede.y).toBeCloseTo(C.raio, 6);
    expect(inicioDaParede.z).toBeCloseTo(C.fimDoChao - C.raio, 6);
  });

  it("a parede escurece para cima, o quadro escurece para os lados e o halo clareia atrás da peça", () => {
    const p = cenarioPalette("#FBF8F3");
    const paredeZ = CICLORAMA.fimDoChao - CICLORAMA.raio;
    const pe = brilhoDoCiclorama(0, 1.0, paredeZ, p);
    const alto = brilhoDoCiclorama(0, 5.5, paredeZ, p);
    const lado = brilhoDoCiclorama(9, 1.0, paredeZ, p);
    expect(alto).toBeLessThan(pe);
    expect(lado).toBeLessThan(pe);
    // o halo: atrás da peça é mais claro do que um pouco ao lado
    expect(brilhoDoCiclorama(0, 1.0, paredeZ, p)).toBeGreaterThan(brilhoDoCiclorama(3, 1.0, paredeZ, p));
    // nunca negativo, e no chão junto da peça fica perto de 1
    expect(brilhoDoCiclorama(0, 0, 0, p)).toBeGreaterThan(0.9);
    expect(brilhoDoCiclorama(20, 15, paredeZ, cenarioPalette("#060816"))).toBeGreaterThanOrEqual(0);
  });
});

describe("chips absolutos — o caminho mais curto até o ângulo da área", () => {
  it("meia-volta para trás em vez de volta e meia para a frente", () => {
    const atual = Math.PI * 2; // uma volta inteira depois de arrastar
    const alvo = Math.PI;      // as costas
    const chegada = giroMaisCurto(atual, alvo);
    expect(Math.abs(chegada - atual)).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(((chegada - alvo) / (Math.PI * 2)) % 1).toBeCloseTo(0, 9);
  });

  it("já no ângulo, não mexe; um quarto para cada lado vai pelo lado certo", () => {
    expect(giroMaisCurto(1.5, 1.5)).toBeCloseTo(1.5, 9);
    expect(giroMaisCurto(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(giroMaisCurto(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
    expect(giroMaisCurto(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 9);
  });
});
