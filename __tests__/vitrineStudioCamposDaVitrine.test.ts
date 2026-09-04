// Campo de arte pronta só existe quando a loja tem arte pronta.
import { configDisponivel } from "@/components/studio/storefront/camposDaVitrine";

const cfg: any = {
  print_area: { width_cm: 8, height_cm: 8 },
  fields: [
    { id: "t", type: "text", label: "Texto", required: true, config: {} },
    { id: "i", type: "image", label: "Foto do cliente", required: true, config: {} },
    { id: "g", type: "template", label: "Escolher template da galeria", required: true, config: {} },
    { id: "c", type: "color", label: "Cor", config: { colors: ["#fff"] } },
  ],
};

describe("configDisponivel", () => {
  it("some com o campo de galeria quando a loja não tem template nenhum", () => {
    const r = configDisponivel(cfg, []);
    expect(r.fields.map((f: any) => f.id)).toEqual(["t", "i", "c"]);
    // o resto da config viaja intacto
    expect(r.print_area).toEqual(cfg.print_area);
  });

  it("mantém o campo quando há arte pronta", () => {
    expect(configDisponivel(cfg, [{ id: "tpl1" }])).toBe(cfg);
  });

  it("devolve o MESMO objeto quando nada muda, para não invalidar memos", () => {
    const semGaleria: any = { fields: cfg.fields.filter((f: any) => f.type !== "template") };
    expect(configDisponivel(semGaleria, [])).toBe(semGaleria);
    expect(configDisponivel(semGaleria, null)).toBe(semGaleria);
  });

  it("config nula passa direto", () => {
    expect(configDisponivel(null, [])).toBeNull();
    expect(configDisponivel(undefined, [])).toBeUndefined();
  });
});
