// ============================================================
// Crediário · cores por situação (25/11/2026)
// Mockup aprovado: docs/mockups/crediario-cores-e-movimento.html (seções 1–3).
//
//   - utils/crediarioSituacao: a regra única (limites de hoje, +7, +8,
//     carência dia 1–3, dia 4, resíduo de R$ 2, a conferir) e o subtítulo;
//   - SeloDaSituacao: os quatro selos, com testID e o texto aprovado;
//   - linha da parcela na aba de carnês: vermelho, âmbar, violeta, neutra;
//   - cartão do carnê: o selo Atrasado é o mesmo da carteira.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));

import {
  DIAS_A_VENCER, ROTULO_DA_SITUACAO, avisoDoVencimento, detalheDoCliente, diasParaVencer,
  situacaoDaParcelaAberta, situacaoDoCliente, situacaoDoCrediario,
} from "@/utils/crediarioSituacao";
import { daysBetween, todaySP } from "@/utils/creditOverdue";
import { SeloDaSituacao, COR_DA_SITUACAO } from "@/components/crediario/ficha/SeloDaSituacao";
import { TabParcelas } from "@/components/crediario/ficha/TabParcelas";
import { CarneCard } from "@/components/crediario/ficha/CarneCard";
import { derivarCarne } from "@/utils/crediarioCarne";
import { CorDaFicha } from "@/components/crediario/ficha/fichaStyles";
import { Colors } from "@/constants/colors";

const HOJE = "2026-11-25";

function mais(dia: string, n: number): string {
  const d = new Date(dia + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });

describe("situacaoDoCrediario — a regra", () => {
  const sit = (vencimento: string | null, extra: Record<string, any> = {}) =>
    situacaoDoCrediario({ atrasado: false, vencimento, hoje: HOJE, ...extra });

  test("DIAS_A_VENCER é 7", () => {
    expect(DIAS_A_VENCER).toBe(7);
  });
  test("vence hoje, amanhã e em +7: a vencer; +8: em dia", () => {
    expect(sit(HOJE)).toBe("a_vencer");
    expect(sit(mais(HOJE, 1))).toBe("a_vencer");
    expect(sit(mais(HOJE, 7))).toBe("a_vencer");
    expect(sit(mais(HOJE, 8))).toBe("em_dia");
    expect(sit("2027-01-22")).toBe("em_dia");
  });
  test("carência: dia 1 a 3 depois do vencimento é a vencer; dia 4 sem atraso é neutro", () => {
    expect(sit(mais(HOJE, -1))).toBe("a_vencer");
    expect(sit(mais(HOJE, -3))).toBe("a_vencer");
    expect(sit(mais(HOJE, -4))).toBe("em_dia");
  });
  test("atraso e a conferir vêm antes da data", () => {
    expect(sit(mais(HOJE, 2), { atrasado: true })).toBe("atrasado");
    expect(sit(mais(HOJE, 2), { aConferir: true })).toBe("a_conferir");
    expect(sit(mais(HOJE, 2), { atrasado: true, aConferir: true })).toBe("atrasado");
  });
  test("resíduo (quitada) e sem data: em dia", () => {
    expect(sit(HOJE, { quitada: true })).toBe("em_dia");
    expect(sit(null)).toBe("em_dia");
  });
  test("data com hora: o dia de São Paulo", () => {
    expect(diasParaVencer("2026-11-26T03:00:00.000Z", HOJE)).toBe(1);
    expect(diasParaVencer("2026-11-25T00:00:00.000Z", HOJE)).toBe(0);
    expect(diasParaVencer(null, HOJE)).toBeNull();
  });
});

describe("situacaoDaParcelaAberta — fallback local e campos do backend", () => {
  const p = (over: Record<string, any>) => ({ status: "pending", amount_due: 100, covered_amount: 0, ...over });

  test("dia 3 da carência: a vencer; dia 4: atrasado", () => {
    expect(situacaoDaParcelaAberta(p({ due_date: mais(HOJE, -3) }), HOJE)).toBe("a_vencer");
    expect(situacaoDaParcelaAberta(p({ due_date: mais(HOJE, -4) }), HOJE)).toBe("atrasado");
  });
  test("resíduo de R$ 2 não é atraso nem a vencer", () => {
    expect(situacaoDaParcelaAberta(p({ due_date: mais(HOJE, -10), covered_amount: 98 }), HOJE)).toBe("em_dia");
    expect(situacaoDaParcelaAberta(p({ due_date: mais(HOJE, 1), covered_amount: 98 }), HOJE)).toBe("em_dia");
    expect(situacaoDaParcelaAberta(p({ due_date: mais(HOJE, -10), covered_amount: 97.5 }), HOJE)).toBe("atrasado");
  });
  test("retroativa (vencida antes do cadastro): a conferir", () => {
    expect(situacaoDaParcelaAberta(p({ due_date: "2026-08-10", created_at: "2026-10-01T12:00:00Z" }), HOJE)).toBe("a_conferir");
  });
  test("o backend manda: is_overdue e needs_review", () => {
    expect(situacaoDaParcelaAberta({ due_date: mais(HOJE, 5), is_overdue: true }, HOJE)).toBe("atrasado");
    expect(situacaoDaParcelaAberta({ due_date: mais(HOJE, -20), is_overdue: false, needs_review: true }, HOJE)).toBe("a_conferir");
    expect(situacaoDaParcelaAberta({ due_date: mais(HOJE, -2), is_overdue: false, remaining: 50 }, HOJE)).toBe("a_vencer");
  });
});

describe("situacaoDoCliente — a linha da carteira", () => {
  test("atrasado pelo backend", () => {
    expect(situacaoDoCliente({ overdue: true, next_due_date: mais(HOJE, -12), balance: 569.4 }, HOJE)).toBe("atrasado");
  });
  test("a conferir: sem dívida no razão ou parcelas retroativas", () => {
    expect(situacaoDoCliente({ overdue: false, balance: 0, open_installments: 683.4, ledger_mismatch: true }, HOJE)).toBe("a_conferir");
    expect(situacaoDoCliente({ overdue: false, balance: 300, to_review_count: 2, next_due_date: "2026-08-10" }, HOJE)).toBe("a_conferir");
  });
  test("a vencer e em dia pela data mais antiga em aberto", () => {
    expect(situacaoDoCliente({ overdue: false, balance: 110, next_due_date: mais(HOJE, 1) }, HOJE)).toBe("a_vencer");
    expect(situacaoDoCliente({ overdue: false, balance: 110, next_due_date: mais(HOJE, -2) }, HOJE)).toBe("a_vencer");
    expect(situacaoDoCliente({ overdue: false, balance: 320, next_due_date: "2026-12-18" }, HOJE)).toBe("em_dia");
    expect(situacaoDoCliente({ overdue: false, balance: 50 }, HOJE)).toBe("em_dia");
  });
});

describe("textos", () => {
  test("os quatro selos", () => {
    expect(ROTULO_DA_SITUACAO).toEqual({ em_dia: "Em dia", a_vencer: "A vencer", atrasado: "Atrasado", a_conferir: "A conferir" });
  });
  test("vence hoje / vence amanhã; o resto sem aviso", () => {
    expect(avisoDoVencimento(HOJE, HOJE)).toBe("vence hoje");
    expect(avisoDoVencimento(mais(HOJE, 1), HOJE)).toBe("vence amanhã");
    expect(avisoDoVencimento(mais(HOJE, 2), HOJE)).toBeNull();
    expect(avisoDoVencimento(mais(HOJE, -1), HOJE)).toBeNull();
  });
  test("subtítulo da linha, sem cor própria", () => {
    expect(detalheDoCliente("atrasado", { diasDeAtraso: 12 }, HOJE)).toBe("maior atraso 12 dias");
    expect(detalheDoCliente("atrasado", { diasDeAtraso: 1 }, HOJE)).toBe("maior atraso 1 dia");
    expect(detalheDoCliente("atrasado", { diasDeAtraso: 0 }, HOJE)).toBe("");
    expect(detalheDoCliente("a_conferir", { conferirSaldo: true }, HOJE)).toBe("Conferir saldo");
    expect(detalheDoCliente("a_conferir", { aConferir: 2 }, HOJE)).toBe("2 a conferir");
    expect(detalheDoCliente("a_vencer", { vencimento: mais(HOJE, 1) }, HOJE)).toBe("vence amanhã");
    expect(detalheDoCliente("a_vencer", { vencimento: "2026-11-30" }, HOJE)).toBe("vence 30/11");
    expect(detalheDoCliente("a_vencer", { vencimento: "2026-11-23" }, HOJE)).toBe("venceu 23/11");
    expect(detalheDoCliente("em_dia", { vencimento: "2026-12-18" }, HOJE)).toBe("próx. 18/12");
    expect(detalheDoCliente("em_dia", { vencimento: "2026-09-01" }, HOJE)).toBe("");
  });
});

describe("SeloDaSituacao", () => {
  test.each([
    ["em_dia", "Em dia"], ["a_vencer", "A vencer"], ["atrasado", "Atrasado"], ["a_conferir", "A conferir"],
  ] as const)("%s → %s, com o tom de contraste", (situacao, rotulo) => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<SeloDaSituacao situacao={situacao} />); });
    const selo = porId(t, `crediario-selo-${situacao}`);
    expect(selo).toHaveLength(1);
    expect(texto(t.toJSON())).toBe(rotulo);
    const txt = t.root.findAll((n: any) => n.type === "Text" || (n.props && n.props.numberOfLines === 1))[0];
    expect(JSON.stringify(txt.props.style)).toContain(COR_DA_SITUACAO[situacao].texto);
  });
  test("cores: tokens de colors e de contraste da ficha", () => {
    expect(COR_DA_SITUACAO.atrasado).toEqual({ ponto: Colors.red, texto: CorDaFicha.vermelhoTexto, fundo: Colors.redD });
    expect(COR_DA_SITUACAO.a_vencer).toEqual({ ponto: Colors.amber, texto: CorDaFicha.ambarTexto, fundo: Colors.amberD });
    expect(COR_DA_SITUACAO.a_conferir).toEqual({ ponto: Colors.violet, texto: CorDaFicha.violetaTexto, fundo: Colors.violetD });
    expect(COR_DA_SITUACAO.em_dia).toEqual({ ponto: Colors.green, texto: CorDaFicha.verdeTexto, fundo: Colors.greenD });
  });
});

// ── Linha da parcela (hoje de verdade: a TabParcelas usa o relógio) ──────
const parcela = (over: Record<string, any> = {}) => ({
  id: "a3", sale_id: null, customer_id: "cli", company_id: "emp",
  installment_number: 1, total_installments: 3, amount_due: 110, amount_paid: 0, covered_amount: 0,
  due_date: "2099-01-22", paid_at: null, status: "pending", pix_link: null, late_fee: 0, late_interest: 0,
  collection_stage: 0, account_id: "c1", is_overdue: false, needs_review: false,
  ...over,
});
const CONTA = {
  id: "c1", name: "Compra de 22/10", status: "open", balance: 330, remaining: 330, open_count: 3,
  next_due_date: null, overdue: false, period_unit: "month", period_count: 1,
  purchases: [], total_amount: 330, total_count: 3, paid_count: 0,
};
function montarAba(openInst: any[], conta: any = CONTA) {
  const props = {
    accounts: [conta], openInst, instByAccount: new Map(), useCarneLayout: true,
    handleCreateAccount: jest.fn(), showNewAccount: false, setShowNewAccount: jest.fn(),
    newAccountName: "", setNewAccountName: jest.fn(), creatingAccount: false,
    expandedAccountId: undefined as any, setExpandedAccountId: jest.fn(),
    handleEditDueDateOpen: jest.fn(), onRenegociar: jest.fn(), openInstallmentPix: jest.fn(),
    onImprimir: jest.fn(), prefill: jest.fn(), openBalance: 330,
    companyId: "emp", customerId: "cli", phone: "66999990000", onCobrar: jest.fn(), name: "Carla",
  };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<TabParcelas {...(props as any)} />); });
  return t;
}

describe("linha da parcela na ficha", () => {
  const hoje = todaySP();
  test("atrasada vermelha, amanhã âmbar com 'vence amanhã', distante neutra com o círculo verde", () => {
    const t = montarAba([
      parcela({ id: "p1", installment_number: 1, due_date: mais(hoje, -12), is_overdue: true, days_late: 12 }),
      parcela({ id: "p2", installment_number: 2, due_date: mais(hoje, 1) }),
      parcela({ id: "p3", installment_number: 3, due_date: mais(hoje, 60) }),
    ]);
    expect(porId(t, "parcela-1 de 3-atrasado")).toHaveLength(1);
    expect(porId(t, "parcela-2 de 3-a_vencer")).toHaveLength(1);
    expect(porId(t, "parcela-3 de 3-em_dia")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("vence amanhã");
    const fundo = (n: string) => JSON.stringify(porId(t, `parcela-${n}`)[0].props.style);
    expect(fundo("1 de 3")).toContain(Colors.redD);
    expect(fundo("2 de 3")).toContain(Colors.amberD);
    expect(fundo("3 de 3")).not.toContain(Colors.amberD);
    expect(fundo("3 de 3")).not.toContain(Colors.redD);
    expect(JSON.stringify(porId(t, "parcela-3 de 3-em_dia")[0].props.style)).toContain(Colors.green);
  });
  test("vence hoje e dentro da carência: âmbar; a conferir: violeta", () => {
    const t = montarAba([
      parcela({ id: "p1", installment_number: 1, due_date: mais(hoje, -2) }),
      parcela({ id: "p2", installment_number: 2, due_date: hoje }),
      parcela({ id: "p3", installment_number: 3, due_date: mais(hoje, 20) }),
    ]);
    expect(porId(t, "parcela-1 de 3-a_vencer")).toHaveLength(1);
    expect(porId(t, "parcela-2 de 3-a_vencer")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("vence hoje");
    const t2 = montarAba([parcela({ id: "p9", due_date: "2026-01-10", needs_review: true })]);
    expect(porId(t2, "parcela-1 de 1-a_conferir")).toHaveLength(1);
    expect(JSON.stringify(porId(t2, "parcela-1 de 1")[0].props.style)).toContain(Colors.violetD);
  });
  test("a vencer em 7 dias; em 8 já neutra", () => {
    expect(daysBetween(hoje, mais(hoje, 8))).toBe(8);
    const t = montarAba([
      parcela({ id: "p1", installment_number: 1, due_date: mais(hoje, 7) }),
      parcela({ id: "p2", installment_number: 2, due_date: mais(hoje, 8) }),
    ]);
    expect(porId(t, "parcela-1 de 2-a_vencer")).toHaveLength(1);
    expect(porId(t, "parcela-2 de 2-em_dia")).toHaveLength(1);
  });
});

describe("cartão do carnê", () => {
  test("Atrasado é o selo da carteira; em dia sem selo (decisão de 23/11)", () => {
    const abertas = [parcela({ due_date: "2026-01-10", is_overdue: true })];
    const c = derivarCarne({ ...CONTA, overdue: true } as any, abertas as any);
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <CarneCard carne={c as any} renderParcela={() => null} onReceber={jest.fn()} onImprimir={jest.fn()} />,
      );
    });
    expect(porId(t, "carne-c1-atrasado")).toHaveLength(1);
    expect(porId(t, "carne-c1-atrasado")[0].props.situacao).toBe("atrasado");
    const emDia = derivarCarne(CONTA as any, [parcela()] as any);
    let t2!: renderer.ReactTestRenderer;
    act(() => {
      t2 = renderer.create(
        <CarneCard carne={emDia as any} renderParcela={() => null} onReceber={jest.fn()} onImprimir={jest.fn()} />,
      );
    });
    expect(porId(t2, "carne-c1-atrasado")).toHaveLength(0);
    expect(texto(t2.toJSON())).not.toContain("Em dia");
  });
});
