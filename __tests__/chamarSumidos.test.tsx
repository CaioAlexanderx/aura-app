// ============================================================
// Reativação sem a Meta: "Chamar" por wa.me (card t3-06, 14/10/2026).
//
// Decisão do Caio (13/10): a Reativação volta ao menu e o Essencial a usa
// sem conectar o número da Meta — um toque por cliente abre o WhatsApp da
// própria loja com a mensagem pronta. Premissa de 16/09: no Essencial o que
// o plano não tem SOME (nada de botão desabilitado, isca ou upgrade).
//
// O que este teste segura:
//   1. a regra de quem entra na lista (corte, ordem, sem compra fora);
//   2. a mensagem e a marca "chamado em" (nunca lança, funciona sem armazém);
//   3. a tela do Essencial: lista, toque abre o wa.me com o texto, marca a
//      linha, e NÃO há texto/botão de plano nem chamada à API da Meta;
//   4. o wrapper da rota: Essencial → ChamarSumidos; Negócio → fluxo da Meta.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockPush = jest.fn();
let mockParams: any = {};
jest.mock("expo-router", () => ({
  router: { push: (...a: any[]) => mockPush(...a), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

let mockPlano: string | null = "essencial";
const mockRefreshMe = jest.fn();
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      const state = {
        company: { id: "loja-1", name: "Loja da Ana", plan: mockPlano },
        token: "t",
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t", refreshMe: mockRefreshMe }) },
  ),
}));

let mockClientes: any[] = [];
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: mockClientes, isLoading: false, isError: false, refetch: jest.fn() }),
}));

const mockAbrir = jest.fn(() => true);
jest.mock("@/utils/whatsapp", () => {
  const real = jest.requireActual("@/utils/whatsapp");
  return { ...real, openWhatsApp: (...a: any[]) => (mockAbrir as any)(...a) };
});

// Nada da Meta pode ser chamado no Essencial.
const mockMetaGet = jest.fn(() => Promise.resolve({ metrics: {}, priority_reactivation: [] }));
jest.mock("@/services/reactivationApi", () => ({
  reactivationApi: {
    get: (...a: any[]) => (mockMetaGet as any)(...a),
    getSettings: jest.fn(() => Promise.resolve({})),
    saveSettings: jest.fn(), preview: jest.fn(), send: jest.fn(),
  },
}));
const mockWaStatus = jest.fn(() => Promise.resolve(null));
jest.mock("@/services/waApi", () => {
  const real = jest.requireActual("@/services/waApi");
  return { ...real, waApi: { ...real.waApi, getStatus: (...a: any[]) => (mockWaStatus as any)(...a) } };
});
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

import { ChamarSumidos } from "@/components/screens/clientes/ChamarSumidos";
import ReativacaoScreen from "@/app/(tabs)/clientes/reativacao";
import {
  criarMarcasDeChamado, diaMesBR, listarSumidos, mensagemDeChamado, primeiroNome, rotuloDeChamado,
} from "@/utils/chamarSumidos";

const AGORA = new Date(2026, 9, 14, 12, 0, 0).getTime(); // 14/10/2026
function haDias(n: number): string {
  const d = new Date(AGORA - n * 864e5);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function cli(id: string, nome: string, dias: number | null, gasto: number, phone = "11999998888") {
  return {
    id, name: nome, phone, email: "", instagram: "", birthday: "",
    lastPurchase: dias == null ? "---" : haDias(dias), totalSpent: gasto,
    visits: 2, firstVisit: "", notes: "", rating: null, creditBalance: 0,
  } as any;
}

describe("listarSumidos", () => {
  const base = [
    cli("a", "Ana Souza", 70, 500),
    cli("b", "Bruno Lima", 200, 1500),
    cli("c", "Carla Dias", 10, 9000),   // comprou há 10 dias: fora
    cli("d", "Davi Rocha", null, 800),  // nunca comprou: fora
    cli("e", "Eva Nunes", 61, 500, ""), // sem telefone: entra, sem Chamar
  ];

  test("corte em dias, do que mais gastou para o que menos, nunca comprou fora", () => {
    const l = listarSumidos(base, 60, AGORA);
    expect(l.map((x) => x.id)).toEqual(["b", "a", "e"]);
  });

  test("corte maior encolhe a lista", () => {
    expect(listarSumidos(base, 90, AGORA).map((x) => x.id)).toEqual(["b"]);
  });

  test("telefone vem normalizado (DDI 55) ou null", () => {
    const l = listarSumidos(base, 60, AGORA);
    expect(l.find((x) => x.id === "a")?.telefone).toBe("5511999998888");
    expect(l.find((x) => x.id === "e")?.telefone).toBeNull();
  });

  test("lista vazia ou indefinida não quebra", () => {
    expect(listarSumidos([], 60, AGORA)).toEqual([]);
    expect(listarSumidos(undefined as any, 60, AGORA)).toEqual([]);
  });
});

describe("mensagem e marca de chamado", () => {
  test("primeiro nome e texto pronto, com a loja", () => {
    expect(primeiroNome("  Ana Maria Souza ")).toBe("Ana");
    expect(mensagemDeChamado("Ana Maria Souza", "Loja da Ana")).toBe(
      "Oi, Ana! Aqui é da Loja da Ana. Faz um tempo que você não passa por aqui e sentimos sua falta. Posso te mostrar o que chegou de novo?",
    );
  });

  test("sem nome ou sem loja o texto continua inteiro", () => {
    expect(mensagemDeChamado("", null)).toBe(
      "Oi! Faz um tempo que você não passa por aqui e sentimos sua falta. Posso te mostrar o que chegou de novo?",
    );
  });

  test("marca persiste no armazém e é por empresa", () => {
    const dados: Record<string, string> = {};
    const arm = { getItem: (k: string) => dados[k] ?? null, setItem: (k: string, v: string) => { dados[k] = v; } };
    const m1 = criarMarcasDeChamado("loja-1", arm);
    m1.marcar("c1", 1000);
    expect(criarMarcasDeChamado("loja-1", arm).ler()).toEqual({ c1: 1000 });
    expect(criarMarcasDeChamado("loja-2", arm).ler()).toEqual({});
  });

  test("sem armazém vale na sessão; armazém quebrado não lança", () => {
    const m = criarMarcasDeChamado("loja-1", null);
    m.marcar("c1", 5);
    expect(m.ler()).toEqual({ c1: 5 });
    const ruim = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    const r = criarMarcasDeChamado("loja-1", ruim);
    expect(() => r.marcar("c9", 7)).not.toThrow();
    expect(r.ler()).toEqual({ c9: 7 });
  });

  test("diaMesBR", () => {
    expect(diaMesBR(new Date(2026, 9, 3).getTime())).toBe("03/10");
  });

  // Pendência da Nina (14/10): a marca é só deste aparelho/navegador, o
  // rótulo precisa dizer isso.
  test("rotuloDeChamado diz que a marca é deste aparelho", () => {
    expect(rotuloDeChamado(new Date(2026, 9, 3).getTime())).toBe("chamado neste aparelho em 03/10");
  });

  test("rotuloDeChamado sem data legível: 'chamado neste aparelho'", () => {
    expect(rotuloDeChamado(undefined)).toBe("chamado neste aparelho");
    expect(rotuloDeChamado(null)).toBe("chamado neste aparelho");
    expect(rotuloDeChamado(0)).toBe("chamado neste aparelho");
    expect(rotuloDeChamado(NaN)).toBe("chamado neste aparelho");
    expect(rotuloDeChamado(true)).toBe("chamado neste aparelho");
  });
});

describe("tela do Essencial", () => {
  beforeEach(() => {
    mockAbrir.mockClear(); mockPush.mockClear(); mockMetaGet.mockClear(); mockWaStatus.mockClear();
    jest.spyOn(Date, "now").mockReturnValue(AGORA);
    window.localStorage.clear();
    mockParams = {};
    mockPlano = "essencial";
    mockClientes = [
      cli("a", "Ana Souza", 70, 500),
      cli("b", "Bruno Lima", 200, 1500),
      cli("c", "Carla Dias", 10, 9000),
      cli("e", "Eva Nunes", 61, 500, ""),
    ];
  });
  afterEach(() => { (Date.now as jest.Mock).mockRestore?.(); });

  const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id });
  const textoTudo = (t: any) => JSON.stringify(t.toJSON());

  test("lista quem sumiu, com a contagem do corte", async () => {
    let t: any;
    await act(async () => { t = renderer.create(<ChamarSumidos />); });
    expect(textoTudo(t)).toContain("reativacao-essencial-cliente-b");
    expect(textoTudo(t)).not.toContain("reativacao-essencial-cliente-c");
    expect(achar(t, "reativacao-essencial-contagem")[0].props.children).toBe("3");
    t.unmount();
  });

  test("o corte da entrada (?dias=) já vem marcado", async () => {
    mockParams = { dias: "90" };
    let t: any;
    await act(async () => { t = renderer.create(<ChamarSumidos />); });
    expect(achar(t, "reativacao-essencial-contagem")[0].props.children).toBe("1");
    t.unmount();
  });

  test("Chamar abre o wa.me com a mensagem pronta e marca a linha", async () => {
    let t: any;
    await act(async () => { t = renderer.create(<ChamarSumidos />); });
    const botao = achar(t, "reativacao-essencial-chamar-a")[0];
    await act(async () => { botao.props.onPress(); });
    expect(mockAbrir).toHaveBeenCalledTimes(1);
    const [telefone, texto] = mockAbrir.mock.calls[0] as any[];
    expect(telefone).toBe("5511999998888");
    expect(texto).toBe(mensagemDeChamado("Ana Souza", "Loja da Ana"));
    expect(achar(t, "reativacao-essencial-chamado-a").length).toBe(1);
    expect(textoTudo(t)).toContain("chamado neste aparelho em 14/10");
    expect(textoTudo(t)).not.toContain("chamado em ");
    expect(textoTudo(t)).toContain("Chamar de novo");
    t.unmount();
  });

  test("cliente sem telefone não ganha botão (e nada fica desabilitado)", async () => {
    let t: any;
    await act(async () => { t = renderer.create(<ChamarSumidos />); });
    expect(achar(t, "reativacao-essencial-chamar-e").length).toBe(0);
    expect(textoTudo(t)).toContain("sem telefone");
    expect(textoTudo(t)).not.toContain('"disabled":true');
    t.unmount();
  });

  test("premissa de 16/09: nenhum texto de plano, upgrade ou Meta na tela", async () => {
    let t: any;
    await act(async () => { t = renderer.create(<ChamarSumidos />); });
    expect(textoTudo(t)).not.toMatch(/plano|Negócio|upgrade|Meta|Ver planos|cupom/i);
    t.unmount();
  });

  test("a rota entrega a tela do Essencial e não chama a API da Meta", async () => {
    let t: any;
    await act(async () => { t = renderer.create(<ReativacaoScreen />); });
    expect(achar(t, "reativacao-essencial").length).toBeGreaterThan(0);
    expect(mockMetaGet).not.toHaveBeenCalled();
    expect(mockWaStatus).not.toHaveBeenCalled();
    t.unmount();
  });

  test("no Negócio a rota segue no fluxo da Meta, com Chamar por linha", async () => {
    mockPlano = "negocio";
    mockMetaGet.mockResolvedValueOnce({
      metrics: { at_risk: 1 },
      priority_reactivation: [
        { id: "c1", name: "Ana Souza", phone: "11999998888", total_spent: 900, days_since_purchase: 45, segment: "at_risk" },
      ],
    } as any);
    let t: any;
    await act(async () => { t = renderer.create(<ReativacaoScreen />); });
    expect(mockMetaGet).toHaveBeenCalled();
    expect(achar(t, "reativacao-essencial").length).toBe(0);
    const botao = achar(t, "reativacao-chamar-c1")[0];
    await act(async () => { botao.props.onPress(); });
    expect(mockAbrir).toHaveBeenCalledTimes(1);
    // A marca da linha do Negócio usa o mesmo rótulo ("neste aparelho").
    expect(achar(t, "reativacao-chamado-c1").length).toBe(1);
    expect(textoTudo(t)).toContain("chamado neste aparelho em 14/10");
    expect(textoTudo(t)).not.toContain("chamado em ");
    t.unmount();
  });
});

describe("fonte", () => {
  test("a rota decide pelo plano antes de qualquer chamada à Meta", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/clientes/reativacao.tsx"), "utf8");
    expect(src).toContain("return <ChamarSumidos />");
    expect(src.indexOf("function ReativacaoMeta")).toBeGreaterThan(src.indexOf("export default function ReativacaoScreen"));
  });
});
