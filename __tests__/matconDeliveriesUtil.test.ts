// ============================================================
// Matcon M1 — a esteira de entregas (22/09/2026).
//
// Mesma razão de existir do __tests__/matconQuotesUtil.test.ts: data é
// onde erro de fuso mora, e o dono lê a esteira de manhã pra saber "o que
// tá atrasado" e "quanto falta entregar". O jest.config já fixa
// TZ=America/Sao_Paulo.
// ============================================================
import {
  agruparPorDia, progressoDoItem, rotuloProgresso, seloSaldo, proximaEtapa, seloEstacao,
} from "@/components/matcon/deliveriesUtil";
import type { Delivery, DeliveryItem } from "@/services/matconApi";

// Terça, 22/09/2026, meio-dia no fuso da loja — o "hoje" de todos os testes.
const HOJE = new Date(2026, 8, 22, 12, 0, 0);

function delivery(over: Partial<Delivery>): Delivery {
  return {
    id: over.id || "d1",
    sale_id: "s1",
    sale_number: 1204,
    sequence: 1,
    stage: "separating",
    scheduled_for: "2026-09-22",
    delivered_by: null,
    customer_name: "Marlene Souza",
    customer_phone: "(11) 98765-4321",
    address: "Rua das Acácias, 233",
    total: 1093.21,
    has_pending: false,
    public_token: "tok",
    items: [],
    created_at: "2026-09-22T09:00:00Z",
    ...over,
  };
}

function item(over: Partial<DeliveryItem>): DeliveryItem {
  return {
    sale_item_id: "i1",
    name: "Cimento CP-II 50 kg",
    unit: "sc",
    quantity: 4,
    sold_quantity: 10,
    delivered_before: 6,
    ...over,
  };
}

describe("agruparPorDia", () => {
  test("agrupa hoje, amanhã e atrasada, em ordem: atrasada · hoje · amanhã", () => {
    const grupos = agruparPorDia(
      [
        delivery({ id: "amanha", scheduled_for: "2026-09-23" }),
        delivery({ id: "hoje", scheduled_for: "2026-09-22" }),
        delivery({ id: "atrasada", scheduled_for: "2026-09-21" }),
      ],
      HOJE,
    );

    expect(grupos.map((g) => g.diaISO)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(grupos[0].rotulo).toBe("ATRASADA · SEGUNDA, 21/09");
    expect(grupos[1].rotulo).toBe("HOJE · TERÇA, 22/09");
    expect(grupos[2].rotulo).toBe("AMANHÃ · QUARTA, 23/09");
  });

  test("dia futuro além de amanhã não leva prefixo", () => {
    const grupos = agruparPorDia([delivery({ scheduled_for: "2026-09-25" })], HOJE);
    expect(grupos[0].rotulo).toBe("SEXTA, 25/09");
  });

  test("cada grupo carrega as entregas daquele dia", () => {
    const grupos = agruparPorDia(
      [
        delivery({ id: "a", scheduled_for: "2026-09-22" }),
        delivery({ id: "b", scheduled_for: "2026-09-22" }),
        delivery({ id: "c", scheduled_for: "2026-09-23" }),
      ],
      HOJE,
    );
    expect(grupos[0].entregas.map((d) => d.id)).toEqual(["a", "b"]);
    expect(grupos[1].entregas.map((d) => d.id)).toEqual(["c"]);
  });

  test("lista vazia devolve nenhum grupo", () => {
    expect(agruparPorDia([], HOJE)).toEqual([]);
  });
});

describe("progressoDoItem", () => {
  test("stage 'out': entregue é só o que já tinha sido confirmado antes (delivered_before)", () => {
    const it = item({ delivered_before: 6, quantity: 4, sold_quantity: 10 });
    expect(progressoDoItem(it, "out")).toEqual({ entregue: 6, total: 10, saldo: 4, completo: false });
  });

  test("stage 'delivered': entregue soma delivered_before + quantity desta entrega", () => {
    const it = item({ delivered_before: 6, quantity: 4, sold_quantity: 10 });
    expect(progressoDoItem(it, "delivered")).toEqual({ entregue: 10, total: 10, saldo: 0, completo: true });
  });

  test("stage 'separating'/'ready': mesma regra do 'out' — nada confirmado ainda", () => {
    const it = item({ delivered_before: 0, quantity: 40, sold_quantity: 40 });
    expect(progressoDoItem(it, "separating").entregue).toBe(0);
    expect(progressoDoItem(it, "ready").entregue).toBe(0);
  });
});

describe("rotuloProgresso e seloSaldo", () => {
  test("item parcial: '6 de 10 sc' e 'SALDO 4 SC'", () => {
    const it = item({ delivered_before: 6, quantity: 4, sold_quantity: 10, unit: "sc" });
    expect(rotuloProgresso(it, "out")).toBe("6 de 10 sc");
    expect(seloSaldo(it, "out")).toBe("SALDO 4 SC");
  });

  test("item completo (stage delivered): sem selo de saldo", () => {
    const it = item({ delivered_before: 6, quantity: 4, sold_quantity: 10, unit: "sc" });
    expect(rotuloProgresso(it, "delivered")).toBe("10 de 10 sc");
    expect(seloSaldo(it, "delivered")).toBeNull();
  });

  test("unidade fracionada formata com vírgula, sem zero à direita", () => {
    const it = item({ name: "Porcelanato Bianco 60×60", unit: "m²", delivered_before: 0, quantity: 13.92, sold_quantity: 13.92 });
    expect(rotuloProgresso(it, "delivered")).toBe("13,92 de 13,92 m²");
    expect(seloSaldo(it, "delivered")).toBeNull();
  });
});

describe("proximaEtapa", () => {
  test("percorre as quatro etapas da esteira", () => {
    expect(proximaEtapa("separating")).toEqual({ stage: "ready", label: "Marcar pronto" });
    expect(proximaEtapa("ready")).toEqual({ stage: "out", label: "Saiu para entrega" });
    expect(proximaEtapa("out")).toEqual({ stage: "delivered", label: "Marcar como entregue" });
    expect(proximaEtapa("delivered")).toBeNull();
  });
});

describe("seloEstacao", () => {
  test("separando e pronto: sem horário", () => {
    expect(seloEstacao(delivery({ stage: "separating" }))).toBe("SEPARANDO");
    expect(seloEstacao(delivery({ stage: "ready" }))).toBe("PRONTO");
  });

  test("saiu e entregue: com o horário, no fuso da loja", () => {
    expect(seloEstacao(delivery({ stage: "out", out_at: "2026-09-22T16:40:00.000Z" }))).toBe("SAIU 13:40");
    expect(seloEstacao(delivery({ stage: "delivered", delivered_at: "2026-09-22T19:05:00.000Z" }))).toBe("ENTREGUE 16:05");
  });
});
