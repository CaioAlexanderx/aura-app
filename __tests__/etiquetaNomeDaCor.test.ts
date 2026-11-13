// 13/11/2026: a etiqueta usa o nome da cor gravado pela lojista (color_name)
// em vez do nome mais próximo da paleta ("Off White" virava "Branco",
// "Caqui" virava "Prata"). Sem nome gravado, nada muda.
import { nomeGravadoParaEtiqueta } from "@/utils/nomeDaCor";
import { buildLabelName } from "@/components/screens/estoque/labels/buildLabelHtml";

describe("nomeGravadoParaEtiqueta", () => {
  it("devolve o nome como a lojista escreveu", () => {
    expect(nomeGravadoParaEtiqueta("Off White")).toBe("Off White");
    expect(nomeGravadoParaEtiqueta("Caqui")).toBe("Caqui");
    expect(nomeGravadoParaEtiqueta("Preta")).toBe("Preta");
    expect(nomeGravadoParaEtiqueta("  Verde Militar ")).toBe("Verde Militar");
  });
  it("sem nome, hex ou corte de 10 maiúsculas: null (etiqueta como sempre)", () => {
    expect(nomeGravadoParaEtiqueta(null)).toBeNull();
    expect(nomeGravadoParaEtiqueta(undefined)).toBeNull();
    expect(nomeGravadoParaEtiqueta("")).toBeNull();
    expect(nomeGravadoParaEtiqueta("#FAF9F6")).toBeNull();
    expect(nomeGravadoParaEtiqueta("FAF9F6")).toBeNull();
    expect(nomeGravadoParaEtiqueta("AZUL ESCUR")).toBeNull();
    expect(nomeGravadoParaEtiqueta("AZUL MARIN")).toBeNull();
  });
  it("maiúsculo curto sai em caixa de frase", () => {
    expect(nomeGravadoParaEtiqueta("AMORA")).toBe("Amora");
    expect(nomeGravadoParaEtiqueta("AMARELO")).toBe("Amarelo");
  });
  it("a etiqueta imprime o nome gravado; o hex continua indo para a paleta", () => {
    expect(buildLabelName("Blusa", "M", "Off White")).toBe("Blusa - M - Off White");
    expect(buildLabelName("Blusa", "M", "#FFFFFF")).toBe("Blusa - M - Branco");
  });
});
