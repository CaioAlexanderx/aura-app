// ============================================================
// Planilha modelo de produtos + botão "Baixar modelo" (tq-36).
//
//   1. O arquivo existe em public/ e é um .xlsx de verdade.
//   2. Ponto central: o arquivo passa pelo MESMO caminho da importação
//      (lerArquivoPlanilha -> lerLinhasDaMatriz) e dá as 3 linhas de exemplo,
//      sem a linha de aviso; cada cabeçalho casa com o mapeamento automático
//      do backend e a conferência não deixa coluna de fora.
//   3. O botão aparece nos três lugares com o link certo (web: <a href
//      download>; nativo: Linking.openURL) e baixar não encerra nada.
//
// SUGGEST_MAP_ESPELHO é cópia fiel de suggestMapping/PRODUCT_FIELDS do
// Aura-backend (src/routes/importData.js, conferido em 18/10/2026): o app não
// importa código do backend. Se o backend mudar os apelidos, atualize aqui.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => (active ? children : null),
}));
const mockSetParams = jest.fn();
jest.mock("expo-router", () => ({ router: { setParams: (...a: any[]) => mockSetParams(...a) } }));

import fs from "fs";
import path from "path";
import React from "react";
import { Linking, Platform } from "react-native";
import renderer, { act } from "react-test-renderer";
import * as XLSX from "xlsx";
import { escolherAba, lerLinhasDaMatriz } from "@/utils/importPlanilha";
import { montarResumoImport } from "@/utils/importPrevia";
import { MODELO_PRODUTOS } from "@/components/screens/estoque/BaixarModelo";
import { ConvitePlanilha, conviteEncerradoNaSessao } from "@/components/screens/estoque/ConvitePlanilha";
import { ImportPlanilhaModal } from "@/components/screens/estoque/ImportPlanilhaModal";
import { ImportarMenu } from "@/components/screens/estoque/ImportarMenu";

const ARQUIVO = path.join(__dirname, "..", "public", "modelo-produtos-aura.xlsx");

// ── espelho do backend (ver cabeçalho) ──
const PRODUCT_FIELDS: Record<string, string[]> = {
  cost_price: ["preco de custo", "preco custo", "preço custo", "custo", "cost", "cost_price", "valor custo", "preco de custo (r$)"],
  name: ["nome do produto", "nome", "produto", "name", "descricao", "descrição", "description", "item"],
  card_price: ["preco no cartao", "preco cartao", "valor cartao", "valor cart", "cartao", "card_price"],
  price: ["preco de venda", "preco venda", "preço de venda", "price", "valor venda", "valor", "preco de venda (r$)",
    "valor din", "valor dinheiro", "preco a vista", "a vista", "preco unitario", "preco un"],
  stock_min: ["estoque minimo", "estoque mínimo", "min", "minimo", "stock_min"],
  stock_qty: ["estoque atual", "estoque", "quantidade", "qty", "stock", "qtd", "saldo"],
  barcode: ["codigo de barras", "codigo barras", "código barras", "ean", "barcode", "gtin", "codigo de barras (ean)"],
  sku: ["sku / codigo interno", "sku", "referencia", "referência", "cod interno", "codigo interno"],
  category: ["categoria", "category", "grupo", "tipo"],
  color: ["cor", "color", "cores"],
  size: ["tamanho", "tam", "grade", "size"],
  unit: ["unidade", "un", "unit", "medida", "unid", "unid.", "und", "unidade de medida", "un."],
  brand: ["marca", "fabricante", "brand"],
  description: ["descricao longa", "descrição longa", "detalhes", "observacoes", "observações"],
  ncm: ["ncm", "ncm produto"],
};
const FIELD_YIELDS_TO: Record<string, string[]> = { price: ["card_price"], unit: ["price", "cost_price", "card_price"] };
const ALIAS_FRACO: Record<string, string[]> = { name: ["item"] };
function aliasScore(n: string, a: string) {
  if (n === a) return 3;
  if (n.startsWith(a + " ") || n.startsWith(a + "(") || n.endsWith(" " + a)) return 2;
  if (a.length >= 4 && n.includes(a)) return 1;
  return 0;
}
function suggestMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const fraco: Record<string, boolean> = {};
  for (const header of headers) {
    const n = header.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const cands: { field: string; score: number; len: number; alias: string }[] = [];
    for (const [field, aliases] of Object.entries(PRODUCT_FIELDS)) {
      let melhor: { score: number; len: number; alias: string } | null = null;
      for (const a of aliases) {
        const score = aliasScore(n, a);
        if (score && (!melhor || score > melhor.score || (score === melhor.score && a.length > melhor.len))) melhor = { score, len: a.length, alias: a };
      }
      if (melhor) cands.push({ field, ...melhor });
    }
    const casados = new Set(cands.map(c => c.field));
    let v: typeof cands[number] | null = null;
    for (const c of cands) {
      if ((FIELD_YIELDS_TO[c.field] || []).some(f => casados.has(f))) continue;
      if (!v || c.score > v.score || (c.score === v.score && c.len > v.len)) v = c;
    }
    if (v) {
      map[header] = v.field;
      if ((ALIAS_FRACO[v.field] || []).includes(v.alias)) fraco[header] = true;
    }
  }
  for (const h of Object.keys(fraco)) {
    const field = map[h];
    if (Object.keys(map).some(o => o !== h && map[o] === field && !fraco[o])) delete map[h];
  }
  return map;
}

// ── helpers de render ──
const porTestID = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
// O Pressable e o componente que o envolve repetem o testID; o link é o nó que recebeu o accessibilityRole.
function noDoLink(tree: renderer.ReactTestRenderer, id: string) {
  const no = tree.root.findAll((n) => n.props && n.props.testID === id && n.props.accessibilityRole !== undefined)[0];
  expect(no).toBeDefined();
  return no;
}
function textoDe(tree: renderer.ReactTestRenderer, id: string) {
  return porTestID(tree, id).map(n => flattenText(n.children)).join("");
}
// Mesmos passos de lerArquivoPlanilha (hooks/useServerImport.ts) para .xlsx: o Jest não roda o
// `await import("xlsx")` dele (precisa de --experimental-vm-modules) e importar o hook arrasta o
// SecureStore nativo. As chamadas são as mesmas: read -> sheet_to_json(header:1, raw:true,
// defval:"") de cada aba -> escolherAba -> início do intervalo -> lerLinhasDaMatriz.
function lerModelo() {
  const buf = fs.readFileSync(ARQUIVO);
  const wb = XLSX.read(buf, { type: "buffer" });
  const abas = wb.SheetNames.map(nome => ({
    nome,
    matriz: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "" }) as unknown[][],
  }));
  const escolhida = escolherAba(abas)!;
  const inicio = XLSX.utils.decode_range(wb.Sheets[escolhida.nome]["!ref"]!).s.r;
  return {
    matrix: escolhida.matriz,
    nomeAba: escolhida.nome,
    primeiraAba: wb.SheetNames[0] === escolhida.nome,
    linhaDoArquivo: (i: number) => inicio + i + 1,
  };
}

const CABECALHOS = ["Nome do produto", "Preço de venda", "Custo", "Estoque", "Categoria", "Código de barras", "Marca", "Unidade"];

describe("arquivo do modelo", () => {
  test("existe em public/, com o nome do link, e é um .xlsx (zip)", () => {
    expect(MODELO_PRODUTOS.caminho).toBe("/modelo-produtos-aura.xlsx");
    expect(path.join(__dirname, "..", "public", MODELO_PRODUTOS.arquivo)).toBe(ARQUIVO);
    expect(fs.existsSync(ARQUIVO)).toBe(true);
    const cab = fs.readFileSync(ARQUIVO).subarray(0, 2).toString("latin1");
    expect(cab).toBe("PK");
  });

  test("passa pelo parser da importação: 3 linhas de exemplo, sem a linha de aviso", () => {
    const leitura = lerModelo();
    expect(leitura.nomeAba).toBe("Produtos");
    // a matriz tem o aviso, os cabeçalhos e os 3 exemplos...
    expect(leitura.matrix).toHaveLength(5);
    expect(String(leitura.matrix[0][0])).toBe("Uma linha por produto. Apague as linhas de exemplo. Cor e tamanho você cadastra depois no Estoque.");

    // ...e o parser acha o cabeçalho na linha 2 e entrega só os produtos.
    const lidas = lerLinhasDaMatriz(leitura.matrix, leitura.linhaDoArquivo);
    expect(lidas.linhaCabecalho).toBe(2);
    expect(lidas.cabecalho).toEqual(CABECALHOS);
    expect(lidas.rows).toHaveLength(3);
    expect(lidas.linhas).toEqual([3, 4, 5]);
    expect(lidas.rows.map(r => r["Nome do produto"])).toEqual([
      "Vestido midi floral (exemplo)",
      "Camiseta básica algodão (exemplo)",
      "Calça jeans reta (exemplo)",
    ]);
    // nada do aviso virou produto nem coluna
    expect(JSON.stringify(lidas.rows)).not.toContain("Uma linha por produto");
    // todos os campos preenchidos, com o tipo certo para o backend
    expect(lidas.rows[0]).toEqual({
      "Nome do produto": "Vestido midi floral (exemplo)",
      "Preço de venda": "189.9",
      Custo: "95",
      Estoque: "8",
      Categoria: "Vestidos",
      "Código de barras": "7890000000017",
      Marca: "Marca exemplo",
      Unidade: "un",
    });
    lidas.rows.forEach(r => CABECALHOS.forEach(c => expect(r[c]).not.toBe("")));
  });

  test("cada cabeçalho casa com o mapeamento automático do backend; Cor e Tamanho não estão no modelo", () => {
    expect(suggestMapping(CABECALHOS)).toEqual({
      "Nome do produto": "name",
      "Preço de venda": "price",
      Custo: "cost_price",
      Estoque: "stock_qty",
      Categoria: "category",
      "Código de barras": "barcode",
      Marca: "brand",
      Unidade: "unit",
    });
    expect(CABECALHOS.map(c => c.toLowerCase())).not.toContain("cor");
    expect(CABECALHOS.map(c => c.toLowerCase())).not.toContain("tamanho");
  });

  test("a conferência reconhece as 8 colunas, sem 'não usadas' nem campo obrigatório faltando", () => {
    const leitura = lerModelo();
    const lidas = lerLinhasDaMatriz(leitura.matrix, leitura.linhaDoArquivo);
    const mapa = suggestMapping(lidas.cabecalho);
    const resumo = montarResumoImport(
      { total: lidas.rows.length, errors: [], duplicatas: [], suggested_map: mapa, a_importar: lidas.rows.length, preview: [] } as any,
      { cabecalho: lidas.cabecalho, linhas: lidas.linhas, linhaCabecalho: lidas.linhaCabecalho, rows: lidas.rows, nomeAba: leitura.nomeAba },
    );
    expect(resumo.colunas.map(c => c.coluna)).toEqual(CABECALHOS);
    expect(resumo.naoUsadas).toEqual([]);
    expect(resumo.faltando).toEqual([]);
    expect(resumo.aImportar).toBe(3);
    expect(resumo.totalLinhas).toBe(3);
  });
});

describe("botão Baixar modelo — web", () => {
  beforeEach(() => { mockSetParams.mockReset(); window.sessionStorage.clear(); });

  test("convite do check-in: ao lado de 'Escolher planilha' e 'Agora não', com o link certo, e não encerra o convite", () => {
    const onEscolher = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ConvitePlanilha importar="planilha" onEscolher={onEscolher} />); });
    expect(porTestID(tree, "estoque-convite-planilha-escolher")).toHaveLength(1);
    expect(porTestID(tree, "estoque-convite-planilha-fechar")).toHaveLength(1);
    const modelo = noDoLink(tree, "estoque-convite-planilha-modelo");
    expect(modelo.props.href).toBe("/modelo-produtos-aura.xlsx");
    expect(modelo.props.hrefAttrs.download).toBe("modelo-produtos-aura.xlsx");
    expect(flattenText(modelo.children)).toBe("Baixar modelo");
    // o toque (que o navegador transforma em download) não chama nada do convite
    if (modelo.props.onPress) act(() => { modelo.props.onPress({}); });
    expect(onEscolher).not.toHaveBeenCalled();
    expect(porTestID(tree, "estoque-convite-planilha")).toHaveLength(1);
    expect(conviteEncerradoNaSessao()).toBe(false);
    expect(mockSetParams).not.toHaveBeenCalled();
    act(() => { tree.unmount(); });
  });

  test("conferência da importação: botão com o link certo; no relatório final, não", () => {
    const resumo: any = {
      aba: null, nomeArquivo: "x.xlsx", linhaCabecalho: 1, totalLinhas: 1,
      colunas: [{ coluna: "Nome", campo: "name", rotulo: "nome do produto" }],
      naoUsadas: [], faltando: ["o preço de venda"], aImportar: 0, amostra: [],
      repetidasNaPlanilha: [], jaExistem: [], problemas: [], unidadesDesconhecidas: { total: 0, valores: [] }, mapaColunas: {},
    };
    const props = { resumo, resultado: null, erro: null, nomeArquivo: "x.xlsx", onImportar: jest.fn(), onFechar: jest.fn(), onBaixarProblemas: jest.fn() };
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ImportPlanilhaModal fase="conferindo" {...props} />); });
    const modelo = noDoLink(tree, "import-baixar-modelo");
    expect(modelo.props.href).toBe("/modelo-produtos-aura.xlsx");
    expect(modelo.props.hrefAttrs.download).toBe("modelo-produtos-aura.xlsx");
    expect(flattenText(modelo.children)).toBe("Baixar modelo");
    // continua tudo como estava: nada foi gravado nem fechado
    expect(props.onImportar).not.toHaveBeenCalled();
    expect(props.onFechar).not.toHaveBeenCalled();

    const resultado: any = { gravados: 1, totalLinhas: 1, repetidasNaPlanilha: [], jaExistem: [], problemas: [], unidadesDesconhecidas: { total: 0, valores: [] }, precoCartaoIgnorado: false };
    act(() => { tree.update(<ImportPlanilhaModal fase="pronto" {...props} resultado={resultado} />); });
    expect(porTestID(tree, "import-baixar-modelo")).toHaveLength(0);
    act(() => { tree.unmount(); });
  });

  test("menu Importar: terceira opção com o link certo; o menu fecha um instante depois", () => {
    jest.useFakeTimers();
    try {
      const onNota = jest.fn();
      const onPlanilha = jest.fn();
      let tree!: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<ImportarMenu onNota={onNota} onPlanilha={onPlanilha} />); });
      act(() => { porTestID(tree, "importar-botao")[0].props.onPress(); });
      const modelo = noDoLink(tree, "importar-opcao-modelo");
      expect(modelo.props.href).toBe("/modelo-produtos-aura.xlsx");
      expect(modelo.props.hrefAttrs.download).toBe("modelo-produtos-aura.xlsx");
      expect(modelo.props.accessibilityRole).toBe("link");
      // as outras duas opções seguem iguais
      expect(porTestID(tree, "importar-opcao-nota")).toHaveLength(1);
      expect(porTestID(tree, "importar-opcao-planilha")).toHaveLength(1);

      act(() => { modelo.props.onPress({}); });
      // ainda aberto: o <a> tem que sobreviver até o navegador começar o download
      expect(porTestID(tree, "importar-menu")).toHaveLength(1);
      act(() => { jest.advanceTimersByTime(300); });
      expect(porTestID(tree, "importar-menu")).toHaveLength(0);
      expect(onNota).not.toHaveBeenCalled();
      expect(onPlanilha).not.toHaveBeenCalled();
      act(() => { tree.unmount(); });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("botão Baixar modelo — nativo", () => {
  test("abre a URL do arquivo pelo Linking e não encerra o convite", () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
    const original = Platform.OS;
    (Platform as any).OS = "ios";
    try {
      let tree!: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<ConvitePlanilha importar="planilha" onEscolher={jest.fn()} />); });
      const modelo = noDoLink(tree, "estoque-convite-planilha-modelo");
      expect(modelo.props.href).toBeUndefined();
      act(() => { modelo.props.onPress({}); });
      expect(abrir).toHaveBeenCalledWith("https://app.getaura.com.br/modelo-produtos-aura.xlsx");
      expect(porTestID(tree, "estoque-convite-planilha")).toHaveLength(1);
      expect(conviteEncerradoNaSessao()).toBe(false);
      act(() => { tree.unmount(); });
    } finally {
      (Platform as any).OS = original;
      abrir.mockRestore();
    }
  });
});
