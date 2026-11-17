// ============================================================
// "Chegou mercadoria" · passo 3, conferência (A4a): regras sem tela.
//   - casa pelo código do fornecedor, depois código de barras (com os das
//     variantes) e depois nome; resposta ambígua não casa sozinha;
//   - estados da linha e o que trava o "Dar entrada" (pendência 5);
//   - produto novo com preço obrigatório e sugerido (pendência 6);
//   - resumo, "o total bate" e "Mostrar os outros n".
// ============================================================
import {
  indexarProdutos, acharProduto, conferirLinha, resumirConferencia, linhasVisiveis, motivoDoRodape,
  precoSugerido, decisaoDeNovo, normalizarBarras, normalizarNome,
  type ItemParaConferir, type ProdutoDaLoja, type LinhaConferida,
} from "@/components/screens/estoque/chegou/chegouRegras";
import { lerNota } from "@/components/screens/estoque/chegou/lerNota";
import { XML_CONFERENCIA, PRODUTOS_CONFERENCIA } from "./fixtures/chegouNotas";

const item = (n: number, extra: Partial<ItemParaConferir> = {}): ItemParaConferir => ({
  n, descricao: "ITEM " + n, codigoFornecedor: null, codigoBarras: null, ncm: null, quantidade: 1, custoUnitario: 10, total: 10, ...extra,
});
const prod = (id: string, extra: Partial<ProdutoDaLoja> = {}): ProdutoDaLoja => ({
  id, name: "Produto " + id, barcode: "", code: "", stock: 0, cost: 0, price: 0, unit: "un", ...extra,
});

describe("achar o produto", () => {
  const A = prod("a", { name: "Esmalte Vermelho", barcode: "7891234567895" });
  const B = prod("b", { name: "Camiseta Básica", has_variants: true, variant_barcodes: ["7890000000101", "7890000000102"] });
  const C = prod("c", { name: "Esmalte Azul", barcode: "7891234567000" });
  const indice = indexarProdutos([A, B, C]);

  test("código do fornecedor vem antes do código de barras e do nome", () => {
    const r = acharProduto({ descricao: "Esmalte Vermelho", codigoFornecedor: "X-1", codigoBarras: "7891234567895" }, indice, { "X-1": "c" });
    expect(r).toEqual({ produto: C, como: "codigo_fornecedor", daVariante: false });
  });

  test("código do fornecedor que aponta para produto que a loja não vê: segue para o código de barras", () => {
    const r = acharProduto({ descricao: "?", codigoFornecedor: "X-1", codigoBarras: "7891234567895" }, indice, { "X-1": "sumiu" });
    expect(r?.produto.id).toBe("a");
    expect(r?.como).toBe("codigo_barras");
  });

  test("código de barras com zero na frente (GTIN-14) casa com o EAN-13", () => {
    expect(acharProduto({ descricao: "?", codigoFornecedor: null, codigoBarras: "07891234567895" }, indice, null)?.produto.id).toBe("a");
  });

  test("código de barras de uma variante acha o produto de grade (daVariante)", () => {
    expect(acharProduto({ descricao: "?", codigoFornecedor: null, codigoBarras: "7890000000102" }, indice, null))
      .toEqual({ produto: B, como: "codigo_barras", daVariante: true });
  });

  test("nome igual, sem acento e sem pontuação", () => {
    expect(acharProduto({ descricao: "ESMALTE  AZUL", codigoFornecedor: null, codigoBarras: null }, indice, null))
      .toEqual({ produto: C, como: "nome", daVariante: false });
    expect(normalizarNome("Camiseta Básica (P)")).toBe("camiseta basica p");
  });

  test("resposta ambígua não casa sozinha", () => {
    const dup = indexarProdutos([A, prod("a2", { name: "Outro", barcode: "7891234567895" }), prod("x", { name: "Esmalte Azul" }), C]);
    expect(acharProduto({ descricao: "?", codigoFornecedor: null, codigoBarras: "7891234567895" }, dup, null)).toBeNull();
    expect(acharProduto({ descricao: "Esmalte Azul", codigoFornecedor: null, codigoBarras: null }, dup, null)).toBeNull();
  });

  test("normalizar código de barras", () => {
    expect(normalizarBarras("0007891234567895")).toBe("7891234567895");
    expect(normalizarBarras("abc-12")).toBe("ABC-12");
    expect(normalizarBarras("")).toBeNull();
    expect(normalizarBarras("000")).toBeNull();
  });
});

describe("estados da linha", () => {
  const P = prod("p", { name: "Acetona", stock: 4, cost: 3.1, price: 7.9 });
  const G = prod("g", { name: "Camiseta", has_variants: true, barcode: "7890000000200" });
  const indice = indexarProdutos([P, G]);
  const ctx = { indice, codigos: { "AL-1": "p" }, semCusto: false };

  test("pronta, com a prévia de estoque, custo médio e margem", () => {
    const l = conferirLinha(item(1, { codigoFornecedor: "AL-1", quantidade: 12, custoUnitario: 3.2, total: 38.4 }), ctx);
    expect(l.estado).toBe("pronta");
    expect(l.entra).toBe(true);
    expect(l.falta).toBe(false);
    expect(l.previa?.estoqueAntes).toBe(4);
    expect(l.previa?.estoqueDepois).toBe(16);
    expect(l.previa?.custoDepois).toBeCloseTo(3.175, 3);
  });

  test("'Confere?' quando o custo está bem acima; não trava; 'Está certo' tira o aviso", () => {
    const it = item(1, { codigoFornecedor: "AL-1", quantidade: 10, custoUnitario: 48 });
    expect(conferirLinha(it, ctx)).toMatchObject({ estado: "confere", falta: false, entra: true });
    expect(conferirLinha(it, { ...ctx, ajuste: { custoConferido: true } }).estado).toBe("pronta");
    expect(conferirLinha(it, { ...ctx, ajuste: { custo: 4.5 } }).estado).toBe("pronta");
  });

  test("quem não vê custo: sem 'Confere?' e sem custo na prévia", () => {
    const l = conferirLinha(item(1, { codigoFornecedor: "AL-1", quantidade: 10, custoUnitario: 48 }), { ...ctx, semCusto: true });
    expect(l.estado).toBe("pronta");
    expect(l.previa?.custoDepois).toBe(3.1);
  });

  test("sem par trava; 'Deixar de fora' destrava e não entra", () => {
    const it = item(2, { descricao: "BASE 10ML" });
    expect(conferirLinha(it, ctx)).toMatchObject({ estado: "sem_par", falta: true, entra: false });
    expect(conferirLinha(it, { ...ctx, decisao: { tipo: "fora" } })).toMatchObject({ estado: "fora", falta: false, entra: false });
  });

  test("produto novo: entra só com nome e preço (pendência 6)", () => {
    const it = item(2, { descricao: "BASE 10ML", custoUnitario: 7.4 });
    const novo = decisaoDeNovo(it, false);
    expect(novo).toEqual({ tipo: "novo", nome: "BASE 10ML", preco: 14.8 });
    expect(conferirLinha(it, { ...ctx, decisao: novo })).toMatchObject({ estado: "novo", falta: false, entra: true });
    expect(conferirLinha(it, { ...ctx, decisao: { tipo: "novo", nome: "BASE", preco: null } })).toMatchObject({ estado: "novo", falta: true });
    expect(conferirLinha(it, { ...ctx, decisao: { tipo: "novo", nome: "  ", preco: 10 } })).toMatchObject({ estado: "novo", falta: true });
    // Quem não vê custo não recebe preço sugerido (entregaria o custo).
    expect(decisaoDeNovo(it, true)).toEqual({ tipo: "novo", nome: "BASE 10ML", preco: null });
  });

  test("ligar: trava até dizer a qual produto; ligado vira pronta", () => {
    const it = item(2, { descricao: "ALGODAO", custoUnitario: 3 });
    expect(conferirLinha(it, { ...ctx, decisao: { tipo: "ligar", produtoId: null } })).toMatchObject({ estado: "ligar", falta: true });
    const ligada = conferirLinha(it, { ...ctx, decisao: { tipo: "ligar", produtoId: "p" } });
    expect(ligada).toMatchObject({ estado: "pronta", entra: true });
    expect(ligada.produto?.id).toBe("p");
    expect(ligada.par).toBeNull();
  });

  test("quantidade zero: erro, fica de fora sozinha e não trava; 'Dizer quantos' devolve a linha", () => {
    const it = item(3, { codigoFornecedor: "AL-1", quantidade: 0, custoUnitario: 3 });
    expect(conferirLinha(it, ctx)).toMatchObject({ estado: "erro", falta: false, entra: false });
    expect(conferirLinha(it, { ...ctx, ajuste: { quantidade: 5 } })).toMatchObject({ estado: "pronta", quantidade: 5 });
  });

  test("produto de grade sem a variante: trava (a nota não diz a cor e o tamanho)", () => {
    expect(conferirLinha(item(4, { codigoBarras: "7890000000200" }), ctx)).toMatchObject({ estado: "grade", falta: true });
  });
});

describe("resumo e rodapé", () => {
  const r = lerNota(XML_CONFERENCIA);
  if (!r.ok) throw new Error("fixture");
  const indice = indexarProdutos(PRODUTOS_CONFERENCIA);
  const conferir = (decisoes: Record<number, any> = {}) =>
    r.nota.itens.map((it) => conferirLinha(it, { indice, codigos: { "AL-0391": "p-acetona" }, decisao: decisoes[it.n], semCusto: false }));

  test("a nota da conferência: 3 prontas, 1 sem par, 1 com quantidade zero", () => {
    const linhas = conferir();
    expect(linhas.map((l) => l.estado)).toEqual(["pronta", "pronta", "confere", "sem_par", "erro"]);
    expect(linhas.map((l) => l.par?.como || null)).toEqual(["codigo_barras", "codigo_fornecedor", "nome", null, null]);
    const res = resumirConferencia(linhas, r.nota.totalDosProdutos);
    expect(res).toEqual({
      itens: 5, prontos: 3, novos: 0, falta: 1, fora: 1, entram: 3, totalDosItens: 795.6, bate: true, podeDarEntrada: false,
    });
    expect(motivoDoRodape(linhas, res)).toEqual({ tipo: "faltam", n: 1 });
  });

  test("decidir a última linha destrava", () => {
    const linhas = conferir({ 4: decisaoDeNovo(r.nota.itens[3], false) });
    const res = resumirConferencia(linhas, r.nota.totalDosProdutos);
    expect(res).toMatchObject({ novos: 1, falta: 0, entram: 4, podeDarEntrada: true });
    expect(motivoDoRodape(linhas, res)).toEqual({ tipo: "pronto", n: 4 });
  });

  test("falta 1 e é 'ligar': o rodapé diz o nome", () => {
    const linhas = conferir({ 4: { tipo: "ligar", produtoId: null } });
    expect(motivoDoRodape(linhas, resumirConferencia(linhas, null))).toEqual({ tipo: "falta_ligar", nome: "BASE FORTALECEDORA 10ML" });
  });

  test("tudo de fora: nada para dar entrada", () => {
    const linhas = conferir({ 1: { tipo: "fora" }, 2: { tipo: "fora" }, 3: { tipo: "fora" }, 4: { tipo: "fora" } });
    const res = resumirConferencia(linhas, null);
    expect(res).toMatchObject({ entram: 0, podeDarEntrada: false, bate: null });
    expect(motivoDoRodape(linhas, res)).toEqual({ tipo: "nada" });
  });

  test("total que não bate", () => {
    expect(resumirConferencia(conferir(), 800).bate).toBe(false);
  });
});

describe("mostrar os outros", () => {
  const linha = (n: number, estado: LinhaConferida["estado"]) => ({ item: item(n), estado } as LinhaConferida);

  test("as que pedem atenção ficam; das prontas, as 3 primeiras", () => {
    const linhas = [linha(1, "pronta"), linha(2, "sem_par"), linha(3, "pronta"), linha(4, "pronta"), linha(5, "pronta"), linha(6, "erro"), linha(7, "pronta")];
    const r = linhasVisiveis(linhas, false);
    expect(r.visiveis.map((l) => l.item.n)).toEqual([1, 2, 3, 4, 6]);
    expect(r.escondidas).toBe(2);
    expect(linhasVisiveis(linhas, true).escondidas).toBe(0);
  });

  test("esconder uma só não vale o botão", () => {
    const linhas = [linha(1, "pronta"), linha(2, "pronta"), linha(3, "pronta"), linha(4, "pronta")];
    expect(linhasVisiveis(linhas, false)).toEqual({ visiveis: linhas, escondidas: 0 });
  });
});

test("preço sugerido pela margem", () => {
  expect(precoSugerido(1.95)).toBe(3.9);
  expect(precoSugerido(10, 50)).toBe(15);
  expect(precoSugerido(0)).toBeNull();
});
