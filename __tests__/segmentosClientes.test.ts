// ============================================================
// segmentos — Fase 1 (C1.2): segmentos prontos em português, uma tag por
// cliente.
//
// Cobre a prioridade da tag única (Devendo > Perdido > Sumido > Em risco
// > VIP > Recorrente > Novo > Comprou uma vez > fallback), o VIP relativo
// (top 10%/20% conforme o tamanho da base), o "em risco" por intervalo
// habitual do próprio cliente, os dois fallbacks que garantem que ninguém
// fica sem tag, e `resumoDosSegmentos` (contagem + R$ em jogo por
// segmento). `diasSemComprar.ts` continua a régua única de dias — este
// teste não redefine limiar nenhum, só usa `classificarDias`/
// `diasSemComprar` de lá pra montar os cenários.
// ============================================================
import {
  classificarCliente,
  contextoDaBase,
  resumoDosSegmentos,
  rotuloDoSegmento,
  intervaloHabitualDias,
  ehAniversarianteDoMes,
  ORDEM_SEGMENTOS,
  SEGMENTOS,
  type ClienteSegmentavel,
} from "@/components/screens/clientes/segmentos";

// Relógio fixo, mesma data usada em __tests__/diasSemComprar.test.ts —
// 16/09/2026, meio-dia. Sem isto o teste passa ou falha conforme a hora
// em que roda.
const AGORA = new Date(2026, 8, 16, 12, 0, 0).getTime();

/** Data "dd/mm/aaaa" de N dias atrás, do jeito que o app guarda. */
function haDias(n: number): string {
  const d = new Date(AGORA - n * 864e5);
  return d.toLocaleDateString("pt-BR");
}

function cliente(overrides: Partial<ClienteSegmentavel>): ClienteSegmentavel {
  return {
    totalSpent: 100,
    visits: 1,
    lastPurchase: haDias(5),
    firstVisit: haDias(5),
    creditBalance: 0,
    ...overrides,
  };
}

describe("classificarCliente — um segmento por cliente", () => {
  it("Devendo: saldo de crediário em aberto > 0", () => {
    const r = classificarCliente(cliente({ creditBalance: 150 }));
    expect(r.segmento).toBe("devendo");
    expect(r.motivo).toContain("em aberto");
  });

  it("Pronto pra comprar: só calcula quando há data de quitação (campo defensivo)", () => {
    const semDado = classificarCliente(cliente({ creditBalance: 0, visits: 5, lastPurchase: haDias(5), firstVisit: haDias(400) }));
    expect(semDado.segmento).not.toBe("pronto_pra_comprar");

    const comDado = classificarCliente(cliente({
      creditBalance: 0, visits: 5, lastPurchase: haDias(5), firstVisit: haDias(400),
      creditPaidOffAt: haDias(3),
    }));
    expect(comDado.segmento).toBe("pronto_pra_comprar");
    expect(comDado.motivo).toContain("quitou");
  });

  it("Perdido: 121+ dias sem comprar (régua única)", () => {
    const r = classificarCliente(cliente({ lastPurchase: haDias(150), firstVisit: haDias(500) }));
    expect(r.segmento).toBe("perdido");
    expect(r.motivo).toContain("150 dias");
  });

  it("Sumido: 61 a 120 dias — era o 'Inativo' da régua única", () => {
    const r61 = classificarCliente(cliente({ lastPurchase: haDias(61), firstVisit: haDias(200) }));
    expect(r61.segmento).toBe("sumido");
    const r120 = classificarCliente(cliente({ lastPurchase: haDias(120), firstVisit: haDias(200) }));
    expect(r120.segmento).toBe("sumido");
    // fronteiras: 60 não é sumido, 121 já é perdido
    expect(classificarCliente(cliente({ lastPurchase: haDias(60), firstVisit: haDias(200) })).segmento).not.toBe("sumido");
    expect(classificarCliente(cliente({ lastPurchase: haDias(121), firstVisit: haDias(200) })).segmento).toBe("perdido");
  });

  it("Em risco pela régua: 31 a 60 dias sem comprar", () => {
    const r = classificarCliente(cliente({ lastPurchase: haDias(45), firstVisit: haDias(200), visits: 1 }));
    expect(r.segmento).toBe("em_risco");
    expect(r.motivo).toContain("45 dias");
  });

  it("Em risco pelo intervalo habitual: passou de 1,5x o próprio ritmo, mesmo dentro dos 30 dias", () => {
    // 4 compras (3 intervalos) num total de 15 dias entre a 1ª e a última
    // => intervalo habitual de 5 dias. 10 dias parado é mais que 1,5x isso
    // (7,5), mas ainda cai na faixa "ativo" da régua (0–30) — só o
    // intervalo relativo pega este caso.
    const c = cliente({ visits: 4, firstVisit: haDias(25), lastPurchase: haDias(10) });
    expect(intervaloHabitualDias(c, AGORA)).toBe(5);
    const r = classificarCliente(c, undefined, AGORA);
    expect(r.segmento).toBe("em_risco");
    expect(r.motivo).toContain("a cada 5 dias");
  });

  it("intervalo habitual exige 3+ compras e datas calculáveis", () => {
    expect(intervaloHabitualDias(cliente({ visits: 2, firstVisit: haDias(20), lastPurchase: haDias(5) }), AGORA)).toBeNull();
    expect(intervaloHabitualDias(cliente({ visits: 4, firstVisit: haDias(5), lastPurchase: haDias(20) }), AGORA)).toBeNull(); // 1ª visita depois da última compra
    expect(intervaloHabitualDias(cliente({ visits: 4, firstVisit: "---", lastPurchase: haDias(20) }), AGORA)).toBeNull();
  });

  it("Recorrente: 3+ compras e ativo (0–30 dias)", () => {
    const r = classificarCliente(cliente({
      visits: 3, totalSpent: 300, lastPurchase: haDias(5), firstVisit: haDias(90),
    }));
    expect(r.segmento).toBe("recorrente");
    expect(r.motivo).toContain("3 compras");
  });

  it("Novo: primeira compra/cadastro nos últimos 30 dias e ≤2 compras", () => {
    const semCompra = classificarCliente(cliente({ visits: 0, firstVisit: haDias(10), lastPurchase: "---" }));
    expect(semCompra.segmento).toBe("novo");
    expect(semCompra.motivo).toContain("cadastrado");

    const comUmaCompra = classificarCliente(cliente({ visits: 1, firstVisit: haDias(10), lastPurchase: haDias(10) }));
    expect(comUmaCompra.segmento).toBe("novo");
    expect(comUmaCompra.motivo).toContain("primeira compra");

    const comDuasCompras = classificarCliente(cliente({ visits: 2, firstVisit: haDias(10), lastPurchase: haDias(3) }));
    expect(comDuasCompras.segmento).toBe("novo");
  });

  it("Comprou uma vez: exatamente 1 compra, fora da janela de Novo", () => {
    const r = classificarCliente(cliente({ visits: 1, firstVisit: haDias(90), lastPurchase: haDias(20) }));
    expect(r.segmento).toBe("comprou_uma_vez");
    expect(r.motivo).toContain("uma vez");
  });

  it("fallback 'ativo': comprou nos últimos 30 dias mas não é VIP/Recorrente/Novo", () => {
    // 2 compras (não é Recorrente, que exige 3+), cadastro antigo (não é
    // Novo), sem crediário, gasto baixo (não é VIP).
    const r = classificarCliente(cliente({ visits: 2, totalSpent: 50, firstVisit: haDias(200), lastPurchase: haDias(10) }));
    expect(r.segmento).toBe("ativo");
  });

  it("fallback 'sem_compras': nunca comprou e o cadastro já passou de 30 dias", () => {
    const r = classificarCliente(cliente({ visits: 0, totalSpent: 0, firstVisit: haDias(200), lastPurchase: "---" }));
    expect(r.segmento).toBe("sem_compras");
    expect(r.motivo).toContain("ainda não comprou");
  });
});

describe("prioridade da tag única", () => {
  it("Devendo vence Perdido e um gasto que seria VIP", () => {
    const base10 = Array.from({ length: 10 }, (_, i) => ({ totalSpent: (i + 1) * 100 }));
    const contexto = contextoDaBase(base10);
    const r = classificarCliente(cliente({
      creditBalance: 80, totalSpent: 5000, visits: 20,
      lastPurchase: haDias(200), firstVisit: haDias(600),
    }), contexto);
    expect(r.segmento).toBe("devendo");
  });

  it("Perdido vence o gatilho de intervalo (que também dispararia 'em risco')", () => {
    // Mesmo cenário de intervalo curto do teste acima, mas agora 200 dias
    // parado — perdido (prioridade 3) tem que vencer em_risco (prioridade 5).
    const r = classificarCliente(cliente({ visits: 4, firstVisit: haDias(215), lastPurchase: haDias(200) }));
    expect(r.segmento).toBe("perdido");
  });

  it("Sumido vence um gasto que seria VIP", () => {
    const base10 = Array.from({ length: 10 }, (_, i) => ({ totalSpent: (i + 1) * 100 }));
    const contexto = contextoDaBase(base10);
    const r = classificarCliente(cliente({
      totalSpent: 5000, visits: 20, lastPurchase: haDias(90), firstVisit: haDias(400),
    }), contexto);
    expect(r.segmento).toBe("sumido");
  });

  it("VIP vence Recorrente quando as duas condições valem pro mesmo cliente", () => {
    const base10 = Array.from({ length: 10 }, (_, i) => ({ totalSpent: (i + 1) * 100 }));
    const contexto = contextoDaBase(base10); // limiar = 900 (top 20% de 10)
    const r = classificarCliente(cliente({
      totalSpent: 1000, visits: 5, lastPurchase: haDias(5), firstVisit: haDias(90),
    }), contexto);
    expect(r.segmento).toBe("vip");
  });
});

describe("VIP relativo (contextoDaBase)", () => {
  it("base pequena (<20 clientes): top 20% por gasto", () => {
    const base = Array.from({ length: 10 }, (_, i) => ({ totalSpent: (i + 1) * 100 })); // 100..1000
    const contexto = contextoDaBase(base);
    expect(contexto.totalClientes).toBe(10);
    expect(contexto.percentualVip).toBe(0.2);
    expect(contexto.limiarVip).toBe(900); // 2º maior (ceil(10*0.2)=2)

    expect(classificarCliente(cliente({ totalSpent: 1000, visits: 3, firstVisit: haDias(90), lastPurchase: haDias(5) }), contexto).segmento).toBe("vip");
    expect(classificarCliente(cliente({ totalSpent: 900, visits: 3, firstVisit: haDias(90), lastPurchase: haDias(5) }), contexto).segmento).toBe("vip");
    expect(classificarCliente(cliente({ totalSpent: 800, visits: 3, firstVisit: haDias(90), lastPurchase: haDias(5) }), contexto).segmento).not.toBe("vip");
  });

  it("base grande (20+ clientes): top 10% por gasto", () => {
    const base = Array.from({ length: 20 }, (_, i) => ({ totalSpent: (i + 1) * 100 })); // 100..2000
    const contexto = contextoDaBase(base);
    expect(contexto.totalClientes).toBe(20);
    expect(contexto.percentualVip).toBe(0.1);
    expect(contexto.limiarVip).toBe(1900); // 2º maior (ceil(20*0.1)=2)

    expect(classificarCliente(cliente({ totalSpent: 2000, visits: 3, firstVisit: haDias(90), lastPurchase: haDias(5) }), contexto).segmento).toBe("vip");
    expect(classificarCliente(cliente({ totalSpent: 1000, visits: 3, firstVisit: haDias(90), lastPurchase: haDias(5) }), contexto).segmento).not.toBe("vip");
  });

  it("VIP tem piso de 2 compras — 1 compra não conta mesmo sendo o maior gasto", () => {
    const base = Array.from({ length: 10 }, (_, i) => ({ totalSpent: (i + 1) * 100 }));
    const contexto = contextoDaBase(base);
    const r = classificarCliente(cliente({
      totalSpent: 1000, visits: 1, firstVisit: haDias(90), lastPurchase: haDias(20),
    }), contexto);
    expect(r.segmento).not.toBe("vip");
  });

  it("base vazia: ninguém vira VIP (limiar é Infinity)", () => {
    const contexto = contextoDaBase([]);
    expect(contexto.limiarVip).toBe(Infinity);
    expect(classificarCliente(cliente({ totalSpent: 999999, visits: 10, firstVisit: haDias(90), lastPurchase: haDias(5) }), contexto).segmento).not.toBe("vip");
  });

  it("sem contexto (chamada avulsa), ninguém vira VIP", () => {
    const r = classificarCliente(cliente({ totalSpent: 999999, visits: 10, firstVisit: haDias(90), lastPurchase: haDias(5) }));
    expect(r.segmento).not.toBe("vip");
  });
});

describe("resumoDosSegmentos", () => {
  it("conta cada cliente uma vez, no segmento que ele recebeu, e soma o gasto histórico (emJogo)", () => {
    const clientes: ClienteSegmentavel[] = [
      cliente({ creditBalance: 100, totalSpent: 500 }),                                   // devendo
      cliente({ creditBalance: 50, totalSpent: 300 }),                                    // devendo
      cliente({ lastPurchase: haDias(150), firstVisit: haDias(500), totalSpent: 200 }),   // perdido
      cliente({ lastPurchase: haDias(90), firstVisit: haDias(300), totalSpent: 400 }),    // sumido
      cliente({ lastPurchase: haDias(45), firstVisit: haDias(200), totalSpent: 150 }),    // em_risco
    ];
    const resumo = resumoDosSegmentos(clientes, AGORA);

    const devendo = resumo.find(r => r.segmento === "devendo")!;
    expect(devendo.quantidade).toBe(2);
    expect(devendo.emJogo).toBe(800); // 500 + 300

    const perdido = resumo.find(r => r.segmento === "perdido")!;
    expect(perdido.quantidade).toBe(1);
    expect(perdido.emJogo).toBe(200);

    const sumido = resumo.find(r => r.segmento === "sumido")!;
    expect(sumido.quantidade).toBe(1);
    expect(sumido.emJogo).toBe(400);

    const emRisco = resumo.find(r => r.segmento === "em_risco")!;
    expect(emRisco.quantidade).toBe(1);
    expect(emRisco.emJogo).toBe(150);

    // Soma das quantidades bate com o total de clientes — ninguém some,
    // ninguém conta duas vezes.
    expect(resumo.reduce((s, r) => s + r.quantidade, 0)).toBe(clientes.length);
  });

  it("devolve todos os segmentos, na ordem de prioridade, mesmo com quantidade zero", () => {
    const resumo = resumoDosSegmentos([cliente({ creditBalance: 10 })], AGORA);
    expect(resumo.map(r => r.segmento)).toEqual(ORDEM_SEGMENTOS);
    const semDados = resumo.filter(r => r.segmento !== "devendo");
    expect(semDados.every(r => r.quantidade === 0 && r.emJogo === 0)).toBe(true);
  });

  it("base vazia: todos os segmentos com quantidade zero", () => {
    const resumo = resumoDosSegmentos([], AGORA);
    expect(resumo.every(r => r.quantidade === 0)).toBe(true);
  });
});

describe("rótulos e cores dos segmentos", () => {
  it("cada segmento tem rótulo em português e cor definidos", () => {
    for (const id of ORDEM_SEGMENTOS) {
      expect(rotuloDoSegmento(id)).toBeTruthy();
      expect(SEGMENTOS[id].cor.bVar).toBeTruthy();
      expect(SEGMENTOS[id].cor.fVar).toBeTruthy();
    }
  });

  // Rótulo visível trocou de "Inativo" pra "Sumido" (I1.2) — a chave
  // interna da régua única (diasSemComprar.ts) continua "inativo".
  it("o rótulo de 'sumido' é 'Sumido', não mais 'Inativo'", () => {
    expect(rotuloDoSegmento("sumido")).toBe("Sumido");
  });
});

describe("Aniversariante do mês — segmento de filtro, não disputa a tag única", () => {
  it("compara só o mês do aniversário com o mês corrente", () => {
    expect(ehAniversarianteDoMes("15/09/2026", AGORA)).toBe(true); // setembro (mês 9, index 8)
    expect(ehAniversarianteDoMes("15/09", AGORA)).toBe(true);
    expect(ehAniversarianteDoMes("15/08/2026", AGORA)).toBe(false);
    expect(ehAniversarianteDoMes("", AGORA)).toBe(false);
    expect(ehAniversarianteDoMes(undefined, AGORA)).toBe(false);
  });

  it("não aparece na classificação da tag única — devendo continua vencendo mesmo no mês de aniversário", () => {
    const r = classificarCliente(cliente({ creditBalance: 10, firstVisit: "15/09/2020" }));
    expect(r.segmento).toBe("devendo");
  });
});
