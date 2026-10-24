// ============================================================================
// AURA. — Etiquetas: nome da loja no topo (24/10/2026)
//
// O backend passa a mandar company.trade_name. Sem cuidado, o nome sairia em
// TODAS as etiquetas (o toggle nascia ligado e só não aparecia porque o nome
// chegava vazio). Regra (nomeDaLoja.ts): desligado por padrão em todo modelo
// e medida; ligado por padrão só na tag vertical; a lojista pode ligar.
//
// A prova mais forte aqui: com o padrão, o HTML de todo modelo fixo e de
// toda medida que não é tag vertical é IDÊNTICO ao de hoje (nome vazio).
// As fixtures douradas seguem cobradas em etiquetasDouradas.test.ts,
// etiquetaMedidaLivreDourada.test.ts e etiquetaTagVertical.test.ts.
// ============================================================================
import { buildLabelHtml, buildLabelPreviewHtml } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import {
  nomeDaLojaDaEmpresa, nomeDaLojaLigadoPorPadrao, mostrarNomeDaLoja,
} from "@/components/screens/estoque/labels/nomeDaLoja";
import { MEDIDA_DOCE_ENCANTO, ITENS_COM_VARIANTE } from "./fixtures/etiquetas-tag-vertical/casos";
import { ITENS_DOURADOS, MODELOS_FIXOS } from "./fixtures/etiquetas/casos";

const DOCE = { name: "Doce Encanto Confeitaria LTDA", trade_name: "Doce Encanto", legal_name: "Doce Encanto Confeitaria LTDA" };
const medida = (p: Partial<CustomLabelSpec>): CustomLabelSpec => ({ ...MEDIDA_DOCE_ENCANTO, ...p });

describe("nome que vai no topo", () => {
  test("nome fantasia primeiro", () => {
    expect(nomeDaLojaDaEmpresa(DOCE)).toBe("Doce Encanto");
  });

  test("backend antigo, sem trade_name nem legal_name: usa company.name", () => {
    expect(nomeDaLojaDaEmpresa({ name: "Doce Encanto Confeitaria LTDA" })).toBe("Doce Encanto Confeitaria LTDA");
  });

  test("nome fantasia vazio cai no name, depois na razão social; nada = vazio", () => {
    expect(nomeDaLojaDaEmpresa({ trade_name: "  ", name: "Loja da Ana", legal_name: "Ana ME" })).toBe("Loja da Ana");
    expect(nomeDaLojaDaEmpresa({ trade_name: null, name: "", legal_name: "Ana ME" })).toBe("Ana ME");
    expect(nomeDaLojaDaEmpresa({})).toBe("");
    expect(nomeDaLojaDaEmpresa(null)).toBe("");
  });
});

describe("padrão do toggle", () => {
  test("tag vertical (Doce Encanto 35x60 em pé, código de barras): ligado", () => {
    expect(nomeDaLojaLigadoPorPadrao(MEDIDA_DOCE_ENCANTO, "barcode")).toBe(true);
    expect(mostrarNomeDaLoja(null, MEDIDA_DOCE_ENCANTO, "barcode")).toBe(true);
  });

  test("modelo fixo, medida que não é tag vertical e QR: desligado", () => {
    expect(nomeDaLojaLigadoPorPadrao(null, "barcode")).toBe(false);
    expect(nomeDaLojaLigadoPorPadrao(medida({ larguraMm: 50, alturaMm: 30 }), "barcode")).toBe(false);
    expect(nomeDaLojaLigadoPorPadrao(medida({ alturaMm: 52.4 }), "barcode")).toBe(false);
    // No QR a medida em pé sai no editorial, não na tag vertical.
    expect(nomeDaLojaLigadoPorPadrao(MEDIDA_DOCE_ENCANTO, "qr")).toBe(false);
  });

  test("a escolha da lojista vence o padrão nos dois sentidos", () => {
    expect(mostrarNomeDaLoja(true, null, "barcode")).toBe(true);
    expect(mostrarNomeDaLoja(false, MEDIDA_DOCE_ENCANTO, "barcode")).toBe(false);
  });
});

describe("HTML da etiqueta", () => {
  const loja = nomeDaLojaDaEmpresa(DOCE);

  test("tag vertical com o nome da loja: <div class=\"store\">DOCE ENCANTO</div>", () => {
    const html = buildLabelHtml(ITENS_COM_VARIANTE, {
      mode: "barcode", storeName: loja, showStoreName: mostrarNomeDaLoja(null, MEDIDA_DOCE_ENCANTO, "barcode"), customSpec: MEDIDA_DOCE_ENCANTO,
    });
    expect(html).toContain('<div class="store">DOCE ENCANTO</div>');
    expect(html.split('<div class="store">DOCE ENCANTO</div>').length - 1).toBe(ITENS_COM_VARIANTE.reduce((n, i) => n + i.qty, 0));
  });

  test("modelo fixo sem marcar o toggle: sem store, e o HTML é o mesmo de hoje (nome vazio)", () => {
    MODELOS_FIXOS.forEach((size) => {
      (["barcode", "qr"] as const).forEach((mode) => {
        const comPadrao = buildLabelHtml(ITENS_DOURADOS, { mode, storeName: loja, showStoreName: mostrarNomeDaLoja(null, null, mode), labelSize: size });
        const hoje = buildLabelHtml(ITENS_DOURADOS, { mode, storeName: "", showStoreName: true, labelSize: size });
        expect([size, mode, comPadrao.includes('class="store"')]).toEqual([size, mode, false]);
        expect(comPadrao).toBe(hoje);
        const previa = buildLabelPreviewHtml(ITENS_DOURADOS, { mode, storeName: loja, showStoreName: mostrarNomeDaLoja(null, null, mode), labelSize: size });
        expect(previa).toBe(buildLabelPreviewHtml(ITENS_DOURADOS, { mode, storeName: "", showStoreName: true, labelSize: size }));
      });
    });
  });

  test("medida própria que não é tag vertical, sem marcar: igual a hoje", () => {
    [medida({ larguraMm: 50, alturaMm: 30, colunas: 2 }), medida({ larguraMm: 40, alturaMm: 40, colunas: 1 })].forEach((m) => {
      const comPadrao = buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: loja, showStoreName: mostrarNomeDaLoja(null, m, "barcode"), customSpec: m });
      expect(comPadrao).toBe(buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: "", showStoreName: true, customSpec: m }));
    });
  });

  test("a lojista marca o toggle no modelo fixo: o nome sai", () => {
    const html = buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: loja, showStoreName: mostrarNomeDaLoja(true, null, "barcode"), labelSize: "99x21" });
    expect(html).toContain('<div class="store">DOCE ENCANTO</div>');
  });
});
