// ============================================================
// QR Code do Pix na cobrança (21/11/2026) — a escolha do caminho.
//
// Celular compartilha (imagem + texto); computador copia a imagem e abre o
// wa.me; sem nenhum dos dois o botão some. O link do wa.me leva só o que
// recebe (o código Pix vai sozinho na segunda mensagem).
// ============================================================
import { linkDoWhatsApp, modoDoQr, svgDoQrPix } from "@/utils/pixQrCompartilhar";

describe("modoDoQr", () => {
  it("celular com compartilhar de arquivo: compartilhar", () => {
    expect(modoDoQr({ celular: true, podeCompartilharArquivo: true, podeCopiarImagem: true })).toBe("compartilhar");
  });
  it("computador com área de transferência de imagem: copiar (mesmo se tiver compartilhar)", () => {
    expect(modoDoQr({ celular: false, podeCompartilharArquivo: true, podeCopiarImagem: true })).toBe("copiar");
  });
  it("celular sem compartilhar, mas com área de transferência: copiar", () => {
    expect(modoDoQr({ celular: true, podeCompartilharArquivo: false, podeCopiarImagem: true })).toBe("copiar");
  });
  it("computador só com compartilhar: compartilhar", () => {
    expect(modoDoQr({ celular: false, podeCompartilharArquivo: true, podeCopiarImagem: false })).toBe("compartilhar");
  });
  it("sem nenhum dos dois: o botão não aparece", () => {
    expect(modoDoQr({ celular: true, podeCompartilharArquivo: false, podeCopiarImagem: false })).toBeNull();
  });
});

describe("linkDoWhatsApp", () => {
  it("só o código, sem nada antes nem depois", () => {
    const emv = "00020126360014BR.GOV.BCB.PIX0114+5511987654321520400005303986540510.005802BR5913LOJA6009SAO PAULO62070503***6304ABCD";
    const url = linkDoWhatsApp("(11) 98765-4321", emv);
    expect(url).toBe("https://wa.me/5511987654321?text=" + encodeURIComponent(emv));
    expect(decodeURIComponent(url.split("text=")[1])).toBe(emv);
  });
});

describe("svgDoQrPix", () => {
  it("gera um SVG para o código e nada para vazio", () => {
    expect(svgDoQrPix("000201abc")).toMatch(/^<svg/);
    expect(svgDoQrPix("")).toBeNull();
  });
});
