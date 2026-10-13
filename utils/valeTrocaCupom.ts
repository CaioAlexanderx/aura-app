// ============================================================
// AURA. — Bloco "Vale-troca" no cupom impresso (13/10/2026)
//
// O cupom da venda é HTML gerado pelo backend (GET /print/receipt/:id/preview).
// O app o recebe como texto, entrega à janela de impressão — e é aqui, entre
// uma coisa e outra, que o bloco entra. Mudança só no app, no mesmo espírito do
// QR do Pix do próprio cupom (SVG inline, sem imagem remota: imagem de
// terceiro em documento de impressão segura o `load` quando a rede da loja
// dropa a requisição — ver backend/routes/print.js, 18/07).
//
// Onde entra: logo antes do rodapé ("Obrigado pela preferencia!"). Se o HTML
// não tiver o rodapé conhecido, antes de </body>; sem </body>, no fim. Se o
// backend um dia imprimir o bloco sozinho (marca data-vale-troca), não
// duplica. Estilo todo inline: não depende do CSS do cupom.
//
// SVG: qrcode-svg já é dependência (components/QrCode.tsx). Se a lib não
// carregar, o bloco NÃO sai — melhor cupom sem vale do que um vale sem QR.
// ============================================================
import {
  deveImprimirVale,
  lerValeTrocaLigado,
  montarCodigoDoVale,
  prazoDoVale,
  textoDoPrazoNoCupom,
} from "@/utils/valeTroca";

let QRCodeSvg: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  QRCodeSvg = require("qrcode-svg");
} catch {
  QRCodeSvg = null;
}

/** Marca do bloco no HTML: testes e a regra "não duplica". */
export const MARCA_DO_VALE = 'data-vale-troca="1"';

/** Lado de cada módulo do QR no papel. 0,875 mm = 7 pontos exatos na térmica
 *  de 203 dpi (8 pontos/mm): nenhum módulo sai mais largo que o vizinho. */
const MODULO_MM = 0.875;
/** Unidades do viewBox por módulo — inteiras, para o SVG não ter meio módulo. */
const MODULO_UNIDADES = 8;

function qrSvg(conteudo: string): { svg: string; larguraMm: number } | null {
  if (!QRCodeSvg || !conteudo) return null;
  try {
    const qr = new QRCodeSvg({
      content: conteudo,
      padding: 0,
      color: "#000000",
      background: "#ffffff",
      ecl: "M",
      container: "svg-viewbox",
      join: true,
      xmlDeclaration: false,
      // qrcode-svg desenha a matriz transposta (espelhada) por padrão; os
      // leitores de celular aguentam, o leitor de balcão nem sempre. swap
      // devolve a orientação do padrão ISO 18004 (conferido módulo a módulo
      // contra um segundo codificador independente).
      swap: true,
    });
    // O tamanho em módulos só se sabe depois de gerar a matriz.
    const modulos: number = qr.qrcode && qr.qrcode.modules ? qr.qrcode.modules.length : 0;
    if (!modulos) return null;
    qr.options.width = qr.options.height = modulos * MODULO_UNIDADES;
    const svg = String(qr.svg() || "");
    return svg ? { svg, larguraMm: Math.round(modulos * MODULO_MM * 100) / 100 } : null;
  } catch {
    return null;
  }
}

/** O bloco em si (HTML), ou "" se não deu para gerar o QR. */
export function blocoDoVale(saleId: string, prazoAte?: string): string {
  const qr = qrSvg(montarCodigoDoVale(saleId));
  if (!qr) return "";
  return (
    '<div ' + MARCA_DO_VALE + ' style="text-align:center;margin:6px 0;page-break-inside:avoid;break-inside:avoid">' +
      '<div style="font-weight:bold;font-size:12px;letter-spacing:1px">VALE-TROCA</div>' +
      '<div style="width:' + qr.larguraMm + 'mm;margin:4px auto">' +
        // viewBox + width:100% — o SVG ocupa a largura em mm acima, sem px fixo.
        qr.svg.replace("<svg ", '<svg style="display:block;width:100%;height:auto" shape-rendering="crispEdges" ') +
      '</div>' +
      '<div style="font-size:10px">' + textoDoPrazoNoCupom(prazoAte) + '</div>' +
      '<div style="border-top:1px dashed #000;margin:6px 0 0"></div>' +
    '</div>'
  );
}

/** Põe o bloco no HTML do cupom. Devolve o mesmo HTML se não for o caso. */
export function injetarValeNoCupom(html: string, saleId: string, prazoAte?: string): string {
  if (!html || !saleId) return html;
  if (html.indexOf("data-vale-troca") >= 0) return html; // já tem
  const bloco = blocoDoVale(saleId, prazoAte);
  if (!bloco) return html;
  const rodape = html.search(/<div[^>]*class=["'][^"']*\bfooter\b[^"']*["'][^>]*>/i);
  if (rodape >= 0) return html.slice(0, rodape) + bloco + html.slice(rodape);
  const fimDoCorpo = html.search(/<\/body>/i);
  if (fimDoCorpo >= 0) return html.slice(0, fimDoCorpo) + bloco + html.slice(fimDoCorpo);
  return html + bloco;
}

/**
 * Passo único para quem busca o cupom: aplica a regra (loja ligou? venda da
 * campanha? prazo em dia?) e injeta. `vendaEm` é o instante da venda.
 */
export function cupomComVale(
  html: string,
  p: {
    companyId: string | null | undefined;
    saleId: string;
    vendaEm: Date | string | number | null | undefined;
    hoje?: Date;
  },
): string {
  try {
    const ligado = lerValeTrocaLigado(p.companyId);
    if (!deveImprimirVale({ vendaEm: p.vendaEm, hoje: p.hoje, ligado })) return html;
    return injetarValeNoCupom(html, p.saleId, prazoDoVale(p.vendaEm) || undefined);
  } catch {
    // O vale é acessório: nunca pode impedir a impressão do cupom.
    return html;
  }
}
