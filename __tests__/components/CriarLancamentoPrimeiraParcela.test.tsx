// ============================================================
// Novo lançamento do crediário · "Primeira parcela em" (13/10/2026)
//
// Aura-backend#816: a primeira parcela pode cair a até first_due_date_max_days
// (90) dias à frente — vender em dezembro com a 1ª parcela em janeiro.
//   - o campo "Primeira parcela em" tem o atalho "Janeiro" em nov/dez
//     (dia 10, ou o dia que a lojista já tinha escolhido, em janeiro);
//   - a janela vem de GET /credit/plan-config e só AVISA (o /manual-entry
//     aceita qualquer data: compra antiga, carnê digitalizado);
//   - os erros 422/400 da API viram frase na tela, junto do campo;
//   - a tela Pronto mostra as datas que o servidor devolveu.
// Mesmo padrão de mocks do CriarLancamentoRedesenho.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/anim", () => ({
  Collapsible: ({ open, children }: any) => (open ? children : null),
}));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: (props: any) => (props.visible ? props.children : null),
}));

const mockCreate = jest.fn();
const mockPlanConfig = jest.fn();
jest.mock("@/services/creditApi", () => ({
  MAX_INSTALLMENTS_CEILING: 500,
  printCarne: jest.fn(),
  creditApi: {
    createManualEntry: (...a: any[]) => mockCreate(...a),
    getPlanConfig: (...a: any[]) => mockPlanConfig(...a),
    searchCustomers: jest.fn().mockResolvedValue({ customers: [] }),
    getCustomerHistory: jest.fn().mockResolvedValue({ accounts: [] }),
  },
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "emp-1" } }) }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";
import {
  avisoDaPrimeiraParcela, janeiroDoProximoAno, mensagemDoErroDePrimeiraParcela, mostrarAtalhoJaneiro,
} from "@/components/crediario/lancamento/calculos";
import { toast } from "@/components/Toast";

type T = renderer.ReactTestRenderer;
const porId = (t: T, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const existe = (t: T, id: string) => porId(t, id).length > 0;
const apertar = (t: T, id: string) => act(() => { porId(t, id)[0].props.onPress(); });
const digitar = (t: T, id: string, v: string) => act(() => { porId(t, id)[0].props.onChangeText(v); });
const valorDe = (t: T, id: string) => porId(t, id)[0].props.value;
const textoEm = (t: T, id?: string) => {
  const raiz = id ? porId(t, id)[0] : t.root;
  return raiz.findAllByType(Text).map((n) => [].concat(n.props.children).filter((c) => typeof c === "string" || typeof c === "number").join("")).join(" | ");
};
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

const CLIENTES = [{ id: "c1", name: "Maria Souza", phone: "(66) 99645-6351", balance: 0, overdue: false }];

/** Só o relógio é falso: timers e promises seguem reais. */
function hoje(isoUtc: string) {
  jest.useFakeTimers({
    now: new Date(isoUtc),
    doNotFake: [
      "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "performance", "hrtime",
    ],
  });
}

async function abrirPasso2() {
  let t!: T;
  act(() => { t = renderer.create(<CriarLancamentoModal visible onClose={jest.fn()} recentes={CLIENTES as any} />); });
  apertar(t, "lancamento-recente-c1");
  await flush();
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlanConfig.mockResolvedValue({ company_id: "emp-1", first_due_date_max_days: 90 });
  mockCreate.mockResolvedValue({ customer: { id: "c1", name: "Maria Souza" }, installments: [], new_balance: 140, account_id: "acc-1" });
});
afterEach(() => { jest.useRealTimers(); });

describe("atalho 'Janeiro'", () => {
  it("só aparece de 01/11 a 31/12", async () => {
    const casos: Array<[string, boolean]> = [
      ["2026-10-31T15:00:00Z", false],
      ["2026-11-01T15:00:00Z", true],
      ["2026-12-31T15:00:00Z", true],
      ["2027-01-01T15:00:00Z", false],
    ];
    for (const [dia, aparece] of casos) {
      hoje(dia);
      const t = await abrirPasso2();
      expect(existe(t, "lancamento-venc-janeiro")).toBe(aparece);
      t.unmount();
      jest.useRealTimers();
    }
  });

  it("põe o dia 10 de janeiro do ano que vem e manda first_due_date no payload", async () => {
    hoje("2026-11-20T15:00:00Z");
    const t = await abrirPasso2();
    expect(textoEm(t)).toContain("Primeira parcela em");
    // padrão do formulário: hoje + 1 mês
    expect(valorDe(t, "lancamento-vencimento")).toBe("20/12/2026");

    apertar(t, "lancamento-venc-janeiro");
    expect(valorDe(t, "lancamento-vencimento")).toBe("10/01/2027");

    digitar(t, "lancamento-valor", "42000");
    apertar(t, "lancamento-parcelas-3");
    apertar(t, "lancamento-criar");
    await flush();
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ amount: 420, installments: 3, first_due_date: "2027-01-10" });
    t.unmount();
  });

  it("se a lojista já escolheu um dia, mantém o dia em janeiro", async () => {
    hoje("2026-12-05T15:00:00Z");
    const t = await abrirPasso2();
    digitar(t, "lancamento-vencimento", "25/12/2026");
    apertar(t, "lancamento-venc-janeiro");
    expect(valorDe(t, "lancamento-vencimento")).toBe("25/01/2027");
    t.unmount();
  });
});

describe("aviso da janela", () => {
  it("busca first_due_date_max_days uma vez, ao chegar nos valores", async () => {
    hoje("2026-11-20T15:00:00Z");
    const t = await abrirPasso2();
    expect(mockPlanConfig).toHaveBeenCalledTimes(1);
    expect(mockPlanConfig).toHaveBeenCalledWith("emp-1");
    t.unmount();
  });

  it("depois da janela só avisa (não trava): o servidor é quem recusa", async () => {
    hoje("2026-11-20T15:00:00Z");
    const t = await abrirPasso2();
    expect(existe(t, "lancamento-vencimento-aviso")).toBe(false);

    digitar(t, "lancamento-vencimento", "20/03/2027");
    expect(textoEm(t, "lancamento-vencimento-aviso")).toBe("Mais de 90 dias à frente (até 18/02/2027). Confira o ano.");

    digitar(t, "lancamento-valor", "10000");
    apertar(t, "lancamento-criar");
    await flush();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ first_due_date: "2027-03-20" });
    t.unmount();
  });

  it("sem a janela do plan-config (backend antigo ou falha) não avisa nada", async () => {
    hoje("2026-11-20T15:00:00Z");
    mockPlanConfig.mockRejectedValue(new Error("boom"));
    const t = await abrirPasso2();
    digitar(t, "lancamento-vencimento", "20/03/2027");
    expect(existe(t, "lancamento-vencimento-aviso")).toBe(false);
    t.unmount();
  });

  it("compra de hoje com a 1ª parcela no passado avisa que nasce vencida", async () => {
    hoje("2026-11-20T15:00:00Z");
    const t = await abrirPasso2();
    digitar(t, "lancamento-vencimento", "01/11/2026");
    expect(textoEm(t, "lancamento-vencimento-aviso")).toBe("Essa data já passou — a parcela nasce vencida.");
    t.unmount();
  });

  it("data inteira mas inexistente é erro visível", async () => {
    hoje("2026-11-20T15:00:00Z");
    const t = await abrirPasso2();
    digitar(t, "lancamento-vencimento", "31/02/2027");
    expect(textoEm(t, "lancamento-vencimento-aviso")).toBe("Data inválida — use dd/mm/aaaa.");
    t.unmount();
  });
});

describe("erros da API", () => {
  async function criarComErro(corpo: any) {
    hoje("2026-11-20T15:00:00Z");
    mockCreate.mockRejectedValue({ status: 422, message: "Erro HTTP 422", data: corpo });
    const t = await abrirPasso2();
    digitar(t, "lancamento-valor", "10000");
    apertar(t, "lancamento-criar");
    await flush();
    return t;
  }

  it("422 FIRST_DUE_DATE_TOO_FAR: diz o limite e a data, junto do campo, e some ao mudar a data", async () => {
    const t = await criarComErro({ error: "x", code: "FIRST_DUE_DATE_TOO_FAR", max_days: 90, max_date: "2027-02-18" });
    const frase = "A primeira parcela pode ser até 90 dias a partir de hoje (18/02/2027).";
    expect(toast.error).toHaveBeenCalledWith(frase);
    expect(textoEm(t, "lancamento-vencimento-aviso")).toBe(frase);
    // ainda no passo dos valores, sem perder o que foi digitado
    expect(valorDe(t, "lancamento-valor")).toBe("100,00");

    digitar(t, "lancamento-vencimento", "10/01/2027");
    expect(existe(t, "lancamento-vencimento-aviso")).toBe(false);
    t.unmount();
  });

  it("422 FIRST_DUE_DATE_PAST e 400 FIRST_DUE_DATE_INVALID", async () => {
    let t = await criarComErro({ code: "FIRST_DUE_DATE_PAST" });
    expect(textoEm(t, "lancamento-vencimento-aviso")).toContain("não pode ser em uma data que já passou");
    t.unmount();
    jest.useRealTimers();

    t = await criarComErro({ code: "FIRST_DUE_DATE_INVALID" });
    expect(textoEm(t, "lancamento-vencimento-aviso")).toBe("Data da primeira parcela inválida — use dd/mm/aaaa.");
    t.unmount();
  });

  it("outro erro segue como antes: toast com a mensagem do servidor, sem texto no campo", async () => {
    hoje("2026-11-20T15:00:00Z");
    mockCreate.mockRejectedValue({ status: 500, message: "Falha nossa", data: {} });
    const t = await abrirPasso2();
    digitar(t, "lancamento-valor", "10000");
    apertar(t, "lancamento-criar");
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Falha nossa");
    expect(existe(t, "lancamento-vencimento-aviso")).toBe(false);
    t.unmount();
  });
});

describe("tela Pronto", () => {
  it("mostra a 1ª parcela com ano e os vencimentos devolvidos pelo servidor", async () => {
    hoje("2026-11-20T15:00:00Z");
    mockCreate.mockResolvedValue({
      customer: { id: "c1", name: "Maria Souza" },
      installments: [
        { due_date: "2027-01-10T00:00:00.000Z", amount_due: 140 },
        { due_date: "2027-02-10T00:00:00.000Z", amount_due: 140 },
        { due_date: "2027-03-10T00:00:00.000Z", amount_due: 140 },
      ],
      new_balance: 420, account_id: "acc-1",
    });
    const t = await abrirPasso2();
    apertar(t, "lancamento-venc-janeiro");
    digitar(t, "lancamento-valor", "42000");
    apertar(t, "lancamento-parcelas-3");
    apertar(t, "lancamento-criar");
    await flush();

    const pronto = textoEm(t, "lancamento-pronto");
    expect(pronto).toContain("1ª parcela | 10/01/2027");
    expect(pronto).toContain("Vencimentos | 10/01 · 10/02 · 10/03");
    t.unmount();
  });

  it("resposta só com due_dates[] também mostra as datas do servidor", async () => {
    hoje("2026-11-20T15:00:00Z");
    mockCreate.mockResolvedValue({
      customer: { id: "c1", name: "Maria Souza" }, installments: [],
      first_due_date: "2027-01-10", due_dates: ["2027-01-10", "2027-02-10"], new_balance: 200, account_id: "acc-1",
    });
    const t = await abrirPasso2();
    // o formulário diz 20/12; o servidor gravou 10/01 — vale o do servidor
    digitar(t, "lancamento-valor", "20000");
    apertar(t, "lancamento-parcelas-2");
    apertar(t, "lancamento-criar");
    await flush();
    const pronto = textoEm(t, "lancamento-pronto");
    expect(pronto).toContain("1ª parcela | 10/01/2027");
    expect(pronto).toContain("Vencimentos | 10/01 · 10/02");
    t.unmount();
  });
});

describe("funções puras", () => {
  it("mostrarAtalhoJaneiro: novembro e dezembro", () => {
    expect(mostrarAtalhoJaneiro("2026-10-31")).toBe(false);
    expect(mostrarAtalhoJaneiro("2026-11-01")).toBe(true);
    expect(mostrarAtalhoJaneiro("2026-12-31")).toBe(true);
    expect(mostrarAtalhoJaneiro("2027-01-01")).toBe(false);
  });

  it("janeiroDoProximoAno: dia 10 por padrão, outro dia quando informado, encosta em 31", () => {
    expect(janeiroDoProximoAno("2026-11-20")).toBe("10/01/2027");
    expect(janeiroDoProximoAno("2026-12-31")).toBe("10/01/2027");
    expect(janeiroDoProximoAno("2026-12-05", 25)).toBe("25/01/2027");
    expect(janeiroDoProximoAno("2026-12-05", 31)).toBe("31/01/2027");
    expect(janeiroDoProximoAno("2026-12-05", 45)).toBe("31/01/2027");
    expect(janeiroDoProximoAno("2026-12-05", NaN)).toBe("10/01/2027");
    // em janeiro, "Janeiro" é deste ano
    expect(janeiroDoProximoAno("2027-01-04")).toBe("10/01/2027");
  });

  it("avisoDaPrimeiraParcela", () => {
    const base = { maxDias: 90, hojeIso: "2026-11-20", compraBr: "20/11/2026" };
    expect(avisoDaPrimeiraParcela("", base)).toBeNull();
    expect(avisoDaPrimeiraParcela("20/1", base)).toBeNull();                       // ainda digitando
    expect(avisoDaPrimeiraParcela("10/01/2027", base)).toBeNull();                 // dentro da janela
    expect(avisoDaPrimeiraParcela("18/02/2027", base)).toBeNull();                 // 90 dias, na borda
    expect(avisoDaPrimeiraParcela("19/02/2027", base)).toMatchObject({ bloqueia: false });
    expect(avisoDaPrimeiraParcela("20/11/2026", base)).toBeNull();                 // hoje
    expect(avisoDaPrimeiraParcela("19/11/2026", base)).toMatchObject({ bloqueia: false });
    // compra retroativa: a 1ª parcela no passado é o normal, sem aviso
    expect(avisoDaPrimeiraParcela("15/09/2026", { ...base, compraBr: "01/09/2026" })).toBeNull();
    expect(avisoDaPrimeiraParcela("31/02/2027", base)).toMatchObject({ bloqueia: true });
    // sem janela conhecida só o passado e o formato contam
    expect(avisoDaPrimeiraParcela("20/03/2028", { ...base, maxDias: null })).toBeNull();
  });

  it("mensagemDoErroDePrimeiraParcela lê data.code (ou code) e ignora o resto", () => {
    expect(mensagemDoErroDePrimeiraParcela({ data: { code: "FIRST_DUE_DATE_TOO_FAR", max_days: 90, max_date: "2027-02-18" } }))
      .toBe("A primeira parcela pode ser até 90 dias a partir de hoje (18/02/2027).");
    expect(mensagemDoErroDePrimeiraParcela({ data: { code: "FIRST_DUE_DATE_TOO_FAR" } }))
      .toBe("A primeira parcela pode ser dentro da janela permitida.");
    expect(mensagemDoErroDePrimeiraParcela({ code: "FIRST_DUE_DATE_PAST" })).toContain("já passou");
    expect(mensagemDoErroDePrimeiraParcela({ data: { code: "OUTRA" } })).toBeNull();
    expect(mensagemDoErroDePrimeiraParcela(null)).toBeNull();
  });
});
