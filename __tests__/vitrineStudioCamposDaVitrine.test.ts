// Campo de arte pronta só existe quando a loja tem arte pronta.
// QA 28/09: e, quando ele era a única origem da arte, vira envio de arquivo.
import { configDisponivel, ROTULO_DO_ENVIO_NO_LUGAR_DA_GALERIA } from "@/components/studio/storefront/camposDaVitrine";
import { faltaNaPeca, origensDoLado } from "@/components/studio/storefront/produto/regrasDaPagina";
import { validateRequiredFields } from "@/components/studio/storefront/useStorefront";

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

// ── QA 28/09 · CAMISA A. POLO: a galeria era a única origem da arte ──
const POLO: any = {
  fields: [
    { id: "txt", type: "text", label: "Nome", required: false, config: {} },
    { id: "gal", type: "template", label: "Escolher template da galeria", required: true, config: { templates: [] } },
    { id: "cor", type: "color", label: "Cor da peça", required: true, config: { colors: ["#fff", "#000"] } },
  ],
};

describe("galeria vazia como única origem da arte", () => {
  it("vira envio de arquivo, com o mesmo id e a obrigatoriedade", () => {
    const r = configDisponivel(POLO, []);
    const envio = r.fields.find((f: any) => f.id === "gal");
    expect(envio).toMatchObject({ type: "image", label: ROTULO_DO_ENVIO_NO_LUGAR_DA_GALERIA, required: true });
    expect(r.fields.map((f: any) => f.id)).toEqual(["txt", "gal", "cor"]);
  });

  it("a página mostra o envio e a barra aponta para ele", () => {
    const r = configDisponivel(POLO, []);
    expect(origensDoLado(r, "front").envio?.id).toBe("gal");
    expect(origensDoLado(r, "front").pronta).toBeNull();
    const falta = faltaNaPeca(r, { cor: "#000" }, false);
    expect(falta).toMatchObject({ frase: "Falta a arte da frente", campoId: "gal", tipo: "arte" });
  });

  it("o Adicionar valida a mesma config: com a arte enviada, passa", () => {
    const r = configDisponivel(POLO, []);
    expect(validateRequiredFields(r, { cor: "#000" }, false)).toMatch(/Envie sua arte/);
    expect(validateRequiredFields(r, { cor: "#000", gal: "https://r2/arte.png" }, false)).toBeNull();
  });

  it("lado que já tem envio: a galeria sai e passa a obrigatoriedade ao envio", () => {
    const c: any = {
      fields: [
        { id: "img", type: "image", label: "Foto do cliente", required: false, config: {} },
        { id: "gal", type: "template", label: "Galeria", required: true, config: {} },
      ],
    };
    const r = configDisponivel(c, []);
    expect(r.fields).toHaveLength(1);
    expect(r.fields[0]).toMatchObject({ id: "img", type: "image", required: true });
  });

  it("cada lado decide sozinho (frente com envio, verso só com galeria)", () => {
    const c: any = {
      has_back: true,
      fields: [
        { id: "img", type: "image", label: "Foto", required: false, config: {} },
        { id: "gv", type: "template", label: "Galeria do verso", required: false, side: "back", config: {} },
      ],
    };
    const r = configDisponivel(c, null);
    expect(origensDoLado(r, "front").envio?.id).toBe("img");
    expect(origensDoLado(r, "back").envio).toMatchObject({ id: "gv", type: "image", required: false, side: "back" });
  });

  it("com arte pronta publicada, nada muda", () => {
    expect(configDisponivel(POLO, [{ id: "t1" }])).toBe(POLO);
  });
});
