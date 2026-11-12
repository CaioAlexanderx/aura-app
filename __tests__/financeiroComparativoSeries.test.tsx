// p-112 (12/11/2026): "Comparar com" do Financeiro escolhe a serie do grafico.
//
// Cobre: os quatro modos (titulo, linhas, escala), o toque num dia (detalhe
// com data e valores, sem depender de mouse), a serie lembrada por usuario e a
// prova de que o modo Saldo desenha o MESMO SVG de antes — comparando com a
// copia do componente antigo em __tests__/__fixtures__/financeiro/.
//
// react-native-svg nao passa pelo transformIgnorePatterns do projeto, entao vira
// elementos-string; o que importa aqui sao os props que chegam a cada um.

import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Svg: "Svg",
  Path: "Path",
  Line: "Line",
  Circle: "Circle",
  Text: "SvgText",
}));

var mockUserId: string | undefined = "usuario-1";
var mockConsolidated = false;
jest.mock("@/stores/auth", () => ({
  useAuthStore: function (selector: any) {
    var state = {
      company: { id: "empresa-1" },
      user: mockUserId ? { id: mockUserId } : null,
      consolidatedView: mockConsolidated,
      token: "t",
      isDemo: false,
    };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

var mockData: any = null;
jest.mock("@/hooks/useFinancialComparative", () => ({
  useFinancialComparative: function () {
    return { data: mockData, isLoading: false, isFetching: false };
  },
}));

import { ComparativeSection } from "@/components/screens/financeiro/v2/ComparativeSection";
import { ComparativeSection as ComparativeSectionAntes } from "./__fixtures__/financeiro/ComparativeSectionAntesP112";

// ── Dados ───────────────────────────────────────────────────
function day(date: string, income: number, expenses: number) {
  return { date: date, income: income, expenses: expenses, net: income - expenses };
}

// Novembro com dias de saldo negativo (despesa > receita) e um dia vazio.
var CURRENT = [
  day("2026-11-01", 1200, 300),
  day("2026-11-02", 0, 0),
  day("2026-11-03", 450, 900),
  day("2026-11-04", 2300, 150),
  day("2026-11-05", 800, 1200),
  day("2026-11-06", 1500, 200),
  day("2026-11-07", 600, 50),
];
var PREVIOUS = [
  day("2026-10-25", 900, 100),
  day("2026-10-26", 300, 400),
  day("2026-10-27", 0, 0),
  day("2026-10-28", 1700, 600),
  day("2026-10-29", 1100, 250),
  day("2026-10-30", 400, 900),
  day("2026-10-31", 950, 300),
];

function totals(d: any[]) {
  var income = 0, expenses = 0;
  d.forEach(function (p) { income += p.income; expenses += p.expenses; });
  return { income: income, expenses: expenses, net: income - expenses };
}

function makeData(consolidated: boolean) {
  return {
    current: { start: "2026-11-01", end: "2026-11-07", label: "01/11 - 07/11/2026", daily: CURRENT, totals: totals(CURRENT) },
    previous: { start: "2026-10-25", end: "2026-10-31", label: "25/10 - 31/10/2026", daily: PREVIOUS, totals: totals(PREVIOUS) },
    delta: { income_pct: 10, expenses_pct: -5, net_pct: 20 },
    consolidated: consolidated,
    company_count: consolidated ? 2 : undefined,
  };
}

// ── Helpers ─────────────────────────────────────────────────
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

function byTestID(tree: renderer.ReactTestRenderer, id: string) {
  // Mais externo: o elemento com os props do componente (onPress etc.).
  return tree.root.findAll(function (n) { return n.props && n.props.testID === id; })[0];
}
function hasTestID(tree: renderer.ReactTestRenderer, id: string): boolean {
  return tree.root.findAll(function (n) { return n.props && n.props.testID === id; }).length > 0;
}

// Arvore do SVG como dado puro: tipo + props (sem funcoes) + filhos.
function svgShape(tree: renderer.ReactTestRenderer): any {
  var svg = tree.root.findAll(function (n) { return (n.type as any) === "Svg"; })[0];
  expect(svg).toBeTruthy();
  function walk(inst: any): any {
    if (typeof inst === "string" || typeof inst === "number") return String(inst);
    var props: Record<string, any> = {};
    Object.keys(inst.props).sort().forEach(function (k) {
      if (k === "children") return;
      var v = inst.props[k];
      if (typeof v === "function") return;
      props[k] = v;
    });
    return { type: inst.type, props: props, children: inst.children.map(walk) };
  }
  return walk(svg);
}

function elementsOf(shape: any, type: string): any[] {
  var out: any[] = [];
  (function walk(n: any) {
    if (!n || typeof n === "string") return;
    if (n.type === type) out.push(n);
    n.children.forEach(walk);
  })(shape);
  return out;
}

function tickLabels(shape: any): string[] {
  return elementsOf(shape, "SvgText")
    .filter(function (t) { return t.props.textAnchor === "end"; })
    .map(function (t) { return t.children.join(""); });
}

function mount(): renderer.ReactTestRenderer {
  var tree: renderer.ReactTestRenderer;
  act(function () {
    tree = renderer.create(<ComparativeSection period="week" />);
  });
  return tree!;
}

function pick(tree: renderer.ReactTestRenderer, serie: string) {
  act(function () { byTestID(tree, "comparativo-serie-" + serie).props.onPress(); });
}

beforeEach(function () {
  mockUserId = "usuario-1";
  mockConsolidated = false;
  mockData = makeData(false);
  try { window.localStorage.clear(); } catch { /* sem storage */ }
});

// ── Saldo identico ao de antes ──────────────────────────────
describe("modo Saldo (padrão)", function () {
  it("desenha o mesmo SVG do componente antes do p-112", function () {
    var antes: renderer.ReactTestRenderer;
    act(function () { antes = renderer.create(<ComparativeSectionAntes period="week" />); });
    var depois = mount();

    var shapeAntes = svgShape(antes!);
    var shapeDepois = svgShape(depois);
    expect(elementsOf(shapeAntes, "Path").length).toBe(2);
    expect(shapeDepois).toEqual(shapeAntes);
  });

  it("também no consolidado multi-CNPJ e com período vazio de um lado", function () {
    mockConsolidated = true;
    mockData = makeData(true);
    mockData.previous.daily = [];
    var antes: renderer.ReactTestRenderer;
    act(function () { antes = renderer.create(<ComparativeSectionAntes period="week" />); });
    expect(svgShape(mount())).toEqual(svgShape(antes!));
  });

  it("título é 'Saldo por dia' e a escala inclui valores negativos", function () {
    var tree = mount();
    expect(flattenText(byTestID(tree, "comparativo-titulo").children)).toBe("Saldo por dia");
    var paths = elementsOf(svgShape(tree), "Path");
    expect(paths.length).toBe(2);
    expect(tickLabels(svgShape(tree))[0]).toMatch(/^R\$ -/);
  });
});

// ── Os outros modos ─────────────────────────────────────────
describe("modos Receita, Despesa e Receita e despesa", function () {
  it("Receita: título, uma série atual sólida e anterior tracejada, eixo a partir de R$ 0", function () {
    var tree = mount();
    pick(tree, "receita");
    expect(flattenText(byTestID(tree, "comparativo-titulo").children)).toBe("Receita por dia");
    var shape = svgShape(tree);
    var paths = elementsOf(shape, "Path");
    expect(paths.length).toBe(2);
    expect(paths[0].props.strokeDasharray).toBe("4,4");   // anterior
    expect(paths[1].props.strokeDasharray).toBeUndefined(); // atual
    expect(tickLabels(shape)[0]).toBe("R$ 0");
    // Pico da receita atual (2.300 no dia 04/11) rotulado
    var texts = elementsOf(shape, "SvgText").map(function (t) { return t.children.join(""); });
    expect(texts).toContain("R$ 2,3k");
  });

  it("Despesa: título e eixo a partir de R$ 0", function () {
    var tree = mount();
    pick(tree, "despesa");
    expect(flattenText(byTestID(tree, "comparativo-titulo").children)).toBe("Despesa por dia");
    var shape = svgShape(tree);
    expect(elementsOf(shape, "Path").length).toBe(2);
    expect(tickLabels(shape)[0]).toBe("R$ 0");
  });

  it("Receita e despesa: quatro linhas, cada série com sua cor no atual e no anterior", function () {
    var tree = mount();
    pick(tree, "ambos");
    expect(flattenText(byTestID(tree, "comparativo-titulo").children)).toBe("Receita e despesa por dia");
    var paths = elementsOf(svgShape(tree), "Path");
    expect(paths.length).toBe(4);
    var dashed = paths.filter(function (p) { return p.props.strokeDasharray === "4,4"; });
    var solid = paths.filter(function (p) { return p.props.strokeDasharray === undefined; });
    expect(dashed.length).toBe(2);
    expect(solid.length).toBe(2);
    // Cores próprias: as duas sólidas diferem, e cada tracejada repete a cor da sua série
    expect(solid[0].props.stroke).not.toBe(solid[1].props.stroke);
    expect(dashed.map(function (p) { return p.props.stroke; })).toEqual(solid.map(function (p) { return p.props.stroke; }));
    expect(tickLabels(svgShape(tree))[0]).toBe("R$ 0");
  });

  it("funciona igual no consolidado multi-CNPJ", function () {
    mockConsolidated = true;
    mockData = makeData(true);
    var tree = mount();
    pick(tree, "ambos");
    expect(elementsOf(svgShape(tree), "Path").length).toBe(4);
  });
});

// ── Toque num dia ───────────────────────────────────────────
describe("toque num ponto", function () {
  it("mostra data e valor do dia e do período anterior; tocar de novo fecha", function () {
    var tree = mount();
    pick(tree, "receita");
    expect(hasTestID(tree, "comparativo-tooltip")).toBe(false);

    act(function () { byTestID(tree, "comparativo-ponto-3").props.onPress(); });
    var tip = flattenText(byTestID(tree, "comparativo-tooltip").children).replace(/ /g, " ");
    expect(tip).toContain("04/11");
    expect(tip).toContain("28/10");
    expect(tip).toContain("Receita");
    expect(tip).toContain("R$ 2.300,00");
    expect(tip).toContain("R$ 1.700,00");
    // guia vertical desenhada no SVG
    var guide = elementsOf(svgShape(tree), "Line").filter(function (l) { return l.props.strokeDasharray === "3,3"; });
    expect(guide.length).toBe(1);

    act(function () { byTestID(tree, "comparativo-ponto-3").props.onPress(); });
    expect(hasTestID(tree, "comparativo-tooltip")).toBe(false);
  });

  it("no modo com duas séries mostra receita e despesa do dia", function () {
    var tree = mount();
    pick(tree, "ambos");
    act(function () { byTestID(tree, "comparativo-ponto-4").props.onPress(); });
    var tip = flattenText(byTestID(tree, "comparativo-tooltip").children).replace(/ /g, " ");
    expect(tip).toContain("05/11");
    expect(tip).toContain("Receita");
    expect(tip).toContain("R$ 800,00");
    expect(tip).toContain("Despesa");
    expect(tip).toContain("R$ 1.200,00");
  });

  it("no Saldo mostra o saldo negativo do dia", function () {
    var tree = mount();
    act(function () { byTestID(tree, "comparativo-ponto-2").props.onPress(); });
    var tip = flattenText(byTestID(tree, "comparativo-tooltip").children).replace(/ /g, " ");
    expect(tip).toContain("03/11");
    expect(tip).toMatch(/-\s?R\$ 450,00/);
  });

  it("cada dia tem um alvo de toque com rótulo acessível", function () {
    var tree = mount();
    for (var i = 0; i < CURRENT.length; i++) {
      expect(hasTestID(tree, "comparativo-ponto-" + i)).toBe(true);
    }
    var label = String(byTestID(tree, "comparativo-ponto-0").props.accessibilityLabel).replace(/ /g, " ");
    expect(label).toContain("01/11");
    expect(label).toContain("R$ 900,00");
  });
});

// ── Série lembrada por usuário ──────────────────────────────
describe("série lembrada", function () {
  it("volta na última escolhida pelo mesmo usuário, e não vaza pra outro", function () {
    var tree = mount();
    pick(tree, "despesa");
    act(function () { tree.unmount(); });

    var again = mount();
    expect(flattenText(byTestID(again, "comparativo-titulo").children)).toBe("Despesa por dia");
    act(function () { again.unmount(); });

    mockUserId = "usuario-2";
    var other = mount();
    expect(flattenText(byTestID(other, "comparativo-titulo").children)).toBe("Saldo por dia");
  });

  it("valor inválido no storage cai no Saldo", function () {
    window.localStorage.setItem("aura.financeiro.comparativo.serie.usuario-1", "qualquer");
    var tree = mount();
    expect(flattenText(byTestID(tree, "comparativo-titulo").children)).toBe("Saldo por dia");
  });
});
