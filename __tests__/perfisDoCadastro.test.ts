// ============================================================
// Cadastro de produto por perfil de subvertical (22/09/2026) — a mecânica.
//
// docs/mockups/matcon-cadastro-produto.html (tela 4) e a nota .md:
//   - perfilDoCadastro devolve o MESMO PERFIL_PADRAO (toBe) sem Matcon —
//     contrato de zero impacto, igual ao unitsForProduct;
//   - Matcon + Ótica ligados: vale o Matcon (decisão do Caio);
//   - as contas pequenas das seções (Vendo por, preço da caixa, peso,
//     lotes, selo da nota fiscal, código do exemplo).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import {
  PERFIL_PADRAO, PERFIL_MATCON, perfilDoCadastro, exemploDeCodigo, nomeDaEmbalagem,
} from "@/components/screens/estoque/item-form/perfis";
import { unidadesDoVendoPor, precoDaEmbalagem } from "@/components/screens/estoque/item-form/SecaoPreco";
import { dicaDoPeso } from "@/components/screens/estoque/item-form/SecaoEntrega";
import { fichaAutomatica } from "@/components/screens/estoque/item-form/SecaoDescricao";
import { respostasDaNota, seloDaNota } from "@/components/screens/estoque/item-form/SecaoCodigos";
import {
  lotesParaGravar, totalDosLotes, statusEstoque, resumoDoItem, temProgressoAlemDoNome,
  type LinhaDeLote,
} from "@/components/screens/estoque/item-form/types";
import { UNITS } from "@/components/screens/estoque/types";
import { MATCON_UNITS, parseQtyInput } from "@/utils/matconUnits";

describe("perfilDoCadastro — zero impacto e desempate", () => {
  test("sem pdv_settings, vazio ou Matcon desligado: o MESMO PERFIL_PADRAO", () => {
    expect(perfilDoCadastro(null)).toBe(PERFIL_PADRAO);
    expect(perfilDoCadastro(undefined)).toBe(PERFIL_PADRAO);
    expect(perfilDoCadastro({})).toBe(PERFIL_PADRAO);
    expect(perfilDoCadastro({ matcon_enabled: false })).toBe(PERFIL_PADRAO);
    // "true" em string não liga (mesma regra do readMatconSettings).
    expect(perfilDoCadastro({ matcon_enabled: "true" } as any)).toBe(PERFIL_PADRAO);
  });

  test("Ótica sozinha não customiza o cadastro de produto", () => {
    expect(perfilDoCadastro({ otica_enabled: true } as any)).toBe(PERFIL_PADRAO);
  });

  test("Matcon ligado: PERFIL_MATCON; com Ótica junto, o Matcon prevalece", () => {
    expect(perfilDoCadastro({ matcon_enabled: true })).toBe(PERFIL_MATCON);
    expect(perfilDoCadastro({ matcon_enabled: true, otica_enabled: true } as any)).toBe(PERFIL_MATCON);
  });

  test("o perfil padrão guarda os textos de hoje", () => {
    expect(PERFIL_PADRAO.item.exemploDoNome).toBe("Ex.: Vestido midi floral");
    expect(PERFIL_PADRAO.estoque.rotuloDaGrade).toBe("Por cor e tamanho");
    expect(PERFIL_PADRAO.descricao.ficha.map((l) => l.rotulo)).toEqual(["Material", "Medidas", "Cuidados"]);
    expect(PERFIL_PADRAO.vendoPorNoPreco).toBe(false);
    expect(PERFIL_PADRAO.entrega).toBe(false);
    expect(PERFIL_PADRAO.notaFiscalSeparada).toBe(false);
    expect(PERFIL_PADRAO.manterNoProximo).toBe(false);
  });

  test("ficha do Matcon: 4 campos, a 4ª grava em `cuidados` (sem coluna nova)", () => {
    expect(PERFIL_MATCON.descricao.ficha.map((l) => [l.campo, l.rotulo])).toEqual([
      ["brand", "Marca"], ["medidas", "Medidas"], ["material", "Material"], ["cuidados", "Onde usar e rendimento"],
    ]);
  });

  test("nenhum jargão nos textos do perfil Matcon", () => {
    const tudo = JSON.stringify(PERFIL_MATCON);
    ["SKU", "ERP", "esteira", "XML", "fator", " ST "].forEach((j) => expect(tudo).not.toContain(j));
  });
});

describe("Vendo por: un + unidades da loja; o resto em 'outras'", () => {
  test("a config manda na linha principal, na ordem dela", () => {
    const { principais, outras } = unidadesDoVendoPor(["m²", "sc"]);
    expect(principais).toEqual(["un", "m²", "sc"]);
    // Tudo o que existia continua alcançável em "outras", sem repetir.
    [...UNITS, ...MATCON_UNITS].forEach((u) => expect(principais.concat(outras)).toContain(u));
    expect(new Set(outras).size).toBe(outras.length);
    expect(outras).not.toContain("un");
    expect(outras).not.toContain("m²");
  });

  test("unidade gravada fora de qualquer lista não some da tela", () => {
    expect(unidadesDoVendoPor(["m²"], "m2").principais).toContain("m2");
  });
});

describe("contas do card 'Como você vende' e da Entrega", () => {
  test("preço da caixa: 'A caixa sai a R$ 72,38 de custo e R$ 127,37 na venda.'", () => {
    const t = precoDaEmbalagem("cx", 31.2 * 2.32, 54.9 * 2.32);
    expect(t).toMatch(/^A caixa sai a R\$\s?72,38 de custo e R\$\s?127,37 na venda\.$/);
    expect(precoDaEmbalagem("sc", 0, 10)).toMatch(/^O saco sai a R\$\s?10,00 na venda\.$/);
    expect(precoDaEmbalagem("cx", 0, 0)).toBe("");
  });

  test("nome da embalagem por extenso, com fallback", () => {
    expect(nomeDaEmbalagem("cx").nome).toBe("caixa");
    expect(nomeDaEmbalagem(null).nome).toBe("caixa");
    expect(nomeDaEmbalagem("fardo").nome).toBe("embalagem");
  });

  test("peso: caixa + 100 unidades; vazio sem peso", () => {
    const d = dicaDoPeso("m²", 21.5, 2.32, "cx");
    expect(d).toContain("A caixa: 49,88 kg.");
    expect(d).toContain("100 m² ≈ 2.150 kg.");
    expect(dicaDoPeso("sc", 50, null)).toContain("100 sc ≈ 5.000 kg.");
    expect(dicaDoPeso("sc", null, null)).toBe("");
  });

  test("prévia: caixa e peso automáticos só com os números preenchidos", () => {
    expect(fichaAutomatica({ unidade: "m²", purchaseUnit: "cx", purchaseFactor: "2,32", peso: "21,5" })).toEqual([
      ["Caixa", "2,32 m² (automático)"],
      ["Peso", "21,5 kg por m² (automático)"],
    ]);
    expect(fichaAutomatica({ unidade: "sc" })).toEqual([]);
  });

  test("código interno de exemplo nasce do nome", () => {
    expect(exemploDeCodigo("Porcelanato Bianco")).toBe("POR-001");
    expect(exemploDeCodigo("Área externa")).toBe("ARE-001");
    expect(exemploDeCodigo("")).toBe("CIM-001");
  });
});

describe("lotes do cadastro", () => {
  const linhas: LinhaDeLote[] = [
    { id: "1", codigo: "27B", tonalidade: "A2", bitola: "03", qtd: "95,12" },
    { id: "2", codigo: "28A", tonalidade: "", bitola: "03", qtd: "53,36" },
    { id: "3", codigo: "", tonalidade: "", bitola: "", qtd: "10" }, // sem lote: ignorada
    { id: "4", codigo: "29C", tonalidade: "", bitola: "", qtd: "" }, // sem quantidade: ignorada
  ];

  test("só linhas com lote e quantidade viram lote; vazio vira null", () => {
    expect(lotesParaGravar(linhas, parseQtyInput)).toEqual([
      { lot_code: "27B", shade: "A2", caliber: "03", qty: 95.12 },
      { lot_code: "28A", shade: null, caliber: "03", qty: 53.36 },
    ]);
  });

  test("o total é a soma das pilhas válidas", () => {
    expect(totalDosLotes(linhas, parseQtyInput)).toBe(148.48);
    expect(totalDosLotes([], parseQtyInput)).toBe(0);
  });

  test("selo do estoque conta lotes; sem 5º argumento, o selo de hoje", () => {
    expect(statusEstoque("lots", [], [], "", { lotes: 2 })).toEqual({ tom: "ok", texto: "2 lotes" });
    expect(statusEstoque("lots", [], [], "", { lotes: 0 })).toBeNull();
    expect(statusEstoque("variants", [], [], "", { tamanhos: "medidas" })).toEqual({ tom: "rec", texto: "adicione cores ou medidas" });
    expect(statusEstoque("variants", [{ hex: "#A", name: "A" }], ["1,5 mm"], "", { abreviacao: "med." })).toEqual({ tom: "ok", texto: "1 cor · 1 med." });
    expect(statusEstoque("variants", [{ hex: "#A", name: "A" }], ["P"], "")).toEqual({ tom: "ok", texto: "1 cor · 1 tam." });
  });

  test("resumo do rodapé com 'med.' no Matcon e 'tam.' sem ele", () => {
    const base = { nome: "Fio", preco: 10, isProduto: true, stockMode: "variants" as const, cores: [{ hex: "#A", name: "A" }], tamanhos: ["2,5 mm"], minutos: null };
    expect(resumoDoItem(base)).toContain("1 cor · 1 tam.");
    expect(resumoDoItem({ ...base, abreviacaoDoTamanho: "med." })).toContain("1 cor · 1 med.");
  });

  test("linha de lote digitada conta como progresso (pede confirmação ao sair)", () => {
    const vazio = { preco: 0, custo: 0, pendentes: 0, cores: 0, tamanhos: 0, estoque: "", descricao: "", sku: "", barcode: "", ncm: "", duracao: "" };
    expect(temProgressoAlemDoNome(vazio)).toBe(false);
    expect(temProgressoAlemDoNome({ ...vazio, lotes: 1 })).toBe(true);
  });
});

describe("selo da nota fiscal", () => {
  test("conta NCM (8), CEST (7) e a pergunta do imposto", () => {
    expect(respostasDaNota("", "", null)).toBe(0);
    expect(respostasDaNota("69072100", "1003200", null)).toBe(2);
    expect(respostasDaNota("69072100", "1003200", false)).toBe(3);
    expect(respostasDaNota("6907", "1003200", true)).toBe(2);
  });

  test("'2 de 3' âmbar só para quem emite nota; '3 de 3 ✓' verde", () => {
    expect(seloDaNota(2, true)).toEqual({ tom: "rec", texto: "2 de 3" });
    expect(seloDaNota(2, false)).toEqual({ tom: "", texto: "2 de 3" });
    expect(seloDaNota(3, false)).toEqual({ tom: "ok", texto: "3 de 3 ✓" });
  });
});
