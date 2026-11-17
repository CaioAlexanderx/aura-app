// ============================================================
// Personalizados › Orçamentos 3D no shell Negócio (p-175, 17/11/2026).
//
// O que este teste segura:
//   1. com a trava PERSONALIZADOS_LIBERADO em false (como está no código),
//      ninguém chega à tela, mesmo com a frente e o módulo ligados, e o item
//      não vai ao menu;
//   2. com a trava ligada: a rota abre, refaz /auth/me, e a lista do Studio
//      (ListaDeOrcamentos, sem cópia) carrega os orçamentos da loja;
//   3. a linha abre o mesmo OrcamentoModal do Studio, com a loja certa, e o
//      "Ver pedido" leva à Fila de produção do Negócio;
//   4. no celular o "Novo orçamento" fica no cabeçalho (não há flutuante);
//   5. consolidado multi-CNPJ: "Escolha uma loja", como a Produção (p-129);
//   6. some no Essencial, sem a frente e no shell /studio;
//   7. o /studio continua igual: sem as props novas a lista é a de sempre.
//
// Padrão de render da casa: react-test-renderer, identidade por testID e
// findAll com { deep: false } (mocks de __tests__/personalizacaoNoEstoque).
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockListQuotes = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockLargura = { valor: 1280 };
const mockAuth: { estado: any } = { estado: {} };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };
const mockRefreshMe = jest.fn(() => Promise.resolve());

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => "/personalizados/orcamentos",
  useLocalSearchParams: () => ({}),
}));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Modal: ({ visible, children }: any) => (visible ? children : null),
    useWindowDimensions: () => ({ width: mockLargura.valor, height: 800, scale: 1, fontScale: 1 }),
  };
});
// O casco do Studio (animação de entrada, arcos) não importa aqui: um View.
jest.mock("@/components/studio/StudioScreen", () => ({
  StudioScreen: ({ children }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="studio-screen">{children}</View>;
  },
}));
jest.mock("@/components/studio/StudioLoading", () => ({
  StudioLoading: () => {
    const { View } = jest.requireActual("react-native");
    return <View testID="lista-carregando" />;
  },
}));
jest.mock("@/components/studio/StudioEmpty", () => ({
  StudioEmpty: ({ title }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="lista-vazia" accessibilityLabel={title} />;
  },
}));
// O modal do orçamento (3D, vídeo, aprovar) é o do Studio: aqui um marcador
// que guarda as props recebidas.
jest.mock("@/components/studio/orcamentoModal/OrcamentoModal", () => ({
  OrcamentoModal: (props: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="modal-do-orcamento" {...{ dados: props }} />;
  },
}));
jest.mock("@/services/studioApi", () => ({
  studioApi: { listQuotes: (...a: any[]) => mockListQuotes(...a) },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth.estado) : mockAuth.estado),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: mockPdv.isLoading }) }));
// A trava geral fica desligada no código (Caio, 16/11). Aqui ela é ligada de
// propósito; o bloco "trava desligada" prova que, como está no código, nada
// muda.
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
jest.mock("@/components/personalizados/consolidado/OrcamentosConsolidados", () => ({
  OrcamentosConsolidados: () => {
    const { View } = jest.requireActual("react-native");
    return <View testID="orcamentos-consolidados-marcador" />;
  },
}));
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

import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { MODULOS_OCULTOS } from "@/constants/modulosOcultos";
import { ListaDeOrcamentos } from "@/components/studio/orcamentoModal/ListaDeOrcamentos";
import TelaOrcamentos from "@/app/(tabs)/personalizados/orcamentos";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");
const FONTE_ROTA = ler("app/(tabs)/personalizados/orcamentos.tsx");
const FONTE_MODAL = ler("components/studio/orcamentoModal/OrcamentoModal.tsx");
const FONTE_LAYOUT = ler("app/(tabs)/_layout.tsx");

const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };

const orcamento = (id: string, extra: Record<string, any> = {}): any => ({
  id, company_id: "loja-1", status: "sent", customer_name: `Cliente ${id}`, customer_phone: null,
  total: 150, created_at: "2026-11-15T12:00:00.000Z", expires_at: null, tem_video: false,
  ...extra,
});

function achar(arvore: renderer.ReactTestRenderer, id: string): any[] {
  return arvore.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
function tem(arvore: renderer.ReactTestRenderer, id: string): boolean {
  return achar(arvore, id).length > 0;
}
async function montar(el: React.ReactElement) {
  let arvore!: renderer.ReactTestRenderer;
  await act(async () => { arvore = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return arvore;
}
const montarRota = () => montar(<TelaOrcamentos />);
const textoDe = (arvore: renderer.ReactTestRenderer) => JSON.stringify(arvore.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockLargura.valor = 1280;
  mockListQuotes.mockResolvedValue({ quotes: [orcamento("q1"), orcamento("q2", { tem_video: true })] });
  mockAuth.estado = {
    company: LOJA, consolidatedView: false, user: { id: "u1" }, refreshMe: mockRefreshMe,
    switchCompany: jest.fn(), availableCompanies: [], loadCompanies: jest.fn(() => Promise.resolve()), companyLogo: null,
  };
  mockVisiveis.set = new Set(["personalizados.orcamentos"]);
  mockVisiveis.prontos = true;
  mockPdv.settings = { studio_enabled: true };
  mockPdv.isLoading = false;
  mockTrava.liberado = true;
});

describe("trava PERSONALIZADOS_LIBERADO desligada: nada muda", () => {
  test("a trava está em false no código", () => {
    expect(jest.requireActual("@/utils/personalizados").PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("ninguém chega aos Orçamentos 3D, mesmo com a frente e o módulo ligados", async () => {
    mockTrava.liberado = false;
    const arvore = await montarRota();
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(tem(arvore, "personalizados-orcamentos")).toBe(false);
    expect(mockListQuotes).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("o item do menu só existe com a frente ligada (personalizadosToggle)", () => {
    const linha = FONTE_LAYOUT.split(/\r?\n/).find((l) => l.includes('s: "Personalizados"')) || "";
    expect(linha).toContain('{ r: "/personalizados/orcamentos", l: "Orçamentos 3D", ic: "clipboard", mod: "personalizados.orcamentos", personalizadosToggle: true }');
    expect(FONTE_LAYOUT).toContain("if (item.personalizadosToggle && personalizadosOn !== true) return false;");
  });
});

describe("a rota /personalizados/orcamentos", () => {
  test("mod próprio, no mapa de planos e de permissões, fora dos ocultos, sem colidir com matcon.orcamentos", () => {
    expect(FONTE_ROTA).toContain('const MOD_DA_TELA = "personalizados.orcamentos";');
    expect(MODULE_PLAN_MAP["personalizados.orcamentos"]).toBe("negocio");
    expect(PERM_TO_MODULES["personalizados.access"]).toContain("personalizados.orcamentos");
    expect(MODULOS_OCULTOS.has("personalizados.orcamentos")).toBe(false);
    const codigo = FONTE_ROTA.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(codigo).not.toContain("matcon");
    expect(fs.existsSync(path.join(raiz, "app/(tabs)/matcon/orcamentos.tsx"))).toBe(true);
  });

  test("loja com a frente ligada: abre, refaz /auth/me e a lista carrega os orçamentos da loja", async () => {
    const arvore = await montarRota();
    expect(tem(arvore, "personalizados-orcamentos")).toBe(true);
    expect(tem(arvore, "redirect")).toBe(false);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(mockListQuotes).toHaveBeenCalledTimes(1);
    expect(mockListQuotes).toHaveBeenCalledWith("loja-1", { status: undefined, days: 180, limit: 200 });
    expect(tem(arvore, "linha-q1")).toBe(true);
    expect(tem(arvore, "linha-q2")).toBe(true);
    const textos = textoDe(arvore);
    expect(textos).toContain("Orçamentos 3D");
    expect(textos).toContain("PERSONALIZADOS");
    expect(textos).not.toContain("GESTÃO · ORÇAMENTOS");
    expect(textos).toContain("Cliente q1");
    expect(textos).toContain("vídeo");
    arvore.unmount();
  });

  test("sem orçamento: o vazio da lista, com o convite para o primeiro", async () => {
    mockListQuotes.mockResolvedValue({ quotes: [] });
    const arvore = await montarRota();
    expect(achar(arvore, "lista-vazia")[0].props.accessibilityLabel).toBe("Nenhum orçamento");
    arvore.unmount();
  });

  test("a linha abre o modal do Studio com a loja e o orçamento; Ver pedido abre o detalhe do pedido no Negócio (p-176)", async () => {
    const arvore = await montarRota();
    expect(tem(arvore, "modal-do-orcamento")).toBe(false);
    await act(async () => { achar(arvore, "linha-q1")[0].props.onPress(); });
    const modal = achar(arvore, "modal-do-orcamento")[0].props.dados;
    expect(modal.cid).toBe("loja-1");
    expect(modal.quoteId).toBe("q1");
    expect(modal.consolidado).toBe(false);
    expect(modal.rotaDoPedido("pedido-9")).toBe("/personalizados/pedido/pedido-9");
    arvore.unmount();
  });

  test("Novo orçamento abre o modal em branco, na loja aberta", async () => {
    const arvore = await montarRota();
    await act(async () => { achar(arvore, "novo-orcamento")[0].props.onPress(); });
    const modal = achar(arvore, "modal-do-orcamento")[0].props.dados;
    expect(modal.quoteId).toBe("novo");
    expect(modal.cid).toBe("loja-1");
    arvore.unmount();
  });

  test("celular: sem flutuante no Negócio, o Novo orçamento fica no cabeçalho", async () => {
    mockLargura.valor = 375;
    const arvore = await montarRota();
    expect(tem(arvore, "studio-page-actions")).toBe(true);
    expect(tem(arvore, "novo-orcamento")).toBe(true);
    arvore.unmount();
  });

  test("consolidado com a trava desligada: como antes, pede para escolher uma loja e não carrega orçamento", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true, company: null };
    mockTrava.liberado = false;
    const arvore = await montarRota();
    const textos = textoDe(arvore);
    expect(textos).toContain("Escolha uma loja");
    expect(textos).toContain("Os Orçamentos 3D mostram uma loja por vez.");
    expect(textos).toContain("Escolher loja");
    expect(tem(arvore, "personalizados-orcamentos")).toBe(false);
    expect(mockListQuotes).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("consolidado com a trava ligada: a lista de todas as lojas, só leitura (p-187)", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true, company: null };
    const arvore = await montarRota();
    expect(tem(arvore, "orcamentos-consolidados-marcador")).toBe(true);
    expect(JSON.stringify(arvore.toJSON())).not.toContain("Escolha uma loja");
    arvore.unmount();
  });

  test("Essencial ou membro sem permissão: a tela some (volta ao Painel), sem cadeado", async () => {
    mockVisiveis.set = new Set(["painel", "pdv"]);
    const arvore = await montarRota();
    expect(achar(arvore, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(mockListQuotes).not.toHaveBeenCalled();
    const semComentario = FONTE_ROTA.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
    expect(semComentario).not.toMatch(/upgrade|cadeado|"lock"|Assine|\/planos/i);
    arvore.unmount();
  });

  test("frente desligada: some", async () => {
    mockPdv.settings = { studio_enabled: false };
    const arvore = await montarRota();
    expect(tem(arvore, "redirect")).toBe(true);
    expect(mockListQuotes).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("empresa no shell /studio (vertical_active = studio): some daqui", async () => {
    mockAuth.estado = { ...mockAuth.estado, company: { ...LOJA, vertical_active: "studio" } };
    const arvore = await montarRota();
    expect(tem(arvore, "redirect")).toBe(true);
    expect(mockListQuotes).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("enquanto permissões e configurações carregam, não decide nem redireciona", async () => {
    mockVisiveis.prontos = false;
    mockVisiveis.set = new Set();
    const arvore = await montarRota();
    expect(tem(arvore, "personalizados-orcamentos-esperando")).toBe(true);
    expect(tem(arvore, "redirect")).toBe(false);
    arvore.unmount();
  });

  test("a lista é a do Studio, montada dentro do tema do Negócio", () => {
    expect(FONTE_ROTA).toMatch(/<TemaDoNegocio>\s*<ListaDeOrcamentos/);
    expect(FONTE_ROTA).toContain('from "@/components/studio/orcamentoModal/ListaDeOrcamentos"');
  });
});

describe("o /studio continua igual", () => {
  test("sem as props novas: cabeçalho de sempre e, no celular, sem botão no cabeçalho (fica o flutuante)", async () => {
    mockLargura.valor = 375;
    const arvore = await montar(<ListaDeOrcamentos />);
    const textos = textoDe(arvore);
    expect(textos).toContain("GESTÃO · ORÇAMENTOS");
    expect(textos).not.toContain("Orçamentos 3D");
    expect(tem(arvore, "novo-orcamento")).toBe(false);
    arvore.unmount();
  });

  test("sem as props novas: o modal recebe o destino de sempre (/studio/pedidos) e a rota de volta é a do Studio", async () => {
    const arvore = await montar(<ListaDeOrcamentos abrirId="q1" />);
    const modal = achar(arvore, "modal-do-orcamento")[0].props.dados;
    expect(modal.rotaDoPedido).toBeUndefined();
    expect(FONTE_MODAL).toContain("rotaDoPedido ? rotaDoPedido(quote.order_id) : `/studio/pedidos/${quote.order_id}`");
    await act(async () => { modal.onClose(); });
    expect(mockReplace).toHaveBeenCalledWith("/studio/gestao/orcamentos");
    arvore.unmount();
  });

  test("Aprovar é a mesma chamada do Studio (POST /studio/quotes/:qid/aprovar), sem rota nova", () => {
    expect(FONTE_MODAL).toContain("await studioApi.aprovarOrcamento(cid, quote!.id);");
    // A rota não chama o backend por conta própria: tudo passa pelo modal do Studio.
    expect(FONTE_ROTA).not.toMatch(/aprovarOrcamento\(|convertQuote\(|studioApi/);
  });
});
