// ============================================================
// Studio · orçamento pelo link com a foto da peça (25/11/2026)
//
// QA do Caio (24/11): o cliente abria o link e via o orçamento, mas não
// como ficou a arte. Paliativo:
//   1. o canal "Link do orçamento" manda também a foto da peça, pelo
//      mesmo caminho do canal de foto (compartilhar com arquivo; senão
//      baixar a foto + abrir a conversa com o link escrito);
//   2. a página pública mostra o rótulo do campo ("Nome: Ana") em vez do
//      id, e não mostra o endereço cru da imagem.
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { etiquetasDaPersonalizacao } from "@/components/studio/personalizacaoNoOrcamentoPublico";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", Image: "Image", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
  useWindowDimensions: () => ({ width: 1440, height: 900 }),
}));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/clipboard", () => ({ copyToClipboard: jest.fn(async () => true) }));
jest.mock("@/contexts/StudioThemeMode", () => ({
  useStudioTokens: () => new Proxy({}, { get: () => "#000000" }),
}));
jest.mock("@/components/studio/modalNoCelular", () => ({ ehCelular: () => false, respiroInferior: () => ({}) }));
jest.mock("@/components/studio/mockupPorProduto/MiniaturaDoModelo", () => ({ formaDaMiniaturaDoModelo: () => null }));
jest.mock("@/components/studio/orcamentoVideo/modeloDaPeca", () => ({
  carregarFontesDaPeca: jest.fn(async () => ({ cfg: null, template: null })),
}));
const mockFoto = new Blob(["jpg"], { type: "image/jpeg" });
jest.mock("@/components/studio/orcamentoVideo/pecaDoOrcamento", () => ({
  tem3d: () => false,
  temFoto: () => true,
  fotoSem3d: jest.fn(async () => mockFoto),
}));
jest.mock("@/components/studio/orcamentoVideo/artesPorLado", () => ({
  artesDoItem: () => [], motorDasArtes: () => ({ values: {}, opts: {} }),
  ladosDaPeca: () => [], textoDasArtes: () => "",
}));
jest.mock("@/components/studio/orcamentoVideo/gravarGiro", () => ({
  abrirPalco: jest.fn(), gravarGiro: jest.fn(), fotoDoPalco: jest.fn(), DURACAO_S: 7,
}));
jest.mock("@/components/studio/orcamentoVideo/videoDoOrcamentoApi", () => ({ subirVideoDoOrcamento: jest.fn() }));
const mockEnvio = {
  podeCompartilharArquivo: jest.fn((f: any) => !!f),
  compartilharArquivo: jest.fn(async () => "enviado"),
  baixarArquivo: jest.fn(),
  abrirConversa: jest.fn(),
};
jest.mock("@/components/studio/orcamentoVideo/envioNoWhatsApp", () => {
  const real = jest.requireActual("@/components/studio/orcamentoVideo/envioNoWhatsApp");
  return {
    ...real,
    podeCompartilharArquivo: (...a: any[]) => (mockEnvio.podeCompartilharArquivo as any)(...a),
    compartilharArquivo: (...a: any[]) => (mockEnvio.compartilharArquivo as any)(...a),
    baixarArquivo: (...a: any[]) => (mockEnvio.baixarArquivo as any)(...a),
    abrirConversa: (...a: any[]) => (mockEnvio.abrirConversa as any)(...a),
  };
});
const URL_DO_ORCAMENTO = "https://app.getaura.com.br/orcamento/tok-1";
const mockSendQuote = jest.fn();
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    sendQuote: (...a: any[]) => mockSendQuote(...a),
    marcarOrcamentoEnviado: jest.fn(),
  },
}));

import { OrcamentoVideoModal } from "@/components/studio/orcamentoVideo/OrcamentoVideoModal";

const QUOTE: any = {
  id: "q1", company_id: "c1", customer_name: "Ana Souza", customer_phone: "11987654321",
  status: "draft", token: null, subtotal: 80, discount: 0, total: 80, estimated_cost: null,
  validity_days: 7, expires_at: null, sent_at: null, responded_at: null, order_id: null,
  deposit_pct: null, deposit_amount: null, created_at: "2026-11-25T10:00:00Z",
};
const ITENS: any[] = [{ id: "i1", product_id: "p1", description: "Caneca", quantity: 2, unit_price: 40, customization: { f_nome: "Ana" } }];

async function montar() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <OrcamentoVideoModal visible companyId="c1" quote={QUOTE} items={ITENS} nomeDaLoja="Ateliê Lume" onClose={() => {}} onAtualizou={() => {}} />,
    );
  });
  // carrega a peça e tira a foto (plano sem 3D)
  await act(async () => { await new Promise((ok) => setTimeout(ok, 0)); });
  await act(async () => { await new Promise((ok) => setTimeout(ok, 0)); });
  await act(async () => { r.root.findByProps({ testID: "canal-link" }).props.onPress(); });
  return r;
}

async function enviarOLink(r: TestRenderer.ReactTestRenderer) {
  await act(async () => { await r.root.findByProps({ testID: "enviar-link" }).props.onPress(); });
}

beforeAll(() => {
  (URL as any).createObjectURL = jest.fn(() => "blob:foto");
  (URL as any).revokeObjectURL = jest.fn();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockEnvio.podeCompartilharArquivo.mockImplementation((f: any) => !!f);
  mockEnvio.compartilharArquivo.mockImplementation(async () => "enviado");
  mockSendQuote.mockResolvedValue({ ...QUOTE, status: "sent", token: "tok-1", quote_url: URL_DO_ORCAMENTO, wa_me_link: null });
});

describe("canal Link do orçamento: a foto vai junto", () => {
  test("com compartilhamento de arquivo, foto e texto com o link vão numa folha só", async () => {
    const r = await montar();
    await enviarOLink(r);
    expect(mockSendQuote).toHaveBeenCalledWith("c1", "q1");
    expect(mockEnvio.compartilharArquivo).toHaveBeenCalledTimes(1);
    const [arquivo, texto] = mockEnvio.compartilharArquivo.mock.calls[0] as any[];
    expect(arquivo).toBeInstanceOf(File);
    expect(arquivo.type).toBe("image/jpeg");
    expect(arquivo.name).toBe("orcamento-atelie-lume-ana.jpg");
    // o texto da mensagem é o de sempre
    expect(texto).toBe(`Oi, Ana! Segue o seu orçamento da Ateliê Lume: ${URL_DO_ORCAMENTO}`);
    expect(mockEnvio.baixarArquivo).not.toHaveBeenCalled();
    expect(mockEnvio.abrirConversa).not.toHaveBeenCalled();
    expect(r.root.findByProps({ testID: "envio-titulo" }).props.children).toBe("Orçamento enviado");
  });

  test("sem compartilhamento de arquivo: baixa a foto e abre a conversa com o link escrito", async () => {
    mockEnvio.podeCompartilharArquivo.mockImplementation(() => false);
    const r = await montar();
    await enviarOLink(r);
    expect(mockEnvio.compartilharArquivo).not.toHaveBeenCalled();
    expect(mockEnvio.baixarArquivo).toHaveBeenCalledTimes(1);
    expect((mockEnvio.baixarArquivo.mock.calls[0] as any[])[1]).toBe("orcamento-atelie-lume-ana.jpg");
    expect(mockEnvio.abrirConversa).toHaveBeenCalledWith(
      "https://wa.me/5511987654321?text=" + encodeURIComponent(`Oi, Ana! Segue o seu orçamento da Ateliê Lume: ${URL_DO_ORCAMENTO}`),
    );
    expect(r.root.findByProps({ testID: "envio-titulo" }).props.children).toBe("Orçamento enviado");
  });

  test("a folha não abriu: cai no baixar + abrir a conversa", async () => {
    mockEnvio.compartilharArquivo.mockImplementation(async () => "falhou");
    const r = await montar();
    await enviarOLink(r);
    expect(mockEnvio.baixarArquivo).toHaveBeenCalledTimes(1);
    expect(mockEnvio.abrirConversa).toHaveBeenCalledTimes(1);
  });

  test("a lojista fechou a folha: nada abre e o passo continua", async () => {
    mockEnvio.compartilharArquivo.mockImplementation(async () => "cancelado");
    const r = await montar();
    await enviarOLink(r);
    expect(mockEnvio.baixarArquivo).not.toHaveBeenCalled();
    expect(mockEnvio.abrirConversa).not.toHaveBeenCalled();
    expect(r.root.findByProps({ testID: "envio-titulo" }).props.children).toBe("Enviar o orçamento");
  });
});

describe("página pública: rótulo do campo no lugar do id", () => {
  const CAMPOS = [
    { id: "f_nome", label: "Nome", type: "text" },
    { id: "f_logo", label: "Logo", type: "image" },
    { id: "f_cor", label: "Cor da caneca", type: "color" },
  ];

  test("com o rótulo vindo do backend: \"Nome: Ana\"", () => {
    const e = etiquetasDaPersonalizacao({ f_nome: "Ana", f_cor: "#D62828" }, CAMPOS);
    expect(e).toEqual([
      { chave: "f_nome", texto: "Nome: Ana", cor: null },
      { chave: "f_cor", texto: "Cor da caneca", cor: "#D62828" },
    ]);
  });

  test("URL crua de imagem não vira texto", () => {
    const e = etiquetasDaPersonalizacao({ f_logo: "https://cdn.getaura.com.br/studio/c1/arte.png", image_back: "https://r2/verso.png" }, CAMPOS);
    expect(e.map((x) => x.texto)).toEqual(["Logo: Arte enviada", "Arte do verso: Arte enviada"]);
    expect(e.some((x) => /https?:/.test(x.texto))).toBe(false);
  });

  test("sem o campo novo (backend antigo): a chave de sempre, sem a URL crua", () => {
    const e = etiquetasDaPersonalizacao({ f_nome: "Ana", f_logo: "https://r2/arte.png" }, undefined);
    expect(e.map((x) => x.texto)).toEqual(["f_nome: Ana", "f_logo: Arte enviada"]);
    expect(etiquetasDaPersonalizacao({ f_nome: "Ana" }, null)).toEqual([{ chave: "f_nome", texto: "f_nome: Ana", cor: null }]);
  });

  test("objeto (ajuste da oficina) e vazio somem; no máximo 4 etiquetas", () => {
    const e = etiquetasDaPersonalizacao({
      orcamento_ajustes: { front: { escala: 1.2 } }, f_nome: "  ", vazio: null,
      a: "1", b: "2", c: "3", d: "4", e: "5",
    }, CAMPOS);
    expect(e.map((x) => x.chave)).toEqual(["a", "b", "c", "d"]);
    expect(etiquetasDaPersonalizacao(null, CAMPOS)).toEqual([]);
  });
});
