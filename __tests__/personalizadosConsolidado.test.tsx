// ============================================================
// Personalizados › Produção e Orçamentos 3D de todas as lojas (p-187).
//
// O que este teste segura:
//   1. trava PERSONALIZADOS_LIBERADO desligada (como está no código): no
//      consolidado continua o "Escolha uma loja", sem pedir nada ao servidor;
//   2. consolidado com a trava ligada: lista as lojas (breakdown), os
//      cartões com o nome da loja, filtra por etapa/situação e por loja,
//      pagina, e "Abrir na loja" troca a empresa e volta com o item;
//   3. nenhuma mutação no consolidado: nada de studioApi, nada de botão
//      de etapa, cobrar ou aprovar;
//   4. loja sem a frente ligada fica fora do seletor (e aí "Todas" some);
//   5. com uma loja só: a tela de sempre, e o ?pedido= do "Abrir na loja"
//      deixa o cartão em destaque.
//
// Mocks como em __tests__/personalizadosOrcamentos.test.tsx.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockRequest = jest.fn();
const mockPdvGet = jest.fn();
const mockListOrders = jest.fn();
const mockListQuotes = jest.fn();
const mockUpdateStatus = jest.fn();
const mockSwitch = jest.fn();
const mockReplace = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
const mockParams: { valor: Record<string, any> } = { valor: {} };
const mockLargura = { valor: 1280 };
const mockAuth: { estado: any } = { estado: {} };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };
const mockRefreshMe = jest.fn(() => Promise.resolve());
const mockTrava = { liberado: true };

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  usePathname: () => "/personalizados/producao",
  useLocalSearchParams: () => mockParams.valor,
}));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Modal: ({ visible, children }: any) => (visible ? children : null),
    useWindowDimensions: () => ({ width: mockLargura.valor, height: 800, scale: 1, fontScale: 1 }),
  };
});
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => {
    const { View } = jest.requireActual("react-native");
    return active ? <View testID="web-portal">{children}</View> : null;
  },
}));
jest.mock("@/components/studio/StudioScreen", () => ({
  StudioScreen: ({ children }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="studio-screen">{children}</View>;
  },
}));
jest.mock("@/components/studio/StudioLoading", () => ({ StudioLoading: () => null }));
jest.mock("@/components/studio/StudioEmpty", () => ({ StudioEmpty: () => null }));
jest.mock("@/components/studio/orcamentoModal/OrcamentoModal", () => ({
  OrcamentoModal: (props: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="modal-do-orcamento" {...{ dados: props }} />;
  },
}));
jest.mock("@/components/studio/ApprovalRequestModal", () => ({ ApprovalRequestModal: () => null }));
jest.mock("@/components/studio/RegistrarPagamentoSheet", () => ({ RegistrarPagamentoSheet: () => null }));
jest.mock("@/components/studio/PersonalizationPreview", () => ({ PersonalizationPreview: () => null }));
jest.mock("@/components/studio/useCobrarSaldo", () => ({ useCobrarSaldo: () => ({ cobrar: jest.fn(), cobrandoId: null }) }));
jest.mock("@/components/studio/useRegistrarPagamento", () => ({
  useRegistrarPagamento: () => ({ abrir: jest.fn(), fechar: jest.fn(), confirmar: jest.fn(), alvo: null, salvando: false, registrandoId: null }),
}));
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    listOrders: (...a: any[]) => mockListOrders(...a),
    listQuotes: (...a: any[]) => mockListQuotes(...a),
    updateProductionStatus: (...a: any[]) => mockUpdateStatus(...a),
  },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth.estado) : mockAuth.estado),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: mockPdv.isLoading }) }));
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  return {
    ...real,
    personalizadosAtivo: (s: any, v: any) => real.personalizadosAtivo(s, v, mockTrava.liberado),
    personalizadosLiberado: () => real.personalizadosLiberado(mockTrava.liberado),
  };
});
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  pdvSettingsApi: { get: (...a: any[]) => mockPdvGet(...a) },
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => mockVisiveis.set,
  useVisibleModulesProntos: () => mockVisiveis.prontos,
}));
jest.mock("@/components/ScreenHero", () => ({
  ScreenHero: ({ title, subtitle }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="hero" accessibilityLabel={`${title}${subtitle ? " · " + subtitle : ""}`} />;
  },
}));
jest.mock("@/components/CompanyPickerModal", () => ({
  CompanyPickerModal: () => null,
  getRememberedCompanyId: () => null,
}));

import {
  idDaRota, lojaDoFiltro, rotaDoOrcamentoNaLoja, rotaDoPedidoNaLoja, seletorDeLojas, textoDaPagina, temProxima,
  FILTROS_DE_ETAPA, TAMANHO_DA_PAGINA,
} from "@/components/personalizados/regrasDoConsolidado";
import { meAggregatesApi } from "@/services/meAggregates";
import { esquecerLojasComPersonalizados } from "@/hooks/useLojasComPersonalizados";
import TelaProducao from "@/app/(tabs)/personalizados/producao";
import TelaOrcamentos from "@/app/(tabs)/personalizados/orcamentos";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

// ── Dados ─────────────────────────────────────────────────────────────────
const EMPRESAS = [
  { id: "loja-1", name: "Loja Centro", trade_name: "Loja Centro", vertical: null },
  { id: "loja-2", name: "Loja Shopping", trade_name: "Loja Shopping", vertical: null },
];
const NOMES: Record<string, string> = { "loja-1": "Loja Centro", "loja-2": "Loja Shopping", "loja-3": "Loja Bairro" };
const comInterruptor: Record<string, boolean> = {};
let lojasDoServidor = ["loja-1", "loja-2"];
let totalDoServidor = 3;

const pedido = (id: string, cid: string, extra: Record<string, any> = {}): any => ({
  id, company_id: cid, company_name: NOMES[cid], created_at: "2026-11-15T12:00:00.000Z", total_amount: 120,
  status: "confirmed", studio_production_status: "pending_art", customer_name: `Cliente ${id}`, customer_phone: null,
  display_name: `PDV-${id}`, item_count: 1, pending_approval_url: null, approval_count: 0, source: "pdv",
  card_customization: null, card_image_url: null, ...extra,
});
const PEDIDOS = [
  pedido("o1", "loja-1"),
  pedido("o2", "loja-2", { studio_production_status: "in_production", balance_amount: 80, balance_installment_id: "p1" }),
  pedido("o3", "loja-1", { studio_production_status: "delivered" }),
];
const orcamento = (id: string, cid: string, extra: Record<string, any> = {}): any => ({
  id, company_id: cid, company_name: NOMES[cid], status: "sent", customer_name: `Cliente ${id}`, customer_phone: null,
  total: 150, created_at: "2026-11-15T12:00:00.000Z", expires_at: null, tem_video: false, ...extra,
});
const ORCAMENTOS = [orcamento("q1", "loja-1"), orcamento("q2", "loja-2", { status: "accepted", tem_video: true })];

function parametros(url: string): Record<string, string> {
  const q = url.split("?")[1] || "";
  return Object.fromEntries(q.split("&").filter(Boolean).map((kv) => kv.split("=").map(decodeURIComponent)));
}

function responder(url: string) {
  const p = parametros(url);
  const cid = p.company_id || null;
  const breakdown = lojasDoServidor.map((id, i) => ({ company_id: id, company_name: NOMES[id], is_primary: i === 0, total: id === "loja-1" ? 2 : 1 }));
  if (url.startsWith("/me/studio/orders")) {
    const orders = PEDIDOS.filter((o) => (!cid || o.company_id === cid) && (!p.status || o.studio_production_status === p.status));
    return Promise.resolve({ orders, total: cid || p.status ? orders.length : totalDoServidor, limit: Number(p.limit), offset: Number(p.offset || 0), filtered_company_id: cid, breakdown, company_count: breakdown.length });
  }
  if (url.startsWith("/me/studio/quotes")) {
    const quotes = ORCAMENTOS.filter((q) => (!cid || q.company_id === cid) && (!p.status || q.status === p.status));
    return Promise.resolve({ quotes, total: quotes.length, limit: Number(p.limit), offset: Number(p.offset || 0), filtered_company_id: cid, breakdown, company_count: breakdown.length });
  }
  return Promise.reject(new Error("rota inesperada " + url));
}

// ── Ajudas ────────────────────────────────────────────────────────────────
function achar(arvore: renderer.ReactTestRenderer, id: string): any[] {
  return arvore.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
const tem = (arvore: renderer.ReactTestRenderer, id: string) => achar(arvore, id).length > 0;
const textoDe = (arvore: renderer.ReactTestRenderer) => JSON.stringify(arvore.toJSON());
async function esvaziar() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}
async function montar(el: React.ReactElement) {
  let arvore!: renderer.ReactTestRenderer;
  await act(async () => { arvore = renderer.create(el); });
  await esvaziar();
  return arvore;
}
async function tocar(arvore: renderer.ReactTestRenderer, id: string) {
  const alvo = achar(arvore, id)[0];
  if (!alvo) throw new Error("não achei " + id);
  await act(async () => { alvo.props.onPress(); });
  await esvaziar();
}
const pedidosAoServidor = (rota: string) => mockRequest.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(rota));

beforeEach(() => {
  jest.clearAllMocks();
  esquecerLojasComPersonalizados();
  mockLargura.valor = 1280;
  mockParams.valor = {};
  lojasDoServidor = ["loja-1", "loja-2"];
  totalDoServidor = 3;
  comInterruptor["loja-1"] = true;
  comInterruptor["loja-2"] = true;
  comInterruptor["loja-3"] = false;
  mockRequest.mockImplementation((url: string) => responder(url));
  mockPdvGet.mockImplementation((cid: string) => Promise.resolve({ settings: { studio_enabled: comInterruptor[cid] === true } }));
  mockSwitch.mockResolvedValue(undefined);
  mockListOrders.mockResolvedValue({ orders: [] });
  mockListQuotes.mockResolvedValue({ quotes: [] });
  mockAuth.estado = {
    company: null, consolidatedView: true, user: { id: "u1" }, refreshMe: mockRefreshMe,
    switchCompany: mockSwitch, availableCompanies: EMPRESAS, companiesLoading: false,
    loadCompanies: jest.fn(() => Promise.resolve()), companyLogo: null,
  };
  mockVisiveis.set = new Set(["personalizados.producao", "personalizados.orcamentos"]);
  mockVisiveis.prontos = true;
  mockPdv.settings = { studio_enabled: true };
  mockPdv.isLoading = false;
  mockTrava.liberado = true;
  try { window.sessionStorage.clear(); } catch {}
});

// ── Regras ────────────────────────────────────────────────────────────────
describe("regras do consolidado", () => {
  const BD = [
    { company_id: "loja-1", company_name: "Loja Centro", is_primary: true, total: 2 },
    { company_id: "loja-3", company_name: "Loja Bairro", is_primary: false, total: 5 },
  ];

  test("o seletor tira a loja sem a frente; sem todas as lojas, 'Todas' não vale e o filtro cai na primeira", () => {
    const tudo = seletorDeLojas(BD, new Set(["loja-1", "loja-3"]));
    expect(tudo.podeVerTodas).toBe(true);
    expect(tudo.totalDasLojas).toBe(7);
    expect(lojaDoFiltro(null, tudo)).toBeNull();
    expect(lojaDoFiltro("loja-3", tudo)).toBe("loja-3");

    const parte = seletorDeLojas(BD, new Set(["loja-1"]));
    expect(parte.lojas.map((l) => l.company_id)).toEqual(["loja-1"]);
    expect(parte.podeVerTodas).toBe(false);
    expect(lojaDoFiltro(null, parte)).toBe("loja-1");
    expect(lojaDoFiltro("loja-3", parte)).toBe("loja-1");
    expect(seletorDeLojas(null, new Set()).lojas).toEqual([]);
  });

  test("rotas do Abrir na loja e o id que vem na rota", () => {
    expect(rotaDoPedidoNaLoja("o-1")).toBe("/personalizados/producao?pedido=o-1");
    expect(rotaDoOrcamentoNaLoja("q 1")).toBe("/personalizados/orcamentos?orcamento=q%201");
    expect(idDaRota("abc-123")).toBe("abc-123");
    expect(idDaRota(["abc"])).toBe("abc");
    expect(idDaRota(undefined)).toBeNull();
    expect(idDaRota("<script>")).toBeNull();
  });

  test("paginação e filtros", () => {
    expect(TAMANHO_DA_PAGINA).toBe(30);
    expect(textoDaPagina(0, 30, 75)).toBe("1–30 de 75");
    expect(textoDaPagina(60, 15, 75)).toBe("61–75 de 75");
    expect(temProxima(0, 30, 75)).toBe(true);
    expect(temProxima(60, 15, 75)).toBe(false);
    expect(FILTROS_DE_ETAPA.map((f) => f.key)).toEqual([null, "awaiting_customization", "pending_art", "approved", "in_production", "ready", "delivered", "cancelled"]);
  });

  test("o serviço monta as duas rotas /me/studio só com o que veio", async () => {
    await meAggregatesApi.studioOrders({ company_id: "loja-1", status: "ready", days: 60, limit: 30, offset: 30 });
    expect(mockRequest).toHaveBeenLastCalledWith("/me/studio/orders?company_id=loja-1&status=ready&days=60&limit=30&offset=30", { retry: 1 });
    await meAggregatesApi.studioQuotes({ company_id: null, status: null, limit: 30, offset: 0 });
    expect(mockRequest).toHaveBeenLastCalledWith("/me/studio/quotes?limit=30", { retry: 1 });
  });
});

// ── Trava ─────────────────────────────────────────────────────────────────
describe("trava PERSONALIZADOS_LIBERADO desligada: nada muda", () => {
  test("a trava está em false no código", () => {
    expect(jest.requireActual("@/utils/personalizados").PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("consolidado: Produção e Orçamentos 3D seguem com 'Escolha uma loja', sem pedir nada ao servidor", async () => {
    mockTrava.liberado = false;
    for (const Tela of [TelaProducao, TelaOrcamentos]) {
      const arvore = await montar(<Tela />);
      expect(textoDe(arvore)).toContain("Escolha uma loja");
      expect(tem(arvore, "personalizados-producao-consolidada")).toBe(false);
      expect(tem(arvore, "personalizados-orcamentos-consolidados")).toBe(false);
      arvore.unmount();
    }
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockPdvGet).not.toHaveBeenCalled();
  });
});

// ── Produção consolidada ──────────────────────────────────────────────────
describe("Produção de todas as lojas", () => {
  test("lista as lojas do breakdown e os cartões com o nome da loja; refaz /auth/me", async () => {
    const arvore = await montar(<TelaProducao />);
    expect(tem(arvore, "personalizados-producao-consolidada")).toBe(true);
    expect(achar(arvore, "hero")[0].props.accessibilityLabel).toBe("Fila de produção · Todas as lojas");
    expect(mockRefreshMe).toHaveBeenCalled();
    expect(mockPdvGet.mock.calls.map((c) => c[0]).sort()).toEqual(["loja-1", "loja-2"]);
    expect(pedidosAoServidor("/me/studio/orders")).toEqual(["/me/studio/orders?days=60&limit=30"]);

    expect(tem(arvore, "consolidado-loja-todas")).toBe(true);
    expect(achar(arvore, "consolidado-loja-todas")[0].props.ativo).toBe(true);
    expect(tem(arvore, "consolidado-loja-loja-1")).toBe(true);
    expect(tem(arvore, "consolidado-loja-loja-2")).toBe(true);
    for (const id of ["o1", "o2", "o3"]) expect(tem(arvore, `producao-consolidada-cartao-${id}`)).toBe(true);
    const texto = textoDe(arvore);
    expect(texto).toContain("Loja Centro");
    expect(texto).toContain("Loja Shopping");
    expect(texto).toContain("Em produção");
    expect(texto).toContain("Entregue");
    expect(texto).toContain("só para ler");
    arvore.unmount();
  });

  test("só leitura: nenhum botão de etapa, cobrança ou aprovação, e nada de studioApi", async () => {
    const arvore = await montar(<TelaProducao />);
    const ids = arvore.root.findAll((n: any) => typeof n.props?.testID === "string", { deep: false }).map((n: any) => n.props.testID as string);
    expect(ids.some((id) => /producao-(avancar|cobrar|recebi|aprovacao)-/.test(id))).toBe(false);
    expect(mockListOrders).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockRequest.mock.calls.every((c) => !c[1] || !c[1].method || c[1].method === "GET")).toBe(true);
    arvore.unmount();
  });

  test("filtra por etapa e por loja, sempre da página 1", async () => {
    totalDoServidor = 75;
    const arvore = await montar(<TelaProducao />);
    await tocar(arvore, "producao-consolidada-proxima");
    expect(pedidosAoServidor("/me/studio/orders").pop()).toBe("/me/studio/orders?days=60&limit=30&offset=30");

    await tocar(arvore, "producao-consolidada-filtro-in_production");
    expect(pedidosAoServidor("/me/studio/orders").pop()).toBe("/me/studio/orders?status=in_production&days=60&limit=30");
    expect(tem(arvore, "producao-consolidada-cartao-o2")).toBe(true);
    expect(tem(arvore, "producao-consolidada-cartao-o1")).toBe(false);

    await tocar(arvore, "producao-consolidada-filtro-todos");
    await tocar(arvore, "consolidado-loja-loja-1");
    expect(pedidosAoServidor("/me/studio/orders").pop()).toBe("/me/studio/orders?company_id=loja-1&days=60&limit=30");
    expect(achar(arvore, "consolidado-loja-loja-1")[0].props.ativo).toBe(true);
    expect(tem(arvore, "producao-consolidada-cartao-o2")).toBe(false);
    expect(tem(arvore, "producao-consolidada-cartao-o1")).toBe(true);
    arvore.unmount();
  });

  test("paginação: 30 por página, Anterior e Próxima", async () => {
    totalDoServidor = 75;
    const arvore = await montar(<TelaProducao />);
    expect(textoDe(arvore)).toContain("1–3 de 75");
    expect(achar(arvore, "producao-consolidada-anterior")[0].props.disabled).toBe(true);
    await tocar(arvore, "producao-consolidada-proxima");
    await tocar(arvore, "producao-consolidada-anterior");
    expect(pedidosAoServidor("/me/studio/orders").slice(-2)).toEqual([
      "/me/studio/orders?days=60&limit=30&offset=30",
      "/me/studio/orders?days=60&limit=30",
    ]);
    arvore.unmount();
  });

  test("Abrir na loja troca a empresa e volta para a Fila dela com o pedido", async () => {
    const arvore = await montar(<TelaProducao />);
    await tocar(arvore, "producao-consolidada-abrir-o2");
    expect(mockSwitch).toHaveBeenCalledWith("loja-2");
    expect(window.sessionStorage.getItem("aura_post_switch_redirect")).toBe("/personalizados/producao?pedido=o2");
    expect(textoDe(arvore)).toContain("Abrindo…");
    arvore.unmount();
  });

  test("a troca falha: o redirect sai e a pessoa recebe o aviso", async () => {
    mockSwitch.mockRejectedValue(new Error("x"));
    const arvore = await montar(<TelaProducao />);
    await tocar(arvore, "producao-consolidada-abrir-o1");
    expect(window.sessionStorage.getItem("aura_post_switch_redirect")).toBeNull();
    expect(mockToast.error).toHaveBeenCalled();
    expect(textoDe(arvore)).not.toContain("Abrindo…");
    arvore.unmount();
  });

  test("loja sem a frente ligada fica fora: sem 'Todas', o pedido vai já com a primeira loja", async () => {
    lojasDoServidor = ["loja-1", "loja-3"];
    mockAuth.estado = { ...mockAuth.estado, availableCompanies: [...EMPRESAS, { id: "loja-3", name: "Loja Bairro", vertical: null }] };
    const arvore = await montar(<TelaProducao />);
    expect(tem(arvore, "consolidado-loja-todas")).toBe(false);
    expect(tem(arvore, "consolidado-loja-loja-3")).toBe(false);
    expect(pedidosAoServidor("/me/studio/orders")).toEqual([
      "/me/studio/orders?days=60&limit=30",
      "/me/studio/orders?company_id=loja-1&days=60&limit=30",
    ]);
    expect(tem(arvore, "producao-consolidada-cartao-o1")).toBe(true);
    arvore.unmount();
  });

  test("loja de outra vertical (shell /studio) nem é lida; sem nenhuma loja com a frente, a tela some", async () => {
    mockAuth.estado = { ...mockAuth.estado, availableCompanies: [{ id: "loja-9", name: "Estúdio", vertical: "studio" }] };
    const arvore = await montar(<TelaProducao />);
    expect(mockPdvGet).not.toHaveBeenCalled();
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(mockRequest).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("Essencial ou membro sem permissão: some, sem cadeado", async () => {
    mockVisiveis.set = new Set(["painel"]);
    const arvore = await montar(<TelaProducao />);
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(mockRequest).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("erro do servidor: aviso e Tentar de novo", async () => {
    mockRequest.mockImplementationOnce(() => Promise.reject(new Error("Falhou")));
    const arvore = await montar(<TelaProducao />);
    expect(tem(arvore, "producao-consolidada-erro")).toBe(true);
    await tocar(arvore, "producao-consolidada-tentar-de-novo");
    expect(tem(arvore, "producao-consolidada-lista")).toBe(true);
    arvore.unmount();
  });
});

// ── Orçamentos consolidados ───────────────────────────────────────────────
describe("Orçamentos 3D de todas as lojas", () => {
  test("lista as lojas e as linhas com o nome da loja, sem Novo orçamento", async () => {
    const arvore = await montar(<TelaOrcamentos />);
    expect(tem(arvore, "personalizados-orcamentos-consolidados")).toBe(true);
    expect(pedidosAoServidor("/me/studio/quotes")).toEqual(["/me/studio/quotes?days=180&limit=30"]);
    expect(tem(arvore, "consolidado-loja-loja-1")).toBe(true);
    expect(tem(arvore, "consolidado-loja-loja-2")).toBe(true);
    expect(tem(arvore, "orcamentos-consolidados-linha-q1")).toBe(true);
    expect(tem(arvore, "orcamentos-consolidados-linha-q2")).toBe(true);
    expect(tem(arvore, "novo-orcamento")).toBe(false);
    expect(tem(arvore, "modal-do-orcamento")).toBe(false);
    expect(mockListQuotes).not.toHaveBeenCalled();
    const texto = textoDe(arvore);
    expect(texto).toContain("Loja Shopping");
    expect(texto).toContain("Aceito");
    expect(texto).toContain("com vídeo");
    arvore.unmount();
  });

  test("filtra por situação e por loja", async () => {
    const arvore = await montar(<TelaOrcamentos />);
    await tocar(arvore, "orcamentos-consolidados-filtro-accepted");
    expect(pedidosAoServidor("/me/studio/quotes").pop()).toBe("/me/studio/quotes?status=accepted&days=180&limit=30");
    expect(tem(arvore, "orcamentos-consolidados-linha-q1")).toBe(false);
    await tocar(arvore, "consolidado-loja-loja-1");
    expect(pedidosAoServidor("/me/studio/quotes").pop()).toBe("/me/studio/quotes?company_id=loja-1&status=accepted&days=180&limit=30");
    expect(tem(arvore, "orcamentos-consolidados-vazio")).toBe(true);
    arvore.unmount();
  });

  test("Abrir na loja troca a empresa e volta com o orçamento aberto", async () => {
    const arvore = await montar(<TelaOrcamentos />);
    await tocar(arvore, "orcamentos-consolidados-abrir-q2");
    expect(mockSwitch).toHaveBeenCalledWith("loja-2");
    expect(window.sessionStorage.getItem("aura_post_switch_redirect")).toBe("/personalizados/orcamentos?orcamento=q2");
    arvore.unmount();
  });
});

// ── Uma loja só ───────────────────────────────────────────────────────────
describe("com uma loja só (ou uma loja escolhida): a tela de sempre", () => {
  const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };

  beforeEach(() => {
    mockAuth.estado = { ...mockAuth.estado, company: LOJA, consolidatedView: false, availableCompanies: [] };
  });

  test("Produção: o quadro da loja, sem /me nem leitura das outras lojas", async () => {
    const arvore = await montar(<TelaProducao />);
    expect(tem(arvore, "personalizados-producao")).toBe(true);
    expect(tem(arvore, "personalizados-producao-consolidada")).toBe(false);
    expect(mockListOrders).toHaveBeenCalledWith("loja-1", { days: 60, limit: 300 });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockPdvGet).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("Orçamentos 3D: a lista da loja, sem /me", async () => {
    const arvore = await montar(<TelaOrcamentos />);
    expect(tem(arvore, "personalizados-orcamentos")).toBe(true);
    expect(mockListQuotes).toHaveBeenCalledWith("loja-1", { status: undefined, days: 180, limit: 200 });
    expect(mockRequest).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("?pedido= do Abrir na loja: o cartão fica em destaque e, no celular, a etapa dele abre", async () => {
    mockLargura.valor = 375;
    mockParams.valor = { pedido: "o2" };
    mockListOrders.mockResolvedValue({ orders: [pedido("o1", "loja-1"), pedido("o2", "loja-1", { studio_production_status: "in_production" })] });
    const arvore = await montar(<TelaProducao />);
    expect(achar(arvore, "producao-etapa-in_production")[0].props.accessibilityState).toEqual({ selected: true });
    const cartao = achar(arvore, "producao-cartao-o2")[0];
    expect(JSON.stringify(cartao.props.style)).toContain('"borderWidth":2');
    expect(mockToast.info).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("?pedido= de pedido que já saiu da Fila: avisa", async () => {
    mockParams.valor = { pedido: "o9" };
    mockListOrders.mockResolvedValue({ orders: [pedido("o1", "loja-1")] });
    const arvore = await montar(<TelaProducao />);
    expect(mockToast.info).toHaveBeenCalledWith("Esse pedido não está mais na Fila: já foi entregue ou cancelado.");
    arvore.unmount();
  });

  test("?orcamento= do Abrir na loja: a lista abre com o modal do orçamento", async () => {
    mockParams.valor = { orcamento: "q1" };
    mockListQuotes.mockResolvedValue({ quotes: [orcamento("q1", "loja-1")] });
    const arvore = await montar(<TelaOrcamentos />);
    const modal = achar(arvore, "modal-do-orcamento")[0].props.dados;
    expect(modal.quoteId).toBe("q1");
    expect(modal.cid).toBe("loja-1");
    arvore.unmount();
  });
});

describe("o menu no consolidado", () => {
  test("a seção aparece quando alguma loja do grupo tem a frente (mesma conta da tela)", () => {
    const layout = ler("app/(tabs)/_layout.tsx");
    expect(layout).toContain('import { useLojasComPersonalizados } from "@/hooks/useLojasComPersonalizados";');
    expect((layout.match(/const personalizadosNoMenu = personalizadosOn \|\| lojasComPersonalizados\.ligadas\.size > 0;/g) || []).length).toBe(2);
    const hook = ler("hooks/useLojasComPersonalizados.ts");
    expect(hook).toContain("const ativo = consolidado === true && personalizadosLiberado();");
  });
});
