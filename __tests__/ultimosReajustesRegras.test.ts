// ============================================================
// Últimos reajustes (03/11/2026): textos da lista e do detalhe.
// ============================================================
import {
  textoDoLote, quemEQuantos, situacaoDoLote, prazoTxt, quandoTxt, diaTxt, textoConfirmarDesfazer, DIAS_PARA_DESFAZER,
} from "@/components/screens/estoque/reajuste/reajusteRegras";
import type { LoteReajuste } from "@/services/priceAdjustmentsApi";

function lote(extra: Partial<LoteReajuste> = {}): LoteReajuste {
  return {
    id: "a1", created_at: "2026-10-30T14:05:00", user: { id: "u1", name: "Caio" },
    mode: "percent", direction: "up", value: 10, rounding: "none", allow_below_cost: false,
    items_count: 9, products_count: 7, skipped_count: 0, below_cost_count: 0, group_shared_count: 0,
    undo_deadline: "2026-11-06T14:05:00", can_undo: true, undone_at: null, undone_by: null,
    undo_restored_count: null, undo_changed_count: null,
    ...extra,
  };
}

describe("textoDoLote", () => {
  it("descreve cada modo em português", () => {
    expect(textoDoLote(lote())).toBe("Aumento de 10%");
    expect(textoDoLote(lote({ direction: "down", value: 10.5 }))).toBe("Redução de 10,5%");
    expect(textoDoLote(lote({ mode: "fixed", direction: "up", value: 5 }))).toBe("Aumento de R$ 5,00");
    expect(textoDoLote(lote({ mode: "fixed", direction: "down", value: 1234.5 }))).toBe("Redução de R$ 1.234,50");
    expect(textoDoLote(lote({ mode: "markup", direction: null, value: 60 }))).toBe("Markup de 60% sobre o custo");
    expect(textoDoLote(lote({ mode: "margin", direction: null, value: 50 }))).toBe("Margem de 50%");
  });
  it("diz a terminação quando houver", () => {
    expect(textoDoLote(lote({ rounding: "90" }))).toBe("Aumento de 10%, final ,90");
  });
});

describe("quemEQuantos", () => {
  it("quem fez, quantos produtos e quem ficou de fora", () => {
    expect(quemEQuantos(lote())).toBe("Caio · 7 produtos");
    expect(quemEQuantos(lote({ products_count: 1, skipped_count: 2 }))).toBe("Caio · 1 produto · 2 ficaram de fora");
    expect(quemEQuantos(lote({ user: null }))).toBe("7 produtos");
  });
});

describe("prazo", () => {
  it("dentro do prazo diz até quando", () => {
    expect(situacaoDoLote(lote())).toBe("pode");
    expect(prazoTxt(lote())).toBe("Dá para desfazer até 06/11 às 14:05");
  });
  it("desfeito e vencido", () => {
    var desfeito = lote({ undone_at: "2026-10-31T10:00:00", can_undo: false });
    expect(situacaoDoLote(desfeito)).toBe("desfeito");
    expect(prazoTxt(desfeito)).toBe("Desfeito em 31/10");
    var vencido = lote({ can_undo: false });
    expect(situacaoDoLote(vencido)).toBe("vencido");
    expect(prazoTxt(vencido)).toBe("Passou o prazo de " + DIAS_PARA_DESFAZER + " dias para desfazer");
  });
  it("datas inválidas não quebram", () => {
    expect(diaTxt(null)).toBe("");
    expect(quandoTxt("nada")).toBe("");
    expect(quandoTxt("2026-10-30T09:03:00")).toBe("30/10 às 09:03");
  });
});

it("confirmação explica quem fica como está", () => {
  var t = textoConfirmarDesfazer(lote());
  expect(t).toContain("7 produtos");
  expect(t).toContain("fica como está");
});
