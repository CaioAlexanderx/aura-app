// ============================================================
// Vendas › Fechamentos de caixa paginado (18/11/2026)
//
// Antes só as 50 sessões mais recentes de cada loja apareciam (limit 50, sem
// página); há lojas com 173 e 161. Agora a tabela anda de 50 em 50 com o
// Pagination de sempre ("Anterior" / "Proxima"), por limit + offset da rota
// que já existe. Os números do topo (mês corrente) continuam vindo da
// primeira consulta de cada loja, sem mudar.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { montarPagina, totalDePaginas, TAMANHO_DA_PAGINA } from "@/utils/fechamentosPaginados";

const mockHistorico = jest.fn();
let mockConsolidado = false;
const LOJA_A = { id: "loja-a", trade_name: "Loja A" };
const LOJA_B = { id: "loja-b", trade_name: "Loja B" };

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/EmptyState", () => ({ EmptyState: "EmptyState" }));
jest.mock("@/services/caixaApi", () => ({ caixaApi: { historico: (...a: any[]) => mockHistorico(...a) } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: { id: LOJA_A.id, trade_name: LOJA_A.trade_name },
    consolidatedView: mockConsolidado,
    availableCompanies: [LOJA_A, LOJA_B],
  }),
}));

import { FechamentosTab } from "@/components/screens/vendas/FechamentosTab";
import { Pagination } from "@/components/Pagination";

// Sessões fechadas de uma loja, da mais nova para a mais antiga. As da loja A
// abrem nas horas pares e as da B nas ímpares, para as duas se intercalarem.
const AGORA = Date.UTC(2026, 10, 18, 12, 0, 0);
function sessoesDaLoja(loja: string, n: number, passoHoras: number, inicioHoras: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${loja}-${i}`,
    opened_at: new Date(AGORA - (inicioHoras + i * passoHoras) * 3600_000).toISOString(),
    closed_at: new Date(AGORA - (inicioHoras + i * passoHoras) * 3600_000 + 3600_000).toISOString(),
    total_geral: 100, diferenca: 0, dinheiro_esperado: 0, dinheiro_contado: 0,
    opened_by_name: "Operadora",
  }));
}
const BANCO: Record<string, any[]> = {
  [LOJA_A.id]: sessoesDaLoja(LOJA_A.id, 173, 2, 0),
  [LOJA_B.id]: sessoesDaLoja(LOJA_B.id, 161, 2, 1),
};
function servidor(companyId: string, params?: { limit?: number; offset?: number }) {
  const lista = BANCO[companyId] || [];
  const limit = Math.min(params?.limit || 20, 100);
  const offset = params?.offset || 0;
  return Promise.resolve({ sessoes: lista.slice(offset, offset + limit), total: lista.length });
}

describe("montarPagina", () => {
  test("uma loja com 173 sessões: 50, 50, 50 e 23, sem repetir nem pular", () => {
    let offsets: Record<string, number> = {};
    const vistos: string[] = [];
    const tamanhos: number[] = [];
    for (let p = 0; p < 4; p++) {
      const o = offsets[LOJA_A.id] || 0;
      const r = { companyId: LOJA_A.id, companyName: "Loja A", sessoes: BANCO[LOJA_A.id].slice(o, o + 50), total: 173 };
      const pg = montarPagina([r], offsets);
      tamanhos.push(pg.linhas.length);
      pg.linhas.forEach((l) => vistos.push(l.id));
      expect(pg.total).toBe(173);
      offsets = pg.proximos;
    }
    expect(tamanhos).toEqual([50, 50, 50, 23]);
    expect(vistos).toEqual(BANCO[LOJA_A.id].map((s) => s.id));
    expect(totalDePaginas(173)).toBe(4);
  });

  test("consolidado (173 + 161): páginas de 50 na ordem de abertura, somando as lojas", () => {
    const todas = [...BANCO[LOJA_A.id], ...BANCO[LOJA_B.id]]
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .map((s) => s.id);
    let offsets: Record<string, number> = {};
    const vistos: string[] = [];
    for (let p = 0; p < totalDePaginas(334); p++) {
      const respostas = [LOJA_A, LOJA_B].map((l) => {
        const o = offsets[l.id] || 0;
        return { companyId: l.id, companyName: l.trade_name, sessoes: BANCO[l.id].slice(o, o + 50), total: BANCO[l.id].length };
      });
      const pg = montarPagina(respostas, offsets);
      expect(pg.total).toBe(334);
      expect(pg.linhas.length).toBe(p < 6 ? 50 : 34);
      pg.linhas.forEach((l) => vistos.push(l.id));
      offsets = pg.proximos;
    }
    expect(vistos).toEqual(todas);
  });

  test("sem sessão: página vazia, uma página só", () => {
    const pg = montarPagina([{ companyId: "x", companyName: "X", sessoes: [], total: 0 }], {});
    expect(pg.linhas).toEqual([]);
    expect(totalDePaginas(pg.total)).toBe(1);
    expect(TAMANHO_DA_PAGINA).toBe(50);
  });
});

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><FechamentosTab /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

function textos(tree: any): string[] {
  return tree.root.findAll((n: any) => typeof n.type === "string" || n.type === "Text")
    .flatMap((n: any) => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]))
    .filter((c: any) => typeof c === "string" || typeof c === "number")
    .map(String);
}

function chamadas() {
  return mockHistorico.mock.calls.map((c) => `${c[0]}@${(c[1] && c[1].offset) || 0}`);
}

async function tocar(tree: any, direcao: 1 | -1) {
  const pg = tree.root.findByType(Pagination);
  await act(async () => { pg.props.onPage(pg.props.page + direcao); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  mockConsolidado = false;
  mockHistorico.mockReset();
  mockHistorico.mockImplementation(servidor);
});

describe("FechamentosTab paginado", () => {
  test("uma loja com 173: página 1 é a mesma consulta de antes (limit 50, sem offset)", async () => {
    const tree = await montar();
    expect(mockHistorico).toHaveBeenCalledTimes(1);
    expect(mockHistorico.mock.calls[0]).toEqual([LOJA_A.id, { limit: 50 }]);
    const pg = tree.root.findByType(Pagination);
    expect(pg.props).toEqual(expect.objectContaining({ page: 1, totalPages: 4, total: 173, pageSize: 50 }));
    expect(textos(tree)).toContain("1-50 de 173");
    expect(textos(tree).some((t) => t.indexOf("Anterior") >= 0)).toBe(true);
  });

  test("Próxima até a última página, Anterior volta; os números do topo não mudam", async () => {
    const tree = await montar();
    const topo = () => tree.root.findAll((n: any) => n.props && n.props.label === "Fechamentos no mês")[0].props.value;
    const topoAntes = topo();

    await tocar(tree, 1);
    expect(chamadas()).toContain(`${LOJA_A.id}@50`);
    expect(textos(tree)).toContain("51-100 de 173");
    expect(topo()).toBe(topoAntes);

    await tocar(tree, 1);
    await tocar(tree, 1);
    expect(chamadas()).toContain(`${LOJA_A.id}@150`);
    expect(textos(tree)).toContain("151-173 de 173");
    expect(tree.root.findByType(Pagination).props.page).toBe(4);
    expect(topo()).toBe(topoAntes);

    await tocar(tree, -1);
    expect(textos(tree)).toContain("101-150 de 173");
  });

  test("consolidado: uma consulta por loja; a página seguinte pede de cada uma o próprio offset", async () => {
    mockConsolidado = true;
    const tree = await montar();
    expect(chamadas().sort()).toEqual([`${LOJA_A.id}@0`, `${LOJA_B.id}@0`]);
    expect(textos(tree)).toContain("1-50 de 334");
    await tocar(tree, 1);
    // As 50 primeiras se dividem 25/25 (as lojas se intercalam de hora em hora).
    expect(chamadas()).toEqual(expect.arrayContaining([`${LOJA_A.id}@25`, `${LOJA_B.id}@25`]));
    expect(textos(tree)).toContain("51-100 de 334");
  });

  test("loja com até 50 sessões: sem paginação, como antes", async () => {
    mockHistorico.mockImplementation(() => Promise.resolve({ sessoes: BANCO[LOJA_A.id].slice(0, 12), total: 12 }));
    const tree = await montar();
    expect(textos(tree).some((t) => t.indexOf("Anterior") >= 0)).toBe(false);
    expect(mockHistorico).toHaveBeenCalledTimes(1);
  });
});
