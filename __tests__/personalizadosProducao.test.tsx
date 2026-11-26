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
import renderer, { act } from "react-test-renderer";

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
// O arraste é HTML5 do DOM (web). Aqui o hook entrega o onDrop que o quadro
// montou, e o teste solta o cartão chamando-o, como o navegador faria.
const mockDnd: { onDrop: ((id: string, to: string) => void) | null } = { onDrop: null };
jest.mock("@/components/studio/kanban/useStudioKanbanDnD", () => ({
  useStudioKanbanDnD: (onDrop: any) => {
    mockDnd.onDrop = onDrop;
    return { isWeb: true, draggingId: null, hoverStatus: null, onCardDragStart: jest.fn(), onCardDragEnd: jest.fn(), onHoverChange: jest.fn(), onDrop };
  },
  useDraggableCardRef: () => ({ current: null }),
  useDropZoneRef: () => ({ current: null }),
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
// O WebPortal monta por ReactDOM.createPortal, que o react-test-renderer não
// desenha. O mock achata para dentro da árvore e marca que passou por ele.
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => {
    const { View } = jest.requireActual("react-native");
    return active ? <View testID="web-portal">{children}</View> : null;
  },
}));
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

import {
  ETAPAS, PROXIMA_ETAPA, ETAPA_ANTERIOR, etapaAnterior, perguntaDoVoltar, textoDoVoltar, voltarPedeConfirmacao, agruparPorEtapa, dataDeAtivacao, ehAntigoDaAtivacao, etapaInicialNoCelular,
  decidirSolta, fraseDoResumo, nomeDoCliente, origemDoPedido, prazoDoCartao, resumoDaFila, semAntigosDaAtivacao,
} from "@/components/personalizados/regrasDaProducao";
import { QuadroDeProducao } from "@/components/personalizados/QuadroDeProducao";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { MODULE_PLAN_MAP } from "@/hooks/useVisibleModules";
import { MODULOS_OCULTOS } from "@/constants/modulosOcultos";
import TelaProducao from "@/app/(tabs)/personalizados/producao";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");
const FONTE_QUADRO = ler("components/personalizados/QuadroDeProducao.tsx");
const FONTE_ROTA = ler("app/(tabs)/personalizados/producao.tsx");

const pedido = (id: string, extra: Record<string, any> = {}): any => ({
  id, created_at: "2026-11-10T12:00:00.000Z", total_amount: 120, status: "confirmed",
  studio_production_status: "pending_art", customer_name: `Cliente ${id}`, customer_phone: null,
  display_name: `PDV-${id}`, item_count: 1, pending_approval_url: null, approval_count: 0, source: "pdv",
  ...extra,
});

describe("regras da Fila", () => {
  test("cinco etapas no quadro, na ordem do mockup; entregue e cancelado ficam fora", () => {
    expect(ETAPAS.map((e) => e.key)).toEqual(["awaiting_customization", "pending_art", "approved", "in_production", "ready"]);
    expect(ETAPAS.map((e) => e.label)).toEqual(["Aguardando personalização", "Aguardando arte", "Aprovado", "Em produção", "Pronto"]);
    expect(ETAPAS.map((e) => e.curto)).toEqual(["Personalização", "Arte", "Aprovado", "Produção", "Pronto"]);
    expect(PROXIMA_ETAPA).toEqual({
      awaiting_customization: "pending_art", pending_art: "approved", approved: "in_production",
      in_production: "ready", ready: "delivered", delivered: null, cancelled: null,
    });
  });

  test("os botões de etapa têm o texto do mockup", () => {
    const texto = Object.fromEntries(ETAPAS.map((e) => [e.key, e.avancar]));
    expect(texto.approved).toBe("Iniciar produção");
    expect(texto.in_production).toBe("Marcar como pronto");
    expect(texto.ready).toBe("Marcar como entregue");
  });

  test("pedido sem etapa conta como Aguardando arte; entregue, cancelado e desconhecida ficam fora", () => {
    const g = agruparPorEtapa([
      pedido("a", { studio_production_status: null }), pedido("b", { studio_production_status: "inventada" }),
      pedido("c", { studio_production_status: "delivered" }), pedido("d", { studio_production_status: "cancelled" }),
    ]);
    expect(g.pending_art.map((o) => o.id)).toEqual(["a"]);
    expect(Object.values(g).flat()).toHaveLength(1);
  });

  test("o celular abre a primeira etapa com pedido; sem pedido, Aguardando arte", () => {
    expect(etapaInicialNoCelular(agruparPorEtapa([pedido("a", { studio_production_status: "in_production" })]))).toBe("in_production");
    expect(etapaInicialNoCelular(agruparPorEtapa([pedido("a", { studio_production_status: "delivered" })]))).toBe("pending_art");
    expect(etapaInicialNoCelular(agruparPorEtapa([]))).toBe("pending_art");
  });

  test("resumo do cabeçalho: ativos, atrasados e a receber, só dos pedidos ativos", () => {
    const r = resumoDaFila([
      pedido("a", { promised_date: "2020-01-01", balance_amount: 620 }),
      pedido("b", { studio_production_status: "ready", balance_amount: "380.50" }),
      pedido("c", { studio_production_status: "delivered", promised_date: "2020-01-01", balance_amount: 999 }),
      pedido("d", { studio_production_status: "cancelled" }),
    ]);
    expect(r).toEqual({ ativos: 2, atrasados: 1, aReceber: 1000.5 });
    const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
    expect(fraseDoResumo(r, reais)).toBe("2 pedidos ativos · 1 atrasado · R$ 1000,50 a receber");
    expect(fraseDoResumo({ ativos: 1, atrasados: 0, aReceber: 0 }, reais)).toBe("1 pedido ativo");
    expect(fraseDoResumo({ ativos: 0, atrasados: 0, aReceber: 0 }, reais)).toBe("Nenhum pedido ativo");
  });

  test("a receber do cabeçalho soma o falta receber do pedido de orçamento, sem somar duas vezes", () => {
    const r = resumoDaFila([
      pedido("a", { orcamento_falta_receber: 55.85, orcamento_pagamentos_pendentes: [{ id: "m1", kind: "balance", amount: 55.85 }] }),
      pedido("b", { balance_amount: 19.94 }),
      pedido("c", { balance_amount: 10, orcamento_falta_receber: 30, orcamento_pagamentos_pendentes: [] }),
      pedido("d", { orcamento_falta_receber: 0, orcamento_pagamentos_pendentes: [] }),
    ]);
    expect(r.aReceber).toBe(105.79);
  });

  test("nome do cartão: sem cliente, a venda do Caixa não repete o número", () => {
    expect(nomeDoCliente({ customer_name: "Ana", source: "pdv" })).toBe("Ana");
    expect(nomeDoCliente({ customer_name: null, source: "pdv" })).toBe("Venda no Caixa");
    expect(nomeDoCliente({ customer_name: "  ", source: "digital" })).toBe("Sem cadastro");
  });

  test("origem do pedido para o selo do cartão", () => {
    expect(origemDoPedido({ source: "pdv" })).toBe("Caixa");
    expect(origemDoPedido({ source: "digital" })).toBe("Loja online");
    expect(origemDoPedido({ source: "marketplace", marketplace_platform: "shopee" })).toBe("Shopee");
    expect(origemDoPedido({ source: "marketplace", marketplace_platform: "mercado_livre" })).toBe("Mercado Livre");
    expect(origemDoPedido({})).toBeNull();
  });

  test("prazo: a data prometida manda, com o texto do mockup; sem ela, a idade do pedido", () => {
    const agora = Date.parse("2026-11-16T15:00:00.000Z");
    expect(prazoDoCartao({ created_at: "2026-11-16T10:00:00.000Z" }, agora)).toEqual({ texto: "Chegou hoje", tom: "tranquilo" });
    expect(prazoDoCartao({ created_at: "2026-11-14T15:00:00.000Z" }, agora)).toEqual({ texto: "Há 2 dias", tom: "tranquilo" });
    expect(prazoDoCartao({ created_at: "2026-11-06T15:00:00.000Z" }, agora)).toEqual({ texto: "Há 10 dias", tom: "atencao" });
    const hoje = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dia = (n: number) => iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n));
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: dia(0) })).toEqual({ texto: "Entrega hoje", tom: "atencao" });
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: dia(-1) })).toEqual({ texto: "Atrasou 1 dia", tom: "atrasado" });
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: dia(-3) })).toEqual({ texto: "Atrasou 3 dias", tom: "atrasado" });
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: dia(6) })).toEqual({ texto: "Entrega em 6 dias", tom: "tranquilo" });
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: dia(3) })).toEqual({ texto: "Entrega em 3 dias", tom: "atencao" });
  });
});

describe("corte pela data de ativação", () => {
  const ATIVADO = "2026-11-12T00:00:00.000Z";
  const antigo = pedido("antigo", { created_at: "2026-09-01T12:00:00.000Z" });
  const novo = pedido("novo", { created_at: "2026-11-13T12:00:00.000Z" });

  test("venda antiga do Caixa parada em Aguardando arte sai do quadro", () => {
    expect(ehAntigoDaAtivacao(antigo, ATIVADO)).toBe(true);
    expect(semAntigosDaAtivacao([antigo, novo], ATIVADO).map((o) => o.id)).toEqual(["novo"]);
  });

  test("fica o que alguém já moveu de etapa, mesmo antigo", () => {
    for (const etapa of ["approved", "in_production", "ready"]) {
      expect(ehAntigoDaAtivacao({ ...antigo, studio_production_status: etapa }, ATIVADO)).toBe(false);
    }
  });

  test("fica o pedido antigo da loja online e de marketplace", () => {
    expect(ehAntigoDaAtivacao({ ...antigo, source: "digital" }, ATIVADO)).toBe(false);
    expect(ehAntigoDaAtivacao({ ...antigo, source: "marketplace" }, ATIVADO)).toBe(false);
  });

  test("sem data de ativação nada é escondido", () => {
    expect(semAntigosDaAtivacao([antigo, novo], null).map((o) => o.id)).toEqual(["antigo", "novo"]);
    expect(ehAntigoDaAtivacao(antigo, null)).toBe(false);
  });

  test("a data vem de pdv_settings.personalizados_ativado_em; valor ruim vira null", () => {
    expect(dataDeAtivacao({ personalizados_ativado_em: ATIVADO })).toBe(ATIVADO);
    expect(dataDeAtivacao({})).toBeNull();
    expect(dataDeAtivacao(null)).toBeNull();
    expect(dataDeAtivacao({ personalizados_ativado_em: "ontem" })).toBeNull();
    expect(dataDeAtivacao({ personalizados_ativado_em: true })).toBeNull();
  });

  test("pedido com data ilegível não é escondido", () => {
    expect(ehAntigoDaAtivacao({ ...antigo, created_at: "sem data" }, ATIVADO)).toBe(false);
  });
});

// ── Render ────────────────────────────────────────────────────────────────
const achar = (arvore: renderer.ReactTestRenderer, id: string) => arvore.root.findAllByProps({ testID: id }, { deep: false });
const tem = (arvore: renderer.ReactTestRenderer, id: string) => achar(arvore, id).length > 0;

async function montarQuadro(pedidos: any[], props: Partial<{ ativadoEm: string | null }> = {}) {
  mockListOrders.mockResolvedValue({ orders: pedidos });
  let arvore!: renderer.ReactTestRenderer;
  await act(async () => {
    arvore = renderer.create(
      <TemaDoNegocio>
        <QuadroDeProducao companyId="loja-1" ativadoEm={props.ativadoEm ?? null} />
      </TemaDoNegocio>,
    );
  });
  await act(async () => { await Promise.resolve(); });
  return arvore;
}

describe("render do quadro", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLargura.valor = 1280;
    mockUpdateStatus.mockResolvedValue({});
  });

  const TRES = [
    pedido("a1"),
    pedido("b1", { studio_production_status: "in_production" }),
    pedido("c1", { studio_production_status: "delivered" }),
  ];

  test("lê os pedidos da loja pela rota do Studio", async () => {
    const arvore = await montarQuadro(TRES);
    expect(mockListOrders).toHaveBeenCalledWith("loja-1", { days: 60, limit: 300 });
    arvore.unmount();
  });

  test("desktop: as cinco colunas do mockup, lado a lado; entregue não é coluna", async () => {
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "producao-colunas")).toBe(true);
    expect(tem(arvore, "producao-uma-etapa")).toBe(false);
    for (const k of ["awaiting_customization", "pending_art", "approved", "in_production", "ready"]) {
      expect(tem(arvore, `producao-coluna-${k}`)).toBe(true);
    }
    expect(tem(arvore, "producao-coluna-delivered")).toBe(false);
    expect(tem(arvore, "producao-coluna-cancelled")).toBe(false);
    // O pedido entregue saiu da Fila.
    expect(tem(arvore, "producao-cartao-c1")).toBe(false);
    arvore.unmount();
  });

  test("cabeçalho: pedidos ativos, atrasados e quanto falta receber", async () => {
    const arvore = await montarQuadro([
      pedido("x1", { promised_date: "2020-01-01", balance_installment_id: "p1", balance_amount: 620 }),
      pedido("x2", { studio_production_status: "ready" }),
    ]);
    const texto = JSON.stringify(arvore.toJSON());
    expect(texto).toContain("2 pedidos ativos");
    expect(texto).toContain("1 atrasado");
    expect(texto).toContain("a receber");
    arvore.unmount();
  });

  test("cartão: origem, prazo e saldo, como no mockup", async () => {
    const arvore = await montarQuadro([
      pedido("x1", { promised_date: "2020-01-01", balance_installment_id: "p1", balance_amount: 620, source: "digital" }),
    ]);
    const texto = JSON.stringify(arvore.toJSON());
    expect(texto).toContain("Loja online");
    expect(texto).toContain("Atrasou");
    expect(tem(arvore, "producao-saldo-x1")).toBe(true);
    arvore.unmount();
  });

  test("cartão: miniatura da peça e, sem cliente, 'Venda no Caixa' no lugar do número repetido", async () => {
    const arvore = await montarQuadro([
      pedido("x1", { card_image_url: "https://x/mockup.png", card_image_source: "mockup" }),
      pedido("x2", { customer_name: null, display_name: "PDV-dd6d2358" }),
    ]);
    expect(tem(arvore, "producao-capa-x1")).toBe(true);
    expect(tem(arvore, "producao-capa-imagem-x1")).toBe(true);
    expect(tem(arvore, "producao-capa-x2")).toBe(true);
    const texto = JSON.stringify(arvore.toJSON());
    expect(texto).toContain("Venda no Caixa");
    arvore.unmount();
  });

  test("Tirar da fila: a lixeira está sempre no cartão (sem hover); confirma, tira o cartão e não mexe na venda", async () => {
    mockTirar.mockResolvedValue({ ok: true });
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "producao-tirar-a1")).toBe(true);
    await act(async () => { achar(arvore, "producao-tirar-a1")[0].props.onPress(); });
    expect(mockTirar).not.toHaveBeenCalled();
    expect(JSON.stringify(arvore.toJSON())).toContain("Tirar da fila?");
    expect(JSON.stringify(arvore.toJSON())).toContain("A venda e o dinheiro continuam como estão.");
    await act(async () => { achar(arvore, "producao-tirar-confirmar")[0].props.onPress(); });
    expect(mockTirar).toHaveBeenCalledWith("loja-1", "a1");
    expect(tem(arvore, "producao-cartao-a1")).toBe(false);
    expect(tem(arvore, "producao-cartao-b1")).toBe(true);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("Tirar da fila: cancelar a pergunta não chama nada", async () => {
    const arvore = await montarQuadro(TRES);
    await act(async () => { achar(arvore, "producao-tirar-a1")[0].props.onPress(); });
    await act(async () => { achar(arvore, "producao-tirar-cancelar")[0].props.onPress(); });
    expect(mockTirar).not.toHaveBeenCalled();
    expect(tem(arvore, "producao-cartao-a1")).toBe(true);
    arvore.unmount();
  });

  test("Tirar da fila: 404 PEDIDO_NAO_ENCONTRADO recarrega a lista", async () => {
    mockTirar.mockRejectedValue({ status: 404, data: { error: "PEDIDO_NAO_ENCONTRADO" } });
    const arvore = await montarQuadro(TRES);
    expect(mockListOrders).toHaveBeenCalledTimes(1);
    await act(async () => { achar(arvore, "producao-tirar-a1")[0].props.onPress(); });
    await act(async () => { achar(arvore, "producao-tirar-confirmar")[0].props.onPress(); });
    expect(mockListOrders).toHaveBeenCalledTimes(2);
    arvore.unmount();
  });

  test("Tirar da fila: TEM_RECEBIMENTO avisa, mantém o cartão e oferece o cancelamento do pedido", async () => {
    mockTirar.mockRejectedValue({ status: 409, data: { error: "TEM_RECEBIMENTO" }, message: "x" });
    const aberto: string[] = [];
    mockListOrders.mockResolvedValue({ orders: TRES });
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => {
      arvore = renderer.create(
        <TemaDoNegocio><QuadroDeProducao companyId="loja-1" ativadoEm={null} onAbrirPedido={(id) => aberto.push(id)} /></TemaDoNegocio>,
      );
    });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { achar(arvore, "producao-tirar-a1")[0].props.onPress(); });
    await act(async () => { achar(arvore, "producao-tirar-confirmar")[0].props.onPress(); });
    expect(tem(arvore, "producao-tirar-recebimento")).toBe(true);
    expect(JSON.stringify(arvore.toJSON())).toContain("Este pedido tem valor recebido");
    expect(tem(arvore, "producao-cartao-a1")).toBe(true);
    await act(async () => { achar(arvore, "producao-tirar-ir-cancelamento")[0].props.onPress(); });
    expect(aberto).toEqual(["a1"]);
    arvore.unmount();
  });

  test("ações sempre visíveis: o botão da próxima etapa está no cartão sem interação", async () => {
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "producao-avancar-a1")).toBe(true);
    expect(tem(arvore, "producao-aprovacao-a1")).toBe(true);
    expect(tem(arvore, "producao-avancar-b1")).toBe(true);
    // Pedir a arte é só da etapa Aguardando arte.
    expect(tem(arvore, "producao-aprovacao-b1")).toBe(false);
    const texto = JSON.stringify(arvore.toJSON());
    expect(texto).toContain("Pedir aprovação da arte");
    expect(texto).toContain("Marcar como pronto");
    arvore.unmount();
  });

  test("saldo em aberto: Cobrar saldo e Recebi no cartão; sem saldo, não aparecem", async () => {
    const arvore = await montarQuadro([
      pedido("s1", { balance_installment_id: "p1", balance_amount: 80, balance_due_date: "2026-11-20", balance_status: "pending" }),
      pedido("s2"),
    ]);
    expect(tem(arvore, "producao-cobrar-s1")).toBe(true);
    expect(tem(arvore, "producao-recebi-s1")).toBe(true);
    expect(tem(arvore, "producao-cobrar-s2")).toBe(false);
    arvore.unmount();
  });

  test("avançar chama a rota com a próxima etapa e o cartão muda de coluna", async () => {
    const arvore = await montarQuadro(TRES);
    await act(async () => { achar(arvore, "producao-avancar-a1")[0].props.onPress(); });
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "a1", "approved", undefined);
    const aprovado = achar(arvore, "producao-coluna-approved")[0];
    expect(aprovado.findAllByProps({ testID: "producao-cartao-a1" }, { deep: false })).toHaveLength(1);
    arvore.unmount();
  });

  test("erro ao mover devolve o cartão para a etapa de antes", async () => {
    mockUpdateStatus.mockRejectedValueOnce(new Error("falhou"));
    const arvore = await montarQuadro(TRES);
    await act(async () => { achar(arvore, "producao-avancar-a1")[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    const arte = achar(arvore, "producao-coluna-pending_art")[0];
    expect(arte.findAllByProps({ testID: "producao-cartao-a1" }, { deep: false })).toHaveLength(1);
    arvore.unmount();
  });

  test("celular: uma etapa por vez, com seletor; trocar de etapa troca a lista", async () => {
    mockLargura.valor = 390;
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "producao-uma-etapa")).toBe(true);
    expect(tem(arvore, "producao-colunas")).toBe(false);
    // Abre na primeira etapa com trabalho.
    expect(tem(arvore, "producao-cartao-a1")).toBe(true);
    expect(tem(arvore, "producao-cartao-b1")).toBe(false);
    expect(achar(arvore, "producao-etapa-pending_art")[0].props.accessibilityState).toEqual({ selected: true });
    await act(async () => { achar(arvore, "producao-etapa-in_production")[0].props.onPress(); });
    expect(tem(arvore, "producao-cartao-b1")).toBe(true);
    expect(tem(arvore, "producao-cartao-a1")).toBe(false);
    // No celular as ações continuam no cartão.
    expect(tem(arvore, "producao-avancar-b1")).toBe(true);
    arvore.unmount();
  });

  test("celular: o seletor tem alvo de toque de 44 px", async () => {
    mockLargura.valor = 390;
    const arvore = await montarQuadro(TRES);
    const estilo = Object.assign({}, ...[achar(arvore, "producao-etapa-approved")[0].props.style].flat(Infinity).filter(Boolean));
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44);
    arvore.unmount();
  });

  test("arrastar: eventos do DOM no web, nunca o responder system do react-native-web", () => {
    expect(FONTE_QUADRO).toMatch(/useStudioKanbanDnD/);
    expect(FONTE_QUADRO).not.toMatch(/PanResponder|onResponder|onStartShouldSetResponder/);
  });

  test("decidirSolta: mesma coluna nada; seguinte avança; duas ou mais adiante não faz nada; atrás volta (confirma de produção e pronto)", () => {
    expect(decidirSolta("approved", "approved")).toEqual({ acao: "nada" });
    expect(decidirSolta("approved", "delivered")).toEqual({ acao: "nada" });
    expect(decidirSolta("approved", "in_production")).toEqual({ acao: "avancar" });
    expect(decidirSolta("approved", "ready")).toEqual({ acao: "pular" });
    expect(decidirSolta("pending_art", "in_production")).toEqual({ acao: "pular" });
    expect(decidirSolta("approved", "pending_art")).toEqual({ acao: "mover", destino: "pending_art" });
    const c = decidirSolta("in_production", "approved");
    expect(c.acao).toBe("confirmar-voltar");
    expect(decidirSolta("ready", "approved").acao).toBe("confirmar-voltar");
  });

  test("soltar na coluna seguinte faz o mesmo que o botão de avançar", async () => {
    const arvore = await montarQuadro(TRES);
    await act(async () => { mockDnd.onDrop!("a1", "approved"); });
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "a1", "approved", undefined);
    arvore.unmount();
  });

  test("soltar na mesma coluna não faz nada", async () => {
    const arvore = await montarQuadro(TRES);
    await act(async () => { mockDnd.onDrop!("a1", "pending_art"); });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(tem(arvore, "web-portal")).toBe(false);
    arvore.unmount();
  });

  test("soltar numa coluna de trás pede a confirmação; só grava ao confirmar", async () => {
    const arvore = await montarQuadro(TRES);
    await act(async () => { mockDnd.onDrop!("b1", "approved"); });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(tem(arvore, "producao-arraste-voltar-confirmacao")).toBe(true);
    expect(JSON.stringify(arvore.toJSON())).toContain("Voltar este pedido para Aprovado?");
    await act(async () => { achar(arvore, "producao-arraste-voltar-confirmar")[0].props.onPress(); });
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "b1", "approved", undefined);
    arvore.unmount();
  });

  test("cancelar a confirmação do arraste não grava", async () => {
    const arvore = await montarQuadro(TRES);
    await act(async () => { mockDnd.onDrop!("b1", "approved"); });
    await act(async () => { achar(arvore, "producao-arraste-voltar-cancelar")[0].props.onPress(); });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(tem(arvore, "web-portal")).toBe(false);
    arvore.unmount();
  });

  test("sem hover: nenhuma ação depende do mouse por cima", () => {
    expect(FONTE_QUADRO).not.toMatch(/onMouseEnter|onHoverIn|onHoverOut|hovered|:hover/);
  });

  test("overlay por WebPortal: o pedido de aprovação abre dentro dele, e só quando pedido", async () => {
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "web-portal")).toBe(false);
    await act(async () => { achar(arvore, "producao-aprovacao-a1")[0].props.onPress(); });
    const portal = achar(arvore, "web-portal");
    expect(portal).toHaveLength(1);
    expect(portal[0].findAllByProps({ testID: "modal-aprovacao" }, { deep: false })[0].props.accessibilityLabel).toBe("a1");
    // O quadro não abre overlay com <Modal> próprio nem com position fixed.
    expect(FONTE_QUADRO).not.toMatch(/<Modal\b/);
    expect(FONTE_QUADRO).not.toMatch(/position:\s*"fixed"/);
    arvore.unmount();
  });

  test("com data de ativação, a venda antiga do Caixa não nasce no quadro", async () => {
    const antigo = pedido("velho", { created_at: "2026-08-01T12:00:00.000Z" });
    const arvore = await montarQuadro([antigo, pedido("novo", { created_at: "2026-11-15T12:00:00.000Z" })], { ativadoEm: "2026-11-12T00:00:00.000Z" });
    expect(tem(arvore, "producao-cartao-velho")).toBe(false);
    expect(tem(arvore, "producao-cartao-novo")).toBe(true);
    arvore.unmount();
  });

  test("pronto vai para entregue e o cartão sai da Fila", async () => {
    const arvore = await montarQuadro([pedido("r1", { studio_production_status: "ready" }), pedido("a1")]);
    await act(async () => { achar(arvore, "producao-avancar-r1")[0].props.onPress(); });
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "r1", "delivered", undefined);
    expect(tem(arvore, "producao-cartao-r1")).toBe(false);
    arvore.unmount();
  });

  test("só pedido antigo: o quadro nasce vazio, com o recado de vazio", async () => {
    const arvore = await montarQuadro([pedido("velho", { created_at: "2026-08-01T12:00:00.000Z" })], { ativadoEm: "2026-11-12T00:00:00.000Z" });
    expect(tem(arvore, "producao-vazia")).toBe(true);
    arvore.unmount();
  });

  test("falha ao carregar não vira quadro vazio: mostra o erro e o botão de tentar de novo", async () => {
    mockListOrders.mockRejectedValue(new Error("Sem conexão"));
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => {
      arvore = renderer.create(<TemaDoNegocio><QuadroDeProducao companyId="loja-1" ativadoEm={null} /></TemaDoNegocio>);
    });
    await act(async () => { await Promise.resolve(); });
    expect(tem(arvore, "producao-erro")).toBe(true);
    expect(tem(arvore, "producao-vazia")).toBe(false);
    expect(tem(arvore, "producao-tentar-de-novo")).toBe(true);
    arvore.unmount();
  });
});

// ── Voltar uma etapa (25/11/2026) ─────────────────────────────────────────
describe("ETAPA_ANTERIOR", () => {
  test("o inverso do PROXIMA_ETAPA dentro do quadro; a primeira e as saídas não voltam", () => {
    expect(ETAPA_ANTERIOR).toEqual({
      awaiting_customization: null, pending_art: "awaiting_customization", approved: "pending_art",
      in_production: "approved", ready: "in_production", delivered: null, cancelled: null,
    });
    // Coerente com o avançar: a próxima da anterior é a própria etapa.
    for (const e of ETAPAS) {
      const antes = ETAPA_ANTERIOR[e.key];
      if (antes) expect(PROXIMA_ETAPA[antes]).toBe(e.key);
    }
  });

  test("o rótulo é o da coluna; sem anterior, null", () => {
    expect(etapaAnterior("in_production")?.label).toBe("Aprovado");
    expect(etapaAnterior("pending_art")?.label).toBe("Aguardando personalização");
    expect(etapaAnterior("awaiting_customization")).toBeNull();
    expect(etapaAnterior("delivered")).toBeNull();
    expect(etapaAnterior("cancelled")).toBeNull();
    expect(etapaAnterior(null)).toBeNull();
    expect(etapaAnterior("inventada")).toBeNull();
    expect(textoDoVoltar({ label: "Aprovado" })).toBe("Voltar para Aprovado");
    expect(perguntaDoVoltar({ label: "Em produção" })).toBe("Voltar este pedido para Em produção?");
  });

  test("só sair de Em produção ou de Pronto pede confirmação", () => {
    expect(voltarPedeConfirmacao("in_production")).toBe(true);
    expect(voltarPedeConfirmacao("ready")).toBe(true);
    for (const k of ["awaiting_customization", "pending_art", "approved", null]) {
      expect(voltarPedeConfirmacao(k)).toBe(false);
    }
  });
});

describe("Voltar para … no cartão", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLargura.valor = 1280;
    mockUpdateStatus.mockResolvedValue({});
  });

  const QUATRO = [
    pedido("p0", { studio_production_status: "awaiting_customization" }),
    pedido("a1"),
    pedido("b1", { studio_production_status: "in_production" }),
    pedido("r1", { studio_production_status: "ready" }),
  ];
  const { Text: TextoRN } = jest.requireActual("react-native");
  const textoDe = (n: any) => JSON.stringify(n.findAllByType(TextoRN).map((x: any) => x.props.children));
  const plano = (n: any) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));

  test("o botão aparece com o rótulo da coluna anterior; na primeira etapa, não", async () => {
    const arvore = await montarQuadro(QUATRO);
    expect(tem(arvore, "producao-voltar-p0")).toBe(false);
    expect(textoDe(achar(arvore, "producao-voltar-a1")[0])).toContain("Voltar para Aguardando personalização");
    expect(textoDe(achar(arvore, "producao-voltar-b1")[0])).toContain("Voltar para Aprovado");
    expect(textoDe(achar(arvore, "producao-voltar-r1")[0])).toContain("Voltar para Em produção");
    arvore.unmount();
  });

  test("de Aguardando arte volta direto, pela mesma rota do avançar", async () => {
    const arvore = await montarQuadro(QUATRO);
    await act(async () => { achar(arvore, "producao-voltar-a1")[0].props.onPress(); });
    expect(tem(arvore, "web-portal")).toBe(false);
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "a1", "awaiting_customization", undefined);
    const col = achar(arvore, "producao-coluna-awaiting_customization")[0];
    expect(col.findAllByProps({ testID: "producao-cartao-a1" }, { deep: false })).toHaveLength(1);
    arvore.unmount();
  });

  test("de Em produção pede confirmação na tela; Cancelar não grava, Voltar grava a etapa anterior", async () => {
    const arvore = await montarQuadro(QUATRO);
    await act(async () => { achar(arvore, "producao-voltar-b1")[0].props.onPress(); });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(tem(arvore, "web-portal")).toBe(true);
    expect(achar(arvore, "producao-voltar-b1-pergunta")[0].props.children).toBe("Voltar este pedido para Aprovado?");
    expect(textoDe(achar(arvore, "producao-voltar-b1-cancelar")[0])).toContain("Cancelar");
    expect(textoDe(achar(arvore, "producao-voltar-b1-confirmar")[0])).toContain("Voltar");
    await act(async () => { achar(arvore, "producao-voltar-b1-cancelar")[0].props.onPress(); });
    expect(tem(arvore, "web-portal")).toBe(false);
    expect(mockUpdateStatus).not.toHaveBeenCalled();

    await act(async () => { achar(arvore, "producao-voltar-b1")[0].props.onPress(); });
    await act(async () => { achar(arvore, "producao-voltar-b1-confirmar")[0].props.onPress(); });
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "b1", "approved", undefined);
    const col = achar(arvore, "producao-coluna-approved")[0];
    expect(col.findAllByProps({ testID: "producao-cartao-b1" }, { deep: false })).toHaveLength(1);
    arvore.unmount();
  });

  test("de Pronto também pede confirmação e volta para Em produção", async () => {
    const arvore = await montarQuadro(QUATRO);
    await act(async () => { achar(arvore, "producao-voltar-r1")[0].props.onPress(); });
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(achar(arvore, "producao-voltar-r1-pergunta")[0].props.children).toBe("Voltar este pedido para Em produção?");
    await act(async () => { achar(arvore, "producao-voltar-r1-confirmar")[0].props.onPress(); });
    expect(mockUpdateStatus).toHaveBeenCalledWith("loja-1", "r1", "in_production", undefined);
    arvore.unmount();
  });

  test("recusa do backend: o cartão volta para onde estava e o toast mostra a mensagem dele", async () => {
    const { toast } = jest.requireMock("@/components/Toast");
    const msg = "Personalização já foi coletada; não dá pra voltar pra awaiting_customization.";
    mockUpdateStatus.mockRejectedValueOnce(Object.assign(new Error(msg), { status: 400 }));
    const arvore = await montarQuadro([pedido("m1", { source: "marketplace" })]);
    await act(async () => { achar(arvore, "producao-voltar-m1")[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(toast.error).toHaveBeenCalledWith(msg);
    const arte = achar(arvore, "producao-coluna-pending_art")[0];
    expect(arte.findAllByProps({ testID: "producao-cartao-m1" }, { deep: false })).toHaveLength(1);
    arvore.unmount();
  });

  test("alvo de 44 px no botão e na confirmação; no celular o botão continua no cartão", async () => {
    mockLargura.valor = 390;
    const arvore = await montarQuadro(QUATRO);
    await act(async () => { achar(arvore, "producao-etapa-in_production")[0].props.onPress(); });
    expect(plano(achar(arvore, "producao-voltar-b1")[0]).minHeight).toBeGreaterThanOrEqual(44);
    await act(async () => { achar(arvore, "producao-voltar-b1")[0].props.onPress(); });
    expect(plano(achar(arvore, "producao-voltar-b1-confirmar")[0]).minHeight).toBeGreaterThanOrEqual(44);
    expect(plano(achar(arvore, "producao-voltar-b1-cancelar")[0]).minHeight).toBeGreaterThanOrEqual(44);
    arvore.unmount();
  });

  test("sem confirmação do navegador e sem hover no botão de voltar", () => {
    const fonte = ler("components/personalizados/BotaoVoltarEtapa.tsx");
    expect(fonte).not.toMatch(/confirmAlert|window\.confirm|Alert\.alert/);
    expect(fonte).not.toMatch(/onMouseEnter|onHoverIn|onHoverOut|hovered|:hover/);
  });
});

describe("a rota /personalizados/producao", () => {
  const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLargura.valor = 1280;
    mockListOrders.mockResolvedValue({ orders: [] });
    mockAuth.estado = { company: LOJA, consolidatedView: false, user: { id: "u1" }, refreshMe: mockRefreshMe, switchCompany: jest.fn() };
    mockVisiveis.set = new Set(["personalizados.producao"]);
    mockVisiveis.prontos = true;
    mockPdv.settings = { studio_enabled: true };
    mockPdv.isLoading = false;
    mockTrava.liberado = true;
  });

  async function montarRota() {
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<TelaProducao />); });
    await act(async () => { await Promise.resolve(); });
    return arvore;
  }

  test("mod próprio, no mapa de planos, e fora da lista de ocultos", () => {
    expect(FONTE_ROTA).toContain('const MOD_DA_TELA = "personalizados.producao";');
    expect(MODULE_PLAN_MAP["personalizados.producao"]).toBe("negocio");
    expect(MODULOS_OCULTOS.has("personalizados.producao")).toBe(false);
    // Os Orçamentos 3D nasceram no p-175 e os Insumos no p-178: fora dos ocultos.
    expect(MODULOS_OCULTOS.has("personalizados.orcamentos")).toBe(false);
    expect(MODULOS_OCULTOS.has("personalizados.insumos")).toBe(false);
  });

  test("loja com a frente ligada: abre a Fila de produção e refaz /auth/me", async () => {
    const arvore = await montarRota();
    expect(achar(arvore, "hero")[0].props.accessibilityLabel).toBe("Fila de produção");
    expect(tem(arvore, "personalizados-producao")).toBe(true);
    expect(tem(arvore, "producao-quadro")).toBe(true);
    expect(tem(arvore, "redirect")).toBe(false);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(mockListOrders).toHaveBeenCalledWith("loja-1", { days: 60, limit: 300 });
    arvore.unmount();
  });

  test("consolidado com a trava desligada: como antes, pede para escolher uma loja e não carrega pedido", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true, company: null };
    mockTrava.liberado = false;
    const arvore = await montarRota();
    const textos = JSON.stringify(arvore.toJSON());
    expect(textos).toContain("Escolha uma loja");
    expect(textos).toContain("A Produção mostra uma loja por vez.");
    expect(textos).toContain("Escolher loja");
    expect(tem(arvore, "personalizados-producao")).toBe(false);
    expect(mockListOrders).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("consolidado com a trava ligada: a lista de todas as lojas, só leitura (p-187)", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true, company: null };
    const arvore = await montarRota();
    expect(tem(arvore, "producao-consolidada-marcador")).toBe(true);
    expect(JSON.stringify(arvore.toJSON())).not.toContain("Escolha uma loja");
    arvore.unmount();
  });

  test("Essencial ou membro sem permissão: a tela some (volta ao Painel), sem cadeado", async () => {
    mockVisiveis.set = new Set(["painel", "pdv"]);
    const arvore = await montarRota();
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(tem(arvore, "producao-quadro")).toBe(false);
    expect(mockListOrders).not.toHaveBeenCalled();
    // Sem cadeado nem convite de upgrade no que a tela desenha (comentários fora).
    const semComentario = FONTE_ROTA.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
    expect(semComentario).not.toMatch(/upgrade|cadeado|"lock"|Assine|\/planos/i);
    arvore.unmount();
  });

  test("trava desligada (como está no código): ninguém chega à Fila, mesmo com tudo ligado", async () => {
    mockTrava.liberado = false;
    const arvore = await montarRota();
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(tem(arvore, "producao-quadro")).toBe(false);
    expect(mockListOrders).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("frente desligada: some", async () => {
    mockPdv.settings = { studio_enabled: false };
    const arvore = await montarRota();
    expect(tem(arvore, "redirect")).toBe(true);
    arvore.unmount();
  });

  test("empresa no shell /studio (vertical_active = studio): some daqui", async () => {
    mockAuth.estado = { ...mockAuth.estado, company: { ...LOJA, vertical_active: "studio" } };
    const arvore = await montarRota();
    expect(tem(arvore, "redirect")).toBe(true);
    expect(mockListOrders).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("enquanto permissões e configurações carregam, não decide nem redireciona", async () => {
    mockVisiveis.prontos = false;
    mockVisiveis.set = new Set();
    const arvore = await montarRota();
    expect(tem(arvore, "personalizados-producao-esperando")).toBe(true);
    expect(tem(arvore, "redirect")).toBe(false);
    arvore.unmount();
  });

  test("a data de ativação das configurações chega ao quadro", async () => {
    mockPdv.settings = { studio_enabled: true, personalizados_ativado_em: "2026-11-12T00:00:00.000Z" };
    mockListOrders.mockResolvedValue({ orders: [pedido("velho", { created_at: "2026-08-01T12:00:00.000Z" }), pedido("novo", { created_at: "2026-11-15T12:00:00.000Z" })] });
    const arvore = await montarRota();
    expect(tem(arvore, "producao-cartao-velho")).toBe(false);
    expect(tem(arvore, "producao-cartao-novo")).toBe(true);
    arvore.unmount();
  });

  test("o quadro é montado dentro do tema do Negócio", () => {
    expect(FONTE_ROTA).toMatch(/<TemaDoNegocio>\s*<QuadroDeProducao/);
  });
});
