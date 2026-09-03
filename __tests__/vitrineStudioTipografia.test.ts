// ============================================================
// A tipografia da vitrine Studio (S1 · 03/09/2026)
//
// A chave (`classic`, `modern`, `editorial`, `humanist`) é contrato de
// banco, congelado por CHECK na migration 299, e a lojista escolhe UMA
// vez para as duas lojas dela. O que muda é o que cada chave resolve: a
// loja comum tem a curadoria de varejo de moda; a vitrine Studio tem o
// trio Studio Premium — Fraunces, DM Sans, DM Mono.
//
// Decisão 1 do redesign. O que este teste guarda é justamente que são as
// MESMAS quatro chaves: uma quinta chave aqui viraria valor que o banco
// recusa, e a lojista escolheria algo que não salva.
// ============================================================
import fs from "fs";
import path from "path";
import {
  TIPOGRAFIAS, TIPOGRAFIAS_STUDIO, tipografiaDaLoja, tipografiaDoStudio,
  cssDaVitrine, cssDaVitrineStudio, ART_FONTS,
} from "@/constants/fonts";

describe("as chaves são as mesmas nos dois lados", () => {
  test("mesmo conjunto, sem sobra nem falta", () => {
    expect(Object.keys(TIPOGRAFIAS_STUDIO).sort()).toEqual(Object.keys(TIPOGRAFIAS).sort());
  });

  test("o rótulo que a lojista lê é o mesmo — ela escolhe uma vez só", () => {
    (Object.keys(TIPOGRAFIAS) as Array<keyof typeof TIPOGRAFIAS>).forEach((k) => {
      expect(TIPOGRAFIAS_STUDIO[k].nome).toBe(TIPOGRAFIAS[k].nome);
      expect(TIPOGRAFIAS_STUDIO[k].hint).toBe(TIPOGRAFIAS[k].hint);
      expect(TIPOGRAFIAS_STUDIO[k].chave).toBe(k);
    });
  });

  test("chave desconhecida ou vazia cai em classic, nos dois", () => {
    expect(tipografiaDoStudio(null).chave).toBe("classic");
    expect(tipografiaDoStudio("inventada").chave).toBe("classic");
    expect(tipografiaDaLoja(null).chave).toBe("classic");
  });
});

describe("os pares do Studio Premium", () => {
  test("o padrão é Fraunces com DM Sans", () => {
    const p = tipografiaDoStudio("classic");
    expect(p.display).toContain("Fraunces");
    expect(p.body).toContain("DM Sans");
  });

  test("todo par usa DM Sans no corpo — é a voz do sistema", () => {
    Object.values(TIPOGRAFIAS_STUDIO).forEach((p) => {
      expect(p.body).toContain("DM Sans");
    });
  });

  test("os quatro displays são distintos: a lojista tem que ver diferença", () => {
    const displays = Object.values(TIPOGRAFIAS_STUDIO).map((p) => p.display);
    expect(new Set(displays).size).toBe(4);
  });

  test("toda família declarada tem fallback real", () => {
    Object.values(TIPOGRAFIAS_STUDIO).forEach((p) => {
      [p.display, p.body].forEach((stack) => {
        expect(stack.split(",").length).toBeGreaterThan(1);
      });
    });
  });

  test("a resolução do Studio difere da loja comum — é o ponto da decisão", () => {
    expect(tipografiaDoStudio("classic").display).not.toBe(tipografiaDaLoja("classic").display);
  });
});

describe("o link do Google Fonts", () => {
  test("carrega o par escolhido, a mono dos preços e as fontes de arte", () => {
    const url = cssDaVitrineStudio("classic");
    expect(url).toContain("family=Fraunces");
    expect(url).toContain("family=DM+Mono");
    ART_FONTS.forEach((f) => expect(url).toContain("family=" + f.replace(/ /g, "+")));
    expect(url).toContain("display=swap");
  });

  test("não repete família — duplicata na URL derruba o CSS inteiro", () => {
    // `modern` usa DM Sans no display E no corpo.
    const url = cssDaVitrineStudio("modern");
    const nomes = (url.match(/family=([^&]+)/g) || []).map((f) => f.split(":")[0]);
    expect(nomes.length).toBe(new Set(nomes).size);
  });

  test("não carrega o par que a lojista não escolheu", () => {
    const url = cssDaVitrineStudio("modern");
    expect(url).not.toContain("Fraunces");
    expect(url).not.toContain("Instrument+Serif");
  });

  test("a loja comum segue com a curadoria dela, intocada", () => {
    expect(cssDaVitrine("classic")).toContain("Cormorant+Garamond");
    expect(cssDaVitrine("classic")).not.toContain("Fraunces");
  });
});

describe("a vitrine usa o resolvedor do Studio", () => {
  const RAIZ = path.join(__dirname, "..");

  test("o provider de tipografia resolve pelo Studio", () => {
    const s = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/TipografiaVitrine.tsx"), "utf8");
    expect(s).toContain("tipografiaDoStudio");
    expect(s).not.toContain("tipografiaDaLoja(");
  });

  test("o shell da vitrine carrega o CSS do Studio", () => {
    const s = fs.readFileSync(path.join(RAIZ, "app/cardapio/studio/[slug].tsx"), "utf8");
    expect(s).toContain("cssDaVitrineStudio(parEscolhido)");
  });

  test("a loja comum e o orçamento NÃO foram arrastados junto", () => {
    ["app/cardapio/[slug].tsx", "app/orcamento/[token].tsx"].forEach((rel) => {
      const s = fs.readFileSync(path.join(RAIZ, rel), "utf8");
      expect(s).toContain("cssDaVitrine(");
      expect(s).not.toContain("cssDaVitrineStudio");
    });
  });
});
