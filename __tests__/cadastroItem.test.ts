// ============================================================
// AURA. — Cadastro de item (wizard de 3 passos)
//
// O que estes testes provam:
//   1. O preço do SERVIÇO deixou de ser parseado errado. O AddServiceForm
//      fazia parseFloat("1.234,50".replace(",", ".")) = 1.234 — um corte
//      de mil e duzentos reais virava um real e vinte e três centavos.
//      Agora serviço usa a MESMA máscara do produto.
//   2. A duração do serviço sobrevive à ida e volta pela descrição
//      (não existe coluna duration_minutes no backend ainda).
//   3. A margem ao vivo do passo 2 distingue "sem preço", "sem custo",
//      lucro e prejuízo — os quatro estados do mockup.
//   4. A matriz de variações nasce zerada nas TRÊS formas (cor+tamanho,
//      só cor, só tamanho) e preserva estoque/código das combinações que
//      sobreviveram a uma troca de cores.
//   5. Os selos dos cartões do passo 3 só cobram NCM de quem emite nota.
// ============================================================
import {
  calcMargem,
  chaveDaMatriz,
  chaveUltimaCategoria,
  composeDuracao,
  faltaNcm,
  gravarUltimaCategoria,
  lerUltimaCategoria,
  mascaraDeValor,
  matrizZerada,
  parseDuracao,
  passoClicavel,
  podeAvancar,
  preservarValores,
  rotulosDosPassos,
  statusCodigos,
  statusDescricao,
  statusFoto,
  statusVariacoes,
  subtituloDoPasso,
  tituloDoModal,
  valorDaMascara,
} from "@/components/screens/estoque/item-wizard/types";

describe("1. preço de serviço com a máscara de moeda do produto", () => {
  test('"1.234,50" vale mil duzentos e trinta e quatro reais e cinquenta', () => {
    expect(valorDaMascara("1.234,50")).toBe(1234.5);
  });

  test("o bug antigo era este — parseFloat com replace da vírgula", () => {
    // Comportamento do AddServiceForm até 08/09/2026.
    expect(parseFloat("1.234,50".replace(",", "."))).toBe(1.234);
  });

  test("ida e volta pela máscara não perde centavos", () => {
    expect(mascaraDeValor(189.9)).toBe("189,90");
    expect(valorDaMascara(mascaraDeValor(189.9))).toBe(189.9);
    expect(valorDaMascara(mascaraDeValor(0))).toBe(0);
  });

  test("campo vazio é zero, não NaN", () => {
    expect(valorDaMascara("")).toBe(0);
  });
});

describe("2. duração do serviço vai e volta pela descrição", () => {
  test("compõe no formato que o AddServiceForm gravava", () => {
    expect(composeDuracao("Corte com lavagem", "45 min")).toBe("Corte com lavagem | Duração: 45 min");
  });

  test("sem descrição, só a duração", () => {
    expect(composeDuracao("", "1h30")).toBe("Duração: 1h30");
  });

  test("sem duração, a descrição fica intacta", () => {
    expect(composeDuracao("Corte com lavagem", "")).toBe("Corte com lavagem");
    expect(composeDuracao("", "")).toBe("");
  });

  test("lê de volta o que gravou", () => {
    const texto = composeDuracao("Corte com lavagem e finalização", "45 min");
    expect(parseDuracao(texto)).toEqual({ descricao: "Corte com lavagem e finalização", duracao: "45 min" });
  });

  test("descrição sem duração não inventa duração", () => {
    expect(parseDuracao("Corte com lavagem")).toEqual({ descricao: "Corte com lavagem", duracao: "" });
    expect(parseDuracao("")).toEqual({ descricao: "", duracao: "" });
  });

  test("texto que é só a duração", () => {
    expect(parseDuracao("Duração: 2h")).toEqual({ descricao: "", duracao: "2h" });
  });

  test("duração livre (chip Outra) também sobrevive", () => {
    const t = composeDuracao("Consultoria completa", "meio período");
    expect(parseDuracao(t).duracao).toBe("meio período");
  });
});

describe("3. margem ao vivo", () => {
  test("sem preço pede o preço", () => {
    const m = calcMargem(0, 50);
    expect(m.estado).toBe("off");
    expect(m.motivo).toBe("sem-preco");
  });

  test("com preço e sem custo pede o custo", () => {
    const m = calcMargem(189.9, 0);
    expect(m.estado).toBe("off");
    expect(m.motivo).toBe("sem-custo");
  });

  test("lucro devolve percentual arredondado", () => {
    const m = calcMargem(189.9, 79);
    expect(m.estado).toBe("ok");
    expect(m.pct).toBe(58);
    expect(m.lucro).toBeCloseTo(110.9, 2);
  });

  test("custo acima do preço é prejuízo, não margem negativa disfarçada", () => {
    const m = calcMargem(50, 80);
    expect(m.estado).toBe("neg");
    expect(m.lucro).toBe(-30);
  });
});

describe("4. gating dos passos", () => {
  test("passo 1 exige nome; espaço em branco não conta", () => {
    expect(podeAvancar(1, { nome: "", preco: 0 })).toBe(false);
    expect(podeAvancar(1, { nome: "   ", preco: 0 })).toBe(false);
    expect(podeAvancar(1, { nome: "Vestido midi", preco: 0 })).toBe(true);
  });

  test("passo 2 exige preço maior que zero", () => {
    expect(podeAvancar(2, { nome: "Vestido midi", preco: 0 })).toBe(false);
    expect(podeAvancar(2, { nome: "Vestido midi", preco: 189.9 })).toBe(true);
  });

  test("na criação só dá pra voltar; na edição a barra inteira é clicável", () => {
    expect(passoClicavel(1, 2, false)).toBe(true);
    expect(passoClicavel(3, 1, false)).toBe(false);
    expect(passoClicavel(3, 1, true)).toBe(true);
    expect(passoClicavel(2, 2, true)).toBe(false);
  });
});

describe("5. matriz de variações", () => {
  test("cor + tamanho gera toda combinação zerada", () => {
    const m = matrizZerada([{ hex: "#1F2937" }, { hex: "#EF4444" }], ["P", "M"]);
    expect(Object.keys(m).sort()).toEqual(["#1F2937|M", "#1F2937|P", "#EF4444|M", "#EF4444|P"]);
    expect(Object.values(m).every((v) => v === 0)).toBe(true);
  });

  test("só cor usa a chave hex|", () => {
    expect(matrizZerada([{ hex: "#1F2937" }], [])).toEqual({ "#1F2937|": 0 });
  });

  test("só tamanho usa a chave |size", () => {
    expect(matrizZerada([], ["38", "40"])).toEqual({ "|38": 0, "|40": 0 });
  });

  test("sem cor e sem tamanho, matriz vazia", () => {
    expect(matrizZerada([], [])).toEqual({});
  });

  test("a chave é a mesma do matrixKey do serviço de variações", () => {
    expect(chaveDaMatriz("#EF4444", "P")).toBe("#EF4444|P");
    expect(chaveDaMatriz("#EF4444", null)).toBe("#EF4444|");
    expect(chaveDaMatriz(null, "P")).toBe("|P");
  });

  test("keyFn injetável (o modal passa o matrixKey real)", () => {
    const m = matrizZerada([{ hex: "#A" }], ["P"], (h, z) => (h || "") + "@" + (z || ""));
    expect(m).toEqual({ "#A@P": 0 });
  });

  test("remover uma cor preserva estoque e código das que ficaram", () => {
    const antes = { "#1F2937|P": 12, "#1F2937|M": 3, "#EF4444|P": 7 };
    const barras = { "#1F2937|P": "7891234567890", "#EF4444|P": "7899999999999" };
    const chaves = Object.keys(matrizZerada([{ hex: "#1F2937" }], ["P", "M"]));
    const matriz: Record<string, number> = {};
    chaves.forEach((k) => { matriz[k] = antes[k as keyof typeof antes] ?? 0; });
    expect(matriz).toEqual({ "#1F2937|P": 12, "#1F2937|M": 3 });
    expect(preservarValores(chaves, barras)).toEqual({ "#1F2937|P": "7891234567890" });
  });

  test("preservarValores ignora mapa ausente", () => {
    expect(preservarValores(["a|b"], undefined)).toEqual({});
  });
});

describe("6. última categoria usada, por empresa e por tipo", () => {
  const valor = { primaryCategoryId: "cat-1", alsoInIds: ["cat-2"], legado: "Vestidos" };

  test("grava e lê de volta", () => {
    gravarUltimaCategoria("emp-1", "product", valor);
    expect(lerUltimaCategoria("emp-1", "product")).toEqual(valor);
  });

  test("produto e serviço não se misturam", () => {
    gravarUltimaCategoria("emp-1", "product", valor);
    expect(lerUltimaCategoria("emp-1", "service")).toBeNull();
  });

  test("empresas não se misturam (multi-CNPJ)", () => {
    gravarUltimaCategoria("emp-1", "product", valor);
    expect(lerUltimaCategoria("emp-2", "product")).toBeNull();
    expect(chaveUltimaCategoria("emp-1", "product")).not.toBe(chaveUltimaCategoria("emp-2", "product"));
  });

  test("sem empresa não grava nem lê", () => {
    expect(lerUltimaCategoria(undefined, "product")).toBeNull();
    expect(() => gravarUltimaCategoria(null, "product", valor)).not.toThrow();
  });
});

describe("7. selos dos cartões do passo 3", () => {
  test("sem foto o cartão pede foto", () => {
    expect(statusFoto(false, [], {})).toEqual({ tom: "rec", texto: "recomendado" });
  });

  test("com foto principal mas cor sem foto, o selo conta as cores", () => {
    const cores = [{ hex: "#1F2937", name: "Preto" }, { hex: "#EF4444", name: "Vermelho" }];
    expect(statusFoto(true, cores, { "#1F2937|P": "url" })).toEqual({ tom: "rec", texto: "1 cor sem foto" });
    expect(statusFoto(true, cores, {})).toEqual({ tom: "rec", texto: "2 cores sem foto" });
    expect(statusFoto(true, cores, { "#1F2937|P": "a", "#EF4444|M": "b" })).toEqual({ tom: "ok", texto: "preenchido" });
  });

  test("modo por cor e tamanho sem grade montada avisa", () => {
    expect(statusVariacoes([], [], "variants")).toEqual({ tom: "rec", texto: "monte a grade" });
    expect(statusVariacoes([], [], "single")).toEqual({ tom: "", texto: "vazio" });
    expect(statusVariacoes([{ hex: "#A", name: "A" }], ["P", "M"], "variants").texto).toBe("1 cor · 2 tam.");
  });

  test("descrição vazia é recomendação, não erro", () => {
    expect(statusDescricao("").tom).toBe("rec");
    expect(statusDescricao("Viscose com elastano").tom).toBe("ok");
  });

  test("NCM só é cobrado de quem emite nota", () => {
    expect(faltaNcm("", false)).toBe(false);
    expect(faltaNcm("", true)).toBe(true);
    expect(faltaNcm("6204440", true)).toBe(true);
    expect(faltaNcm("62044400", true)).toBe(false);

    expect(statusCodigos("", "", false)).toEqual({ tom: "", texto: "vazio" });
    expect(statusCodigos("", "", true)).toEqual({ tom: "rec", texto: "falta NCM" });
    expect(statusCodigos("VES-014", "", false)).toEqual({ tom: "ok", texto: "preenchido" });
  });
});

describe("8. textos do cabeçalho", () => {
  test("o título muda de Novo item para Novo produto depois de criado", () => {
    expect(tituloDoModal("product", false, false)).toBe("Novo item");
    expect(tituloDoModal("product", false, true)).toBe("Novo produto");
    expect(tituloDoModal("service", false, true)).toBe("Novo serviço");
    expect(tituloDoModal("service", true, false)).toBe("Editar serviço");
  });

  test("o passo 2 chama duração no serviço e estoque no produto", () => {
    expect(rotulosDosPassos("product")[1]).toBe("Preço e estoque");
    expect(rotulosDosPassos("service")[1]).toBe("Preço e duração");
    expect(subtituloDoPasso(2, "product")).toBe("Quanto custa e quanto você tem");
    expect(subtituloDoPasso(2, "service")).toBe("Quanto custa e quanto tempo leva");
  });
});
