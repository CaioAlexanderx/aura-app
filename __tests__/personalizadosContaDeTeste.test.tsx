// ============================================================
// Personalizados ligado só na conta de teste (p-188, 18/11/2026).
//
// A trava geral PERSONALIZADOS_LIBERADO segue false. A frente liga também
// para a empresa atual quando o /auth/me traz company.personalizados_teste
// === true (Aura-backend: studio_settings.personalizados_teste, gravada pela
// equipe). O que este teste segura:
//   1. sem a flag, nada muda: as funções da trava, o menu e a tela da
//      Produção são os de hoje (ninguém vê);
//   2. com a flag, a frente aparece quando pdv_settings.studio_enabled ===
//      true e sem vertical_active; outra vertical ou o interruptor
//      desligado continuam fora;
//   3. reage: a flag chegando no store (o /auth/me) liga o menu sem
//      recarregar, e saindo desliga;
//   4. consolidado: a flag não conta (só a constante), e uma loja não
//      libera as outras;
//   5. o menu, Membros e o banner leem a trava pelo hook reativo.
//
// O store aqui é um zustand de verdade, só com o que as telas leem: as
// funções da trava leem a empresa por getState (utils/personalizados.ts),
// e os componentes se inscrevem por seletor, como no app.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockListOrders = jest.fn();
const mockLargura = { valor: 1280 };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };
const mockRefreshMe = jest.fn(() => Promise.resolve());

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useLocalSearchParams: () => ({}),
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
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => {
    const { View } = jest.requireActual("react-native");
    return active ? <View testID="web-portal">{children}</View> : null;
  },
}));
jest.mock("@/services/studioApi", () => ({
  studioApi: { listOrders: (...a: any[]) => mockListOrders(...a), updateProductionStatus: jest.fn() },
}));
jest.mock("@/components/studio/ApprovalRequestModal", () => ({ ApprovalRequestModal: () => null }));
jest.mock("@/components/studio/RegistrarPagamentoSheet", () => ({ RegistrarPagamentoSheet: () => null }));
jest.mock("@/components/studio/PersonalizationPreview", () => ({ PersonalizationPreview: () => null }));
jest.mock("@/components/studio/useCobrarSaldo", () => ({ useCobrarSaldo: () => ({ cobrar: jest.fn(), cobrandoId: null }) }));
jest.mock("@/components/studio/useRegistrarPagamento", () => ({
  useRegistrarPagamento: () => ({ abrir: jest.fn(), fechar: jest.fn(), confirmar: jest.fn(), alvo: null, salvando: false, registrandoId: null }),
}));
jest.mock("@/stores/auth", () => {
  const { create } = jest.requireActual("zustand");
  const useAuthStore = create(() => ({
    company: null, consolidatedView: false, user: { id: "u1" },
    refreshMe: () => mockRefreshMe(), switchCompany: jest.fn(),
  }));
  return { useAuthStore };
});
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: mockPdv.isLoading }) }));
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

import { View } from "react-native";
import { useAuthStore } from "@/stores/auth";
import {
  PERSONALIZADOS_LIBERADO, travaGeral, personalizadosLiberado, personalizadosAtivo,
  casaNoNegocio, vaiParaOStudio, empresaDeTesteDaFrente, testeDaFrenteNaSessao,
} from "@/utils/personalizados";
import { usePersonalizadosLiberado } from "@/hooks/usePersonalizadosLiberado";
import TelaProducao from "@/app/(tabs)/personalizados/producao";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const LOJA = { id: "loja-1", plan: "expansao", vertical_active: null };
const DE_TESTE = { ...LOJA, personalizados_teste: true };
const sessao = (estado: Record<string, any>) => act(() => { (useAuthStore as any).setState(estado); });

const achar = (arvore: renderer.ReactTestRenderer, id: string) => arvore.root.findAllByProps({ testID: id }, { deep: false });
const tem = (arvore: renderer.ReactTestRenderer, id: string) => achar(arvore, id).length > 0;

// A mesma conta do menu (app/(tabs)/_layout.tsx, Sidebar e MBar).
let rendersDaSonda = 0;
function MenuSonda() {
  rendersDaSonda++;
  const activeVertical = (useAuthStore((st: any) => st.company) as any)?.vertical_active as string | null | undefined;
  const pdvSettingsNav = mockPdv.settings;
  const personalizadosLiberadoNav = usePersonalizadosLiberado();
  const personalizadosOn = personalizadosAtivo(pdvSettingsNav, activeVertical, personalizadosLiberadoNav);
  return personalizadosOn ? <View testID="menu-personalizados" /> : null;
}

beforeEach(() => {
  jest.clearAllMocks();
  rendersDaSonda = 0;
  mockLargura.valor = 1280;
  mockListOrders.mockResolvedValue({ orders: [] });
  mockVisiveis.set = new Set(["personalizados.producao"]);
  mockVisiveis.prontos = true;
  mockPdv.settings = { studio_enabled: true };
  mockPdv.isLoading = false;
  (useAuthStore as any).setState({ company: LOJA, consolidatedView: false });
});

describe("a trava, como função", () => {
  test("a constante segue false no código", () => {
    expect(PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("só o booleano true do /auth/me conta como empresa de teste", () => {
    expect(empresaDeTesteDaFrente(DE_TESTE)).toBe(true);
    for (const v of [false, "true", 1, null, undefined, {}]) {
      expect(empresaDeTesteDaFrente({ ...LOJA, personalizados_teste: v } as any)).toBe(false);
    }
    expect(empresaDeTesteDaFrente(LOJA as any)).toBe(false);
    expect(empresaDeTesteDaFrente(null)).toBe(false);
    expect(testeDaFrenteNaSessao({ company: DE_TESTE, consolidatedView: true })).toBe(false);
    expect(testeDaFrenteNaSessao(null)).toBe(false);
  });

  test("sem a flag: tudo como hoje, ninguém vê", () => {
    expect(travaGeral()).toBe(false);
    expect(personalizadosLiberado()).toBe(false);
    expect(personalizadosAtivo({ studio_enabled: true }, null)).toBe(false);
    // casa no Negócio continua desligada: quem é Studio vai para o /studio
    const studio = { ...LOJA, vertical_active: "studio", casa_negocio: true };
    expect(casaNoNegocio(studio)).toBe(false);
    expect(vaiParaOStudio(studio)).toBe(true);
  });

  test("com a flag: liga para a empresa atual, com as mesmas regras da frente", () => {
    (useAuthStore as any).setState({ company: DE_TESTE });
    expect(travaGeral()).toBe(true);
    expect(personalizadosLiberado()).toBe(true);
    expect(personalizadosAtivo({ studio_enabled: true }, null)).toBe(true);
    expect(personalizadosAtivo({ studio_enabled: true }, "")).toBe(true);
    expect(personalizadosAtivo({ studio_enabled: false }, null)).toBe(false);
    expect(personalizadosAtivo({}, null)).toBe(false);
    expect(personalizadosAtivo({ studio_enabled: true }, "studio")).toBe(false);
    expect(personalizadosAtivo({ studio_enabled: true }, "food")).toBe(false);
    // quem passa a trava explícita manda (os testes antigos ligam assim)
    expect(personalizadosAtivo({ studio_enabled: true }, null, false)).toBe(false);
  });

  test("consolidado: a flag não conta, só a constante", () => {
    (useAuthStore as any).setState({ company: DE_TESTE, consolidatedView: true });
    expect(travaGeral()).toBe(false);
    expect(personalizadosLiberado()).toBe(false);
    (useAuthStore as any).setState({ company: null, consolidatedView: true });
    expect(travaGeral()).toBe(false);
  });
});

describe("o menu da frente", () => {
  test("sem a flag: nada aparece, nem com studio_enabled e sem vertical", async () => {
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<MenuSonda />); });
    expect(tem(arvore, "menu-personalizados")).toBe(false);
    arvore.unmount();
  });

  test("com a flag: aparece com studio_enabled e sem vertical; some sem o interruptor ou com vertical", async () => {
    await sessao({ company: DE_TESTE });
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<MenuSonda />); });
    expect(tem(arvore, "menu-personalizados")).toBe(true);

    mockPdv.settings = { studio_enabled: false };
    await act(async () => { arvore.update(<MenuSonda />); });
    expect(tem(arvore, "menu-personalizados")).toBe(false);

    mockPdv.settings = { studio_enabled: true };
    await sessao({ company: { ...DE_TESTE, vertical_active: "studio" } });
    expect(tem(arvore, "menu-personalizados")).toBe(false);
    arvore.unmount();
  });

  test("reage: o /auth/me traz a flag e o menu aparece sem recarregar; ela sai e o menu some", async () => {
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<MenuSonda />); });
    expect(tem(arvore, "menu-personalizados")).toBe(false);
    await sessao({ company: DE_TESTE });
    expect(tem(arvore, "menu-personalizados")).toBe(true);
    await sessao({ company: LOJA });
    expect(tem(arvore, "menu-personalizados")).toBe(false);
    arvore.unmount();
  });

  test("consolidado: a flag de uma loja não acende o menu", async () => {
    await sessao({ company: DE_TESTE, consolidatedView: true });
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<MenuSonda />); });
    expect(tem(arvore, "menu-personalizados")).toBe(false);
    arvore.unmount();
  });

  test("o menu, Membros e o banner da loja leem a trava pelo hook reativo", () => {
    const LAYOUT = ler("app/(tabs)/_layout.tsx");
    expect((LAYOUT.match(/const personalizadosLiberadoNav = usePersonalizadosLiberado\(\);/g) || []).length).toBe(2);
    expect((LAYOUT.match(/const personalizadosOn = personalizadosAtivo\(pdvSettingsNav, activeVertical, personalizadosLiberadoNav\);/g) || []).length).toBe(2);
    const MEMBROS = ler("components/MembersSection.tsx");
    expect(MEMBROS).toContain("const personalizadosLiberadoAqui = usePersonalizadosLiberado();");
    expect(MEMBROS).toContain("const personalizadosOn = personalizadosAtivo(pdvSettings, verticalAtiva, personalizadosLiberadoAqui);");
    const BANNER = ler("components/screens/canal/SecaoBannerPersonalizados.tsx");
    expect(BANNER).toContain("if (!(PERSONALIZADOS_LIBERADO || teste === true)) return null;");
  });

  test("outra mudança na sessão não re-renderiza o menu (o seletor do hook é um booleano)", async () => {
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<MenuSonda />); });
    const antes = rendersDaSonda;
    await sessao({ consolidatedView: false, user: { id: "u1", name: "outra" } });
    expect(rendersDaSonda).toBe(antes);
    arvore.unmount();
  });
});

describe("a tela da Produção (lê a trava pelo padrão das funções)", () => {
  async function montarRota() {
    let arvore!: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<TelaProducao />); });
    await act(async () => { await Promise.resolve(); });
    return arvore;
  }

  test("sem a flag: volta ao Painel e não carrega pedido", async () => {
    const arvore = await montarRota();
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(tem(arvore, "producao-quadro")).toBe(false);
    expect(mockListOrders).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("com a flag: abre a Fila de produção da loja", async () => {
    await sessao({ company: DE_TESTE });
    const arvore = await montarRota();
    expect(tem(arvore, "personalizados-producao")).toBe(true);
    expect(tem(arvore, "producao-quadro")).toBe(true);
    expect(tem(arvore, "redirect")).toBe(false);
    expect(mockListOrders).toHaveBeenCalledWith("loja-1", { days: 60, limit: 300 });
    arvore.unmount();
  });

  test("com a flag e outra vertical: continua fora", async () => {
    await sessao({ company: { ...DE_TESTE, vertical_active: "studio" } });
    const arvore = await montarRota();
    expect(tem(arvore, "redirect")).toBe(true);
    expect(mockListOrders).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("consolidado com a flag na sessão: como hoje, pede para escolher uma loja", async () => {
    await sessao({ company: null, consolidatedView: true });
    const arvore = await montarRota();
    expect(JSON.stringify(arvore.toJSON())).toContain("Escolha uma loja");
    expect(tem(arvore, "producao-consolidada-marcador")).toBe(false);
    arvore.unmount();
  });
});
