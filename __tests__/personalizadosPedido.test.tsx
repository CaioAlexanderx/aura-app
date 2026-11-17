// ============================================================
// Personalizados › Detalhe do pedido e folha "Recolher a arte e o texto"
// no shell Negócio (p-176, 17/11/2026).
//
// O que este teste segura:
//   1. a trava PERSONALIZADOS_LIBERADO desligada (como está no código):
//      ninguém chega ao detalhe do Negócio;
//   2. ligada: a rota /personalizados/pedido/[id] abre o detalhe do Studio
//      com a trilha da Produção, refaz /auth/me, pede "escolha uma loja" no
//      consolidado e some sem plano ou permissão;
//   3. a folha: lê o GET, desenha os campos com o editor do Studio, salva
//      com avancar:true (ou guarda com avancar:false), sobe a arte pelo
//      upload-mockup e, no 422, mostra quais peças faltam;
//   4. a Fila: o cartão com o item e a origem, "Recolher a arte e o texto",
//      abrir o pedido, e a vista "Entregues e cancelados";
//   5. o /studio igual: a rota do Studio monta o mesmo detalhe sem props,
//      com a trilha, o sobretítulo e a ficha de sempre.
//
// Padrão de render da casa: react-test-renderer, identidade por testID e
// findAllByProps com { deep: false }.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockGetOrder = jest.fn();
const mockListOrders = jest.fn();
const mockUpdateStatus = jest.fn();
const mockGetPers = jest.fn();
const mockSalvarPers = jest.fn();
const mockUpload = jest.fn();
const mockPick = jest.fn();
const mockPush = jest.fn();
const mockParams: { id: string } = { id: "o1" };
const mockLargura = { valor: 1280 };
const mockAuth: { estado: any } = { estado: {} };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };
const mockRefreshMe = jest.fn(() => Promise.resolve());

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/utils/webAlert", () => ({ confirmAlert: jest.fn(), notify: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="redirect" accessibilityLabel={String(href)} />;
  },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  usePathname: () => "/personalizados/pedido/o1",
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
    useWindowDimensions: () => ({ width: mockLargura.valor, height: 800, scale: 1, fontScale: 1 }),
  };
});
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => {
    const { View } = jest.requireActual("react-native");
    return active ? <View testID="web-portal">{children}</View> : null;
  },
}));
// A folha abre pelo ResponsiveSheet; aqui ele só passa adiante e marca que
// passou por ele.
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => {
    const { View } = jest.requireActual("react-native");
    return visible ? <View testID="responsive-sheet">{children}</View> : null;
  },
}));
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    getOrder: (...a: any[]) => mockGetOrder(...a),
    listOrders: (...a: any[]) => mockListOrders(...a),
    updateProductionStatus: (...a: any[]) => mockUpdateStatus(...a),
    listOrderPayments: () => Promise.resolve({ payments: [] }),
    getCustomizationConfig: () => Promise.resolve({ config: null }),
    getPersonalizacaoDoPedido: (...a: any[]) => mockGetPers(...a),
    salvarPersonalizacaoDoPedido: (...a: any[]) => mockSalvarPers(...a),
  },
}));
jest.mock("@/services/studioUploadApi", () => ({
  pickImageBase64: (...a: any[]) => mockPick(...a),
  uploadStudioMockup: (...a: any[]) => mockUpload(...a),
}));
jest.mock("@/components/studio/ApprovalRequestModal", () => ({ ApprovalRequestModal: () => null }));
jest.mock("@/components/studio/RegistrarPagamentoSheet", () => ({ RegistrarPagamentoSheet: () => null }));
jest.mock("@/components/studio/PersonalizationPreview", () => ({ PersonalizationPreview: () => null }));
jest.mock("@/components/studio/BlocoPagamentoDoPedido", () => ({ BlocoPagamentoDoPedido: () => null }));
jest.mock("@/components/studio/useCobrarSaldo", () => ({ useCobrarSaldo: () => ({ cobrar: jest.fn(), cobrandoId: null }) }));
jest.mock("@/components/studio/useRegistrarPagamento", () => ({
  useRegistrarPagamento: () => ({ abrir: jest.fn(), fechar: jest.fn(), confirmar: jest.fn(), alvo: null, salvando: false, registrandoId: null }),
}));
// Casca do Studio: StudioScreen anima com reanimated; aqui só passa adiante.
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
jest.mock("@/components/studio/StudioEmpty", () => ({
  StudioEmpty: ({ title }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="studio-vazio" accessibilityLabel={title} />;
  },
}));
jest.mock("@/components/studio/StudioBreadcrumb", () => ({
  StudioBreadcrumb: ({ items }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="trilha" accessibilityLabel={JSON.stringify(items)} />;
  },
}));
jest.mock("@/components/studio/StudioPageHeader", () => ({
  StudioPageHeader: ({ eyebrow, title }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="cabecalho-do-pedido" accessibilityLabel={`${eyebrow}|${title}`} />;
  },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth.estado) : mockAuth.estado),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: mockPdv.isLoading }) }));
const mockTrava = { liberado: true };
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  return { ...real, personalizadosAtivo: (s: any, v: any) => real.personalizadosAtivo(s, v, mockTrava.liberado) };
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

import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { MODS_PERSONALIZADOS } from "@/utils/personalizados";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { FolhaDeRecolher } from "@/components/personalizados/FolhaDeRecolher";
import { QuadroDeProducao } from "@/components/personalizados/QuadroDeProducao";
import {
  corpoDoSalvar, faltamDoErro, fraseDoQueFalta, pecaPreenchida, pecasQueFaltam, valoresIniciais, camposDaPeca,
} from "@/components/personalizados/regrasDaFolha";
import { itemDoCartao, origemDoPedido, saidosDaFila } from "@/components/personalizados/regrasDaProducao";
import TelaPedido from "@/app/(tabs)/personalizados/pedido/[id]";
import TelaDoStudio from "@/app/studio/(estudio)/pedidos/[id]";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");
const FONTE_ROTA = ler("app/(tabs)/personalizados/pedido/[id].tsx");
const FONTE_FOLHA = ler("components/personalizados/FolhaDeRecolher.tsx");

const achar = (a: renderer.ReactTestRenderer, id: string) => a.root.findAllByProps({ testID: id }, { deep: false });
const tem = (a: renderer.ReactTestRenderer, id: string) => achar(a, id).length > 0;
const texto = (a: renderer.ReactTestRenderer) => JSON.stringify(a.toJSON());
const esperar = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

const CAMPO_NOME = { id: "nome", type: "text", label: "Nome na caneca", required: true, config: { max_chars: 20 } };
const CAMPO_ARTE = { id: "arte", type: "image", label: "Arte do cliente", required: false, config: {} };
const CONFIG = { print_area: { width_cm: 8, height_cm: 8 }, fields: [CAMPO_NOME, CAMPO_ARTE] };

const item = (id: string, extra: Record<string, any> = {}): any => ({
  id, product_id: `p-${id}`, product_name: "Caneca com nome", quantity: 1, is_personalizable: true,
  customization_config: CONFIG, customization: null, tem_personalizacao: false, ...extra,
});

const DADOS = {
  order: { id: "o1", source: "pdv", studio_production_status: "awaiting_customization", customer_name: "Marina", display_name: "PDV-1" },
  itens: [
    item("i1"),
    item("i2", { product_name: "Camiseta lisa", quantity: 2 }),
    item("i3", { product_name: "Sacola", is_personalizable: false, customization_config: null }),
  ],
  faltam: ["i1", "i2"],
};

const detalhe = (status: string, extra: Record<string, any> = {}): any => ({
  order: {
    id: "o1", created_at: "2026-11-15T12:00:00.000Z", total_amount: 96, status: "confirmed",
    studio_production_status: status, customer_name: "Marina", customer_phone: null, display_name: "PDV-1",
    source: "pdv", ...extra,
  },
  items: [{ id: "i1", product_id: "p1", product_name: "Caneca com nome", quantity: 1, unit_price: 96, customization: null }],
  approvals: [],
});

const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };

function estadoPadrao() {
  jest.clearAllMocks();
  mockLargura.valor = 1280;
  mockParams.id = "o1";
  mockAuth.estado = { company: LOJA, consolidatedView: false, user: { id: "u1" }, refreshMe: mockRefreshMe, switchCompany: jest.fn() };
  mockVisiveis.set = new Set(["personalizados.pedido", "personalizados.producao"]);
  mockVisiveis.prontos = true;
  mockPdv.settings = { studio_enabled: true };
  mockPdv.isLoading = false;
  mockTrava.liberado = true;
  mockGetOrder.mockResolvedValue(detalhe("awaiting_customization"));
  mockGetPers.mockResolvedValue(DADOS);
  mockSalvarPers.mockResolvedValue({ ok: true, order_id: "o1", source: "pdv", studio_production_status: "pending_art", avancou: true, itens: [], faltam: [] });
  mockListOrders.mockResolvedValue({ orders: [] });
  mockUpdateStatus.mockResolvedValue({});
}

// ── 1. Trava ──────────────────────────────────────────────────────────────
describe("trava PERSONALIZADOS_LIBERADO desligada: nada muda", () => {
  beforeEach(estadoPadrao);

  test("no código a trava está desligada", () => {
    expect(jest.requireActual("@/utils/personalizados").PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("com a trava como está no código, a rota manda para o Painel e não lê o pedido", async () => {
    mockTrava.liberado = false;
    let a!: renderer.ReactTestRenderer;
    await act(async () => { a = renderer.create(<TelaPedido />); });
    await esperar();
    expect(achar(a, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(tem(a, "personalizados-pedido")).toBe(false);
    expect(mockGetOrder).not.toHaveBeenCalled();
    a.unmount();
  });
});

// ── 2. A rota ─────────────────────────────────────────────────────────────
describe("a rota /personalizados/pedido/[id]", () => {
  beforeEach(estadoPadrao);

  async function montar() {
    let a!: renderer.ReactTestRenderer;
    await act(async () => { a = renderer.create(<TelaPedido />); });
    await esperar();
    return a;
  }

  test("mod próprio, já nos mapas (sem chave nova)", () => {
    expect(FONTE_ROTA).toContain('const MOD_DA_TELA = "personalizados.pedido";');
    expect(MODULE_PLAN_MAP["personalizados.pedido"]).toBe("negocio");
    expect(PERM_TO_MODULES["personalizados.access"]).toContain("personalizados.pedido");
    expect(MODS_PERSONALIZADOS).toContain("personalizados.pedido");
  });

  test("trava ligada: abre o detalhe do Studio com a trilha da Produção e refaz /auth/me", async () => {
    const a = await montar();
    expect(tem(a, "personalizados-pedido")).toBe(true);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(mockGetOrder).toHaveBeenCalledWith("loja-1", "o1");
    const trilha = JSON.parse(achar(a, "trilha")[0].props.accessibilityLabel);
    expect(trilha[1]).toEqual({ label: "Produção", href: "/personalizados/producao" });
    expect(trilha.some((i: any) => String(i.href || "").startsWith("/studio"))).toBe(false);
    expect(achar(a, "cabecalho-do-pedido")[0].props.accessibilityLabel.startsWith("PERSONALIZADOS|")).toBe(true);
    // A ficha de produção é do shell /studio: fica fora do Negócio.
    expect(tem(a, "btn-ficha-de-producao")).toBe(false);
    a.unmount();
  });

  test("Aguardando personalização: o detalhe tem Recolher a arte e o texto, que abre a folha", async () => {
    const a = await montar();
    expect(tem(a, "btn-recolher-arte")).toBe(true);
    expect(tem(a, "folha-recolher")).toBe(false);
    await act(async () => { achar(a, "btn-recolher-arte")[0].props.onPress(); });
    await esperar();
    expect(tem(a, "folha-recolher")).toBe(true);
    expect(mockGetPers).toHaveBeenCalledWith("loja-1", "o1");
    a.unmount();
  });

  test("em outra etapa o botão da folha não aparece", async () => {
    mockGetOrder.mockResolvedValue(detalhe("pending_art"));
    const a = await montar();
    expect(tem(a, "btn-recolher-arte")).toBe(false);
    a.unmount();
  });

  test("consolidado multi-CNPJ: pede para escolher uma loja e não lê o pedido", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true, company: null };
    const a = await montar();
    expect(texto(a)).toContain("Escolha uma loja");
    expect(tem(a, "personalizados-pedido")).toBe(false);
    expect(mockGetOrder).not.toHaveBeenCalled();
    a.unmount();
  });

  test("Essencial ou membro sem permissão: a tela some (volta ao Painel), sem cadeado", async () => {
    mockVisiveis.set = new Set(["painel", "pdv"]);
    const a = await montar();
    expect(achar(a, "redirect")[0].props.accessibilityLabel).toBe("/");
    expect(mockGetOrder).not.toHaveBeenCalled();
    const semComentario = FONTE_ROTA.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
    expect(semComentario).not.toMatch(/upgrade|cadeado|"lock"|Assine|\/planos/i);
    a.unmount();
  });

  test("frente desligada (sem studio_enabled ou com vertical_active): volta ao Painel", async () => {
    mockPdv.settings = {};
    let a = await montar();
    expect(tem(a, "redirect")).toBe(true);
    a.unmount();
    mockPdv.settings = { studio_enabled: true };
    mockAuth.estado = { ...mockAuth.estado, company: { ...LOJA, vertical_active: "studio" } };
    a = await montar();
    expect(tem(a, "redirect")).toBe(true);
    a.unmount();
  });
});

// ── 3. A folha ────────────────────────────────────────────────────────────
describe("regras da folha", () => {
  test("só as peças personalizáveis entram, abertas com o que já foi gravado", () => {
    const v = valoresIniciais([...DADOS.itens, item("i4", { customization: { nome: "Ana" } })]);
    expect(Object.keys(v)).toEqual(["i1", "i2", "i4"]);
    expect(v.i4).toEqual({ nome: "Ana" });
  });

  test("peça sem campos cadastrados ganha um campo de texto para não prender a lojista", () => {
    expect(camposDaPeca(item("x", { customization_config: null })).map((c) => c.id)).toEqual(["texto"]);
    expect(camposDaPeca(item("y")).map((c) => c.id)).toEqual(["nome", "arte"]);
  });

  test("preenchida: um campo do produto com valor, a mesma conta do backend", () => {
    expect(pecaPreenchida(item("a"), { nome: "Ana" })).toBe(true);
    expect(pecaPreenchida(item("a"), { nome: "   " })).toBe(false);
    expect(pecaPreenchida(item("a"), { outro: "x" })).toBe(false);
    expect(pecaPreenchida(item("a", { customization_config: null }), { qualquer: "x" })).toBe(true);
    expect(pecasQueFaltam(DADOS.itens, { i1: { nome: "Ana" }, i2: {} })).toEqual(["i2"]);
  });

  test("o corpo leva só as peças personalizáveis e tira campo vazio", () => {
    expect(corpoDoSalvar(DADOS.itens, { i1: { nome: "Ana", arte: "" }, i2: { nome: null } }, true)).toEqual({
      itens: [{ id: "i1", customization: { nome: "Ana" } }, { id: "i2", customization: {} }],
      avancar: true,
    });
  });

  test("o 422 vira a lista do que falta; outro erro não", () => {
    expect(faltamDoErro({ status: 422, data: { code: "FALTA_PERSONALIZACAO", faltam: ["i2"] } })).toEqual(["i2"]);
    expect(faltamDoErro({ status: 400, data: { code: "ITENS_OBRIGATORIOS" } })).toBeNull();
    expect(fraseDoQueFalta(DADOS.itens, ["i1", "i2"])).toBe("Falta a arte ou o texto de 1 × Caneca com nome e 2 × Camiseta lisa.");
  });

  test("os campos são os do editor do Studio, sem cópia", () => {
    expect(FONTE_FOLHA).toContain('from "@/components/studio/CollectCustomizationModal"');
    expect(FONTE_FOLHA).toContain("<CollectFieldEditor");
    expect(FONTE_FOLHA).not.toMatch(/type === "text"|type === "color"|type === "option"/);
    expect(FONTE_FOLHA).toContain("uploadStudioMockup");
    // Overlay pelo ResponsiveSheet; nada de position fixed.
    expect(FONTE_FOLHA).toContain("<ResponsiveSheet");
    expect(FONTE_FOLHA).not.toMatch(/position:\s*"fixed"/);
  });
});

describe("a folha Recolher a arte e o texto", () => {
  beforeEach(estadoPadrao);

  async function montarFolha(onSalvo = jest.fn(), onFechar = jest.fn()) {
    let a!: renderer.ReactTestRenderer;
    await act(async () => {
      a = renderer.create(
        <TemaDoNegocio>
          <FolhaDeRecolher companyId="loja-1" pedidoId="o1" onFechar={onFechar} onSalvo={onSalvo} />
        </TemaDoNegocio>,
      );
    });
    await esperar();
    return a;
  }

  const digitar = async (a: renderer.ReactTestRenderer, itemId: string, valor: string) => {
    const peca = achar(a, `folha-peca-${itemId}`)[0];
    const campo = peca.findAll((n) => typeof n.props?.onChangeText === "function" && n.props?.maxLength === 20)[0];
    await act(async () => { campo.props.onChangeText(valor); });
  };

  test("abre pelo ResponsiveSheet, lê as peças da loja e mostra só as personalizáveis", async () => {
    const a = await montarFolha();
    expect(tem(a, "responsive-sheet")).toBe(true);
    expect(mockGetPers).toHaveBeenCalledWith("loja-1", "o1");
    expect(tem(a, "folha-peca-i1")).toBe(true);
    expect(tem(a, "folha-peca-i2")).toBe(true);
    expect(tem(a, "folha-peca-i3")).toBe(false);
    expect(texto(a)).toContain("Pedido de Marina");
    expect(texto(a)).toContain("Salvar e enviar para a arte");
    a.unmount();
  });

  test("salva com avancar:true, avisa quem abriu e fecha", async () => {
    const onSalvo = jest.fn();
    const onFechar = jest.fn();
    const a = await montarFolha(onSalvo, onFechar);
    await digitar(a, "i1", "Ana");
    await digitar(a, "i2", "Time Alfa");
    await act(async () => { achar(a, "folha-salvar")[0].props.onPress(); });
    await esperar();
    expect(mockSalvarPers).toHaveBeenCalledWith("loja-1", "o1", {
      itens: [{ id: "i1", customization: { nome: "Ana" } }, { id: "i2", customization: { nome: "Time Alfa" } }],
      avancar: true,
    });
    expect(onSalvo).toHaveBeenCalledWith(expect.objectContaining({ avancou: true }));
    expect(onFechar).toHaveBeenCalled();
    a.unmount();
  });

  test("Guardar sem enviar manda avancar:false", async () => {
    const a = await montarFolha();
    await digitar(a, "i1", "Ana");
    await act(async () => { achar(a, "folha-guardar")[0].props.onPress(); });
    await esperar();
    expect(mockSalvarPers.mock.calls[0][2].avancar).toBe(false);
    a.unmount();
  });

  test("o 422 mostra quais peças faltam e não fecha", async () => {
    mockSalvarPers.mockRejectedValueOnce({ status: 422, data: { code: "FALTA_PERSONALIZACAO", faltam: ["i2"], error: "Falta" } });
    const onSalvo = jest.fn();
    const onFechar = jest.fn();
    const a = await montarFolha(onSalvo, onFechar);
    await digitar(a, "i1", "Ana");
    await act(async () => { achar(a, "folha-salvar")[0].props.onPress(); });
    await esperar();
    expect(tem(a, "folha-aviso-falta")).toBe(true);
    expect(texto(a)).toContain("Falta a arte ou o texto de 2 × Camiseta lisa.");
    expect(tem(a, "folha-falta-i2")).toBe(true);
    expect(tem(a, "folha-falta-i1")).toBe(false);
    expect(onSalvo).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
    a.unmount();
  });

  test("a arte sobe pelo upload-mockup e o campo guarda a URL", async () => {
    mockPick.mockResolvedValue({ base64: "QUJD", content_type: "image/png" });
    mockUpload.mockResolvedValue({ ok: true, url: "https://r2/arte.png", key: "k", size_mb: 0.1, content_type: "image/png" });
    const a = await montarFolha();
    const peca = achar(a, "folha-peca-i1")[0];
    const editorDaArte = peca.findAll((n) => n.props?.field?.id === "arte" && typeof n.props?.onUpload === "function")[0];
    await act(async () => { await editorDaArte.props.onUpload(); });
    await esperar();
    expect(mockUpload).toHaveBeenCalledWith("loja-1", { content_base64: "QUJD", content_type: "image/png", kind: "customization" });
    await digitar(a, "i2", "Time");
    await act(async () => { achar(a, "folha-salvar")[0].props.onPress(); });
    await esperar();
    expect(mockSalvarPers.mock.calls[0][2].itens[0]).toEqual({ id: "i1", customization: { arte: "https://r2/arte.png" } });
    a.unmount();
  });

  test("pedido de marketplace: a folha diz que é por outra tela", async () => {
    mockGetPers.mockRejectedValueOnce({ status: 409, data: { code: "MARKETPLACE_USA_OUTRA_ROTA" } });
    const a = await montarFolha();
    expect(tem(a, "folha-erro-ao-abrir")).toBe(true);
    expect(texto(a)).toContain("marketplace");
    expect(achar(a, "folha-salvar")[0].props.disabled).toBe(true);
    a.unmount();
  });

  test("pedido que já andou: salvar corrige a arte, sem o Guardar sem enviar", async () => {
    mockGetPers.mockResolvedValueOnce({ ...DADOS, order: { ...DADOS.order, studio_production_status: "pending_art" } });
    const a = await montarFolha();
    expect(tem(a, "folha-guardar")).toBe(false);
    expect(texto(a)).toContain("Salvar a arte e o texto");
    a.unmount();
  });
});

// ── 4. A Fila ─────────────────────────────────────────────────────────────
const pedido = (id: string, extra: Record<string, any> = {}): any => ({
  id, created_at: "2026-11-10T12:00:00.000Z", total_amount: 96, status: "confirmed",
  studio_production_status: "awaiting_customization", customer_name: `Cliente ${id}`, customer_phone: null,
  display_name: `PDV-${id}`, item_count: 1, pending_approval_url: null, approval_count: 0, source: "pdv",
  ...extra,
});

describe("a Fila com o item, a origem e a folha", () => {
  beforeEach(estadoPadrao);

  test("o item do cartão: quantidade, nome e o resto do pedido; sem nome, a contagem", () => {
    expect(itemDoCartao({ item_name: "Caneca com nome", item_quantity: 2, item_count: 1 })).toBe("2 × Caneca com nome");
    expect(itemDoCartao({ item_name: "Camiseta", item_quantity: 4, item_count: 3 })).toBe("4 × Camiseta + 2 itens");
    expect(itemDoCartao({ item_name: "Sacola", item_quantity: null, item_count: 1 })).toBe("Sacola");
    expect(itemDoCartao({ item_name: null, item_quantity: null, item_count: 2 })).toBe("2 itens");
  });

  test("a origem vem do origin_label; sem ele, a conta de antes", () => {
    expect(origemDoPedido({ source: "digital", origin_label: "Orçamento" })).toBe("Orçamento");
    expect(origemDoPedido({ source: "digital", origin_label: null })).toBe("Loja online");
    expect(origemDoPedido({ source: "pdv" })).toBe("Caixa");
  });

  test("entregues e cancelados, do mais novo para o mais antigo", () => {
    const s = saidosDaFila([
      pedido("d1", { studio_production_status: "delivered", created_at: "2026-11-01T00:00:00Z" }),
      pedido("d2", { studio_production_status: "delivered", created_at: "2026-11-09T00:00:00Z" }),
      pedido("c1", { studio_production_status: "cancelled" }),
      pedido("a1"),
    ]);
    expect(s.delivered.map((o) => o.id)).toEqual(["d2", "d1"]);
    expect(s.cancelled.map((o) => o.id)).toEqual(["c1"]);
  });

  async function montarQuadro(pedidos: any[], onAbrirPedido?: (id: string) => void) {
    mockListOrders.mockResolvedValue({ orders: pedidos });
    let a!: renderer.ReactTestRenderer;
    await act(async () => {
      a = renderer.create(
        <TemaDoNegocio>
          <QuadroDeProducao companyId="loja-1" ativadoEm={null} onAbrirPedido={onAbrirPedido} />
        </TemaDoNegocio>,
      );
    });
    await esperar();
    return a;
  }

  test("cartão de Aguardando personalização: item, origem e Recolher a arte e o texto", async () => {
    const a = await montarQuadro([pedido("a1", { item_name: "Caneca com nome", item_quantity: 1, origin_label: "Orçamento", source: "digital" })]);
    expect(tem(a, "producao-item-a1")).toBe(true);
    expect(texto(a)).toContain("1 × Caneca com nome");
    expect(texto(a)).toContain("Orçamento");
    expect(tem(a, "producao-recolher-a1")).toBe(true);
    // "Enviar para a arte" continua, mais discreto.
    expect(tem(a, "producao-avancar-a1")).toBe(true);
    expect(tem(a, "folha-recolher")).toBe(false);
    await act(async () => { achar(a, "producao-recolher-a1")[0].props.onPress(); });
    await esperar();
    expect(tem(a, "folha-recolher")).toBe(true);
    expect(mockGetPers).toHaveBeenCalledWith("loja-1", "a1");
    a.unmount();
  });

  test("salvar na folha recarrega a Fila", async () => {
    const a = await montarQuadro([pedido("a1")]);
    mockGetPers.mockResolvedValueOnce({ ...DADOS, itens: [item("i1", { customization: { nome: "Ana" } })] });
    await act(async () => { achar(a, "producao-recolher-a1")[0].props.onPress(); });
    await esperar();
    const chamadasAntes = mockListOrders.mock.calls.length;
    await act(async () => { achar(a, "folha-salvar")[0].props.onPress(); });
    await esperar();
    expect(mockSalvarPers).toHaveBeenCalled();
    expect(mockListOrders.mock.calls.length).toBe(chamadasAntes + 1);
    expect(tem(a, "folha-recolher")).toBe(false);
    a.unmount();
  });

  test("o número e o nome do cartão abrem o detalhe; sem destino, o cartão não abre nada", async () => {
    const abrir = jest.fn();
    let a = await montarQuadro([pedido("a1", { studio_production_status: "in_production" })], abrir);
    await act(async () => { achar(a, "producao-abrir-a1")[0].props.onPress(); });
    expect(abrir).toHaveBeenCalledWith("a1");
    a.unmount();
    a = await montarQuadro([pedido("a1", { studio_production_status: "in_production" })]);
    expect(tem(a, "producao-abrir-a1")).toBe(false);
    a.unmount();
  });

  test("Entregues e cancelados: a vista mostra o que saiu da Fila e abre o pedido", async () => {
    const abrir = jest.fn();
    const a = await montarQuadro([
      pedido("a1"),
      pedido("d1", { studio_production_status: "delivered" }),
      pedido("c1", { studio_production_status: "cancelled" }),
    ], abrir);
    expect(tem(a, "producao-cartao-d1")).toBe(false);
    expect(achar(a, "producao-vista-fila")[0].props.accessibilityState).toEqual({ selected: true });
    await act(async () => { achar(a, "producao-vista-saidos")[0].props.onPress(); });
    expect(tem(a, "producao-saidos")).toBe(true);
    expect(tem(a, "producao-colunas")).toBe(false);
    expect(tem(a, "producao-saido-d1")).toBe(true);
    expect(tem(a, "producao-saido-c1")).toBe(false);
    await act(async () => { achar(a, "producao-saida-cancelled")[0].props.onPress(); });
    expect(tem(a, "producao-saido-c1")).toBe(true);
    expect(texto(a)).toContain("Cancelado");
    await act(async () => { achar(a, "producao-abrir-c1")[0].props.onPress(); });
    expect(abrir).toHaveBeenCalledWith("c1");
    // Voltar para a Fila.
    await act(async () => { achar(a, "producao-vista-fila")[0].props.onPress(); });
    expect(tem(a, "producao-colunas")).toBe(true);
    a.unmount();
  });

  test("a vista dos entregues sem pedido: recado de vazio", async () => {
    const a = await montarQuadro([pedido("a1")]);
    await act(async () => { achar(a, "producao-vista-saidos")[0].props.onPress(); });
    expect(tem(a, "producao-saidos-vazio")).toBe(true);
    a.unmount();
  });
});

// ── 5. /studio igual ──────────────────────────────────────────────────────
describe("o /studio continua igual", () => {
  beforeEach(estadoPadrao);

  async function montarStudio() {
    let a!: renderer.ReactTestRenderer;
    await act(async () => { a = renderer.create(<TelaDoStudio />); });
    await esperar();
    return a;
  }

  test("a rota do Studio monta o detalhe sem props: trilha, sobretítulo e ficha de sempre", async () => {
    mockGetOrder.mockResolvedValue(detalhe("pending_art"));
    const a = await montarStudio();
    const trilha = JSON.parse(achar(a, "trilha")[0].props.accessibilityLabel);
    expect(trilha.slice(0, 2)).toEqual([
      { label: "Estúdio", href: "/studio" },
      { label: "Pedidos", href: "/studio/pedidos" },
    ]);
    expect(trilha).toHaveLength(3);
    expect(trilha[2].href).toBeUndefined();
    expect(achar(a, "cabecalho-do-pedido")[0].props.accessibilityLabel.startsWith("PEDIDOS|")).toBe(true);
    expect(tem(a, "btn-ficha-de-producao")).toBe(true);
    await act(async () => { achar(a, "btn-ficha-de-producao")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/studio/pedidos/ficha/o1");
    a.unmount();
  });

  test("no /studio não entra o botão da folha do Negócio, nem em Aguardando personalização", async () => {
    mockGetOrder.mockResolvedValue(detalhe("awaiting_customization"));
    const a = await montarStudio();
    expect(tem(a, "btn-recolher-arte")).toBe(false);
    a.unmount();
  });

  test("a rota do Studio só passa adiante; o editor do marketplace segue com o seu export", () => {
    const rota = ler("app/studio/(estudio)/pedidos/[id].tsx");
    expect(rota).toContain("<DetalheDoPedido />");
    const modal = jest.requireActual("@/components/studio/CollectCustomizationModal");
    expect(typeof modal.default).toBe("function");
    expect(typeof modal.CollectCustomizationModal).toBe("function");
  });
});
