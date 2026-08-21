// ============================================================
// Capa do produto — o piso de qualidade
//
// Os nomes aqui são os REAIS da conta de teste e da Sheid Mania: caixa
// alta, medida no meio, código no fim. É esse o material que a capa
// precisa transformar em algo apresentável.
// ============================================================
import { iniciais, degrauDaCapa, resumo } from "@/components/studio/storefront/capaModel";

describe("iniciais", () => {
  test.each([
    ["Produto Teste", "PT"],
    ["Macacão Frente Única", "MF"],
    ["Camiseta Básica Branca", "CB"],
    ["Bermuda Cargo Caqui", "BC"],
    ["Vestido Midi Floral", "VM"],
  ])("%s → %s", (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });

  test("pula números: KIT 3 PARES… vira KP, não K3", () => {
    expect(iniciais("KIT 3 PARES MEIA CANO LONGO ALGODAO 39-43 PRETO/BRANCO/CINZA")).toBe("KP");
  });

  test("pula medida colada no nome", () => {
    expect(iniciais("CALCA JEANS MASCULINA SLIM FIT 38x32 AZUL ESCURO")).toBe("CJ");
    expect(iniciais("50 Sacolas Plástica com Alça Vazada - 20x30cm")).toBe("SP");
  });

  test("pula palavras vazias", () => {
    expect(iniciais("Xicara com pires + colherzinha")).toBe("XP");
    expect(iniciais("Kit de Canecas")).toBe("KC");
  });

  test("nome de uma palavra devolve uma letra", () => {
    expect(iniciais("Canecas")).toBe("C");
  });

  test.each([["", "?"], ["   ", "?"], ["123", "?"], ["#$%", "?"]])(
    "nome degenerado %s não quebra a capa", (nome, esperado) => {
      expect(iniciais(nome as string)).toBe(esperado);
    },
  );

  test("nome só de números com uma letra perdida usa a letra", () => {
    expect(iniciais("300g")).toBe("G");
  });

  test("acento não vira caractere estranho", () => {
    expect(iniciais("Ônibus Escolar")).toBe("ÔE");
  });
});

describe("degrauDaCapa", () => {
  test("é determinístico — a loja não pode piscar entre renders", () => {
    const nome = "Camiseta Básica Branca";
    expect(degrauDaCapa(nome)).toBe(degrauDaCapa(nome));
  });

  test("produtos diferentes variam — grade inteira igual parece erro", () => {
    const nomes = [
      "Produto Teste", "Macacão Frente Única", "Camiseta Básica Branca",
      "Bermuda Cargo Caqui", "Vestido Midi Floral", "Blusa Alcinha",
      "Cinto Couro Marrom", "Mochila Couro Preta",
    ];
    const distintos = new Set(nomes.map(degrauDaCapa));
    expect(distintos.size).toBeGreaterThan(1);
  });

  test("sempre dentro da faixa sutil — nunca uma capa berrante", () => {
    for (const n of ["a", "bb", "ccc", "Produto Teste", ""]) {
      const d = degrauDaCapa(n);
      expect(d).toBeGreaterThanOrEqual(0.07);
      expect(d).toBeLessThanOrEqual(0.19);
    }
  });
});

describe("resumo", () => {
  test("texto curto passa intacto", () => {
    expect(resumo("Jeans escuro com elastano")).toBe("Jeans escuro com elastano");
  });

  test("sem descrição devolve null — o layout fecha sozinho", () => {
    expect(resumo(null)).toBeNull();
    expect(resumo(undefined)).toBeNull();
    expect(resumo("   ")).toBeNull();
  });

  test("texto longo corta na palavra, não no meio dela", () => {
    const longo = "Cartão de visita em couché brilho personalizado, passe credibilidade e impacte no seu primeiro contato com o cliente";
    const r = resumo(longo, 60)!;
    expect(r.length).toBeLessThanOrEqual(61);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/\s…$/); // sem espaço órfão antes das reticências
  });

  test("palavra única gigante corta mesmo assim", () => {
    const r = resumo("A".repeat(200), 20)!;
    expect(r.length).toBeLessThanOrEqual(21);
    expect(r.endsWith("…")).toBe(true);
  });
});
