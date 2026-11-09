// ============================================================
// Ficha do crediário · "Excluir carnê" (09/11/2026)
//
// CarneCard: a ação aparece no fim da linha, em vermelho só no texto, e
//   também no carnê vazio; sem onExcluir, nada.
// TabParcelas: só carnê de verdade e aberto tem o botão; o grupo sem carnê
//   não. O toque entrega ao shell { id, nome, falta }.
// utils/crediarioExcluirCarne: texto da confirmação e leitura dos 409.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import { Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { CarneCard } from "@/components/crediario/ficha/CarneCard";
import { TabParcelas } from "@/components/crediario/ficha/TabParcelas";
import { derivarCarne } from "@/utils/crediarioCarne";
import {
  textoConfirmarExclusao, lerErroDaExclusao, mensagemDosRecebimentos,
} from "@/utils/crediarioExcluirCarne";
import { fmt } from "@/components/crediario/ficha/fichaHelpers";

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });

const parcela = (over: Record<string, any> = {}) => ({
  id: "a1", sale_id: null, customer_id: "cli", company_id: "emp",
  installment_number: 1, total_installments: 2, amount_due: 150, amount_paid: 0, covered_amount: 0,
  due_date: "2026-12-10", paid_at: null, status: "pending", pix_link: null, late_fee: 0, late_interest: 0,
  collection_stage: 0, account_id: "c1", is_overdue: false, needs_review: false,
  ...over,
});

const CONTA = {
  id: "c1", name: "Lançamento de 01/11", status: "open", balance: 300, open_count: 2,
  next_due_date: "2026-12-10", overdue: false, period_unit: "month", period_count: 1,
  purchases: [], purchases_total: 300, total_amount: 300, refunded_total: 0, total_count: 2, paid_count: 0,
  paid_installments: [], open_remaining: 300, unscheduled: 0, remaining: 300,
} as any;

const PARCELAS = [parcela(), parcela({ id: "a2", installment_number: 2, due_date: "2027-01-10" })];

function montarCartao(conta: any, parcelas: any[], props: Record<string, any> = {}) {
  const all = {
    carne: derivarCarne(conta, parcelas),
    expanded: true,
    onToggle: jest.fn(), onReceber: jest.fn(), onImprimir: jest.fn(), onRenegociar: jest.fn(), onCobrar: jest.fn(),
    renderParcela: (p: any) => <Text key={p.id}>{`[parcela ${p.installment_number}]`}</Text>,
    ...props,
  };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<CarneCard {...(all as any)} />); });
  return { t, props: all };
}

describe("CarneCard — Excluir carnê", () => {
  it("aparece por último na linha de ações, com texto vermelho, e chama onExcluir", () => {
    const onExcluir = jest.fn();
    const { t } = montarCartao(CONTA, PARCELAS, { onExcluir });
    const botao = porId(t, "carne-c1-excluir");
    expect(botao).toHaveLength(1);

    // Último rótulo da linha de ações.
    const rotulos = t.root.findAll((n: any) => n.props && n.props.accessibilityRole === "button" && typeof n.props.accessibilityLabel === "string", { deep: false })
      .map((n: any) => n.props.accessibilityLabel);
    expect(rotulos[rotulos.length - 1]).toBe("Excluir carnê");

    const rotulo = botao[0].findAllByType(Text)[0];
    expect(StyleSheet.flatten(rotulo.props.style).color).toBe(Colors.red);

    act(() => { botao[0].props.onPress(); });
    expect(onExcluir).toHaveBeenCalledTimes(1);
  });

  it("sem onExcluir não há botão", () => {
    const { t } = montarCartao(CONTA, PARCELAS);
    expect(porId(t, "carne-c1-excluir")).toHaveLength(0);
    expect(texto(t.toJSON())).not.toContain("Excluir carnê");
  });

  it("carnê vazio (sem as outras ações) também pode ser excluído", () => {
    const vazio = { ...CONTA, balance: 0, open_count: 0, total_count: 0, total_amount: 0, purchases_total: 0, open_remaining: 0, remaining: 0 };
    const { t } = montarCartao(vazio, [], { onExcluir: jest.fn() });
    expect(porId(t, "carne-c1-excluir")).toHaveLength(1);
  });
});

describe("TabParcelas — Excluir carnê", () => {
  function montarAba(over: Record<string, any> = {}) {
    const props = {
      accounts: [
        CONTA,
        { id: null, name: "Conta geral", status: "open", balance: 50, remaining: 50, total_count: 0, paid_count: 0, purchases: [], overdue: false, open_count: 0, next_due_date: null, period_unit: "month", period_count: 1 },
      ],
      openInst: PARCELAS,
      instByAccount: new Map(),
      useCarneLayout: true,
      handleCreateAccount: jest.fn(), showNewAccount: false, setShowNewAccount: jest.fn(),
      newAccountName: "", setNewAccountName: jest.fn(), creatingAccount: false,
      expandedAccountId: undefined as any, setExpandedAccountId: jest.fn(),
      handleEditDueDateOpen: jest.fn(), onRenegociar: jest.fn(), openInstallmentPix: jest.fn(),
      onImprimir: jest.fn(), prefill: jest.fn(), openBalance: 350,
      onExcluirCarne: jest.fn(),
      companyId: "emp", customerId: "cli", phone: null, onCobrar: undefined, name: "Cliente Fixture",
      ...over,
    };
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<TabParcelas {...(props as any)} />); });
    return { t, props };
  }

  it("o toque leva ao shell id, nome e quanto falta", () => {
    const { t, props } = montarAba({ expandedAccountId: "c1" });
    act(() => { porId(t, "carne-c1-excluir")[0].props.onPress(); });
    expect(props.onExcluirCarne).toHaveBeenCalledWith({ id: "c1", nome: "Lançamento de 01/11", falta: 300 });
  });

  it("o grupo sem carnê não tem o botão", () => {
    const { t } = montarAba({ expandedAccountId: null });
    expect(porId(t, "carne-general-corpo")).toHaveLength(1);
    expect(porId(t, "carne-general-excluir")).toHaveLength(0);
  });

  it("carnê que não está aberto não tem o botão", () => {
    const { t } = montarAba({ expandedAccountId: "c1", accounts: [{ ...CONTA, status: "closed" }] });
    expect(porId(t, "carne-c1-excluir")).toHaveLength(0);
  });
});

describe("utils/crediarioExcluirCarne", () => {
  it("confirmação diz quanto sai do saldo", () => {
    expect(textoConfirmarExclusao(300, fmt))
      .toBe("Excluir este carnê? As parcelas em aberto (R$ 300,00) saem do saldo do cliente.");
    expect(textoConfirmarExclusao(0, fmt)).toBe("Excluir este carnê? Ele sai da ficha do cliente.");
  });

  it("409 com recebimento: lista com dia e valor", () => {
    const r = lerErroDaExclusao({
      status: 409,
      data: { code: "CARNE_TEM_RECEBIMENTO", receipts: [{ id: "p1", date: "2026-11-05T15:00:00.000Z", amount: 100 }] },
    });
    expect(r).toEqual({ tipo: "recebimentos", recebimentos: [{ id: "p1", date: "2026-11-05T15:00:00.000Z", amount: 100 }] });
    if (r.tipo !== "recebimentos") throw new Error("tipo");
    const msg = mensagemDosRecebimentos(r.recebimentos, fmt);
    expect(msg).toContain("Desfaça cada um na Linha do tempo e depois exclua o carnê.");
    expect(msg).toContain("05/11 · R$ 100,00");
  });

  it("recebimento antigo sem data: só o valor", () => {
    const msg = mensagemDosRecebimentos([{ id: null, date: null, amount: 40 }], fmt);
    expect(msg.endsWith("R$ 40,00")).toBe(true);
  });

  it("409 de venda: devolve o sale_id", () => {
    expect(lerErroDaExclusao({ data: { code: "CARNE_DE_VENDA", sale_id: "s1" } }))
      .toEqual({ tipo: "venda", saleId: "s1" });
  });

  it("já excluído e juntado: recarregar; divergente e desconhecido: mensagem gentil", () => {
    expect(lerErroDaExclusao({ data: { code: "CARNE_JA_EXCLUIDO" } }).tipo).toBe("sumiu");
    expect(lerErroDaExclusao({ data: { code: "CARNE_JUNTADO" } }).tipo).toBe("sumiu");
    const div = lerErroDaExclusao({ data: { code: "CARNE_DIVERGENTE" } });
    expect(div.tipo).toBe("erro");
    expect((div as any).mensagem).toContain("suporte da Aura");
    expect(lerErroDaExclusao(new Error("rede"))).toEqual({ tipo: "erro", mensagem: "Não foi possível excluir o carnê. Tente novamente." });
  });
});
