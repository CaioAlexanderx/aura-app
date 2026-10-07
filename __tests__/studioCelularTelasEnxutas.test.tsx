// ============================================================
// Studio no celular, etapa 3: telas enxutas (05/10/2026)
//
// As etapas 1 e 2 (studioShellCelular.test.tsx) seguram o shell. Aqui o
// miolo das telas abaixo de 768 px:
//   1. Início: período zerado não mostra "-100%" nem "Período
//      selecionado"; gráfico, Top 5 e funil vazios viram uma linha cada;
//   2. Catálogo: os filtros moram numa folha; o selo "Personalizável" só
//      aparece quando separa uma linha da outra;
//   3. Pedidos: os alertas ficam recolhidos em "2 alertas" e abrem ao
//      toque; os indicadores viram uma faixa;
//   4. Menu: o tema fica no topo, fora da rolagem;
//   5. cabeçalho da página: `mobileSubtitle` troca ou esconde o subtítulo;
//   6. no desktop nada disso vale.
// ============================================================
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(global as any).__DEV__ = false;

let mockLargura = 375;
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  const R = require("react");
  const dims = () => ({ width: mockLargura, height: 812, scale: 1, fontScale: 1 });
  const acessibilidade = {
    isReduceMotionEnabled: () => new Promise(() => {}),
    addEventListener: () => ({ remove() {} }),
  };
  // O Modal do RNW usa portal: aqui ele só passa os filhos adiante.
  const Modal = ({ visible, children }: any) => (visible ? R.createElement(R.Fragment, null, children) : null);
  return new Proxy(RN, {
    get: (alvo: any, k: string) =>
      k === "useWindowDimensions" ? dims
        : k === "AccessibilityInfo" ? acessibilidade
          : k === "Modal" ? Modal
            : alvo[k],
  });
});

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/studio/pedidos",
  useLocalSearchParams: () => ({}),
}));
jest.mock("@react-navigation/native", () => {
  const R = require("react");
  return { useFocusEffect: (f: any) => R.useEffect(() => { f(); }, [f]) };
});
jest.mock("react-native-reanimated", () => {
  const R = require("react");
  const View = ({ children }: any) => R.createElement(R.Fragment, null, children);
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (C: any) => C },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: (v: any) => v,
    Easing: { out: (f: any) => f, cubic: (x: any) => x },
  };
});
jest.mock("react-native-svg", () => {
  const R = require("react");
  const no = (nome: string) => ({ children }: any) => R.createElement(nome, null, children);
  return {
    __esModule: true,
    default: no("svg"),
    Path: no("path"), Circle: no("circle"), Line: no("line"), Text: no("svg-text"),
    Defs: no("defs"), LinearGradient: no("lg"), Stop: no("stop"), Rect: no("rect"),
  };
});
jest.mock("@/contexts/StudioThemeMode", () => {
  const { StudioColors } = jest.requireActual("@/constants/studio-tokens");
  return {
    useStudioTokens: () => StudioColors,
    useStudioTheme: () => ({ mode: "light", setMode: jest.fn(), isDark: false }),
  };
});
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "emp-1" }, user: { name: "Caio" } }) }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/components/studio/StudioScreen", () => {
  const R = require("react");
  return { StudioScreen: ({ children }: any) => R.createElement(R.Fragment, null, children) };
});
jest.mock("@/components/studio/StudioLoading", () => ({ StudioLoading: () => null }));
jest.mock("@/components/studio/StudioEmpty", () => {
  const R = require("react");
  return { StudioEmpty: (p: any) => R.createElement("stub-vazio", p) };
});
jest.mock("@/components/studio/StudioGradient", () => {
  const R = require("react");
  return { StudioGradient: ({ children }: any) => R.createElement(R.Fragment, null, children) };
});
jest.mock("@/components/studio/StudioThemeToggle", () => {
  const R = require("react");
  return { StudioThemeToggle: (p: any) => R.createElement("stub-tema", p) };
});
jest.mock("@/components/studio/AnimatedKpiCounter", () => ({ AnimatedKpiCounter: () => null }));
jest.mock("@/components/studio/SeloDoPagamento", () => ({ SeloDoPagamento: () => null }));
jest.mock("@/components/studio/RegistrarPagamentoSheet", () => ({ RegistrarPagamentoSheet: () => null }));
jest.mock("@/components/studio/BulkOrderWizard", () => ({ BulkOrderWizard: () => null }));
jest.mock("@/components/studio/useCobrarSaldo", () => ({ useCobrarSaldo: () => ({ cobrar: jest.fn(), cobrandoId: null }) }));
jest.mock("@/components/studio/useRegistrarPagamento", () => ({
  useRegistrarPagamento: () => ({ abrir: jest.fn(), registrandoId: null }),
}));
jest.mock("@/services/api", () => ({ request: jest.fn(async () => ({ products: [] })) }));

let mockPainel: any = null;
let mockAlertas: any[] = [];
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    getPainel: jest.fn(async () => mockPainel),
    listOrders: jest.fn(async () => ({ orders: [] })),
  },
}));
jest.mock("@/services/studioBulkHubApi", () => ({
  studioBulkHubApi: {
    hubStats: jest.fn(async () => ({
      orders: { orders_today: 3, in_production: 2, pending_art: 1, ready: 4, overdue: 1 },
      revenue: { last_7d: 480 },
    })),
    hubFeed: jest.fn(async () => ({
      items: [{ id: "p1", kind: "order", created_at: "2026-10-05T12:00:00Z", amount: 90, status: "in_production", name: "Marina", qty: 2, order_number: 12 }],
    })),
    hubAlerts: jest.fn(async () => ({ alerts: mockAlertas })),
  },
}));

import { Text } from "react-native";
import {
  painelZerado, faturamentoVazio, filtrosAtivos, mostrarSeloPersonalizavel, resumoDosAlertas,
} from "@/components/studio/telaEnxuta";
import { CatalogoFiltroSheet } from "@/components/studio/CatalogoFiltroSheet";
import { MobileMenuSheet } from "@/components/studio/StudioShell/MobileMenuSheet";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import StudioPainel from "@/app/studio/(estudio)/index";
import StudioPedidosHub from "@/app/studio/(estudio)/pedidos";

const montados: ReactTestRenderer[] = [];
async function montar(el: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  // O Início monta o PrimeirosPassosCard (app#1026), que usa react-query:
  // sem provider a tela inteira cai com "No QueryClient set". Um cliente
  // novo por montagem, sem retry, como nos outros testes de tela.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { r = create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  // As telas carregam num efeito assíncrono: mais uma volta para assentar.
  await act(async () => { await Promise.resolve(); });
  montados.push(r);
  return r;
}
afterEach(() => {
  act(() => { montados.splice(0).forEach((r) => r.unmount()); });
});
const porTestID = (r: ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });
// O nó que recebe o toque (o testID também passa pelo componente de fora).
const alvo = (r: ReactTestRenderer, id: string) =>
  r.root.findAllByProps({ testID: id }).filter((n) => !!n.props.accessibilityRole && typeof n.props.onPress === "function").slice(0, 1);
// Só o que a lojista lê: as strings dos nós, sem classes nem estilos.
function texto(r: ReactTestRenderer): string {
  const partes: string[] = [];
  const andar = (no: any) => {
    if (no == null) return;
    if (typeof no === "string") { partes.push(no); return; }
    if (Array.isArray(no)) { no.forEach(andar); return; }
    andar(no.children);
  };
  andar(r.toJSON());
  return partes.join("|");
}

const PAINEL_ZERADO = {
  period_days: 7,
  computed_at: "",
  kpis: {
    vendas_dia: { value: 0, delta_pct: -100, sub_label: null },
    ticket_medio: { value: 0, delta_pct: -100, sub_label: null },
    lucro_liquido_mes: { value: 0, receita_mes: 0, despesa_mes: 0, margem_pct: null, delta_pct: -100 },
  },
  faturamento_serie: [{ label: "seg", value: 0 }, { label: "ter", value: 0 }],
  faturamento_total: 0,
  top_produtos: [],
  funil_aprovacao: {
    pendentes: { count: 0, pct: 0 }, aprovados: { count: 0, pct: 0 },
    alteracoes: { count: 0, pct: 0 }, expirados: { count: 0, pct: 0 },
    total_enviados: 0, aprovacao_primeira_pct: null, tempo_medio_resposta_min: null,
  },
};
const PAINEL_COM_VENDA = {
  ...PAINEL_ZERADO,
  kpis: {
    vendas_dia: { value: 320, delta_pct: 12, sub_label: null },
    ticket_medio: { value: 80, delta_pct: -4, sub_label: null },
    lucro_liquido_mes: { value: 900, receita_mes: 1500, despesa_mes: 600, margem_pct: 60, delta_pct: 8 },
  },
  faturamento_serie: [{ label: "seg", value: 100 }, { label: "ter", value: 220, is_today: true }],
  faturamento_total: 320,
  top_produtos: [{ product_id: "a", name: "Caneca", revenue: 200, qty: 4 }],
  funil_aprovacao: { ...PAINEL_ZERADO.funil_aprovacao, total_enviados: 3, pendentes: { count: 3, pct: 100 } },
};

beforeEach(() => {
  mockLargura = 375;
  mockPainel = PAINEL_ZERADO;
  mockAlertas = [];
  mockPush.mockClear();
});

describe("regras (telaEnxuta)", () => {
  test("painel zerado e faturamento vazio", () => {
    expect(painelZerado(null)).toBe(true);
    expect(painelZerado(PAINEL_ZERADO as any)).toBe(true);
    expect(painelZerado(PAINEL_COM_VENDA as any)).toBe(false);
    // Despesa sem venda já é movimento: o lucro negativo tem que aparecer.
    const soDespesa = JSON.parse(JSON.stringify(PAINEL_ZERADO));
    soDespesa.kpis.lucro_liquido_mes.despesa_mes = 50;
    expect(painelZerado(soDespesa)).toBe(false);

    expect(faturamentoVazio(PAINEL_ZERADO as any)).toBe(true);
    expect(faturamentoVazio({ ...PAINEL_ZERADO, faturamento_serie: [] } as any)).toBe(true);
    expect(faturamentoVazio(PAINEL_COM_VENDA as any)).toBe(false);
  });

  test("filtros ativos do catálogo, na ordem da folha", () => {
    expect(filtrosAtivos("all", null)).toEqual([]);
    expect(filtrosAtivos("personalizable", null)).toEqual(["Personalizáveis"]);
    expect(filtrosAtivos("nonpersonalizable", "Canecas")).toEqual(["Não personalizáveis", "Canecas"]);
  });

  test("o selo 'Personalizável' só aparece em 'Todos' com catálogo misto", () => {
    const misto = [{ is_personalizable: true }, { is_personalizable: false }];
    const soPersonalizavel = [{ is_personalizable: true }, { is_personalizable: true }];
    expect(mostrarSeloPersonalizavel("all", misto)).toBe(true);
    expect(mostrarSeloPersonalizavel("all", soPersonalizavel)).toBe(false);
    expect(mostrarSeloPersonalizavel("personalizable", misto)).toBe(false);
    expect(mostrarSeloPersonalizavel("all", [])).toBe(false);
  });

  test("resumo dos alertas: quantidade e a gravidade mais alta", () => {
    expect(resumoDosAlertas([])).toBeNull();
    expect(resumoDosAlertas([{ severity: "info" }])).toEqual({ rotulo: "1 alerta", gravidade: "info" });
    expect(resumoDosAlertas([{ severity: "warning" }, { severity: "danger" }, { severity: "info" }]))
      .toEqual({ rotulo: "3 alertas", gravidade: "danger" });
  });
});

describe("Início", () => {
  test("celular, período zerado: sem '-100%', sem 'Período selecionado', e os três blocos vazios em uma linha cada", async () => {
    const r = await montar(<StudioPainel />);
    const tudo = texto(r);
    expect(tudo).not.toContain("100");
    expect(tudo).not.toContain("Período selecionado");
    expect(tudo).not.toContain("wa.me");
    expect(porTestID(r, "painel-vazio-faturamento")).toHaveLength(1);
    expect(porTestID(r, "painel-vazio-top")).toHaveLength(1);
    expect(porTestID(r, "painel-vazio-funil")).toHaveLength(1);
    // O subtítulo do cabeçalho some no celular.
    expect(tudo).not.toContain("Acompanhe vendas");
  });

  test("celular, com venda: variação e blocos de volta, com o rótulo na língua da lojista", async () => {
    mockPainel = PAINEL_COM_VENDA;
    const r = await montar(<StudioPainel />);
    const tudo = texto(r);
    expect(tudo).toContain("12");
    expect(porTestID(r, "painel-vazio-faturamento")).toHaveLength(0);
    expect(porTestID(r, "painel-vazio-top")).toHaveLength(0);
    expect(porTestID(r, "painel-vazio-funil")).toHaveLength(0);
    expect(tudo).toContain("ARTES ENVIADAS PELO WHATSAPP");
    expect(tudo).not.toContain("wa.me");
  });

  test("desktop não muda: zerado continua com a variação, a legenda e os cartões", async () => {
    mockLargura = 1280;
    const r = await montar(<StudioPainel />);
    const tudo = texto(r);
    expect(tudo).toContain("-100");
    expect(tudo).toContain("Período selecionado");
    expect(tudo).toContain("Acompanhe vendas");
    expect(tudo).toContain("wa.me");
    expect(porTestID(r, "painel-vazio-funil")).toHaveLength(0);
  });
});

describe("Catálogo: folha de filtros", () => {
  const categorias = [{ id: "c1", name: "Canecas", color: "#f00" }, { id: "c2", name: "Camisetas", color: null }];
  const folha = (extra: any = {}) => (
    <CatalogoFiltroSheet
      visible
      onClose={jest.fn()}
      tipo="all"
      onTipo={jest.fn()}
      categorias={categorias}
      categoria={null}
      onCategoria={jest.fn()}
      total={7}
      {...extra}
    />
  );

  test("lista os tipos e as categorias, marca o ativo e avisa a tela na hora", async () => {
    const onTipo = jest.fn();
    const onCategoria = jest.fn();
    const r = await montar(folha({ tipo: "personalizable", onTipo, onCategoria }));
    expect(alvo(r, "filtro-tipo-personalizable")[0].props.accessibilityState.selected).toBe(true);
    expect(alvo(r, "filtro-tipo-all")[0].props.accessibilityState.selected).toBe(false);
    expect(alvo(r, "filtro-categoria-todas")[0].props.accessibilityState.selected).toBe(true);
    act(() => alvo(r, "filtro-tipo-nonpersonalizable")[0].props.onPress());
    expect(onTipo).toHaveBeenCalledWith("nonpersonalizable");
    act(() => alvo(r, "filtro-categoria-c1")[0].props.onPress());
    expect(onCategoria).toHaveBeenCalledWith("Canecas");
    expect(texto(r)).toContain("Ver 7 produtos");
  });

  test("'Limpar' só existe com filtro ligado e zera os dois", async () => {
    const semFiltro = await montar(folha());
    expect(porTestID(semFiltro, "filtro-limpar")).toHaveLength(0);

    const onTipo = jest.fn();
    const onCategoria = jest.fn();
    const r = await montar(folha({ categoria: "Canecas", onTipo, onCategoria, total: 1 }));
    expect(texto(r)).toContain("Ver 1 produto");
    act(() => alvo(r, "filtro-limpar")[0].props.onPress());
    expect(onTipo).toHaveBeenCalledWith("all");
    expect(onCategoria).toHaveBeenCalledWith(null);
  });

  test("sem categorias cadastradas a folha só tem o tipo", async () => {
    const r = await montar(folha({ categorias: [] }));
    expect(porTestID(r, "filtro-categoria-todas")).toHaveLength(0);
    expect(porTestID(r, "filtro-tipo-all")).toHaveLength(1);
  });

  test("os alvos da folha têm 44 px", async () => {
    const { StyleSheet } = jest.requireActual("react-native");
    const r = await montar(folha({ tipo: "personalizable" }));
    for (const id of ["filtro-tipo-all", "filtro-limpar", "filtro-ver"]) {
      expect(StyleSheet.flatten(alvo(r, id)[0].props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});

describe("Pedidos", () => {
  const DOIS = [
    { severity: "warning", kind: "low_stock", title: "Estoque baixo", sub: "Caneca branca", href: "/studio/estoque" },
    { severity: "danger", kind: "overdue", title: "Atrasado", sub: "2 dias", href: "/studio/pedidos/p1", order_id: "p1", order_number: 12 },
  ];

  test("celular: os alertas ficam recolhidos em '2 alertas' e abrem ao toque", async () => {
    mockAlertas = DOIS;
    const r = await montar(<StudioPedidosHub />);
    const resumo = porTestID(r, "pedidos-alertas-resumo");
    expect(resumo).toHaveLength(1);
    expect(texto(r)).toContain("2 alertas");
    expect(porTestID(r, "pedidos-alerta")).toHaveLength(0);
    expect(resumo[0].props.accessibilityState.expanded).toBe(false);

    act(() => resumo[0].props.onPress());
    expect(porTestID(r, "pedidos-alerta")).toHaveLength(2);
    expect(porTestID(r, "pedidos-alertas-resumo")[0].props.accessibilityState.expanded).toBe(true);

    act(() => porTestID(r, "pedidos-alertas-resumo")[0].props.onPress());
    expect(porTestID(r, "pedidos-alerta")).toHaveLength(0);
  });

  test("celular: sem alerta não há linha de alerta; indicadores e abas em uma linha cada", async () => {
    const r = await montar(<StudioPedidosHub />);
    expect(porTestID(r, "pedidos-alertas-resumo")).toHaveLength(0);
    expect(porTestID(r, "pedidos-faixa")).toHaveLength(1);
    expect(porTestID(r, "pedidos-abas")).toHaveLength(1);
    // O subtítulo longo não aparece cortado no celular.
    expect(porTestID(r, "studio-page-subtitle")).toHaveLength(0);
    // E a lista está montada, com o pedido.
    expect(texto(r)).toContain("Marina");
  });

  test("desktop não muda: alertas abertos, sem linha de resumo nem faixa", async () => {
    mockLargura = 1280;
    mockAlertas = DOIS;
    const r = await montar(<StudioPedidosHub />);
    expect(porTestID(r, "pedidos-alertas-resumo")).toHaveLength(0);
    expect(porTestID(r, "pedidos-alerta")).toHaveLength(2);
    expect(texto(r)).toContain("alertas pendentes");
    expect(porTestID(r, "pedidos-faixa")).toHaveLength(0);
    expect(porTestID(r, "pedidos-abas")).toHaveLength(0);
  });
});

describe("Menu do celular", () => {
  test("o tema fica no topo, fora da lista que rola", async () => {
    const r = await montar(
      <MobileMenuSheet visible onClose={jest.fn()} pathname="/studio" onNavigate={jest.fn()} isHome />,
    );
    const tema = porTestID(r, "studio-menu-tema");
    const lista = porTestID(r, "studio-menu-lista");
    expect(tema).toHaveLength(1);
    expect(lista).toHaveLength(1);
    expect(lista[0].findAllByProps({ testID: "studio-menu-tema" })).toHaveLength(0);
    // Vem antes da lista, e o botão é o de 44 px (não o compacto de 40).
    const irmaos = tema[0].parent!.children as any[];
    expect(irmaos.indexOf(tema[0])).toBeLessThan(irmaos.indexOf(lista[0]));
    expect(r.root.findByType("stub-tema" as any).props.compact).toBeFalsy();
    // Cabeçalho baixo: sem o sobretítulo "AURA STUDIO".
    expect(texto(r)).not.toContain("AURA STUDIO");
  });
});

describe("cabeçalho da página: mobileSubtitle", () => {
  test("celular: null esconde, texto troca; sem a prop vale o subtítulo", async () => {
    const some = await montar(<StudioPageHeader eyebrow="X" title="Pedidos" subtitle="Texto longo." mobileSubtitle={null} />);
    expect(porTestID(some, "studio-page-subtitle")).toHaveLength(0);
    const troca = await montar(<StudioPageHeader eyebrow="X" title="Pedidos" subtitle="Texto longo." mobileSubtitle="Curto." />);
    expect(texto(troca)).toContain("Curto.");
    expect(texto(troca)).not.toContain("Texto longo.");
    const padrao = await montar(<StudioPageHeader eyebrow="X" title="Pedidos" subtitle="Texto longo." />);
    expect(texto(padrao)).toContain("Texto longo.");
  });

  test("desktop: o subtítulo de sempre, mesmo com mobileSubtitle", async () => {
    mockLargura = 1280;
    const r = await montar(<StudioPageHeader eyebrow="X" title="Pedidos" subtitle="Texto longo." mobileSubtitle={null} rightSlot={<Text>Ação</Text>} />);
    expect(texto(r)).toContain("Texto longo.");
  });
});
