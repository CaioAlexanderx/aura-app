// ============================================================
// Ficha do crediário · cartão do carnê e aba de carnês (10/10/2026)
//
// CarneCard (F4, 23/11/2026: sem sanfona — o cartão está sempre aberto):
//   - nome, itens, "Falta R$ X de R$ Y", barra, parcelas a pagar direto;
//   - pagas numa linha só que abre com toque (com os itens da compra);
//   - Imprimir à vista; Mudar as parcelas e Receber o carnê inteiro no ⋯;
//   - fiado (sem parcelas): sem barra, com o aviso, sem Renegociar;
//   - backend antigo: nome, saldo e parcelas, sem quebrar.
// TabParcelas:
//   - um cartão por carnê em aberto, "Compras sem carnê" e Quitados
//     recolhido; Receber do cartão mira o carnê dele; Imprimir todos.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// Icon puxa react-native-svg, que não carrega no Jest.
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));

import { Text } from "react-native";
import { CarneCard } from "@/components/crediario/ficha/CarneCard";
import { TabParcelas } from "@/components/crediario/ficha/TabParcelas";
import { derivarCarne } from "@/utils/crediarioCarne";

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const apertarRotulo = (t: renderer.ReactTestRenderer, rotulo: string) =>
  act(() => { t.root.findAllByProps({ accessibilityLabel: rotulo }, { deep: false })[0].props.onPress(); });

const parcela = (over: Record<string, any> = {}) => ({
  id: "a3", sale_id: null, customer_id: "cli", company_id: "emp",
  installment_number: 3, total_installments: 4, amount_due: 70, amount_paid: 0, covered_amount: 0,
  due_date: "2026-11-10", paid_at: null, status: "pending", pix_link: null, late_fee: 0, late_interest: 0,
  collection_stage: 0, account_id: "c1", is_overdue: false, needs_review: false,
  ...over,
});

const CONTA = {
  id: "c1", name: "Compra de 13/09", status: "open", balance: 280, open_count: 2,
  next_due_date: "2026-11-10", overdue: false, period_unit: "month", period_count: 1,
  purchases: [
    { date: "2026-09-13T15:00:00Z", description: "Vans Hylane 40/41", quantity: 1, amount: 120, manual: false },
    { date: "2026-09-13T15:00:00Z", description: "Slide Alta 40/41", quantity: 2, amount: 160, manual: false },
  ],
  purchases_total: 280, total_amount: 280, refunded_total: 0, total_count: 4, paid_count: 2,
  paid_installments: [
    { id: "pg1", installment_number: 1, total_installments: 4, due_date: "2026-09-13", paid_at: "2026-09-13T15:00:00Z", amount: 70 },
    { id: "pg2", installment_number: 2, total_installments: 4, due_date: "2026-10-10", paid_at: "2026-10-08T14:00:00Z", amount: 70 },
  ],
  open_remaining: 140, unscheduled: 0, remaining: 140,
} as any;

function montarCartao(conta: any, parcelas: any[], props: Record<string, any> = {}) {
  const all = {
    carne: derivarCarne(conta, parcelas),
    onReceber: jest.fn(), onImprimir: jest.fn(), onRenegociar: jest.fn(), onCobrar: jest.fn(),
    renderParcela: (p: any) => <Text key={p.id}>{`[parcela ${p.installment_number}/${p.total_installments}]`}</Text>,
    ...props,
  };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<CarneCard {...(all as any)} />); });
  return { t, props: all };
}

describe("CarneCard (F4: sem sanfona)", () => {
  const abertas = [parcela(), parcela({ id: "a4", installment_number: 4, due_date: "2026-12-10" })];

  it("aberto sempre: nome, itens, Falta de quanto, barra e as parcelas a pagar", () => {
    const { t } = montarCartao(CONTA, abertas);
    const txt = texto(t.toJSON());
    expect(txt).toContain("Compra de 13/09");
    expect(txt).toContain("Vans Hylane 40/41 · 2× Slide Alta 40/41");
    expect(txt).toContain("Falta R$ 140,00");
    expect(txt).toContain("de R$ 280,00");
    expect(txt).toContain("2 de 4 pagas");
    expect(porId(t, "carne-c1-progresso")).toHaveLength(1);
    expect(txt).toContain("[parcela 3/4]");
    expect(txt).toContain("[parcela 4/4]");
    // o selo "Em dia" saiu (repetia o topo)
    expect(txt).not.toContain("Em dia");
  });

  it("parcelas pagas numa linha só, que abre com toque junto com os itens", () => {
    const { t } = montarCartao(CONTA, abertas);
    expect(texto(t.toJSON())).toContain("2 pagas · 13/09 e 08/10");
    expect(porId(t, "carne-c1-corpo")).toHaveLength(0);
    act(() => { porId(t, "carne-c1-detalhe")[0].props.onPress(); });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Itens da compra");
    expect(txt).toContain("Total da compra");
    expect(txt).toContain("Parcela 1 de 4 · paga em 13/09");
    expect(porId(t, "carne-c1-paga")).toHaveLength(2);
  });

  it("Imprimir à vista; o raro no ⋯ (Mudar as parcelas, Receber o carnê inteiro)", () => {
    const { t, props } = montarCartao(CONTA, abertas);
    apertarRotulo(t, "Imprimir");
    expect(props.onImprimir).toHaveBeenCalled();
    expect(porId(t, "carne-c1-menu")).toHaveLength(0);
    act(() => { porId(t, "carne-c1-mais")[0].props.onPress(); });
    apertarRotulo(t, "Mudar as parcelas (renegociar)");
    expect(props.onRenegociar).toHaveBeenCalled();
    act(() => { porId(t, "carne-c1-mais")[0].props.onPress(); });
    apertarRotulo(t, "Receber o carnê inteiro");
    expect(props.onReceber).toHaveBeenCalled();
    // um Cobrar só, no alto da ficha — o carnê não cobra.
    expect(t.root.findAllByProps({ accessibilityLabel: "Cobrar" })).toHaveLength(0);
  });

  it("em atraso: selo Atrasado", () => {
    const { t } = montarCartao({ ...CONTA, overdue: true }, abertas);
    expect(texto(t.toJSON())).toContain("Atrasado");
  });

  it("fiado num carnê: sem barra, com o aviso e o Receber à vista", () => {
    const fiado = { ...CONTA, total_count: 0, paid_count: 0, paid_installments: [], remaining: 220 };
    const { t } = montarCartao(fiado, [], { onRenegociar: undefined });
    const txt = texto(t.toJSON());
    expect(porId(t, "carne-c1-progresso")).toHaveLength(0);
    expect(porId(t, "carne-c1-sem-parcelas")).toHaveLength(1);
    expect(txt).toContain("Sem parcelas — à vista no crediário");
    expect(txt).toContain("Receber R$ 220,00");
  });

  it("backend antigo: nome, saldo e parcelas — sem itens, sem barra", () => {
    const antigo = { id: "c1", name: "Carnê da Maria", status: "open", balance: 140, open_count: 2, next_due_date: "2026-11-10", overdue: false, period_unit: "month", period_count: 1 };
    const { t } = montarCartao(antigo, abertas);
    const txt = texto(t.toJSON());
    expect(txt).toContain("Carnê da Maria");
    expect(txt).toContain("Falta R$ 140,00");
    expect(porId(t, "carne-c1-progresso")).toHaveLength(0);
    expect(txt).toContain("[parcela 3/4]");
  });

  it("grupo sem carnê com fiado: Compras sem carnê, Receber e Dividir em parcelas à vista", () => {
    const geral = {
      id: null, name: "Conta geral", balance: 180, remaining: 180, total_count: 0, paid_count: 0,
      purchases: [
        { date: "2026-09-13T15:00:00Z", description: "Slide Asuna 40/41", quantity: 1, amount: 80 },
        { date: "2026-09-02T12:00:00Z", description: "", quantity: 1, amount: 100, manual: true },
      ],
    };
    const { t, props } = montarCartao(geral, [], { renegociarLabel: "Dividir em parcelas" });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Compras sem carnê");
    expect(txt).toContain("Compras sem parcelas definidas.");
    expect(txt).toContain("Você pode receber qualquer valor, ou dividir esse saldo em parcelas.");
    apertarRotulo(t, "Dividir em parcelas");
    expect(props.onRenegociar).toHaveBeenCalled();
    act(() => { porId(t, "carne-general-detalhe")[0].props.onPress(); });
    expect(texto(t.toJSON())).toContain("02/09 · Lançamento manual");
  });
});

describe("TabParcelas — aba de carnês", () => {
  function montarAba(over: Record<string, any> = {}) {
    const props = {
      accounts: [
        CONTA,
        { ...CONTA, id: "c2", name: "Compra de 02/08", remaining: 0, paid_count: 4, total_amount: 80, purchases: [{ date: "2026-08-02T12:00:00Z", description: "Slide Alta 42/43", quantity: 1, amount: 80 }] },
        { id: null, name: "Conta geral", status: "open", balance: 50, remaining: 50, total_count: 0, paid_count: 0, purchases: [], overdue: false, open_count: 0, next_due_date: null, period_unit: "month", period_count: 1 },
      ],
      openInst: [parcela(), parcela({ id: "a4", installment_number: 4, due_date: "2026-12-10" })],
      instByAccount: new Map(),
      useCarneLayout: true,
      handleCreateAccount: jest.fn(), showNewAccount: false, setShowNewAccount: jest.fn(),
      newAccountName: "", setNewAccountName: jest.fn(), creatingAccount: false,
      expandedAccountId: undefined as any, setExpandedAccountId: jest.fn(),
      handleEditDueDateOpen: jest.fn(), onRenegociar: jest.fn(), openInstallmentPix: jest.fn(),
      onImprimir: jest.fn(), prefill: jest.fn(), openBalance: 190,
      companyId: "emp", customerId: "cli", phone: "66999990000", onCobrar: jest.fn(), name: "Alexander Olivier",
      ...over,
    };
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<TabParcelas {...(props as any)} />); });
    return { t, props };
  }

  it("um cartão por carnê em aberto, Compras sem carnê e Quitados recolhido", () => {
    const { t } = montarAba();
    const txt = texto(t.toJSON());
    expect(porId(t, "carne-c1")).toHaveLength(1);
    expect(porId(t, "carne-general")).toHaveLength(1);
    expect(porId(t, "carne-c2")).toHaveLength(0);
    expect(txt).toContain("1 carnê quitado");
    expect(porId(t, "carne-quitado")).toHaveLength(0);
    act(() => { porId(t, "carnes-quitados-toggle")[0].props.onPress(); });
    expect(porId(t, "carne-quitado")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("Compra de 02/08 · Slide Alta 42/43");
  });

  it("parcelas a pagar direto, sem sanfona: data com lápis e Receber na linha", () => {
    const { t, props } = montarAba();
    const txt = texto(t.toJSON());
    expect(txt).toContain("3 de 4");
    expect(txt).toContain("vence 10/11");
    // nada de Pix nem "Alterar data" na linha (o Pix está no Receber pagamento)
    expect(txt).not.toContain("Alterar data");
    expect(t.root.findAllByProps({ accessibilityLabel: "Pix" })).toHaveLength(0);
    apertarRotulo(t, "Mudar a data da parcela 3 de 4");
    expect(props.handleEditDueDateOpen).toHaveBeenCalled();
    apertarRotulo(t, "Receber R$ 70,00 da parcela 3 de 4");
    expect(props.prefill).toHaveBeenCalledWith(70);
  });

  it("Receber o carnê inteiro mira o carnê; Imprimir e Mudar as parcelas levam o carnê", () => {
    const { t, props } = montarAba();
    act(() => { porId(t, "carne-c1-mais")[0].props.onPress(); });
    apertarRotulo(t, "Receber o carnê inteiro");
    expect(props.prefill).toHaveBeenCalledWith(140, "c1");
    apertarRotulo(t, "Imprimir");
    expect(props.onImprimir).toHaveBeenCalledWith("c1", "Compra de 13/09", 2);
    act(() => { porId(t, "carne-c1-mais")[0].props.onPress(); });
    apertarRotulo(t, "Mudar as parcelas (renegociar)");
    expect(props.onRenegociar).toHaveBeenCalledWith("c1", "Compra de 13/09", 140);
    // 23/11/2026: um Cobrar só, no alto da ficha — o cartão não tem mais.
    expect(t.root.findAllByProps({ accessibilityLabel: "Cobrar" })).toHaveLength(0);
    expect(props.onCobrar).not.toHaveBeenCalled();
  });

  it("Compras sem carnê sem parcela: Receber sem mirar carnê e Dividir em parcelas", () => {
    const { t, props } = montarAba();
    apertarRotulo(t, "Dividir em parcelas");
    expect(props.onRenegociar).toHaveBeenCalledWith(null, "Saldo em aberto", 50);
    expect(texto(t.toJSON())).toContain("Compras sem parcelas definidas.");
    expect(texto(t.toJSON())).toContain("Você pode receber qualquer valor, ou dividir esse saldo em parcelas.");
    act(() => { t.root.findAll((n: any) => n.props && n.props.accessibilityLabel === "Receber R$ 50,00")[0].props.onPress(); });
    expect(props.prefill).toHaveBeenCalledWith(50, undefined);
  });

  it("Imprimir todos, Juntar e Criar carnê vazio saíram da aba (moram no ⋯ do alto da ficha)", () => {
    const { t } = montarAba({ onJuntar: jest.fn() });
    expect(porId(t, "carnes-imprimir-todos")).toHaveLength(0);
    expect(porId(t, "carnes-juntar")).toHaveLength(0);
    expect(porId(t, "carnes-novo-carne")).toHaveLength(0);
    // o campo do carnê vazio continua aqui quando o shell pede
    const { t: t2 } = montarAba({ showNewAccount: true });
    expect(t2.root.findAll((n: any) => n.props && n.props.placeholder === "Nome do carnê").length).toBeGreaterThan(0);
  });

  it("parcela atrasada: dias de atraso antes da multa e juros, e o ano só fora do ano corrente", () => {
    const { dataDoVencimento, diaEmSaoPaulo } = require("@/utils/crediarioMovimentacao");
    const atrasada = parcela({
      id: "a9", due_date: "2026-11-02", is_overdue: true, days_late: 19,
      amount_due: 80, remaining: 80, charges_total: 2.11, total_due: 82.11,
    });
    const { t } = montarAba({ accounts: [], useCarneLayout: false, openInst: [atrasada] });
    const venc = dataDoVencimento("2026-11-02", diaEmSaoPaulo(new Date().toISOString()));
    expect(texto(t.toJSON())).toContain(`venceu ${venc} · 19 dias de atraso · R$ 80,00 + R$ 2,11 de multa e juros`);
    expect(dataDoVencimento("2027-12-20", "2026-11-23")).toBe("20/12/27");
  });

  it("backend antigo sem carnê: a lista de parcelas de sempre", () => {
    const { t } = montarAba({ accounts: [], useCarneLayout: false });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Parcelas em aberto");
    expect(txt).not.toContain("Em aberto ·");
    expect(txt).toContain("Parcela 3 de 4");
  });
});
