// ============================================================
// Pedir aprovação da arte (27/11/2026), fiel ao mockup da Nina.
//
//   1. regras: mensagem, telefone, link do WhatsApp, progresso, itens;
//   2. a tela: uma só, a barra e o botão travado enquanto grava, o selo
//      "Vídeo pronto · 7 s", a prévia com valores com vírgula, o enviado,
//      e nenhum termo técnico em nenhum estado.
//
// Padrão de render da casa: react-test-renderer + testID.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

const mockGerar = jest.fn();
const mockRequest = jest.fn();
const mockRequestRender = jest.fn();
const mockGetOrder = jest.fn();
const mockLargura = { valor: 1440 };

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/clipboard", () => ({ copyToClipboard: jest.fn(() => Promise.resolve(true)) }));
jest.mock("@/services/studioUploadApi", () => ({ pickImageBase64: jest.fn(), uploadStudioMockup: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "c1", trade_name: "Lume Moda" }, companyLogo: null }),
}));
jest.mock("@/components/studio/orcamentoVideo/gravarGiro", () => ({ DURACAO_S: 7 }));
jest.mock("@/components/studio/visualEngine/gerarRenderAprovacao", () => ({
  gerarRenderDoPedido: (...a: any[]) => mockGerar(...a),
}));
jest.mock("@/services/studioVisualApi", () => ({
  studioVisualApi: { requestApprovalWithRender: (...a: any[]) => mockRequestRender(...a) },
}));
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    getOrder: (...a: any[]) => mockGetOrder(...a),
    requestApproval: (...a: any[]) => mockRequest(...a),
  },
}));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, useWindowDimensions: () => ({ width: mockLargura.valor, height: 900, scale: 1, fontScale: 1 }) };
});

import fs from "fs";
import path from "path";
import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import {
  itensDaPrevia, linkDoWhatsApp, mensagemInicial, mensagemPadrao, textoParaOServidor, progressoDaGeracao, reais, rotuloDoItem,
  seloDoAnexo, telefoneValido, textoComLink,
} from "@/components/studio/aprovacaoDaArte/regras";

const PEDIDO: any = {
  id: "o1", order_number: "00020", display_name: "00020", customer_name: "Ana Paula Ribeiro",
  customer_phone: "11984221093", total_amount: 49.9, status: "paid", item_count: 1,
};

function textos(no: renderer.ReactTestRenderer): string {
  const out: string[] = [];
  const visita = (n: any) => {
    if (typeof n === "string") out.push(n);
    else if (n && n.children) n.children.forEach(visita);
  };
  visita(no.toJSON());
  return out.join("").replace(/\s+/g, " ");
}
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });

async function abrir(largura = 1440) {
  mockLargura.valor = largura;
  let r!: renderer.ReactTestRenderer;
  await act(async () => { r = renderer.create(<ApprovalRequestModal order={PEDIDO} onClose={jest.fn()} onSent={jest.fn()} />); });
  // A gravação cede um quadro à tela antes de começar: espera o fim dela.
  await act(async () => { await new Promise((ok) => setTimeout(ok, 80)); });
  return r;
}

const TERMOS_TECNICOS = /turntable|hash|motor visual|Meta|render|mockup|webm|mp4|URL|base64/i;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrder.mockResolvedValue({
    order: { total: 49.9, total_amount: 49.9 },
    items: [{ id: "i1", product_id: "p1", product_name: "Camiseta Básica Branca", quantity: 1, unit_price: 49.9, customization: {} }],
  });
  mockRequest.mockResolvedValue({ approval_url: "https://app/aprovacao/tok", wa_me_link: null });
  mockRequestRender.mockResolvedValue({ approval_url: "https://app/aprovacao/tok", wa_me_link: null });
});

describe("regras", () => {
  it("mensagem padrão com o primeiro nome e o link na linha de baixo", () => {
    expect(mensagemPadrao("ana paula Ribeiro")).toBe("Oi, Ana. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir:");
    expect(mensagemPadrao("")).toBe("Oi. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir:");
    expect(textoComLink("Oi, Ana.", "https://x/y")).toBe("Oi, Ana.\nhttps://x/y");
    expect(textoComLink("  ", "https://x/y")).toBe("https://x/y");
    expect(textoComLink("Veja: {link da aprovação} ok", "https://x/y")).toBe("Veja: https://x/y ok");
    expect(mensagemInicial("Ana")).toBe("Oi, Ana. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir: {link da aprovação}");
    expect(textoParaOServidor(mensagemInicial("Ana"))).toBe("Oi, Ana. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir: {link}");
    expect(textoParaOServidor("sem pílula")).toBe("sem pílula\n{link}");
  });
  it("telefone e link do WhatsApp com DDI 55", () => {
    expect(telefoneValido("(11) 98422-1093")).toBe(true);
    expect(telefoneValido("98422-1093")).toBe(false);
    expect(telefoneValido("5511984221093")).toBe(true);
    expect(linkDoWhatsApp("(11) 98422-1093", "oi ana")).toBe("https://wa.me/5511984221093?text=oi%20ana");
    expect(linkDoWhatsApp("123", "x")).toBeNull();
  });
  it("progresso cresce com a gravação e nunca passa de 1", () => {
    expect(progressoDaGeracao("video", 0)).toBeLessThan(progressoDaGeracao("video", 0.5));
    expect(progressoDaGeracao("video", 5)).toBeLessThanOrEqual(1);
    expect(progressoDaGeracao("envio")).toBeLessThan(1);
    expect(progressoDaGeracao(null)).toBeGreaterThan(0);
  });
  it("itens e valores com vírgula", () => {
    const it = itensDaPrevia([{ product_name: "Camiseta Básica Branca", quantity: 2, unit_price: "49.90" }]);
    expect(it[0].valor).toBeCloseTo(99.8);
    expect(rotuloDoItem(it[0])).toBe("2 × Camiseta Básica Branca");
    expect(reais(49.9)).toBe("R$ 49,90");
  });
  it("selo do arquivo", () => {
    expect(seloDoAnexo({ url: "a.mp4", isVideo: true, renderId: "r", origem: "gerado" }, 7)).toBe("✓ Vídeo pronto · 7 s");
    expect(seloDoAnexo({ url: "a.jpg", isVideo: false, renderId: "r", origem: "gerado" }, 7)).toBe("✓ Imagem pronta");
    expect(seloDoAnexo({ url: "a.pdf", isVideo: false, renderId: null, origem: "arquivo" }, 7)).toBe("✓ Arquivo pronto");
  });
});

describe("a tela, em 1440", () => {
  it("gerando: barra, botão travado em 'Preparando o vídeo…' e prévia com os valores", async () => {
    mockGerar.mockReturnValue(new Promise(() => {}));
    const r = await abrir();
    const txt = textos(r);
    expect(txt).toContain("Pedir aprovação da arte");
    expect(txt).toContain("Como chega para Ana");
    expect(txt).toContain("Lume Moda");
    expect(txt).toContain("1 × Camiseta Básica Branca");
    expect(txt).toContain("R$ 49,90");
    expect(txt).toContain("Aprovar produção");
    expect(txt).toContain("Pedir ajuste");
    expect(txt).toContain("A Aura está gravando a peça girando com a arte do pedido. Leva alguns segundos.");
    expect(porId(r, "aprovacao-progresso")).toHaveLength(1);
    const botao = porId(r, "aprovacao-mandar")[0];
    expect(botao.props.disabled).toBe(true);
    expect(textos(r)).toContain("Preparando o vídeo…");
    expect(txt).not.toMatch(TERMOS_TECNICOS);
  });

  it("pronto: selo, 'Gravar de novo', 'Usar outro arquivo', nota do sino e botão liberado", async () => {
    mockGerar.mockResolvedValue({ url: "https://r2/x.mp4", renderId: "rid1", contentHash: "h", itemName: "Camiseta", view: "turntable", isVideo: true });
    const r = await abrir();
    const txt = textos(r);
    expect(txt).toContain("✓ Vídeo pronto · 7 s");
    expect(txt).toContain("Gravar de novo");
    expect(txt).toContain("Usar outro arquivo");
    expect(txt).toContain("O link vale 7 dias. Quando Ana aprovar ou pedir ajuste, você recebe no sino.");
    expect(txt).toContain("link da aprovação");
    expect(txt).toContain("Copiar o link");
    expect(txt).toContain("Mandar pelo WhatsApp");
    expect(porId(r, "aprovacao-mandar")[0].props.disabled).toBe(false);
    expect(porId(r, "aprovacao-progresso")).toHaveLength(0);
    expect(txt).not.toMatch(TERMOS_TECNICOS);
  });

  it("mandar: cria o link com o render, abre o WhatsApp e mostra o enviado", async () => {
    mockGerar.mockResolvedValue({ url: "https://r2/x.mp4", renderId: "rid1", contentHash: "h", itemName: "Camiseta", view: "turntable", isVideo: true });
    const aberto = jest.fn();
    (global as any).window = (global as any).window || {};
    (global as any).window.open = aberto;
    const r = await abrir();
    await act(async () => { await porId(r, "aprovacao-mandar")[0].props.onPress(); });
    expect(mockRequestRender).toHaveBeenCalledWith("c1", "o1", expect.objectContaining({ mockup_url: "https://r2/x.mp4", render_id: "rid1", custom_message: "Oi, Ana. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir: {link}" }));
    expect(mockRequest).not.toHaveBeenCalled();
    const url = aberto.mock.calls[0][0] as string;
    expect(url).toContain("https://wa.me/5511984221093?text=");
    expect(decodeURIComponent(url)).toContain("Oi, Ana. A arte do seu pedido ficou pronta.");
    expect(decodeURIComponent(url)).toContain("https://app/aprovacao/tok");
    const txt = textos(r);
    expect(txt).toContain("Mandado para Ana.");
    expect(txt).toContain('O pedido continua em "Aguardando arte" até Ana responder; aprovado, ele passa sozinho para "Aprovado".');
    expect(txt).toContain("Fechar");
    expect(txt).not.toContain("Mandar pelo WhatsApp");
  });

  it("falhou: mostra o erro e deixa trocar por outro arquivo", async () => {
    mockGerar.mockRejectedValue(new Error("Pedido sem item personalizado — envie o mockup manualmente."));
    const r = await abrir();
    expect(porId(r, "aprovacao-erro")).toHaveLength(1);
    expect(porId(r, "aprovacao-mandar")[0].props.disabled).toBe(true);
    await act(async () => { porId(r, "aprovacao-outro-arquivo")[0].props.onPress(); });
    expect(porId(r, "aprovacao-outro")).toHaveLength(1);
  });
});

describe("a tela, em 390", () => {
  it("prévia primeiro, sem 'Para' nem botões de mentira, e o botão fixo embaixo", async () => {
    mockGerar.mockResolvedValue({ url: "https://r2/x.mp4", renderId: "rid1", contentHash: "h", itemName: "Camiseta", view: "turntable", isVideo: true });
    const r = await abrir(390);
    const txt = textos(r);
    expect(txt.indexOf("Como chega para Ana")).toBeLessThan(txt.indexOf("Gravar de novo"));
    expect(txt.indexOf("Gravar de novo")).toBeLessThan(txt.indexOf("Mensagem"));
    expect(txt).toContain("WhatsApp de Ana");
    expect(txt).toContain("✓ Vídeo pronto");
    expect(txt).not.toContain("Aprovar produção");
    expect(porId(r, "aprovacao-nome")).toHaveLength(0);
    expect(txt).toContain("Mandar pelo WhatsApp");
  });
});

describe("arquivos", () => {
  it("o servidor não muda: a rota e o vínculo do render continuam os mesmos", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "studio", "ApprovalRequestModal.tsx"), "utf8");
    expect(fonte).toContain("requestApprovalWithRender");
    expect(fonte).toContain("studioApi.requestApproval");
    expect(fonte).toContain("gerarRenderDoPedido");
  });
});
