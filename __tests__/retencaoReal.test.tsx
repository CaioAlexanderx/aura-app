// ============================================================
// Aba Retenção real + cards de retenção/aniversário no consolidado
// (Fase 1, C1.8).
//
// O que estes testes seguram:
//
// 1. services/retentionCalc.ts — as contas puras (recompra em 90/180
//    dias, intervalo médio, voltaram no mês, novos×retornando por mês,
//    distribuição pela régua, resumo de retenção), incluindo as
//    aproximações documentadas no próprio arquivo (a lista só tem
//    primeira e última compra, não cada compra do meio).
// 2. RetentionTab — os quatro estados (carregando, erro, "ainda é cedo",
//    conteúdo completo) e que os botões levam para a reativação com o
//    ?dias= certo.
// 3. RetentionCard e BirthdaysCard no consolidado: por que sumiam
//    (company vira null, não falta de dado) e que agora aparecem
//    somando as lojas — cliente conta uma vez, aniversariante mostra a
//    loja de origem, e a ação de aniversário troca de loja em vez de
//    mandar a chamada para a empresa errada (BirthdayCouponModal é
//    escopo fora desta mudança).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  BASE_MINIMA,
  contarComCompra,
  recompraEmDias,
  intervaloMedioEntreCompras,
  clientesQueVoltaramNoMes,
  novosXRetornandoPorMes,
  distribuicaoPorFaixa,
  computeRetentionSummary,
} from "@/services/retentionCalc";
import { proximoAniversario, birthdaysFromConsolidatedCustomers } from "@/components/screens/dashboard/BirthdaysCard";

// ── Mocks compartilhados pelos testes de componente ──────────
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));

var mockAuthState: any = {};
var mockRefreshMe = jest.fn();
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector?: any) {
      return typeof selector === "function" ? selector(mockAuthState) : mockAuthState;
    },
    { getState: () => ({ ...mockAuthState, refreshMe: mockRefreshMe }) }
  ),
}));

var mockCustomersHook: any = {};
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => mockCustomersHook }));

var mockRetention = jest.fn();
var mockBirthdays = jest.fn();
var mockSentThisYear = jest.fn();
jest.mock("@/services/api", () => ({
  companiesApi: {
    retention: (...a: any[]) => mockRetention(...a),
    birthdays: (...a: any[]) => mockBirthdays(...a),
  },
  birthdayApi: { sentThisYear: (...a: any[]) => mockSentThisYear(...a) },
}));

var mockMeCustomers = jest.fn();
jest.mock("@/services/meAggregates", () => ({
  meAggregatesApi: { customers: (...a: any[]) => mockMeCustomers(...a) },
}));

jest.mock("@/components/BirthdayCouponModal", () => ({ BirthdayCouponModal: () => null }));
jest.mock("@/components/whatsapp/AniversarioAutoCard", () => ({ AniversarioAutoCard: () => null }));
jest.mock("@/services/messaging", () => ({
  normalizeBrPhone: (p: string) => (String(p || "").replace(/\D/g, "").length >= 10 ? p : null),
}));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import { RetentionTab } from "@/components/screens/clientes/RetentionTab";
import { RetentionCard } from "@/components/RetentionCard";
import { BirthdaysCard } from "@/components/screens/dashboard/BirthdaysCard";

// ── Fixtures ──────────────────────────────────────────────────
const AGORA = new Date(2026, 8, 16, 12, 0, 0).getTime(); // 16/09/2026, meio-dia

function dataHaDias(dias: number): string {
  return new Date(AGORA - dias * 864e5).toLocaleDateString("pt-BR");
}
function dataBR(diaMesAno: string): string {
  return diaMesAno; // já no formato dd/mm/aaaa
}
function cliente(over: any = {}) {
  return {
    id: String(Math.random()), name: "Fulano", email: "", phone: "", instagram: "",
    birthday: "", lastPurchase: "---", totalSpent: 0, visits: 0, firstVisit: "---",
    notes: "", rating: null, creditBalance: 0, company_id: null, company_name: null,
    ...over,
  };
}

async function flush(voltas: number = 3) {
  for (let i = 0; i < voltas; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

// ============================================================
// 1. services/retentionCalc.ts — funções puras
// ============================================================
describe("retentionCalc — recompraEmDias", () => {
  // cA: 200 dias de casa, última compra há 50 (intervalo 150) — elegível
  // nos dois cortes, recompra só no de 180.
  const cA = cliente({ firstVisit: dataHaDias(200), lastPurchase: dataHaDias(50), visits: 2 });
  // cB: 100 dias de casa, última há 10 (intervalo 90) — elegível só no
  // corte de 90 (100 < 180), e recompra nele.
  const cB = cliente({ firstVisit: dataHaDias(100), lastPurchase: dataHaDias(10), visits: 3 });
  // cC: cliente novo demais (5 dias) — fora dos dois cortes.
  const cC = cliente({ firstVisit: dataHaDias(5), lastPurchase: dataHaDias(5), visits: 1 });
  // cD: 300 dias de casa, uma compra só — elegível nos dois, nunca recompra.
  const cD = cliente({ firstVisit: dataHaDias(300), lastPurchase: dataHaDias(300), visits: 1 });
  // cE: nunca comprou — fora de tudo.
  const cE = cliente({ firstVisit: "---", lastPurchase: "---", visits: 0 });

  const BASE = [cA, cB, cC, cD, cE];

  it("recompra em 90 dias: só quem tem 90+ dias de casa entra na conta", () => {
    const r = recompraEmDias(BASE, 90, AGORA);
    // Elegíveis: cA, cB, cD (cC é novo demais, cE nunca comprou)
    expect(r.elegiveis).toBe(3);
    // Recompraram em até 90 dias: só cB (intervalo 90 <= 90)
    expect(r.recompraram).toBe(1);
    expect(r.percentual).toBeCloseTo((1 / 3) * 100, 5);
  });

  it("recompra em 180 dias: cB fica de fora (só tem 100 dias de casa)", () => {
    const r = recompraEmDias(BASE, 180, AGORA);
    // Elegíveis: cA (200>=180), cD (300>=180) — cB não teve tempo (100<180)
    expect(r.elegiveis).toBe(2);
    // Recompraram: cA (intervalo 150 <= 180)
    expect(r.recompraram).toBe(1);
    expect(r.percentual).toBeCloseTo(50, 5);
  });

  it("base vazia ou sem elegíveis devolve percentual null", () => {
    expect(recompraEmDias([], 90, AGORA)).toEqual({ elegiveis: 0, recompraram: 0, percentual: null });
    expect(recompraEmDias([cC, cE], 90, AGORA).percentual).toBeNull();
  });
});

describe("retentionCalc — intervaloMedioEntreCompras", () => {
  it("distribui o intervalo entre 1ª e última compra pelo número de compras", () => {
    // 90 dias de intervalo / 2 (3 compras = 2 intervalos) = 45
    const cB = cliente({ firstVisit: dataHaDias(100), lastPurchase: dataHaDias(10), visits: 3 });
    // 60 dias de intervalo / 1 (2 compras) = 60
    const cF = cliente({ firstVisit: dataHaDias(60), lastPurchase: dataHaDias(0), visits: 2 });
    // Excluídos: 1 compra só, sem datas, e datas invertidas/iguais
    const cD = cliente({ firstVisit: dataHaDias(300), lastPurchase: dataHaDias(300), visits: 1 });
    const cE = cliente({ firstVisit: "---", lastPurchase: "---", visits: 0 });
    const cG = cliente({ firstVisit: dataHaDias(0), lastPurchase: dataHaDias(0), visits: 2 });

    const media = intervaloMedioEntreCompras([cB, cF, cD, cE, cG]);
    expect(media).toBeCloseTo((45 + 60) / 2, 5);
  });

  it("sem ninguém com 2+ compras válidas, devolve null", () => {
    const cD = cliente({ firstVisit: dataHaDias(300), lastPurchase: dataHaDias(300), visits: 1 });
    expect(intervaloMedioEntreCompras([cD])).toBeNull();
  });
});

describe("retentionCalc — clientesQueVoltaramNoMes", () => {
  it("só conta quem comprou de novo ESTE mês e não é a 1ª compra deste mês", () => {
    const voltou = cliente({ firstVisit: "10/08/2026", lastPurchase: "05/09/2026", visits: 2 }); // conta
    const novoComprandoDeNovo = cliente({ firstVisit: "01/09/2026", lastPurchase: "10/09/2026", visits: 3 }); // não conta
    const naoVoltouEsteMes = cliente({ firstVisit: "10/08/2026", lastPurchase: "20/08/2026", visits: 2 }); // não conta
    const soUmaCompra = cliente({ firstVisit: "05/09/2026", lastPurchase: "05/09/2026", visits: 1 }); // não conta

    const n = clientesQueVoltaramNoMes([voltou, novoComprandoDeNovo, naoVoltouEsteMes, soUmaCompra], AGORA);
    expect(n).toBe(1);
  });
});

describe("retentionCalc — novosXRetornandoPorMes", () => {
  it("classifica novos pelo mês da 1ª compra e retornando pelo mês da última (se diferente)", () => {
    const novoAbril = cliente({ firstVisit: "15/04/2026", lastPurchase: "15/04/2026", visits: 1 });
    const novoMaioVoltaAgosto = cliente({ firstVisit: "10/05/2026", lastPurchase: "12/08/2026", visits: 2 });
    const novoSetembroCompraDeNovoSetembro = cliente({ firstVisit: "01/09/2026", lastPurchase: "01/09/2026", visits: 2 });
    // Cliente de antes da janela de 6 meses (janeiro) que volta dentro dela (junho).
    const antigoVoltaJunho = cliente({ firstVisit: "01/01/2026", lastPurchase: "20/06/2026", visits: 5 });

    const meses = novosXRetornandoPorMes(
      [novoAbril, novoMaioVoltaAgosto, novoSetembroCompraDeNovoSetembro, antigoVoltaJunho],
      6,
      AGORA
    );

    expect(meses).toHaveLength(6);
    expect(meses[0].label).toBe("abr/26");
    expect(meses[5].label).toBe("set/26");

    const porLabel = Object.fromEntries(meses.map((m) => [m.label, m]));
    expect(porLabel["abr/26"]).toMatchObject({ novos: 1, retornando: 0 });
    expect(porLabel["mai/26"]).toMatchObject({ novos: 1, retornando: 0 });
    expect(porLabel["jun/26"]).toMatchObject({ novos: 0, retornando: 1 });
    expect(porLabel["jul/26"]).toMatchObject({ novos: 0, retornando: 0 });
    expect(porLabel["ago/26"]).toMatchObject({ novos: 0, retornando: 1 });
    expect(porLabel["set/26"]).toMatchObject({ novos: 1, retornando: 0 });
  });
});

describe("retentionCalc — distribuicaoPorFaixa", () => {
  it("soma contagem e R$ por faixa da régua única, ignorando quem nunca comprou", () => {
    const p1 = cliente({ lastPurchase: dataHaDias(10), totalSpent: 100 });  // ativo
    const p2 = cliente({ lastPurchase: dataHaDias(45), totalSpent: 200 });  // em_risco
    const p3 = cliente({ lastPurchase: dataHaDias(70), totalSpent: 300 });  // inativo
    const p4 = cliente({ lastPurchase: dataHaDias(100), totalSpent: 400 }); // inativo
    const p5 = cliente({ lastPurchase: dataHaDias(300), totalSpent: 1000 }); // perdido
    const p6 = cliente({ lastPurchase: "---", totalSpent: 5000 }); // nunca comprou — fora

    const faixas = distribuicaoPorFaixa([p1, p2, p3, p4, p5, p6], AGORA);
    expect(faixas.map((f) => f.key)).toEqual(["ativo", "em_risco", "inativo", "perdido"]);

    const porKey = Object.fromEntries(faixas.map((f) => [f.key, f]));
    expect(porKey.ativo).toMatchObject({ count: 1, total: 100 });
    expect(porKey.em_risco).toMatchObject({ count: 1, total: 200 });
    expect(porKey.inativo).toMatchObject({ count: 2, total: 700 });
    expect(porKey.perdido).toMatchObject({ count: 1, total: 1000 });
  });
});

describe("retentionCalc — computeRetentionSummary", () => {
  it("retention/churn a partir da régua, retornaram = 2+ compras, freq média = visitas/clientes", () => {
    const q1 = cliente({ lastPurchase: dataHaDias(10), visits: 1 });  // ativo
    const q2 = cliente({ lastPurchase: dataHaDias(45), visits: 3 });  // em_risco
    const q3 = cliente({ lastPurchase: dataHaDias(70), visits: 2 });  // inativo
    const q4 = cliente({ lastPurchase: dataHaDias(300), visits: 5 }); // perdido
    const q5 = cliente({ lastPurchase: "---", visits: 0 });           // nunca comprou

    const r = computeRetentionSummary([q1, q2, q3, q4, q5], AGORA)!;
    expect(r.churn_rate).toBeCloseTo(25, 5);   // 1 perdido / 4 com compra
    expect(r.retention_rate).toBeCloseTo(75, 5);
    expect(r.returning_customers).toBe(3);      // q2, q3, q4
    expect(r.total_customers).toBe(5);
    expect(r.avg_purchase_frequency).toBeCloseTo(11 / 5, 5);
  });

  it("base vazia devolve null (nada para o card mostrar)", () => {
    expect(computeRetentionSummary([], AGORA)).toBeNull();
  });
});

describe("retentionCalc — contarComCompra / BASE_MINIMA", () => {
  it("conta só quem tem data de última compra válida", () => {
    const comCompra = cliente({ lastPurchase: dataHaDias(1) });
    const semCompra = cliente({ lastPurchase: "---" });
    expect(contarComCompra([comCompra, semCompra, comCompra])).toBe(2);
    expect(BASE_MINIMA).toBe(10);
  });
});

// ============================================================
// 2. proximoAniversario / birthdaysFromConsolidatedCustomers (puras)
// ============================================================
describe("BirthdaysCard — proximoAniversario", () => {
  it("hoje: diasAte 0, isToday true", () => {
    const hoje = new Date(AGORA);
    const iso = `1990-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    expect(proximoAniversario(iso, AGORA)).toEqual({ diasAte: 0, isToday: true });
  });

  it("já passou este ano: pula para o ano que vem", () => {
    // AGORA = 16/09/2026 — aniversário em 01/01 já passou faz tempo, o
    // próximo é 01/01/2027: 107 dias à frente.
    const r = proximoAniversario("1990-01-01", AGORA);
    expect(r?.isToday).toBe(false);
    expect(r?.diasAte).toBeGreaterThan(0);
  });

  it("sem data válida, devolve null", () => {
    expect(proximoAniversario(null, AGORA)).toBeNull();
    expect(proximoAniversario("", AGORA)).toBeNull();
  });
});

describe("BirthdaysCard — birthdaysFromConsolidatedCustomers", () => {
  it("filtra pelos próximos N dias, mantém a loja de origem, ordena por proximidade", () => {
    const rows: any[] = [
      { id: "c1", name: "Ana", email: "a@x.com", phone: "11999990001", birth_date: "1990-09-23", // 7 dias
        total_spent: 10, totalSpent: 10, visits: 1, visit_count: 1, company_id: "loja-1", company_name: "Loja Norte" },
      { id: "c2", name: "Beto", email: null, phone: "11999990002", birth_date: "1990-09-16", // hoje
        total_spent: 20, totalSpent: 20, visits: 2, visit_count: 2, company_id: "loja-2", company_name: "Loja Sul" },
      { id: "c3", name: "Caio", email: null, phone: "11999990003", birth_date: "1990-12-25", // longe
        total_spent: 30, totalSpent: 30, visits: 1, visit_count: 1, company_id: "loja-1", company_name: "Loja Norte" },
    ];
    const out = birthdaysFromConsolidatedCustomers(rows, 7, AGORA);
    expect(out.map((c) => c.id)).toEqual(["c2", "c1"]); // hoje primeiro, depois 7 dias; c3 fora
    expect(out[0].is_today).toBe(true);
    expect(out[1].company_name).toBe("Loja Norte");
  });
});

// ============================================================
// 3. RetentionTab — componente
// ============================================================
describe("RetentionTab", () => {
  function estadoHook(over: any = {}) {
    return {
      customers: [], isLoading: false, isError: false, refetch: jest.fn(),
      consolidatedView: false, companyCount: 1, ...over,
    };
  }
  function achar(tree: any, id: string): any {
    return tree.root.findAllByProps({ testID: id })[0];
  }
  function tem(tree: any, id: string): boolean {
    return tree.root.findAllByProps({ testID: id }).length > 0;
  }
  function texto(tree: any, id: string): string {
    return JSON.stringify(achar(tree, id).props.children);
  }

  beforeEach(() => { mockPush.mockClear(); mockRefreshMe.mockClear(); });

  it("carregando: mostra o estado de loading", async () => {
    mockCustomersHook = estadoHook({ isLoading: true });
    let tree: any;
    await act(async () => { tree = renderer.create(<RetentionTab />); });
    expect(tem(tree, "retencao-real-loading")).toBe(true);
    tree.unmount();
  });

  it("erro: mostra o estado de erro e 'tentar de novo' chama refetch", async () => {
    const refetch = jest.fn();
    mockCustomersHook = estadoHook({ isError: true, refetch });
    let tree: any;
    await act(async () => { tree = renderer.create(<RetentionTab />); });
    expect(tem(tree, "retencao-real-erro")).toBe(true);
    await act(async () => { achar(tree, "retencao-real-erro-tentar").props.onPress(); });
    expect(refetch).toHaveBeenCalled();
    tree.unmount();
  });

  it("base pequena (< 10 com compra): 'ainda é cedo', com o número atual", async () => {
    const poucos = [cliente({ lastPurchase: dataHaDias(1) }), cliente({ lastPurchase: dataHaDias(2) })];
    mockCustomersHook = estadoHook({ customers: poucos });
    let tree: any;
    await act(async () => { tree = renderer.create(<RetentionTab />); });
    expect(tem(tree, "retencao-real-cedo")).toBe(true);
    tree.unmount();
  });

  it("revalida /auth/me no mount (armadilha 1: plano stale no JWT)", async () => {
    mockCustomersHook = estadoHook();
    let tree: any;
    await act(async () => { tree = renderer.create(<RetentionTab />); });
    expect(mockRefreshMe).toHaveBeenCalled();
    tree.unmount();
  });

  describe("com base suficiente (>= 10 com compra)", () => {
    // cA/cB/cD reaproveitam o mesmo desenho dos testes de recompraEmDias.
    const cA = cliente({ firstVisit: dataHaDias(200), lastPurchase: dataHaDias(50), visits: 2 });
    const cB = cliente({ firstVisit: dataHaDias(100), lastPurchase: dataHaDias(10), visits: 3 });
    const cD = cliente({ firstVisit: dataHaDias(300), lastPurchase: dataHaDias(300), visits: 1 });
    const p1 = cliente({ lastPurchase: dataHaDias(10), totalSpent: 100 });
    const p2 = cliente({ lastPurchase: dataHaDias(45), totalSpent: 200 });
    const p3 = cliente({ lastPurchase: dataHaDias(70), totalSpent: 300 });
    const p4 = cliente({ lastPurchase: dataHaDias(100), totalSpent: 400 });
    const p5 = cliente({ lastPurchase: dataHaDias(300), totalSpent: 900 }); // perdido
    const voltouEsteMes = cliente({ firstVisit: "10/08/2026", lastPurchase: "05/09/2026", visits: 2 });
    const filler1 = cliente({ lastPurchase: dataHaDias(1), totalSpent: 10 });
    const filler2 = cliente({ lastPurchase: dataHaDias(2), totalSpent: 10 });

    const RICA = [cA, cB, cD, p1, p2, p3, p4, p5, voltouEsteMes, filler1, filler2];

    it("mostra os quatro indicadores calculados", async () => {
      mockCustomersHook = estadoHook({ customers: RICA });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });

      // recompra 90: elegíveis cA,cB,cD -> 1/3 -> 33%
      expect(achar(tree, "retencao-real-recompra-90-valor").props.children).toBe("33%");
      // recompra 180: elegíveis cA,cD -> 1/2 -> 50%
      expect(achar(tree, "retencao-real-recompra-180-valor").props.children).toBe("50%");
      // voltaram no mês: voltouEsteMes, e também cB (última compra 10 dias
      // atrás cai em setembro/2026, a 1ª compra dele foi em junho).
      expect(achar(tree, "retencao-real-voltaram-mes-valor").props.children).toBe("2");
      tree.unmount();
    });

    it("o botão de recompra em 90 dias leva para a reativação com ?dias=90", async () => {
      mockCustomersHook = estadoHook({ customers: RICA });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });
      await act(async () => { achar(tree, "retencao-real-recompra-90-btn").props.onPress(); });
      expect(mockPush).toHaveBeenCalledWith("/clientes/reativacao?dias=90");
      tree.unmount();
    });

    it("o botão de recompra em 180 dias leva para a reativação com ?dias=180", async () => {
      mockCustomersHook = estadoHook({ customers: RICA });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });
      await act(async () => { achar(tree, "retencao-real-recompra-180-btn").props.onPress(); });
      expect(mockPush).toHaveBeenCalledWith("/clientes/reativacao?dias=180");
      tree.unmount();
    });

    it("a faixa 'perdido' tem botão para a reativação com ?dias=121", async () => {
      mockCustomersHook = estadoHook({ customers: RICA });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });
      expect(tem(tree, "retencao-real-faixa-perdido-btn")).toBe(true);
      await act(async () => { achar(tree, "retencao-real-faixa-perdido-btn").props.onPress(); });
      expect(mockPush).toHaveBeenCalledWith("/clientes/reativacao?dias=121");
      tree.unmount();
    });

    it("a faixa 'ativo' NÃO tem botão de reativação (ninguém sumiu)", async () => {
      mockCustomersHook = estadoHook({ customers: RICA });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });
      expect(tem(tree, "retencao-real-faixa-ativo-btn")).toBe(false);
      tree.unmount();
    });

    it("multi-CNPJ: avisa que está somando as lojas", async () => {
      mockCustomersHook = estadoHook({ customers: RICA, consolidatedView: true, companyCount: 3 });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });
      expect(texto(tree, "retencao-real-multi-cnpj")).toContain("3");
      tree.unmount();
    });

    it("sem multi-CNPJ (uma loja só), não mostra o aviso", async () => {
      mockCustomersHook = estadoHook({ customers: RICA, consolidatedView: false, companyCount: 1 });
      let tree: any;
      await act(async () => { tree = renderer.create(<RetentionTab />); });
      expect(tem(tree, "retencao-real-multi-cnpj")).toBe(false);
      tree.unmount();
    });
  });
});

// ============================================================
// 4. RetentionCard — no consolidado
// ============================================================
describe("RetentionCard", () => {
  function montar() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderer.create(
      <QueryClientProvider client={qc}>
        <RetentionCard />
      </QueryClientProvider>
    );
  }
  function tem(tree: any, id: string): boolean {
    return tree.root.findAllByProps({ testID: id }).length > 0;
  }

  beforeEach(() => {
    mockRetention.mockReset();
    mockCustomersHook = { customers: [], isLoading: false };
  });

  it("single-company: continua vindo do endpoint por empresa, sem nota de consolidado", async () => {
    mockAuthState = { company: { id: "loja-1" }, consolidatedView: false };
    mockRetention.mockResolvedValue({
      retention_rate: 80, churn_rate: 20, returning_customers: 5, total_customers: 10, avg_purchase_frequency: 2.5,
    });
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "retention-card")).toBe(true);
    expect(tem(tree, "retention-card-consolidado")).toBe(false);
    expect(mockRetention).toHaveBeenCalledWith("loja-1");
    tree.unmount();
  });

  it("consolidado: calcula o resumo da lista de /me/customers, sem chamar o endpoint por empresa", async () => {
    mockAuthState = { company: null, consolidatedView: true };
    const q1 = cliente({ lastPurchase: dataHaDias(10), visits: 1 });
    const q2 = cliente({ lastPurchase: dataHaDias(45), visits: 3 });
    const q3 = cliente({ lastPurchase: dataHaDias(70), visits: 2 });
    const q4 = cliente({ lastPurchase: dataHaDias(300), visits: 5 });
    const q5 = cliente({ lastPurchase: "---", visits: 0 });
    mockCustomersHook = { customers: [q1, q2, q3, q4, q5], isLoading: false };

    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(tem(tree, "retention-card")).toBe(true);
    expect(tem(tree, "retention-card-consolidado")).toBe(true);
    expect(mockRetention).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("consolidado sem clientes: não renderiza nada (nada para mostrar)", async () => {
    mockAuthState = { company: null, consolidatedView: true };
    mockCustomersHook = { customers: [], isLoading: false };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });
});

// ============================================================
// 5. BirthdaysCard — no consolidado
// ============================================================
describe("BirthdaysCard", () => {
  function montar() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderer.create(
      <QueryClientProvider client={qc}>
        <BirthdaysCard />
      </QueryClientProvider>
    );
  }
  function achar(tree: any, id: string): any {
    return tree.root.findAllByProps({ testID: id })[0];
  }
  function tem(tree: any, id: string): boolean {
    return tree.root.findAllByProps({ testID: id }).length > 0;
  }
  function hojeISO(): string {
    const d = new Date();
    return `1990-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  beforeEach(() => {
    mockMeCustomers.mockReset();
    mockBirthdays.mockReset();
    mockSentThisYear.mockReset();
    mockBirthdays.mockResolvedValue({ customers: [] });
    mockSentThisYear.mockResolvedValue({ year: 2026, total: 0, sent: [] });
  });

  it("consolidado sem nenhuma empresa paga: não aparece", async () => {
    mockAuthState = {
      company: null, consolidatedView: true,
      availableCompanies: [{ id: "loja-1", plan: "essencial" }],
      switchCompany: jest.fn(),
    };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("consolidado com plano pago: soma as lojas e mostra a loja de origem", async () => {
    var mockSwitch = jest.fn(() => Promise.resolve());
    mockAuthState = {
      company: null, consolidatedView: true,
      availableCompanies: [{ id: "loja-1", plan: "essencial" }, { id: "loja-2", plan: "negocio" }],
      switchCompany: mockSwitch,
    };
    mockMeCustomers.mockResolvedValue({
      customers: [{
        id: "c1", name: "Ana Souza", email: null, phone: "11999990001",
        birth_date: hojeISO(), total_spent: 0, totalSpent: 0, visits: 1, visit_count: 1,
        company_id: "loja-2", company_name: "Loja Bela Vista",
      }],
      total: 1, limit: 50, offset: 0, plan_limit: 0, company_count: 2,
    });

    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(tem(tree, "birthdays-card-consolidado")).toBe(true);
    const btn = achar(tree, "birthday-row-acao");
    expect(JSON.stringify(btn.props.children[1].props.children)).toContain("Ir para a loja");

    await act(async () => { btn.props.onPress(); });
    expect(mockSwitch).toHaveBeenCalledWith("loja-2");
    tree.unmount();
  });

  it("single-company: continua abrindo o fluxo de cupom (não troca de loja)", async () => {
    mockAuthState = {
      company: { id: "loja-1", plan: "negocio", module_overrides: {} },
      consolidatedView: false,
      availableCompanies: [],
      switchCompany: jest.fn(),
    };
    mockBirthdays.mockResolvedValue({
      customers: [{
        id: "c2", name: "Beto", email: null, phone: "11999990002",
        birth_date: null, total_purchases: 1, total_spent: 0, days_until: 0, is_today: true,
        marketing_opt_out: false,
      }],
    });

    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    const btn = achar(tree, "birthday-row-acao");
    expect(JSON.stringify(btn.props.children[1].props.children)).toContain("Cupom");
    tree.unmount();
  });
});
