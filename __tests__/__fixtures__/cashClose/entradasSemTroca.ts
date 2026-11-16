// ============================================================
// AURA. — Fechamento de caixa: entradas SEM troca (16/11/2026)
//
// Os .html ao lado foram gravados com o utils/cashClosePdf.ts de origin/main
// (b946967b), ANTES da seção de trocas. Sessão sem troca tem que sair igual,
// byte a byte (__tests__/cashClosePdfTrocas.test.ts). Nunca regravar.
// ============================================================
import type { CashCloseData } from "@/utils/cashClosePdf";

export const ENTRADAS_SEM_TROCA: { nome: string; data: CashCloseData }[] = [
  {
    nome: "simples",
    data: {
      companyName: "Loja de Moda",
      companyCnpj: "12.345.678/0001-90",
      operatorName: "Caixa 1",
      openedAtIso: "2026-11-14T12:02:00.000Z",
      closedAtIso: "2026-11-14T22:10:00.000Z",
      sessaoLabel: "#00412",
      salesCount: 31,
      newCustomersCount: 2,
      grossRevenue: 5210.7,
      entradasTotal: 5210.7,
      devolucoes: 0,
      trocoInicial: 150,
      vendasEmDinheiro: 400,
      dinheiroEsperado: 550,
      dinheiroContado: 550,
      diferenca: 0,
      observacao: null,
      paymentMix: [
        { label: "Pix", amount: 1530.7 },
        { label: "Crédito", amount: 2480 },
        { label: "Débito", amount: 800 },
        { label: "Dinheiro", amount: 400 },
      ],
    },
  },
  {
    nome: "devolucao-sangria-suprimento",
    data: {
      companyName: "Loja <A> & \"B\"",
      companyCnpj: null,
      operatorName: "Operadora O'Neil",
      openedAtIso: "2026-11-15T11:30:00.000Z",
      closedAtIso: "2026-11-15T21:45:00.000Z",
      sessaoLabel: "#A1B2C",
      salesCount: 12,
      newCustomersCount: 0,
      grossRevenue: 1890.4,
      entradasTotal: 1840.4,
      devolucoes: 50,
      trocoInicial: 100,
      suprimentos: 50,
      sangrias: 200,
      vendasEmDinheiro: 330,
      dinheiroEsperado: 280,
      dinheiroContado: 275.5,
      diferenca: -4.5,
      observacao: "Troco dado a mais <na venda 9>",
      paymentMix: [
        { label: "Pix", amount: 910.4 },
        { label: "Dinheiro", amount: 330 },
        { label: "Débito", amount: 600 },
      ],
    },
  },
  {
    nome: "sem-pagamentos",
    data: {
      companyName: "Loja de Moda",
      operatorName: "Caixa 2",
      openedAtIso: "2026-11-16T13:00:00.000Z",
      closedAtIso: "2026-11-16T13:40:00.000Z",
      salesCount: 0,
      newCustomersCount: 0,
      grossRevenue: 0,
      trocoInicial: 80,
      vendasEmDinheiro: 0,
      dinheiroEsperado: 80,
      dinheiroContado: 90,
      diferenca: 10,
      paymentMix: [],
    },
  },
];
