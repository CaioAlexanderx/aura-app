import { montarChecklist, progresso, SPECS, COR_PADRAO } from "@/components/screens/canal/specsDeImagem";

const vazia = {};

describe("checklist — ordem e estado", () => {
  test("foto vem primeiro: é o que mais muda a loja", () => {
    expect(montarChecklist(vazia)[0].chave).toBe("fotos");
  });

  test("loja nova não tem nada feito", () => {
    const p = progresso(montarChecklist(vazia));
    expect(p.feitos).toBe(0);
    expect(p.pct).toBe(0);
  });

  test("loja completa fecha em 100%", () => {
    const p = progresso(montarChecklist({
      logoUrl: "https://x/logo.png",
      corPrimaria: "#1a1612",
      banners: [{}],
      anuncio: "Frete grátis acima de R$ 250",
      produtosTotal: 12,
      produtosComFoto: 12,
    }));
    expect(p.feitos).toBe(p.total);
    expect(p.pct).toBe(100);
  });
});

describe("termômetro das fotos", () => {
  test("mede quantos têm foto", () => {
    const item = montarChecklist({ produtosTotal: 30, produtosComFoto: 18 })[0];
    expect(item.medida).toBe("18 de 30 com foto");
    expect(item.feito).toBe(false);
    expect(item.acao).toContain("12 produtos");
  });

  test("singular quando falta um só", () => {
    const item = montarChecklist({ produtosTotal: 10, produtosComFoto: 9 })[0];
    expect(item.acao).toContain("1 produto está");
    expect(item.acao).not.toContain("produtos estão");
  });

  test("vitrine vazia NÃO conta como pronta", () => {
    // Zero de zero é 100% aritmético e 0% de loja. Marcar como feito
    // mandaria a lojista embora achando que terminou.
    const item = montarChecklist({ produtosTotal: 0, produtosComFoto: 0 })[0];
    expect(item.feito).toBe(false);
    expect(item.medida).toContain("nenhum produto");
  });

  test("todos com foto fecha o item", () => {
    const item = montarChecklist({ produtosTotal: 8, produtosComFoto: 8 })[0];
    expect(item.feito).toBe(true);
  });
});

describe("cor da marca", () => {
  test("o violeta padrão não conta como escolha", () => {
    const item = montarChecklist({ corPrimaria: COR_PADRAO }).find((i) => i.chave === "cor")!;
    expect(item.feito).toBe(false);
    expect(item.acao).toContain("conta-gotas");
  });

  test("caixa alta do hex não engana a comparação", () => {
    const item = montarChecklist({ corPrimaria: "#7C3AED" }).find((i) => i.chave === "cor")!;
    expect(item.feito).toBe(false);
  });

  test("cor própria conta", () => {
    const item = montarChecklist({ corPrimaria: "#7a1f3a" }).find((i) => i.chave === "cor")!;
    expect(item.feito).toBe(true);
  });
});

describe("voz comercial", () => {
  test("aviso OU whatsapp bastam", () => {
    const so = (e: any) => montarChecklist(e).find((i) => i.chave === "voz")!.feito;
    expect(so({ anuncio: "Frete grátis" })).toBe(true);
    expect(so({ whatsapp: "34984124181" })).toBe(true);
    expect(so({})).toBe(false);
  });
});

describe("specs de imagem", () => {
  test("toda spec tem resumo de uma linha e detalhes", () => {
    for (const chave of Object.keys(SPECS) as Array<keyof typeof SPECS>) {
      expect(SPECS[chave].resumo.length).toBeGreaterThan(10);
      expect(SPECS[chave].detalhes.length).toBeGreaterThan(0);
    }
  });

  test("o resumo do banner traz a proporção — é o erro mais comum", () => {
    expect(SPECS.banner.resumo).toContain("16:6");
  });

  test("o do logo exige transparência", () => {
    expect(SPECS.logo.resumo.toLowerCase()).toContain("transparente");
  });
});
