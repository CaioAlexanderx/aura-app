// ============================================================
// AURA. — Financeiro: o botao "Ano" na barra de periodo (04/11/2026)
//
// Pedido do PO: a barra tinha Hoje, Semana e Mes; entra o Ano. O tipo, o
// calculo e o backend ja sabiam de "year" — so nao havia botao. O que este
// arquivo trava:
//   1. o chip existe e "Ano" deixou de ser caso do botao "Período";
//   2. ano = 1/jan ate hoje; o comparativo e o MESMO trecho do ano passado
//      (nao o ano inteiro — em novembro isso comparava 10 meses com 12);
//   3. os textos da tela ja falam "neste ano" / "DO ANO".
// ============================================================
import * as fs from "fs";
import * as path from "path";
import { getPeriodRange, getPreviousPeriodRange } from "@/components/screens/financeiro/types";

const ler = (...p: string[]) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

describe("o chip Ano", () => {
  const topbar = ler("components", "screens", "financeiro", "v2", "FinanceiroTopbar.tsx");

  it("esta na barra, depois do Mes", () => {
    const chips = Array.from(topbar.matchAll(/\{ key: "(\w+)", label: "([^"]+)" \}/g)).map((m) => [m[1], m[2]]);
    expect(chips).toEqual([["today", "Hoje"], ["week", "Semana"], ["month", "Mês"], ["year", "Ano"]]);
  });

  it('"Ano" nao e mais um estado do botao Período', () => {
    const linha = topbar.split("\n").find((l) => l.includes("var isCustomActive"))!;
    expect(linha).not.toMatch(/"year"/);
    expect(linha).toMatch(/"prev_year"/);
  });
});

describe("o periodo do ano", () => {
  it("vai de 1/jan ate hoje", () => {
    const r = getPeriodRange("year");
    const hoje = new Date();
    expect(r.start.getFullYear()).toBe(hoje.getFullYear());
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getDate()).toBe(hoje.getDate());
    expect(r.end.getMonth()).toBe(hoje.getMonth());
    expect(r.label).toBe(String(hoje.getFullYear()));
  });

  it("o comparativo e o mesmo trecho do ano passado, nao o ano inteiro", () => {
    const hoje = new Date();
    const a = getPreviousPeriodRange("year")!;
    expect(a.start.getFullYear()).toBe(hoje.getFullYear() - 1);
    expect(a.start.getMonth()).toBe(0);
    expect(a.start.getDate()).toBe(1);
    expect(a.end.getFullYear()).toBe(hoje.getFullYear() - 1);
    expect(a.end.getMonth()).toBe(hoje.getMonth());
    const ultimoDia = new Date(hoje.getFullYear() - 1, hoje.getMonth() + 1, 0).getDate();
    expect(a.end.getDate()).toBe(Math.min(hoje.getDate(), ultimoDia));
    expect(a.end.getHours()).toBe(23);
  });

  it("o trecho anterior tem o mesmo numero de dias do atual (fora o 29/fev)", () => {
    const r = getPeriodRange("year");
    const a = getPreviousPeriodRange("year")!;
    const dias = (x: { start: Date; end: Date }) => Math.round((x.end.getTime() - x.start.getTime()) / 86400000);
    expect(Math.abs(dias(r) - dias(a))).toBeLessThanOrEqual(1);
  });
});

describe("os textos", () => {
  it("o subtitulo diz 'neste ano' e o hero diz 'DO ANO'", () => {
    expect(ler("app", "(tabs)", "financeiro.tsx")).toMatch(/year: "neste ano"/);
    expect(ler("components", "screens", "financeiro", "v2", "ResumoHero.tsx")).toMatch(/case "year": return "DO ANO"/);
  });
});
