// ============================================================
// De/Por na página Black Friday (p-86, 08/11/2026)
//
// O que estes testes seguram:
// 1. regras: Black Friday do ano, atalhos de prazo, datas em Brasília
//    (fim = 23h59min59s), validação, lotes de até 2.000;
// 2. serviço: prévia com dry_run true, aplicar e encerrar com false, em
//    lotes; lista tolerante;
// 3. a seção é a PRIMEIRA quando o backend tem a rota, e some sem ela
//    (404), sem o Estoque e no perfil consulta;
// 4. seção: convite, no ar com "Encerrar agora" confirmado, consolidado;
// 5. assistente: seleção, prévia (já em promoção, fora por custo), tirar um
//    item, aplicar só o que a pessoa conferiu;
// 6. aviso no cadastro de produto em promoção.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
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
    constructor(m: string, status: number, data?: any) { super(m); this.status = status; this.data = data; }
  }
  return { request: (...a: any[]) => mockRequest(...a), ApiError, companiesApi: { products: jest.fn() } };
});

let mockProdutos: any[] = [];
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: mockProdutos, isLoading: false }) }));
// "Parados há 60 dias ou mais" tem testes próprios (promocaoDePorParados.test.tsx);
// aqui as vendas recentes não chamam a API, para mockRequest ver só as promoções.
jest.mock("@/hooks/useVendidosRecentes", () => ({ useVendidosRecentes: () => ({ vendidos: {}, carregando: false, erro: false, refetch: jest.fn() }) }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
let mockVisible: Set<string>;
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockVisible }));
let mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));
jest.mock("@/components/screens/blackfriday/OQueVaiFaltar", () => ({ OQueVaiFaltar: () => null }));
jest.mock("@/components/screens/blackfriday/PlacarDoDiaCard", () => ({ PlacarDoDiaCard: () => null }));
jest.mock("@/components/screens/blackfriday/ValeTrocaEspelho", () => ({ ValeTrocaEspelho: () => null }));
jest.mock("@/components/screens/configuracoes/AssentoTemporadaCard", () => ({ AssentoTemporadaCard: () => null }));

import { ApiError } from "@/services/api";
import { promocoesApi, emLotes, lerLista } from "@/services/promocoesApi";
import {
  blackFridayDoAno, prazosDisponiveis, instantesDoPrazo, erroDasDatas, erroDoValorPromo, textoDoPrazo,
  avisoDePromocaoNoCadastro, descontoMedio, textoDeFora, resumoDaLista, textoDoPronto, horaBrtDe,
} from "@/components/screens/blackfriday/dePor/regrasDePor";
import { secoesDaPagina } from "@/components/screens/blackfriday/secoes";
import { PromocaoEmLote } from "@/components/screens/blackfriday/dePor/PromocaoEmLote";
import { CriarPromocaoModal } from "@/components/screens/blackfriday/dePor/CriarPromocaoModal";
import { PaginaBlackFriday } from "@/components/screens/blackfriday/PaginaBlackFriday";

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
  fixarAgora("2026-11-08T15:00:00Z");
  mockAuth = { company: { id: CID, plan: "negocio", member_role: "owner" }, consolidatedView: false, availableCompanies: [{ id: CID }], isStaff: false };
  mockVisible = new Set(["estoque", "configuracoes", "whatsapp"]);
  mockConsulta = { consulta: false, carregando: false, semCusto: false };
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

// ── 1. Regras ────────────────────────────────────────────────

describe("regras do prazo", () => {
  it("Black Friday de 2026 vai da sexta 27/11 à segunda 30/11", () => {
    expect(blackFridayDoAno(2026)).toEqual({ ini: "2026-11-27", fim: "2026-11-30" });
    expect(blackFridayDoAno(2027)).toEqual({ ini: "2027-11-26", fim: "2027-11-29" });
  });

  it("em 08/11 há Black Friday, Natal e Começar agora (até o fim da BF)", () => {
    const p = prazosDisponiveis("2026-11-08");
    expect(p.map((x) => x.chave)).toEqual(["bf", "natal", "agora"]);
    expect(p[0]).toMatchObject({ ini: "2026-11-27", fim: "2026-11-30", comecaAgora: false, detalhe: "27/11 a 30/11" });
    expect(p[2]).toMatchObject({ ini: "2026-11-08", fim: "2026-11-30", comecaAgora: true });
  });

  it("depois da BF o atalho some; Natal já começado vale de hoje", () => {
    const p = prazosDisponiveis("2026-12-05");
    expect(p.map((x) => x.chave)).toEqual(["natal", "agora"]);
    expect(p[0]).toMatchObject({ ini: "2026-12-05", fim: "2026-12-24", comecaAgora: true, detalhe: "de hoje a 24/12" });
  });

  it("datas em Brasília: começo 00h00 do dia, fim 23h59min59s; hoje = agora", () => {
    expect(instantesDoPrazo("2026-11-27", "2026-11-30", "2026-11-08")).toEqual({
      starts_at: "2026-11-27T00:00:00-03:00", ends_at: "2026-11-30T23:59:59-03:00", agendada: true,
    });
    // QA 08/11/2026: "agora" é o do SERVIDOR (starts_at null). Com o relógio
    // do navegador adiantado, a promoção recém-ligada aparecia "agendada".
    expect(instantesDoPrazo("2026-11-08", "2026-11-30", "2026-11-08")).toEqual({
      starts_at: null, ends_at: "2026-11-30T23:59:59-03:00", agendada: false,
    });
    expect(JSON.stringify(instantesDoPrazo("2026-11-08", "2026-11-30", "2026-11-08"))).not.toContain("2026-11-08T");
  });

  it("tela final com a concordância certa (1 item está / 2 itens estão; entra / entram)", () => {
    expect(textoDoPronto(1, false)).toBe("1 item já está em promoção.");
    expect(textoDoPronto(3, false)).toBe("3 itens já estão em promoção.");
    expect(textoDoPronto(1, true)).toBe("1 item entra em promoção.");
    expect(textoDoPronto(1200, true)).toBe("1.200 itens entram em promoção.");
  });

  it("hora do começo em Brasília: 00h na virada do dia, a hora certa no resto", () => {
    expect(horaBrtDe("2026-11-27T03:00:00Z")).toBe("00h");
    expect(horaBrtDe("2026-11-27T00:00:00-03:00")).toBe("00h");
    expect(horaBrtDe("2026-11-08T15:00:00Z")).toBe("12h");
    expect(horaBrtDe("2026-11-08T17:05:09Z")).toBe("14h05");
    expect(horaBrtDe(null)).toBeNull();
    expect(horaBrtDe("lixo")).toBeNull();
    const r = resumoDaLista([
      { product_id: "a", variant_id: null, nome: "A", preco_de: 100, preco_por: 80, starts_at: "2026-11-09T03:00:00Z", ends_at: "2026-12-01T02:59:59Z" },
      { product_id: "b", variant_id: null, nome: "B", preco_de: 100, preco_por: 80, starts_at: "2026-11-08T17:05:00Z", ends_at: "2026-12-01T02:59:59Z" },
    ]);
    expect(r).toMatchObject({ ini: "2026-11-08", iniHora: "14h05" });
  });

  it("texto do prazo diz quando os preços voltam", () => {
    expect(textoDoPrazo("2026-11-27", "2026-11-30", "2026-11-08"))
      .toBe("Vale de 27/11 às 00h a 30/11 às 23h59. Os preços voltam sozinhos em 01/12 às 00h.");
    expect(textoDoPrazo("2026-11-08", "2026-11-30", "2026-11-08")).toContain("Vale de agora a 30/11");
  });

  it("validação das datas e do valor, com texto gentil", () => {
    expect(erroDasDatas(null, "2026-11-30", "2026-11-08")).toBe("Escolha o dia de começo e o de fim.");
    expect(erroDasDatas("2026-11-01", "2026-11-30", "2026-11-08")).toContain("já passou");
    expect(erroDasDatas("2026-11-27", "2026-11-26", "2026-11-08")).toContain("depois");
    expect(erroDasDatas("2026-11-08", "2026-11-08", "2026-11-08")).toBeNull();
    expect(erroDoValorPromo("percent", "100")).toBe("O desconto precisa ser menor que 100%.");
    expect(erroDoValorPromo("percent", "")).toBe("Digite um valor.");
    expect(erroDoValorPromo("preco", "abc")).toContain("Use só números");
    expect(erroDoValorPromo("preco", "49,90")).toBeNull();
    expect(erroDoValorPromo("fixed", "0")).toContain("maior que zero");
  });

  it("desconto médio, texto de quem fica de fora e resumo da lista", () => {
    expect(descontoMedio([{ preco_de: 100, preco_por: 80 }, { preco_de: 50, preco_por: 35 }])).toBeCloseTo(0.25);
    expect(descontoMedio([])).toBeNull();
    expect(textoDeFora([{ product_id: "p", variant_id: null, motivo: "abaixo_do_custo" }, { product_id: "q", variant_id: null, motivo: "abaixo_do_custo" }]))
      .toBe("2 ficam de fora porque o preço com desconto ficaria abaixo do custo.");
    expect(textoDeFora([])).toBeNull();
    expect(textoDeFora([{ product_id: "p", variant_id: null, motivo: "sem_desconto" }]))
      .toBe("1 fica de fora porque o preço da promoção não ficaria menor que o normal.");
    const r = resumoDaLista([
      { product_id: "a", variant_id: null, nome: "A", preco_de: 100, preco_por: 80, starts_at: "2026-11-27T03:00:00Z", ends_at: "2026-12-01T02:59:59Z" },
    ]);
    expect(r).toMatchObject({ itens: 1, ini: "2026-11-27", iniHora: "00h", fim: "2026-11-30", fimVaria: false });
  });
});

// ── 2. Serviço ───────────────────────────────────────────────

describe("promocoesApi", () => {
  it("divide em lotes de até 2.000", () => {
    const l = emLotes(Array.from({ length: 4500 }, (_, i) => i));
    expect(l.map((x) => x.length)).toEqual([2000, 2000, 500]);
  });

  it("prévia manda dry_run true, em lotes, e junta as respostas", async () => {
    mockRequest.mockImplementation((_url: string, o: any) => Promise.resolve({
      dry_run: true,
      items: o.body.targets.slice(0, 1).map((t: any) => ({ product_id: t.product_id, variant_id: null, nome: "X", preco_de: "10", preco_por: "8", ja_em_promocao: false })),
      fora: [],
    }));
    const targets = Array.from({ length: 2500 }, (_, i) => ({ product_id: "p" + i }));
    const r = await promocoesApi.previa(CID, { targets, modo: "percent", valor: 20, terminacao: "90", starts_at: "a", ends_at: "b" });
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0][0]).toBe("/companies/" + CID + "/products/promotions");
    expect(mockRequest.mock.calls[0][1].body.dry_run).toBe(true);
    expect(mockRequest.mock.calls[0][1].body.targets).toHaveLength(2000);
    expect(mockRequest.mock.calls[1][1].body.targets).toHaveLength(500);
    expect(mockRequest.mock.calls[0][1].retry).toBe(0);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].preco_por).toBe(8);
  });

  it("aplicar e encerrar mandam dry_run false (o padrão do servidor é true)", async () => {
    mockRequest.mockResolvedValue({ dry_run: false, items: [], fora: [] });
    await promocoesApi.aplicar(CID, { targets: [{ product_id: "p" }], modo: "preco", valor: 9.9, starts_at: "a", ends_at: "b" });
    expect(mockRequest.mock.calls[0][1].body.dry_run).toBe(false);
    await promocoesApi.encerrar(CID, [{ product_id: "p", variant_id: "v" }]);
    expect(mockRequest.mock.calls[1][0]).toBe("/companies/" + CID + "/products/promotions/encerrar");
    expect(mockRequest.mock.calls[1][1].body).toEqual({ targets: [{ product_id: "p", variant_id: "v" }], dry_run: false });
  });

  it("lista aceita { items }, { promotions } ou array, com os nomes do contrato ou do produto", () => {
    const a = lerLista({ items: [{ product_id: "p", nome: "A", preco_de: 10, preco_por: 8, starts_at: "s", ends_at: "e" }] });
    const b = lerLista([{ id: "p", name: "A", price: "10", promo_price: "8", promo_starts_at: "s", promo_ends_at: "e" }]);
    expect(a).toEqual(b);
    expect(lerLista({ promotions: [] })).toEqual([]);
    expect(lerLista(undefined)).toEqual([]);
  });
});

// ── 3. Seção na página ───────────────────────────────────────

describe("secoesDaPagina com De/Por", () => {
  const todos = new Set(["estoque", "configuracoes", "whatsapp"]);
  it("com o backend novo, a promoção em lote é a primeira", () => {
    expect(secoesDaPagina({ visible: todos, consolidatedView: false, hoje: "2026-11-08", dePorDisponivel: true }).map((s) => s.chave))
      .toEqual(["de_por", "ruptura", "assento", "vale_troca", "placar"]);
  });
  it("sem o backend novo, ou sem o Estoque, some", () => {
    expect(secoesDaPagina({ visible: todos, consolidatedView: false, hoje: "2026-11-08" }).map((s) => s.chave)).not.toContain("de_por");
    expect(secoesDaPagina({ visible: new Set(["configuracoes"]), consolidatedView: false, hoje: "2026-11-08", dePorDisponivel: true }).map((s) => s.chave))
      .not.toContain("de_por");
  });
  it("no consolidado aparece (para explicar que é por empresa)", () => {
    expect(secoesDaPagina({ visible: todos, consolidatedView: true, hoje: "2026-11-08", dePorDisponivel: true }).map((s) => s.chave))
      .toEqual(["de_por", "ruptura"]);
  });
});

describe("PaginaBlackFriday com De/Por", () => {
  it("backend com a rota: a seção aparece em primeiro, número 1", async () => {
    mockRequest.mockResolvedValue({ items: [] });
    const r = await montar(comQuery(<PaginaBlackFriday />));
    expect(tem(r, "bf-secao-de-por")).toBe(true);
    expect(tem(r, "promo-vazio")).toBe(true);
    const ids = r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("bf-secao-") && !n.props.testID.endsWith("-por-que"), { deep: false })
      .map((n) => n.props.testID);
    expect(ids[0]).toBe("bf-secao-de-por");
    expect(mockRequest).toHaveBeenCalledWith("/companies/" + CID + "/products/promotions?status=ativa", expect.anything());
  });

  it("backend sem a rota (404): a seção não aparece", async () => {
    mockRequest.mockRejectedValue(new (ApiError as any)("Não encontrado", 404));
    const r = await montar(comQuery(<PaginaBlackFriday />));
    expect(tem(r, "bf-secao-de-por")).toBe(false);
    expect(tem(r, "bf-secao-ruptura")).toBe(true);
  });

  it("perfil Estoque só consulta: some e nem pergunta ao backend", async () => {
    mockConsulta = { consulta: true, carregando: false, semCusto: true };
    mockRequest.mockResolvedValue({ items: [] });
    const r = await montar(comQuery(<PaginaBlackFriday />));
    expect(tem(r, "bf-secao-de-por")).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

// ── 4. Seção ─────────────────────────────────────────────────

function dados(over: any = {}) {
  return { disponivel: true, carregando: false, ativa: [], agendada: [], encerrada: [], recarregar: jest.fn(), ...over };
}
const ITEM = { product_id: "p1", variant_id: null, nome: "Vestido midi", preco_de: 189.9, preco_por: 151.9, starts_at: "2026-11-08T15:00:00Z", ends_at: "2026-12-01T02:59:59Z" };

describe("PromocaoEmLote", () => {
  it("sem promoção: convite com 'Criar promoção'", async () => {
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados()} />));
    expect(tem(r, "promo-vazio")).toBe(true);
    expect(tem(r, "promo-criar")).toBe(true);
    expect(tem(r, "promo-modal")).toBe(false);
  });

  it("no ar: números, e 'Encerrar agora' só depois de confirmar", async () => {
    mockRequest.mockResolvedValue({ dry_run: false, items: [], fora: [] });
    const d = dados({ ativa: [ITEM] });
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={d} />));
    expect(tem(r, "promo-bloco-ativa")).toBe(true);
    expect(textoDe(porId(r, "promo-n-ativa"))).toBe("1");
    expect(tem(r, "promo-vazio")).toBe(false);
    await tocar(r, "promo-encerrar-ativa");
    expect(mockRequest).not.toHaveBeenCalled();
    expect(tem(r, "promo-confirmar-ativa")).toBe(true);
    await tocar(r, "promo-encerrar-sim-ativa");
    expect(mockRequest).toHaveBeenCalledWith("/companies/" + CID + "/products/promotions/encerrar", expect.objectContaining({
      body: { targets: [{ product_id: "p1" }], dry_run: false },
    }));
    expect(d.recarregar).toHaveBeenCalled();
  });

  it("agendada: o cartão diz a hora real do começo, não '00h' fixo", async () => {
    const meiaNoite = { ...ITEM, starts_at: "2026-11-27T03:00:00Z" };
    let r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ agendada: [meiaNoite] })} />));
    expect(tem(r, "promo-bloco-agendada")).toBe(true);
    expect(textoDe(porId(r, "promo-comeca"))).toBe("começa às 00h");
    // Agendada com começo fora da meia-noite (ex.: o "agora" de um navegador adiantado).
    const tarde = { ...ITEM, starts_at: "2026-11-08T15:00:30Z" };
    r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ agendada: [tarde] })} />));
    expect(textoDe(porId(r, "promo-comeca"))).toBe("começa às 12h");
  });

  it("encerrada: 'Repetir promoção' abre o assistente com os produtos marcados", async () => {
    mockProdutos = [{ id: "p1", name: "Vestido midi", price: 189.9, stock: 3, category: "Vestidos", code: "", barcode: "" }];
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado={false} dados={dados({ encerrada: [ITEM] })} />));
    expect(tem(r, "promo-encerrada")).toBe(true);
    await tocar(r, "promo-repetir");
    expect(tem(r, "promo-modal")).toBe(true);
    expect(textoDe(porId(r, "promo-rodape"))).toBe("1 produto");
  });

  it("consolidado: explica que é por empresa, sem botão", async () => {
    const r = await montar(comQuery(<PromocaoEmLote companyId={CID} consolidado dados={dados()} />));
    expect(tem(r, "promo-consolidado")).toBe(true);
    expect(tem(r, "promo-criar")).toBe(false);
  });
});

// ── 5. Assistente ────────────────────────────────────────────

describe("CriarPromocaoModal", () => {
  beforeEach(() => {
    mockProdutos = [
      { id: "p1", name: "Vestido midi", price: 189.9, stock: 3, category: "Vestidos", code: "", barcode: "" },
      { id: "p2", name: "Camiseta", price: 59.9, stock: 10, category: "Blusas", code: "", barcode: "" },
      { id: "p3", name: "Sem estoque", price: 20, stock: 0, category: "Blusas", code: "", barcode: "" },
      { id: "p4", name: "Já em promoção", price: 30, stock: 5, category: "Blusas", code: "", barcode: "", promoPrice: 25, promoEndsAt: "2026-11-30T23:59:59-03:00" },
    ];
  });

  it("do começo ao fim: tudo com estoque, prévia, tirar um item e agendar", async () => {
    const onAplicada = jest.fn();
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} onAplicada={onAplicada} />));
    // Sem estoque e já em promoção ficam de fora por padrão.
    expect(textoDe(porId(r, "promo-rodape"))).toBe("2 produtos");
    await tocar(r, "promo-continuar");
    expect(tem(r, "promo-prazo-bf")).toBe(true);
    await tocar(r, "promo-pct-30");

    mockRequest.mockResolvedValueOnce({
      dry_run: true,
      items: [
        { product_id: "p1", variant_id: null, nome: "Vestido midi", preco_de: 189.9, preco_por: 132.9, ja_em_promocao: false, abaixo_do_custo: false },
        { product_id: "p2", variant_id: "v9", nome: "Camiseta", variant_label: "M", preco_de: 59.9, preco_por: 41.9, ja_em_promocao: true, abaixo_do_custo: false },
      ],
      fora: [{ product_id: "p2", variant_id: "v8", motivo: "abaixo_do_custo" }],
    });
    await tocar(r, "promo-ver");
    const corpo = mockRequest.mock.calls[0][1].body;
    expect(corpo).toMatchObject({
      modo: "percent", valor: 30, terminacao: "90", dry_run: true,
      starts_at: "2026-11-27T00:00:00-03:00", ends_at: "2026-11-30T23:59:59-03:00",
      targets: [{ product_id: "p1" }, { product_id: "p2" }],
    });
    expect(textoDe(porId(r, "promo-entram"))).toBe("2");
    expect(textoDe(porId(r, "promo-ja-em-promocao"))).toContain("substitui");
    expect(textoDe(porId(r, "promo-fora"))).toContain("abaixo do custo");
    expect(textoDe(porId(r, "promo-aplicar"))).toContain("Agendar a promoção");

    expect(textoDe(porId(r, "promo-item-p2:v9"))).toContain("Camiseta · M");
    await tocar(r, "promo-tirar-p1:");
    expect(textoDe(porId(r, "promo-entram"))).toBe("1");

    mockRequest.mockResolvedValueOnce({ dry_run: false, items: [{ product_id: "p2", variant_id: "v9", nome: "Camiseta · M", preco_de: 59.9, preco_por: 41.9 }], fora: [] });
    await tocar(r, "promo-aplicar");
    const final = mockRequest.mock.calls[1][1].body;
    expect(final.dry_run).toBe(false);
    // Tirar é por produto; o alvo vai como na prévia ({product_id} leva as variantes com preço próprio).
    expect(final.targets).toEqual([{ product_id: "p2" }]);
    expect(tem(r, "promo-pronto")).toBe(true);
    expect(onAplicada).toHaveBeenCalled();
  });

  it("começar agora: vai sem starts_at (o servidor usa o relógio dele) e a tela final concorda no singular", async () => {
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    await tocar(r, "promo-continuar");
    await tocar(r, "promo-prazo-agora");
    mockRequest.mockResolvedValueOnce({
      dry_run: true,
      items: [{ product_id: "p1", variant_id: null, nome: "Vestido midi", preco_de: 189.9, preco_por: 151.9, ja_em_promocao: false, abaixo_do_custo: false }],
      fora: [],
    });
    await tocar(r, "promo-ver");
    expect(mockRequest.mock.calls[0][1].body.starts_at).toBeNull();
    expect(textoDe(porId(r, "promo-aplicar"))).toContain("Ligar a promoção");
    mockRequest.mockResolvedValueOnce({ dry_run: false, items: [{ product_id: "p1", variant_id: null, nome: "Vestido midi", preco_de: 189.9, preco_por: 151.9 }], fora: [] });
    await tocar(r, "promo-aplicar");
    expect(mockRequest.mock.calls[1][1].body.starts_at).toBeNull();
    const pronto = textoDe(porId(r, "promo-pronto"));
    expect(pronto).toContain("Promoção no ar");
    expect(pronto).toContain("1 item já está em promoção.");
    expect(pronto).not.toContain("estão");
  });

  it("por categoria conta só a categoria marcada; desmarcar 'deixar de fora' traz quem já está em promoção", async () => {
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    await tocar(r, "promo-base-categoria");
    expect(textoDe(porId(r, "promo-rodape"))).toBe("0 produtos");
    await tocar(r, "promo-cat-Blusas");
    expect(textoDe(porId(r, "promo-rodape"))).toBe("1 produto");
    await tocar(r, "promo-deixar-de-fora");
    expect(textoDe(porId(r, "promo-rodape"))).toBe("2 produtos");
  });

  it("erro do servidor aparece em texto gentil e nada avança", async () => {
    const r = await montar(comQuery(<CriarPromocaoModal companyId={CID} onFechar={jest.fn()} />));
    await tocar(r, "promo-continuar");
    mockRequest.mockRejectedValueOnce(new (ApiError as any)("Proibido", 403));
    await tocar(r, "promo-ver");
    expect(textoDe(porId(r, "promo-erro"))).toContain("só de consulta");
    mockRequest.mockRejectedValueOnce(new (ApiError as any)("x", 503, { code: "MIGRATION_PENDING" }));
    await tocar(r, "promo-ver");
    expect(textoDe(porId(r, "promo-erro"))).toContain("sendo ligada");
    expect(tem(r, "promo-entram")).toBe(false);
  });
});

// ── 6. Cadastro de produto ───────────────────────────────────

describe("aviso no cadastro de produto em promoção", () => {
  const agora = new Date("2026-11-08T15:00:00Z");
  it("no ar: o preço daqui é o normal, a promoção segue até o fim", () => {
    expect(avisoDePromocaoNoCadastro({ promoPrice: 151.9, promoStartsAt: "2026-11-01T03:00:00Z", promoEndsAt: "2026-12-01T02:59:59Z" }, agora))
      .toBe("Este produto está em promoção por R$ 151,90. O preço que você mudar aqui é o preço normal: o preço da promoção continua valendo até 30/11.");
  });
  it("agendada: diz de quando a quando", () => {
    expect(avisoDePromocaoNoCadastro({ promoPrice: 10, promoStartsAt: "2026-11-27T03:00:00Z", promoEndsAt: "2026-12-01T02:59:59Z" }, agora))
      .toContain("agendada de 27/11 a 30/11");
  });
  it("sem promoção, vencida ou backend antigo: nada", () => {
    expect(avisoDePromocaoNoCadastro({}, agora)).toBeNull();
    expect(avisoDePromocaoNoCadastro({ promoPrice: 10, promoEndsAt: "2026-11-01T02:59:59Z" }, agora)).toBeNull();
  });
  it("o cadastro usa o aviso logo abaixo da seção de preço", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components/screens/estoque/ItemFormModal.tsx"), "utf8");
    expect(src).toContain("avisoDePromocaoNoCadastro(alvo)");
    expect(src).toContain('testID="item-aviso-promocao"');
  });
});
