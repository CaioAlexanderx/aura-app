// ============================================================
// Black Friday na loja online, na página Black Friday (p-120, 14/11/2026)
//
// O que estes testes seguram:
// 1. chave de módulo PRÓPRIA (regra 3): MODULE_PLAN_MAP no Negócio e
//    PERM_TO_MODULES junto do Canal Digital;
// 2. a seção vem logo depois de "Promoção em lote", some no Essencial, sem
//    loja online, com o backend sem a rota e no perfil consulta; no
//    consolidado vira "escolher empresa", sem chamar a campanha;
// 3. textos: selo, descontos, faixa, chave e o aviso da agendada;
// 4. seção: loja não publicada (uma ação só), chave desligada sem desconto,
//    ligar/desligar e trocar o título gravam pela rota do p-118, o 409
//    BF_SEM_PROMOCAO mostra o texto gentil do servidor;
// 5. "Montar descontos" abre o mesmo assistente do De/Por, já no prazo da
//    Black Friday (27/11 a 30/11).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: (p: any) => (p.active ? p.children : null) }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() } }));

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
jest.mock("@/hooks/useVendidosRecentes", () => ({ useVendidosRecentes: () => ({ vendidos: {}, carregando: false, erro: false, refetch: jest.fn() }) }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
let mockVisible: Set<string>;
jest.mock("@/hooks/useVisibleModules", () => {
  const actual = jest.requireActual("@/hooks/useVisibleModules");
  return { ...actual, useVisibleModules: () => mockVisible };
});
let mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));
jest.mock("@/hooks/useResumoVencimento", () => ({
  useResumoVencimento: () => ({ disponivel: false, carregando: false, dados: undefined, recarregar: () => {} }),
}));
jest.mock("@/components/CompanyPickerModal", () => ({ CompanyPickerModal: () => null }));
jest.mock("@/components/screens/blackfriday/OQueVaiFaltar", () => ({ OQueVaiFaltar: () => null }));
jest.mock("@/components/screens/blackfriday/ValeTrocaEspelho", () => ({ ValeTrocaEspelho: () => null }));
jest.mock("@/components/screens/configuracoes/AssentoTemporadaCard", () => ({ AssentoTemporadaCard: () => null }));

import { ApiError } from "@/services/api";
import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { secoesDaPagina, LOJA_ONLINE_BF_MOD } from "@/components/screens/blackfriday/secoes";
import { PaginaBlackFriday } from "@/components/screens/blackfriday/PaginaBlackFriday";
import { BlackFridayNaLojaOnline } from "@/components/screens/blackfriday/lojaOnline/BlackFridayNaLojaOnline";
import {
  avisoDeAgendada, diaMes, mensagemErroCampanha, seloDaCampanha, textoDaChave, textoDaFaixa, textoDosDescontos,
} from "@/components/screens/blackfriday/lojaOnline/regrasCampanhaLoja";
import type { EstadoDaCampanha } from "@/services/campanhaLojaApi";

const CID = "aaaaaaaa-0000-4000-8000-000000000001";
jest.setTimeout(30000);

function estado(o: Partial<EstadoDaCampanha> & { promocoes?: Partial<EstadoDaCampanha["promocoes"]> } = {}): EstadoDaCampanha {
  const { promocoes, ...resto } = o;
  return {
    loja_online: { existe: true, publicada: true, slug: "boutique" },
    ativa: false,
    titulo: "black_friday",
    titulos: [
      { id: "black_friday", texto: "Black Friday" },
      { id: "black_friday_da_loja", texto: "Black Friday da Boutique Aurora" },
      { id: "ofertas_de_novembro", texto: "Ofertas de novembro" },
    ],
    no_ar: false,
    agendada: false,
    pode_ligar: false,
    periodo_padrao: { inicio: "2026-11-27", fim: "2026-11-30" },
    ...resto,
    promocoes: { no_ar: 0, agendadas: 0, ate_pct: 0, ate_data: null, comeca_em: null, ...(promocoes || {}) },
  };
}

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
  mockPush.mockReset();
  fixarAgora("2026-11-14T15:00:00Z");
  mockAuth = { company: { id: CID, plan: "negocio", member_role: "owner" }, consolidatedView: false, availableCompanies: [{ id: CID }], isStaff: false, refreshMe: jest.fn(async () => {}) };
  mockVisible = new Set(["estoque", "configuracoes", "black_friday", LOJA_ONLINE_BF_MOD]);
  mockConsulta = { consulta: false, carregando: false, semCusto: false };
});
afterEach(() => jest.useRealTimers());

function comQuery(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{el}</QueryClientProvider>;
}
async function montar(el: React.ReactElement) {
  let r: renderer.ReactTestRenderer;
  await act(async () => { r = renderer.create(comQuery(el)); });
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return r!;
}
const achar = (r: renderer.ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id, { deep: false });
const porId = (r: renderer.ReactTestRenderer, id: string) => achar(r, id)[0];
const tem = (r: renderer.ReactTestRenderer, id: string) => achar(r, id).length > 0;
function textoDe(node: any): string {
  if (!node) return "";
  return (node.children as any[]).map((c) => (typeof c === "string" ? c : textoDe(c))).join("");
}
async function tocar(r: renderer.ReactTestRenderer, id: string) {
  const n = porId(r, id);
  if (!n) throw new Error("sem " + id);
  await act(async () => { await n.props.onPress(); });
  for (let i = 0; i < 2; i++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}

/** A API por URL: campanha (GET/PUT) e as listas do De/Por. */
function api(o: { campanha?: () => any; put?: (body: any) => any } = {}) {
  mockRequest.mockImplementation(async (url: string, opts?: any) => {
    if (url.endsWith("/digital-channel/campanha")) {
      if (opts && opts.method === "PUT") return o.put ? o.put(opts.body) : estado();
      return o.campanha ? o.campanha() : estado();
    }
    if (url.includes("/products/promotions")) return { items: [] };
    return {};
  });
}

// ── 1. Chave de módulo ───────────────────────────────────────

describe("chave de módulo própria (regra 3)", () => {
  it("Negócio no MODULE_PLAN_MAP e junto do Canal Digital no PERM_TO_MODULES", () => {
    expect(LOJA_ONLINE_BF_MOD).toBe("black_friday.loja_online");
    expect(MODULE_PLAN_MAP[LOJA_ONLINE_BF_MOD]).toBe("negocio");
    expect(MODULE_PLAN_MAP.canal).toBe("negocio");
    expect(PERM_TO_MODULES.clientes).toEqual(expect.arrayContaining(["canal", LOJA_ONLINE_BF_MOD]));
  });
});

// ── 2. Quando a seção aparece ────────────────────────────────

describe("quando a seção aparece", () => {
  const base = { visible: new Set(["estoque", LOJA_ONLINE_BF_MOD]), consolidatedView: false, hoje: "2026-11-14", dePorDisponivel: true };

  it("logo depois da Promoção em lote, com o backend e a loja online", () => {
    const s = secoesDaPagina({ ...base, lojaOnlineDisponivel: true });
    expect(s.map((x) => x.chave).slice(0, 2)).toEqual(["de_por", "loja_online"]);
    expect(s[1].titulo).toBe("Black Friday na loja online");
  });

  it("some sem o módulo (Essencial), sem loja online / backend e no perfil consulta", () => {
    const sem = (e: any) => secoesDaPagina({ ...base, ...e }).some((x) => x.chave === "loja_online");
    expect(sem({ visible: new Set(["estoque"]), lojaOnlineDisponivel: true })).toBe(false);
    expect(sem({ lojaOnlineDisponivel: false })).toBe(false);
    expect(sem({ lojaOnlineDisponivel: true, estoqueSoConsulta: true })).toBe(false);
  });

  it("consolidado: escolher empresa, mesmo sem saber da loja", () => {
    const s = secoesDaPagina({ ...base, consolidatedView: true });
    expect(s.find((x) => x.chave === "loja_online")).toMatchObject({ variante: "escolher_empresa" });
  });

  it("página: aparece com a loja online; 404 do backend ou empresa sem loja = some", async () => {
    api();
    let r = await montar(<PaginaBlackFriday />);
    expect(tem(r, "bf-secao-loja-online")).toBe(true);
    expect(mockAuth.refreshMe).toHaveBeenCalled();

    mockRequest.mockReset();
    mockRequest.mockImplementation(async (url: string) => {
      if (url.endsWith("/digital-channel/campanha")) throw new ApiError("nao achei", 404);
      return { items: [] };
    });
    r = await montar(<PaginaBlackFriday />);
    expect(tem(r, "bf-secao-loja-online")).toBe(false);

    api({ campanha: () => estado({ loja_online: { existe: false, publicada: false, slug: null } }) });
    r = await montar(<PaginaBlackFriday />);
    expect(tem(r, "bf-secao-loja-online")).toBe(false);
  });

  it("página no Essencial: nem chama a campanha", async () => {
    mockVisible = new Set(["estoque", "configuracoes", "black_friday"]);
    api();
    const r = await montar(<PaginaBlackFriday />);
    expect(tem(r, "bf-secao-loja-online")).toBe(false);
    expect(mockRequest.mock.calls.some(([u]) => String(u).includes("/campanha"))).toBe(false);
  });

  it("página no consolidado: o cartão de escolher a empresa, sem chamar a campanha", async () => {
    mockAuth = { ...mockAuth, consolidatedView: true, availableCompanies: [{ id: CID }, { id: "b" }] };
    api();
    const r = await montar(<PaginaBlackFriday />);
    expect(tem(r, "bf-loja-escolher-empresa")).toBe(true);
    expect(mockRequest.mock.calls.some(([u]) => String(u).includes("/campanha"))).toBe(false);
  });
});

// ── 3. Textos ────────────────────────────────────────────────

describe("textos", () => {
  it("selo: no ar, agendada com a data, ligada sem promoção, desligada", () => {
    expect(seloDaCampanha(estado({ ativa: true, no_ar: true }))).toEqual({ texto: "No ar", tom: "no_ar" });
    expect(seloDaCampanha(estado({ ativa: true, agendada: true, promocoes: { comeca_em: "2026-11-27" } })).texto).toBe("Agendada · a faixa aparece em 27/11");
    expect(seloDaCampanha(estado({ ativa: true })).texto).toBe("Ligada · sem promoção no ar");
    expect(seloDaCampanha(estado()).texto).toBe("Campanha desligada");
  });

  it("descontos: no ar, agendados e nenhum; sempre lembra que vale no Caixa", () => {
    expect(textoDosDescontos(estado({ promocoes: { no_ar: 42, ate_pct: 40, ate_data: "2026-11-30" } })))
      .toBe("42 produtos em promoção · até 40% · no ar até 30/11. O preço promocional vale no Caixa e na loja online.");
    expect(textoDosDescontos(estado({ promocoes: { agendadas: 1, comeca_em: "2026-11-27" } })))
      .toBe("1 produto com promoção agendada · começa em 27/11. O preço promocional vale no Caixa e na loja online.");
    expect(textoDosDescontos(estado())).toBe("Nenhum produto em promoção ainda. O preço promocional vale no Caixa e na loja online.");
  });

  it("faixa, chave, aviso da agendada e erros", () => {
    expect(textoDaFaixa(estado({ promocoes: { ate_pct: 40 } }))).toContain("“Até 40% OFF” é calculado pelos seus descontos e não se edita");
    expect(textoDaChave(estado({ pode_ligar: false }))).toBe("Disponível depois de montar pelo menos um desconto.");
    expect(textoDaChave(estado({ pode_ligar: true }))).toContain("Ver ofertas");
    expect(avisoDeAgendada(estado())).toBe(null);
    expect(avisoDeAgendada(estado({ agendada: true, promocoes: { comeca_em: "2026-11-27" } }))).toContain("a loja continua como hoje até 27/11");
    expect(diaMes("2026-11-30")).toBe("30/11");
    expect(mensagemErroCampanha(new ApiError("x", 409, { code: "BF_SEM_PROMOCAO", error: "Monte antes um desconto." }))).toBe("Monte antes um desconto.");
    expect(mensagemErroCampanha(new ApiError("x", 503, { code: "MIGRATION_PENDING" }))).toContain("sendo ligada");
    expect(mensagemErroCampanha(new ApiError("x", 409, { code: "SEM_LOJA_ONLINE" }))).toContain("Configure a loja online");
  });
});

// ── 4. A seção ───────────────────────────────────────────────

function campanhaCom(e: EstadoDaCampanha, salvar?: jest.Mock) {
  return { disponivel: true, carregando: false, estado: e, salvar: salvar || jest.fn(async () => e), recarregar: jest.fn() };
}

describe("a seção", () => {
  it("loja não publicada: uma ação só, Configurar a loja online", async () => {
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={campanhaCom(estado({ loja_online: { existe: true, publicada: false, slug: "x" } }))} />);
    expect(tem(r, "bf-loja-nao-publicada")).toBe(true);
    expect(tem(r, "bf-loja-chave")).toBe(false);
    expect(tem(r, "bf-loja-montar")).toBe(false);
    await tocar(r, "bf-loja-configurar");
    expect(mockPush).toHaveBeenCalledWith("/canal");
  });

  it("sem desconto: Montar descontos em destaque e a chave desligada", async () => {
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={campanhaCom(estado())} />);
    expect(textoDe(porId(r, "bf-loja-selo"))).toBe("Campanha desligada");
    expect(textoDe(porId(r, "bf-loja-montar"))).toBe("Montar descontos");
    expect(porId(r, "bf-loja-chave").props.disabled).toBe(true);
    expect(porId(r, "bf-loja-chave").props.accessibilityState).toMatchObject({ checked: false, disabled: true });
  });

  it("com promoção no ar: liga a campanha pela rota e mostra No ar", async () => {
    const salvar = jest.fn(async () => estado());
    const e = estado({ pode_ligar: true, promocoes: { no_ar: 3, ate_pct: 30, ate_data: "2026-11-30" } });
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={campanhaCom(e, salvar)} />);
    expect(textoDe(porId(r, "bf-loja-montar"))).toBe("Montar mais descontos");
    await tocar(r, "bf-loja-chave");
    expect(salvar).toHaveBeenCalledWith({ ativa: true });
  });

  it("trocar o título grava o título; o escolhido não grava de novo", async () => {
    const salvar = jest.fn(async () => estado());
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={campanhaCom(estado({ pode_ligar: true }), salvar)} />);
    expect(porId(r, "bf-loja-titulo-black_friday").props.accessibilityState).toMatchObject({ checked: true });
    await tocar(r, "bf-loja-titulo-black_friday");
    expect(salvar).not.toHaveBeenCalled();
    await tocar(r, "bf-loja-titulo-ofertas_de_novembro");
    expect(salvar).toHaveBeenCalledWith({ titulo: "ofertas_de_novembro" });
  });

  it("409 BF_SEM_PROMOCAO: o texto gentil do servidor e o estado relido", async () => {
    const c = campanhaCom(estado({ pode_ligar: true }), jest.fn(async () => {
      throw new ApiError("conflito", 409, { code: "BF_SEM_PROMOCAO", error: "Para ligar a campanha, monte antes pelo menos um desconto. Assim a faixa da loja mostra uma promoção de verdade." });
    }));
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={c} />);
    await tocar(r, "bf-loja-chave");
    expect(textoDe(porId(r, "bf-loja-erro"))).toContain("monte antes pelo menos um desconto");
    expect(c.recarregar).toHaveBeenCalled();
  });

  it("ligada e agendada: o aviso de que a faixa nasce sozinha", async () => {
    const e = estado({ ativa: true, agendada: true, pode_ligar: true, promocoes: { agendadas: 5, comeca_em: "2026-11-27" } });
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={campanhaCom(e)} />);
    expect(textoDe(porId(r, "bf-loja-selo"))).toBe("Agendada · a faixa aparece em 27/11");
    expect(tem(r, "bf-loja-aviso-agendada")).toBe(true);
    expect(porId(r, "bf-loja-chave").props.accessibilityState).toMatchObject({ checked: true });
  });

  it("página inteira: ligar pela rota PUT do p-118 e a tela segue o servidor", async () => {
    let ligada = false;
    api({
      campanha: () => estado({ ativa: ligada, no_ar: ligada, pode_ligar: true, promocoes: { no_ar: 3, ate_pct: 30, ate_data: "2026-11-30" } }),
      put: (body) => { ligada = body.ativa === true; return estado({ ativa: ligada, no_ar: ligada, pode_ligar: true, promocoes: { no_ar: 3, ate_pct: 30, ate_data: "2026-11-30" } }); },
    });
    const r = await montar(<PaginaBlackFriday />);
    await tocar(r, "bf-loja-chave");
    const put = mockRequest.mock.calls.find(([u, o]) => String(u).endsWith("/campanha") && o && o.method === "PUT");
    expect(put).toEqual(["/companies/" + CID + "/digital-channel/campanha", { method: "PUT", body: { ativa: true } }]);
    expect(textoDe(porId(r, "bf-loja-selo"))).toBe("No ar");
  });
});

// ── 5. O assistente ──────────────────────────────────────────

describe("Montar descontos", () => {
  it("abre o mesmo assistente do De/Por, com o título da loja online e o prazo da Black Friday", async () => {
    mockProdutos = [{ id: "p1", name: "Vestido Midi", price: 139.9, cost_price: 50, stock_qty: 4, is_active: true }];
    const r = await montar(<BlackFridayNaLojaOnline companyId={CID} campanha={campanhaCom(estado())} />);
    await tocar(r, "bf-loja-montar");
    const titulo = r.root.findAll((n) => n.props.accessibilityLabel === "Montar descontos da loja online", { deep: false });
    expect(titulo.length).toBeGreaterThan(0);
    await tocar(r, "promo-continuar");
    expect(porId(r, "promo-prazo-bf").props.accessibilityState).toMatchObject({ checked: true });
  });
});
