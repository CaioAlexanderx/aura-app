// ============================================================
// AURA STUDIO · K4 — leitura do fluxo do quadro
//
// Importa as MESMAS funções que a tela usa (lição da K2: teste que
// reimplementa a regra continua passando depois que a tela muda).
//
// O que se trava aqui:
//   1. risco é prazo perto COM trabalho no começo — não só prazo perto
//   2. o gargalo é comparação com o quadro AGORA, e não some com fila
//      pequena, onde percentual não significa nada
//   3. a conta de dias normaliza data pura contra hoje local
// ============================================================
import {
  diasAtePrazo,
  ehAtivo,
  riscoDoCard,
  resumoDaSemana,
  colunaGargalo,
  MINIMO_PRA_GARGALO,
} from "../../components/studio/fluxoDoQuadro";

/** 'YYYY-MM-DD' a N dias de hoje, sem passar por fuso. */
function emDias(n: number): string {
  const h = new Date();
  const d = new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate() + n));
  return d.toISOString().slice(0, 10);
}

const card = (over: Partial<Parameters<typeof riscoDoCard>[0]> = {}) => ({
  id: "c1",
  studio_production_status: "pending_art",
  promised_date: null,
  ...over,
});

describe("dias até o prazo", () => {
  test("hoje é zero, amanhã é um, ontem é menos um", () => {
    expect(diasAtePrazo(emDias(0))).toBe(0);
    expect(diasAtePrazo(emDias(1))).toBe(1);
    expect(diasAtePrazo(emDias(-1))).toBe(-1);
  });

  test("sem prazo ou prazo quebrado devolve null, não zero", () => {
    // Zero significaria "entrega hoje" — o card ficaria vermelho à toa.
    expect(diasAtePrazo(null)).toBeNull();
    expect(diasAtePrazo(undefined)).toBeNull();
    expect(diasAtePrazo("")).toBeNull();
    expect(diasAtePrazo("sem-data")).toBeNull();
  });
});

describe("o que conta como trabalho ativo", () => {
  test("entregue e cancelado saem do fluxo", () => {
    expect(ehAtivo(card({ studio_production_status: "delivered" }))).toBe(false);
    expect(ehAtivo(card({ studio_production_status: "cancelled" }))).toBe(false);
  });

  test("o resto é ativo, inclusive status desconhecido", () => {
    expect(ehAtivo(card({ studio_production_status: "in_production" }))).toBe(true);
    expect(ehAtivo(card({ studio_production_status: null }))).toBe(true);
  });
});

// A regra que dá valor ao aviso: prazo perto não basta.
describe("risco = prazo perto COM trabalho no começo", () => {
  test("entrega em 2 dias e ainda na arte é apertado", () => {
    expect(riscoDoCard(card({ promised_date: emDias(2), studio_production_status: "pending_art" }))).toBe("apertado");
  });

  test("entrega em 2 dias já em produção NÃO é risco", () => {
    // Está sendo feito. Alertar aqui seria ruído, e ruído treina a lojista
    // a ignorar o aviso.
    expect(riscoDoCard(card({ promised_date: emDias(2), studio_production_status: "in_production" }))).toBeNull();
  });

  test("entrega amanhã já pronta NÃO é risco", () => {
    expect(riscoDoCard(card({ promised_date: emDias(1), studio_production_status: "ready" }))).toBeNull();
  });

  test("prazo vencido é atrasado, em qualquer etapa ativa", () => {
    expect(riscoDoCard(card({ promised_date: emDias(-1), studio_production_status: "in_production" }))).toBe("atrasado");
  });

  test("entrega hoje é sempre destaque", () => {
    expect(riscoDoCard(card({ promised_date: emDias(0), studio_production_status: "in_production" }))).toBe("hoje");
  });

  test("entrega longe não é risco, mesmo parada na arte", () => {
    expect(riscoDoCard(card({ promised_date: emDias(10), studio_production_status: "pending_art" }))).toBeNull();
  });

  test("sem prazo não há risco — o quadro fica como era", () => {
    expect(riscoDoCard(card({ promised_date: null }))).toBeNull();
  });

  test("encomenda entregue nunca vira risco, nem com prazo vencido", () => {
    expect(riscoDoCard(card({ promised_date: emDias(-5), studio_production_status: "delivered" }))).toBeNull();
  });
});

describe("resumo da semana", () => {
  test("conta entregas dos próximos 7 dias, atrasadas à parte", () => {
    const r = resumoDaSemana([
      card({ id: "a", promised_date: emDias(-2) }),
      card({ id: "b", promised_date: emDias(0) }),
      card({ id: "c", promised_date: emDias(3) }),
      card({ id: "d", promised_date: emDias(20) }),   // fora da semana
      card({ id: "e", promised_date: null }),          // sem prazo
    ]);
    expect(r.atrasadas).toBe(1);
    expect(r.hoje).toBe(1);
    expect(r.total).toBe(2);      // hoje + em 3 dias
  });

  test("entregue não entra na conta, nem atrasado", () => {
    const r = resumoDaSemana([
      card({ promised_date: emDias(-3), studio_production_status: "delivered" }),
    ]);
    expect(r.atrasadas).toBe(0);
    expect(r.total).toBe(0);
  });

  test("quadro sem prazo nenhum devolve tudo zero — a régua nem aparece", () => {
    const r = resumoDaSemana([card(), card(), card()]);
    expect(r).toEqual({ total: 0, atrasadas: 0, hoje: 0, emRisco: 0 });
  });
});

describe("coluna que segura o fluxo", () => {
  const colunas = ["awaiting_customization", "pending_art", "approved", "in_production", "ready"];
  const nCards = (n: number) => Array.from({ length: n }, (_, i) => card({ id: `x${i}` }));

  test("aponta a etapa que concentra mais da metade do trabalho", () => {
    const porStatus: any = { pending_art: nCards(8), in_production: nCards(2), approved: nCards(1), awaiting_customization: [], ready: [] };
    expect(colunaGargalo(porStatus, colunas)).toBe("pending_art");
  });

  test("trabalho distribuído não aponta ninguém", () => {
    const porStatus: any = { pending_art: nCards(3), in_production: nCards(3), approved: nCards(3), awaiting_customization: [], ready: [] };
    expect(colunaGargalo(porStatus, colunas)).toBeNull();
  });

  // Sem piso, "2 de 3 cards" seria 67% e acusaria gargalo num quadro vazio.
  test("fila pequena não vira gargalo", () => {
    const porStatus: any = { pending_art: nCards(MINIMO_PRA_GARGALO - 1), in_production: [], approved: [], awaiting_customization: [], ready: [] };
    expect(colunaGargalo(porStatus, colunas)).toBeNull();
  });

  test("quadro vazio não quebra", () => {
    expect(colunaGargalo({}, colunas)).toBeNull();
  });

  // "Entregue" não é fila: contá-la faria toda loja produtiva parecer
  // engargalada no fim do fluxo.
  test("a coluna de entregues fica fora da conta", () => {
    const porStatus: any = { delivered: nCards(50), pending_art: nCards(3), in_production: nCards(3), approved: [], awaiting_customization: [], ready: [] };
    expect(colunaGargalo(porStatus, colunas)).toBeNull();
  });
});
