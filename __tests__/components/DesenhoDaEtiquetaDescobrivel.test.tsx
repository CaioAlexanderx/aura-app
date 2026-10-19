// ============================================================
// Desenho da etiqueta descobrível (18/10/2026, card p-36)
//
// 1. Miniatura de cada desenho nos dois cartões de escolha.
// 2. Aba Etiquetas do Estoque: "Desenho: <efetivo> · mudar", que abre
//    Configurações focada na escolha (/configuracoes?foco=desenho-etiqueta).
// 3. O texto do cartão diz primeiro a quais modelos a escolha vale.
// Só tela: o HTML impresso não muda (as fixtures de etiqueta continuam
// intocadas; aqui o resumo da tela é conferido CONTRA o buildLabelHtml).
// Mocks do padrão do repo (expo-font, Icon, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockPush = jest.fn();
let mockSettings: any = {};

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) }, useRouter: () => ({ push: mockPush }) }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    () => ({ company: { id: "loja-1", name: "Loja", vertical_active: "retail" }, token: "t", isStaff: false, isDemo: false }),
    { getState: () => ({ token: "t", company: { id: "loja-1" } }) },
  ),
}));
jest.mock("@/services/api", () => ({
  pdvSettingsApi: { get: jest.fn(() => Promise.resolve({ settings: mockSettings })), save: jest.fn(() => Promise.resolve({})) },
  companiesApi: { products: jest.fn() },
}));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardFeeSection", () => ({ CardFeeSection: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));
jest.mock("@/components/screens/configuracoes/FrenteDaLoja", () => ({ FrenteDaLoja: () => null, nomeDaFrente: () => "" }));

import {
  buildLabelHtml, LABEL_SIZE_KEYS, type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import { MEDIDA_PADRAO, type CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import {
  DesenhoDaEtiquetaLinha, resumoDoDesenho, ROTA_ESCOLHA_DO_DESENHO,
} from "@/components/screens/estoque/DesenhoDaEtiquetaLinha";
import { alvoDaSecao, secaoDoFoco } from "@/utils/focoNaSecao";
import { ITENS_DOURADOS } from "../fixtures/etiquetas/casos";

jest.setTimeout(30000);

const MEDIDA: CustomLabelSpec = { ...MEDIDA_PADRAO, id: "m1", nome: "" } as any;
const DESENHOS = [undefined, null, "", "classico", "editorial", "moderno"];

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });

async function flush(vezes = 5) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  mockPush.mockClear();
  mockSettings = {};
  window.localStorage.clear();
});

describe("resumoDoDesenho: o que a tela diz é o que sai na impressão", () => {
  it.each(LABEL_SIZE_KEYS.flatMap((k) => DESENHOS.map((d) => [k, d] as [LabelSizeKey, any])))(
    "%s com desenho %j", (size, design) => {
      const html = buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: "Loja", showStoreName: true, labelSize: size, design });
      const impresso = html.includes('class="bc-inner ed') ? "editorial" : "classico";
      expect(resumoDoDesenho(size, design, null).desenho).toBe(impresso);
    },
  );

  it("Minha medida: o desenho do próprio preset, igual ao impresso, e sem escolha", () => {
    const html = buildLabelHtml(ITENS_DOURADOS, { mode: "barcode", storeName: "Loja", showStoreName: true, labelSize: "99x21", design: "classico", customSpec: MEDIDA });
    const impresso = html.includes('class="bc-inner ed') ? "editorial" : "classico";
    expect(resumoDoDesenho("99x21", "classico", MEDIDA)).toEqual({ desenho: impresso, escolhivel: false });
  });

  it("só 33x21 (99x21 e 105x21) e 30x25 aceitam a escolha", () => {
    expect(LABEL_SIZE_KEYS.filter((k) => resumoDoDesenho(k, null, null).escolhivel)).toEqual(["99x21", "105x21", "30x25"]);
  });

  it("sem escolha mostra o padrão do modelo", () => {
    expect(resumoDoDesenho("99x21", null, null).desenho).toBe("classico");
    expect(resumoDoDesenho("105x21", null, null).desenho).toBe("editorial");
    expect(resumoDoDesenho("40x25", undefined, null).desenho).toBe("editorial");
    expect(resumoDoDesenho(undefined, undefined, null).desenho).toBe("classico");
  });
});

describe("linha \"Desenho: ... · mudar\"", () => {
  function monta(props: Partial<React.ComponentProps<typeof DesenhoDaEtiquetaLinha>>) {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<DesenhoDaEtiquetaLinha labelSize="99x21" labelDesign={null} medida={null} podeMudar {...props} />);
    });
    return t;
  }

  it("mostra o desenho efetivo e o mudar leva à escolha em Configurações", () => {
    const t = monta({ labelSize: "30x25", labelDesign: "editorial" });
    expect(flatten(t.toJSON())).toContain("Desenho: Editorial");
    const mudar = porId(t, "etiquetas-desenho-mudar")[0];
    expect(mudar).toBeTruthy();
    act(() => { mudar.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/configuracoes?foco=desenho-etiqueta");
    expect(ROTA_ESCOLHA_DO_DESENHO).toBe("/configuracoes?foco=desenho-etiqueta");
    t.unmount();
  });

  it("a rota cai numa seção registrada, a mesma que o cartão marca", () => {
    const secao = secaoDoFoco("desenho-etiqueta");
    expect(secao).not.toBeNull();
    expect(secao!.alvo).toBe(alvoDaSecao("desenho-etiqueta"));
  });

  it("sem permissão de Configurações: só o desenho, sem o mudar", () => {
    const t = monta({ podeMudar: false });
    expect(flatten(t.toJSON())).toContain("Desenho: Clássico");
    expect(porId(t, "etiquetas-desenho-mudar")).toHaveLength(0);
    t.unmount();
  });

  it("modelo de desenho fixo (40x25, 58mm, Minha medida): diz que é fixo e não oferece mudar", () => {
    ([["40x25", null, "Editorial"], ["58mm", "editorial", "Clássico"]] as const).forEach(([size, d, nome]) => {
      const t = monta({ labelSize: size as LabelSizeKey, labelDesign: d });
      const txt = flatten(t.toJSON());
      expect(txt).toContain("Desenho: " + nome);
      expect(txt).toContain("fixo neste modelo");
      expect(porId(t, "etiquetas-desenho-mudar")).toHaveLength(0);
      t.unmount();
    });
    const t = monta({ medida: MEDIDA, labelDesign: "classico" });
    expect(flatten(t.toJSON())).toContain("fixo neste modelo");
    expect(porId(t, "etiquetas-desenho-mudar")).toHaveLength(0);
    t.unmount();
  });
});

describe("aba Etiquetas monta a linha", () => {
  function montaPrintLabels(extra: any) {
    const { PrintLabels } = require("@/components/PrintLabels");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <QueryClientProvider client={qc}>
          <PrintLabels products={[]} selectedIds={[]} onSelectionChange={() => {}} {...extra} />
        </QueryClientProvider>,
      );
    });
    return t;
  }

  it("com o desenho escolhido pela loja e o mudar quando o Estoque permite", async () => {
    mockSettings = { label_design: "editorial", label_size: "99x21" };
    const t = montaPrintLabels({ podeMudarDesenho: true });
    await flush();
    expect(flatten(t.toJSON())).toContain("Desenho: Editorial");
    expect(porId(t, "etiquetas-desenho-mudar")).toHaveLength(1);
    t.unmount();
  });

  it("sem a permissão vinda do Estoque, não oferece mudar", async () => {
    const t = montaPrintLabels({});
    await flush();
    expect(flatten(t.toJSON())).toContain("Desenho: Clássico");
    expect(porId(t, "etiquetas-desenho-mudar")).toHaveLength(0);
    t.unmount();
  });
});

describe("Configurações › Desenho da etiqueta", () => {
  async function montaCartao(settings: any) {
    mockSettings = settings;
    const { PdvSettingsCard } = require("@/components/screens/configuracoes/PdvSettingsCard");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let t!: renderer.ReactTestRenderer;
    await act(async () => { t = renderer.create(<QueryClientProvider client={qc}><PdvSettingsCard /></QueryClientProvider>); });
    await flush();
    return t;
  }

  it("cada cartão de escolha traz a miniatura do seu desenho", async () => {
    const t = await montaCartao({ label_size: "99x21" });
    ["classico", "editorial"].forEach((d) => {
      const chip = porId(t, "desenho-etiqueta-" + d)[0];
      expect(chip.findAll((n) => n.props && n.props.testID === "miniatura-etiqueta-" + d, { deep: false })).toHaveLength(1);
    });
    t.unmount();
  });

  it("o texto começa pelos modelos em que a escolha vale", async () => {
    const t = await montaCartao({ label_size: "99x21" });
    const txt = flatten(t.toJSON());
    const ini = txt.indexOf("Desenho da etiqueta");
    expect(txt.slice(ini)).toMatch(/^Desenho da etiquetaVale para as etiquetas 33x21mm \(com ou sem vão\) e 30x25mm\./);
    expect(txt).toContain("As de 40x25mm, a bobina 58mm e a Minha medida têm desenho fixo.");
    t.unmount();
  });

  it("a seção carrega a marca que o foco procura", async () => {
    const t = await montaCartao({ label_size: "99x21" });
    const alvo = alvoDaSecao("desenho-etiqueta");
    const marcados = t.root.findAll((n) => n.props && n.props.dataSet && n.props.dataSet.tour === alvo, { deep: false });
    expect(marcados).toHaveLength(1);
    expect(marcados[0].findAll((n) => n.props && n.props.testID === "desenho-etiqueta-editorial", { deep: false })).toHaveLength(1);
    t.unmount();
  });
});
