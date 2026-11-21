// ============================================================
// Prévia do Cobrar: Pix copia e cola em outra mensagem e QR Code (21/11/2026).
//
// 1. sem código (loja sem chave Pix): nem a opção nem o QR aparecem;
// 2. com código: "Mandar também o Pix copia e cola em outra mensagem" vem
//    marcada; Enviar abre o wa.me com o texto e mostra o passo 2, que abre
//    o wa.me com SÓ o código;
// 3. desmarcada: Enviar fecha como sempre;
// 4. computador: "Enviar com QR Code" copia a imagem, abre o wa.me com o
//    texto e avisa "QR Code copiado…"; o código segue como 2ª mensagem;
// 5. celular: compartilha imagem + texto; cancelar o compartilhar não
//    muda nada.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Linking } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

var mockModo: any = null;
var mockCopiou = true;
var mockCompartilhou = true;
var mockCopiar = jest.fn(() => Promise.resolve(mockCopiou));
var mockCompartilhar = jest.fn((_f: any, _t: string) => Promise.resolve(mockCompartilhou));
jest.mock("@/utils/pixQrCompartilhar", () => {
  const real = jest.requireActual("@/utils/pixQrCompartilhar");
  return {
    ...real,
    pngDoQrPix: () => Promise.resolve(mockModo ? ({ size: 10 } as any) : null),
    arquivoDoQr: () => ({ name: "pix-qr-code.png" } as any),
    ambienteDoNavegador: () => ({
      celular: mockModo === "compartilhar",
      podeCompartilharArquivo: mockModo === "compartilhar",
      podeCopiarImagem: mockModo === "copiar",
    }),
    copiarQr: () => mockCopiar(),
    compartilharQr: (f: any, t: string) => mockCompartilhar(f, t),
  };
});

import { CobrancaPreviewModal } from "@/components/crediario/CobrancaPreviewModal";
import { MODELOS_DA_AURA } from "@/utils/crediarioMensagem";

const EMV = "00020126360014BR.GOV.BCB.PIX0114+55119876543215204000053039865406153.405802BR6304ABCD";
const DADOS = { nome: "Maria", loja: "Loja", valor: "R$ 153,40", vencimento: "10/11", parcela: "2/3", saldo: "R$ 153,40", pix: "chave" };

async function flush() {
  await act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
}
const porId = (tree: any, id: string) => tree.root.findAllByProps({ testID: id })[0];
const tem = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;
const urls = () => (Linking.openURL as jest.Mock).mock.calls.map((c: any[]) => decodeURIComponent(String(c[0]).split("text=")[1]));

function montar(extra: any = {}) {
  const onClose = jest.fn();
  const tree = renderer.create(
    <CobrancaPreviewModal visible recipientName="Maria" phone="11987654321" initialMessage="" onClose={onClose}
      modelos={MODELOS_DA_AURA} modelosDaAura dados={DADOS} situacao="a_vencer" {...extra} />
  );
  return { tree, onClose };
}

beforeEach(() => {
  jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true));
  mockModo = null; mockCopiou = true; mockCompartilhou = true;
  mockCopiar.mockClear(); mockCompartilhar.mockClear();
});
afterEach(() => { (Linking.openURL as jest.Mock).mockRestore(); });

describe("Pix copia e cola em outra mensagem", () => {
  it("sem código: nem a opção nem o QR", async () => {
    mockModo = "copiar";
    let r: any;
    await act(async () => { r = montar({ pixCopiaECola: null }); });
    await flush();
    expect(tem(r.tree, "cobranca-mandar-codigo")).toBe(false);
    expect(tem(r.tree, "cobranca-enviar-qr")).toBe(false);
    r.tree.unmount();
  });

  it("marcada por padrão; Enviar abre o texto e o passo 2 manda só o código", async () => {
    let r: any;
    await act(async () => { r = montar({ pixCopiaECola: EMV }); });
    await flush();
    const caixa = porId(r.tree, "cobranca-mandar-codigo");
    expect(caixa.props.accessibilityState).toEqual({ checked: true });
    expect(JSON.stringify(r.tree.toJSON())).toContain("Mandar também o Pix copia e cola em outra mensagem");

    const enviar = porId(r.tree, "cobranca-enviar-whatsapp");
    await act(async () => { enviar.props.onPress(); });
    expect(urls()[0]).toContain("Oi, Maria!");
    expect(r.onClose).not.toHaveBeenCalled();
    expect(tem(r.tree, "cobranca-passo-2")).toBe(true);
    expect(JSON.stringify(r.tree.toJSON())).toContain("Passo 2 · Enviar o código Pix");

    await act(async () => { porId(r.tree, "cobranca-enviar-codigo").props.onPress(); });
    expect(urls()[1]).toBe(EMV); // nada antes nem depois
    expect(r.onClose).toHaveBeenCalledTimes(1);
    r.tree.unmount();
  });

  it("desmarcada: Enviar fecha como sempre, sem passo 2", async () => {
    let r: any;
    await act(async () => { r = montar({ pixCopiaECola: EMV }); });
    await act(async () => { porId(r.tree, "cobranca-mandar-codigo").props.onPress(); });
    const enviar = porId(r.tree, "cobranca-enviar-whatsapp");
    await act(async () => { enviar.props.onPress(); });
    expect(urls()).toHaveLength(1);
    expect(r.onClose).toHaveBeenCalledTimes(1);
    r.tree.unmount();
  });
});

describe("Enviar com QR Code", () => {
  it("sem suporte no navegador: o botão não aparece", async () => {
    mockModo = null;
    let r: any;
    await act(async () => { r = montar({ pixCopiaECola: EMV }); });
    await flush();
    expect(tem(r.tree, "cobranca-enviar-qr")).toBe(false);
    r.tree.unmount();
  });

  it("computador: copia a imagem, abre o wa.me com o texto e avisa; o código vem no passo 2", async () => {
    mockModo = "copiar";
    let r: any;
    await act(async () => { r = montar({ pixCopiaECola: EMV }); });
    await flush();
    expect(tem(r.tree, "cobranca-enviar-qr")).toBe(true);
    await act(async () => { await porId(r.tree, "cobranca-enviar-qr").props.onPress(); });
    expect(mockCopiar).toHaveBeenCalledTimes(1);
    expect(urls()[0]).toContain("Oi, Maria!");
    expect(JSON.stringify(r.tree.toJSON())).toContain("QR Code copiado. No WhatsApp, cole com Ctrl+V antes de enviar.");
    await act(async () => { porId(r.tree, "cobranca-enviar-codigo").props.onPress(); });
    expect(urls()[1]).toBe(EMV);
    r.tree.unmount();
  });

  it("celular: compartilha imagem + texto; cancelar não muda nada", async () => {
    mockModo = "compartilhar";
    mockCompartilhou = false;
    let r: any;
    await act(async () => { r = montar({ pixCopiaECola: EMV }); });
    await flush();
    await act(async () => { await porId(r.tree, "cobranca-enviar-qr").props.onPress(); });
    expect(mockCompartilhar).toHaveBeenCalledTimes(1);
    expect(mockCompartilhar.mock.calls[0][1]).toContain("Oi, Maria!");
    expect(tem(r.tree, "cobranca-passo-2")).toBe(false);
    expect(urls()).toHaveLength(0);

    mockCompartilhou = true;
    await act(async () => { await porId(r.tree, "cobranca-enviar-qr").props.onPress(); });
    expect(tem(r.tree, "cobranca-passo-2")).toBe(true);
    expect(JSON.stringify(r.tree.toJSON())).not.toContain("QR Code copiado");
    r.tree.unmount();
  });
});
