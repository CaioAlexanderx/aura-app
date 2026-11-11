// ============================================================
// Página Black Friday · "Crediário para janeiro" (p-91, 09/11/2026)
// e "Promoção em lote" no consolidado (achado do QA, 09/11/2026)
//
// Mockup aprovado: https://claude.ai/artifact/Ki6PMsQx9eywuchDrcKMnX
// O que estes testes seguram:
// 1. regras: fase (nov/dez atalho, janeiro só resumo, resto some), período
//    do resumo, 1º vencimento no dia escolhido, barras por semana;
// 2. secoesDaPagina: crediário é a 2ª seção, depois da Promoção em lote, e
//    some sem o módulo, sem o backend (crediarioDisponivel) e fora da época;
//    no consolidado a Promoção em lote vira a variante "escolher_empresa";
// 3. a página: 404 e 403 (crediário desligado) escondem a seção; resumo com
//    valores e o estado zerado; em janeiro sem o botão; consolidado pergunta
//    a empresa; o atalho abre o lançamento com a 1ª parcela no dia escolhido;
// 4. Promoção em lote no consolidado: cartão com o botão de trocar a
//    empresa ativa, sem chamar as promoções; perfil consulta sem a seção.
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
    constructor(m: string, status: number, data?: any, _n = false, code: string | null = null) {
      super(m); this.status = status; this.data = data; this.code = code;
    }
  }
  return { request: (...a: any[]) => mockRequest(...a), ApiError, pdvSettingsApi: { save: jest.fn() } };
});

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
let mockVisible: Set<string>;
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockVisible }));
let mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));
const mockPromocoes = jest.fn();
let mockDePorDisponivel = false;
jest.mock("@/hooks/usePromocoesDePor", () => ({
  usePromocoesDePor: (cid: any, ligado: boolean) => {
    mockPromocoes(cid, ligado);
    return { disponivel: mockDePorDisponivel && ligado, carregando: false, ativa: [], agendada: [], encerrada: [], recarregar: () => {} };
  },
}));
jest.mock("@/components/screens/blackfriday/dePor/PromocaoEmLote", () => {
  const { View } = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  return { PromocaoEmLote: () => R.createElement(View, { testID: "promo-secao-mock" }) };
});
jest.mock("@/components/screens/blackfriday/OQueVaiFaltar", () => ({ OQueVaiFaltar: () => null }));
jest.mock("@/components/screens/blackfriday/ValeTrocaEspelho", () => ({ ValeTrocaEspelho: () => null }));
jest.mock("@/components/screens/configuracoes/AssentoTemporadaCard", () => ({ AssentoTemporadaCard: () => null }));
// O lançamento em si tem os testes dele (CriarLancamentoPrimeiraParcela):
// aqui importa COMO a seção o abre.
const mockModal = jest.fn();
jest.mock("@/components/crediario/CriarLancamentoModal", () => {
  const { View } = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  return {
    CriarLancamentoModal: (p: any) => {
      mockModal(p);
      return R.createElement(View, { testID: "modal-lancamento", companyId: p.companyId, primeiraParcela: p.primeiraParcela, onClose: p.onClose });
    },
  };
});
const mockPicker = jest.fn();
jest.mock("@/components/CompanyPickerModal", () => {
  const { View } = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  return {
    CompanyPickerModal: (p: any) => {
      mockPicker(p);
      return p.visible ? R.createElement(View, { testID: "picker-empresa", onPick: p.onPick }) : null;
    },
  };
});

import { ApiError } from "@/services/api";
import { secoesDaPagina, POR_QUE_CREDIARIO_EM_JANEIRO, TEXTOS_DAS_SECOES } from "@/components/screens/blackfriday/secoes";
import {
  faseCrediarioJaneiro, periodoDoJaneiro, primeiraParcelaNoDia, barrasDasSemanas, DIAS_DE_VENCIMENTO,
} from "@/components/screens/blackfriday/crediarioJaneiro/regrasCrediarioJaneiro";
import { lerResumoVencimento } from "@/services/resumoVencimentoApi";
import { PaginaBlackFriday } from "@/components/screens/blackfriday/PaginaBlackFriday";
import { TEXTO_PROMOCAO_POR_EMPRESA } from "@/components/screens/blackfriday/EscolherEmpresaParaPromocao";

const CID = "aaaaaaaa-0000-4000-8000-000000000001";
const CID2 = "aaaaaaaa-0000-4000-8000-000000000002";
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

const RESUMO = {
  periodo: { de: "2027-01-01", ate: "2027-01-31" },
  parcelas: 38, valor: 7420.5, clientes: 12, carnes: 14,
  por_semana: [
    { semana_inicio: "2026-12-28", parcelas: 3, valor: 600 },
    { semana_inicio: "2027-01-04", parcelas: 20, valor: 4000 },
    { semana_inicio: "2027-01-11", parcelas: 15, valor: 2820.5 },
  ],
  empresas: [{ company_id: CID, nome: null, parcelas: 38, valor: 7420.5, clientes: 12, carnes: 14 }],
  consolidated: false,
};
const ZERADO = { ...RESUMO, parcelas: 0, valor: 0, clientes: 0, carnes: 0, por_semana: [], empresas: [{ ...RESUMO.empresas[0], parcelas: 0, valor: 0, clientes: 0, carnes: 0 }] };
const CONSOLIDADO = {
  ...RESUMO, parcelas: 60, valor: 10000, carnes: 20, clientes: 18, consolidated: true, company_count: 2,
  empresas: [
    { company_id: CID, nome: "Loja Centro", parcelas: 38, valor: 7420.5, clientes: 12, carnes: 14 },
    { company_id: CID2, nome: "Loja Bairro", parcelas: 22, valor: 2579.5, clientes: 6, carnes: 6 },
  ],
};

/** Resposta do resumo; promoções e /auth/me não importam aqui. */
let respostaResumo: () => any;
beforeEach(() => {
  jest.clearAllMocks();
  fixarAgora("2026-11-20T15:00:00Z");
  mockAuth = {
    company: { id: CID, plan: "negocio", member_role: "owner" }, consolidatedView: false,
    availableCompanies: [{ id: CID }], isStaff: false, user: { id: "u1" }, switchCompany: jest.fn().mockResolvedValue(undefined),
  };
  mockVisible = new Set(["estoque", "crediario", "configuracoes"]);
  mockConsulta = { consulta: false, carregando: false, semCusto: false };
  mockDePorDisponivel = true;
  respostaResumo = () => Promise.resolve(RESUMO);
  mockRequest.mockImplementation((p: string) => {
    if (p.includes("resumo-vencimento")) return respostaResumo();
    return Promise.resolve({});
  });
});
afterEach(() => jest.useRealTimers());

function comQuery(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{el}</QueryClientProvider>;
}
async function montar() {
  let r: renderer.ReactTestRenderer;
  await act(async () => { r = renderer.create(comQuery(<PaginaBlackFriday />)); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return r!;
}
function todos(r: renderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n) => n.props.testID === id, { deep: false });
}
const porId = (r: renderer.ReactTestRenderer, id: string) => todos(r, id)[0];
const tem = (r: renderer.ReactTestRenderer, id: string) => todos(r, id).length > 0;
function textoDe(node: any): string {
  if (!node) return "";
  return (node.children as any[]).map((c) => (typeof c === "string" ? c : textoDe(c))).join("");
}
async function tocar(r: renderer.ReactTestRenderer, id: string) {
  const n = porId(r, id);
  if (!n) throw new Error("sem " + id);
  await act(async () => { n.props.onPress(); });
}
function secoes(r: renderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("bf-secao-") && !n.props.testID.endsWith("-por-que"), { deep: false })
    .forEach((n) => { if (!out.includes(n.props.testID)) out.push(n.props.testID); });
  return out;
}

// ── 1. Regras ────────────────────────────────────────────────

describe("regras do crediário para janeiro", () => {
  it("fase: novembro e dezembro com atalho, janeiro só o resumo, o resto some", () => {
    expect(faseCrediarioJaneiro("2026-10-31")).toBe("fora");
    expect(faseCrediarioJaneiro("2026-11-01")).toBe("atalho");
    expect(faseCrediarioJaneiro("2026-12-31")).toBe("atalho");
    expect(faseCrediarioJaneiro("2027-01-01")).toBe("janeiro");
    expect(faseCrediarioJaneiro("2027-01-31")).toBe("janeiro");
    expect(faseCrediarioJaneiro("2027-02-01")).toBe("fora");
  });

  it("período: o janeiro que vem; em janeiro, o de agora", () => {
    expect(periodoDoJaneiro("2026-11-20")).toEqual({ de: "2027-01-01", ate: "2027-01-31" });
    expect(periodoDoJaneiro("2026-12-31")).toEqual({ de: "2027-01-01", ate: "2027-01-31" });
    expect(periodoDoJaneiro("2027-01-15")).toEqual({ de: "2027-01-01", ate: "2027-01-31" });
  });

  it("1º vencimento: o dia escolhido do janeiro que vem", () => {
    expect(DIAS_DE_VENCIMENTO).toEqual([5, 10, 15, 20, 25]);
    expect(primeiraParcelaNoDia("2026-11-20", 5)).toBe("05/01/2027");
    expect(primeiraParcelaNoDia("2026-12-31", 25)).toBe("25/01/2027");
  });

  it("barras: uma por semana; a semana que começa em dezembro aparece como 01/01", () => {
    const b = barrasDasSemanas(RESUMO.por_semana, RESUMO.periodo);
    expect(b.map((x) => x.rotulo)).toEqual(["01/01", "04/01", "11/01"]);
    expect(b[1].altura).toBe(100);
    expect(b[0].altura).toBe(15);
    expect(barrasDasSemanas([], RESUMO.periodo)).toEqual([]);
  });

  it("resposta tolerante: campos ausentes viram zero", () => {
    const r = lerResumoVencimento({}, { de: "2027-01-01", ate: "2027-01-31" });
    expect(r).toMatchObject({ parcelas: 0, valor: 0, carnes: 0, por_semana: [], empresas: [], periodo: { de: "2027-01-01" } });
  });
});

// ── 2. Quais seções ──────────────────────────────────────────

describe("secoesDaPagina", () => {
  const tudo = new Set(["estoque", "crediario", "configuracoes"]);
  const chaves = (e: any) => secoesDaPagina(e).map((s) => s.chave);

  it("crediário para janeiro é a 2ª, logo depois da Promoção em lote", () => {
    expect(chaves({ visible: tudo, consolidatedView: false, hoje: "2026-11-20", dePorDisponivel: true, crediarioDisponivel: true }))
      .toEqual(["de_por", "crediario_janeiro", "ruptura", "assento", "vale_troca"]);
  });

  it("some sem o módulo do crediário (Essencial), sem o backend do resumo e fora de nov–jan", () => {
    const sem = new Set(["estoque", "configuracoes"]);
    expect(chaves({ visible: sem, consolidatedView: false, hoje: "2026-11-20", crediarioDisponivel: true })).not.toContain("crediario_janeiro");
    expect(chaves({ visible: tudo, consolidatedView: false, hoje: "2026-11-20" })).not.toContain("crediario_janeiro");
    expect(chaves({ visible: tudo, consolidatedView: false, hoje: "2026-10-31", crediarioDisponivel: true })).not.toContain("crediario_janeiro");
    expect(chaves({ visible: tudo, consolidatedView: false, hoje: "2027-02-01", crediarioDisponivel: true })).not.toContain("crediario_janeiro");
  });

  it("em janeiro o 'por que agora' fala de receber", () => {
    const s = secoesDaPagina({ visible: tudo, consolidatedView: false, hoje: "2027-01-10", crediarioDisponivel: true })
      .find((x) => x.chave === "crediario_janeiro")!;
    expect(s.porQueAgora).toBe(POR_QUE_CREDIARIO_EM_JANEIRO);
    const nov = secoesDaPagina({ visible: tudo, consolidatedView: false, hoje: "2026-11-20", crediarioDisponivel: true })
      .find((x) => x.chave === "crediario_janeiro")!;
    expect(nov.porQueAgora).toBe(TEXTOS_DAS_SECOES.crediario_janeiro.porQueAgora);
  });

  it("consolidado: o crediário entra (soma as empresas)", () => {
    expect(chaves({ visible: tudo, consolidatedView: true, hoje: "2026-11-20", crediarioDisponivel: true }))
      .toEqual(["de_por", "crediario_janeiro", "ruptura"]);
  });

  it("Promoção em lote, consolidado: vira 'escolher_empresa', sem depender das promoções", () => {
    const s = secoesDaPagina({ visible: tudo, consolidatedView: true, hoje: "2026-11-20" });
    expect(s[0].chave).toBe("de_por");
    expect(s[0].variante).toBe("escolher_empresa");
  });

  it("Promoção em lote, uma empresa: segue como antes (só com o backend, sem variante)", () => {
    const com = secoesDaPagina({ visible: tudo, consolidatedView: false, hoje: "2026-11-20", dePorDisponivel: true });
    expect(com[0].chave).toBe("de_por");
    expect(com[0].variante).toBeUndefined();
    expect(chaves({ visible: tudo, consolidatedView: false, hoje: "2026-11-20" })).not.toContain("de_por");
  });

  it("Promoção em lote: perfil consulta não vê nem no consolidado; sem o Estoque, some", () => {
    expect(chaves({ visible: tudo, consolidatedView: true, hoje: "2026-11-20", estoqueSoConsulta: true })).not.toContain("de_por");
    expect(chaves({ visible: new Set(["crediario"]), consolidatedView: true, hoje: "2026-11-20" })).not.toContain("de_por");
  });
});

// ── 3. A página ──────────────────────────────────────────────

describe("PaginaBlackFriday · Crediário para janeiro", () => {
  it("aparece em 2º, número 2, com o resumo da empresa ativa", async () => {
    const r = await montar();
    expect(secoes(r).slice(0, 3)).toEqual(["bf-secao-de-por", "bf-secao-crediario-janeiro", "bf-secao-ruptura"]);
    const card = textoDe(porId(r, "bf-secao-crediario-janeiro"));
    expect(card).toContain("2");
    expect(card).toContain("Crediário para janeiro");
    expect(card).toContain("Por que agora:");
    expect(mockRequest).toHaveBeenCalledWith(
      "/companies/" + CID + "/credit/installments/resumo-vencimento?de=2027-01-01&ate=2027-01-31",
      expect.anything(),
    );
  });

  it("mostra carnês, parcelas e valor em aberto, e as semanas", async () => {
    const r = await montar();
    expect(textoDe(porId(r, "crediario-jan-carnes"))).toBe("14");
    expect(textoDe(porId(r, "crediario-jan-parcelas"))).toBe("38");
    expect(textoDe(porId(r, "crediario-jan-valor"))).toBe("R$ 7.420,50");
    expect(textoDe(porId(r, "crediario-jan-legenda"))).toContain("Parcelas em aberto que vencem de 01 a 31/01/2027");
    expect(tem(r, "crediario-jan-semanas")).toBe(true);
    // uma empresa: sem a tabela por empresa
    expect(tem(r, "crediario-jan-empresas")).toBe(false);
  });

  it("nada vence em janeiro: o estado zerado explica, e o atalho continua", async () => {
    respostaResumo = () => Promise.resolve(ZERADO);
    const r = await montar();
    expect(textoDe(porId(r, "crediario-jan-vazio"))).toContain("Nenhuma parcela em aberto vence em janeiro");
    expect(tem(r, "crediario-jan-parcelas")).toBe(false);
    expect(tem(r, "crediario-jan-lancar")).toBe(true);
  });

  it("backend sem a rota (404): a seção não aparece", async () => {
    respostaResumo = () => Promise.reject(new (ApiError as any)("Não encontrado", 404));
    const r = await montar();
    expect(tem(r, "bf-secao-crediario-janeiro")).toBe(false);
    expect(secoes(r)[0]).toBe("bf-secao-de-por");
  });

  it("crediário desligado nas Políticas do Caixa (403 CREDIARIO_DISABLED): some", async () => {
    respostaResumo = () => Promise.reject(new (ApiError as any)("Crediário não habilitado", 403, { code: "CREDIARIO_DISABLED" }, false, "CREDIARIO_DISABLED"));
    const r = await montar();
    expect(tem(r, "bf-secao-crediario-janeiro")).toBe(false);
  });

  it("plano sem crediário (Essencial): nem chama o resumo, e a seção não existe", async () => {
    mockVisible = new Set(["estoque", "configuracoes"]);
    const r = await montar();
    expect(tem(r, "bf-secao-crediario-janeiro")).toBe(false);
    expect(mockRequest.mock.calls.some((c) => String(c[0]).includes("resumo-vencimento"))).toBe(false);
    expect(textoDe(r.root)).not.toMatch(/bloquead|assine|upgrade|crediário/i);
  });

  it("fora de nov–jan nem chama o resumo", async () => {
    jest.useRealTimers();
    fixarAgora("2027-02-01T15:00:00Z");
    const r = await montar();
    expect(tem(r, "bf-secao-crediario-janeiro")).toBe(false);
    expect(mockRequest.mock.calls.some((c) => String(c[0]).includes("resumo-vencimento"))).toBe(false);
  });

  it("em janeiro: só o resumo (do janeiro de agora), sem o botão", async () => {
    jest.useRealTimers();
    fixarAgora("2027-01-12T15:00:00Z");
    const r = await montar();
    expect(tem(r, "bf-secao-crediario-janeiro")).toBe(true);
    expect(tem(r, "crediario-jan-resumo")).toBe(true);
    expect(tem(r, "crediario-jan-atalho")).toBe(false);
    expect(tem(r, "crediario-jan-lancar")).toBe(false);
    expect(textoDe(porId(r, "bf-secao-crediario-janeiro-por-que"))).toContain("Janeiro é o mês de receber");
    expect(mockRequest).toHaveBeenCalledWith(
      "/companies/" + CID + "/credit/installments/resumo-vencimento?de=2027-01-01&ate=2027-01-31",
      expect.anything(),
    );
  });

  it("o atalho abre o lançamento com a 1ª parcela no dia escolhido de janeiro", async () => {
    const r = await montar();
    expect(textoDe(porId(r, "crediario-jan-lancar"))).toContain("1ª parcela em 10/01/2027");
    await tocar(r, "crediario-jan-dia-25");
    expect(textoDe(porId(r, "crediario-jan-lancar"))).toContain("1ª parcela em 25/01/2027");
    expect(tem(r, "modal-lancamento")).toBe(false);
    await tocar(r, "crediario-jan-lancar");
    const modal = porId(r, "modal-lancamento");
    expect(modal.props.primeiraParcela).toBe("25/01/2027");
    expect(modal.props.companyId).toBe(CID);
    // fechar relê o resumo (o lançamento novo entra na conta)
    const antes = mockRequest.mock.calls.filter((c) => String(c[0]).includes("resumo-vencimento")).length;
    await act(async () => { modal.props.onClose(); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(tem(r, "modal-lancamento")).toBe(false);
    expect(mockRequest.mock.calls.filter((c) => String(c[0]).includes("resumo-vencimento")).length).toBeGreaterThan(antes);
  });
});

describe("PaginaBlackFriday · consolidado", () => {
  beforeEach(() => {
    mockAuth = { ...mockAuth, company: null, consolidatedView: true, availableCompanies: [{ id: CID }, { id: CID2 }] };
    respostaResumo = () => Promise.resolve(CONSOLIDADO);
  });

  it("o resumo soma as empresas, pela rota do consolidado, com a tabela por empresa", async () => {
    const r = await montar();
    expect(mockRequest).toHaveBeenCalledWith("/me/credit/installments/resumo-vencimento?de=2027-01-01&ate=2027-01-31", expect.anything());
    expect(textoDe(porId(r, "crediario-jan-parcelas"))).toBe("60");
    expect(textoDe(porId(r, "crediario-jan-legenda"))).toContain("somando as 2 empresas");
    const tabela = textoDe(porId(r, "crediario-jan-empresas"));
    expect(tabela).toContain("Loja Centro");
    expect(tabela).toContain("Loja Bairro");
    expect(tabela).toContain("R$ 2.579,50");
  });

  it("o botão pergunta para qual empresa lançar e abre o lançamento nela", async () => {
    const r = await montar();
    expect(textoDe(porId(r, "crediario-jan-atalho"))).toContain("Antes de abrir, o app pergunta para qual empresa lançar.");
    await tocar(r, "crediario-jan-dia-5");
    await tocar(r, "crediario-jan-lancar");
    expect(tem(r, "modal-lancamento")).toBe(false);
    expect(tem(r, "crediario-jan-escolher-empresa")).toBe(true);
    await tocar(r, "crediario-jan-empresa-" + CID2);
    const modal = porId(r, "modal-lancamento");
    expect(modal.props.companyId).toBe(CID2);
    expect(modal.props.primeiraParcela).toBe("05/01/2027");
    // a troca de empresa ativa NÃO acontece: o lançamento vai direto na escolhida
    expect(mockAuth.switchCompany).not.toHaveBeenCalled();
  });

  it("voltar da pergunta não abre nada", async () => {
    const r = await montar();
    await tocar(r, "crediario-jan-lancar");
    await tocar(r, "crediario-jan-empresa-cancelar");
    expect(tem(r, "crediario-jan-escolher-empresa")).toBe(false);
    expect(tem(r, "modal-lancamento")).toBe(false);
  });

  it("uma empresa só com crediário: não pergunta", async () => {
    respostaResumo = () => Promise.resolve({ ...CONSOLIDADO, company_count: 1, empresas: [CONSOLIDADO.empresas[1]] });
    const r = await montar();
    await tocar(r, "crediario-jan-lancar");
    expect(porId(r, "modal-lancamento").props.companyId).toBe(CID2);
  });

  it("nenhuma empresa com crediário ligado: a seção some", async () => {
    respostaResumo = () => Promise.resolve({ ...ZERADO, empresas: [], consolidated: true, company_count: 0 });
    const r = await montar();
    expect(tem(r, "bf-secao-crediario-janeiro")).toBe(false);
  });

  it("Promoção em lote: cartão curto que troca a empresa ativa, sem chamar as promoções", async () => {
    const r = await montar();
    expect(secoes(r)[0]).toBe("bf-secao-de-por");
    expect(textoDe(porId(r, "bf-secao-de-por"))).toContain("1");
    expect(textoDe(porId(r, "promo-escolher-empresa"))).toContain(TEXTO_PROMOCAO_POR_EMPRESA);
    expect(tem(r, "promo-secao-mock")).toBe(false);
    // as promoções ficam desligadas no consolidado
    expect(mockPromocoes.mock.calls.every((c) => c[1] === false)).toBe(true);
    expect(mockRequest.mock.calls.some((c) => String(c[0]).includes("promotions"))).toBe(false);

    expect(tem(r, "picker-empresa")).toBe(false);
    await tocar(r, "promo-escolher-empresa-btn");
    const picker = porId(r, "picker-empresa");
    await act(async () => { picker.props.onPick(CID2); });
    expect(mockAuth.switchCompany).toHaveBeenCalledWith(CID2);
  });

  it("Promoção em lote: perfil consulta continua sem a seção", async () => {
    mockConsulta = { consulta: true, carregando: false, semCusto: true };
    const r = await montar();
    expect(tem(r, "bf-secao-de-por")).toBe(false);
    expect(tem(r, "promo-escolher-empresa")).toBe(false);
  });
});
