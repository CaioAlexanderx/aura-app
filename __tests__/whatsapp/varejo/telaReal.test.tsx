// ============================================================
// A aba WhatsApp do varejo deixou de ser maquete (Fase 6i).
//
// O que estes testes seguram:
//
// 1. company REAL nunca vê mock. A tela antiga tinha conversas,
//    automações e campanhas inventadas em MOCK_*; um lojista lendo
//    "1.248 mensagens enviadas" que nunca existiram é pior que uma tela
//    vazia. Mock agora é privilégio do modo demonstração.
// 2. O modo demonstração continua inteiro — é o que o vendedor mostra.
// 3. A fila da aba Cobranças mostra o crediário e SÓ ele: a mesma rota
//    /outbox devolve também a mensalidade do dojô e outros source_type.
// 4. Motivo de não-envio aparece em português na linha da fila.
//
// react-test-renderer direto (não RTL), mesma razão dos testes do dojô:
// sob react-native-web tudo vira div e a identidade vem do testID.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

// As abas da maquete puxam componentes pesados e sem interesse aqui.
jest.mock("@/components/screens/whatsapp/TabConversas", () => ({ TabConversas: () => null }));
jest.mock("@/components/screens/whatsapp/TabAutomacoes", () => ({ TabAutomacoes: () => null }));
jest.mock("@/components/screens/whatsapp/TabCampanhas", () => ({ TabCampanhas: () => null }));
jest.mock("@/components/screens/whatsapp/TabConfig", () => ({ TabConfig: () => null }));

var mockDemo = false;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1", name: "Loja Exemplo" }, token: "t", isDemo: mockDemo };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

// A maquete não pode nem tentar rede quando a company é real.
jest.mock("@/hooks/useWhatsApp", () => ({
  useWhatsApp: () => ({
    conversations: [], messages: [], automations: [], campaigns: [],
    unreadCount: 0, openCount: 0, activeAutomations: 0, totalSent: 0,
    isConnected: true, isDemo: mockDemo, isLoading: false,
    toggleAutomation: jest.fn(), sendMessage: jest.fn(),
  }),
}));

// Fase 0 (I0.2): a aba Conexão passou a mostrar a entrada da reativação
// com contagem e R$ em jogo, e ela conta em cima da lista de clientes.
// Aqui a lista é fixa — três pessoas paradas há 10, 70 e 200 dias — só
// para a tela montar sem rede nem QueryClient.
function haDias(n: number): string {
  return new Date(Date.now() - n * 864e5).toLocaleDateString("pt-BR");
}
var mockClientes: any[] = [
  { id: "a", name: "Ana", lastPurchase: haDias(10), totalSpent: 100, visits: 4 },
  { id: "b", name: "Bia", lastPurchase: haDias(70), totalSpent: 500, visits: 3 },
  { id: "c", name: "Caio", lastPurchase: haDias(200), totalSpent: 900, visits: 2 },
];
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({
    customers: mockClientes, isLoading: false, plan: "negocio",
    consolidatedView: false, companyCount: 1,
  }),
}));

var mockStatus: any = {
  connected: true, phone_display: "5511912345678", waba_id: "w1", queue: {},
  schema_pending: false, addon_active: true,
  templates_ready: { parcela_lembrete: true, parcela_atraso: true },
  usage: { today_sent: 3, month_sent: 41, daily_cap: 300 },
  embedded_signup: { app_id: "app", config_id: "cfg", graph_version: "v21.0" },
};
var mockOutbox: any = { data: [] };
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: {
      getStatus: () => Promise.resolve(mockStatus),
      listTemplates: () => Promise.resolve({ data: [] }),
      listOutbox: () => Promise.resolve(mockOutbox),
      createTemplate: jest.fn(() => Promise.resolve({ name: "x", language: "pt_BR" })),
      syncTemplates: jest.fn(() => Promise.resolve({ synced: 0 })),
      connect: jest.fn(), disconnect: jest.fn(), getPreview: jest.fn(),
    },
  };
});

import WhatsAppScreen from "@/app/(tabs)/whatsapp";
import { filtrarCrediario } from "@/components/whatsapp/FilaCard";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

function acharPorTestId(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}

describe("aba WhatsApp do varejo", () => {
  beforeEach(() => {
    mockDemo = false;
    mockOutbox = { data: [] };
  });

  it("company real vê a tela de verdade, nunca a maquete", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();

    expect(temTestId(tree, "wa-varejo-real")).toBe(true);
    expect(temTestId(tree, "wa-varejo-maquete")).toBe(false);
    // Aba Conexão é a primeira: cartão de conexão + uso do mês.
    expect(temTestId(tree, "wa-varejo-conexao")).toBe(true);
    expect(temTestId(tree, "wa-varejo-uso")).toBe(true);
    tree.unmount();
  });

  it("modo demonstração continua com a maquete", async () => {
    mockDemo = true;
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();

    expect(temTestId(tree, "wa-varejo-maquete")).toBe(true);
    expect(temTestId(tree, "wa-varejo-real")).toBe(false);
    expect(JSON.stringify(tree.toJSON())).toContain("Modo demonstrativo");
    tree.unmount();
  });

  it("a aba Cobranças mostra a fila com o motivo traduzido", async () => {
    mockOutbox = {
      data: [
        {
          id: "o1", to_phone: "5511912345678", kind: "template", template_name: "parcela_lembrete",
          status: "skipped", skip_reason: "LIMITE_DIARIO", attempts: 0, last_error: null,
          source_type: "crediario", created_at: new Date().toISOString(),
        },
      ],
    };
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();

    await act(async () => { acharPorTestId(tree, "wa-varejo-aba-1").props.onPress(); });
    await flush();

    expect(temTestId(tree, "wa-varejo-fila")).toBe(true);
    expect(temTestId(tree, "wa-varejo-fila-motivo")).toBe(true);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("Limite diário de mensagens atingido");
    expect(txt).not.toContain("LIMITE_DIARIO");
    tree.unmount();
  });

  it("a aba Templates oferece criar os dois presets do crediário", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();

    await act(async () => { acharPorTestId(tree, "wa-varejo-aba-2").props.onPress(); });
    await flush();

    expect(temTestId(tree, "wa-varejo-preset-parcela_lembrete")).toBe(true);
    expect(temTestId(tree, "wa-varejo-preset-parcela_atraso")).toBe(true);
    tree.unmount();
  });
});

describe("filtrarCrediario — a fila da loja não é a do dojô", () => {
  it("deixa passar só as cobranças do crediário e os testes", () => {
    const itens: any[] = [
      { id: "1", source_type: "crediario" },
      { id: "2", source_type: "crediario_manual" },
      { id: "3", source_type: "teste" },
      { id: "4", source_type: "mensalidade" },
      { id: "5", source_type: null },
    ];
    expect(filtrarCrediario(itens).map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("lista ausente não quebra", () => {
    expect(filtrarCrediario(null)).toEqual([]);
    expect(filtrarCrediario(undefined)).toEqual([]);
  });
});
