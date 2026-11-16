// ============================================================
// Personalizados › Produção no shell Negócio (p-129, 16/11/2026).
//
// O que este teste segura:
//   1. regras do quadro: etapas, próxima etapa, colunas que só existem com
//      pedido, etapa que o celular abre e o prazo do cartão;
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
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
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
  ETAPAS, PROXIMA_ETAPA, agruparPorEtapa, dataDeAtivacao, ehAntigoDaAtivacao, emAberto,
  etapaInicialNoCelular, etapasVisiveis, prazoDoCartao, semAntigosDaAtivacao,
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

describe("regras do quadro", () => {
  test("sete etapas, cada uma com a próxima certa e fim em Entregue e Cancelados", () => {
    expect(ETAPAS.map((e) => e.key)).toEqual([
      "awaiting_customization", "pending_art", "approved", "in_production", "ready", "delivered", "cancelled",
    ]);
    expect(PROXIMA_ETAPA).toEqual({
      awaiting_customization: "pending_art", pending_art: "approved", approved: "in_production",
      in_production: "ready", ready: "delivered", delivered: null, cancelled: null,
    });
    ETAPAS.forEach((e) => expect(!!e.avancar).toBe(PROXIMA_ETAPA[e.key] !== null));
  });

  test("pedido sem etapa conta como Aguardando arte; etapa desconhecida fica fora", () => {
    const g = agruparPorEtapa([pedido("a", { studio_production_status: null }), pedido("b", { studio_production_status: "inventada" })]);
    expect(g.pending_art.map((o) => o.id)).toEqual(["a"]);
    expect(Object.values(g).flat()).toHaveLength(1);
  });

  test("Personalização e Cancelados só viram coluna com pedido", () => {
    const sem = etapasVisiveis(agruparPorEtapa([pedido("a")])).map((e) => e.key);
    expect(sem).toEqual(["pending_art", "approved", "in_production", "ready", "delivered"]);
    const com = etapasVisiveis(agruparPorEtapa([
      pedido("a", { studio_production_status: "awaiting_customization" }),
      pedido("b", { studio_production_status: "cancelled" }),
    ])).map((e) => e.key);
    expect(com).toContain("awaiting_customization");
    expect(com).toContain("cancelled");
  });

  test("o celular abre a primeira etapa com trabalho; sem trabalho, Aguardando arte", () => {
    expect(etapaInicialNoCelular(agruparPorEtapa([pedido("a", { studio_production_status: "in_production" })]))).toBe("in_production");
    expect(etapaInicialNoCelular(agruparPorEtapa([pedido("a", { studio_production_status: "delivered" })]))).toBe("pending_art");
    expect(etapaInicialNoCelular(agruparPorEtapa([]))).toBe("pending_art");
  });

  test("em aberto não conta entregue nem cancelado", () => {
    const g = agruparPorEtapa([
      pedido("a"), pedido("b", { studio_production_status: "ready" }),
      pedido("c", { studio_production_status: "delivered" }), pedido("d", { studio_production_status: "cancelled" }),
    ]);
    expect(emAberto(g)).toBe(2);
  });

  test("prazo: a data prometida manda; sem ela, a idade do pedido", () => {
    const agora = Date.parse("2026-11-16T15:00:00.000Z");
    expect(prazoDoCartao({ created_at: "2026-11-16T10:00:00.000Z" }, agora)).toEqual({ texto: "há 5h", tom: "tranquilo" });
    expect(prazoDoCartao({ created_at: "2026-11-14T15:00:00.000Z" }, agora)).toEqual({ texto: "há 2d", tom: "atencao" });
    expect(prazoDoCartao({ created_at: "2026-11-06T15:00:00.000Z" }, agora)).toEqual({ texto: "há 10d", tom: "atrasado" });
    const hoje = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: iso(hoje) })).toEqual({ texto: "entrega hoje", tom: "atrasado" });
    const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
    expect(prazoDoCartao({ created_at: "2026-11-01T00:00:00Z", promised_date: iso(ontem) })).toEqual({ texto: "atrasou 1d", tom: "atrasado" });
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
    for (const etapa of ["approved", "in_production", "ready", "delivered", "cancelled"]) {
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

  test("desktop: colunas lado a lado, sem Personalização nem Cancelados vazios", async () => {
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "producao-colunas")).toBe(true);
    expect(tem(arvore, "producao-uma-etapa")).toBe(false);
    for (const k of ["pending_art", "approved", "in_production", "ready", "delivered"]) {
      expect(tem(arvore, `producao-coluna-${k}`)).toBe(true);
    }
    expect(tem(arvore, "producao-coluna-awaiting_customization")).toBe(false);
    expect(tem(arvore, "producao-coluna-cancelled")).toBe(false);
    arvore.unmount();
  });

  test("ações sempre visíveis: o botão da próxima etapa está no cartão sem interação", async () => {
    const arvore = await montarQuadro(TRES);
    expect(tem(arvore, "producao-avancar-a1")).toBe(true);
    expect(tem(arvore, "producao-aprovacao-a1")).toBe(true);
    expect(tem(arvore, "producao-avancar-b1")).toBe(true);
    // Entregue é o fim: sem botão de avançar, e sem pedir arte fora da etapa.
    expect(tem(arvore, "producao-avancar-c1")).toBe(false);
    expect(tem(arvore, "producao-aprovacao-b1")).toBe(false);
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

  test("sem arrastar: o quadro não usa o arraste do Studio nem evento de drag", () => {
    expect(FONTE_QUADRO).not.toMatch(/useStudioKanbanDnD|useDraggableCardRef|useDropZoneRef/);
    expect(FONTE_QUADRO).not.toMatch(/onDragStart|draggable=|PanResponder/);
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
    // As outras três telas ainda não nasceram: continuam ocultas.
    for (const m of ["personalizados.orcamentos", "personalizados.insumos", "personalizados.galeria"]) {
      expect(MODULOS_OCULTOS.has(m)).toBe(true);
    }
  });

  test("loja com a frente ligada: abre o quadro e refaz /auth/me", async () => {
    const arvore = await montarRota();
    expect(tem(arvore, "personalizados-producao")).toBe(true);
    expect(tem(arvore, "producao-quadro")).toBe(true);
    expect(tem(arvore, "redirect")).toBe(false);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(mockListOrders).toHaveBeenCalledWith("loja-1", { days: 60, limit: 300 });
    arvore.unmount();
  });

  test("consolidado multi-CNPJ: pede para escolher uma loja e não carrega pedido", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true, company: null };
    const arvore = await montarRota();
    const textos = JSON.stringify(arvore.toJSON());
    expect(textos).toContain("Escolha uma loja");
    expect(textos).toContain("Escolher loja");
    expect(tem(arvore, "personalizados-producao")).toBe(false);
    expect(mockListOrders).not.toHaveBeenCalled();
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
