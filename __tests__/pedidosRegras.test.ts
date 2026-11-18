// ============================================================
// Aba Pedidos: contas puras (A5a/A5b, 17/11/2026)
// ============================================================
import {
  chipsDosPedidos, dataCurta, dataLonga, quandoVemBuscar, estaAtrasado, proximaAcao,
  rotuloDaSituacao, textoDoLembrete, linkDoAviso, pecasDaLinha, porLoja, guardadoEm,
  hojeEmSaoPaulo, seloDeAtraso,
} from "@/components/screens/vendas/pedidos/regrasDosPedidos";
import { parametrosDoChip } from "@/hooks/usePedidos";
import { pedidoLiberado, PEDIDO_LIBERADO } from "@/utils/pedidoLiberado";

jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({}) }));

describe("trava", () => {
  it("nasce desligada; lojista não passa, equipe Aura passa", () => {
    expect(PEDIDO_LIBERADO).toBe(false);
    expect(pedidoLiberado({ is_staff: false })).toBe(false);
    expect(pedidoLiberado(null)).toBe(false);
    expect(pedidoLiberado({ is_staff: "true" })).toBe(false);
    expect(pedidoLiberado({ is_staff: true })).toBe(true);
    expect(pedidoLiberado({ is_staff: false }, true)).toBe(true);
  });
});

describe("parâmetros da lista", () => {
  it("chip vira situação; atrasados = abertos + atrasados=1; busca escapada", () => {
    expect(parametrosDoChip("abertos", "")).toBe("situacao=abertos&limit=100");
    expect(parametrosDoChip("atrasados", "")).toBe("situacao=abertos&atrasados=1&limit=100");
    expect(parametrosDoChip("prontos", " Ana & Cia ")).toBe("situacao=prontos&q=Ana%20%26%20Cia&limit=100");
  });
});

describe("chips", () => {
  it("ordem e textos do mockup; Concluídos e Cancelados sem número", () => {
    const c = chipsDosPedidos({ abertos: 7, aguardando: 3, separando: 2, prontos: 2, concluidos: 9, cancelados: 1, atrasados: 2, todos: 19 });
    expect(c.map((x) => x.label)).toEqual(["Abertos", "Atrasados", "Aguardando", "Separando ou em produção", "Prontos", "Concluídos", "Cancelados"]);
    expect(c.map((x) => x.contagem)).toEqual([7, 2, 3, 2, 2, undefined, undefined]);
  });
});

describe("situação", () => {
  it("rótulos e próxima ação (só para a frente)", () => {
    expect(rotuloDaSituacao("confirmed")).toBe("Aguardando");
    expect(rotuloDaSituacao("preparing")).toBe("Separando");
    expect(rotuloDaSituacao("ready")).toBe("Pronto");
    expect(rotuloDaSituacao("delivered")).toBe("Concluído");
    expect(rotuloDaSituacao("cancelled")).toBe("Cancelado");
    expect(proximaAcao("confirmed")).toEqual({ status: "preparing", label: "Separar" });
    expect(proximaAcao("preparing")).toEqual({ status: "ready", label: "Pronto" });
    expect(proximaAcao("ready")).toBeNull();
    expect(proximaAcao("delivered")).toBeNull();
    expect(proximaAcao("cancelled")).toBeNull();
  });
});

describe("datas", () => {
  const hoje = "2026-11-17";
  it("data curta e longa", () => {
    expect(dataCurta("2026-11-14")).toBe("sáb, 14/11");
    expect(dataLonga("2026-11-20")).toBe("sexta, 20/11");
    expect(dataCurta(null)).toBe("sem data");
  });
  it("atrasado, amanhã, em N dias", () => {
    expect(quandoVemBuscar("ready", "2026-11-14", hoje)).toBe("atrasado 3 dias");
    expect(quandoVemBuscar("confirmed", "2026-11-16", hoje)).toBe("atrasado 1 dia");
    expect(quandoVemBuscar("confirmed", "2026-11-18", hoje)).toBe("amanhã");
    expect(quandoVemBuscar("confirmed", "2026-11-20", hoje)).toBe("em 3 dias");
    expect(quandoVemBuscar("delivered", "2026-11-14", hoje)).toBe("");
    expect(seloDeAtraso(3)).toBe("Atrasado 3 dias");
  });
  it("atraso só em pedido aberto e com data", () => {
    expect(estaAtrasado("confirmed", "2026-11-16", hoje)).toBe(true);
    expect(estaAtrasado("confirmed", "2026-11-17", hoje)).toBe(false);
    expect(estaAtrasado("delivered", "2026-11-01", hoje)).toBe(false);
    expect(estaAtrasado("ready", null, hoje)).toBe(false);
  });
  it("hoje em São Paulo vira o dia às 3h UTC", () => {
    expect(hojeEmSaoPaulo(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
    expect(hojeEmSaoPaulo(new Date("2026-11-18T03:30:00Z"))).toBe("2026-11-18");
  });
  it("guardado hoje / em outro dia", () => {
    expect(guardadoEm("2026-11-17T13:42:00Z", hoje)).toBe("guardado hoje, 10:42");
    expect(guardadoEm("2026-11-15T13:42:00Z", hoje)).toBe("guardado 15/11, 10:42");
  });
});

describe("textos da linha", () => {
  it("peças e números por loja", () => {
    expect(pecasDaLinha("Jaqueta Sarja Preta · G", 1)).toBe("Jaqueta Sarja Preta · G · 1 peça");
    expect(pecasDaLinha(null, 2)).toBe("2 peças");
    expect(porLoja([{ company_name: "Centro", valor: 7 }, { company_name: "Shopping", valor: 4 }, { company_name: null, valor: 1 }])).toBe("Centro 7 · Shopping 4");
  });
});

describe("WhatsApp", () => {
  it("o texto do mockup, com o primeiro nome e a peça", () => {
    expect(textoDoLembrete("Carla Menezes", "Jaqueta")).toBe(
      "Oi, Carla! Sua jaqueta está separada aqui na loja esperando por você. Quando fica bom passar?"
    );
  });
  it("a variação fica fora da mensagem", () => {
    expect(textoDoLembrete("Carla", "Jaqueta Sarja Preta · G")).toBe(
      "Oi, Carla! Sua jaqueta Sarja Preta está separada aqui na loja esperando por você. Quando fica bom passar?"
    );
  });
  it("wa.me com DDI; sem telefone, sem link", () => {
    const l = linkDoAviso("(12) 98114-2210", "Carla", "Jaqueta");
    expect(l).toMatch(/^https:\/\/wa\.me\/5512981142210\?text=Oi%2C%20Carla!/);
    expect(linkDoAviso(null, "Carla", "Jaqueta")).toBeNull();
    expect(linkDoAviso("123", "Carla", "Jaqueta")).toBeNull();
  });
});
