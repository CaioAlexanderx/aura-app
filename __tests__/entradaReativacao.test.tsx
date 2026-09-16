// ============================================================
// A porta da reativação com número (Fase 0, I0.2).
//
// O app perdeu um cliente de trial que queria "ver quem não vem à loja
// há 60, 90 ou mais dias e disparar WhatsApp". A função existia; a porta
// era um card-link mudo. O que estes testes seguram:
//
// 1. o número e o R$ aparecem ANTES do clique, e mudam com o corte;
// 2. o corte viaja para a tela de detalhe (?dias=), senão o lojista
//    escolhe duas vezes;
// 3. quem nunca comprou não entra na conta — ausência de compra não é
//    abandono, e um cupom de "volte" para ele sairia errado;
// 4. no Essencial a CONTAGEM continua visível e só o botão muda de
//    destino: o produto pago é o disparo, não o número;
// 5. no consolidado a conta soma as lojas (MULTICNPJ);
// 6. e, o mais importante: a porta abre com a tela. Ela já esteve só na
//    aba Retenção — secundária e Negócio+ — e foi por estar escondida
//    ali que o cliente de trial não a achou. Agora ela mora na aba
//    Lista, que é a que abre. Numa base vazia não aparece: "0 clientes ·
//    R$ 0,00" numa loja nova não é informação.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));

var mockRefreshMe = jest.fn();
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t", refreshMe: mockRefreshMe }) }
  ),
}));

// ── Mocks só da tela de Clientes ────────────────────────────
// A tela inteira puxa meia dúzia de componentes pesados que não têm nada
// a ver com a porta da reativação; aqui eles viram casca.
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
jest.mock("@/components/ImportExportBar", () => ({ ImportExportBar: () => null }));
jest.mock("@/components/Pagination", () => ({ Pagination: () => null }));
jest.mock("@/components/screens/clientes/AddCustomerForm", () => ({ AddCustomerForm: () => null }));
jest.mock("@/components/screens/clientes/CustomerRow", () => ({ CustomerRow: () => null }));
jest.mock("@/components/screens/clientes/RankingTab", () => ({ RankingTab: () => null }));
jest.mock("@/components/screens/clientes/RetentionTab", () => ({ RetentionTab: () => null }));
jest.mock("@/components/RetentionCard", () => ({ RetentionCard: () => null }));
jest.mock("@/components/ReviewsList", () => ({ ReviewsList: () => null }));
jest.mock("@/components/ServerImport", () => ({ ServerImport: () => null }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: () => null }));
jest.mock("@/components/EmptyState", () => ({ EmptyState: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

var mockHook: any = {};
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => mockHook }));

import { ReativacaoEntrada } from "@/components/screens/clientes/ReativacaoEntrada";
import ClientesScreen from "@/app/(tabs)/clientes";

function haDias(n: number): string {
  return new Date(Date.now() - n * 864e5).toLocaleDateString("pt-BR");
}

function cliente(dias: number | null, gasto: number, extra: any = {}) {
  return {
    id: String(Math.random()), name: "Fulano", email: "", phone: "", instagram: "",
    birthday: "", lastPurchase: dias == null ? "---" : haDias(dias),
    totalSpent: gasto, visits: 3, firstVisit: "", notes: "", rating: null,
    creditBalance: 0, ...extra,
  } as any;
}

// 10 dias (ativo), 45 (em risco), 70 e 100 (inativos), 300 (perdido) e
// alguém que nunca comprou.
const BASE = [
  cliente(10, 100),
  cliente(45, 200),
  cliente(70, 400),
  cliente(100, 800),
  cliente(300, 1600),
  cliente(null, 0),
];

function montar(props: any = {}) {
  return renderer.create(
    <ReativacaoEntrada customers={BASE} plan="negocio" idBase="porta" {...props} />
  );
}
function achar(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}
function texto(tree: any, id: string): string {
  return JSON.stringify(achar(tree, id).props.children);
}

describe("a porta diz o número antes do clique", () => {
  beforeEach(() => { mockPush.mockClear(); mockRefreshMe.mockClear(); });

  it("no corte padrão de 60 dias, conta quem está parado há 60+ e soma o gasto", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    // 70, 100 e 300 dias — o de 45 fica de fora, o de 10 também.
    expect(texto(tree, "porta-contagem")).toContain("3");
    expect(texto(tree, "porta-valor")).toContain("2.800,00");
    tree.unmount();
  });

  it("trocar o corte recalcula na hora", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });

    await act(async () => { achar(tree, "porta-dias-30").props.onPress(); });
    // 45, 70, 100 e 300 dias.
    expect(texto(tree, "porta-contagem")).toContain("4");

    await act(async () => { achar(tree, "porta-dias-180").props.onPress(); });
    // Só o de 300.
    expect(texto(tree, "porta-contagem")).toContain("1");
    expect(texto(tree, "porta-valor")).toContain("1.600,00");
    tree.unmount();
  });

  it("'outro' abre o campo e aceita um corte digitado", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });

    await act(async () => { achar(tree, "porta-dias-outro").props.onPress(); });
    await act(async () => { achar(tree, "porta-dias-livre").props.onChangeText("90"); });
    // 100 e 300 dias.
    expect(texto(tree, "porta-contagem")).toContain("2");

    // Letra não vira corte — o campo só aceita dígito.
    await act(async () => { achar(tree, "porta-dias-livre").props.onChangeText("9a0"); });
    expect(achar(tree, "porta-dias-livre").props.value).toBe("90");
    tree.unmount();
  });

  it("quem nunca comprou fica fora da conta em qualquer corte", async () => {
    let tree: any;
    await act(async () => { tree = montar({ customers: [cliente(null, 5000)] }); });
    expect(texto(tree, "porta-contagem")).toContain("0");
    expect(texto(tree, "porta-valor")).toContain("0,00");
    tree.unmount();
  });

  it("enquanto a lista carrega, a porta não afirma que a base é zero", async () => {
    let tree: any;
    await act(async () => { tree = montar({ carregando: true, customers: [] }); });
    expect(texto(tree, "porta-contagem")).toContain("—");
    tree.unmount();
  });
});

describe("o corte viaja para a tela de detalhe", () => {
  beforeEach(() => { mockPush.mockClear(); mockRefreshMe.mockClear(); });

  it("o botão leva o ?dias= escolhido", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });

    await act(async () => { achar(tree, "porta").props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/clientes/reativacao?dias=60");

    await act(async () => { achar(tree, "porta-dias-120").props.onPress(); });
    await act(async () => { achar(tree, "porta").props.onPress(); });
    expect(mockPush).toHaveBeenLastCalledWith("/clientes/reativacao?dias=120");
    tree.unmount();
  });

  it("o testID histórico da porta continua sendo o do botão", async () => {
    let tree: any;
    await act(async () => { tree = montar({ idBase: "clientes-ir-para-reativacao" }); });
    expect(tree.root.findAllByProps({ testID: "clientes-ir-para-reativacao" }).length).toBeGreaterThan(0);
    tree.unmount();
  });

  it("revalida o plano no mount (armadilha 1: plano stale no JWT)", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    expect(mockRefreshMe).toHaveBeenCalled();
    tree.unmount();
  });
});

describe("plano Essencial: número visível, botão para planos", () => {
  beforeEach(() => { mockPush.mockClear(); mockRefreshMe.mockClear(); });

  it("a contagem continua aparecendo — é ela o argumento do upgrade", async () => {
    let tree: any;
    await act(async () => { tree = montar({ plan: "essencial" }); });
    expect(texto(tree, "porta-contagem")).toContain("3");
    expect(texto(tree, "porta-valor")).toContain("2.800,00");
    tree.unmount();
  });

  it("o botão vai para planos, não para o disparo", async () => {
    let tree: any;
    await act(async () => { tree = montar({ plan: "essencial" }); });
    await act(async () => { achar(tree, "porta").props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/planos");
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("/clientes/reativacao"));
    tree.unmount();
  });
});

describe("a porta abre com a tela: aba Lista de Clientes", () => {
  function estado(over: any = {}) {
    return {
      customers: BASE, isLoading: false, isError: false, refetch: jest.fn(),
      isDemo: false, planBlocked: false, bulkDeleting: false,
      addCustomer: jest.fn(), updateCustomer: jest.fn(), deleteCustomer: jest.fn(),
      bulkDeleteCustomers: jest.fn(), consolidatedView: false, companyCount: 1,
      plan: "negocio", planLimit: null, ...over,
    };
  }
  function montarTela() {
    return renderer.create(<ClientesScreen />);
  }
  function tem(tree: any, id: string): boolean {
    return tree.root.findAllByProps({ testID: id }).length > 0;
  }

  beforeEach(() => { mockPush.mockClear(); mockRefreshMe.mockClear(); mockHook = estado(); });

  it("a aba que abre é a Lista, e a porta está nela", async () => {
    let tree: any;
    await act(async () => { tree = montarTela(); });
    // Sem tocar em aba nenhuma: é o estado inicial da tela.
    expect(tem(tree, "clientes-ir-para-reativacao")).toBe(true);
    expect(tem(tree, "clientes-ir-para-reativacao-contagem")).toBe(true);
    tree.unmount();
  });

  it("no Essencial a porta continua na Lista — o gate é do disparo, não do número", async () => {
    mockHook = estado({ plan: "essencial" });
    let tree: any;
    await act(async () => { tree = montarTela(); });
    expect(tem(tree, "clientes-ir-para-reativacao")).toBe(true);
    await act(async () => {
      tree.root.findAllByProps({ testID: "clientes-ir-para-reativacao" })[0].props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/planos");
    tree.unmount();
  });

  it("loja nova (base vazia) não ganha um bloco dizendo '0 clientes · R$ 0,00'", async () => {
    mockHook = estado({ customers: [] });
    let tree: any;
    await act(async () => { tree = montarTela(); });
    expect(tem(tree, "clientes-ir-para-reativacao")).toBe(false);
    tree.unmount();
  });

  it("enquanto a lista carrega, e quando ela falha, a porta também não aparece", async () => {
    mockHook = estado({ isLoading: true, customers: [] });
    let tree: any;
    await act(async () => { tree = montarTela(); });
    expect(tem(tree, "clientes-ir-para-reativacao")).toBe(false);
    tree.unmount();

    mockHook = estado({ isError: true, customers: [] });
    let tree2: any;
    await act(async () => { tree2 = montarTela(); });
    expect(tem(tree2, "clientes-ir-para-reativacao")).toBe(false);
    tree2.unmount();
  });
});

describe("multi-CNPJ", () => {
  beforeEach(() => { mockPush.mockClear(); mockRefreshMe.mockClear(); });

  it("com uma loja só, nada de aviso de consolidado", async () => {
    let tree: any;
    await act(async () => { tree = montar({ companyCount: 1 }); });
    expect(tree.root.findAllByProps({ testID: "porta-multi-cnpj" }).length).toBe(0);
    tree.unmount();
  });

  it("no consolidado a porta avisa que está somando as lojas", async () => {
    let tree: any;
    await act(async () => { tree = montar({ companyCount: 3 }); });
    expect(texto(tree, "porta-multi-cnpj")).toContain("3");
    tree.unmount();
  });
});
