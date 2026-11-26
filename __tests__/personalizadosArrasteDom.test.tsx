// ============================================================
// Personalizados › Produção no shell Negócio (p-129, 16/11/2026).
//
// O que este teste segura:
//   1. regras da Fila (mockup p-131): as cinco etapas, próxima etapa, o
//      resumo do cabeçalho, a origem, a etapa que o celular abre e o prazo;
//   2. o corte pela data de ativação: venda antiga do Caixa parada em
//      "Aguardando arte" não nasce no quadro; sem data, nada é escondido;
//   3. render do quadro: ações sempre visíveis, sem arrastar, uma etapa por
//      vez no celular, overlay por WebPortal;
//   4. a rota: mod próprio, "escolha uma loja" no consolidado, some sem
//      plano/permissão ou sem a frente ligada, e /auth/me refeito ao montar.
//
// Padrão de render da casa: react-test-renderer, identidade por testID e
// findAllByProps com { deep: false }.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import { createRoot } from "react-dom/client";
import { act } from "react";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockListOrders = jest.fn();
const mockUpdateStatus = jest.fn();
const mockLargura = { valor: 1280 };
const mockAuth: { estado: any } = { estado: {} };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };
const mockRefreshMe = jest.fn(() => Promise.resolve());

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockTirar = jest.fn();
jest.mock("@/components/personalizados/tirarDaFila", () => ({
  ...jest.requireActual("@/components/personalizados/tirarDaFila"),
  tirarDaFila: (...a: any[]) => mockTirar(...a),
}));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn() }));
const mockParams: { valor: Record<string, any> } = { valor: {} };
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useLocalSearchParams: () => mockParams.valor,
  // p-176: o cartão abre o detalhe do pedido.
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Modal: ({ visible, children }: any) => (visible ? children : null),
    useWindowDimensions: () => ({ width: mockLargura.valor, height: 800, scale: 1, fontScale: 1 }),
  };
});
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    listOrders: (...a: any[]) => mockListOrders(...a),
    updateProductionStatus: (...a: any[]) => mockUpdateStatus(...a),
  },
}));
jest.mock("@/components/studio/ApprovalRequestModal", () => ({
  ApprovalRequestModal: ({ order }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="modal-aprovacao" accessibilityLabel={order.id} />;
  },
}));
jest.mock("@/components/studio/RegistrarPagamentoSheet", () => ({ RegistrarPagamentoSheet: () => null }));
jest.mock("@/components/studio/PersonalizationPreview", () => ({ PersonalizationPreview: () => null }));
jest.mock("@/components/studio/useCobrarSaldo", () => ({ useCobrarSaldo: () => ({ cobrar: jest.fn(), cobrandoId: null }) }));
jest.mock("@/components/studio/useRegistrarPagamento", () => ({
  useRegistrarPagamento: () => ({ abrir: jest.fn(), fechar: jest.fn(), confirmar: jest.fn(), alvo: null, salvando: false, registrandoId: null }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth.estado) : mockAuth.estado),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: mockPdv.isLoading }) }));
// A trava geral (PERSONALIZADOS_LIBERADO, Caio 16/11) fica desligada no
// código. Aqui ela é ligada de propósito para testar a tela; o teste "trava
// desligada" prova que, como está no código, ninguém chega à Fila.
const mockTrava = { liberado: true };
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  return {
    ...real,
    personalizadosAtivo: (s: any, v: any) => real.personalizadosAtivo(s, v, mockTrava.liberado),
    personalizadosLiberado: () => real.personalizadosLiberado(mockTrava.liberado),
  };
});
// A visão de todas as lojas (p-187) tem teste próprio
// (__tests__/personalizadosConsolidado.test.tsx); aqui só o marcador.
jest.mock("@/components/personalizados/consolidado/ProducaoConsolidada", () => ({
  ProducaoConsolidada: () => {
    const { View } = jest.requireActual("react-native");
    return <View testID="producao-consolidada-marcador" />;
  },
}));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => mockVisiveis.set,
  useVisibleModulesProntos: () => mockVisiveis.prontos,
}));
jest.mock("@/components/ScreenHero", () => ({
  ScreenHero: ({ title }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="hero" accessibilityLabel={title} />;
  },
}));
jest.mock("@/components/CompanyPickerModal", () => ({
  CompanyPickerModal: () => null,
  getRememberedCompanyId: () => null,
}));

import { QuadroDeProducao } from "@/components/personalizados/QuadroDeProducao";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { inicialDoNome } from "@/components/personalizados/CapaMiniatura";
import { formatarTelefone } from "@/utils/telefone";

const pedido = (id: string, extra: Record<string, any> = {}): any => ({
  id, created_at: "2026-11-10T12:00:00.000Z", total_amount: 120, status: "confirmed",
  studio_production_status: "pending_art", customer_name: `Cliente ${id}`, customer_phone: null,
  display_name: `PDV-${id}`, item_count: 1, pending_approval_url: null, approval_count: 0, source: "pdv",
  ...extra,
});

function evento(tipo: string, dt: any) {
  const e: any = new Event(tipo, { bubbles: true, cancelable: true });
  e.dataTransfer = dt;
  return e;
}

describe("arraste no DOM de verdade", () => {
  // Os eventos sintéticos do teste passam pelo responder do RNW, que reclama de toque; não é do quadro.
  beforeAll(() => { jest.spyOn(console, "warn").mockImplementation(() => {}); });
  beforeEach(() => { jest.clearAllMocks(); mockLargura.valor = 1280; mockUpdateStatus.mockResolvedValue({}); });

  async function montar(pedidos: any[]) {
    mockListOrders.mockResolvedValue({ orders: pedidos });
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => { root.render(<TemaDoNegocio><QuadroDeProducao companyId="loja-1" ativadoEm={null} /></TemaDoNegocio>); });
    await act(async () => { await Promise.resolve(); });
    return { div, root };
  }
  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

  async function arrastar(de: string, para: string) {
    const guarda: Record<string, string> = {};
    const dt = { setData: (k: string, v: string) => { guarda[k] = v; }, getData: (k: string) => guarda[k] || "", effectAllowed: "", dropEffect: "" };
    const card = q(`producao-cartao-${de}`);
    const col = q(`producao-coluna-${para}`);
    await act(async () => { card.dispatchEvent(evento("dragstart", dt)); });
    const enter = evento("dragenter", dt);
    await act(async () => { col.dispatchEvent(enter); });
    expect(enter.defaultPrevented).toBe(true); // a zona aceita o drop
    const over = evento("dragover", dt);
    await act(async () => { col.dispatchEvent(over); });
    await act(async () => { col.dispatchEvent(evento("drop", dt)); });
    await act(async () => { card.dispatchEvent(evento("dragend", dt)); });
    return over;
  }

  test("para a frente: Aprovado -> Em produção grava", async () => {
    const { root } = await montar([pedido("a1", { studio_production_status: "approved" })]);
    expect(q("producao-cartao-a1").getAttribute("draggable")).toBe("true");
    await arrastar("a1", "in_production");
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "a1", "in_production", undefined);
    await act(async () => { root.unmount(); });
  });

  test("para trás: Em produção -> Aprovado pede a confirmação", async () => {
    const { root } = await montar([pedido("b1", { studio_production_status: "in_production" })]);
    expect(q("producao-cartao-b1").getAttribute("draggable")).toBe("true");
    await arrastar("b1", "approved");
    expect(document.body.textContent).toContain("Voltar este pedido para Aprovado?");
    await act(async () => { root.unmount(); });
  });
});

describe("reteste 26/11: pequenos acertos do app", () => {
  const fs = require("fs");
  const path = require("path");
  const ler = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  test("quantidade da peça seleciona pelo DOM (useSelecionarAoFocar), não só pelo selectTextOnFocus", () => {
    const fonte = ler("components/studio/orcamentoModal/LinhaDaPeca.tsx");
    expect(fonte).toMatch(/useSelecionarAoFocar\(\)/);
    expect(fonte).toMatch(/testID="qtd"\s+ref=\{selecionarAoFocar as any\}/);
  });

  test("detalhe do pedido do Negócio sem os arcos de radar", () => {
    expect(ler("app/(tabs)/personalizados/pedido/[id].tsx")).toMatch(/voltarEtapa\s+faltaReceber\s+semArcos/);
    expect(ler("components/studio/DetalheDoPedido.tsx").match(/<StudioScreen variant="reading" semArcos=\{semArcos\}>/g)).toHaveLength(3);
  });

  test("monograma: primeira letra ou número; sem nome, ?", () => {
    expect(inicialDoNome("Cliente QA Fila")).toBe("C");
    expect(inicialDoNome("  ótica Vista")).toBe("Ó");
    expect(inicialDoNome("123 Cia")).toBe("1");
    expect(inicialDoNome("")).toBe("?");
    expect(inicialDoNome(null)).toBe("?");
  });

  test("telefone com máscara na lista de orçamentos, no modal e no detalhe do pedido", () => {
    expect(formatarTelefone("11911112222")).toBe("(11) 91111-2222");
    expect(ler("components/studio/orcamentoModal/ListaDeOrcamentos.tsx")).toMatch(/formatarTelefone\(q\.customer_phone\)/);
    expect(ler("components/studio/orcamentoModal/OrcamentoModal.tsx")).toMatch(/setZap\(formatarTelefone\(q\.customer_phone\)\)/);
    expect(ler("components/studio/DetalheDoPedido.tsx")).toMatch(/formatarTelefone\(order\.customer_phone\)/);
  });

  test("cartão da Fila: nome em duas linhas com o nome inteiro no aria/title; colunas flexíveis", () => {
    const f = ler("components/personalizados/QuadroDeProducao.tsx");
    expect(f).toMatch(/numberOfLines=\{2\} accessibilityLabel=\{nome\}/);
    expect(f).toMatch(/coluna: \{ flex: 1, minWidth: 196/);
    expect(f).not.toMatch(/coluna: \{ width: 232/);
  });
});
