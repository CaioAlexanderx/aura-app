// ============================================================
// AURA. — Cadastro de item (formulário aberto)
//
// O que estes testes provam:
//   1. O preço do SERVIÇO deixou de ser parseado errado. O AddServiceForm
//      fazia parseFloat("1.234,50".replace(",", ".")) = 1.234 — um corte
//      de mil e duzentos reais virava um real e vinte e três centavos.
//      Agora serviço usa a MESMA máscara do produto.
//   2. A duração do serviço virou NÚMERO (migration 323) e o serviço
//      cadastrado no formato antigo — "… | Duração: 45 min" colado na
//      descrição — é lido, migrado e nunca perdido.
//   2b. A galeria de fotos por cor: quatro é o teto, duas é a sugestão,
//      e "Tornar capa" manda a lista completa de ids na ordem nova.
//   3. A margem ao vivo distingue "sem preço", "sem custo", lucro e
//      prejuízo — os quatro estados do mockup.
//   4. A matriz de variações nasce zerada nas TRÊS formas (cor+tamanho,
//      só cor, só tamanho), preserva estoque/código das combinações que
//      sobreviveram a uma troca de cores, e sai da GRADE LOCAL para o PUT
//      do Salvar (09/09/2026 — não há mais auto-save por célula).
//   5. Os selos de cada seção só cobram NCM de quem emite nota.
//   6. O que impede o Salvar é nome e preço — e o rodapé diz isso numa
//      linha só. Um NCM pela metade também impede; um NCM vazio, não.
//   7. A fila de fotos do cadastro sobe a galeria principal primeiro e as
//      cores na ordem em que foram criadas.
// ============================================================
import {
  calcMargem,
  chaveDaMatriz,
  chaveUltimaCategoria,
  contarSlots,
  duracaoParaMinutos,
  faltaNcm,
  fotosDaCor,
  gravarUltimaCategoria,
  idsComFotoEm,
  lerDuracaoDoServico,
  lerUltimaCategoria,
  mascaraDeValor,
  matrizDaGrade,
  matrizZerada,
  minutosParaRotulo,
  motivosQueBloqueiam,
  nomeDoTipo,
  numeroDaCelula,
  ordenarFilaDeFotos,
  parseDuracao,
  preservarValores,
  resumoDoItem,
  rotuloDoBotaoSalvar,
  rotuloDoProgresso,
  rotuloDoSlot,
  seloDeFotos,
  statusCodigos,
  statusDescricao,
  statusEstoque,
  statusFotos,
  statusItem,
  statusPreco,
  subtituloDoModal,
  textoDeEdicao,
  textoDoBloqueio,
  tituloDoModal,
  usaDuasColunas,
  valorDaMascara,
  type FotoPendente,
} from "@/components/screens/estoque/item-form/types";
import type { ProductImage } from "@/services/productImagesApi";

const foto = (id: string, position: number): ProductImage =>
  ({ id, url: "https://r2/" + id + ".jpg", thumb_url: null, position });

const pendente = (id: string, corHex: string | null): FotoPendente =>
  ({ id, corHex, base64: "xxx", contentType: "image/jpeg" });

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

describe("2. duração do serviço em minutos (migration 323)", () => {
  test("o que a lojista escreve vira número", () => {
    expect(duracaoParaMinutos("45")).toBe(45);
    expect(duracaoParaMinutos("45 min")).toBe(45);
    expect(duracaoParaMinutos("90 minutos")).toBe(90);
    expect(duracaoParaMinutos("1h")).toBe(60);
    expect(duracaoParaMinutos("1h30")).toBe(90);
    expect(duracaoParaMinutos("1 h 30 min")).toBe(90);
    expect(duracaoParaMinutos("2 horas")).toBe(120);
    expect(duracaoParaMinutos("1,5h")).toBe(90);
  });

  test("o que não vira número devolve null — e null não é zero", () => {
    expect(duracaoParaMinutos("meio período")).toBeNull();
    expect(duracaoParaMinutos("sob consulta")).toBeNull();
    expect(duracaoParaMinutos("")).toBeNull();
    expect(duracaoParaMinutos(null)).toBeNull();
    expect(duracaoParaMinutos("0")).toBeNull();
    expect(duracaoParaMinutos("1h90")).toBeNull();
    expect(duracaoParaMinutos("3000")).toBeNull();
  });

  test("o rótulo é o caminho de volta", () => {
    expect(minutosParaRotulo(30)).toBe("30 min");
    expect(minutosParaRotulo(60)).toBe("1h");
    expect(minutosParaRotulo(90)).toBe("1h30");
    expect(minutosParaRotulo(120)).toBe("2h");
    expect(minutosParaRotulo(65)).toBe("1h05");
    expect(minutosParaRotulo(null)).toBe("");
    expect(minutosParaRotulo(0)).toBe("");
  });

  test("ida e volta pelos chips não muda o número", () => {
    [30, 45, 60, 90, 120].forEach((m) => {
      expect(duracaoParaMinutos(minutosParaRotulo(m))).toBe(m);
    });
  });

  test("a coluna manda quando existe", () => {
    expect(lerDuracaoDoServico("Corte com lavagem", 45)).toEqual({
      descricao: "Corte com lavagem", duracaoTxt: "45 min", minutos: 45, migrandoDoLegado: false,
    });
  });

  test("sem coluna, o sufixo antigo é lido e marcado pra migrar", () => {
    expect(lerDuracaoDoServico("Corte com lavagem | Duração: 45 min", null)).toEqual({
      descricao: "Corte com lavagem", duracaoTxt: "45 min", minutos: 45, migrandoDoLegado: true,
    });
  });

  test("a coluna vence o sufixo antigo quando os dois existem", () => {
    const r = lerDuracaoDoServico("Corte | Duração: 45 min", 90);
    expect(r.minutos).toBe(90);
    expect(r.descricao).toBe("Corte");
    expect(r.migrandoDoLegado).toBe(false);
  });

  test("sufixo que NÃO vira número fica na descrição — migrar não pode apagar texto", () => {
    const r = lerDuracaoDoServico("Consultoria | Duração: meio período", null);
    expect(r.minutos).toBeNull();
    expect(r.duracaoTxt).toBe("");
    expect(r.descricao).toBe("Consultoria | Duração: meio período");
  });

  test("serviço sem duração nenhuma", () => {
    expect(lerDuracaoDoServico("Corte com lavagem", null)).toEqual({
      descricao: "Corte com lavagem", duracaoTxt: "", minutos: null, migrandoDoLegado: false,
    });
    expect(lerDuracaoDoServico("", undefined).minutos).toBeNull();
  });

  test("parseDuracao continua sabendo ler o formato antigo", () => {
    expect(parseDuracao("Duração: 2h")).toEqual({ descricao: "", duracao: "2h" });
    expect(parseDuracao("Corte com lavagem")).toEqual({ descricao: "Corte com lavagem", duracao: "" });
    expect(parseDuracao("")).toEqual({ descricao: "", duracao: "" });
  });
});

describe("2b. galeria de fotos por cor (migration 323)", () => {
  test("quatro é o teto; duas é a sugestão que aparece de saída", () => {
    expect(contarSlots(0)).toBe(2);
    expect(contarSlots(1)).toBe(2);
    expect(contarSlots(2)).toBe(3);
    expect(contarSlots(3)).toBe(4);
    expect(contarSlots(4)).toBe(4);
    expect(contarSlots(9)).toBe(4);
  });

  test("os dois primeiros espaços vêm rotulados; do terceiro em diante é só o +", () => {
    expect(rotuloDoSlot(0, false)).toBe("frente");
    expect(rotuloDoSlot(1, false)).toBe("no corpo");
    expect(rotuloDoSlot(2, false)).toBe("");
    expect(rotuloDoSlot(0, true)).toBe("capa");
    expect(rotuloDoSlot(1, true)).toBe("no corpo");
    expect(rotuloDoSlot(3, true)).toBe("");
  });

  test("a cor é achada apesar da diferença de caixa (servidor minúsculo, formulário maiúsculo)", () => {
    const porCor = { "#1f2937": [foto("a", 0)] };
    expect(fotosDaCor(porCor, "#1F2937")).toHaveLength(1);
    expect(fotosDaCor(porCor, "#EF4444")).toEqual([]);
    expect(fotosDaCor(undefined, "#1F2937")).toEqual([]);
  });

  test("sem foto principal nada mais é urgente", () => {
    expect(statusFotos([], [{ hex: "#1F2937", name: "Preto" }], {})).toEqual({ tom: "rec", texto: "recomendado" });
  });

  test("cor sem foto nenhuma é contada", () => {
    const cores = [{ hex: "#1F2937", name: "Preto" }, { hex: "#EF4444", name: "Vermelho" }];
    const main = [foto("m0", 0)];
    expect(statusFotos(main, cores, {})).toEqual({ tom: "rec", texto: "2 cores sem foto" });
    expect(statusFotos(main, cores, { "#1f2937": [foto("a", 0)] }))
      .toEqual({ tom: "rec", texto: "1 cor sem foto" });
  });

  test("com uma foto só, a sugestão é conselho, não erro", () => {
    const cores = [{ hex: "#1F2937", name: "Preto" }, { hex: "#EF4444", name: "Vermelho" }];
    const st = statusFotos([foto("m0", 0)], cores, {
      "#1f2937": [foto("a", 0)],
      "#ef4444": [foto("b", 0), foto("c", 1)],
    });
    expect(st).toEqual({ tom: "rec", texto: "1 cor com só 1" });
  });

  test("todas com duas ou mais: preenchido", () => {
    const cores = [{ hex: "#1F2937", name: "Preto" }];
    expect(statusFotos([foto("m0", 0)], cores, { "#1f2937": [foto("a", 0), foto("b", 1)] }))
      .toEqual({ tom: "ok", texto: "preenchido" });
  });

  test("sem cores, basta a foto principal", () => {
    expect(statusFotos([foto("m0", 0)], [], {})).toEqual({ tom: "ok", texto: "preenchido" });
  });

  test("o mesmo selo sai das contagens — é o que o cadastro usa, sem produto ainda", () => {
    expect(seloDeFotos(0, [])).toEqual({ tom: "rec", texto: "recomendado" });
    expect(seloDeFotos(2, [0, 3])).toEqual({ tom: "rec", texto: "1 cor sem foto" });
    expect(seloDeFotos(2, [1, 1])).toEqual({ tom: "rec", texto: "2 cores com só 1" });
    expect(seloDeFotos(1, [2, 4])).toEqual({ tom: "ok", texto: "preenchido" });
  });

  test('"Tornar capa" manda a lista COMPLETA na ordem nova', () => {
    const fotos = [foto("a", 0), foto("b", 1), foto("c", 2)];
    expect(idsComFotoEm(fotos, "c", 0)).toEqual(["c", "a", "b"]);
  });

  test("as setas movem uma casa e param nas pontas", () => {
    const fotos = [foto("a", 0), foto("b", 1), foto("c", 2)];
    expect(idsComFotoEm(fotos, "b", 2)).toEqual(["a", "c", "b"]);
    expect(idsComFotoEm(fotos, "b", 0)).toEqual(["b", "a", "c"]);
    expect(idsComFotoEm(fotos, "a", -1)).toEqual(["a", "b", "c"]);
    expect(idsComFotoEm(fotos, "c", 9)).toEqual(["a", "b", "c"]);
  });

  test("id que não é da lista não reordena nada", () => {
    const fotos = [foto("a", 0), foto("b", 1)];
    expect(idsComFotoEm(fotos, "z", 0)).toEqual(["a", "b"]);
    expect(idsComFotoEm([], "a", 0)).toEqual([]);
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

describe("4. matriz de variações e a grade local", () => {
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

  test("célula vazia é zero; o que não é dígito também", () => {
    expect(numeroDaCelula("12")).toBe(12);
    expect(numeroDaCelula("")).toBe(0);
    expect(numeroDaCelula(null)).toBe(0);
    expect(numeroDaCelula("abc")).toBe(0);
    expect(numeroDaCelula(7)).toBe(7);
  });

  test("a grade digitada é o que vai no PUT — e só as combinações vivas", () => {
    const m = matrizDaGrade(
      [{ hex: "#1F2937" }, { hex: "#EF4444" }],
      ["P", "M"],
      { "#1F2937|P": "12", "#EF4444|M": "3", "#SUMIU|P": "99" },
      null
    );
    expect(m).toEqual({ "#1F2937|P": 12, "#1F2937|M": 0, "#EF4444|P": 0, "#EF4444|M": 3 });
  });

  test("célula em branco herda o que veio do servidor — cor nova nasce zerada", () => {
    const m = matrizDaGrade(
      [{ hex: "#1F2937" }, { hex: "#EF4444" }],
      ["P"],
      { "#1F2937|P": "" },
      { "#1F2937|P": 12 }
    );
    expect(m).toEqual({ "#1F2937|P": 12, "#EF4444|P": 0 });
  });
});

describe("5. última categoria usada, por empresa e por tipo", () => {
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

describe("6. os selos de cada seção", () => {
  test("nome e preço vazios são erro — é o que o rodapé repete", () => {
    expect(statusItem("")).toEqual({ tom: "err", texto: "falta o nome" });
    expect(statusItem("   ")).toEqual({ tom: "err", texto: "falta o nome" });
    expect(statusItem("Vestido midi")).toBeNull();
    expect(statusPreco(0)).toEqual({ tom: "err", texto: "falta o preço" });
    expect(statusPreco(189.9)).toBeNull();
  });

  test("estoque conta a grade montada; quantidade zerada não é erro", () => {
    expect(statusEstoque("variants", [], [], "")).toEqual({ tom: "rec", texto: "adicione cores ou tamanhos" });
    expect(statusEstoque("variants", [{ hex: "#A", name: "A" }], ["P", "M"], "")).toEqual({ tom: "ok", texto: "1 cor · 2 tam." });
    expect(statusEstoque("variants", [{ hex: "#A", name: "A" }, { hex: "#B", name: "B" }], [], "")).toEqual({ tom: "ok", texto: "2 cores · 0 tam." });
    expect(statusEstoque("single", [], [], "")).toBeNull();
    expect(statusEstoque("single", [], [], "12")).toEqual({ tom: "ok", texto: "preenchido" });
  });

  test("descrição vazia é recomendação, não erro", () => {
    expect(statusDescricao("")).toEqual({ tom: "rec", texto: "recomendado" });
    expect(statusDescricao("Viscose com elastano")).toEqual({ tom: "ok", texto: "preenchido" });
  });

  test("NCM só é cobrado de quem emite nota", () => {
    expect(faltaNcm("", false)).toBe(false);
    expect(faltaNcm("", true)).toBe(true);
    expect(faltaNcm("6204440", true)).toBe(true);
    expect(faltaNcm("62044400", true)).toBe(false);

    expect(statusCodigos("", "", false)).toBeNull();
    expect(statusCodigos("", "", true)).toEqual({ tom: "rec", texto: "falta NCM" });
    expect(statusCodigos("VES-014", "", false)).toEqual({ tom: "ok", texto: "preenchido" });
  });
});

describe("7. o que impede o Salvar, e o que o rodapé diz", () => {
  test("nome e preço, só", () => {
    expect(motivosQueBloqueiam({ nome: "", preco: 0, isProduto: true })).toEqual(["o nome", "o preço"]);
    expect(motivosQueBloqueiam({ nome: "Vestido", preco: 0, isProduto: true })).toEqual(["o preço"]);
    expect(motivosQueBloqueiam({ nome: "Vestido", preco: 189.9, isProduto: true })).toEqual([]);
    expect(motivosQueBloqueiam({ nome: "  ", preco: 189.9, isProduto: true })).toEqual(["o nome"]);
  });

  test("NCM vazio não impede; NCM pela metade impede", () => {
    expect(motivosQueBloqueiam({ nome: "V", preco: 1, ncm: "", isProduto: true })).toEqual([]);
    expect(motivosQueBloqueiam({ nome: "V", preco: 1, ncm: "62044400", isProduto: true })).toEqual([]);
    expect(motivosQueBloqueiam({ nome: "V", preco: 1, ncm: "6204", isProduto: true })).toEqual(["o NCM com 8 dígitos"]);
    // Serviço não tem NCM nenhum.
    expect(motivosQueBloqueiam({ nome: "V", preco: 1, ncm: "6204", isProduto: false })).toEqual([]);
  });

  test("o rodapé junta os motivos numa frase", () => {
    expect(textoDoBloqueio([])).toBe("");
    expect(textoDoBloqueio(["o nome"])).toBe("Falta o nome para salvar");
    expect(textoDoBloqueio(["o nome", "o preço"])).toBe("Falta o nome e o preço para salvar");
    expect(textoDoBloqueio(["o nome", "o preço", "o NCM com 8 dígitos"]))
      .toBe("Falta o nome, o preço e o NCM com 8 dígitos para salvar");
  });

  test("sem nada bloqueando, o rodapé resume o que vai ser criado", () => {
    expect(resumoDoItem({
      nome: "Vestido midi floral", preco: 189.9, isProduto: true,
      stockMode: "variants", cores: [{ hex: "#A", name: "A" }, { hex: "#B", name: "B" }], tamanhos: ["P", "M", "G"], minutos: null,
    })).toBe("Vestido midi floral · R$ 189,90 · 2 cores · 3 tam.");

    expect(resumoDoItem({
      nome: "Vestido", preco: 189.9, isProduto: true,
      stockMode: "single", cores: [], tamanhos: [], minutos: null,
    })).toBe("Vestido · R$ 189,90");

    expect(resumoDoItem({
      nome: "Corte feminino", preco: 90, isProduto: false,
      stockMode: "single", cores: [], tamanhos: [], minutos: 45,
    })).toBe("Corte feminino · R$ 90,00 · 45 min");
  });

  test("na edição o rodapé fala de alterações", () => {
    expect(textoDeEdicao(true)).toBe("Alterações não salvas");
    expect(textoDeEdicao(false)).toBe("Tudo salvo");
  });
});

describe("8. fila de fotos do cadastro", () => {
  test("a galeria principal sobe primeiro; as cores, na ordem em que foram criadas", () => {
    const cores = ["#1F2937", "#EF4444"];
    const fila = [
      pendente("c2", "#EF4444"),
      pendente("m1", null),
      pendente("c1", "#1f2937"),
      pendente("m2", null),
    ];
    expect(ordenarFilaDeFotos(fila, cores).map((f) => f.id)).toEqual(["m1", "m2", "c1", "c2"]);
  });

  test("cor que não está mais na lista vai para o fim, sem sumir", () => {
    const fila = [pendente("x", "#000000"), pendente("c1", "#1F2937")];
    expect(ordenarFilaDeFotos(fila, ["#1F2937"]).map((f) => f.id)).toEqual(["c1", "x"]);
  });

  test("fila vazia não quebra", () => {
    expect(ordenarFilaDeFotos([], ["#1F2937"])).toEqual([]);
  });

  test("o progresso conta a que está subindo, não a que acabou", () => {
    expect(rotuloDoProgresso(0, 5)).toBe("Subindo fotos 1 de 5");
    expect(rotuloDoProgresso(1, 5)).toBe("Subindo fotos 2 de 5");
    expect(rotuloDoProgresso(4, 5)).toBe("Subindo fotos 5 de 5");
    expect(rotuloDoProgresso(9, 5)).toBe("Subindo fotos 5 de 5");
    expect(rotuloDoProgresso(0, 0)).toBe("");
  });
});

describe("9. layout e textos do cabeçalho", () => {
  test("duas colunas só na web, e só a partir de 900", () => {
    expect(usaDuasColunas(1280, true)).toBe(true);
    expect(usaDuasColunas(900, true)).toBe(true);
    expect(usaDuasColunas(899, true)).toBe(false);
    expect(usaDuasColunas(1280, false)).toBe(false);
  });

  test("o título não promete passo nenhum", () => {
    expect(tituloDoModal("product", false)).toBe("Novo item");
    expect(tituloDoModal("service", false)).toBe("Novo item");
    expect(tituloDoModal("product", true)).toBe("Editar produto");
    expect(tituloDoModal("service", true)).toBe("Editar serviço");
  });

  test("o subtítulo diz o que salva quando", () => {
    expect(subtituloDoModal(false)).toBe("Nome e preço bastam. O resto você completa quando quiser.");
    expect(subtituloDoModal(true)).toBe("Fotos e grade salvam na hora. O resto, no Salvar.");
  });

  test("o botão nomeia o que vai salvar", () => {
    expect(rotuloDoBotaoSalvar("product", false)).toBe("Salvar produto");
    expect(rotuloDoBotaoSalvar("service", false)).toBe("Salvar serviço");
    expect(rotuloDoBotaoSalvar("product", true)).toBe("Salvar alterações");
    expect(nomeDoTipo("service")).toBe("serviço");
  });
});
