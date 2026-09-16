// ============================================================
// Rolagem da tela de detalhe do campeonato (QA 16/09/2026).
//
// Bug do Caio: "nas categorias de competição não permite rolar para
// baixo e a última fica cortada" — e, ampliando, "o mesmo problema da
// barra de rolagem em TODAS AS ABAS do evento ativo".
//
// Causa: a tela vive dentro de KarateShell > styles.content, que é
// flex:1 + overflow:"hidden". Nada rola por conta própria ali dentro;
// cada tela precisa declarar a sua rolagem. Esta não declarava nenhuma:
// o rail tinha um ScrollView, mas sem wrapper de altura travada ele
// crescia junto com o conteúdo e nunca acionava, e a área de conteúdo
// não tinha ScrollView nenhum. É o mesmo defeito já corrigido em
// KarateShell e DojoShell (alignSelf:"stretch" + overflow:"hidden" no
// wrapper, flex:1 no ScrollView de dentro).
//
// O que estes testes seguram: em tela LARGA existem duas colunas
// roláveis de altura travada (rail e conteúdo) para TODAS as abas, e em
// tela ESTREITA existe a rolagem de página. react-test-renderer direto
// (não RTL) — moduleNameMapper aponta react-native → react-native-web e
// tudo vira div; a identidade vem do testID.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

var mockLarguraDaJanela = 1440;

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    // Portal do ReactDOM não é hospedado pelo react-test-renderer.
    Modal: ({ visible, children }: any) => (visible ? children : null),
    useWindowDimensions: () => ({ width: mockLarguraDaJanela, height: 640, scale: 1, fontScale: 1 }),
  };
});

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
// expo-font puxa expo-modules-core, que não inicializa sob Jest
// ("Cannot read properties of undefined (reading 'EventEmitter')") —
// mesma armadilha do teste do CategoryTreePicker.
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@expo-google-fonts/shippori-mincho", () => ({ ShipporiMincho_400Regular: "ShipporiMincho" }));
jest.mock("@expo-google-fonts/zen-kaku-gothic-new", () => ({ ZenKakuGothicNew_400Regular: "ZenKaku" }));
jest.mock("@expo-google-fonts/dm-mono", () => ({ DMMono_400Regular: "DMMono" }));
jest.mock("@expo-google-fonts/instrument-serif", () => ({ InstrumentSerif_400Regular: "InstrumentSerif" }));
// require() de .png não passa pelo transform do Jest (binário).
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "comp-1" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/contexts/KarateFederation", () => ({
  useKarateFederation: () => ({ federationId: "fed-1", federationName: "JKA Teste", karateRole: "admin", dojoId: null }),
}));

// As abas pesadas viram marcadores: o que está sob teste é o CONTINENTE
// (as colunas roláveis do workspace), não o conteúdo de cada aba.
jest.mock("@/components/karate/competicoes/DelegacoesTab", () => ({ DelegacoesTab: () => null }));
jest.mock("@/components/karate/competicoes/SetupTab", () => ({ SetupTab: () => null }));
jest.mock("@/components/karate/competicoes/KotosTab", () => ({ KotosTab: () => null }));
jest.mock("@/components/karate/competicoes/PremiacaoTab", () => ({ PremiacaoTab: () => null }));
jest.mock("@/components/karate/competicoes/ArbitragemTab", () => ({ ArbitragemTab: () => null }));
jest.mock("@/components/karate/competicoes/CredenciamentoTab", () => ({ CredenciamentoTab: () => null }));
jest.mock("@/components/karate/EventBannerManager", () => ({ EventBannerManager: () => null }));
jest.mock("@/components/karate/EditarTorneioInfoModal", () => ({ EditarTorneioInfoModal: () => null }));
jest.mock("@/components/karate/chaves/CategoryBracketPanel", () => ({ CategoryBracketPanel: () => null }));
jest.mock("@/components/karate/chaves/PhasePlanModal", () => ({ PhasePlanModal: () => null }));

// 7 categorias — o número real da "Copa JKA Teste 2026" usada no QA, e o
// que fazia a lista estourar a viewport.
const mockCategorias = Array.from({ length: 7 }, (_, i) => ({
  id: "cat-" + (i + 1),
  competition_id: "comp-1",
  name: "Categoria " + (i + 1),
  modality: (i % 2 === 0 ? "kata" : "kumite") as any,
  min_age: null, max_age: null, belt_min: null, belt_max: null,
  sex: "mixed" as any, weight_class: null, max_entries: null, fee_amount: null,
  entry_count: 33,
}));

const mockCompeticao: any = {
  id: "comp-1", federation_id: "fed-1", name: "Copa JKA Teste 2026", season: 2026,
  event_date: "2026-10-10", location: "São Paulo", circuit_round: 1, fee_amount: 50,
  status: "open", category_count: 7, entry_count: 233, categories: mockCategorias,
  pricing_config: {},
};

jest.mock("@/services/karateCompetitionsApi", () => {
  const real = jest.requireActual("@/services/karateCompetitionsApi");
  return {
    ...real,
    karateCompetitionsApi: {
      getCompetition: jest.fn(async () => mockCompeticao),
      listEntries: jest.fn(async () => []),
      getRanking: jest.fn(async () => []),
    },
  };
});
jest.mock("@/services/karateCompetitionSetupApi", () => ({
  karateCompetitionSetupApi: { listDivisions: jest.fn(async () => []) },
}));
jest.mock("@/services/karateCompetitionP1Api", () => ({
  karateCompetitionP1Api: { getScoresheet: jest.fn(async () => ({})) },
}));
jest.mock("@/services/karateBracketsApi", () => ({
  karateBracketsApi: {
    getBracket: jest.fn(async () => null),
    getKataScores: jest.fn(async () => null),
  },
}));

import TorneioDetalhe from "@/app/karate/(federation)/competicoes/torneio/[id]";

async function montar(largura: number) {
  mockLarguraDaJanela = largura;
  let tree: any;
  await act(async () => { tree = renderer.create(<TorneioDetalhe />); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return tree;
}

// deep:false para pegar só o elemento MAIS EXTERNO com o testID — o
// react-test-renderer enxerga o mesmo testID repetido em cada camada
// (View do RN, div do RNW) e sem isso cada busca devolveria 4 nós.
function porTestId(tree: any, id: string) {
  return tree.root.findAllByProps({ testID: id }, { deep: false });
}

/** Achata o style (array/objeto) num objeto só, como o RN resolve. */
function estilo(node: any): Record<string, any> {
  const flat = (v: any): Record<string, any> =>
    Array.isArray(v) ? v.reduce((acc: any, x: any) => ({ ...acc, ...flat(x) }), {}) : (v || {});
  return flat(node.props.style);
}

/** Item do rail (é um Pressable) pelo rótulo visível. */
function itemDoRail(tree: any, rotulo: string) {
  return porTestId(tree, "rail-item-" + rotulo)[0];
}

const ABAS = [
  "Visão geral", "Ranking geral", "Delegações", "Credenciamento",
  "Kotos", "Premiação", "Arbitragem", "Configurar",
];

describe("detalhe do campeonato — rolagem (tela larga)", () => {
  it("o rail de categorias é uma coluna de altura travada com ScrollView dentro", async () => {
    const tree = await montar(1440);

    const wrap = porTestId(tree, "rail-wide");
    expect(wrap.length).toBe(1);
    const st = estilo(wrap[0]);
    // Sem estes dois o wrapper cresce com o conteúdo e o ScrollView de
    // dentro nunca aciona — é exatamente o bug que o usuário viu.
    expect(st.alignSelf).toBe("stretch");
    expect(st.overflow).toBe("hidden");

    const scroll = porTestId(tree, "rail-wide-scroll");
    expect(scroll.length).toBe(1);
    expect(estilo(scroll[0]).flex).toBe(1);
  });

  it("as 7 categorias estão todas montadas dentro do rail rolável", async () => {
    const tree = await montar(1440);
    // A 4ª era a que aparecia pela metade no print do QA; a 7ª nem existia
    // na tela. Todas têm de estar montadas dentro do rail rolável.
    for (let i = 1; i <= 7; i++) {
      expect(itemDoRail(tree, "Categoria " + i)).toBeDefined();
    }
    expect(porTestId(tree, "rail-item-Categoria 8").length).toBe(0);
  });

  it("a área de conteúdo rola em TODAS as abas do evento", async () => {
    for (const rotulo of ABAS) {
      const tree = await montar(1440);

      const item = itemDoRail(tree, rotulo);
      expect(item).toBeDefined();
      await act(async () => { item.props.onPress(); });

      const area = porTestId(tree, "content-area");
      expect(area.length).toBe(1);
      const st = estilo(area[0]);
      expect(st.alignSelf).toBe("stretch");
      expect(st.overflow).toBe("hidden");

      const scroll = porTestId(tree, "content-scroll");
      expect(scroll.length).toBe(1);
      expect(estilo(scroll[0]).flex).toBe(1);
    }
  });

  it("selecionar uma categoria também cai numa área rolável", async () => {
    const tree = await montar(1440);
    const item = itemDoRail(tree, "Categoria 7");
    expect(item).toBeDefined();
    await act(async () => { item.props.onPress(); });
    expect(porTestId(tree, "content-scroll").length).toBe(1);
  });

  it("em tela larga não existe rolagem de página — quem rola são as colunas", async () => {
    const tree = await montar(1440);
    expect(porTestId(tree, "page-scroll").length).toBe(0);
  });
});

describe("detalhe do campeonato — rolagem (tela estreita / mobile)", () => {
  it("a página inteira rola, levando o cabeçalho do campeonato junto", async () => {
    const tree = await montar(375);
    expect(porTestId(tree, "page-scroll").length).toBe(1);
    // No estreito a coluna larga não existe e o conteúdo não ganha
    // ScrollView próprio (seria rolagem vertical aninhada).
    expect(porTestId(tree, "rail-wide").length).toBe(0);
    expect(porTestId(tree, "content-scroll").length).toBe(0);
  });

  it("o conteúdo estreito cresce com a página em vez de travar a altura", async () => {
    const tree = await montar(375);
    const area = porTestId(tree, "content-area")[0];
    expect(estilo(area).overflow).toBeUndefined();
  });
});
