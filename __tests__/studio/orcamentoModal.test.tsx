// ============================================================
// Studio · modal do orçamento (29/09/2026)
//
// Mockup aprovado: docs/mockups/studio-orcamento-modal.html. Aqui:
//   1. as regras puras: estado, um primário por estado no rodapé,
//      catálogo aberto (mais usados, recentes, todos), modelo da peça
//      (herdado x só neste orçamento), leitura de preço e resumo;
//   2. o modal montado: orçamento novo vazio, catálogo já cheio sem
//      digitar, adicionar e concluir, a peça abre na linha com o modelo,
//      salvar manda o modelo do item e as condições; orçamento enviado
//      com Aprovar como primário; 44 px no celular.
//
// react-native vira componentes-string (padrão dos testes de tela).
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

let mockLargura = 1440;
jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", Image: "Image", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
  Linking: { openURL: jest.fn() },
  useWindowDimensions: () => ({ width: mockLargura, height: 900 }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), router: { push: jest.fn() } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined), deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/clipboard", () => ({ copyText: jest.fn(), copyToClipboard: jest.fn(async () => true) }));
const mockTokens = {
  primary: "#1E3A8A", primary2: "#3B82F6", primarySoft: "#DBEAFE", primaryGhost: "#EFF6FF",
  accent: "#EC4899", accentSoft: "#FCE7F3", accentInk: "#BE185D", bg: "#E8E9F0",
  bgSoft: "#EEF0F5", paperCard: "#F5F6FA", paperCardElev: "#FFF",
  ink: "#0F172A", ink2: "#334155", ink3: "#5E6A7A", ink4: "#94A3B8", ink5: "#CBD5E1",
  success: "#10B981", successSoft: "#D1FAE5", successInk: "#065F46", danger: "#DC2626", dangerSoft: "#FEE2E2", dangerInk: "#991B1B",
  warning: "#F59E0B", warningSoft: "#FEF3C7", warningInk: "#92400E", info: "#3B82F6", infoSoft: "#DBEAFE", infoInk: "#1E3A8A",
};
jest.mock("@/contexts/StudioThemeMode", () => ({
  useStudioTokens: () => mockTokens,
  useStudioTheme: () => ({ tokens: mockTokens, isDark: false }),
}));
jest.mock("@/components/studio/visualEngine/EnginePreview", () => ({ invalidateProductTemplate: jest.fn() }));
jest.mock("@/components/studio/mockupPorProduto/MiniaturaDoModelo", () => ({ MiniaturaDoModelo: "MiniaturaDoModelo" }));
jest.mock("@/components/studio/orcamentoVideo/OrcamentoVideoModal", () => ({ OrcamentoVideoModal: "OrcamentoVideoModal" }));
jest.mock("@/components/studio/orcamentoVideo/videoDoOrcamentoApi", () => ({ baixarVideoDoOrcamento: jest.fn(async () => null) }));
jest.mock("@/components/studio/orcamentoVideo/PedidoDeAjusteModal", () => ({ PedidoDeAjusteModal: "PedidoDeAjusteModal" }));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/services/studioVisualApi", () => ({
  studioVisualApi: {
    listVisualTemplates: jest.fn(async () => ({ templates: [
      { key: "caneca-classica", name: "Caneca clássica", kind: "model3d", version: 1 },
      { key: "caneca-magica", name: "Caneca mágica", kind: "model3d", version: 1 },
      { key: "camiseta-frente", name: "Camiseta · frente", kind: "photo2d", version: 1 },
    ] })),
    getVisualTemplate: jest.fn(async () => ({ template: { spec: null } })),
  },
}));
const mockApi = {
  getQuote: jest.fn(),
  createQuote: jest.fn(),
  updateQuote: jest.fn(),
  salvarCondicoesDoOrcamento: jest.fn(),
  produtosFrequentesDoOrcamento: jest.fn(),
  calculateQuoteLine: jest.fn(async () => ({ unit_price: 0, breakdown: {} })),
};
jest.mock("@/services/studioApi", () => ({
  studioApi: new Proxy({}, { get: (_t, k: string) => (mockApi as any)[k] || jest.fn() }),
}));

import { OrcamentoModal } from "@/components/studio/orcamentoModal/OrcamentoModal";
import {
  SEM_MODELO, TIPOS_PRIMARIOS, acoesDoRodape, estadoDoOrcamento, gruposDoCatalogo, lerPreco, modeloEfetivo,
  opcoesDoModeloDaPeca, resumoDoOrcamento, seloDoModelo, lerProdutoDoCatalogo, TODAS_AS_CATEGORIAS,
  type EstadoDoOrcamento,
} from "@/components/studio/orcamentoModal/regras";

const CID = "c1";
const PRODUTOS = [
  { id: "p1", name: "Caneca clássica 325 ml", price: 39.9, category: "Canecas", visual_template_key: "caneca-classica" },
  { id: "p2", name: "Camiseta algodão premium", price: 59.9, category: "Camisetas", visual_template_key: "camiseta-frente" },
  { id: "p3", name: "Caixa presente kraft", price: 4.5, category: "Embalagens", visual_template_key: null },
  { id: "p4", name: "Ecobag algodão cru", price: 24.9, category: "Brindes", visual_template_key: null },
];

// ─── Regras ─────────────────────────────────────────────────
describe("regras do modal", () => {
  test("estado pelo status, com o ajuste pedido na frente do rascunho", () => {
    expect(estadoDoOrcamento(null)).toBe("novo");
    expect(estadoDoOrcamento({ status: "draft", ajuste_pedido_em: null })).toBe("rascunho");
    expect(estadoDoOrcamento({ status: "draft", ajuste_pedido_em: "2026-09-29T09:40:00Z" })).toBe("ajuste");
    expect(estadoDoOrcamento({ status: "sent" } as any)).toBe("enviado");
    expect(estadoDoOrcamento({ status: "converted" } as any)).toBe("aprovado");
    expect(estadoDoOrcamento({ status: "closed" } as any)).toBe("encerrado");
  });

  test("um primário por estado, sempre o último botão", () => {
    const estados: EstadoDoOrcamento[] = ["novo", "rascunho", "ajuste", "enviado", "aceito", "aprovado"];
    for (const e of estados) {
      const a = acoesDoRodape(e, { temPecas: true, catalogoAberto: false, temPedido: true });
      expect(a.filter((x) => TIPOS_PRIMARIOS.includes(x.tipo))).toHaveLength(1);
      expect(TIPOS_PRIMARIOS).toContain(a[a.length - 1].tipo);
    }
    expect(acoesDoRodape("rascunho", { temPecas: true, catalogoAberto: false }).map((x) => x.id)).toEqual(["cancelar", "salvar", "enviar"]);
    expect(acoesDoRodape("enviado", { temPecas: true, catalogoAberto: false }).map((x) => x.id)).toEqual(["fechar_sem_venda", "ajuste", "aprovar"]);
    expect(acoesDoRodape("ajuste", { temPecas: true, catalogoAberto: false }).pop()!.rotulo).toBe("Reenviar pelo WhatsApp");
    expect(acoesDoRodape("aprovado", { temPecas: true, catalogoAberto: false, temPedido: true }).pop()!.id).toBe("ver_pedido");
    // Sem peças: salvar e enviar ficam apagados.
    expect(acoesDoRodape("novo", { temPecas: false, catalogoAberto: false }).filter((x) => x.desabilitada).map((x) => x.id)).toEqual(["salvar", "enviar"]);
    // Catálogo aberto: Concluir é o primário; depois do envio o catálogo não vale.
    expect(acoesDoRodape("rascunho", { temPecas: true, catalogoAberto: true }).map((x) => x.id)).toEqual(["voltar_pecas", "concluir"]);
    expect(acoesDoRodape("enviado", { temPecas: true, catalogoAberto: true }).pop()!.id).toBe("aprovar");
  });

  test("catálogo aberto: mais usados, recentes sem repetir e o resto de A a Z", () => {
    const produtos = PRODUTOS.map(lerProdutoDoCatalogo);
    const freq = {
      mais_usados: [{ product_id: "p1", usos: 31, ultima_vez: null }, { product_id: "sumiu", usos: 9, ultima_vez: null }],
      recentes: [{ product_id: "p1", usos: 31, ultima_vez: null }, { product_id: "p4", usos: 1, ultima_vez: null }],
    };
    const g = gruposDoCatalogo(produtos, freq, { busca: "", categoria: TODAS_AS_CATEGORIAS });
    expect(g.maisUsados.map((x) => [x.produto.id, x.usos])).toEqual([["p1", 31]]);
    expect(g.recentes.map((p) => p.id)).toEqual(["p4"]);
    expect(g.todos.map((p) => p.id)).toEqual(["p3", "p2"]);
    // Busca sem acento, em nome e categoria; lista única.
    const b = gruposDoCatalogo(produtos, freq, { busca: "algodao", categoria: TODAS_AS_CATEGORIAS });
    expect(b.buscando).toBe(true);
    expect(b.todos.map((p) => p.id)).toEqual(["p2", "p4"]);
    expect(gruposDoCatalogo(produtos, freq, { busca: "", categoria: "Canecas" }).todos).toHaveLength(0);
    // Backend de antes (sem frequentes): tudo em A–Z.
    expect(gruposDoCatalogo(produtos, null, { busca: "", categoria: TODAS_AS_CATEGORIAS }).todos).toHaveLength(4);
  });

  test("modelo da peça: null herda, chave troca só aqui, sem-mockup tira", () => {
    expect(modeloEfetivo(null, "caneca-classica")).toEqual({ key: "caneca-classica", herdado: true });
    expect(modeloEfetivo("caneca-magica", "caneca-classica")).toEqual({ key: "caneca-magica", herdado: false });
    expect(modeloEfetivo(SEM_MODELO, "caneca-classica")).toEqual({ key: null, herdado: false });
    const tpls: any[] = [{ key: "a", name: "A 3D", kind: "model3d" }, { key: "b", name: "B 2D", kind: "photo2d" }];
    expect(seloDoModelo("a", tpls)).toEqual({ rotulo: "3D", tipo: "3d" });
    expect(seloDoModelo(null, tpls).tipo).toBe("sem");
    const op = opcoesDoModeloDaPeca("a", tpls);
    expect(op.map((o) => o.key)).toEqual([null, SEM_MODELO, "b"]);
    expect(op[0].nome).toBe("Do produto · A 3D");
    // Produto sem modelo: sem a opção repetida de "Sem mockup".
    expect(opcoesDoModeloDaPeca(null, tpls).map((o) => o.key)).toEqual([null, "a", "b"]);
  });

  test("preço em pt-BR e resumo com sinal, Pix e parcelas", () => {
    expect(lerPreco("59,90")).toBe(59.9);
    expect(lerPreco("1.234,50")).toBe(1234.5);
    expect(lerPreco("R$ 10")).toBe(10);
    expect(lerPreco("abc")).toBeNull();
    const r = resumoDoOrcamento([{ quantity: 12, unit_price: 39.9 }, { quantity: 1, unit_price: 59.9 }], { desconto: 5.9, sinalPct: 50, pixPct: 5, parcelas: 6 });
    expect(r).toMatchObject({ pecas: 2, unidades: 13, subtotal: 538.7, total: 532.8, sinal: 266.4, pix: 506.16, parcela: 88.8 });
  });
});

// ─── Modal montado ──────────────────────────────────────────
function porId(r: TestRenderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n) => n.props.testID === id && typeof n.type === "string");
}
function um(r: TestRenderer.ReactTestRenderer, id: string) {
  const a = porId(r, id);
  if (!a.length) throw new Error("sem " + id);
  return a[0];
}
function textos(n: any): string {
  return n.findAll((x: any) => x.type === "Text").map((x: any) => (Array.isArray(x.props.children) ? x.props.children.join("") : String(x.props.children ?? ""))).join(" | ");
}
const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  mockLargura = 1440;
  mockRequest.mockReset();
  mockRequest.mockImplementation(async (url: string) => (url.includes("/studio/products") ? { products: PRODUTOS } : {}));
  Object.values(mockApi).forEach((f) => f.mockClear());
  mockApi.produtosFrequentesDoOrcamento.mockResolvedValue({
    days: 90, mais_usados: [{ product_id: "p1", usos: 31, ultima_vez: null }], recentes: [{ product_id: "p4", usos: 1, ultima_vez: null }],
  });
  mockApi.createQuote.mockImplementation(async (_c: string, body: any) => ({ id: "q-novo", company_id: CID, status: "draft", total: 0, ...body }));
  mockApi.salvarCondicoesDoOrcamento.mockImplementation(async () => ({ quote: { id: "q-novo", company_id: CID, status: "draft" }, valores: {} }));
});

describe("modal do orçamento", () => {
  test("novo: vazio, catálogo já cheio sem digitar, adicionar, abrir a peça e salvar com o modelo", async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<OrcamentoModal cid={CID} quoteId="novo" lojas={[{ id: CID, name: "Ateliê Lume" }]} onClose={jest.fn()} />);
    });
    await esperar();
    expect(textos(um(r, "titulo"))).toContain("Novo orçamento");
    expect(porId(r, "pecas-vazio")).toHaveLength(1);
    expect(um(r, "acao-enviar").props.disabled).toBe(true);

    await act(async () => { um(r, "escolher-pecas").props.onPress(); });
    // Catálogo aberto sem digitar nada: mais usados, recentes e o resto.
    expect(textos(um(r, "grupo-mais-usados"))).toContain("31 orçamentos");
    expect(porId(r, "produto-p4")).toHaveLength(1);
    expect(porId(r, "produto-p3")).toHaveLength(1);
    expect(um(r, "acao-concluir")).toBeTruthy();

    await act(async () => { um(r, "produto-p1").props.onPress(); });
    await act(async () => { um(r, "produto-p1").props.onPress(); }); // segunda vez: mais uma unidade
    await act(async () => { um(r, "acao-concluir").props.onPress(); });
    const linha = r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("peca-linha-") && typeof n.type === "string")[0];
    expect(textos(linha)).toContain("2 × R$ 39,90");
    expect(textos(linha)).toContain("3D · Caneca clássica");

    await act(async () => { linha.props.onPress(); });
    const gatilho = um(r, "modelo-p1");
    expect(gatilho.props.accessibilityLabel).toContain("do produto");
    expect(um(r, "qtd-mais").props.style.width).toBe(44);

    // Validade de 15 dias e sinal de 50 %.
    await act(async () => { um(r, "validade-15").props.onPress(); });
    await act(async () => { um(r, "sinal").props.onChangeText("50"); });
    expect(um(r, "acao-enviar").props.disabled).toBe(false);

    await act(async () => { um(r, "acao-salvar").props.onPress(); });
    await esperar();
    expect(mockApi.createQuote).toHaveBeenCalledTimes(1);
    const [cid, body] = mockApi.createQuote.mock.calls[0];
    expect(cid).toBe(CID);
    expect(body.items).toEqual([expect.objectContaining({ product_id: "p1", quantity: 2, unit_price: 39.9, visual_template_key: null })]);
    expect(body.validity_days).toBe(15);
    expect(mockApi.salvarCondicoesDoOrcamento).toHaveBeenCalledWith(CID, "q-novo", expect.objectContaining({ deposit_pct: 50, validity_days: 15 }));
  });

  test("enviado: Aprovar é o primário, campos só leitura, acompanhamento com o vídeo", async () => {
    mockApi.getQuote.mockResolvedValue({
      quote: {
        id: "q1", company_id: CID, status: "sent", customer_name: "Mariana Costa", customer_phone: "11987654321",
        total: 532.8, discount: 5.9, validity_days: 7, deposit_pct: 50, sent_at: "2026-09-28T17:32:00Z",
        expires_at: "2026-10-06T17:32:00Z", canal_envio: "whatsapp", video_key: "v.mp4", video_expira_em: "2099-10-28T00:00:00Z",
        condicoes: { pix_desconto_pct: 5, parcelas: null, prazo_dias_uteis: null, observacao: null }, versao: 1,
      },
      items: [{ id: "i1", product_id: "p1", description: "Caneca clássica 325 ml", quantity: 12, unit_price: 39.9, visual_template_key: "caneca-magica" }],
      ajustes: [],
    });
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<OrcamentoModal cid={CID} quoteId="q1" lojas={[{ id: CID, name: "Ateliê Lume" }]} onClose={jest.fn()} />);
    });
    await esperar();
    const acoes = um(r, "rodape-acoes").findAll((n: any) => typeof n.props.testID === "string" && n.props.testID.startsWith("acao-") && typeof n.type === "string");
    expect(acoes.map((a: any) => a.props.testID)).toEqual(["acao-fechar_sem_venda", "acao-ajuste", "acao-aprovar"]);
    expect(um(r, "cliente-nome").props.editable).toBe(false);
    expect(porId(r, "cartao-video")).toHaveLength(1);
    expect(porId(r, "manter-video")).toHaveLength(1);
    expect(porId(r, "adicionar")).toHaveLength(0);
    // A peça traz o modelo trocado só neste orçamento.
    const linha = r.root.findAll((n) => n.props.testID === "peca-linha-i1" && typeof n.type === "string")[0];
    expect(textos(linha)).toContain("3D · Caneca mágica");
    expect(textos(linha)).toContain("só aqui");

    await act(async () => { um(r, "acao-aprovar").props.onPress(); });
    expect(porId(r, "confirmacao")).toHaveLength(1);
  });

  test("celular: tela cheia, alvos de 44 px e o primário em cima", async () => {
    mockLargura = 390;
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<OrcamentoModal cid={CID} quoteId="novo" lojas={[{ id: CID, name: "Ateliê Lume" }]} onClose={jest.fn()} />);
    });
    await esperar();
    expect(um(r, "fechar-modal").props.style.width).toBe(44);
    expect(um(r, "acao-enviar").props.style.minHeight).toBe(44);
    expect(um(r, "validade-7").props.style.minHeight).toBe(44);
    const acoes = um(r, "rodape-acoes").findAll((n: any) => typeof n.props.testID === "string" && n.props.testID.startsWith("acao-") && typeof n.type === "string");
    expect(acoes[0].props.testID).toBe("acao-enviar");
  });

  test("consolidado: o orçamento novo pede a loja primeiro", async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <OrcamentoModal cid={null} quoteId="novo" consolidado lojas={[{ id: "c1", name: "Centro" }, { id: "c2", name: "Vila Nova" }]} onClose={jest.fn()} />,
      );
    });
    expect(porId(r, "escolher-loja")).toHaveLength(1);
    expect(mockRequest).not.toHaveBeenCalled();
    await act(async () => { um(r, "loja-c2").props.onPress(); });
    await esperar();
    expect(textos(um(r, "chip-loja"))).toContain("Vila Nova");
    expect(mockRequest.mock.calls[0][0]).toContain("/companies/c2/studio/products");
    expect(mockApi.produtosFrequentesDoOrcamento).toHaveBeenCalledWith("c2", { days: 90 });
  });
});
