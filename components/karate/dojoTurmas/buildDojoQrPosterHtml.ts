// ============================================================
// buildDojoQrPosterHtml — cartaz de impressão do QR único do dojô (F9)
//
// Espelha o padrão de components/karate/carteirinha/buildCarteirinhaHtml.ts
// e components/karate/chaves/buildBracketHtml.ts: HTML standalone (sem
// depender de RN), botão flutuante "Imprimir" via window.print(),
// @media print escondendo os controles de tela.
//
// QR embutido INLINE como markup SVG (mesma lib qrcode-svg que
// components/QrCode.tsx já usa — SEM dependência nova, sem chamar
// api.qrserver.com): a janela de impressão não tem acesso a componentes
// React, então o SVG é serializado aqui como string e colado direto no
// HTML, nunca um <img src> apontando pra um serviço de terceiro.
// ============================================================

let QRCodeSvg: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  QRCodeSvg = require("qrcode-svg");
} catch {
  QRCodeSvg = null;
}

function qrSvgMarkup(value: string, size = 320): string {
  if (!QRCodeSvg || !value) return "";
  try {
    const qr = new QRCodeSvg({
      content: value,
      padding: 0,
      width: size,
      height: size,
      color: "#1a1611",
      background: "#ffffff",
      ecl: "M",
    });
    return qr.svg();
  } catch {
    return "";
  }
}

/** Gera o HTML standalone do cartaz do QR único do dojô, pronto pra abrir numa aba/imprimir. */
export function buildDojoQrPosterHtml(dojoName: string, token: string): string {
  const svg = qrSvgMarkup(token, 320);
  const safeName = String(dojoName || "Dojô").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>QR de presença — ${safeName}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    background: #fdf8f2; color: #1a1611;
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
  }
  .poster {
    width: 100%; max-width: 520px;
    border: 2px solid #1a1611; border-radius: 20px;
    padding: 40px 32px; text-align: center; background: #fff;
  }
  .eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #8a1f11; margin-bottom: 6px; }
  h1 { font-size: 24px; margin: 0 0 20px; }
  .qrbox { display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
  .qrbox svg { width: 280px; height: 280px; }
  .hint { font-size: 14px; line-height: 1.5; color: #4a4038; margin: 0; }
  .printBtn {
    position: fixed; top: 20px; right: 20px;
    padding: 10px 18px; border-radius: 10px; border: none;
    background: #1a1611; color: #fdf8f2; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .printBtn { display: none; }
    .poster { border: none; }
  }
</style>
</head>
<body>
  <button class="printBtn" onclick="window.print()">Imprimir</button>
  <div class="poster">
    <div class="eyebrow">Aura Karatê</div>
    <h1>${safeName}</h1>
    <div class="qrbox">${svg || "<p>QR indisponível — copie o código manualmente.</p>"}</div>
    <p class="hint">Aponte a câmera ou o leitor de QR aqui para registrar a presença na aula.</p>
  </div>
</body>
</html>`;
}
