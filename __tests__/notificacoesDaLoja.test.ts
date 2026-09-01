// ============================================================
// Sino — eventos da loja online (01/09/2026)
//
// O que está sendo protegido aqui é o que decide se a gaveta é usável num dia
// cheio: o corte "precisa de você" x informativo, o colapso de vários eventos
// do mesmo pedido, e o fato de um tipo que o front ainda não conhece não
// sumir do feed (o backend vai continuar criando `loja_*` novos).
// ============================================================
import {
  buildFeed, visualForEvent, ordersToEvents, mergePrefs, defaultPrefs, allMuted,
  dayLabel, severityLabel, StoreEvent,
} from "@/components/notificationEventModel";

const AGORA = new Date("2026-09-01T15:00:00Z").getTime();
const h = (n: number) => new Date(AGORA - n * 3600_000).toISOString();

const ev = (over: Partial<StoreEvent> & { id: string; type: string }): StoreEvent => ({
  title:      over.title || "Evento",
  created_at: over.created_at || h(1),
  ...over,
});

describe("visualForEvent — catálogo e desconhecidos", () => {
  test("tipo conhecido traz rótulo, severidade e se exige ação", () => {
    const v = visualForEvent({ type: "loja_comprovante_enviado" });
    expect(v.label).toBe("Comprovante para conferir");
    expect(v.severity).toBe("atencao");
    expect(v.requiresAction).toBe(true);
  });

  test("pedido entregue é informação, não fila de trabalho", () => {
    expect(visualForEvent({ type: "loja_pedido_entregue" }).requiresAction).toBe(false);
  });

  test("severidade do servidor vence a do catálogo", () => {
    const v = visualForEvent({ type: "loja_pedido_pago", severity: "critico" });
    expect(v.severity).toBe("critico");
    expect(v.accent).toBe("red");
    expect(v.requiresAction).toBe(true);
  });

  test("tipo desconhecido não some do feed — cai no fallback", () => {
    const v = visualForEvent({ type: "loja_tipo_que_nao_existe_ainda" });
    expect(v.label).toBe("Aviso da loja");
    expect(v.severity).toBe("info");
    expect(v.requiresAction).toBe(false);
  });

  test("desconhecido marcado como crítico pelo backend sobe pra fila", () => {
    expect(visualForEvent({ type: "loja_novidade_do_backend", severity: "critico" }).requiresAction).toBe(true);
  });

  test("selo textual existe pra crítico e atenção, não pra info", () => {
    expect(severityLabel("critico")).toBe("Crítico");
    expect(severityLabel("atencao")).toBe("Ação");
    expect(severityLabel("info")).toBeNull();
  });
});

describe("buildFeed — o corte que faz a gaveta caber na tela", () => {
  test("pendência aberta sobe pro topo; lida desce pro dia", () => {
    const feed = buildFeed([
      ev({ id: "1", type: "loja_comprovante_enviado", created_at: h(1) }),
      ev({ id: "2", type: "loja_comprovante_enviado", created_at: h(2), read_at: "2026-09-01T13:00:00Z" }),
      ev({ id: "3", type: "loja_pedido_entregue", created_at: h(3) }),
    ], AGORA);

    expect(feed.acoes.map(i => i.event.id)).toEqual(["1"]);
    expect(feed.actionCount).toBe(1);
    const doDia = feed.dias[0].items.map(i => i.event.id);
    expect(doDia).toContain("2");
    expect(doDia).toContain("3");
  });

  test("crítico vem antes de atenção dentro de 'Precisa de você'", () => {
    const feed = buildFeed([
      ev({ id: "a", type: "loja_comprovante_enviado", created_at: h(1) }),
      ev({ id: "b", type: "loja_sem_pagamento_configurado", created_at: h(5) }),
    ], AGORA);
    expect(feed.acoes.map(i => i.event.id)).toEqual(["b", "a"]);
  });

  test("dois eventos do mesmo pedido viram UM card, com o mais recente na frente", () => {
    const feed = buildFeed([
      ev({ id: "p1", type: "loja_pedido_pago", entity_id: "pedido:9", entity_label: "Pedido #9", created_at: h(4) }),
      ev({ id: "p2", type: "loja_pedido_entregue", entity_id: "pedido:9", entity_label: "Pedido #9", created_at: h(1) }),
      ev({ id: "p3", type: "loja_pedido_pago", entity_id: "pedido:10", created_at: h(2) }),
    ], AGORA);

    const itens = feed.dias[0].items;
    expect(itens).toHaveLength(2);
    const grupo = itens.find(i => i.grouped)!;
    expect(grupo.events.map(e => e.id)).toEqual(["p2", "p1"]);
    expect(grupo.label).toBe("Pedido #9");
    expect(grupo.unread).toBe(2);
  });

  test("300 eventos de 100 pedidos num dia viram 100 cards", () => {
    const eventos: StoreEvent[] = [];
    for (let i = 0; i < 100; i++) {
      ["loja_pedido_novo", "loja_pedido_pago", "loja_pedido_entregue"].forEach((t, k) => {
        eventos.push(ev({
          id: `${t}-${i}`, type: t, entity_id: `pedido:${i}`,
          entity_label: `Pedido #${i}`, created_at: h(1 + k),
        }));
      });
    }
    const feed = buildFeed(eventos, AGORA);
    expect(feed.total).toBe(300);
    expect(feed.dias).toHaveLength(1);
    expect(feed.dias[0].items).toHaveLength(100);
  });

  test("dias diferentes viram seções diferentes, rotuladas", () => {
    const feed = buildFeed([
      ev({ id: "hoje", type: "loja_pedido_pago", created_at: h(1) }),
      ev({ id: "ontem", type: "loja_pedido_pago", created_at: h(30) }),
    ], AGORA);
    expect(feed.dias).toHaveLength(2);
    expect(feed.dias.map(d => d.label)).toEqual(["Hoje", "Ontem"]);
  });

  test("evento sem entity_id nunca é agrupado com outro", () => {
    const feed = buildFeed([
      ev({ id: "x", type: "loja_estoque_baixo", read_at: "x", created_at: h(1) }),
      ev({ id: "y", type: "loja_estoque_baixo", read_at: "x", created_at: h(2) }),
    ], AGORA);
    expect(feed.dias[0].items).toHaveLength(2);
    expect(feed.dias[0].items.every(i => !i.grouped)).toBe(true);
  });

  test("unreadCount conta evento, não card", () => {
    const feed = buildFeed([
      ev({ id: "1", type: "loja_pedido_pago", entity_id: "p", created_at: h(1) }),
      ev({ id: "2", type: "loja_pedido_entregue", entity_id: "p", created_at: h(2) }),
      ev({ id: "3", type: "loja_pedido_pago", read_at: "x", created_at: h(3) }),
    ], AGORA);
    expect(feed.unreadCount).toBe(2);
  });

  test("feed vazio não explode", () => {
    const feed = buildFeed([], AGORA);
    expect(feed).toMatchObject({ acoes: [], dias: [], unreadCount: 0, total: 0 });
  });
});

describe("ordersToEvents — o feed antigo continua funcionando", () => {
  test("pedido de 24h vira evento loja_pedido_novo com rota da origem", () => {
    const [e] = ordersToEvents([{
      id: "77", order_number: 1042, customer_name: "Marina", total: 289.9,
      status: "novo", created_at: h(1), source: "canal_digital",
    }]);
    expect(e.type).toBe("loja_pedido_novo");
    expect(e.entity_id).toBe("pedido:77");
    expect(e.entity_label).toBe("Pedido #1042");
    expect(e.cta_route).toBe("/canal");
    expect(e.title).toContain("Canal Digital");
    expect(e.body).toContain("Marina");
    expect(e.body).toContain("R$ 289,90");
  });

  test("venda de balcão não é rotulada como Studio (regressão de 31/08/2026)", () => {
    const [e] = ordersToEvents([{
      id: "9", order_number: 3, total: 10, status: "ok",
      created_at: h(1), source: "pdv" as any,
    }]);
    expect(e.title).toContain("Caixa");
    expect(e.cta_route).toBe("/vendas");
  });
});

describe("preferências", () => {
  test("defaults: o que a lojista mesmo dispara vem desligado", () => {
    const p = defaultPrefs();
    expect(p.loja_pedido_novo).toBe(true);
    expect(p.loja_pedido_pago).toBe(true);
    expect(p.loja_pedido_saiu_entrega).toBe(false);
    expect(p.loja_pedido_entregue).toBe(false);
  });

  test("tipo fixo não pode ser desligado, nem pelo servidor", () => {
    const p = mergePrefs({
      loja_sem_pagamento_configurado: false,
      loja_comprovante_enviado: false,
      loja_pedido_pago: false,
    });
    expect(p.loja_sem_pagamento_configurado).toBe(true);
    expect(p.loja_comprovante_enviado).toBe(true);
    expect(p.loja_pedido_pago).toBe(false);
  });

  test("servidor sem a rota ainda: cai nos defaults", () => {
    expect(mergePrefs(null)).toEqual(defaultPrefs());
  });

  test("allMuted só quando TODO opcional está off", () => {
    const p = mergePrefs(null);
    expect(allMuted(p)).toBe(false);
    Object.keys(p).forEach(k => { p[k] = false; });
    expect(allMuted(mergePrefs(p))).toBe(true);
  });
});

describe("dayLabel", () => {
  test("hoje, ontem e o resto em dd/mm", () => {
    expect(dayLabel(h(1), AGORA)).toBe("Hoje");
    expect(dayLabel(h(30), AGORA)).toBe("Ontem");
    expect(dayLabel(new Date("2026-08-12T12:00:00Z").toISOString(), AGORA)).toBe("12/08");
  });
});

// A gaveta e o painel de preferências carregam de verdade (pega quebra de
// import/ciclo antes de virar tela branca em produção).
describe("módulos da gaveta", () => {
  test("NotificationDrawer e NotificationPrefs carregam", () => {
    expect(typeof require("@/components/NotificationDrawer").NotificationDrawer).toBe("function");
    expect(typeof require("@/components/NotificationPrefs").NotificationPrefs).toBe("function");
  });
});
