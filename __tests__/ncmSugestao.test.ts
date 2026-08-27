// ============================================================
// AURA. — Sugestão de NCM (utils/ncm.ts)
//
// O que estes testes provam:
//   1. Os falsos positivos medidos no catálogo da Finesse morreram. Cada caso
//      abaixo é um nome REAL que hoje recebe NCM errado — e NCM errado vai pra
//      nota fiscal.
//   2. Roupa passou a ter cobertura (capítulos 61 e 62), que era 0% antes.
//   3. Quando o sinal é ambíguo, a função devolve null. Não sugerir é o
//      resultado certo — nunca chutar.
//
// Os nomes com grafia torta ("bermuda jens botao dourado") são literais do
// catálogo. Não corrigir: é exatamente esse texto que quebra a heurística.
// ============================================================
import {
  suggestNcm,
  ncmFamilyByCode,
  normalizeProductName,
  groupFromCategory,
} from "@/utils/ncm";

describe("1. falsos positivos medidos na Finesse", () => {
  test('"botão" não é bota', () => {
    const r = suggestNcm("bermuda jens botao dourado");
    expect(r?.ncm).not.toBe("64039190");
    expect(r?.label).toMatch(/Short\/bermuda/);
  });

  test('"blusa social" não é sapato de couro', () => {
    const r = suggestNcm("Blusa social manga longa");
    expect(r?.ncm).not.toBe("64039900");
    expect(r?.label).toMatch(/Blusa/);
  });

  test('peça que VEM com cinto não é cinto', () => {
    const r = suggestNcm("Bermuda jeans com cinto corda");
    expect(r?.ncm).not.toBe("42033000");
    expect(r?.ncm).not.toBe("42029220");
    // "jeans" no nome resolve o capítulo: tecido plano, sem chute.
    expect(r?.ncm).toBe("62046300");
    expect(r?.fabric).toBe("plano");
  });

  test('"meia taça" não é meia', () => {
    const r = suggestNcm("Vestido Midi em tricot meia taca");
    expect(r?.ncm).not.toBe("61159500");
    // "tricot" diz que é malha — capítulo 61, não 62.
    expect(r?.ncm).toBe("61044300");
  });

  test('"casual" não é sapatilha', () => {
    const r = suggestNcm("Blusa casual manga longa");
    expect(r?.ncm).not.toBe("64041900");
    expect(r?.label).toMatch(/Blusa/);
  });

  test('"slip dress" não é chinelo', () => {
    const r = suggestNcm("Vestido slip dress");
    expect(r?.ncm).not.toBe("64022000");
    expect(r?.label).toMatch(/Vestido/);
  });

  test('"conjunto esportivo" não é tênis', () => {
    const r = suggestNcm("Conjunto esportivo feminino");
    expect(r?.ncm).not.toBe("64041100");
    expect(r?.label).toMatch(/Conjunto/);
  });

  // Os dois casos abaixo isolam uma defesa cada. Nos nomes acima o
  // substantivo-núcleo já resolveria sozinho, então eles não provam que a
  // fronteira de palavra e o veto de conectivo estão de pé — estes provam.
  test("token inteiro, sozinho: sem outro tipo no nome, botão não vira bota", () => {
    expect(suggestNcm("Botao dourado avulso")).toBeNull();
    expect(suggestNcm("Social feminino P")).toBeNull();
  });

  test("veto de conectivo, sozinho: o que vem depois de 'com' é detalhe", () => {
    // "manta" não tem regra: se o cinto não fosse vetado, sobraria ele.
    expect(suggestNcm("Manta com cinto")).toBeNull();
    expect(suggestNcm("Cinto de couro fivela")?.ncm).toBe("42033000");
  });

  test('"tam" solto é tamanho, não tamanco', () => {
    expect(suggestNcm("Blusa tam 38")?.label).toMatch(/Blusa/);
    // No início do nome a abreviação do catálogo antigo continua valendo.
    expect(suggestNcm("TAM. SALTO 37 PRETO")?.ncm).toBe("64029990");
  });
});

describe("2. o quarto defeito: \\b não casa depois de letra acentuada", () => {
  test('"boné" recebe a mesma sugestão que "bone"', () => {
    // /\b(boné)\b/ nunca casava — o \b depois do "é" não é fronteira.
    expect(suggestNcm("Boné aba reta")?.ncm).toBe("65050090");
    expect(suggestNcm("Bone aba reta")?.ncm).toBe("65050090");
  });

  test("a normalização derruba acento e pontuação sem colar tokens", () => {
    expect(normalizeProductName("Vestido Midi — Tricô/Bordô")).toBe("vestido midi trico bordo");
    expect(normalizeProductName("Aplicação")).toBe("aplicacao");
  });
});

describe("3. cobertura de vestuário (capítulos 61 e 62)", () => {
  const casos: Array<[string, string]> = [
    ["Vestido longo fenda", "62044300"],
    ["Saia midi plissada", "62045300"],
    ["Short alfaiataria", "62046300"],
    ["Calca pantalona", "62046300"],
    ["Conjunto cropped e saia", "62042300"],
    ["Macacao pantacourt", "62046300"],
    ["Body manga longa", "61143000"],
    ["Corselet preto", "62129000"],
    ["Cropped canelado", "61091000"],
    ["Blazer alfaiataria", "62043300"],
    ["Colete jeans", "62114300"],
    ["Biquini cortininha", "61124100"],
    ["Sutia sem bojo", "62121000"],
  ];
  test.each(casos)("%s → %s", (nome, ncm) => {
    expect(suggestNcm(nome)?.ncm).toBe(ncm);
  });

  test("empate no início do nome: ganha o termo mais específico", () => {
    // "top" sozinho é cropped; "top sutiã" é sutiã. Os dois casam no índice 0.
    expect(suggestNcm("Top cropped canelado")?.ncm).toBe("61091000");
    expect(suggestNcm("Top sutia sem bojo")?.ncm).toBe("62121000");
  });

  test("todas as peças novas eram buraco antes: 0 regra pra roupa", () => {
    for (const [nome] of casos) {
      expect(suggestNcm(nome)).not.toBeNull();
    }
  });
});

describe("4. malha vs. tecido plano", () => {
  test("o nome decide quando diz o tecido", () => {
    expect(suggestNcm("Vestido de tricot")?.ncm).toBe("61044300");
    expect(suggestNcm("Vestido jeans")?.ncm).toBe("62044300");
  });

  test("a ficha técnica decide quando o nome não diz", () => {
    const r = suggestNcm("Vestido midi", { material: "Malha canelada com elastano" });
    expect(r?.ncm).toBe("61044300");
    expect(r?.fabric).toBe("malha");
  });

  test("sem sinal nenhum, assume e AVISA na família", () => {
    const r = suggestNcm("Vestido midi");
    expect(r?.fabric).toBe("assumido");
    expect(r?.family).toMatch(/confira se é malha/);
  });

  test("peça de capítulo único não carrega o aviso", () => {
    expect(suggestNcm("Biquini cortininha")?.family).not.toMatch(/confira/);
  });
});

describe("5. categoria como veto", () => {
  test("categoria que contradiz o nome cancela a sugestão", () => {
    // Sem categoria, o nome mandaria — com ela, o conflito vira silêncio.
    expect(suggestNcm("Sapato boneca")?.ncm).toBe("64039900");
    expect(suggestNcm("Sapato boneca", { category: "Roupas" })).toBeNull();
  });

  test("categoria que confirma o nome mantém a sugestão", () => {
    expect(suggestNcm("Sapato boneca", { category: "Calçados" })?.ncm).toBe("64039900");
  });

  test("categoria desempata entre dois tipos citados no nome", () => {
    // "Kit bolsa e cinto": sem categoria ganha o primeiro (bolsa);
    // com categoria "Cintos", ganha o cinto.
    expect(suggestNcm("Kit bolsa e cinto")?.ncm).toBe("42029220");
    expect(suggestNcm("Kit bolsa e cinto", { category: "Cintos" })?.ncm).toBe("42033000");
  });

  test("o veto é grosso: bolsa em 'Acessórios' e biquíni em 'Moda praia' passam", () => {
    // Vetar por diferença fina apagaria sugestão certa — é assim que o varejo
    // organiza de verdade.
    expect(suggestNcm("Bolsa transversal media", { category: "Acessórios" })?.ncm).toBe("42029220");
    expect(suggestNcm("Biquini cortininha", { category: "Moda praia" })?.ncm).toBe("61124100");
    expect(suggestNcm("Meia soquete kit 3 pares", { category: "Acessórios" })?.ncm).toBe("61159500");
    expect(suggestNcm("Calcinha algodao", { category: "Roupas" })?.ncm).toBe("61082200");
  });

  test("categoria que não mapeia pra grupo nenhum não interfere", () => {
    expect(groupFromCategory("Promoções")).toBeNull();
    expect(suggestNcm("Vestido longo", { category: "Promoções" })?.ncm).toBe("62044300");
  });
});

describe("6. marca é sinal fraco", () => {
  test("marca não vence o tipo, mesmo vindo antes no nome", () => {
    expect(suggestNcm("Nike blusa dry fit")?.label).toMatch(/Blusa/);
  });

  test("marca sozinha ainda classifica", () => {
    expect(suggestNcm("Nike Revolution 6 preto")?.ncm).toBe("64041100");
  });
});

describe("7. calçado, que já funcionava, continua funcionando", () => {
  const casos: Array<[string, string]> = [
    ["Tenis Olympikus corrida 38", "64041100"],
    ["Bota coturno tratorada", "64039190"],
    ["Chinelo slide feminino", "64022000"],
    ["Sandalia salto bloco", "64029990"],
    ["Sapatilha bailarina bico fino", "64041900"],
    ["Meia soquete kit 3 pares", "61159500"],
    ["Bolsa transversal media", "42029220"],
  ];
  test.each(casos)("%s → %s", (nome, ncm) => {
    expect(suggestNcm(nome)?.ncm).toBe(ncm);
  });
});

describe("8. silêncio quando não dá pra afirmar", () => {
  test.each([
    ["Colar dourado ponto de luz"],
    ["Produto teste 123"],
    ["Kit presente"],
    ["ab"],
    [""],
  ])("%s → null", (nome) => {
    expect(suggestNcm(nome)).toBeNull();
  });
});

describe("9. helper de família", () => {
  test("código conhecido devolve o capítulo", () => {
    expect(ncmFamilyByCode("61044300")).toMatch(/Capítulo 61/);
    expect(ncmFamilyByCode("62044300")).toMatch(/Capítulo 62/);
  });

  test("código fora da tabela devolve null, sem inventar", () => {
    expect(ncmFamilyByCode("99999999")).toBeNull();
    expect(ncmFamilyByCode("6204")).toBeNull();
  });
});
