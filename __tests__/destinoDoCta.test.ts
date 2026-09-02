// ============================================================
// O destino do botão do banner.
//
// O CTA virou link de verdade na loja (backend #637): sem destino, não
// desenha botão. O painel oferecia o campo de TEXTO e nenhum campo de
// link — a lojista escrevia "Ver coleção", salvava, e não aparecia nada.
// Foi débito que eu criei ao mudar a loja sem mudar o painel.
//
// O QUE ESTES TESTES GUARDAM:
//
// 1. A regra do que é destino válido é a MESMA do backend (http/https).
//    Se o painel aceitar o que a loja recusa, a lojista fica olhando um
//    botão que não existe e nada no painel diz por quê.
// 2. Cada combinação de texto+destino tem seu próprio aviso. Um
//    "campo inválido" genérico faria ela adivinhar qual dos dois é.
// 3. Banner sem CTA não é erro — não avisa nada.
// ============================================================
import {
  destinoValido, estadoDoCta, avisoDoCta, normalizarDestino,
} from "@/components/screens/canal/destinoDoCta";

describe("o que conta como destino", () => {
  test("http e https passam", () => {
    expect(destinoValido("https://instagram.com/finesse")).toBe(true);
    expect(destinoValido("http://loja.com.br")).toBe(true);
  });

  test("o resto não passa — a mesma régua do backend", () => {
    for (const ruim of [
      "", "   ", null, undefined,
      "instagram.com/finesse",        // sem esquema
      "javascript:alert(1)",          // o backend recusa; o painel não pode aceitar
      "//instagram.com",
      "mailto:loja@loja.com",
      "https://",                     // esquema sem destino
    ]) {
      expect(destinoValido(ruim as any)).toBe(false);
    }
  });
});

describe("cada buraco tem seu aviso", () => {
  test("texto sem link: diz que o botão não aparece", () => {
    const e = estadoDoCta("Ver coleção", "");
    expect(e).toBe("so_texto");
    expect(avisoDoCta(e)).toContain("não aparece");
  });

  test("link sem texto: diz que falta o que clicar", () => {
    const e = estadoDoCta("", "https://loja.com");
    expect(e).toBe("so_destino");
    expect(avisoDoCta(e)).toContain("texto");
  });

  test("link malformado: diz o que fazer, não que está errado", () => {
    const e = estadoDoCta("Ver", "loja.com");
    expect(e).toBe("destino_invalido");
    expect(avisoDoCta(e)).toContain("https://");
  });

  test("os avisos são todos diferentes", () => {
    // Se dois estados dessem a mesma frase, o campo estaria mentindo
    // sobre qual deles consertar.
    const frases = ["so_texto", "so_destino", "destino_invalido"]
      .map((e) => avisoDoCta(e as any));
    expect(new Set(frases).size).toBe(3);
  });
});

describe("banner sem CTA não é erro", () => {
  test("os dois vazios não avisam nada", () => {
    // Banner sem botão é escolha legítima — e a maioria dos banners é
    // assim. Avisar aqui seria cobrar trabalho que ninguém pediu.
    expect(estadoDoCta("", "")).toBe("vazio");
    expect(avisoDoCta("vazio")).toBeNull();
  });

  test("par completo também não avisa", () => {
    expect(estadoDoCta("Ver", "https://loja.com")).toBe("ok");
    expect(avisoDoCta("ok")).toBeNull();
  });
});

describe("colar o endereço do navegador funciona", () => {
  test("completa o que parece domínio", () => {
    expect(normalizarDestino("instagram.com/finesse")).toBe("https://instagram.com/finesse");
    expect(normalizarDestino("  loja.com.br  ")).toBe("https://loja.com.br");
  });

  test("não mexe no que já tem esquema", () => {
    expect(normalizarDestino("http://x.com")).toBe("http://x.com");
    expect(normalizarDestino("https://x.com")).toBe("https://x.com");
  });

  test("não transforma rascunho em link", () => {
    // "promo" viraria "https://promo" e não ajudaria ninguém — exigir o
    // ponto separa endereço de anotação.
    expect(normalizarDestino("promo")).toBe("promo");
    expect(normalizarDestino("")).toBe("");
  });
});

describe("a tela usa a regra, não uma cópia dela", () => {
  const fs = require("fs");
  const path = require("path");
  const tela = fs.readFileSync(
    path.join(__dirname, "..", "components/screens/canal/TabDesign.tsx"), "utf8");

  test("importa de destinoDoCta", () => {
    expect(tela).toContain('from "./destinoDoCta"');
  });

  test("não tem regex de http própria", () => {
    // Duas réguas divergem: o painel aceitaria o que a loja recusa.
    const codigo = tela.split(/\r?\n/).filter((l: string) => !/^\s*(\/\/|\*)/.test(l)).join(" ");
    expect(codigo).not.toMatch(/\^https\?/);
  });

  test("o campo de link existe e é salvo como cta_url", () => {
    expect(tela).toContain('label="Link do botão"');
    expect(tela).toContain("cta_url: v");
  });
});

// Redesign 09/2026: o CTA do hero pode apontar pra uma categoria da
// propria loja. O formato e o do backend (destinoDoCta): #cat=/caminho.
describe("categoria da loja como destino", () => {
  test("#cat=/caminho passa, e fica como esta ao normalizar", () => {
    expect(destinoValido("#cat=/vestidos")).toBe(true);
    expect(destinoValido("#cat=/vestidos/festa")).toBe(true);
    expect(normalizarDestino("#cat=/vestidos")).toBe("#cat=/vestidos");
  });

  test("o resto com # nao passa — a mesma regua do backend", () => {
    for (const ruim of ["#cat=", "#cat=vestidos", "#outra", "#cat=/Vestidos Festa"]) {
      expect(destinoValido(ruim)).toBe(false);
    }
  });

  test("o aviso de link invalido menciona a categoria", () => {
    expect(avisoDoCta(estadoDoCta("Ver", "loja.com"))).toContain("#cat=/");
  });
});
