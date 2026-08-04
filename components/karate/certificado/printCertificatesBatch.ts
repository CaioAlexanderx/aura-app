// printCertificatesBatch — impressão em massa de VÁRIOS certificados numa
// única janela/tarefa de impressão (F9.1). NÃO altera buildCertificateHtml.ts
// nem CertificatePreview.tsx: trata buildCertificateHtml() como caixa-preta
// e só recorta o <head> (fontes/CSS, compartilhado — todo o lote de um
// exame usa o mesmo template) e o conteúdo de <body> de cada certificado
// (a div .cert já vem dimensionada para A4 paisagem inteira, com o
// próprio @page embutido no CSS recortado), empilhando um por página com
// page-break-after.
//
// Por que NÃO reusar printCertificate() (CertificatePreview.tsx) num loop:
// abriria N janelas/diálogos de impressão — inaceitável para "impressão
// em massa". printCertificate segue existindo, intocado, para o download
// individual de UM certificado (mesmo uso de hoje na federação).
//
// document.write × blob URL: a armadilha já documentada no repo
// (StyleSheet/print race) é usar document.write + window.open síncrono —
// o conteúdo pode não estar pronto quando o print() dispara, e alguns
// bloqueadores de pop-up recusam write() num handle sobre o qual o app
// não tem controle de load. Aqui a janela navega para uma blob: URL de
// verdade (URL.createObjectURL) e o print só dispara no evento `load` da
// própria janela — mais robusto que o padrão document.write já usado no
// download individual (que não mexemos, por não ser nosso arquivo).
import { Platform } from "react-native";
import { buildCertificateHtml, CertData, CertTemplate } from "./buildCertificateHtml";

export interface BatchCertificateItem {
  data: CertData;
  template: CertTemplate;
}

function extractHead(html: string): string {
  const start = html.indexOf("<head>");
  const end = html.indexOf("</head>");
  if (start === -1 || end === -1) return "<head></head>";
  return html.slice(start, end + "</head>".length);
}

function extractBodyInner(html: string): string {
  const start = html.indexOf("<body>");
  const end = html.lastIndexOf("</body>");
  if (start === -1 || end === -1) return "";
  return html.slice(start + "<body>".length, end);
}

// HTML de UM documento com N páginas (uma por certificado). Exportado
// separadamente do print para permitir teste/preview sem abrir janela.
export function buildBatchCertificateHtml(items: BatchCertificateItem[], watermarkUrl?: string | null): string {
  if (!items.length) return "<!doctype html><html lang='pt-BR'><head></head><body></body></html>";
  const firstHtml = buildCertificateHtml(items[0].data, items[0].template, watermarkUrl);
  const head = extractHead(firstHtml);
  const pages = items
    .map((item, i) => {
      const html = i === 0 ? firstHtml : buildCertificateHtml(item.data, item.template, watermarkUrl);
      const inner = extractBodyInner(html);
      const isLast = i === items.length - 1;
      return `<div style="${isLast ? "" : "page-break-after: always;"}">${inner}</div>`;
    })
    .join("");
  return `<!doctype html><html lang="pt-BR">${head}<body>${pages}</body></html>`;
}

// Abre UMA janela com o lote inteiro e dispara UMA impressão (o navegador
// trata cada page-break como uma folha). watermarkUrl é opcional, mesmo
// parâmetro de buildCertificateHtml/printCertificate.
export function printCertificatesBatch(items: BatchCertificateItem[], watermarkUrl?: string | null): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  if (!items.length) return;
  const html = buildBatchCertificateHtml(items, watermarkUrl);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    return;
  }
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    // dá tempo do QR (qrserver.com) e dos selos/assinaturas carregarem
    setTimeout(() => {
      try { w.focus(); w.print(); } catch (e) { /* janela pode já ter sido fechada pelo usuário */ }
      // libera o blob um pouco depois do print (a janela já leu o conteúdo)
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 900);
  };
  try {
    w.addEventListener("load", doPrint);
  } catch (e) {
    // fallback defensivo: se addEventListener falhar por qualquer motivo
    // de cross-window, ainda tenta imprimir depois de um tempo fixo.
    setTimeout(doPrint, 1500);
  }
  // rede pode nunca disparar 'load' em algum navegador exótico — trava de segurança
  setTimeout(doPrint, 4000);
}

export default printCertificatesBatch;
