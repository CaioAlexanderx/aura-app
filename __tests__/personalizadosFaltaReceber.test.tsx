// ============================================================
// Personalizados › "Falta receber" do pedido de orçamento (p-185, 25/11/2026)
//
// Decisão do Caio (D6): o saldo é baixado na Produção. O que este teste segura:
//   1. regras: só com os campos orcamento_* do backend (Aura-backend#1106);
//      o marco `balance` que falta no pedido aprovado antes do #1106;
//   2. a Fila: sem os campos o cartão é o de hoje (paridade); com eles,
//      "Falta receber R$ X" e "Recebi", que baixa o marco pendente pelo
//      mark-paid com a forma e a Idempotency-Key (a mesma na nova tentativa);
//   3. entregar com falta: o aviso com "Receber agora" (baixa e entrega) e
//      "Entregar mesmo assim" (entrega sem receber);
//   4. o detalhe do Negócio: o mesmo bloco e o mesmo aviso; o /studio não muda.
//
// Padrão de render da casa: react-test-renderer, identidade por testID e
// findAllByProps com { deep: false }.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

const mockListOrders = jest.fn();
const mockUpdateStatus = jest.fn();
const mockMarkPaid = jest.fn();
const mockCreatePayment = jest.fn();
const mockGetOrder = jest.fn();
const mockParams: { id: string } = { id: "d1" };
const mockAuth: { estado: any } = { estado: {} };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn(), notify: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  usePathname: () => "/personalizados/pedido/d1",
}));
jest.mock("@react-navigation/native", () => {
  const R = jest.requireActual("react");
  return { useFocusEffect: (cb: any) => R.useEffect(() => cb(), [cb]) };
});
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Modal: ({ visible, children }: any) => (visible ? children : null),
    useWindowDimensions: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
  };
});
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => {
    const { View } = jest.requireActual("react-native");
    return active ? <View testID="web-portal">{children}</View> : null;
  },
}));
// A folha de baixo anima com Animated; aqui só passa adiante quando aberta.
jest.mock("@/components/studio/StudioBottomSheet", () => ({
  StudioBottomSheet: ({ visible, children, title }: any) => {
    const { View } = jest.requireActual("react-native");
    return visible ? <View testID="folha-da-baixa" accessibilityLabel={title}>{children}</View> : null;
  },
}));
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    listOrders: (...a: any[]) => mockListOrders(...a),
    updateProductionStatus: (...a: any[]) => mockUpdateStatus(...a),
    markPaymentPaid: (...a: any[]) => mockMarkPaid(...a),
    createOrderPayment: (...a: any[]) => mockCreatePayment(...a),
    getOrder: (...a: any[]) => mockGetOrder(...a),
    listOrderPayments: () => Promise.resolve({ payments: [] }),
    getCustomizationConfig: () => Promise.resolve({ config: null }),
  },
}));
jest.mock("@/components/studio/ApprovalRequestModal", () => ({ ApprovalRequestModal: () => null }));
jest.mock("@/components/studio/PersonalizationPreview", () => ({ PersonalizationPreview: () => null }));
jest.mock("@/components/studio/BlocoPagamentoDoPedido", () => ({ BlocoPagamentoDoPedido: () => null }));
jest.mock("@/components/studio/useCobrarSaldo", () => ({ useCobrarSaldo: () => ({ cobrar: jest.fn(), cobrandoId: null }) }));
jest.mock("@/components/studio/StudioScreen", () => ({
  StudioScreen: ({ children }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="studio-screen">{children}</View>;
  },
}));
jest.mock("@/components/studio/StudioLoading", () => ({
  StudioLoading: () => {
    const { View } = jest.requireActual("react-native");
    return <View testID="studio-carregando" />;
  },
}));
jest.mock("@/components/studio/StudioEmpty", () => ({ StudioEmpty: () => null }));
jest.mock("@/components/studio/StudioBreadcrumb", () => ({ StudioBreadcrumb: () => null }));
jest.mock("@/components/studio/StudioPageHeader", () => ({ StudioPageHeader: () => null }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth.estado) : mockAuth.estado),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: mockPdv.isLoading }) }));
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  return { ...real, personalizadosAtivo: (s: any, v: any) => real.personalizadosAtivo(s, v, true) };
});
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => mockVisiveis.set,
  useVisibleModulesProntos: () => mockVisiveis.prontos,
}));
jest.mock("@/components/CompanyPickerModal", () => ({
  CompanyPickerModal: () => null,
  getRememberedCompanyId: () => null,
}));

import { QuadroDeProducao } from "@/components/personalizados/QuadroDeProducao";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { FORMAS_DO_ORCAMENTO, faltaReceberDoOrcamento, marcosDaBaixa } from "@/components/personalizados/regrasDoReceber";
import { __zerarChavesDoOrcamentoParaTestes } from "@/components/personalizados/useReceberDoOrcamento";
import TelaPedido from "@/app/(tabs)/personalizados/pedido/[id]";
import TelaDoStudio from "@/app/studio/(estudio)/pedidos/[id]";

const mockToast = jest.requireMock("@/components/Toast").toast as { success: jest.Mock; error: jest.Mock; info: jest.Mock };

type Arvore = renderer.ReactTestRenderer;
const achar = (a: Arvore, id: string) => a.root.findAllByProps({ testID: id }, { deep: false });
const tem = (a: Arvore, id: string) => achar(a, id).length > 0;
const json = (n: any) => JSON.stringify(n);
const esperar = async () => { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); };
const tocar = async (a: Arvore, id: string) => {
  await act(async () => { achar(a, id)[0].props.onPress(); });
  await esperar();
};
/** O texto de uma instância (os filhos em string, em ordem). */
const textoDe = (n: any): string =>
  typeof n === "string" ? n : (n?.children || []).map((c: any) => textoDe(c)).join("");
/** O Pressable cujo texto contém `trecho` (o avançar do detalhe não tem testID). */
const tocarNoTexto = async (a: Arvore, trecho: string) => {
  const alvos = a.root.findAll((n) => typeof n.props?.onPress === "function" && typeof n.type !== "string"
    && textoDe(n).includes(trecho));
  alvos.sort((x, y) => textoDe(x).length - textoDe(y).length);
  await act(async () => { alvos[0].props.onPress(); });
  await esperar();
};

const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };

const pedido = (extra: Record<string, any> = {}): any => ({
  id: "d1", created_at: "2026-11-20T12:00:00.000Z", total_amount: 300, status: "confirmed",
  studio_production_status: "ready", customer_name: "Marina", customer_phone: null,
  display_name: "PED-1", item_count: 1, pending_approval_url: null, approval_count: 0,
  source: "digital", digital_order_id: "d1", origin: "orcamento", origin_label: "Orçamento",
  ...extra,
});
const COM_FALTA = {
  orcamento_recebido: 100, orcamento_falta_receber: 200,
  orcamento_pagamentos_pendentes: [{ id: "pay-bal", kind: "balance", amount: 200 }],
};

function estadoPadrao() {
  jest.clearAllMocks();
  __zerarChavesDoOrcamentoParaTestes();
  mockParams.id = "d1";
  mockAuth.estado = { company: LOJA, consolidatedView: false, user: { id: "u1" }, refreshMe: () => Promise.resolve(), switchCompany: jest.fn() };
  mockVisiveis.set = new Set(["personalizados.pedido", "personalizados.producao"]);
  mockPdv.settings = { studio_enabled: true };
  mockListOrders.mockResolvedValue({ orders: [pedido(COM_FALTA)] });
  mockUpdateStatus.mockResolvedValue({});
  mockMarkPaid.mockResolvedValue({ ok: true, payment: {}, deposit_released: false, lancamento: "saldo", taxa: 0, falta_receber: 0 });
  mockCreatePayment.mockResolvedValue({ id: "pay-novo", kind: "balance", amount: 50, status: "pending" });
}

async function montarFila() {
  let a!: Arvore;
  await act(async () => {
    a = renderer.create(<TemaDoNegocio><QuadroDeProducao companyId="loja-1" ativadoEm={null} /></TemaDoNegocio>);
  });
  await esperar();
  return a;
}

// ── 1. Regras ─────────────────────────────────────────────────────────────
describe("regras do que falta receber", () => {
  test("só com os campos do backend e falta > 0", () => {
    expect(faltaReceberDoOrcamento(pedido())).toBeNull();
    expect(faltaReceberDoOrcamento(pedido({ orcamento_falta_receber: null, orcamento_pagamentos_pendentes: null }))).toBeNull();
    expect(faltaReceberDoOrcamento(pedido({ orcamento_falta_receber: 0, orcamento_pagamentos_pendentes: [] }))).toBeNull();
    expect(faltaReceberDoOrcamento(pedido({ orcamento_falta_receber: 80 }))).toBeNull(); // sem a lista
    expect(faltaReceberDoOrcamento(pedido(COM_FALTA))).toBe(200);
  });

  test("pedido aprovado antes do #1106: falta o marco do saldo pela diferença", () => {
    expect(marcosDaBaixa(pedido(COM_FALTA)).semMarco).toBe(0);
    const antigo = pedido({ orcamento_falta_receber: 250, orcamento_pagamentos_pendentes: [{ id: "pay-dep", kind: "deposit", amount: 100 }] });
    expect(marcosDaBaixa(antigo)).toEqual({ pendentes: [{ id: "pay-dep", kind: "deposit", amount: 100 }], semMarco: 150 });
  });

  test("as quatro formas do Caixa, Pix primeiro, sem crediário", () => {
    expect(FORMAS_DO_ORCAMENTO.map((f) => f.label)).toEqual(["Pix", "Dinheiro", "Crédito", "Débito"]);
  });
});

// ── 2. A Fila ─────────────────────────────────────────────────────────────
describe("cartão da Fila", () => {
  beforeEach(estadoPadrao);

  test("paridade: sem os campos (ou null, ou falta 0) o cartão é o de hoje", async () => {
    const formas = [
      pedido(),
      pedido({ orcamento_recebido: null, orcamento_falta_receber: null, orcamento_pagamentos_pendentes: null }),
      pedido({ orcamento_recebido: 300, orcamento_falta_receber: 0, orcamento_pagamentos_pendentes: [] }),
    ];
    const arvores: string[] = [];
    for (const p of formas) {
      mockListOrders.mockResolvedValue({ orders: [p] });
      const a = await montarFila();
      expect(tem(a, "producao-falta-receber-d1")).toBe(false);
      expect(tem(a, "producao-receber-orcamento-d1")).toBe(false);
      arvores.push(json(a.toJSON()));
      // Entregar vai direto, sem aviso.
      await tocar(a, "producao-avancar-d1");
      expect(tem(a, "producao-aviso-falta")).toBe(false);
      expect(mockUpdateStatus).toHaveBeenLastCalledWith("loja-1", "d1", "delivered", undefined);
      a.unmount();
    }
    expect(arvores[1]).toBe(arvores[0]);
    expect(arvores[2]).toBe(arvores[0]);
  });

  test("com os campos: Falta receber R$ X e Recebi, que baixa o pendente com forma e Idempotency-Key", async () => {
    const a = await montarFila();
    const linha = textoDe(achar(a, "producao-falta-receber-d1")[0]);
    expect(linha).toContain("Falta receber");
    expect(linha).toContain("R$ 200,00");
    await tocar(a, "producao-receber-orcamento-d1");
    expect(tem(a, "folha-da-baixa")).toBe(true);
    // Valor fixo: sem o campo "Quanto entrou".
    expect(json(a.toJSON())).not.toContain("Quanto entrou");
    expect(["pix", "dinheiro", "cartao", "debito"].every((k) => tem(a, `baixa-forma-${k}`))).toBe(true);
    await tocar(a, "baixa-forma-debito");
    await tocar(a, "baixa-confirmar");
    expect(mockMarkPaid).toHaveBeenCalledTimes(1);
    const [cid, pid, corpo, opts] = mockMarkPaid.mock.calls[0];
    expect([cid, pid]).toEqual(["loja-1", "pay-bal"]);
    expect(corpo).toEqual({ forma: "debito", method: "card" });
    expect(typeof opts.idempotencyKey).toBe("string");
    expect(opts.idempotencyKey.length).toBeGreaterThan(8);
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled(); // receber não entrega
    expect(mockListOrders).toHaveBeenCalledTimes(2); // recarrega
    a.unmount();
  });

  test("nova tentativa do mesmo marco vai com a MESMA chave; IDEMPOTENCY_KEY_REUSED troca", async () => {
    mockMarkPaid.mockRejectedValueOnce(Object.assign(new Error("Sem conexão"), { status: 0 }));
    const a = await montarFila();
    await tocar(a, "producao-receber-orcamento-d1");
    await tocar(a, "baixa-confirmar");
    expect(mockToast.error).toHaveBeenCalledWith("Sem conexão");
    expect(tem(a, "folha-da-baixa")).toBe(true); // a folha fica aberta
    mockMarkPaid.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 409, data: { code: "IDEMPOTENCY_KEY_REUSED", error: "Essa tentativa já registrou outro pagamento. Toque de novo para registrar este." },
    }));
    await tocar(a, "baixa-confirmar");
    await tocar(a, "baixa-confirmar");
    const chaves = mockMarkPaid.mock.calls.map((c) => c[3].idempotencyKey);
    expect(chaves[1]).toBe(chaves[0]);
    expect(chaves[2]).not.toBe(chaves[1]);
    expect(mockToast.error).toHaveBeenCalledWith("Essa tentativa já registrou outro pagamento. Toque de novo para registrar este.");
    a.unmount();
  });

  test("recusa com code: a frase do backend, e o pedido que mudou recarrega", async () => {
    mockMarkPaid.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 409, data: { code: "PAGAMENTO_JA_LANCADO", error: "Este pagamento já está no Financeiro. Atualize a tela para ver." },
    }));
    const a = await montarFila();
    await tocar(a, "producao-receber-orcamento-d1");
    await tocar(a, "baixa-confirmar");
    expect(mockToast.error).toHaveBeenCalledWith("Este pagamento já está no Financeiro. Atualize a tela para ver.");
    expect(tem(a, "folha-da-baixa")).toBe(false);
    expect(mockListOrders).toHaveBeenCalledTimes(2);
    a.unmount();
  });

  test("falta maior que os pendentes: cria o marco balance pela diferença e baixa os dois", async () => {
    mockListOrders.mockResolvedValue({
      orders: [pedido({ digital_order_id: "dig-9", orcamento_falta_receber: 250, orcamento_pagamentos_pendentes: [{ id: "pay-dep", kind: "deposit", amount: 200 }] })],
    });
    const a = await montarFila();
    await tocar(a, "producao-receber-orcamento-d1");
    await tocar(a, "baixa-confirmar");
    expect(mockCreatePayment).toHaveBeenCalledWith("loja-1", "dig-9", { kind: "balance", amount: 50 });
    expect(mockMarkPaid.mock.calls.map((c) => c[1])).toEqual(["pay-dep", "pay-novo"]);
    expect(mockMarkPaid.mock.calls[0][2]).toEqual({ forma: "pix", method: "pix" });
    a.unmount();
  });
});

// ── 3. Entregar com falta ─────────────────────────────────────────────────
describe("Marcar como entregue com dinheiro faltando", () => {
  beforeEach(estadoPadrao);

  test("abre o aviso dentro da tela, sem entregar", async () => {
    const a = await montarFila();
    await tocar(a, "producao-avancar-d1");
    expect(tem(a, "producao-aviso-falta")).toBe(true);
    const txt = textoDe(achar(a, "producao-aviso-falta-texto")[0]);
    expect(txt).toContain("Falta receber");
    expect(txt).toContain("R$ 200,00");
    expect(json(a.toJSON())).toContain("Receber agora");
    expect(json(a.toJSON())).toContain("Entregar mesmo assim");
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    a.unmount();
  });

  test("Entregar mesmo assim: entrega sem receber", async () => {
    const a = await montarFila();
    await tocar(a, "producao-avancar-d1");
    await tocar(a, "producao-aviso-falta-entregar");
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "d1", "delivered", undefined);
    expect(mockMarkPaid).not.toHaveBeenCalled();
    expect(tem(a, "producao-aviso-falta")).toBe(false);
    a.unmount();
  });

  test("Receber agora: baixa o pendente e, depois, entrega", async () => {
    const a = await montarFila();
    await tocar(a, "producao-avancar-d1");
    await tocar(a, "producao-aviso-falta-receber");
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(tem(a, "folha-da-baixa")).toBe(true);
    await tocar(a, "baixa-confirmar");
    expect(mockMarkPaid.mock.calls[0][1]).toBe("pay-bal");
    expect(typeof mockMarkPaid.mock.calls[0][3].idempotencyKey).toBe("string");
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "d1", "delivered", undefined);
    expect(mockMarkPaid.mock.invocationCallOrder[0]).toBeLessThan(mockUpdateStatus.mock.invocationCallOrder[0]);
    a.unmount();
  });

  test("Receber agora que falha não entrega", async () => {
    mockMarkPaid.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 422, data: { code: "PEDIDO_SINAL_FORMA", error: "Escolha como a cliente pagou: Pix, dinheiro, crédito ou débito." } }));
    const a = await montarFila();
    await tocar(a, "producao-avancar-d1");
    await tocar(a, "producao-aviso-falta-receber");
    await tocar(a, "baixa-confirmar");
    expect(mockToast.error).toHaveBeenCalledWith("Escolha como a cliente pagou: Pix, dinheiro, crédito ou débito.");
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    a.unmount();
  });
});

// ── 4. O detalhe ──────────────────────────────────────────────────────────
const detalhe = (extra: Record<string, any> = {}): any => ({
  order: { ...pedido(extra), updated_at: "2026-11-20T12:00:00.000Z" },
  items: [{ id: "i1", product_id: "p1", product_name: "Caneca", quantity: 1, unit_price: 300, customization: null }],
  approvals: [],
});

describe("detalhe do pedido", () => {
  beforeEach(estadoPadrao);

  async function montar(Tela: React.ComponentType) {
    let a!: Arvore;
    await act(async () => { a = renderer.create(<Tela />); });
    await esperar();
    return a;
  }

  test("Negócio sem os campos: nada novo, e entregar vai direto", async () => {
    mockGetOrder.mockResolvedValue(detalhe());
    const a = await montar(TelaPedido);
    expect(tem(a, "personalizados-pedido")).toBe(true);
    expect(tem(a, "detalhe-falta-receber")).toBe(false);
    expect(json(a.toJSON())).not.toContain("Falta receber");
    await tocarNoTexto(a, "Avançar para");
    expect(tem(a, "detalhe-aviso-falta")).toBe(false);
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "d1", "delivered", undefined);
    a.unmount();
  });

  test("Negócio com os campos: Falta receber R$ X e Recebi baixa o pendente", async () => {
    mockGetOrder.mockResolvedValue(detalhe(COM_FALTA));
    const a = await montar(TelaPedido);
    const bloco = textoDe(achar(a, "detalhe-falta-receber")[0]);
    expect(bloco).toContain("Falta receber");
    expect(bloco).toContain("R$ 200,00");
    await tocar(a, "btn-receber-orcamento");
    await tocar(a, "baixa-forma-dinheiro");
    await tocar(a, "baixa-confirmar");
    expect(mockMarkPaid).toHaveBeenCalledWith("loja-1", "pay-bal", { forma: "dinheiro", method: "cash" }, { idempotencyKey: expect.any(String) });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    a.unmount();
  });

  test("Negócio, entregar com falta: aviso; Entregar mesmo assim avança", async () => {
    mockGetOrder.mockResolvedValue(detalhe(COM_FALTA));
    const a = await montar(TelaPedido);
    await tocarNoTexto(a, "Avançar para");
    expect(tem(a, "detalhe-aviso-falta")).toBe(true);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    await tocar(a, "detalhe-aviso-falta-entregar");
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "d1", "delivered", undefined);
    expect(mockMarkPaid).not.toHaveBeenCalled();
    a.unmount();
  });

  test("Negócio, Receber agora: baixa e depois entrega", async () => {
    mockGetOrder.mockResolvedValue(detalhe(COM_FALTA));
    const a = await montar(TelaPedido);
    await tocarNoTexto(a, "Avançar para");
    await tocar(a, "detalhe-aviso-falta-receber");
    await tocar(a, "baixa-confirmar");
    expect(mockMarkPaid.mock.calls[0][1]).toBe("pay-bal");
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "d1", "delivered", undefined);
    expect(mockMarkPaid.mock.invocationCallOrder[0]).toBeLessThan(mockUpdateStatus.mock.invocationCallOrder[0]);
    a.unmount();
  });

  test("o /studio não muda: mesmo com os campos, nada de Falta receber nem aviso", async () => {
    mockGetOrder.mockResolvedValue(detalhe(COM_FALTA));
    const a = await montar(TelaDoStudio);
    expect(tem(a, "detalhe-falta-receber")).toBe(false);
    expect(json(a.toJSON())).not.toContain("Falta receber");
    await tocarNoTexto(a, "Avançar para");
    expect(tem(a, "detalhe-aviso-falta")).toBe(false);
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "d1", "delivered", undefined);
    a.unmount();
  });
});
