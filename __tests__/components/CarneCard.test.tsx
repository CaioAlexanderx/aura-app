// ============================================================
// Ficha do crediário · cartão do carnê e aba de carnês (10/10/2026)
//
// CarneCard:
//   - fechado: nome, itens, quanto falta, barra, "N de M pagas", chip;
//     o corpo (itens, parcelas, ações) não está na tela;
//   - aberto: itens com total, parcelas pagas, parcelas a pagar pelo
//     renderParcela, Receber/Imprimir/Renegociar/Cobrar;
//   - fiado (sem parcelas): sem barra, com o aviso, sem Renegociar;
//   - backend antigo: nome, saldo e parcelas, sem quebrar.
// TabParcelas:
//   - um cartão por carnê em aberto, "Compras anteriores" e Quitados
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
    expanded: false,
    onToggle: jest.fn(), onReceber: jest.fn(), onImprimir: jest.fn(), onRenegociar: jest.fn(), onCobrar: jest.fn(),
    renderParcela: (p: any) => <Text key={p.id}>{`[parcela ${p.installment_number}/${p.total_installments}]`}</Text>,
    ...props,
  };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<CarneCard {...(all as any)} />); });
  return { t, props: all };
}

describe("CarneCard", () => {
  const abertas = [parcela(), parcela({ id: "a4", installment_number: 4, due_date: "2026-12-10" })];

  it("fechado: o essencial, sem o corpo", () => {
    const { t, props } = montarCartao(CONTA, abertas);
    const txt = texto(t.toJSON());
    expect(txt).toContain("Compra de 13/09");
    expect(txt).toContain("Vans Hylane 40/41 · 2× Slide Alta 40/41");
    expect(txt).toContain("R$ 140,00");
    expect(txt).toContain("2 de 4 pagas · próx. 10/11");
    expect(txt).toContain("Em dia");
    expect(porId(t, "carne-c1-progresso")).toHaveLength(1);
    expect(porId(t, "carne-c1-corpo")).toHaveLength(0);
    expect(txt).not.toContain("Receber");
    act(() => { porId(t, "carne-c1-cabecalho")[0].props.onPress(); });
    expect(props.onToggle).toHaveBeenCalled();
  });

  it("aberto: itens com total, pagas, a pagar e as ações do carnê", () => {
    const { t, props } = montarCartao(CONTA, abertas, { expanded: true });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Itens da compra");
    expect(txt).toContain("Total da compra");
    expect(txt).toContain("R$ 280,00");
    expect(txt).toContain("1/4 · paga em 13/09");
    expect(txt).toContain("2/4 · paga em 08/10");
    expect(txt).toContain("[parcela 3/4]");
    expect(txt).toContain("[parcela 4/4]");
    expect(porId(t, "carne-c1-paga")).toHaveLength(2);

    apertarRotulo(t, "Receber R$ 140,00");
    expect(props.onReceber).toHaveBeenCalled();
    apertarRotulo(t, "Imprimir");
    expect(props.onImprimir).toHaveBeenCalled();
    apertarRotulo(t, "Renegociar");
    expect(props.onRenegociar).toHaveBeenCalled();
    apertarRotulo(t, "Cobrar");
    expect(props.onCobrar).toHaveBeenCalled();
  });

  it("em atraso: chip vermelho no lugar do Em dia", () => {
    const { t } = montarCartao({ ...CONTA, overdue: true }, abertas);
    const txt = texto(t.toJSON());
    expect(txt).toContain("Em atraso");
    expect(txt).not.toContain("Em dia");
  });

  it("fiado: sem barra, com o aviso; sem Renegociar nem Cobrar quando não há", () => {
    const fiado = { ...CONTA, total_count: 0, paid_count: 0, paid_installments: [], remaining: 220 };
    const { t } = montarCartao(fiado, [], { expanded: true, onRenegociar: undefined, onCobrar: undefined });
    const txt = texto(t.toJSON());
    expect(porId(t, "carne-c1-progresso")).toHaveLength(0);
    expect(porId(t, "carne-c1-sem-parcelas")).toHaveLength(1);
    expect(txt).toContain("sem parcelas — à vista no crediário");
    expect(txt).toContain("Receber R$ 220,00");
    expect(t.root.findAllByProps({ accessibilityLabel: "Renegociar" })).toHaveLength(0);
    expect(t.root.findAllByProps({ accessibilityLabel: "Cobrar" })).toHaveLength(0);
  });

  it("backend antigo: nome, saldo e parcelas — sem itens, sem barra", () => {
    const antigo = { id: "c1", name: "Carnê da Maria", status: "open", balance: 140, open_count: 2, next_due_date: "2026-11-10", overdue: false, period_unit: "month", period_count: 1 };
    const { t } = montarCartao(antigo, abertas, { expanded: true });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Carnê da Maria");
    expect(txt).toContain("R$ 140,00");
    expect(txt).toContain("2 parcelas em aberto · próx. 10/11");
    expect(txt).not.toContain("Itens da compra");
    expect(porId(t, "carne-c1-progresso")).toHaveLength(0);
    expect(txt).toContain("[parcela 3/4]");
    expect(txt).toContain("Receber R$ 140,00");
  });

  it("grupo sem carnê: Compras anteriores, chip Sem carnê e compras por compra", () => {
    const geral = {
      id: null, name: "Conta geral", balance: 180, remaining: 180, total_count: 1, paid_count: 0,
      purchases: [
        { date: "2026-09-13T15:00:00Z", description: "Slide Asuna 40/41", quantity: 1, amount: 80 },
        { date: "2026-09-13T15:00:00Z", description: "Slide Alta 40/41", quantity: 1, amount: 80 },
        { date: "2026-09-02T12:00:00Z", description: "", quantity: 1, amount: 20, manual: true },
      ],
    };
    const { t } = montarCartao(geral, [parcela({ id: "g1", account_id: null, installment_number: 1, total_installments: 1 })], { expanded: true });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Compras anteriores");
    expect(txt).toContain("Sem carnê");
    expect(txt).toContain("2 compras de antes dos carnês por compra");
    expect(txt).toContain("13/09 · Slide Asuna 40/41, Slide Alta 40/41");
    expect(txt).toContain("02/09 · Lançamento manual");
    expect(porId(t, "carne-general-corpo")).toHaveLength(1);
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

  it("um cartão por carnê em aberto, Compras anteriores e Quitados recolhido", () => {
    const { t } = montarAba();
    const txt = texto(t.toJSON());
    expect(txt).toContain("Em aberto · 2");
    expect(porId(t, "carne-c1")).toHaveLength(1);
    expect(porId(t, "carne-general")).toHaveLength(1);
    expect(porId(t, "carne-c2")).toHaveLength(0);
    expect(txt).toContain("Quitados · 1");
    expect(porId(t, "carne-quitado")).toHaveLength(0);
    act(() => { porId(t, "carnes-quitados-toggle")[0].props.onPress(); });
    expect(porId(t, "carne-quitado")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("Compra de 02/08 · Slide Alta 42/43");
  });

  it("abrir um cartão pede ao shell para expandir aquele carnê", () => {
    const { t, props } = montarAba();
    act(() => { porId(t, "carne-c1-cabecalho")[0].props.onPress(); });
    expect(props.setExpandedAccountId).toHaveBeenCalledWith("c1");
  });

  it("aberto: Receber mira o carnê; Imprimir e Renegociar levam o carnê; parcela usa o ParcelaRow", () => {
    const { t, props } = montarAba({ expandedAccountId: "c1" });
    expect(texto(t.toJSON())).toContain("Parcela 3/4");
    apertarRotulo(t, "Receber R$ 140,00");
    expect(props.prefill).toHaveBeenCalledWith(140, "c1");
    apertarRotulo(t, "Imprimir");
    expect(props.onImprimir).toHaveBeenCalledWith("c1", "Compra de 13/09", 2);
    apertarRotulo(t, "Renegociar");
    expect(props.onRenegociar).toHaveBeenCalledWith("c1", "Compra de 13/09", 140);
    apertarRotulo(t, "Cobrar");
    expect(props.onCobrar).toHaveBeenCalledWith("cli", "Alexander Olivier", "66999990000");
  });

  it("Compras anteriores sem parcela: Receber sem mirar carnê e Parcelar saldo", () => {
    const { t, props } = montarAba({ expandedAccountId: null });
    apertarRotulo(t, "Receber R$ 50,00");
    expect(props.prefill).toHaveBeenCalledWith(50, undefined);
    apertarRotulo(t, "Parcelar saldo");
    expect(props.onRenegociar).toHaveBeenCalledWith(null, "Saldo em aberto", 50);
    apertarRotulo(t, "Imprimir");
    expect(props.onImprimir).toHaveBeenCalledWith(null, "Compras anteriores", 0);
  });

  it("Imprimir todos não manda carnê; Novo carnê continua acessível", () => {
    const { t, props } = montarAba();
    act(() => { porId(t, "carnes-imprimir-todos")[0].props.onPress(); });
    expect(props.onImprimir).toHaveBeenCalledWith(undefined, "Alexander Olivier", 2);
    act(() => { porId(t, "carnes-novo-carne")[0].props.onPress(); });
    expect(props.setShowNewAccount).toHaveBeenCalled();
  });

  it("backend antigo sem carnê: a lista de parcelas de sempre", () => {
    const { t } = montarAba({ accounts: [], useCarneLayout: false });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Parcelas em aberto");
    expect(txt).not.toContain("Em aberto ·");
    expect(txt).toContain("Parcela 3/4");
  });
});
