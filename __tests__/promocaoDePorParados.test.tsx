// ============================================================
// De/Por — achados do QA de 08/11/2026 no assistente "Criar promoção"
//
// 1. "Parados há 60 dias ou mais" no passo 1 (estava no mockup aprovado e
//    faltava): só com estoque, sem venda nos últimos 60 dias em Brasília
//    (hoje conta como um deles; quem vendeu há exatamente 60 dias entra),
//    dado das rotas que o backend já tem (ranking + "O que vai faltar").
// 2. Margem média antes → depois no passo 3: só itens com custo, ponderada
//    pelo preço, escondida de quem não vê custo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; isNetworkError = false; code: string | null = null;
    constructor(m: string, status: number, data?: any) { super(m); this.status = status; this.data = data; }
  }
  return { request: (...a: any[]) => mockRequest(...a), ApiError, companiesApi: { products: jest.fn() } };
});

let mockProdutos: any[] = [];
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: mockProdutos, isLoading: false }) }));
let mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));
const mockRefetch = jest.fn();
let mockRecentes: any;
jest.mock("@/hooks/useVendidosRecentes", () => ({ useVendidosRecentes: () => mockRecentes }));

import {
  DIAS_PARADO, inicioDaJanelaParados, vendidosDesde, estaParado, margemDaPrevia, textoDaMargem, textoSemCusto,
} from "@/components/screens/blackfriday/dePor/regrasDePor";
import { vendidosNosUltimos60Dias, LIMITE_RANKING } from "@/services/vendasRecentesApi";
import { CriarPromocaoModal } from "@/components/screens/blackfriday/dePor/CriarPromocaoModal";

const CID = "aaaaaaaa-0000-4000-8000-000000000001";
const HOJE = "2026-11-08";
jest.setTimeout(30000);

beforeEach(() => {
  mockRequest.mockReset();
  mockRefetch.mockReset();
  jest.useFakeTimers({
    now: new Date("2026-11-08T15:00:00Z"),
    doNotFake: [
      "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "performance", "hrtime",
    ],
  });
  mockConsulta = { consulta: false, carregando: false, semCusto: false };
  mockRecentes = { vendidos: {}, carregando: false, erro: false, refetch: mockRefetch };
  mockProdutos = [];
});
afterEach(() => jest.useRealTimers());

function comQuery(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{el}</QueryClientProvider>;
}
async function montar(el: React.ReactElement) {
  let r: renderer.ReactTestRenderer;
  await act(async () => { r = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return r!;
}
function porId(r: renderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n) => n.props.testID === id, { deep: false })[0];
}
function tem(r: renderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n) => n.props.testID === id, { deep: false }).length > 0;
}
function textoDe(node: any): string {
  if (!node) return "";
  return (node.children as any[]).map((c) => (typeof c === "string" ? c : textoDe(c))).join("");
}
async function tocar(r: renderer.ReactTestRenderer, id: string) {
  const n = porId(r, id);
  if (!n) throw new Error("sem " + id);
  await act(async () => { n.props.onPress(); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}

// ── 1. Regra dos parados ─────────────────────────────────────

describe("parados há 60 dias ou mais: a regra", () => {
  it("a janela vai de hoje − 59 até hoje (60 dias contando hoje)", () => {
    expect(DIAS_PARADO).toBe(60);
    expect(inicioDaJanelaParados(HOJE)).toBe("2026-09-10");
  });

  const inicio = inicioDaJanelaParados(HOJE);
  const produtos = [
    { id: "zerado", stock: 0 },
    { id: "vendeu-ontem", stock: 4 },
    { id: "nunca-vendeu", stock: 2 },
    { id: "vendeu-dia-60", stock: 1 },
    { id: "vendeu-dia-59", stock: 1 },
    { id: "compartilhado-outra-loja", stock: 7 },
  ];
  const vendidos = vendidosDesde(
    [{ id: "vendeu-ontem" }],
    [
      // 09/09 às 23h30 em Brasília (02h30 UTC do dia 10): há exatamente 60 dias.
      { product_id: "vendeu-dia-60", ultima_venda: "2026-09-10T02:30:00Z" },
      // 10/09 à 00h00 em Brasília: há 59 dias, ainda dentro da janela.
      { product_id: "vendeu-dia-59", ultima_venda: "2026-09-10T03:00:00Z" },
      { product_id: "compartilhado-outra-loja", ultima_venda: "2026-11-07T18:00:00Z" },
    ],
    inicio,
  );
  const parados = produtos.filter((p) => estaParado(p, vendidos)).map((p) => p.id);

  it("sem estoque fica de fora", () => { expect(parados).not.toContain("zerado"); });
  it("quem vendeu nos últimos 60 dias fica de fora (ranking ou O que vai faltar)", () => {
    expect(parados).not.toContain("vendeu-ontem");
    expect(parados).not.toContain("compartilhado-outra-loja");
  });
  it("nunca vendeu e tem estoque entra", () => { expect(parados).toContain("nunca-vendeu"); });
  it("limite: vendeu há exatamente 60 dias entra; há 59 dias não", () => {
    expect(parados).toContain("vendeu-dia-60");
    expect(parados).not.toContain("vendeu-dia-59");
  });
  it("linha sem data de venda conta como vendida (na dúvida, não entra)", () => {
    expect(vendidosDesde([], [{ product_id: "x", ultima_venda: null }], inicio)).toEqual({ x: true });
  });
});

describe("vendas dos últimos 60 dias: só rotas que já existem", () => {
  it("ranking de hoje − 59 até hoje (paginado) + O que vai faltar com janela de 60", async () => {
    mockRequest.mockImplementation((url: string) => {
      if (url.indexOf("/products/ranking") >= 0) {
        const off = Number(/offset=(\d+)/.exec(url)![1]);
        return Promise.resolve({
          products: off === 0 ? [{ id: "p1" }, { id: "p2" }] : [{ id: "p3" }],
          pagination: { total_items: LIMITE_RANKING + 1 },
        });
      }
      return Promise.resolve({
        itens: [{ product_id: "p4", ultima_venda: "2026-11-01T15:00:00Z" }],
        zerados: [{ product_id: "p5", ultima_venda: "2026-09-09T15:00:00Z" }],
      });
    });
    const vendidos = await vendidosNosUltimos60Dias(CID, HOJE);
    const urls = mockRequest.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/companies/" + CID + "/products/ranking?period=custom&start_date=2026-09-10&end_date=2026-11-08&limit=1000&offset=0");
    expect(urls).toContain("/companies/" + CID + "/products/ranking?period=custom&start_date=2026-09-10&end_date=2026-11-08&limit=1000&offset=1000");
    expect(urls).toContain("/companies/" + CID + "/estoque/ruptura?janela=60");
    // p5 vendeu em 09/09 (há 60 dias): fora da janela, continua parado.
    expect(vendidos).toEqual({ p1: true, p2: true, p3: true, p4: true });
  });

  it("falha de uma das rotas falha a conta (não chuta quem está parado)", async () => {
    mockRequest.mockImplementation((url: string) =>
      url.indexOf("/ruptura") >= 0 ? Promise.reject(new Error("x")) : Promise.resolve({ products: [], pagination: { total_items: 0 } }));
    await expect(vendidosNosUltimos60Dias(CID, HOJE)).rejects.toThrow();
  });
});

// ── 2. Regra da margem ───────────────────────────────────────

describe("margem média da prévia", () => {
  const itens = [
    { preco_de: 100, preco_por: 80, cost_price: 50 },
    { preco_de: 200, preco_por: 150, cost_price: 60 },
    { preco_de: 40, preco_por: 30, cost_price: null },
    { preco_de: 40, preco_por: 30, cost_price: 0 },
  ];
  it("só quem tem custo, ponderada pelo preço: Σ(preço − custo) ÷ Σ preço", () => {
    const m = margemDaPrevia(itens);
    expect(m.comCusto).toBe(2);
    expect(m.semCusto).toBe(2);
    expect(m.antes).toBeCloseTo(190 / 300, 6);
    expect(m.depois).toBeCloseTo(120 / 230, 6);
    expect(textoDaMargem(m)).toBe("63% → 52%");
  });
  it("conta quem ficou de fora por não ter custo, no singular e no plural", () => {
    expect(textoSemCusto(margemDaPrevia(itens))).toBe("2 itens sem custo cadastrado não entram nessa conta.");
    expect(textoSemCusto(margemDaPrevia([itens[0], itens[2]]))).toBe("1 item sem custo cadastrado não entra nessa conta.");
    expect(textoSemCusto(margemDaPrevia([itens[0]]))).toBeNull();
  });
  it("ninguém com custo: traço", () => {
    const m = margemDaPrevia([itens[2]]);
    expect(m.antes).toBeNull();
    expect(textoDaMargem(m)).toBe("—");
  });
});

// ── 3. Tela ──────────────────────────────────────────────────

describe("CriarPromocaoModal: parados e margem", () => {
  beforeEach(() => {
    mockProdutos = [
      { id: "p1", name: "Vestido midi", price: 189.9, stock: 3, category: "Vestidos", code: "", barcode: "" },
      { id: "p2", name: "Camiseta", price: 59.9, stock: 10, category: "Blusas", code: "", barcode: "" },
      { id: "p3", name: "Sem estoque", price: 20, stock: 0, category: "Blusas", code: "", barcode: "" },
      { id: "p4", name: "Já em promoção", price: 30, stock: 5, category: "Blusas", code: "", barcode: "", promoPrice: 25, promoEndsAt: "2026-11-30T23:59:59-03:00" },
      { id: "p5", name: "Cinto", price: 49.9, stock: 2, category: "Acessórios", code: "", barcode: "" },
    ];
    // Camiseta vendeu; Vestido, Cinto e o já em promoção estão parados; p3 não tem estoque.
    mockRecentes = { vendidos: { p2: true }, carregando: false, erro: false, refetch: mockRefetch };
  });

  it("a opção fica entre 'Tudo que tem estoque' e 'Por categoria', com a contagem", async () => {
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    const ordem = r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.indexOf("promo-base-") === 0, { deep: false })
      .map((n) => n.props.testID);
    expect(ordem).toEqual(["promo-base-estoque", "promo-base-parados", "promo-base-categoria", "promo-base-um"]);
    expect(textoDe(porId(r, "promo-base-parados"))).toContain("Parados há 60 dias ou mais");
    expect(textoDe(porId(r, "promo-conta-parados"))).toBe("2 produtos");
    expect(textoDe(porId(r, "promo-base-parados"))).toContain("O que não vendeu e está ocupando prateleira.");
  });

  it("escolher parados manda só eles na prévia; 'deixar de fora' continua valendo", async () => {
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    await tocar(r, "promo-base-parados");
    expect(textoDe(porId(r, "promo-rodape"))).toBe("2 produtos");
    await tocar(r, "promo-deixar-de-fora");
    expect(textoDe(porId(r, "promo-conta-parados"))).toBe("3 produtos");
    await tocar(r, "promo-deixar-de-fora");
    await tocar(r, "promo-continuar");
    mockRequest.mockResolvedValueOnce({ dry_run: true, items: [], fora: [] });
    await tocar(r, "promo-ver");
    expect(mockRequest.mock.calls[0][1].body.targets).toEqual([{ product_id: "p1" }, { product_id: "p5" }]);
  });

  it("carregando: não chuta número e não deixa continuar", async () => {
    mockRecentes = { vendidos: null, carregando: true, erro: false, refetch: mockRefetch };
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    expect(textoDe(porId(r, "promo-conta-parados"))).toBe("contando…");
    await tocar(r, "promo-base-parados");
    expect(textoDe(porId(r, "promo-rodape"))).toBe("0 produtos");
    expect(porId(r, "promo-continuar").props.disabled).toBe(true);
  });

  it("falhou: texto gentil e tocar tenta de novo", async () => {
    mockRecentes = { vendidos: null, carregando: false, erro: true, refetch: mockRefetch };
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    expect(textoDe(porId(r, "promo-base-parados"))).toContain("Não conseguimos ver as vendas agora");
    await tocar(r, "promo-base-parados");
    expect(mockRefetch).toHaveBeenCalled();
    expect(porId(r, "promo-continuar").props.disabled).toBe(true);
  });

  async function ateAPrevia() {
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    await tocar(r, "promo-continuar");
    mockRequest.mockResolvedValueOnce({
      dry_run: true,
      items: [
        { product_id: "p1", variant_id: null, nome: "Vestido midi", preco_de: 100, preco_por: 80, ja_em_promocao: false, abaixo_do_custo: false, cost_price: 50 },
        { product_id: "p2", variant_id: null, nome: "Camiseta", preco_de: 200, preco_por: 150, ja_em_promocao: false, abaixo_do_custo: false, cost_price: 60 },
        { product_id: "p5", variant_id: null, nome: "Cinto", preco_de: 40, preco_por: 30, ja_em_promocao: false, abaixo_do_custo: false, cost_price: null },
      ],
      fora: [],
    });
    await tocar(r, "promo-ver");
    return r;
  }

  it("passo 3 mostra a margem antes → depois e quantos ficaram fora da conta", async () => {
    const r = await ateAPrevia();
    expect(textoDe(porId(r, "promo-margem-valor"))).toBe("63% → 52%");
    expect(textoDe(porId(r, "promo-margem"))).toContain("margem média (quem tem custo)");
    expect(textoDe(porId(r, "promo-sem-custo"))).toBe("1 item sem custo cadastrado não entra nessa conta.");
    // Tirar um item refaz a conta só com quem entra.
    await tocar(r, "promo-tirar-p2:");
    expect(textoDe(porId(r, "promo-margem-valor"))).toBe("50% → 38%");
  });

  it("quem não vê custo não vê a margem", async () => {
    mockConsulta = { consulta: false, carregando: false, semCusto: true };
    const r = await ateAPrevia();
    expect(tem(r, "promo-entram")).toBe(true);
    expect(tem(r, "promo-margem")).toBe(false);
    expect(tem(r, "promo-sem-custo")).toBe(false);
  });
});
