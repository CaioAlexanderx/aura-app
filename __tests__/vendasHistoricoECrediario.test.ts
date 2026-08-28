// ============================================================
// AURA VENDAS — dois relatos da Eryca (28/08/2026)
//
// 1. "Ao editar o lancamento da venda, a edicao nao lista os produtos."
//    A venda era 100% no crediario. O PDV so lanca a receita "pdv-sale-<id>"
//    quando entrou dinheiro; numa venda fiada isso e zero, entao o unico
//    lancamento dela e o "A Receber" ("pdv-credit-receivable-<id>"). O
//    detector do modal so casava "pdv-sale-", entao a secao de mercadorias
//    nunca renderizava.
//
// 2. "A tela de vendas so mostra ate o dia 15."
//    Nao era corte de data: era limite. A tela pedia limit=100 sem paginacao,
//    com ORDER BY created_at DESC. Contando as vendas reais da loja de tras
//    pra frente (28/08 pra baixo), a centesima linha caia no dia 15 — o comeco
//    do mes simplesmente nao existia na tela.
// ============================================================

import { isSaleLinkedTransaction, isCreditReceivableKey, isPdvSaleKey } from "@/utils/saleLink";
import {
  periodToRange, addMonths, spCurrentMonth, PAGE_SIZE, MONTH_NAMES,
} from "@/utils/vendasPeriodo";

const SALE_ID = "223b1c59-1770-47c0-a90d-6dcb036d0f7b";
const tx = function(key: string | null | undefined) {
  return { id: "t1", idempotency_key: key } as any;
};

describe("edicao do lancamento reconhece a venda no crediario", () => {
  it("reconhece o A Receber do crediario (o relato #1)", () => {
    expect(isSaleLinkedTransaction(tx("pdv-credit-receivable-" + SALE_ID))).toBe(true);
  });

  it("reconhece o saldo de pagamento parcial (-rest-<ts>)", () => {
    // applyPayment quita o recebivel original e abre o resto com esse sufixo.
    expect(isSaleLinkedTransaction(tx("pdv-credit-receivable-" + SALE_ID + "-rest-1756400000000"))).toBe(true);
  });

  it("continua reconhecendo a receita paga na hora", () => {
    expect(isSaleLinkedTransaction(tx("pdv-sale-" + SALE_ID))).toBe(true);
  });

  it("nao abre a secao de venda num lancamento manual", () => {
    expect(isSaleLinkedTransaction(tx(null))).toBe(false);
    expect(isSaleLinkedTransaction(tx(undefined))).toBe(false);
    expect(isSaleLinkedTransaction(tx("aluguel-agosto"))).toBe(false);
    expect(isSaleLinkedTransaction(null)).toBe(false);
  });

  it("distingue as duas origens — o aviso do 'A Receber' depende disso", () => {
    // Mexer no valor/categoria do recebivel nao muda o carne do cliente e
    // ainda tira a linha dos relatorios de crediario. O modal so consegue
    // avisar porque separa as duas origens.
    expect(isCreditReceivableKey("pdv-credit-receivable-" + SALE_ID)).toBe(true);
    expect(isCreditReceivableKey("pdv-sale-" + SALE_ID)).toBe(false);
    expect(isPdvSaleKey("pdv-sale-" + SALE_ID)).toBe(true);
    expect(isPdvSaleKey("pdv-credit-receivable-" + SALE_ID)).toBe(false);
  });

  it("nao confunde a taxa da maquininha com a venda", () => {
    // pdv-card-fee e despesa propria; abrir mercadorias por ela mexeria na
    // linha errada do financeiro.
    expect(isSaleLinkedTransaction(tx("pdv-card-fee-" + SALE_ID))).toBe(false);
  });
});

describe("paginacao — 30 por pagina", () => {
  it("carrega 30, nao 100", () => {
    expect(PAGE_SIZE).toBe(30);
  });

  it("as 119 vendas de agosto da loja cabem em 4 paginas", () => {
    // Numeros reais de producao (01/08 a 28/08): com limit=100 numa tacada,
    // a lista morria no meio do dia 15.
    const total = 119;
    const paginas = Math.ceil(total / PAGE_SIZE);
    expect(paginas).toBe(4);
    // A ultima pagina alcanca a venda mais antiga do periodo.
    const offsetUltima = (paginas - 1) * PAGE_SIZE;
    expect(offsetUltima + PAGE_SIZE).toBeGreaterThanOrEqual(total);
  });

  it("offset acompanha a pagina", () => {
    [0, 1, 2, 3].forEach(function(p) {
      expect(p * PAGE_SIZE).toBe(p * 30);
    });
  });
});

describe("seletor de mes — o historico inteiro fica alcancavel", () => {
  // 28/08/2026 12:00 SP = 15:00 UTC.
  const AGO_2026 = Date.UTC(2026, 7, 28, 15, 0, 0);

  it("ancora no mes corrente de Sao Paulo, nao no fuso do navegador", () => {
    // 01/08 00:30 SP = 01/08 03:30 UTC. Um browser em UTC-oeste nao pode
    // empurrar isso pra julho.
    expect(spCurrentMonth(Date.UTC(2026, 7, 1, 3, 30, 0))).toEqual({ y: 2026, m: 7 });
    expect(spCurrentMonth(AGO_2026)).toEqual({ y: 2026, m: 7 });
  });

  it("meia-noite SP do dia 1 abre o mes", () => {
    const r = periodToRange("month", null, null, { y: 2026, m: 7 }, AGO_2026);
    // 01/08/2026 00:00 SP == 03:00 UTC.
    expect(r.from).toBe("2026-08-01T03:00:00.000Z");
  });

  it("o mes fecha no ultimo instante, sem vazar pro mes seguinte", () => {
    const r = periodToRange("month", null, null, { y: 2026, m: 7 }, AGO_2026);
    expect(r.to).toBe("2026-09-01T02:59:59.999Z");
  });

  it("fevereiro de ano bissexto fecha no dia 29", () => {
    const r = periodToRange("month", null, null, { y: 2024, m: 1 }, AGO_2026);
    expect(r.from).toBe("2024-02-01T03:00:00.000Z");
    expect(r.to).toBe("2024-03-01T02:59:59.999Z");
  });

  it("andar pra tras atravessa a virada de ano", () => {
    expect(addMonths({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
    expect(addMonths({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
  });

  it("chega em qualquer mes do passado — era isso que faltava", () => {
    // Antes so existiam "Mes" (corrente) e "Mes anterior": dois meses de
    // alcance. Agora, 13 cliques pra tras chegam em agosto de 2025.
    let anchor = spCurrentMonth(AGO_2026);
    for (let i = 0; i < 12; i++) anchor = addMonths(anchor, -1);
    expect(anchor).toEqual({ y: 2025, m: 7 });
    expect(MONTH_NAMES[anchor.m]).toBe("Agosto");

    const r = periodToRange("month", null, null, anchor, AGO_2026);
    expect(r.from).toBe("2025-08-01T03:00:00.000Z");
    expect(r.to).toBe("2025-09-01T02:59:59.999Z");
  });

  it("os outros periodos seguem intactos", () => {
    expect(periodToRange("all", null, null, undefined, AGO_2026)).toEqual({});
    // "Hoje" = meia-noite SP do dia 28, sem `to`.
    expect(periodToRange("today", null, null, undefined, AGO_2026))
      .toEqual({ from: "2026-08-28T03:00:00.000Z" });
    // "Semana" = 7 dias corridos contando hoje.
    expect(periodToRange("week", null, null, undefined, AGO_2026))
      .toEqual({ from: "2026-08-22T03:00:00.000Z" });
    // "Personalizado" mantem o `to` inclusivo (fim do dia final).
    expect(periodToRange("custom", "2026-08-01", "2026-08-15", undefined, AGO_2026))
      .toEqual({ from: "2026-08-01T03:00:00.000Z", to: "2026-08-16T02:59:59.999Z" });
  });
});
