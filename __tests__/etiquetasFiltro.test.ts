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

const f = (over: any) => filtrarEtiquetas(P, { ...FILTRO_PADRAO, ...over }, AGORA).map((p) => p.id);

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

test("filtrosAtivos não conta busca nem ordem", () => {
  expect(filtrosAtivos({ ...FILTRO_PADRAO, busca: "x", ordem: "name_asc" })).toBe(0);
  expect(filtrosAtivos({ ...FILTRO_PADRAO, periodo: "hoje", categoria: "Blusas", soComEstoque: true })).toBe(3);
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
