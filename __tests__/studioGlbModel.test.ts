// ============================================================
// AURA Studio — 27/09/2026: a peça em GLB no viewer 3D
//
// O viewer só montava a caneca procedural. Com `model.kind = "glb"` ele
// carrega qualquer peça (a camiseta primeiro). O three.js vem do CDN e
// só existe no web; o que dá para testar aqui é a aritmética que decide
// o que a cena faz com o arquivo: a leitura da spec, a escala que leva a
// peça ao tamanho da cena, a câmera pela caixa, o retângulo da textura e
// a escolha do mesh que recebe a arte.
// ============================================================
import {
  readGlbModel, isGlbSpec, escalaDoModelo, cameraDistanceParaCaixa, floorLevelParaCaixa,
  sombraDeContatoParaCaixa, uvParaRetangulo, escolherMeshDeImpressao, recebeCorDoCliente,
  pixelsPorCm, fiosDoLadrilho, ALTURA_ALVO_DO_MODELO,
} from "@/components/studio/visualEngine/glbModel";
import { MUG_GEOMETRY_PADRAO } from "@/components/studio/visualEngine/mugGeometry";
import { CAMERA_DISTANCIA_PADRAO, CAMERA_FOV_GRAUS, cameraDistance } from "@/components/studio/visualEngine/mugScene";

const URL = "https://app.getaura.com.br/models/camiseta-basica.glb";

describe("readGlbModel — o que é e o que não é uma spec de GLB", () => {
  it("a caneca procedural não é GLB", () => {
    expect(readGlbModel({ model: { kind: "procedural-mug" } })).toBeNull();
    expect(isGlbSpec({ model: { kind: "procedural-mug" } })).toBe(false);
    expect(readGlbModel(null)).toBeNull();
    expect(readGlbModel({})).toBeNull();
  });

  // A vitrine roda em loja.getaura.com.br e o JS vem de app.getaura.com.br:
  // um caminho relativo apontaria para o host errado.
  it("GLB sem url absoluta não vale", () => {
    expect(readGlbModel({ model: { kind: "glb" } })).toBeNull();
    expect(readGlbModel({ model: { kind: "glb", url: "/models/camiseta.glb" } })).toBeNull();
    expect(readGlbModel({ model: { kind: "glb", url: "   " } })).toBeNull();
  });

  it("só a url basta: o resto tem padrão", () => {
    const g = readGlbModel({ model: { kind: "glb", url: URL } })!;
    expect(g).toEqual({
      url: URL,
      scale: 1,
      rotationY: 0,
      camera: { distance: null, height: 0.2, fov: CAMERA_FOV_GRAUS },
      printMesh: null,
      customerColorTargets: null,
      fabric: { roughness: 0.85, normalScale: 0.35 },
      texture: { w: 2048, h: 1024 },
    });
  });

  it("lê todos os campos da camiseta", () => {
    const g = readGlbModel({
      model: {
        kind: "glb", url: URL, scale: 1.1, rotation_y: 180,
        camera: { distance: 9, height: 0.15, fov: 28 },
        print_mesh: "T-Shirt",
        texture: { w: 1420, h: 2048 },
        materials: { customer_color_targets: ["T-Shirt", " Gola ", ""], fabric: { roughness: 0.9, normal_scale: 0.5 } },
      },
    })!;
    expect(g.scale).toBe(1.1);
    expect(g.rotationY).toBe(180);
    expect(g.camera).toEqual({ distance: 9, height: 0.15, fov: 28 });
    expect(g.printMesh).toBe("T-Shirt");
    expect(g.customerColorTargets).toEqual(["T-Shirt", "Gola"]);
    expect(g.fabric).toEqual({ roughness: 0.9, normalScale: 0.5 });
    expect(g.texture).toEqual({ w: 1420, h: 2048 });
  });

  it("lista vazia de alvos é cor fixa; ausente é 'o mesh de impressão'", () => {
    expect(readGlbModel({ model: { kind: "glb", url: URL, materials: { customer_color_targets: [] } } })!.customerColorTargets).toEqual([]);
    expect(readGlbModel({ model: { kind: "glb", url: URL, materials: {} } })!.customerColorTargets).toBeNull();
  });

  // Um template mal cadastrado não pode deformar a cena numa loja no ar.
  it("valor fora de faixa cai no padrão em vez de quebrar a cena", () => {
    const g = readGlbModel({
      model: { kind: "glb", url: URL, scale: 0, rotation_y: "muito", camera: { fov: 500, height: 9 }, materials: { fabric: { roughness: 2 } } },
    })!;
    expect(g.scale).toBe(1);
    expect(g.rotationY).toBe(0);
    expect(g.camera.fov).toBe(CAMERA_FOV_GRAUS);
    expect(g.camera.height).toBe(0.2);
    expect(g.fabric.roughness).toBe(0.85);
  });
});

describe("escala — toda peça ganha a altura da caneca", () => {
  it("a altura alvo é a da caneca padrão", () => {
    expect(ALTURA_ALVO_DO_MODELO).toBe(MUG_GEOMETRY_PADRAO.body.height);
  });

  // A camiseta do Poly Pizza mede 0,35 de altura; em metros seria 0,7.
  it("um GLB pequeno cresce e um grande encolhe até a altura alvo", () => {
    expect(escalaDoModelo({ width: 0.76, height: 0.3456, depth: 0.17 }) * 0.3456).toBeCloseTo(ALTURA_ALVO_DO_MODELO, 6);
    expect(escalaDoModelo({ width: 40, height: 70, depth: 20 }) * 70).toBeCloseTo(ALTURA_ALVO_DO_MODELO, 6);
  });

  it("o ajuste da spec multiplica a normalização", () => {
    expect(escalaDoModelo({ width: 1, height: 2.3, depth: 1 }, 1.5)).toBeCloseTo(1.5, 6);
  });

  it("caixa sem altura não divide por zero", () => {
    expect(escalaDoModelo({ width: 1, height: 0, depth: 1 })).toBe(1);
    expect(escalaDoModelo({ width: 1, height: 0, depth: 1 }, 2)).toBe(2);
  });
});

describe("câmera pela caixa — a distância de sempre, e mais longe só quando precisa", () => {
  const ASPECTO = 1 / 0.78; // o canvas do viewer

  it("uma peça da altura da caneca fica na distância da caneca", () => {
    expect(cameraDistanceParaCaixa({ width: 1.5, height: ALTURA_ALVO_DO_MODELO }, ASPECTO)).toBe(CAMERA_DISTANCIA_PADRAO);
  });

  // A regra da caneca por altura é a mesma: a Chopp (3.3) afasta na proporção.
  it("por altura, coincide com a regra da caneca", () => {
    const chopp = { ...MUG_GEOMETRY_PADRAO, body: { ...MUG_GEOMETRY_PADRAO.body, height: 3.3 } };
    const daCaneca = cameraDistance(chopp, { spoon: false, saucer: false });
    expect(cameraDistanceParaCaixa({ width: 1, height: 3.3 }, ASPECTO)).toBeCloseTo(daCaneca, 2);
  });

  // A camiseta de mangas abertas é mais larga que alta: 5.07 × 2.3.
  it("uma peça larga afasta a câmera pela largura", () => {
    const d = cameraDistanceParaCaixa({ width: 5.07, height: ALTURA_ALVO_DO_MODELO }, ASPECTO);
    expect(d).toBeGreaterThan(CAMERA_DISTANCIA_PADRAO);
    // e num canvas mais largo a mesma peça precisa de menos recuo
    expect(cameraDistanceParaCaixa({ width: 5.07, height: ALTURA_ALVO_DO_MODELO }, 2)).toBeLessThan(d);
  });

  it("peça baixa e estreita NÃO aproxima a câmera", () => {
    expect(cameraDistanceParaCaixa({ width: 0.5, height: 0.8 }, ASPECTO)).toBe(CAMERA_DISTANCIA_PADRAO);
  });

  it("fov mais fechado pede mais distância", () => {
    const aberto = cameraDistanceParaCaixa({ width: 5, height: 5 }, 1, 40);
    const fechado = cameraDistanceParaCaixa({ width: 5, height: 5 }, 1, 20);
    expect(fechado).toBeGreaterThan(aberto);
  });
});

describe("chão e mancha", () => {
  it("o chão é a base da caixa centrada", () => {
    expect(floorLevelParaCaixa({ height: 2.3 })).toBeCloseTo(-1.15, 6);
  });

  // 27/09/2026 — a mancha é uma elipse sob a barra: a caixa da camiseta
  // é larga por causa das mangas abertas, mas o que toca o chão é a barra.
  it("a mancha de contato é uma elipse: mais estreita que a caixa, quase tão funda quanto ela", () => {
    const s = sombraDeContatoParaCaixa({ width: 3.26, height: 2.3, depth: 1.12 });
    expect(s.rx).toBeCloseTo(3.26 * 0.3, 6);
    expect(s.rx).toBeLessThan(3.26 / 2);
    expect(s.rz).toBeCloseTo(1.12 * 0.8, 6);
    // peça chapada (profundidade ~0): a mancha ainda tem alguma profundidade
    expect(sombraDeContatoParaCaixa({ width: 3, height: 2, depth: 0.01 }).rz).toBeCloseTo(0.36, 6);
  });
});

describe("trama em escala real — fios por cm medidos pela área da spec", () => {
  const spec = {
    areas: [{ id: "front", width_cm: 21, height_cm: 28, uv: { u0: 0.16, v0: 0.12, u1: 0.35, v1: 0.37 } }],
  };

  it("pixels por cm vêm da largura da área em UV vezes a textura", () => {
    // 0,19 × 2048 = 389 px para 21 cm
    expect(pixelsPorCm(spec, 2048)).toBeCloseTo((0.19 * 2048) / 21, 6);
    expect(pixelsPorCm({ areas: [{ id: "x", uv: { u0: 0, u1: 0.5 } }] }, 2048)).toBeNull(); // sem width_cm
    expect(pixelsPorCm({ areas: [{ id: "x", width_cm: 21 }] }, 2048)).toBeNull();          // sem uv
    expect(pixelsPorCm({}, 2048)).toBeNull();
    expect(pixelsPorCm(null, 2048)).toBeNull();
  });

  it("numa área de 28 cm cabem centenas de fios, não dezenas", () => {
    const px = pixelsPorCm(spec, 2048)!;
    const fios = fiosDoLadrilho(px);
    // 8 fios/cm → passo de ~2,3 px → 64 px / 2,3 ≈ 28 fios por ladrilho
    expect(fios).toBe(28);
    const fiosEm28cm = (28 * px) / (64 / fios);
    expect(fiosEm28cm).toBeGreaterThan(200);
    expect(fiosEm28cm).toBeLessThan(260);
  });

  it("sem escala conhecida fica o ladrilho de 8 fios; extremos ficam entre 4 e 32", () => {
    expect(fiosDoLadrilho(null)).toBe(8);
    expect(fiosDoLadrilho(0)).toBe(8);
    expect(fiosDoLadrilho(1000)).toBe(4);   // textura minúscula por cm: fio gigante
    expect(fiosDoLadrilho(0.5)).toBe(32);   // textura enorme por cm: fio de subpixel, teto
  });
});

describe("uvParaRetangulo — v cresce para cima na UV, y para baixo no canvas", () => {
  it("o painel da caneca cai onde sempre caiu", () => {
    // caneca-classica: painel em u 0.05–0.45, v 0.15–0.85 numa 2048×1024
    expect(uvParaRetangulo({ u0: 0.05, v0: 0.15, u1: 0.45, v1: 0.85 }, 2048, 1024)).toEqual({
      x: 0.05 * 2048, y: (1 - 0.85) * 1024, w: 0.4 * 2048, h: 0.7 * 1024,
    });
  });

  it("o peito da camiseta, numa textura retangular", () => {
    const r = uvParaRetangulo({ u0: 0.12, v0: 0.12, u1: 0.39, v1: 0.37 }, 1420, 2048);
    expect(r.x).toBeCloseTo(170.4, 3);
    expect(r.y).toBeCloseTo(1290.24, 3);
    expect(r.w).toBeCloseTo(383.4, 3);
    expect(r.h).toBeCloseTo(512, 3);
  });

  it("v1 = 1 é o topo do canvas", () => {
    expect(uvParaRetangulo({ u0: 0, v0: 0.5, u1: 1, v1: 1 }, 100, 100).y).toBe(0);
  });
});

describe("escolherMeshDeImpressao — quem recebe a arte", () => {
  const meshes = [
    { name: "Etiqueta", materialName: "Papel", vertices: 8 },
    { name: "T-Shirt", materialName: "Top_shd", vertices: 3716 },
    { name: "Gola", materialName: "Ribana", vertices: 120 },
  ];

  it("sem declaração, o mesh de mais vértices (o tecido)", () => {
    expect(escolherMeshDeImpressao(meshes, null)).toBe(1);
  });

  it("declarado pelo nome do mesh ou do material, sem distinguir caixa", () => {
    expect(escolherMeshDeImpressao(meshes, "gola")).toBe(2);
    expect(escolherMeshDeImpressao(meshes, "PAPEL")).toBe(0);
  });

  it("nome sem correspondência cai no maior, em vez de sumir com a arte", () => {
    expect(escolherMeshDeImpressao(meshes, "Manga")).toBe(1);
  });

  it("sem meshes devolve -1", () => {
    expect(escolherMeshDeImpressao([], "T-Shirt")).toBe(-1);
  });
});

describe("recebeCorDoCliente", () => {
  const tecido = { name: "T-Shirt", materialName: "Top_shd" };
  const gola = { name: "Gola", materialName: "Ribana" };

  it("sem lista, só o mesh de impressão muda de cor", () => {
    expect(recebeCorDoCliente(tecido, true, null)).toBe(true);
    expect(recebeCorDoCliente(gola, false, null)).toBe(false);
  });

  it("com lista, vale o nome do mesh ou do material", () => {
    expect(recebeCorDoCliente(gola, false, ["ribana"])).toBe(true);
    expect(recebeCorDoCliente(gola, false, ["Gola"])).toBe(true);
    expect(recebeCorDoCliente(tecido, true, ["Gola"])).toBe(false);
  });

  it("lista vazia é cor fixa do arquivo", () => {
    expect(recebeCorDoCliente(tecido, true, [])).toBe(false);
  });
});
