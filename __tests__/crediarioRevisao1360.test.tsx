// ============================================================
// Revisão do #1360 (23/11/2026): crédito de verdade, "Receber até esta" com
// multa e juros, grupo sem carnê, limite na troca de cliente, numeração.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { chaveDaPrevia, contaParaOValor, creditoDeVerdade, valorParaQuitarAte } from "@/utils/crediarioReceberCarne";
import { derivarCarne, numerosPorPosicao } from "@/utils/crediarioCarne";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));

import { TabParcelas } from "@/components/crediario/ficha/TabParcelas";

describe("crédito de verdade na pergunta do Receber", () => {
  test("o fiado sem parcela absorve o credit_generated: sem saldo negativo, sem crédito", () => {
    expect(creditoDeVerdade({ new_balance: 0, credit_generated: 100 })).toBe(0);
    expect(creditoDeVerdade({ new_balance: 40, credit_generated: 100 })).toBe(0);
  });
  test("saldo negativo: no máximo o quanto ficou negativo", () => {
    expect(creditoDeVerdade({ new_balance: -50, credit_generated: 100 })).toBe(50);
    expect(creditoDeVerdade({ new_balance: -160.1, credit_generated: 160.1 })).toBe(160.1);
    expect(creditoDeVerdade(null)).toBe(0);
  });
  test("a chave da prévia muda com o valor e com o carnê", () => {
    expect(chaveDaPrevia(100, "k1")).toBe("100.00|k1");
    expect(chaveDaPrevia(100, "k1")).not.toBe(chaveDaPrevia(100.01, "k1"));
    expect(chaveDaPrevia(100, "k1")).not.toBe(chaveDaPrevia(100, undefined));
  });
});

describe("Receber até esta com multa e juros (3 atrasadas de R$ 100 + R$ 5)", () => {
  const p = (id: string) => ({ id, remaining: 100, charges_total: 5, total_due: 105 });
  const todas = [p("a"), p("b"), p("c")];
  const atrasada = () => true;
  test("na ordem do backend: encargos de todas + principal até esta", () => {
    expect(valorParaQuitarAte(todas, [todas[0]], atrasada)).toBe(115);
    expect(valorParaQuitarAte(todas, todas.slice(0, 2), atrasada)).toBe(215);
    expect(valorParaQuitarAte(todas, todas, atrasada)).toBe(315);
  });
  test("a última linha não perde o carnê: o 'falta' conta os encargos", () => {
    const faltaComEncargos = 300 + 15;
    expect(contaParaOValor("k1", 315, faltaComEncargos)).toBe("k1");
    // sem contar os encargos (o defeito), passava do falta e ia para "todas"
    expect(contaParaOValor("k1", 315, 300)).toBeUndefined();
  });
});

describe("numeração por posição (painel Mudar a data e prévia do Receber)", () => {
  test("carnê juntado: 1..4 de 4; grupo sem carnê fica com o gravado", () => {
    const conta = { id: "j1", name: "Carnês juntados", status: "open", balance: 400, remaining: 400, total_count: 4, paid_count: 0, paid_installments: [], purchases: [] };
    const abertas = [1, 2, 1, 2].map((n, i) => ({ id: `x${i}`, account_id: "j1", installment_number: n, total_installments: i < 2 ? 2 : 3, due_date: `2099-0${i + 1}-10`, amount_due: 100 }));
    const juntado = derivarCarne(conta as any, abertas as any);
    const geral = derivarCarne({ id: null, name: "Conta geral", balance: 50, remaining: 50, total_count: 1, paid_count: 0, purchases: [] } as any,
      [{ id: "g1", account_id: null, installment_number: 1, total_installments: 1, due_date: "2099-01-01", amount_due: 50 }] as any);
    const mapa = numerosPorPosicao([juntado, geral] as any);
    expect(mapa.get("x2")).toBe("3 de 4");
    expect(mapa.get("x3")).toBe("4 de 4");
    expect(mapa.has("g1")).toBe(false);
  });
});

describe("grupo Compras sem carnê: só Receber simples", () => {
  const parcela = (over: any) => ({
    id: "g1", customer_id: "cli", company_id: "emp", installment_number: 1, total_installments: 2,
    amount_due: 50, amount_paid: 0, covered_amount: 0, due_date: "2099-11-10", status: "pending",
    account_id: null, is_overdue: false, needs_review: false, ...over,
  });
  test("a 2ª linha do grupo não vira 'Receber até esta'", () => {
    const props: any = {
      accounts: [{ id: null, name: "Conta geral", status: "open", balance: 100, remaining: 100, total_count: 2, paid_count: 0, purchases: [], paid_installments: [] }],
      openInst: [parcela({}), parcela({ id: "g2", installment_number: 2, due_date: "2099-12-10" })],
      instByAccount: new Map(), useCarneLayout: true,
      handleCreateAccount: jest.fn(), showNewAccount: false, setShowNewAccount: jest.fn(),
      newAccountName: "", setNewAccountName: jest.fn(), creatingAccount: false,
      expandedAccountId: undefined, setExpandedAccountId: jest.fn(),
      handleEditDueDateOpen: jest.fn(), onRenegociar: jest.fn(), openInstallmentPix: jest.fn(),
      onImprimir: jest.fn(), prefill: jest.fn(), openBalance: 100,
      companyId: "emp", customerId: "cli", phone: null, onCobrar: undefined, name: "X",
    };
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<TabParcelas {...props} />); });
    const rotulos = t.root.findAll((n: any) => n.props && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Receber"), { deep: false } as any)
      .map((n: any) => n.props.accessibilityLabel);
    expect(rotulos.some((r: string) => r.includes("até esta"))).toBe(false);
    expect(rotulos).toContain("Receber R$ 50,00 da parcela 2 de 2");
    act(() => { t.root.findAll((n: any) => n.props?.accessibilityLabel === "Receber R$ 50,00 da parcela 2 de 2", { deep: false } as any)[0].props.onPress(); });
    expect(props.prefill).toHaveBeenCalledWith(50, undefined);
  });
});
