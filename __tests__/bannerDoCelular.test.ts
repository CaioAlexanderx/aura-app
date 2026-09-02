// ============================================================
// Banner proprio pro celular (02/09/2026, QA da Finesse)
//
// O banner 3:1 e cortado no centro no celular e leva o texto da arte
// junto. A lojista pode subir uma versao quadrada so pro celular. O
// backend (Aura-backend, digitalChannel.js) aceita `banner_N_mobile` e
// guarda em image_url_mobile no mesmo item do JSON.
// ============================================================
import fs from "fs";
import path from "path";
import { SPECS } from "@/components/screens/canal/specsDeImagem";

const tabDesign = fs.readFileSync(
  path.join(__dirname, "../components/screens/canal/TabDesign.tsx"),
  "utf8",
);

describe("spec do banner do celular", () => {
  test("quadrado, 1080x1080, e fala com a lojista", () => {
    expect(SPECS.banner_mobile.resumo).toContain("1080×1080");
    expect(SPECS.banner_mobile.detalhes.join(" ")).toContain("cortado no centro");
    // O 3:1 continua sendo o principal.
    expect(SPECS.banner.resumo).toContain("1920×640");
  });
});

describe("o painel sobe, troca e remove a versao do celular", () => {
  test("o tipo de upload e banner_N_mobile, e o campo e image_url_mobile", () => {
    expect(tabDesign).toContain("pickAndUploadImage(`banner_${idx}_mobile` as any)");
    expect(tabDesign).toContain("deleteImage(`banner_${idx}_mobile` as any)");
    expect(tabDesign).toContain("updateBanner(idx, { image_url_mobile: null })");
    expect(tabDesign).toContain("image_url_mobile?: string | null;");
  });
  test("a resposta do upload cai no campo certo: mobile nao mexe na larga", () => {
    expect(tabDesign).toContain('const mobile = type.endsWith("_mobile");');
    expect(tabDesign).toContain("mobile ? { ...b, image_url_mobile: url }");
  });
  test("o campo do celular so aparece depois da larga", () => {
    const i = tabDesign.indexOf("Imagem para celular (opcional)");
    expect(i).toBeGreaterThan(0);
    expect(tabDesign.slice(i - 400, i)).toContain("{b.image_url ? (");
  });
});
