// ============================================================================
// AURA. — Etiquetas: desenho escolhido pela loja (18/10/2026, card f1-16)
//
// pdv_settings.label_design: "classico" | "editorial" | null. O que trava:
//   1. sem escolha (ausente, null, lixo) => byte a byte as 44 fixtures de
//      fixtures/etiquetas (o mesmo HTML de antes da opção);
//   2. escolha igual ao padrão do modelo => as mesmas 44 fixtures;
//   3. 40x25, bobina 58mm e Minha medida ignoram a opção nesta entrega;
//   4. desenhos novos (99x21 e 30x25 editoriais, 105x21 clássico) => as
//      fixtures de fixtures/etiquetas-desenho, gravadas uma vez;
//   5. trocar o desenho não mexe em geometria, .bc-box, SVG nem BARCODE_OPTS.
// NUNCA regravar fixture para o teste passar.
// ============================================================================
import fs from "fs";
import path from "path";
import {
  buildLabelHtml, labelDesignEfetivo, labelDesignPadrao, LABEL_DESIGN_SIZES, LABEL_SIZE_KEYS,
  type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import { casosDoModelo, casosNovos } from "./fixtures/etiquetas-desenho/casos";
import { ITENS_DOURADOS } from "./fixtures/etiquetas/casos";

const DOURADAS = path.join(__dirname, "fixtures", "etiquetas");
const NOVAS = path.join(__dirname, "fixtures", "etiquetas-desenho");
const ler = (dir: string, nome: string) => fs.readFileSync(path.join(dir, nome + ".html"), "utf-8");

describe("desenho padrão de cada modelo (o que imprime hoje)", () => {
  test("105x21 e 40x25 editoriais; 99x21, 30x25 e 58mm clássicos", () => {
    expect(LABEL_SIZE_KEYS.map((k) => [k, labelDesignPadrao(k)])).toEqual([
      ["99x21", "classico"], ["105x21", "editorial"], ["30x25", "classico"], ["58mm", "classico"], ["40x25", "editorial"],
    ]);
  });

  test("a opção vale em 99x21, 105x21 e 30x25", () => {
    expect(LABEL_DESIGN_SIZES).toEqual(["99x21", "105x21", "30x25"]);
    expect(labelDesignEfetivo("99x21", "editorial")).toBe("editorial");
    expect(labelDesignEfetivo("30x25", "editorial")).toBe("editorial");
    expect(labelDesignEfetivo("105x21", "classico")).toBe("classico");
    expect(labelDesignEfetivo("40x25", "classico")).toBe("editorial");
    expect(labelDesignEfetivo("58mm", "editorial")).toBe("classico");
    expect(labelDesignEfetivo(undefined, "editorial")).toBe("editorial"); // sem modelo = 99x21
    expect(labelDesignEfetivo("105x21", "moderno")).toBe("editorial");
    expect(labelDesignEfetivo("99x21", null)).toBe("classico");
  });
});

// Os 5 modelos fixos × (sem opção, null, "", lixo, desenho padrão) => as 44.
const MODELOS: LabelSizeKey[] = ["99x21", "105x21", "30x25", "58mm", "40x25"];
const SEM_ESCOLHA: Array<[string, any]> = [["ausente", undefined], ["null", null], ["vazio", ""], ["desconhecido", "moderno"]];

describe("sem escolha da loja: as 44 fixtures douradas, byte a byte", () => {
  test("a matriz desta pasta cobre as mesmas 44", () => {
    const nomes = MODELOS.flatMap((m) => casosDoModelo(m, undefined).map((c) => c.nome)).sort();
    const arquivos = fs.readdirSync(DOURADAS).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort();
    expect(nomes).toHaveLength(44);
    expect(nomes).toEqual(arquivos);
  });

  test.each(SEM_ESCOLHA)("design %s", (_rotulo, design) => {
    MODELOS.forEach((m) => {
      casosDoModelo(m, design).forEach((c) => {
        expect([c.nome, c.gerar()]).toEqual([c.nome, ler(DOURADAS, c.nome)]);
      });
    });
  });
});

describe("escolha igual ao padrão do modelo: as mesmas 44", () => {
  test.each(MODELOS)("%s com o próprio desenho padrão", (m) => {
    casosDoModelo(m, labelDesignPadrao(m)).forEach((c) => {
      expect([c.nome, c.gerar()]).toEqual([c.nome, ler(DOURADAS, c.nome)]);
    });
  });

  test.each(["40x25", "58mm"] as LabelSizeKey[])("%s ignora a opção nesta entrega", (m) => {
    ["classico", "editorial"].forEach((d) => {
      casosDoModelo(m, d).forEach((c) => {
        expect([c.nome, c.gerar()]).toEqual([c.nome, ler(DOURADAS, c.nome)]);
      });
    });
  });

  test("Minha medida ignora a opção (o desenho é o do spec)", () => {
    const spec = { id: "m1", larguraMm: 40, alturaMm: 25, colunas: 2, espacoLadoMm: 2, espacoLinhaMm: 2.5, ajusteXMm: 0, ajusteYMm: 0 };
    const base = { mode: "barcode" as const, storeName: "Toda Linda", showStoreName: true, customSpec: spec };
    const sem = buildLabelHtml(ITENS_DOURADOS, base);
    expect(buildLabelHtml(ITENS_DOURADOS, { ...base, design: "classico" })).toBe(sem);
    expect(buildLabelHtml(ITENS_DOURADOS, { ...base, design: "editorial" })).toBe(sem);
  });
});

describe("desenhos novos: fixtures de fixtures/etiquetas-desenho", () => {
  const CASOS = casosNovos();

  test("27 fixtures: 99x21 editorial (7), 30x25 editorial (10), 105x21 clássico (10)", () => {
    expect(CASOS).toHaveLength(27);
    const arquivos = fs.readdirSync(NOVAS).filter((f) => f.endsWith(".html")).sort();
    expect(arquivos).toEqual(CASOS.map((c) => c.nome + ".html").sort());
  });

  test.each(CASOS.map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    expect(c.gerar()).toBe(ler(NOVAS, c.nome));
  });
});

describe("trocar o desenho não mexe em geometria nem no código de barras", () => {
  const pega = (html: string, re: RegExp) => (html.match(re) || []).join("\n");
  const ZONAS: RegExp[] = [
    /@page\{[^}]*\}/g, /table\{[^}]*\}/g, /tr\{[^}]*\}/g, /\.cell\{[^}]*\}/g, /\.colgap\{[^}]*\}/g,
    /\.bc-inner \.bc-box\{[^}]*\}/g, /\.bc-inner \.bc-box svg\{[^}]*\}/g, /var opts=\{[^}]*\}/g,
    /<div class="bc-box"><svg [^>]*><\/svg><\/div>/g,
  ];
  test.each(LABEL_DESIGN_SIZES)("%s: clássico x editorial", (m) => {
    const cl = buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: "Loja", showStoreName: true, labelSize: m, design: "classico" });
    const ed = buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: "Loja", showStoreName: true, labelSize: m, design: "editorial" });
    expect(cl).not.toBe(ed);
    expect(ed).toContain('class="bc-inner ed"');
    expect(cl).not.toContain("Montserrat");
    ZONAS.forEach((re) => {
      expect(pega(ed, re)).toBe(pega(cl, re));
    });
    // As zonas existem de fato (comparar "" com "" não provaria nada).
    expect(pega(ed, /@page\{[^}]*\}/g)).not.toBe("");
    expect(pega(ed, /var opts=\{[^}]*\}/g)).not.toBe("");
    expect((ed.match(/<div class="bc-box"><svg /g) || []).length).toBe(6);
  });
});
