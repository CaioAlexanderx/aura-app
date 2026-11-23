// ============================================================
// QR Code do Pix na cobrança pelo WhatsApp (21/11/2026)
//
// O wa.me só leva texto. Para a cliente escanear, a imagem do QR precisa ir
// por outro caminho, e cada aparelho tem o seu:
//   - celular: o "compartilhar" do sistema com a imagem + o texto
//     (navigator.share com files, quando navigator.canShare({ files }));
//   - computador: a imagem vai para a área de transferência (ClipboardItem
//     image/png) e o wa.me abre com o texto; ela cola com Ctrl+V.
// Sem nenhum dos dois, o botão não aparece (modoDoQr → null).
//
// O código copia e cola (EMV) vai SEMPRE numa mensagem separada, só com ele:
// no celular o WhatsApp não deixa selecionar parte do texto; com a mensagem
// só com o código, a cliente segura e toca em Copiar.
// ============================================================

let QRCodeSvg: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  QRCodeSvg = require("qrcode-svg");
} catch {
  QRCodeSvg = null;
}

export type ModoDoQr = "compartilhar" | "copiar" | null;

export type AmbienteDoQr = {
  /** Toque como entrada principal (pointer: coarse). */
  celular: boolean;
  podeCompartilharArquivo: boolean;
  podeCopiarImagem: boolean;
};

/**
 * Celular compartilha; computador copia. Computador sem área de
 * transferência de imagem, mas com compartilhar (Windows/macOS), compartilha.
 */
export function modoDoQr(a: AmbienteDoQr): ModoDoQr {
  if (a.celular && a.podeCompartilharArquivo) return "compartilhar";
  if (a.podeCopiarImagem) return "copiar";
  if (a.podeCompartilharArquivo) return "compartilhar";
  return null;
}

/** O que este navegador sabe fazer. Fora da web, nada (o botão some). */
export function ambienteDoNavegador(arquivo?: File | null): AmbienteDoQr {
  const nada = { celular: false, podeCompartilharArquivo: false, podeCopiarImagem: false };
  if (typeof window === "undefined" || typeof navigator === "undefined") return nada;
  const nav: any = navigator;
  let celular = false;
  try { celular = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch { celular = false; }
  let podeCompartilharArquivo = false;
  try {
    podeCompartilharArquivo = !!arquivo && typeof nav.share === "function" && typeof nav.canShare === "function"
      && nav.canShare({ files: [arquivo] }) === true;
  } catch { podeCompartilharArquivo = false; }
  const podeCopiarImagem = typeof (window as any).ClipboardItem === "function"
    && !!nav.clipboard && typeof nav.clipboard.write === "function";
  return { celular, podeCompartilharArquivo, podeCopiarImagem };
}

/** SVG do QR do código Pix, com margem branca (leitor de banco pede). */
export function svgDoQrPix(emv: string, lado = 512): string | null {
  if (!QRCodeSvg || !emv) return null;
  try {
    const qr = new QRCodeSvg({
      content: emv, padding: 4, width: lado, height: lado, color: "#000000", background: "#ffffff",
      ecl: "M", join: true, xmlDeclaration: false, container: "svg", swap: true,
    });
    return String(qr.svg());
  } catch {
    return null;
  }
}

/** PNG do QR (canvas do navegador). null fora da web ou se algo falhar. */
export function pngDoQrPix(emv: string, lado = 512): Promise<Blob | null> {
  const svg = svgDoQrPix(emv, lado);
  if (!svg || typeof document === "undefined" || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = lado; canvas.height = lado;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, lado, lado);
          ctx.drawImage(img, 0, 0, lado, lado);
          canvas.toBlob((b) => resolve(b), "image/png");
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } catch { resolve(null); }
  });
}

export function arquivoDoQr(png: Blob): File | null {
  try { return new File([png], "pix-qr-code.png", { type: "image/png" }); } catch { return null; }
}

/** Celular: o compartilhar do sistema com a imagem e o texto. */
export async function compartilharQr(arquivo: File, texto: string): Promise<boolean> {
  try {
    await (navigator as any).share({ files: [arquivo], text: texto });
    return true;
  } catch {
    // Cancelou o compartilhar, ou o navegador recusou: nada saiu.
    return false;
  }
}

/** Computador: a imagem do QR vai para a área de transferência. */
export async function copiarQr(png: Blob): Promise<boolean> {
  try {
    const Item = (window as any).ClipboardItem;
    await (navigator as any).clipboard.write([new Item({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}

export function linkDoWhatsApp(telefone: string, texto: string): string {
  const limpo = String(telefone || "").replace(/\D/g, "");
  const num = limpo.startsWith("55") ? limpo : `55${limpo}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}
