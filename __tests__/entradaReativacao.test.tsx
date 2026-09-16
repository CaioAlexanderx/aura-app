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
// 5. no consolidado a conta soma as lojas (MULTICNPJ).
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

import { ReativacaoEntrada } from "@/components/screens/clientes/ReativacaoEntrada";

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
