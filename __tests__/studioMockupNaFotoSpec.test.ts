// ============================================================
// Mockup na foto real da peça — a spec por produto e a precedência
//
// `customization_config.mockup_foto` vira uma VisualTemplateSpec photo2d
// comum (uma vista por lado, base no tamanho natural da foto com teto
// de 1600 px, quad em coordenadas da base, cm da área cadastrada), e a
// ordem de quem manda é: template do banco > mockup na foto > SVG.
// ============================================================
import {
  FORCA_PADRAO_DO_SOMBREADO,
  LARGURA_MAXIMA_DA_BASE,
  baseDaFoto,
  chaveDoMockupFoto,
  fonteDoMockup,
  specDaFotoDoProduto,
  temMockupNaFoto,
  versaoDoMockupFoto,
  vistaDoLado,
} from "@/components/studio/visualEngine/specDaFotoDoProduto";
import { normalizeCustomizationConfig } from "@/components/studio/customizationConfig";
import type { VisualTemplate } from "@/services/studioVisualApi";

const QUAD_N = [
  { x: 0.3, y: 0.25 },
  { x: 0.7, y: 0.26 },
  { x: 0.68, y: 0.62 },
  { x: 0.32, y: 0.6 },
] as any;

function cfg(extra: Record<string, any> = {}): any {
  return {
    print_area: { width_cm: 28, height_cm: 32, position: "center" },
    fields: [{ id: "text", type: "text", label: "Nome", required: false, side: "front", config: {} }],
    ...extra,
  };
}

const FRENTE = { photo_url: "https://r2/frente.jpg", quad: QUAD_N, w: 3000, h: 4000 };
const VERSO = { photo_url: "https://r2/verso.jpg", quad: QUAD_N, w: 1200, h: 1500, shading: 0 };

describe("specDaFotoDoProduto", () => {
  it("frente: base com teto de 1600 px, quad na base, cm da área cadastrada", () => {
    const spec = specDaFotoDoProduto(cfg({ mockup_foto: { front: FRENTE } }))!;
    expect(spec.schema).toBe(1);
    expect(spec.views).toHaveLength(1);
    const v = spec.views![0];
    expect(v.id).toBe("front");
    expect(v.label).toBe("Frente");
    expect(v.base).toEqual({ w: LARGURA_MAXIMA_DA_BASE, h: 2133 });
    expect(v.photo_url).toBe("https://r2/frente.jpg");
    expect(v.shading_from_photo).toEqual({ strength: FORCA_PADRAO_DO_SOMBREADO });
    const a = v.areas[0];
    expect(a).toMatchObject({ id: "front", width_cm: 28, height_cm: 32 });
    expect(a.quad![0].x).toBeCloseTo(0.3 * 1600, 9);
    expect(a.quad![2].y).toBeCloseTo(0.62 * 2133, 9);
    // O rect acompanha (caixa do quad) para quem só lê rect.
    expect(a.rect!.x).toBeCloseTo(480, 9);
  });

  it("foto menor que o teto fica no tamanho natural", () => {
    expect(baseDaFoto({ w: 1200, h: 1500 })).toEqual({ w: 1200, h: 1500 });
    expect(baseDaFoto({ w: 3200, h: 1600 })).toEqual({ w: 1600, h: 800 });
  });

  it("verso só com has_back, com a área do verso; força 0 desliga o sombreado", () => {
    const sem = specDaFotoDoProduto(cfg({ mockup_foto: { front: FRENTE, back: VERSO } }))!;
    expect(sem.views!.map((v) => v.id)).toEqual(["front"]);
    const com = specDaFotoDoProduto(cfg({
      has_back: true,
      back_print_area: { width_cm: 30, height_cm: 40 },
      mockup_foto: { front: FRENTE, back: VERSO },
    }))!;
    expect(com.views!.map((v) => v.id)).toEqual(["front", "back"]);
    expect(com.views![1].areas[0]).toMatchObject({ width_cm: 30, height_cm: 40 });
    expect(com.views![1].shading_from_photo).toBeNull();
  });

  it("meio só com has_middle", () => {
    const s = specDaFotoDoProduto(cfg({
      has_middle: true, middle_print_area: { width_cm: 20, height_cm: 8 },
      mockup_foto: { front: FRENTE, middle: VERSO },
    }))!;
    expect(s.views!.map((v) => v.id)).toEqual(["front", "middle"]);
  });

  it("sem frente marcada não há mockup na foto", () => {
    expect(specDaFotoDoProduto(cfg({ has_back: true, back_print_area: { width_cm: 1, height_cm: 1 }, mockup_foto: { back: VERSO } }))).toBeNull();
    expect(specDaFotoDoProduto(cfg())).toBeNull();
    expect(specDaFotoDoProduto(null)).toBeNull();
    expect(temMockupNaFoto(cfg({ mockup_foto: { front: FRENTE } }))).toBe(true);
    expect(temMockupNaFoto(cfg({ mockup_foto: { front: { photo_url: "", quad: QUAD_N } } }))).toBe(false);
  });

  it("quad torcido ou incompleto é ignorado", () => {
    const torcido = [QUAD_N[0], QUAD_N[2], QUAD_N[1], QUAD_N[3]];
    expect(specDaFotoDoProduto(cfg({ mockup_foto: { front: { ...FRENTE, quad: torcido } } }))).toBeNull();
    expect(specDaFotoDoProduto(cfg({ mockup_foto: { front: { ...FRENTE, quad: QUAD_N.slice(0, 3) } } }))).toBeNull();
  });

  it("sem w/h usa a medida da foto; sem medida, espera", () => {
    const semMedida = { photo_url: "https://r2/frente.jpg", quad: QUAD_N };
    expect(specDaFotoDoProduto(cfg({ mockup_foto: { front: semMedida } }))).toBeNull();
    const s = specDaFotoDoProduto(cfg({ mockup_foto: { front: semMedida } }), { front: { w: 800, h: 1000 } })!;
    expect(s.views![0].base).toEqual({ w: 800, h: 1000 });
  });

  it("força do sombreado fica entre 0 e 1", () => {
    const s = specDaFotoDoProduto(cfg({ mockup_foto: { front: { ...FRENTE, shading: 7 } } }))!;
    expect(s.views![0].shading_from_photo).toEqual({ strength: 1 });
  });

  it("vistaDoLado: a do lado, ou a frente", () => {
    const s = specDaFotoDoProduto(cfg({ mockup_foto: { front: FRENTE } }))!;
    expect(vistaDoLado(s, "back")!.id).toBe("front");
    expect(vistaDoLado(null, "front")).toBeNull();
  });
});

describe("precedência: banco > foto > SVG", () => {
  const spec = specDaFotoDoProduto(cfg({ mockup_foto: { front: FRENTE } }));
  const banco2d: VisualTemplate = {
    key: "camiseta-branca", name: "Camiseta", kind: "photo2d", version: 3,
    spec: { schema: 1, views: [{ id: "front", label: "Frente", base: { w: 1000, h: 1000 }, areas: [] }] },
  };
  const banco3d: VisualTemplate = {
    key: "caneca", name: "Caneca", kind: "model3d", version: 1,
    spec: { schema: 1, model: { kind: "procedural-mug", texture: { w: 2048, h: 860 } } },
  };

  it("template do banco manda sobre a foto", () => {
    expect(fonteDoMockup(banco2d, spec)).toBe("banco");
    expect(fonteDoMockup(banco3d, spec)).toBe("banco");
  });
  it("sem template do banco, a foto", () => {
    expect(fonteDoMockup(null, spec)).toBe("foto");
    expect(fonteDoMockup(undefined, spec)).toBe("foto");
  });
  it("template do banco sem vistas não tampa a foto", () => {
    expect(fonteDoMockup({ ...banco2d, spec: { schema: 1, views: [] } }, spec)).toBe("foto");
  });
  it("nada: o preview de sempre", () => {
    expect(fonteDoMockup(null, null)).toBe("nenhuma");
  });
});

describe("registro do render de aprovação", () => {
  it("versão estável, independente da ordem das chaves, e cabe no INTEGER", () => {
    const a = versaoDoMockupFoto({ front: { photo_url: "u", quad: QUAD_N, shading: 0.5 } });
    const b = versaoDoMockupFoto({ front: { shading: 0.5, quad: QUAD_N, photo_url: "u" } } as any);
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(2147483647);
  });
  it("mexeu na marcação, muda a versão", () => {
    const a = versaoDoMockupFoto({ front: { photo_url: "u", quad: QUAD_N } });
    const q2 = QUAD_N.map((p: any, i: number) => (i === 0 ? { x: p.x + 0.01, y: p.y } : p));
    expect(versaoDoMockupFoto({ front: { photo_url: "u", quad: q2 } })).not.toBe(a);
  });
  it("chave por produto", () => {
    expect(chaveDoMockupFoto("p1")).toBe("mockup_foto:p1");
  });
});

describe("a normalização do customization_config preserva mockup_foto", () => {
  it("ao abrir e ao salvar a marcação atravessa intacta", () => {
    const mf = { front: FRENTE, back: VERSO };
    const n = normalizeCustomizationConfig(cfg({ has_back: true, back_print_area: { width_cm: 30, height_cm: 40 }, mockup_foto: mf }));
    expect((n as any).mockup_foto).toEqual(mf);
    // Idempotente com a chave nova
    expect(normalizeCustomizationConfig(n)).toEqual(n);
  });
});
