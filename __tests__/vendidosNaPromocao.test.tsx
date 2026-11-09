// ============================================================
// Vendidos na promoção na seção "Promoção em lote" (p-93, 08/11/2026)
//
// O que estes testes seguram:
// 1. janela: começo nunca antes de 09/11 (contagem do backend), no ar até
//    agora, encerrada do começo ao fim, 400 dias no máximo;
// 2. serviço: GET /vendidos da empresa ativa, sem escopo=grupo, leitura
//    tolerante;
// 3. cartões: valores e dinheiro em pt-BR, estado zerado gentil, 403/404
//    escondem sem erro, agendada e consolidado nem perguntam.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: (p: any) => (p.active ? p.children : null) }));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; isNetworkError = false; code: string | null = null;
    constructor(m: string, status: number, data?: any, _net?: boolean, code?: string) {
      super(m); this.status = status; this.data = data; this.code = code || null;
    }
  }
  return { request: (...a: any[]) => mockRequest(...a), ApiError, companiesApi: { products: jest.fn() } };
});
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [], isLoading: false }) }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "x", plan: "negocio", member_role: "owner" }, consolidatedView: false, availableCompanies: [], isStaff: false }) }));

import { ApiError } from "@/services/api";
import { promocoesApi, lerVendidos } from "@/services/promocoesApi";
import { janelaDosVendidos, pedidoDaJanela, INICIO_DA_CONTAGEM, qtdTxt } from "@/components/screens/blackfriday/dePor/janelaVendidos";
import { PromocaoEmLote } from "@/components/screens/blackfriday/dePor/PromocaoEmLote";

const CID = "aaaaaaaa-0000-4000-8000-000000000001";
jest.setTimeout(30000);

function fixarAgora(iso: string) {
  jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: [
      "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "performance", "hrtime",
    ],
  });
}

beforeEach(() => {
  mockRequest.mockReset();
  fixarAgora("2026-11-28T15:00:00Z");
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
function todoTexto(r: renderer.ReactTestRenderer): string {
  return textoDe(r.root);
}
function dados(over: any = {}) {
  return { disponivel: true, carregando: false, ativa: [], agendada: [], encerrada: [], recarregar: jest.fn(), ...over };
}
function chamadasVendidos(): string[] {
  return mockRequest.mock.calls.map((c) => c[0] as string).filter((u) => u.indexOf("/vendidos") >= 0);
}
function responderVendidos(resumo: any) {
  mockRequest.mockImplementation((url: string) => {
    if (url.indexOf("/vendidos") >= 0) return Promise.resolve({ desde: "x", ate: "y", consolidado: false, lojas: 1, resumo, items: [] });
    return Promise.resolve({ items: [] });
  });
}

// 27/11 00h em Brasília até 30/11 23h59min59s.
const NO_AR = { product_id: "p1", variant_id: null, nome: "Vestido midi", preco_de: 189.9, preco_por: 151.9, starts_at: "2026-11-27T03:00:00.000Z", ends_at: "2026-12-01T02:59:59.000Z" };
const ENCERRADA = { ...NO_AR, starts_at: "2026-11-20T03:00:00.000Z", ends_at: "2026-11-24T02:59:59.000Z" };

// ── 1. Janela ────────────────────────────────────────────────

describe("janela dos vendidos", () => {
  it("no ar: do primeiro começo até agora", () => {
    const outro = { ...NO_AR, product_id: "p2", starts_at: "2026-11-27T15:00:00.000Z" };
    const j = janelaDosVendidos([outro, NO_AR], "ativa")!;
    expect(j).toEqual({ desde: "2026-11-27T03:00:00.000Z", ate: null, cortada: false });
    expect(pedidoDaJanela(j, new Date("2026-11-28T15:00:00Z"))).toEqual({ desde: "2026-11-27T03:00:00.000Z", ate: "2026-11-28T15:00:00.000Z" });
  });

  it("começou antes de 09/11: conta a partir de 09/11 00h em Brasília", () => {
    const j = janelaDosVendidos([{ ...NO_AR, starts_at: "2026-11-05T15:00:00Z" }], "ativa")!;
    expect(j.desde).toBe(INICIO_DA_CONTAGEM);
    expect(j.desde).toBe("2026-11-09T03:00:00.000Z");
    expect(j.cortada).toBe(true);
  });

  it("antes do dia 09/11 a janela fica vazia (desde = ate = agora), sem pedido inválido", () => {
    const j = janelaDosVendidos([{ ...NO_AR, starts_at: "2026-11-08T15:00:00Z" }], "ativa")!;
    expect(pedidoDaJanela(j, new Date("2026-11-08T16:00:00Z"))).toEqual({ desde: "2026-11-08T16:00:00.000Z", ate: "2026-11-08T16:00:00.000Z" });
  });

  it("encerrada: do começo ao último fim; encerrada antes de 09/11 não pergunta", () => {
    const j = janelaDosVendidos([ENCERRADA, { ...ENCERRADA, ends_at: "2026-11-22T02:59:59.000Z" }], "encerrada")!;
    expect(j).toEqual({ desde: "2026-11-20T03:00:00.000Z", ate: "2026-11-24T02:59:59.000Z", cortada: false });
    expect(pedidoDaJanela(j, new Date("2026-11-28T15:00:00Z")).ate).toBe("2026-11-24T02:59:59.000Z");
    expect(janelaDosVendidos([{ ...ENCERRADA, starts_at: "2026-10-01T03:00:00Z", ends_at: "2026-11-01T02:59:59Z" }], "encerrada")).toBeNull();
    expect(janelaDosVendidos([], "ativa")).toBeNull();
  });

  it("janela cabe nos 400 dias do backend", () => {
    const p = pedidoDaJanela({ desde: INICIO_DA_CONTAGEM, ate: null, cortada: false }, new Date("2028-06-01T00:00:00Z"));
    expect(new Date(p.ate).getTime() - new Date(p.desde).getTime()).toBe(400 * 864e5);
  });

  it("quantidade em pt-BR (até 3 casas, para quem vende por kg)", () => {
    expect(qtdTxt(1234)).toBe("1.234");
    expect(qtdTxt(2.5)).toBe("2,5");
    expect(qtdTxt(0.1234)).toBe("0,123");
  });
});

// ── 2. Serviço ───────────────────────────────────────────────

describe("promocoesApi.vendidos", () => {
  it("GET da empresa ativa com desde/ate, sem escopo=grupo", async () => {
    mockRequest.mockResolvedValue({ resumo: { itens_vendidos: "3", faturamento: "120.50", desconto_dado: 30, vendas: 2 } });
    const r = await promocoesApi.vendidos(CID, { desde: "2026-11-27T03:00:00.000Z", ate: "2026-11-28T15:00:00.000Z" });
    const url = mockRequest.mock.calls[0][0] as string;
    expect(url).toBe("/companies/" + CID + "/products/promotions/vendidos?desde=2026-11-27T03%3A00%3A00.000Z&ate=2026-11-28T15%3A00%3A00.000Z");
    expect(url).not.toContain("escopo");
    expect(r.resumo).toEqual({ itens_vendidos: 3, faturamento: 120.5, desconto_dado: 30, vendas: 2 });
  });

  it("leitura tolerante: sem resumo = zerado", () => {
    expect(lerVendidos(null).resumo).toEqual({ itens_vendidos: 0, faturamento: 0, desconto_dado: 0, vendas: 0 });
  });
});

// ── 3. Cartões na seção ──────────────────────────────────────

describe("cartões 'vendidos na promoção'", () => {
  it("no ar: itens vendidos, faturamento e desconto dado, com dinheiro em pt-BR", async () => {
    responderVendidos({ itens_vendidos: 1234, faturamento: 3420.5, desconto_dado: 855, vendas: 21 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ ativa: [NO_AR] })} />));
    expect(tem(r, "promo-vendidos-ativa")).toBe(true);
    expect(textoDe(porId(r, "promo-vendidos-itens-ativa"))).toBe("1.234");
    expect(textoDe(porId(r, "promo-vendidos-faturamento-ativa"))).toBe("R$ 3.420,50");
    expect(textoDe(porId(r, "promo-vendidos-desconto-ativa"))).toBe("R$ 855,00");
    const t = todoTexto(r);
    expect(t).toContain("itens vendidos");
    expect(t).toContain("faturamento");
    expect(t).toContain("desconto dado");
    // Promoção começou depois de 09/11: nada a explicar.
    expect(tem(r, "promo-vendidos-desde-ativa")).toBe(false);
    const urls = chamadasVendidos();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/companies/" + CID + "/products/promotions/vendidos?desde=2026-11-27T03%3A00%3A00.000Z&ate=2026-11-28T15%3A00%3A00.000Z");
  });

  it("um item vendido no singular; promoção de antes de 09/11 avisa desde quando conta", async () => {
    responderVendidos({ itens_vendidos: 1, faturamento: 151.9, desconto_dado: 38, vendas: 1 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ ativa: [{ ...NO_AR, starts_at: "2026-11-05T15:00:00Z" }] })} />));
    expect(todoTexto(r)).toContain("item vendido");
    expect(todoTexto(r)).not.toContain("itens vendidos");
    expect(textoDe(porId(r, "promo-vendidos-desde-ativa"))).toBe("As vendas na promoção são contadas desde 09/11.");
    expect(chamadasVendidos()[0]).toContain("desde=2026-11-09T03%3A00%3A00.000Z");
  });

  it("zerado: frase gentil e, pequeno, que a contagem começou em 09/11", async () => {
    responderVendidos({ itens_vendidos: 0, faturamento: 0, desconto_dado: 0, vendas: 0 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ ativa: [NO_AR] })} />));
    expect(tem(r, "promo-vendidos-ativa")).toBe(false);
    const z = porId(r, "promo-vendidos-zero-ativa");
    expect(textoDe(z)).toContain("Ainda sem vendas na promoção.");
    expect(textoDe(z)).toContain("As vendas na promoção são contadas desde 09/11.");
  });

  it("antes de 09/11: zerado fala que a contagem começa no dia 09/11", async () => {
    fixarAgora("2026-11-08T15:00:00Z");
    responderVendidos({ itens_vendidos: 0, faturamento: 0, desconto_dado: 0, vendas: 0 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ ativa: [{ ...NO_AR, starts_at: "2026-11-08T14:00:00Z" }] })} />));
    expect(textoDe(porId(r, "promo-vendidos-zero-ativa"))).toContain("As vendas na promoção começam a ser contadas em 09/11.");
  });

  it.each([
    ["perfil Estoque só consulta", 403, "ESTOQUE_SO_CONSULTA"],
    ["membro sem relatórios", 403, "SEM_PERMISSAO_RELATORIO"],
    ["backend sem a rota", 404, undefined],
    ["falha do servidor", 500, undefined],
  ])("%s (%s): os cartões somem sem erro e o bloco segue", async (_n, status, code) => {
    mockRequest.mockImplementation((url: string) => {
      if (url.indexOf("/vendidos") >= 0) return Promise.reject(new (ApiError as any)("x", status, { code }, false, code));
      return Promise.resolve({ items: [] });
    });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ ativa: [NO_AR] })} />));
    expect(tem(r, "promo-bloco-ativa")).toBe(true);
    expect(tem(r, "promo-vendidos-ativa")).toBe(false);
    expect(tem(r, "promo-vendidos-zero-ativa")).toBe(false);
    expect(todoTexto(r)).not.toContain("vendas na promoção");
    expect(chamadasVendidos()).toHaveLength(1);
  });

  it("encerrada: cartões com a janela da promoção (começo ao fim)", async () => {
    responderVendidos({ itens_vendidos: 94, faturamento: 8210, desconto_dado: 2052.5, vendas: 60 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ encerrada: [ENCERRADA] })} />));
    expect(tem(r, "promo-encerrada")).toBe(true);
    expect(textoDe(porId(r, "promo-vendidos-itens-encerrada"))).toBe("94");
    expect(textoDe(porId(r, "promo-vendidos-faturamento-encerrada"))).toBe("R$ 8.210,00");
    expect(textoDe(porId(r, "promo-vendidos-desconto-encerrada"))).toBe("R$ 2.052,50");
    expect(chamadasVendidos()[0]).toContain("?desde=2026-11-20T03%3A00%3A00.000Z&ate=2026-11-24T02%3A59%3A59.000Z");
  });

  it("encerrada zerada: 'Nenhuma venda na promoção.'", async () => {
    responderVendidos({ itens_vendidos: 0, faturamento: 0, desconto_dado: 0, vendas: 0 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ encerrada: [ENCERRADA] })} />));
    expect(textoDe(porId(r, "promo-vendidos-zero-encerrada"))).toContain("Nenhuma venda na promoção.");
  });

  it("encerrada antes de 09/11: nem pergunta, nada aparece", async () => {
    responderVendidos({ itens_vendidos: 5, faturamento: 50, desconto_dado: 5, vendas: 1 });
    const antiga = { ...ENCERRADA, starts_at: "2026-10-01T03:00:00Z", ends_at: "2026-11-01T02:59:59Z" };
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ encerrada: [antiga] })} />));
    expect(tem(r, "promo-encerrada")).toBe(true);
    expect(chamadasVendidos()).toHaveLength(0);
    expect(tem(r, "promo-vendidos-encerrada")).toBe(false);
  });

  it("agendada: ainda não vendeu, não pergunta", async () => {
    responderVendidos({ itens_vendidos: 5, faturamento: 50, desconto_dado: 5, vendas: 1 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ agendada: [{ ...NO_AR, starts_at: "2026-11-29T03:00:00Z" }] })} />));
    expect(tem(r, "promo-bloco-agendada")).toBe(true);
    expect(chamadasVendidos()).toHaveLength(0);
  });

  it("consolidado: a seção é por empresa, não pergunta os vendidos", async () => {
    responderVendidos({ itens_vendidos: 5, faturamento: 50, desconto_dado: 5, vendas: 1 });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado dados={dados({ ativa: [NO_AR], encerrada: [ENCERRADA] })} />));
    expect(tem(r, "promo-consolidado")).toBe(true);
    expect(chamadasVendidos()).toHaveLength(0);
    expect(tem(r, "promo-vendidos-ativa")).toBe(false);
  });
});
