// Descrição do lançamento na linha do tempo do crediário (21/09/2026).
//
// O "Novo lançamento" pede uma Descrição (opcional), o backend grava e devolve
// em meta.notes — e a linha do tempo nunca exibia. eventNote() decide o que
// vale mostrar: o que a lojista digitou, nunca o padrão "Lancamento manual"
// nem o texto de sistema das compras (os itens já aparecem listados).

import { eventNote } from "@/components/crediario/ficha/eventNote";

describe("eventNote", () => {
  it("débito manual com descrição digitada: mostra a descrição", () => {
    expect(eventNote({ type: "manual_debit", meta: { notes: "Conta anterior" } })).toBe("Conta anterior");
  });

  it("apara espaços nas pontas", () => {
    expect(eventNote({ type: "manual_debit", meta: { notes: "  bolsa da vitrine  " } })).toBe("bolsa da vitrine");
  });

  it("padrão do backend para descrição em branco não é informação", () => {
    expect(eventNote({ type: "manual_debit", meta: { notes: "Lancamento manual" } })).toBe("");
    expect(eventNote({ type: "manual_debit", meta: { notes: "Lançamento manual" } })).toBe("");
    expect(eventNote({ type: "manual_debit", meta: { notes: "LANCAMENTO MANUAL" } })).toBe("");
  });

  it("compra: notes é texto do sistema e os itens já aparecem — não repete", () => {
    expect(eventNote({ type: "purchase", meta: { notes: "Venda no crediário (2x Blusa)" } })).toBe("");
  });

  it("pagamento com observação digitada no recebimento: mostra", () => {
    expect(eventNote({ type: "payment", meta: { notes: "pagou metade, resto dia 10" } })).toBe("pagou metade, resto dia 10");
  });

  it("renegociação e devolução: o texto do sistema explica a origem", () => {
    expect(eventNote({ type: "manual_debit", meta: { notes: "Renegociacao de saldo" } })).toBe("Renegociacao de saldo");
    expect(eventNote({ type: "refund", meta: { notes: "Devolucao de venda" } })).toBe("Devolucao de venda");
  });

  it("sem meta, sem notes ou notes não-texto: vazio, sem quebrar", () => {
    expect(eventNote({ type: "manual_debit" })).toBe("");
    expect(eventNote({ type: "manual_debit", meta: null })).toBe("");
    expect(eventNote({ type: "manual_debit", meta: {} })).toBe("");
    expect(eventNote({ type: "payment", meta: { notes: 123 } })).toBe("");
    expect(eventNote({ type: "payment", meta: { notes: "   " } })).toBe("");
  });
});
