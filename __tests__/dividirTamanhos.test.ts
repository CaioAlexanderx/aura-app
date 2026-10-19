// p-35 (18/10/2026): "P, M, G" digitado no cadastro virava UM tamanho.
import { dividirTamanhos, juntarTamanhos } from "@/utils/dividirTamanhos";

describe("dividirTamanhos · perfil padrão", () => {
  it("vírgula com espaço", () => {
    expect(dividirTamanhos("P, M, G")).toEqual(["P", "M", "G"]);
  });

  it("vírgula sem espaço (numeração)", () => {
    expect(dividirTamanhos("36,38,40")).toEqual(["36", "38", "40"]);
  });

  it("decimal com unidade fica inteiro", () => {
    expect(dividirTamanhos("1,200L")).toEqual(["1,200L"]);
    expect(dividirTamanhos("1,5 mm")).toEqual(["1,5 mm"]);
    expect(dividirTamanhos("2,5kg")).toEqual(["2,5kg"]);
  });

  it("ponto e vírgula e quebra de linha também separam", () => {
    expect(dividirTamanhos("P;M\nG")).toEqual(["P", "M", "G"]);
    expect(dividirTamanhos("P\r\nM\r\n\r\nG")).toEqual(["P", "M", "G"]);
  });

  it("decimal com unidade separado por ponto e vírgula", () => {
    expect(dividirTamanhos("1,5 mm; 2,5 mm")).toEqual(["1,5 mm", "2,5 mm"]);
  });

  it("tira duplicados sem diferenciar maiúscula, vazios e espaços", () => {
    expect(dividirTamanhos(" P , p,, M ,G, g ,")).toEqual(["P", "M", "G"]);
  });

  it("um tamanho só continua um tamanho só", () => {
    expect(dividirTamanhos("GG")).toEqual(["GG"]);
    expect(dividirTamanhos("   ")).toEqual([]);
    expect(dividirTamanhos("")).toEqual([]);
  });
});

describe("dividirTamanhos · perfil Matcon", () => {
  it("vírgula + espaço separa; a vírgula decimal fica", () => {
    expect(dividirTamanhos("1,5 mm, 2,5 mm", "matcon")).toEqual(["1,5 mm", "2,5 mm"]);
  });

  it("vírgula sem espaço não separa", () => {
    expect(dividirTamanhos("1,5mm", "matcon")).toEqual(["1,5mm"]);
    expect(dividirTamanhos("1,5", "matcon")).toEqual(["1,5"]);
  });

  it("ponto e vírgula e quebra de linha separam", () => {
    expect(dividirTamanhos("1,5 mm;2,5 mm\n20 mm", "matcon")).toEqual(["1,5 mm", "2,5 mm", "20 mm"]);
  });

  it("tira duplicados", () => {
    expect(dividirTamanhos("20 MM, 20 mm; 10 mm", "matcon")).toEqual(["20 MM", "10 mm"]);
  });
});

describe("juntarTamanhos", () => {
  it("mescla sem duplicar (o que já existe vale) e ordena", () => {
    expect(juntarTamanhos(["G", "P"], ["gg", "p", "M", "PP"])).toEqual(["PP", "P", "M", "G", "gg"]);
  });

  it("números em ordem numérica depois das letras", () => {
    expect(juntarTamanhos(["40"], ["36", "38", "P"])).toEqual(["P", "36", "38", "40"]);
  });
});
