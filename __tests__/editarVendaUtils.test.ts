// ============================================================
// Editar venda (09/11/2026) — regras de tela sem React
//
//   - corpo do PATCH: só o que mudou (ausente ≠ null)
//   - soma das formas contra o total ("Fechou certinho" / "Faltam")
//   - efeitos do dry_run no campo certo
//   - textos de apoio (telefone mascarado, resumo das formas, NFC-e)
// ============================================================
import {
  montarCorpo, conferirSoma, lerValor, efeitosDoCampo, mascararTelefone, resumoDasFormas,
  avisoDaNota, linhasIniciais, rotuloDasMudancas, filtrarPorBusca, rotuloDaForma, somarMes, lerDia,
} from "@/components/screens/vendas/editarVendaUtils";

function ctx(over: any = {}): any {
  return Object.assign({
    sale: { id: "v1", sale_number: 1042, total_amount: 189.7, created_at: "2026-11-07T18:42:00Z", dia: "2026-11-07", type: "sale", status: "completed", payment_method: "dinheiro", company_id: "c1" },
    editable: true, locked: null,
    current: { payments: [{ method: "dinheiro", amount: 189.7 }], credit: null, seller: { id: "ana", name: "Ana" }, customer: null },
    locks: { money: null, seller: null }, permissions: { seller: true, money: true }, nfce: null, caixa: null,
  }, over);
}

const semMudar = { sellerId: undefined, customer: undefined, linhas: [{ method: "dinheiro" as const, valor: "189,70" }], parcelas: 1, primeiraParcela: null };

describe("montarCorpo", () => {
  test("nada mudou: corpo vazio", () => {
    expect(montarCorpo(ctx(), semMudar)).toEqual({ body: {}, mudancas: [] });
  });

  test("só a forma mudou: o vendedor não vai no corpo (ausente ≠ null)", () => {
    const r = montarCorpo(ctx(), { ...semMudar, linhas: [{ method: "dinheiro", valor: "100" }, { method: "pix", valor: "89,70" }] });
    expect(r.mudancas).toEqual(["payments"]);
    expect(r.body).toEqual({ payments: [{ method: "dinheiro", amount: 100 }, { method: "pix", amount: 89.7 }] });
    expect("seller_id" in r.body).toBe(false);
    expect("customer_id" in r.body).toBe(false);
  });

  test("tirar o vendedor manda null de propósito", () => {
    const r = montarCorpo(ctx(), { ...semMudar, sellerId: null });
    expect(r.body).toEqual({ seller_id: null });
  });

  test("escolher o mesmo vendedor não é mudança", () => {
    expect(montarCorpo(ctx(), { ...semMudar, sellerId: "ana" }).mudancas).toEqual([]);
  });

  test("crediário leva parcelas e 1ª parcela", () => {
    const r = montarCorpo(ctx(), {
      ...semMudar, customer: { id: "cli", name: "Cliente" },
      linhas: [{ method: "crediario", valor: "189,70" }], parcelas: 3, primeiraParcela: "2026-12-07",
    });
    expect(r.mudancas).toEqual(["customer", "payments"]);
    expect(r.body).toEqual({ customer_id: "cli", payments: [{ method: "crediario", amount: 189.7 }], installments: 3, first_due_date: "2026-12-07" });
  });

  test("venda já no crediário: mudar só as parcelas é mudança de forma", () => {
    const c = ctx({ current: { payments: [{ method: "crediario", amount: 189.7, installments: 2 }], credit: { amount: 189.7, installments: 2, first_due_date: "2026-12-07" }, seller: null, customer: { id: "cli", name: "C" } } });
    const r = montarCorpo(c, { ...semMudar, linhas: [{ method: "crediario", valor: "189,70" }], parcelas: 3, primeiraParcela: "2026-12-07" });
    expect(r.mudancas).toEqual(["payments"]);
    expect(r.body.installments).toBe(3);
  });
});

test("conferirSoma", () => {
  expect(conferirSoma(189.7, [{ method: "dinheiro", valor: "100" }, { method: "pix", valor: "89,70" }])).toMatchObject({ ok: true, texto: "Fechou certinho" });
  expect(conferirSoma(189.7, [{ method: "dinheiro", valor: "100" }, { method: "pix", valor: "80" }]).texto).toBe("Faltam R$ 9,70");
  expect(conferirSoma(189.7, [{ method: "dinheiro", valor: "200" }]).texto).toBe("Passou R$ 10,30");
  expect(conferirSoma(189.7, [{ method: "dinheiro", valor: "" }]).ok).toBe(false);
});

test("lerValor aceita vírgula, ponto de milhar e R$", () => {
  expect(lerValor("89,70")).toBe(89.7);
  expect(lerValor("1.234,56")).toBe(1234.56);
  expect(lerValor("R$ 10")).toBe(10);
  expect(Number.isNaN(lerValor(""))).toBe(true);
});

test("efeitos do dry_run vão para o campo certo", () => {
  const plan: any = {
    effects: [
      { code: "CASH_CHANGED", text: "a" }, { code: "COMMISSION_MOVES", text: "b" },
      { code: "CUSTOMER_HISTORY", text: "c" }, { code: "NO_STOCK_CHANGE", text: "d" },
    ],
    warnings: [{ code: "CAIXA_CLOSED", text: "e" }, { code: "NFCE_KEEPS_ORIGINAL", text: "f" }],
  };
  expect(efeitosDoCampo(plan, "payments").map((e) => e.text)).toEqual(["a", "e"]);
  expect(efeitosDoCampo(plan, "seller").map((e) => e.text)).toEqual(["b"]);
  expect(efeitosDoCampo(plan, "customer").map((e) => e.text)).toEqual(["c"]);
  expect(efeitosDoCampo(null, "payments")).toEqual([]);
});

test("textos de apoio", () => {
  expect(mascararTelefone("(11) 98765-4321")).toBe("(11) 9····-··21");
  expect(mascararTelefone("123")).toBeNull();
  expect(resumoDasFormas([{ method: "pix", amount: 189.7 }])).toBe("Pix R$ 189,70");
  expect(resumoDasFormas([{ method: "crediario", amount: 189.7, installments: 3 }])).toBe("Crediário em 3x");
  expect(resumoDasFormas([{ method: "dinheiro", amount: 100 }, { method: "pix", amount: 89.7 }])).toBe("Dinheiro R$ 100,00 + Pix R$ 89,70");
  expect(rotuloDaForma("cartao")).toBe("Crédito");
  expect(rotuloDaForma("crediario")).toBe("Crediário");
  expect(rotuloDasMudancas(["payments"])).toBe("1 mudança: forma de pagamento");
  expect(rotuloDasMudancas(["payments", "seller", "customer"])).toBe("3 mudanças");
  expect(linhasIniciais([], 50)).toEqual([{ method: "dinheiro", valor: "50,00" }]);
  expect(somarMes("2026-01-31", 1)).toBe("2026-02-28");
  expect(lerDia("07/12/2026")).toBe("2026-12-07");
  expect(lerDia("31/02/2026")).toBeNull();
});

test("aviso da NFC-e: atalho de cancelar só dentro dos 30 min", () => {
  const agora = Date.parse("2026-11-07T14:10:00Z");
  const dentro = avisoDaNota({ id: "n", numero: 2318, authorized_at: "2026-11-07T14:02:00Z", cancel_until: "2026-11-07T14:32:00Z", can_cancel: true }, agora);
  expect(dentro && dentro.podeCancelar).toBe(true);
  expect(dentro && dentro.texto).toContain("NFC-e 2318");
  const fora = avisoDaNota({ id: "n", numero: 2318, authorized_at: "2026-11-07T13:00:00Z", cancel_until: "2026-11-07T13:30:00Z", can_cancel: false }, agora);
  expect(fora && fora.podeCancelar).toBe(false);
  expect(avisoDaNota(null)).toBeNull();
});

test("busca por nome ou telefone", () => {
  const lista = [{ id: "1", name: "Ana Souza", subtitle: "(11) 98765-4321" }, { id: "2", name: "Bia", subtitle: null }];
  expect(filtrarPorBusca(lista, "ana").map((x) => x.id)).toEqual(["1"]);
  expect(filtrarPorBusca(lista, "4321").map((x) => x.id)).toEqual(["1"]);
  expect(filtrarPorBusca(lista, "").length).toBe(2);
});
