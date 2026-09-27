// ============================================================
// AURA Studio — 27/09/2026: as áreas da peça no viewer 3D
//
// Com a camiseta em GLB o viewer ganhou áreas `front` e `back`. O lado
// escolhido no editor (Frente/Verso/Meio) tem que achar a área certa —
// e a caneca tem que continuar caindo em painel/wrap como sempre.
// ============================================================
import { areaParaLado, rotuloDaArea } from "@/components/studio/visualEngine/areasDaPeca";

const CANECA = [{ id: "panel", width_cm: 9, height_cm: 8 }, { id: "wrap", width_cm: 20, height_cm: 8 }];
const CAMISETA = [{ id: "front", width_cm: 21, height_cm: 28 }, { id: "back", width_cm: 21, height_cm: 28 }];

describe("areaParaLado", () => {
  it("na caneca, frente e verso são o painel e o meio é a volta inteira", () => {
    expect(areaParaLado(CANECA, "front")).toBe("panel");
    expect(areaParaLado(CANECA, "back")).toBe("panel");
    expect(areaParaLado(CANECA, "middle")).toBe("wrap");
  });

  it("na camiseta, frente e costas são áreas de verdade", () => {
    expect(areaParaLado(CAMISETA, "front")).toBe("front");
    expect(areaParaLado(CAMISETA, "back")).toBe("back");
  });

  it("lado sem área devolve null — o viewer mantém a área atual", () => {
    expect(areaParaLado(CAMISETA, "middle")).toBeNull();
    expect(areaParaLado([{ id: "panel" }], "middle")).toBeNull();
    expect(areaParaLado(CANECA, undefined)).toBeNull();
    expect(areaParaLado([], "front")).toBeNull();
    expect(areaParaLado(undefined, "front")).toBeNull();
  });
});

describe("rotuloDaArea — o nome para quem compra", () => {
  it("painel com medida em vírgula", () => {
    expect(rotuloDaArea({ id: "panel", width_cm: 9.7, height_cm: 8 })).toBe("Painel 9,7×8 cm");
    expect(rotuloDaArea({ id: "panel" })).toBe("Painel");
  });

  it("frente e costas da camiseta", () => {
    expect(rotuloDaArea({ id: "front", width_cm: 21, height_cm: 28 })).toBe("Frente 21×28 cm");
    expect(rotuloDaArea({ id: "back", width_cm: 21, height_cm: 28 })).toBe("Costas 21×28 cm");
    expect(rotuloDaArea({ id: "back" })).toBe("Costas");
  });

  it("o resto é a volta inteira", () => {
    expect(rotuloDaArea({ id: "wrap", width_cm: 20, height_cm: 8 })).toBe("Volta inteira");
  });
});
