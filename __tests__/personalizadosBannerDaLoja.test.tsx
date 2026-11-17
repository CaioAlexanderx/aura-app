// ============================================================
// Personalizados › banner da loja no Meu Site › Design (p-193, 17/11/2026).
//
// O que este teste segura:
//   1. com a trava PERSONALIZADOS_LIBERADO em false (como está no código), a
//      aba Design não ganha nada: nenhuma seção, nenhuma ida ao servidor,
//      nem a leitura das configurações do Caixa;
//   2. com a trava ligada: a seção aparece na aba Design da loja comum,
//      refaz /auth/me, carrega pelo GET e salva pelo PUT da rota própria
//      (backend#1055), com campo vazio = texto do modelo;
//   3. sem peça personalizável: o aviso, sem o liga/desliga;
//   4. consolidado multi-CNPJ: "Escolha uma loja", sem ida ao servidor;
//   5. some no Essencial, sem a frente, no shell /studio e na Loja Digital
//      do Studio (vitrine="studio");
//   6. a capa é a foto da peça (nunca mockup nem render de pedido).
//
// Mocks iguais aos de __tests__/personalizadosOrcamentos.test.tsx.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockRequest = jest.fn();
const mockAuth: { estado: any } = { estado: {} };
const mockVisiveis = { set: new Set<string>(), prontos: true };
const mockPdv: { settings: any; isLoading: boolean } = { settings: {}, isLoading: false };
const mockUsePdv = jest.fn();
const mockRefreshMe = jest.fn(() => Promise.resolve());
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
// Getter: o factory roda antes de mockToast existir (jest.mock sobe no arquivo).
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/canal",
  useLocalSearchParams: () => ({}),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth.estado) : mockAuth.estado),
}));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: (...a: any[]) => { mockUsePdv(...a); return { settings: mockPdv.settings, isLoading: mockPdv.isLoading }; },
}));
// A trava geral fica desligada no código (Caio, 16/11). Aqui ela é ligada de
// propósito; o bloco "trava desligada" prova que, como está no código, nada
// muda.
const mockTrava = { liberado: true };
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  const modulo = {
    ...real,
    personalizadosAtivo: (s: any, v: any) => real.personalizadosAtivo(s, v, mockTrava.liberado),
  };
  // Lida na hora do uso (a seção confere a trava antes de qualquer hook).
  Object.defineProperty(modulo, "PERSONALIZADOS_LIBERADO", { get: () => mockTrava.liberado, enumerable: true });
  return modulo;
});
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a), BASE_URL: "https://api.teste" }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) }));
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => mockVisiveis.set,
  useVisibleModulesProntos: () => mockVisiveis.prontos,
}));
jest.mock("@/components/CompanyPickerModal", () => ({
  CompanyPickerModal: () => null,
  getRememberedCompanyId: () => null,
}));
// A prévia ao vivo da aba (iframe da loja) e a mini-loja não importam aqui.
jest.mock("@/components/screens/canal/MiniLoja", () => ({ MiniLoja: () => null }));
jest.mock("@/components/screens/canal/PreviewCartao", () => ({ PreviewCartao: () => null }));
jest.mock("@/components/screens/canal/PreviewTipografia", () => ({ PreviewTipografia: () => null }));

import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { MODULOS_OCULTOS } from "@/constants/modulosOcultos";
import { TabDesign } from "@/components/screens/canal/TabDesign";
import { SecaoBannerPersonalizados } from "@/components/screens/canal/SecaoBannerPersonalizados";
import {
  MOD_DO_BANNER, PADRAO_DO_BANNER, corpoDoPut, bannerDaResposta, capaDoBanner, textoSobre,
} from "@/components/personalizados/regrasDoBanner";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");
const FONTE_SECAO = ler("components/screens/canal/SecaoBannerPersonalizados.tsx");
const FONTE_REGRAS = ler("components/personalizados/regrasDoBanner.ts");

const LOJA = { id: "loja-1", plan: "negocio", vertical_active: null };
const ROTA = "/companies/loja-1/digital-channel/banner-personalizados";
const CANECA = { id: "11111111-1111-4111-8111-111111111111", name: "Caneca personalizada", image_url: "https://cdn.teste/caneca.jpg" };
const CAMISETA = { id: "22222222-2222-4222-8222-222222222222", name: "Camiseta personalizada", image_url: null };

function respostaDoGet(extra: Record<string, any> = {}) {
  return {
    banner: null,
    padrao: { ...PADRAO_DO_BANNER },
    limites: { kicker: 40, titulo: 80, texto: 240, botao: 40, botao_3d: 40, imagem_url: 500 },
    pecas: [CANECA, CAMISETA],
    ...extra,
  };
}

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
const textoDe = (arvore: renderer.ReactTestRenderer) => JSON.stringify(arvore.toJSON());
// O campo de texto: o nó com testID que recebe onChangeText (no web o
// TextInput também vira um <input> com o mesmo testID).
function campo(arvore: renderer.ReactTestRenderer, id: string): any {
  return arvore.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onChangeText === "function")[0];
}
// O texto só da prévia.
function textoDaPrevia(arvore: renderer.ReactTestRenderer): string {
  const no = achar(arvore, "banner-pz-previa")[0];
  if (!no) return "";
  return no.findAll((n: any) => typeof n.props?.children === "string").map((n: any) => n.props.children).join(" | ");
}

const CONFIG = { exists: true, primary_color: "#1a1612", slug: "", banners: [] };
const montarAba = (vitrine?: "comum" | "studio") => montar(
  <TabDesign
    config={CONFIG as any}
    saveConfig={jest.fn(() => Promise.resolve({}))}
    isSaving={false}
    uploadImage={jest.fn()}
    isUploadingImage={false}
    deleteImage={jest.fn()}
    vitrine={vitrine}
  />,
);
const montarSecao = () => montar(<SecaoBannerPersonalizados corDaLoja="#1a1612" />);

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest.mockImplementation((rota: string, opts?: any) => {
    if (opts?.method === "PUT") return Promise.resolve({ banner: opts.body });
    return Promise.resolve(respostaDoGet());
  });
  mockAuth.estado = {
    company: LOJA, consolidatedView: false, user: { id: "u1" }, refreshMe: mockRefreshMe,
    switchCompany: jest.fn(), availableCompanies: [], loadCompanies: jest.fn(() => Promise.resolve()), companyLogo: null,
  };
  mockVisiveis.set = new Set(["personalizados.loja"]);
  mockVisiveis.prontos = true;
  mockPdv.settings = { studio_enabled: true };
  mockPdv.isLoading = false;
  mockTrava.liberado = true;
});

describe("trava PERSONALIZADOS_LIBERADO desligada: nada muda", () => {
  test("a trava está em false no código", () => {
    expect(jest.requireActual("@/utils/personalizados").PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("a aba Design fica idêntica: sem seção, sem ida ao servidor, sem ler o Caixa", async () => {
    mockTrava.liberado = false;
    const desligada = await montarAba();
    expect(tem(desligada, "banner-personalizados")).toBe(false);
    expect(textoDe(desligada)).not.toContain("Banner de personalizados");
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockUsePdv).not.toHaveBeenCalled();
    expect(mockRefreshMe).not.toHaveBeenCalled();
    const jsonDesligada = textoDe(desligada);
    desligada.unmount();

    // A mesma aba com a trava ligada mas a seção fora (Essencial): o mesmo
    // desenho, byte a byte. A seção é o único ponto que muda.
    mockTrava.liberado = true;
    mockVisiveis.set = new Set(["painel"]);
    const fora = await montarAba();
    expect(textoDe(fora)).toBe(jsonDesligada);
    fora.unmount();
  });

  test("a seção sozinha devolve nada antes de qualquer hook", async () => {
    mockTrava.liberado = false;
    const arvore = await montarSecao();
    expect(arvore.toJSON()).toBeNull();
    expect(mockUsePdv).not.toHaveBeenCalled();
    arvore.unmount();
  });
});

describe("trava ligada: a seção na aba Design", () => {
  test("mod próprio já existente (personalizados.loja), no mapa de planos e de permissões, fora dos ocultos", () => {
    expect(MOD_DO_BANNER).toBe("personalizados.loja");
    expect(MODULE_PLAN_MAP["personalizados.loja"]).toBe("negocio");
    expect(PERM_TO_MODULES["personalizados.access"]).toContain("personalizados.loja");
    expect(MODULOS_OCULTOS.has("personalizados.loja")).toBe(false);
  });

  test("aparece na aba Design da loja comum, refaz /auth/me e carrega pelo GET", async () => {
    const arvore = await montarAba();
    expect(tem(arvore, "banner-personalizados")).toBe(true);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(ROTA);
    expect(tem(arvore, "banner-pz-ativo")).toBe(true);
    // Desligado: só o interruptor, sem o editor.
    expect(tem(arvore, "banner-pz-editor")).toBe(false);
    arvore.unmount();
  });

  test("liga, escolhe a peça, edita o título e salva pelo PUT (vazio = texto do modelo)", async () => {
    const arvore = await montarSecao();
    const salvar = () => achar(arvore, "banner-pz-salvar")[0];
    expect(salvar().props.disabled).toBe(true);

    await act(async () => { achar(arvore, "banner-pz-ativo")[0].props.onValueChange(true); });
    expect(tem(arvore, "banner-pz-editor")).toBe(true);
    expect(tem(arvore, "banner-pz-previa")).toBe(true);
    // A camiseta não tem foto: não serve de capa.
    expect(achar(arvore, "banner-pz-peca-" + CAMISETA.id)[0].props.disabled).toBe(true);
    await act(async () => { achar(arvore, "banner-pz-peca-" + CANECA.id)[0].props.onPress(); });
    await act(async () => { campo(arvore, "banner-pz-titulo").props.onChangeText("  Canecas com o seu nome  "); });
    expect(campo(arvore, "banner-pz-titulo").props.maxLength).toBe(80);
    expect(campo(arvore, "banner-pz-kicker").props.placeholder).toBe(PADRAO_DO_BANNER.kicker);

    // A prévia mostra o título dela e, no resto, o texto do modelo.
    const previa = textoDaPrevia(arvore);
    expect(previa).toContain("Canecas com o seu nome");
    expect(previa).toContain(PADRAO_DO_BANNER.botao);
    expect(previa).toContain("Você aprova a arte");
    expect(achar(arvore, "banner-pz-capa")[0].props.source).toEqual({ uri: CANECA.image_url });

    expect(salvar().props.disabled).toBe(false);
    await act(async () => { await salvar().props.onPress(); });
    const put = mockRequest.mock.calls.find((c) => c[1]?.method === "PUT");
    expect(put[0]).toBe(ROTA);
    expect(put[1].body).toEqual({
      ativo: true, produto_id: CANECA.id, imagem_url: null,
      kicker: "", titulo: "Canecas com o seu nome", texto: "", botao: "", botao_3d: "", mostrar_3d: true,
    });
    expect(mockToast.success).toHaveBeenCalledWith("Banner salvo");
    // Salvo: nada pendente.
    expect(salvar().props.disabled).toBe(true);
    arvore.unmount();
  });

  test("desligar o 3D tira o segundo botão da prévia e vai no PUT", async () => {
    mockRequest.mockImplementation((rota: string, opts?: any) => {
      if (opts?.method === "PUT") return Promise.resolve({ banner: opts.body });
      return Promise.resolve(respostaDoGet({ banner: { ativo: true, produto_id: CANECA.id, mostrar_3d: true } }));
    });
    const arvore = await montarSecao();
    expect(textoDaPrevia(arvore)).toContain(PADRAO_DO_BANNER.botao_3d);
    await act(async () => { achar(arvore, "banner-pz-mostrar-3d")[0].props.onValueChange(false); });
    expect(textoDaPrevia(arvore)).not.toContain(PADRAO_DO_BANNER.botao_3d);
    expect(textoDaPrevia(arvore)).toContain(PADRAO_DO_BANNER.botao);
    expect(tem(arvore, "banner-pz-botao_3d")).toBe(false);
    await act(async () => { await achar(arvore, "banner-pz-salvar")[0].props.onPress(); });
    const put = mockRequest.mock.calls.find((c) => c[1]?.method === "PUT");
    expect(put[1].body.mostrar_3d).toBe(false);
    arvore.unmount();
  });

  test("erro do PUT: avisa e mantém a edição para tentar de novo", async () => {
    mockRequest.mockImplementation((rota: string, opts?: any) => {
      if (opts?.method === "PUT") return Promise.reject(new Error("Escolha uma peça personalizável da sua loja."));
      return Promise.resolve(respostaDoGet());
    });
    const arvore = await montarSecao();
    await act(async () => { achar(arvore, "banner-pz-ativo")[0].props.onValueChange(true); });
    await act(async () => { await achar(arvore, "banner-pz-salvar")[0].props.onPress(); });
    expect(mockToast.error).toHaveBeenCalledWith("Escolha uma peça personalizável da sua loja.");
    expect(achar(arvore, "banner-pz-salvar")[0].props.disabled).toBe(false);
    arvore.unmount();
  });

  test("sem peça personalizável: o aviso, sem o liga/desliga", async () => {
    mockRequest.mockResolvedValue(respostaDoGet({ pecas: [] }));
    const arvore = await montarSecao();
    expect(tem(arvore, "banner-pz-sem-peca")).toBe(true);
    expect(textoDe(arvore)).toContain("Você ainda não tem peça personalizável.");
    expect(tem(arvore, "banner-pz-ativo")).toBe(false);
    expect(tem(arvore, "banner-pz-salvar")).toBe(false);
    arvore.unmount();
  });

  test("peças sem foto: avisa que o banner não aparece na loja", async () => {
    mockRequest.mockResolvedValue(respostaDoGet({ pecas: [CAMISETA], banner: { ativo: true } }));
    const arvore = await montarSecao();
    expect(tem(arvore, "banner-pz-sem-foto")).toBe(true);
    expect(tem(arvore, "banner-pz-capa")).toBe(false);
    arvore.unmount();
  });

  test("falha no GET: mensagem e Tentar de novo", async () => {
    mockRequest.mockRejectedValueOnce(new Error("rede")).mockResolvedValue(respostaDoGet());
    const arvore = await montarSecao();
    expect(tem(arvore, "banner-pz-erro")).toBe(true);
    const botao = arvore.root.findAll((n: any) => n.props && n.props.accessibilityRole === "button" && typeof n.props.onPress === "function", { deep: false })[0];
    await act(async () => { botao.props.onPress(); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(tem(arvore, "banner-pz-ativo")).toBe(true);
    arvore.unmount();
  });
});

describe("quem não vê", () => {
  test("consolidado multi-CNPJ: Escolha uma loja, sem ida ao servidor", async () => {
    mockAuth.estado = { ...mockAuth.estado, consolidatedView: true };
    const arvore = await montarSecao();
    expect(tem(arvore, "banner-pz-escolha-a-loja")).toBe(true);
    expect(textoDe(arvore)).toContain("Escolha uma loja");
    expect(mockRequest).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("Essencial ou membro sem permissão: some, sem cadeado nem convite", async () => {
    mockVisiveis.set = new Set(["painel", "pdv"]);
    const arvore = await montarSecao();
    expect(arvore.toJSON()).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
    const codigo = FONTE_SECAO.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
    expect(codigo).not.toMatch(/upgrade|cadeado|"lock"|Assine|\/planos/i);
  });

  test("frente desligada (studio_enabled false): some", async () => {
    mockPdv.settings = { studio_enabled: false };
    const arvore = await montarSecao();
    expect(arvore.toJSON()).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockRefreshMe).not.toHaveBeenCalled();
  });

  test("empresa no shell /studio (vertical_active = studio): some", async () => {
    mockAuth.estado = { ...mockAuth.estado, company: { ...LOJA, vertical_active: "studio" } };
    const arvore = await montarSecao();
    expect(arvore.toJSON()).toBeNull();
  });

  test("Loja Digital do Studio (vitrine=\"studio\"): a aba Design não monta a seção", async () => {
    const arvore = await montarAba("studio");
    expect(tem(arvore, "banner-personalizados")).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
    arvore.unmount();
  });

  test("enquanto as permissões carregam, não decide nem chama o servidor", async () => {
    mockVisiveis.prontos = false;
    const arvore = await montarSecao();
    expect(arvore.toJSON()).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("regras do banner", () => {
  test("a capa é a foto da peça (ou a foto própria do banner), nunca mockup nem render", () => {
    const b = bannerDaResposta({ ativo: true, produto_id: CANECA.id });
    expect(capaDoBanner(b, [CAMISETA, CANECA])).toBe(CANECA.image_url);
    // Automático: a mais nova com foto.
    expect(capaDoBanner(bannerDaResposta({ ativo: true }), [CAMISETA, CANECA])).toBe(CANECA.image_url);
    // Escolhida sem foto: cai na mais nova com foto, como o backend.
    expect(capaDoBanner(bannerDaResposta({ ativo: true, produto_id: CAMISETA.id }), [CAMISETA, CANECA])).toBe(CANECA.image_url);
    expect(capaDoBanner(bannerDaResposta({ imagem_url: "https://cdn.teste/banner.jpg" }), [CAMISETA])).toBe("https://cdn.teste/banner.jpg");
    const codigo = (FONTE_SECAO + FONTE_REGRAS).split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
    expect(codigo).not.toMatch(/mockup_url|render_url|capa_url|studioApi/i);
  });

  test("a foto própria do banner faz a ida e volta no PUT", () => {
    const b = bannerDaResposta({ ativo: true, imagem_url: "https://cdn.teste/banner.jpg", titulo: " Oi " });
    expect(corpoDoPut(b)).toMatchObject({ imagem_url: "https://cdn.teste/banner.jpg", titulo: "Oi" });
    expect(bannerDaResposta(null)).toMatchObject({ ativo: false, produto_id: null, mostrar_3d: true });
  });

  test("texto da prévia: preto ou branco pela cor da loja", () => {
    expect(textoSobre("#1a1612")).toBe("#ffffff");
    expect(textoSobre("#f4ece4")).toBe("#000000");
    expect(textoSobre("xyz")).toBe("#ffffff");
  });
});
