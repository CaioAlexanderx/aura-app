// ============================================================
// QA 27/09 · a tipografia "Marcante" na vitrine Studio
//
// O painel manda `font_family: "editorial"` para "Marcante". Na vitrine
// Studio cada chave resolve no par decidido pelo PO:
//   classic   (Elegante)   Fraunces + DM Sans
//   modern    (Moderna)    DM Sans
//   editorial (Marcante)   Instrument Serif + DM Sans
//   humanist  (Acolhedora) Pacifico + DM Sans
// e o link das fontes carrega o MESMO par que a tela usa.
// ============================================================
import { tipografiaDoStudio, cssDaVitrineStudio, TIPOGRAFIAS } from "@/constants/fonts";
import { chaveDaTipografia } from "@/components/studio/storefront/TipografiaVitrine";

const primeira = (pilha: string) => pilha.split(",")[0].replace(/'/g, "").trim();

describe("cada chave no par do PO", () => {
  test.each([
    ["classic", "Fraunces", "DM Sans"],
    ["modern", "DM Sans", "DM Sans"],
    ["editorial", "Instrument Serif", "DM Sans"],
    ["humanist", "Pacifico", "DM Sans"],
  ])("%s → %s + %s", (chave, display, corpo) => {
    const par = tipografiaDoStudio(chave);
    expect(primeira(par.display)).toBe(display);
    expect(primeira(par.body)).toBe(corpo);
  });

  test("Marcante é a chave editorial", () => {
    expect(TIPOGRAFIAS.editorial.nome).toBe("Marcante");
  });
});

describe("a fonte é carregada", () => {
  test.each([
    ["classic", "family=Fraunces"],
    ["modern", "family=DM+Sans"],
    ["editorial", "family=Instrument+Serif"],
    ["humanist", "family=Pacifico"],
  ])("o link de %s leva %s e o DM Sans do corpo", (chave, familia) => {
    const url = cssDaVitrineStudio(chave);
    expect(url).toContain(familia);
    expect(url).toContain("family=DM+Sans");
  });

  test("o link da Marcante não leva o par do padrão", () => {
    expect(cssDaVitrineStudio("editorial")).not.toContain("Fraunces");
  });
});

describe("a chave como o painel manda", () => {
  test("espaço e maiúscula não derrubam a escolha no padrão", () => {
    expect(chaveDaTipografia(" Editorial ")).toBe("editorial");
    expect(primeira(tipografiaDoStudio(chaveDaTipografia(" Editorial ")).display)).toBe("Instrument Serif");
    expect(chaveDaTipografia(null)).toBe("");
    expect(tipografiaDoStudio(chaveDaTipografia(null)).chave).toBe("classic");
  });
});
