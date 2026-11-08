// ============================================================================
// Indique e ganhe: janela da Black Friday (28/10/2026)
//
// Até 30/11/2026 23:59:59 em Brasília (2026-12-01T02:59:59Z, inclusive) o
// "Como funciona" e a mensagem do WhatsApp são os da campanha BLACK50; um
// instante depois voltam aos textos de hoje, idênticos aos de antes.
// ============================================================================
import {
  FIM_BLACK_FRIDAY_INDICACAO,
  emBlackFridayDaIndicacao,
  comoFuncionaIndicacao,
  descricaoIndicacao,
  mensagemIndicacao,
  faseIndicacao,
} from "@/utils/indicacaoCampanha";

const FIM = FIM_BLACK_FRIDAY_INDICACAO.getTime();
const ANTES = new Date(FIM - 1);
const NO_FIM = new Date(FIM);
const DEPOIS = new Date(FIM + 1);

const BF_DESCRICAO =
  "Indique um lojista e ganhe 1 mensalidade grátis quando ele pagar a primeira. Quem você indicar testa grátis e, até 30/11 ou enquanto houver cupons, ganha 50% na primeira mensalidade com o código BLACK50.";
const BF_ITENS = [
  "Mande o seu link a um conhecido. Até 30/11, ele ganha 50% na primeira mensalidade com o código BLACK50, digitado no pagamento, enquanto houver cupons.",
  "Quando ele pagar a primeira mensalidade, a sua próxima mensalidade sai grátis. Se muitas indicações pagarem no mesmo mês, o mês grátis pode ficar para o mês seguinte. Se você ainda estiver no teste, o mês grátis vale na segunda mensalidade.",
  "Valem até 3 indicações por ano, para contas em dia.",
];
const BF_WHATS =
  "Oi! Tô usando a Aura na minha loja e tá me ajudando bastante. Até 30/11, ou enquanto houver cupons, você ganha 50% na primeira mensalidade com o código BLACK50 (digite no pagamento) e ainda testa antes de assinar. Esse é o meu link: https://getaura.com.br/r/REF-ABC123";

// Textos de hoje (antes desta mudança), byte a byte.
const HOJE_DESCRICAO =
  "Indique um lojista e ganhe 1 mês grátis quando ele pagar a primeira mensalidade. Quem você indicar testa grátis e ganha 20% no primeiro mês.";
const HOJE_ITENS = [
  "O mês grátis vale quando o lojista que você indicou paga a primeira mensalidade.",
  "Se você já assina a Aura, a sua próxima mensalidade a vencer sai por conta da Aura.",
  "Se você ainda está no teste, o mês grátis fica reservado por 60 dias a partir desse pagamento. Assinando nesse prazo, a sua segunda mensalidade sai por conta da Aura.",
  "Vale para até 3 indicações por ano, com a sua mensalidade em dia.",
];
const HOJE_WHATS =
  "Oi! Uso a Aura na minha loja: caixa, estoque e fiado num lugar só. Com o meu código REF-ABC123 você testa 7 dias grátis e ganha 20% de desconto na primeira mensalidade. Começa por aqui: https://getaura.com.br/r/REF-ABC123";

describe("indicação: janela da Black Friday", () => {
  test("o fim é 30/11/2026 23:59:59 em Brasília", () => {
    expect(FIM_BLACK_FRIDAY_INDICACAO.toISOString()).toBe("2026-12-01T02:59:59.000Z");
  });

  test("um instante antes do fim: textos da Black Friday", () => {
    expect(emBlackFridayDaIndicacao(ANTES)).toBe(true);
    expect(descricaoIndicacao(ANTES)).toBe(BF_DESCRICAO);
    expect([...comoFuncionaIndicacao(ANTES)]).toEqual(BF_ITENS);
    expect(mensagemIndicacao("REF-ABC123", ANTES)).toBe(BF_WHATS);
  });

  test("exatamente no fim: textos da Black Friday", () => {
    expect(emBlackFridayDaIndicacao(NO_FIM)).toBe(true);
    expect(descricaoIndicacao(NO_FIM)).toBe(BF_DESCRICAO);
    expect([...comoFuncionaIndicacao(NO_FIM)]).toEqual(BF_ITENS);
    expect(mensagemIndicacao("REF-ABC123", NO_FIM)).toBe(BF_WHATS);
  });

  test("um instante depois do fim: textos de hoje, idênticos", () => {
    expect(emBlackFridayDaIndicacao(DEPOIS)).toBe(false);
    expect(descricaoIndicacao(DEPOIS)).toBe(HOJE_DESCRICAO);
    expect([...comoFuncionaIndicacao(DEPOIS)]).toEqual(HOJE_ITENS);
    expect(mensagemIndicacao("REF-ABC123", DEPOIS)).toBe(HOJE_WHATS);
  });

  test("sem data de início: hoje já é Black Friday", () => {
    expect(emBlackFridayDaIndicacao(new Date("2026-10-28T12:00:00Z"))).toBe(true);
  });

  test("a mensagem da Black Friday troca o {link} pelo link do lojista", () => {
    const m = mensagemIndicacao("X", ANTES);
    expect(m).not.toContain("{link}");
    expect(m.endsWith("Esse é o meu link: https://getaura.com.br/r/X")).toBe(true);
  });
});

// 08/11/2026 (b-mk-30): a fase vem do backend (GET /referrals/mine,
// campanha.fase). BLACK50 esgotado volta o texto de sempre; depois de 30/11 é
// sempre o texto de sempre.
describe("indicação: fase do texto", () => {
  test("sem fase do backend vale a data", () => {
    expect(faseIndicacao(ANTES)).toBe("black");
    expect(faseIndicacao(DEPOIS)).toBe("fixo");
    expect(faseIndicacao(ANTES, "qualquer")).toBe("black");
  });

  test("BLACK50 esgotado: textos de hoje ainda na Black Friday", () => {
    expect(faseIndicacao(ANTES, "sem_black50")).toBe("sem_black50");
    expect(descricaoIndicacao(ANTES, "sem_black50")).toBe(HOJE_DESCRICAO);
    expect([...comoFuncionaIndicacao(ANTES, "sem_black50")]).toEqual(HOJE_ITENS);
    expect(mensagemIndicacao("REF-ABC123", ANTES, "sem_black50")).toBe(HOJE_WHATS);
    expect(mensagemIndicacao("REF-ABC123", ANTES, "sem_black50")).not.toContain("BLACK50");
  });

  test("backend diz black: textos da Black Friday", () => {
    expect(descricaoIndicacao(ANTES, "black")).toBe(BF_DESCRICAO);
    expect(mensagemIndicacao("REF-ABC123", ANTES, "black")).toBe(BF_WHATS);
  });

  test("depois de 30/11 é sempre o texto de sempre, mesmo que o backend diga black", () => {
    expect(faseIndicacao(DEPOIS, "black")).toBe("fixo");
    expect(descricaoIndicacao(DEPOIS, "black")).toBe(HOJE_DESCRICAO);
    expect(mensagemIndicacao("REF-ABC123", DEPOIS, "black")).toBe(HOJE_WHATS);
  });
});
