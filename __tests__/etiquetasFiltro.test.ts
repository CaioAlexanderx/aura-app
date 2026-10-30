// ============================================================
// Filtros da tela de Etiquetas (25/09/2026): ordem, período de cadastro,
// categoria e "só com estoque" (utils/etiquetasFiltro).
// ============================================================
import {
  filtrarEtiquetas, dentroDoPeriodo, categoriasDe, filtrosAtivos, FILTRO_PADRAO,
} from "@/utils/etiquetasFiltro";

// 25/09/2026 15:00 em São Paulo (18:00 UTC).
const AGORA = Date.parse("2026-09-25T18:00:00Z");

const P = [
  { id: "a", name: "Blusa Rosa", code: "001", barcode: "7890000000017", category: "Blusas", price: 50, stock: 3, created_at: "2026-09-25T12:00:00Z" },
  { id: "b", name: "Calça Jeans", code: "002", category: "Calças", price: 120, stock: 0, created_at: "2026-09-21T12:00:00Z" },
  { id: "c", name: "Açaí Cropped", code: "003", category: "Blusas", price: 30, stock: 8, created_at: "2026-08-01T12:00:00Z" },
  { id: "d", name: "Bermuda", code: "004", category: "", price: 80, stock: 1, created_at: null },
];

// Os testes de período/ordem/busca olham a lista inteira (interruptor desligado).
const f = (over: any) => filtrarEtiquetas(P, { ...FILTRO_PADRAO, soComEstoque: false, ...over }, AGORA).map((p) => p.id);

describe("dentroDoPeriodo", () => {
  test("'hoje' é o dia civil de São Paulo, não 24h corridas", () => {
    // 25/09 00:30 em SP = 03:30 UTC: é hoje.
    expect(dentroDoPeriodo("2026-09-25T03:30:00Z", "hoje", AGORA)).toBe(true);
    // 24/09 23:30 em SP = 25/09 02:30 UTC: foi ontem, mesmo com data UTC de hoje.
    expect(dentroDoPeriodo("2026-09-25T02:30:00Z", "hoje", AGORA)).toBe(false);
  });

  test("7 e 30 dias contam do instante atual", () => {
    expect(dentroDoPeriodo("2026-09-19T00:00:00Z", "7d", AGORA)).toBe(true);
    expect(dentroDoPeriodo("2026-09-18T12:00:00Z", "7d", AGORA)).toBe(false);
    expect(dentroDoPeriodo("2026-08-27T00:00:00Z", "30d", AGORA)).toBe(true);
  });

  test("sem data de cadastro só aparece em 'todos'", () => {
    expect(dentroDoPeriodo(null, "todos", AGORA)).toBe(true);
    expect(dentroDoPeriodo(null, "30d", AGORA)).toBe(false);
  });
});

describe("filtrarEtiquetas", () => {
  test("padrão: tudo, mais recentes primeiro (sem data vai para o fim)", () => {
    expect(f({})).toEqual(["a", "b", "c", "d"]);
  });

  test("período", () => {
    expect(f({ periodo: "hoje" })).toEqual(["a"]);
    expect(f({ periodo: "7d" })).toEqual(["a", "b"]);
  });

  test("categoria e só com estoque combinam", () => {
    expect(f({ categoria: "Blusas" })).toEqual(["a", "c"]);
    expect(f({ soComEstoque: true })).toEqual(["a", "c", "d"]);
    expect(f({ categoria: "Calças", soComEstoque: true })).toEqual([]);
  });

  test("ordem: nome sem se perder com acento, preço", () => {
    expect(f({ ordem: "name_asc" })).toEqual(["c", "d", "a", "b"]);
    expect(f({ ordem: "price_desc" })).toEqual(["b", "d", "a", "c"]);
  });

  test("busca continua valendo, por nome ou código", () => {
    expect(f({ busca: "calça" })).toEqual(["b"]);
    expect(f({ busca: "7890000" })).toEqual(["a"]);
  });
});

test("categoriasDe ignora vazias e ordena", () => {
  expect(categoriasDe(P)).toEqual(["Blusas", "Calças"]);
});

test("filtrosAtivos: o número do botão Filtros (cadastrados, categoria, ordem fora do padrão)", () => {
  // Busca e "Só com estoque" ficam fora do botão, à vista: não contam.
  expect(filtrosAtivos({ ...FILTRO_PADRAO, busca: "x" })).toBe(0);
  expect(filtrosAtivos({ ...FILTRO_PADRAO, soComEstoque: false })).toBe(0);
  expect(filtrosAtivos({ ...FILTRO_PADRAO, ordem: "name_asc" })).toBe(1);
  expect(filtrosAtivos({ ...FILTRO_PADRAO, periodo: "hoje", categoria: "Blusas", ordem: "price_asc" })).toBe(3);
});

describe("um dia escolhido no calendário (periodo 'dia')", () => {
  test("pega só o que foi cadastrado naquele dia civil de São Paulo", () => {
    expect(f({ periodo: "dia", dia: "2026-09-21" })).toEqual(["b"]);
    expect(f({ periodo: "dia", dia: "2026-09-25" })).toEqual(["a"]);
    expect(f({ periodo: "dia", dia: "2026-09-24" })).toEqual([]);
  });

  test("a virada do dia é a de São Paulo", () => {
    // 24/09 23:30 em SP = 25/09 02:30 UTC: conta no dia 24.
    expect(dentroDoPeriodo("2026-09-25T02:30:00Z", "dia", AGORA, "2026-09-24")).toBe(true);
    expect(dentroDoPeriodo("2026-09-25T02:30:00Z", "dia", AGORA, "2026-09-25")).toBe(false);
  });

  test("sem data válida não filtra nada (melhor mostrar tudo que esconder tudo)", () => {
    expect(f({ periodo: "dia", dia: null })).toEqual(["a", "b", "c", "d"]);
    expect(f({ periodo: "dia", dia: "24/09/2026" })).toEqual(["a", "b", "c", "d"]);
  });

  test("conta como filtro ativo", () => {
    expect(filtrosAtivos({ ...FILTRO_PADRAO, periodo: "dia", dia: "2026-09-24" })).toBe(1);
  });
});

test("diaParaBr e hojeEmSaoPaulo", () => {
  const { diaParaBr, hojeEmSaoPaulo } = require("@/utils/etiquetasFiltro");
  expect(diaParaBr("2026-09-24")).toBe("24/09/2026");
  expect(diaParaBr(null)).toBe("");
  // 25/09 01:00 UTC ainda é 24/09 em SP.
  expect(hojeEmSaoPaulo(Date.parse("2026-09-25T01:00:00Z"))).toBe("2026-09-24");
});

// ── 30/10/2026 (card p-71): padrão "Só com estoque" e variantes ──
describe("Só com estoque (p-71)", () => {
  const { temEstoque, estoqueDaVariante, variantesParaMarcar, lerSoComEstoque, salvarSoComEstoque, CHAVE_SO_COM_ESTOQUE } = require("@/utils/etiquetasFiltro");

  beforeEach(() => window.localStorage.clear());

  test("o padrão da tela é só com estoque", () => {
    expect(FILTRO_PADRAO.soComEstoque).toBe(true);
    expect(filtrarEtiquetas(P, FILTRO_PADRAO, AGORA).map((p) => p.id)).toEqual(["a", "c", "d"]);
  });

  test("produto com variantes: vale o estoque somado das variantes (o pai zerado não esconde)", () => {
    // O Product já chega com stock = has_variants ? variants_stock_total : stock_qty.
    expect(temEstoque({ stock: 3 })).toBe(true);
    expect(temEstoque({ stock: 0 })).toBe(false);
    expect(temEstoque({ stock: -2 })).toBe(false);
    expect(temEstoque({ stock: 0.5 })).toBe(true);
    expect(temEstoque({ stock: null })).toBe(false);
  });

  test("estoqueDaVariante lê stock_qty em texto ou número", () => {
    expect(estoqueDaVariante({ stock_qty: "4" })).toBe(4);
    expect(estoqueDaVariante({ stock_qty: "12.5" })).toBe(12.5);
    expect(estoqueDaVariante({ stock_qty: null })).toBe(0);
    expect(estoqueDaVariante(null)).toBe(0);
  });

  test("variante sem estoque não vem marcada com o interruptor ligado", () => {
    const vs = [{ id: "v1", stock_qty: "3" }, { id: "v2", stock_qty: "0" }, { id: "v3", stock_qty: null }, { id: "v4", stock_qty: "-1" }];
    expect(variantesParaMarcar(vs, true)).toEqual(["v1"]);
    // Desligado (a lojista quer ver os sem estoque também): marca todas.
    expect(variantesParaMarcar(vs, false)).toEqual(["v1", "v2", "v3", "v4"]);
  });

  test("a escolha fica lembrada neste computador; sem nada guardado, ligado", () => {
    expect(lerSoComEstoque()).toBe(true);
    salvarSoComEstoque(false);
    expect(window.localStorage.getItem(CHAVE_SO_COM_ESTOQUE)).toBe("0");
    expect(lerSoComEstoque()).toBe(false);
    salvarSoComEstoque(true);
    expect(lerSoComEstoque()).toBe(true);
    window.localStorage.setItem(CHAVE_SO_COM_ESTOQUE, "lixo");
    expect(lerSoComEstoque()).toBe(true);
  });
});

describe("Sem código (p-75)", () => {
  const { produtoSemCodigo, varianteSemCodigo } = require("@/utils/etiquetasFiltro");
  test("sem código de barras e sem SKU (o '---' do useProducts) é sem código", () => {
    expect(produtoSemCodigo({ barcode: "", code: "---" })).toBe(true);
    expect(produtoSemCodigo({ barcode: null, code: "" })).toBe(true);
    expect(produtoSemCodigo({ barcode: "", code: "221" })).toBe(false);
    expect(produtoSemCodigo({ barcode: "7891033948208", code: "---" })).toBe(false);
  });
  test("variante: o próprio código ou o do produto", () => {
    expect(varianteSemCodigo({ barcode: "" }, { barcode: "", code: "---" })).toBe(true);
    expect(varianteSemCodigo({ barcode: "2100000000017" }, { barcode: "", code: "---" })).toBe(false);
    expect(varianteSemCodigo({ barcode: "" }, { barcode: "", code: "221" })).toBe(false);
  });
});
