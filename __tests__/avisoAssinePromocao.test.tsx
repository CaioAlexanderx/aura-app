// ============================================================
// Faixa do Caixa vivo × promoção do primeiro mês (13/10/2026)
//
// Com a promoção ativa (GET /billing/promocao-ativa, elegivel:true) a faixa
// "Seu período de teste terminou" ganha "Assine até 31/10 sem pagar novembro".
// Sem promoção (inelegível, erro, sem empresa) o texto é o de sempre. A
// consulta é a mesma do checkout e fica em cache: abrir o Caixa várias vezes
// não bate na API toda vez.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

var mockBilling = { promocaoAtiva: jest.fn() };
// getter: os imports sobem antes dos `var mock...`, então o valor é lido só no uso.
jest.mock("@/services/billingApi", () => ({ get billingApi() { return mockBilling; } }));

import { AvisoAssine } from "@/components/screens/pdv/AvisoAssine";
import { _resetPromocaoAtiva, buscarPromocaoAtiva, limparPromocaoAtiva } from "@/hooks/usePromocaoAtiva";
import { diaMes, dataBR, prazoDiaMes, mesSemPagar, promocaoVale, fraseDaFaixa } from "@/utils/promocaoPrimeiroMes";

const AGORA = Date.parse("2026-10-13T15:00:00-03:00");
const PROMO = {
  codigo: "PRIMEIROMES",
  titulo: "Assine até 31/10 e não pague novembro",
  descricao: "Quem assina até 31/10 não paga novembro.",
  termina_em: "2026-11-01T02:59:59.999Z",   // 31/10 23:59:59 em Brasília
  primeira_cobranca_em: "2026-12-01",
  elegivel: true,
};

const espera = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
async function render(props: Partial<React.ComponentProps<typeof AvisoAssine>> = {}) {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<AvisoAssine trialEndsAt="2026-10-02T00:00:00Z" companyId="emp-1" {...props} />); });
  await espera();
  return t;
}
const texto = (t: renderer.ReactTestRenderer) => JSON.stringify(t.toJSON());
const promo = (t: renderer.ReactTestRenderer) => t.root.findAllByProps({ testID: "caixa-aviso-promocao" }, { deep: false });

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(AGORA);
  mockBilling.promocaoAtiva.mockReset();
  _resetPromocaoAtiva();
});
afterEach(() => { jest.restoreAllMocks(); });

describe("AvisoAssine com a promoção", () => {
  it("elegível: o texto ganha 'até 31/10 sem pagar novembro' e a data da 1ª cobrança", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue(PROMO);
    const t = await render();
    expect(mockBilling.promocaoAtiva).toHaveBeenCalledWith("emp-1");
    expect(promo(t)).toHaveLength(1);
    const out = texto(t);
    expect(out).toContain("Assine até 31/10 sem pagar novembro: a 1ª cobrança é só em 01/12.");
    // O resto da faixa não muda.
    expect(out).toContain("Seu período de teste terminou");
    expect(out).toContain("O Caixa continua funcionando");
    expect(out).toContain("Assinar agora");
    t.unmount();
  });

  it("inelegível: texto de sempre", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue({ ...PROMO, elegivel: false });
    const t = await render();
    expect(promo(t)).toHaveLength(0);
    expect(texto(t)).not.toContain("sem pagar novembro");
    expect(texto(t)).toContain("Seu período de teste terminou");
    t.unmount();
  });

  it("erro de API: texto de sempre, sem quebrar", async () => {
    mockBilling.promocaoAtiva.mockRejectedValue(new Error("500"));
    const t = await render();
    expect(promo(t)).toHaveLength(0);
    expect(texto(t)).toContain("Assinar agora");
    t.unmount();
  });

  it("sem empresa (companyId ausente): nem consulta a API", async () => {
    const t = await render({ companyId: null });
    expect(mockBilling.promocaoAtiva).not.toHaveBeenCalled();
    expect(promo(t)).toHaveLength(0);
    t.unmount();
  });

  it("prazo vencido com cache velho: some mesmo que a API tenha dito elegível", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue(PROMO);
    const t = await render();
    expect(promo(t)).toHaveLength(1);
    t.unmount();

    (Date.now as jest.Mock).mockReturnValue(Date.parse("2026-11-01T00:00:00-03:00"));
    const t2 = await render();      // a hora andou: o cache expirou e o prazo já passou
    expect(promo(t2)).toHaveLength(0);
    t2.unmount();
  });
});

describe("cache da consulta", () => {
  it("abrir a faixa duas vezes bate na API uma vez só", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue(PROMO);
    const a = await render();
    const b = await render();
    expect(mockBilling.promocaoAtiva).toHaveBeenCalledTimes(1);
    expect(promo(b)).toHaveLength(1);
    a.unmount(); b.unmount();
  });

  it("chamadas simultâneas dividem a mesma requisição", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue(PROMO);
    await Promise.all([buscarPromocaoAtiva("emp-9"), buscarPromocaoAtiva("emp-9"), buscarPromocaoAtiva("emp-9")]);
    expect(mockBilling.promocaoAtiva).toHaveBeenCalledTimes(1);
  });

  it("depois de assinar o cache é limpo e a próxima consulta vai à API", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue(PROMO);
    await buscarPromocaoAtiva("emp-2");
    limparPromocaoAtiva("emp-2");
    mockBilling.promocaoAtiva.mockResolvedValue({ ...PROMO, elegivel: false });
    const p = await buscarPromocaoAtiva("emp-2");
    expect(mockBilling.promocaoAtiva).toHaveBeenCalledTimes(2);
    expect(p?.elegivel).toBe(false);
  });

  it("falha também fica guardada por um instante, para a API fora não ser martelada", async () => {
    mockBilling.promocaoAtiva.mockRejectedValue(new Error("fora"));
    expect(await buscarPromocaoAtiva("emp-3")).toBeNull();
    expect(await buscarPromocaoAtiva("emp-3")).toBeNull();
    expect(mockBilling.promocaoAtiva).toHaveBeenCalledTimes(1);
  });
});

describe("utils/promocaoPrimeiroMes", () => {
  it("datas", () => {
    expect(diaMes("2026-12-01")).toBe("01/12");
    expect(diaMes("2026-12-01T10:00:00Z")).toBe("01/12");
    expect(diaMes(null)).toBe("");
    expect(dataBR("2026-12-01")).toBe("01/12/2026");
  });

  it("prazo é lido no calendário de Brasília (31/10, não 01/11)", () => {
    expect(prazoDiaMes("2026-11-01T02:59:59.999Z")).toBe("31/10");
    expect(prazoDiaMes("lixo")).toBe("");
  });

  it("mês sem pagar é o anterior à 1ª cobrança", () => {
    expect(mesSemPagar("2026-12-01")).toBe("novembro");
    expect(mesSemPagar("2027-01-01")).toBe("dezembro");
    expect(mesSemPagar("2026-03-01")).toBe("fevereiro");
    expect(mesSemPagar("")).toBe("");
  });

  it("promocaoVale exige elegivel:true e prazo não vencido", () => {
    expect(promocaoVale(PROMO, AGORA)).toBe(true);
    expect(promocaoVale({ ...PROMO, elegivel: false }, AGORA)).toBe(false);
    expect(promocaoVale(PROMO, Date.parse("2026-11-01T03:00:00Z"))).toBe(false);
    expect(promocaoVale(null, AGORA)).toBe(false);
  });

  it("frase da faixa; sem datas legíveis cai no título do backend", () => {
    expect(fraseDaFaixa(PROMO)).toBe("Assine até 31/10 sem pagar novembro: a 1ª cobrança é só em 01/12.");
    expect(fraseDaFaixa({ ...PROMO, termina_em: "", primeira_cobranca_em: "" })).toBe(PROMO.titulo);
  });
});
