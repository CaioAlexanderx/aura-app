// ============================================================
// Frases da tela final da venda no Matcon (components/screens/pdv/
// matconDaVenda.ts) — QA 23/09/2026. Jest roda em America/Sao_Paulo.
// ============================================================
import { dataDaEntrega, frasesMatconDaVenda } from "@/components/screens/pdv/matconDaVenda";

const AGORA = new Date(2026, 8, 23, 15, 0); // 23/09/2026, 15h

describe("dataDaEntrega", () => {
  test("hoje + prazo padrão (2 dias) = 25/09", () => {
    expect(dataDaEntrega(2, AGORA)).toBe("25/09");
  });
  test("vira o mês: 29/09 + 3 = 02/10", () => {
    expect(dataDaEntrega(3, new Date(2026, 8, 29, 23, 30))).toBe("02/10");
  });
  test("prazo zero = hoje; lixo vira zero", () => {
    expect(dataDaEntrega(0, AGORA)).toBe("23/09");
    expect(dataDaEntrega(NaN as any, AGORA)).toBe("23/09");
  });
});

describe("frasesMatconDaVenda", () => {
  test("sem matcon: tudo null", () => {
    expect(frasesMatconDaVenda(undefined, { diasDeEntrega: 2 })).toEqual({ entrega: null, pontos: null });
    expect(frasesMatconDaVenda(null, { diasDeEntrega: 2 })).toEqual({ entrega: null, pontos: null });
  });

  test("entrega + pontos juntos", () => {
    const f = frasesMatconDaVenda(
      { quote_id: "q", delivery_id: "d", delivery_token: "t", referral: { credited: true, points: 10 } },
      { diasDeEntrega: 2, nomeDoIndicado: "Abbey", agora: AGORA },
    );
    expect(f.entrega).toBe("Entrega nº 1 criada para 25/09 — acompanhe em Entregas");
    expect(f.pontos).toBe("Abbey ganhou 10 pontos com esta venda");
  });

  test("1 ponto no singular; 0 ponto registra a indicação", () => {
    expect(frasesMatconDaVenda({ referral: { credited: true, points: 1 } }, { diasDeEntrega: 2, nomeDoIndicado: "Abbey" }).pontos)
      .toBe("Abbey ganhou 1 ponto com esta venda");
    expect(frasesMatconDaVenda({ referral: { credited: true, points: 0 } }, { diasDeEntrega: 2, nomeDoIndicado: "Abbey" }).pontos)
      .toBe("Indicação de Abbey registrada nesta venda");
  });

  test("sem nome do chip: frase neutra", () => {
    expect(frasesMatconDaVenda({ referral: { credited: true, points: 10 } }, { diasDeEntrega: 2 }).pontos)
      .toBe("O profissional que indicou ganhou 10 pontos com esta venda");
  });

  test("não creditou: sem frase", () => {
    expect(frasesMatconDaVenda({ referral: { credited: false, reason: "ALREADY_CREDITED" } }, { diasDeEntrega: 2 }).pontos).toBeNull();
  });
});
