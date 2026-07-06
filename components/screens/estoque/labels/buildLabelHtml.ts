// ============================================================================
// AURA. — Gerador HTML de etiquetas (multi-tamanho via LABEL_SIZE_PRESETS)
//
// ╔════════════════════════════════════════════════════════════════════════╗
// ║                    *** DESIGN LOCKED — DO NOT MODIFY ***               ║
// ║                                                                        ║
// ║  Aprovado pela Finesse (cliente piloto varejo moda) em 23/04/2026.     ║
// ║  Esta funcao e CRITICA: etiqueta quebrada = POS nao le = venda perdida ║
// ║                                                                        ║
// ║  07/2026: parametrizado por preset (LABEL_SIZE_PRESETS) pra suportar   ║
// ║  novos tamanhos de etiqueta (ex: 30x25mm) sem tocar no preset "99x21"  ║
// ║  usado pela Finesse. O preset "99x21" DEVE gerar exatamente o mesmo    ║
// ║  HTML de antes — qualquer numero novo do preset "99x21" e regressao.   ║
// ║                                                                        ║
// ║  Zonas LOCKED (nao alterar sem teste real de scanner):                 ║
// ║    1. BARCODE_OPTS            — parametros do JsBarcode                ║
// ║    2. SVG inline              — o <svg id="bc-N" data-code="...">      ║
// ║    3. .bc-inner .bc-box       — container do codigo                    ║
// ║    4. Numeros do preset "99x21" em LABEL_SIZE_PRESETS                  ║
// ║                                                                        ║
// ║  Zonas LIVRES (pode mudar):                                            ║
// ║    - Textos (nome, preco, storeHeader)                                 ║
// ║    - Fonte, cor, peso do texto (nao do barcode)                        ║
// ║    - Margem interna, gap                                               ║
// ║    - Ordem dos elementos de texto (nome/preco/store)                   ║
// ║    - QR code (modo alternativo, nao critico pra POS fisico)            ║
// ║    - Preview bar / guia visual pre-impressao (livre, so tela)          ║
// ║                                                                        ║
// ║  Se ALTERAR BARCODE_OPTS: imprimir UMA etiqueta, escanear com pistola, ║
// ║  confirmar leitura em EAN13 ANTES de fazer deploy.                     ║
// ╚════════════════════════════════════════════════════════════════════════╝
// ============================================================================

import { hexToName } from "@/utils/colorNames";

// ----- LOCKED: parametros do barcode (validados por Finesse) -----
// Alterar isso quebra a leitura do scanner. Testar SEMPRE com POS fisico.
const BARCODE_OPTS = {
  width:        1.0,      // largura de cada barra em px (NAO mudar)
  height:       24,       // altura do barcode em px (NAO mudar)
  margin:       1,        // margem interna do canvas
  displayValue: true,     // mostrar digitos embaixo
  fontSize:     7,        // fonte dos digitos (NAO aumentar)
  textMargin:   0,        // espaco entre barras e digitos
  font:         "Arial",
  fontOptions:  "bold",
  background:   "#ffffff",
  lineColor:    "#000000",
};
// -----------------------------------------------------------------

// ----- Validacao de codigo de barras -----
// Placeholders conhecidos que nao devem virar etiqueta real.
const BARCODE_PLACEHOLDERS = new Set([
  "", "...", "....", ".....", "-", "--", "---",
  "0", "00", "000", "N/A", "n/a", "NA", "na",
  "sem codigo", "SEM CODIGO", "null", "undefined", "?", "??", "???",
]);
const BARCODE_MIN_LENGTH = 4;

export function isValidBarcode(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = String(code).trim();
  if (trimmed.length < BARCODE_MIN_LENGTH) return false;
  if (BARCODE_PLACEHOLDERS.has(trimmed)) return false;
  if (BARCODE_PLACEHOLDERS.has(trimmed.toLowerCase())) return false;
  if (/^[.\-\s_]+$/.test(trimmed)) return false;
  if (/^(.)\1+$/.test(trimmed)) return false;
  return true;
}

export type InvalidCodeItem = { name: string; code: string; reason: string };

export function validateLabelItems(items: Array<{ name: string; barcode: string }>): InvalidCodeItem[] {
  const invalid: InvalidCodeItem[] = [];
  items.forEach(function(item) {
    const code = String(item.barcode || "").trim();
    if (!code) { invalid.push({ name: item.name, code: "(vazio)", reason: "Sem codigo cadastrado" }); return; }
    if (code.length < BARCODE_MIN_LENGTH) { invalid.push({ name: item.name, code: code, reason: "Codigo muito curto (minimo " + BARCODE_MIN_LENGTH + " caracteres)" }); return; }
    if (BARCODE_PLACEHOLDERS.has(code) || BARCODE_PLACEHOLDERS.has(code.toLowerCase())) { invalid.push({ name: item.name, code: code, reason: "Codigo placeholder — substitua por SKU real" }); return; }
    if (/^[.\-\s_]+$/.test(code)) { invalid.push({ name: item.name, code: code, reason: "Codigo invalido (so pontos/tracos)" }); return; }
    if (/^(.)\1+$/.test(code)) { invalid.push({ name: item.name, code: code, reason: "Codigo repetido (ex: 0000)" }); return; }
  });
  return invalid;
}
// -----------------------------------------------------------------

// ----- EAN-13 utilities -----
// Calcula o digito verificador EAN-13 a partir dos 12 primeiros digitos.
function ean13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// Valida se um codigo e um EAN-13 legitimo (13 digitos numericos + check digit correto).
export function isValidEAN13(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = String(code).trim();
  if (!/^\d{13}$/.test(trimmed)) return false;
  return ean13CheckDigit(trimmed.slice(0, 12)) === parseInt(trimmed[12]);
}

// Gera um EAN-13 deterministico para uso interno a partir de qualquer seed.
// Prefixo "200" = reservado GS1 para uso interno (sem registro necessario).
// Mesmo seed sempre gera mesmo codigo — consistencia entre sessoes de impressao.
export function generateEAN13(seed: string): string {
  const s = String(seed || "").trim() || "aura_internal";
  // djb2 hash (32-bit unsigned)
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  const PREFIX = "200"; // 3 digitos
  const digits9 = String(h).padStart(10, "0").slice(-9); // 9 digitos do hash
  const base12 = PREFIX + digits9; // 12 digitos
  const check = ean13CheckDigit(base12);
  return base12 + String(check); // 13 digitos
}
// ----------------------------

// Monta o texto da etiqueta no formato "nome - tamanho - cor".
// ZONA LIVRE (so texto): separador e composicao podem mudar sem teste de pistola.
// O nome e truncado em 16 chars para abrir espaco a tamanho/cor; o CSS .name
// (nowrap + ellipsis + max-height:4mm) garante que excesso seja cortado SEM
// redimensionar a etiqueta. A cor aceita hex (#RRGGBB -> nome PT via hexToName)
// ou um valor ja nomeado (ex.: "Azul", "Vinho").
export function buildLabelName(name: string, size: string, color: string): string {
  if (!size && !color) return name;
  const parts = [name.length > 16 ? name.substring(0, 16).trim() + "..." : name];
  if (size) parts.push(size);
  if (color) {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) parts.push(hexToName(color));
    else parts.push(String(color).trim());
  }
  return parts.join(" - ");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type LabelItem = {
  name: string;
  price: number;
  barcode: string;
  size: string;
  color: string;
  qty: number;
  // 08/06/2026: ids para persistir o EAN-13 gerado no cadastro (produto/variante).
  productId?: string;
  variantId?: string;
};

// ----- Presets de tamanho de etiqueta -----
// "99x21" e o formato original (Finesse, LOCKED, validado com scanner fisico) —
// rolo 3-across com etiquetas COLADAS (sem vao): pageWidth 99 = 3x33.
//
// "30x25" (rolo da Eryca): 3-across COM vao de 2mm entre colunas E entre linhas
// (medido no rolo fisico). Por isso a geometria e diferente:
//   - pageWidthMm 94  = 3x30 + 2 vaos de 2mm  -> alinha as 3 colunas
//   - pageHeightMm 27 = 25 (label) + 2mm de vao vertical = PASSO de uma linha
//   - colGapMm/rowGapMm 2 -> insere colunas espacadoras e sobra 2mm embaixo
// A pagina de impressao passa a ser o PASSO de uma linha; o conteudo da
// etiqueta ocupa o topo 25mm de cada linha (o resto e o vao). O layout INTERNO
// da celula (fonte, barcode, preco) NAO muda — so a geometria de encaixe.
//
// Um preset SEM colGapMm/rowGapMm (como "99x21") se comporta como antes
// (vao 0), entao presets colados continuam byte-identicos.
// NUNCA mudar os numeros do preset "99x21".
export type LabelSizeKey = "99x21" | "30x25";

export const LABEL_SIZE_PRESETS: Record<LabelSizeKey, {
  pageWidthMm: number;
  pageHeightMm: number;
  cols: number;
  cellWidthMm: number;
  cellHeightMm: number;
  colGapMm?: number;
  rowGapMm?: number;
  uiLabel: string;
}> = {
  "99x21": { pageWidthMm: 99, pageHeightMm: 21, cols: 3, cellWidthMm: 33, cellHeightMm: 21, uiLabel: "33x21mm (3 colunas)" },
  "30x25": { pageWidthMm: 94, pageHeightMm: 27, cols: 3, cellWidthMm: 30, cellHeightMm: 25, colGapMm: 2, rowGapMm: 2, uiLabel: "30x25mm (3 colunas)" },
};
export const DEFAULT_LABEL_SIZE: LabelSizeKey = "99x21";
// -------------------------------------------

type BuildOptions = {
  mode: "barcode" | "qr";
  storeName: string;
  showStoreName: boolean;
  labelSize?: LabelSizeKey;
};

export function buildLabelHtml(items: LabelItem[], options: BuildOptions): string {
  const isQR = options.mode === "qr";
  const preset = LABEL_SIZE_PRESETS[options.labelSize || DEFAULT_LABEL_SIZE];
  const COLS = preset.cols;
  // Vao horizontal entre colunas (0 = etiquetas coladas, comportamento original).
  const colGapMm = preset.colGapMm || 0;
  const storeHeader = options.showStoreName && options.storeName ? esc(options.storeName.toUpperCase()) : "";
  const totalLabels = items.reduce((s, i) => s + i.qty, 0);

  const cells: string[] = [];
  let labelIdx = 0;

  items.forEach(function (item) {
    const code = esc(item.barcode);
    const labelName = esc(buildLabelName(item.name, item.size, item.color));
    const price = "R$ " + item.price.toFixed(2).replace(".", ",");

    for (let q = 0; q < item.qty; q++) {
      if (isQR) {
        const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
          encodeURIComponent(item.barcode) + "&bgcolor=ffffff&color=000000&margin=1";
        cells.push(
          '<td class="cell"><div class="qr-inner"><img src="' + qrUrl + '" class="qr"><div class="info">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="name">' + labelName + '</div><div class="price">' + price + '</div></div></div></td>'
        );
      } else {
        // ===== LOCKED STRUCTURE =====
        // Ordem: store -> bc-box -> name -> price
        // NAO mudar as classes nem os parametros do SVG/JsBarcode.
        cells.push(
          '<td class="cell"><div class="bc-inner">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
          '<div class="name">' + labelName + '</div>' +
          '<div class="price">' + price + '</div></div></td>'
        );
        // ============================
      }
      labelIdx++;
    }
  });

  while (cells.length % COLS !== 0) cells.push('<td class="cell"></td>');

  // Insere colunas espacadoras (vao) entre as celulas de cada linha. Com
  // colGapMm=0 (ex: preset 99x21) o separador e vazio -> join identico ao antigo.
  const colSep = colGapMm > 0 ? '<td class="colgap"></td>' : "";
  let rowsHtml = "";
  for (let r = 0; r < cells.length; r += COLS) {
    rowsHtml += "<tr>" + cells.slice(r, r + COLS).join(colSep) + "</tr>\n";
  }
  const totalRows = cells.length / COLS;

  let html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Etiquetas Aura - ' + totalLabels + ' etiquetas</title>';
  if (!isQR) html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
  // Valores derivados do preset. Pro preset default "99x21" estes calculos
  // reproduzem exatamente os numeros LOCKED originais (33-3=30, min(33,21)-4=17).
  const bcBoxMaxWidthMm = preset.cellWidthMm - 3;
  const qrSizeMm = Math.min(preset.cellWidthMm, preset.cellHeightMm) - 4;

  html += '<style>';
  // ===== LOCKED CSS — dimensoes da etiqueta (nao mudar pro preset 99x21) =====
  // @page e tr usam pageHeightMm = PASSO da linha (label + vao vertical). Pro
  // 99x21 (sem vao) pageHeightMm == cellHeightMm, entao sai identico ao antigo.
  html += '@page{margin:0;size:' + preset.pageWidthMm + 'mm ' + preset.pageHeightMm + 'mm}*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#000}';
  html += 'table{border-collapse:collapse;width:' + preset.pageWidthMm + 'mm;table-layout:fixed}tr{height:' + preset.pageHeightMm + 'mm;page-break-inside:avoid}';
  html += '.cell{width:' + preset.cellWidthMm + 'mm;height:' + preset.cellHeightMm + 'mm;overflow:hidden;vertical-align:top;padding:0}';
  // Coluna espacadora = vao horizontal entre etiquetas (so quando colGapMm>0).
  if (colGapMm > 0) html += '.colgap{width:' + colGapMm + 'mm;height:' + preset.cellHeightMm + 'mm;padding:0;border:none;background:transparent}';
  // ============================================================

  // LOCKED: layout interno da celula barcode (padrao Finesse)
  // Ordem visual: store (topo) → barcode → nome → preco (fundo)
  html += '.bc-inner{padding:0.8mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;height:' + preset.cellHeightMm + 'mm;width:' + preset.cellWidthMm + 'mm;gap:0.3mm}';
  html += '.bc-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:' + bcBoxMaxWidthMm + 'mm;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;padding:0.2mm 0}';
  html += '.bc-inner .bc-box svg{max-width:100%;max-height:100%;width:auto;height:auto;display:block}';
  html += '.bc-inner .name{font-size:5.5pt;font-weight:500;line-height:1.05;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000;max-height:4mm}';
  html += '.bc-inner .price{font-size:9pt;font-weight:900;line-height:1;color:#000}';

  // QR layout
  html += '.qr-inner{display:flex;flex-direction:row;align-items:center;padding:1mm 1.5mm;gap:1.5mm;height:' + preset.cellHeightMm + 'mm;width:' + preset.cellWidthMm + 'mm}';
  html += '.qr-inner .qr{width:' + qrSizeMm + 'mm;height:' + qrSizeMm + 'mm;flex-shrink:0;image-rendering:pixelated}';
  html += '.qr-inner .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.4mm;overflow:hidden}';
  html += '.qr-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.qr-inner .name{font-size:5.5pt;font-weight:600;line-height:1.15;max-height:9mm;overflow:hidden;word-break:break-word;color:#000}';
  html += '.qr-inner .price{font-size:8pt;font-weight:900;white-space:nowrap;color:#000;margin-top:0.4mm}';

  // ===== GUIA VISUAL PRE-IMPRESSAO (livre, so tela) =====
  html += '.setup-guide{position:fixed;top:0;left:0;right:0;background:#fef2f2;border-bottom:3px solid #dc2626;padding:14px 20px;z-index:1000;font-family:-apple-system,"Segoe UI",sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.1)}';
  html += '.setup-guide h2{color:#991b1b;font-size:14px;font-weight:800;margin-bottom:8px;display:flex;align-items:center;gap:8px}';
  html += '.setup-guide h2::before{content:"⚠️";font-size:18px}';
  html += '.setup-guide .steps{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:10px}';
  html += '.setup-guide .step{display:flex;align-items:center;gap:8px;font-size:12px;color:#7f1d1d;font-weight:600}';
  html += '.setup-guide .step b{background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-weight:800;letter-spacing:0.3px}';
  html += '.setup-guide .confirm-row{display:flex;align-items:center;gap:10px;padding-top:8px;border-top:1px dashed #fca5a5}';
  html += '.setup-guide .confirm-row label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#991b1b;font-weight:700}';
  html += '.setup-guide .confirm-row input[type=checkbox]{width:18px;height:18px;accent-color:#dc2626;cursor:pointer}';
  html += '.setup-guide.ready{background:#f0fdf4;border-bottom-color:#16a34a}';
  html += '.setup-guide.ready h2{color:#166534}.setup-guide.ready h2::before{content:"✅"}';
  html += '.setup-guide.ready .step{color:#14532d}.setup-guide.ready .step b{background:#16a34a}';
  html += '.setup-guide.ready .confirm-row{border-top-color:#86efac}.setup-guide.ready .confirm-row label{color:#166534}';
  html += '.preview-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999;font-family:-apple-system,sans-serif}';
  html += '.preview-bar span{color:#a78bfa;font-size:12px}.preview-bar b{color:#e2e8f0;font-size:13px}';
  html += '.preview-bar button{background:#7c3aed;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}';
  html += '.preview-bar button:disabled{background:#4b5563;color:#9ca3af;cursor:not-allowed;opacity:0.7}';
  html += '.preview-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;padding-top:170px;padding-bottom:80px}';
  html += '.preview-wrap table{border:1px dashed #ccc}.preview-wrap .cell{border:1px dashed #eee}.preview-wrap .colgap{border:none}';
  html += '@media print{.setup-guide{display:none!important}.preview-bar{display:none!important}.preview-wrap{padding:0;gap:0}.preview-wrap table{border:none}.preview-wrap .cell{border:none}body{background:#fff}}';
  html += '</style></head><body>';

  html += '<div class="setup-guide" id="setupGuide">';
  html += '<h2>Antes de imprimir — confira o setup da impressora</h2>';
  html += '<div class="steps">';
  html += '<div class="step"><b>1</b> Papel: <b>' + preset.pageWidthMm + ' x ' + preset.pageHeightMm + ' mm</b> (bobina ' + preset.cols + ' etiqueta' + (preset.cols > 1 ? 's' : '') + ')</div>';
  html += '<div class="step"><b>2</b> Margens: <b>Nenhuma</b></div>';
  html += '<div class="step"><b>3</b> Escala: <b>100%</b> (não usar "Ajustar à página")</div>';
  html += '<div class="step"><b>4</b> Cabeçalho/Rodapé: <b>Desligados</b></div>';
  html += '</div>';
  html += '<div class="confirm-row"><label><input type="checkbox" id="confirmSetup"> Confirmo que o setup acima está correto</label></div>';
  html += '</div>';

  html += '<div class="preview-wrap"><table>' + rowsHtml + '</table></div>';
  html += '<div class="preview-bar"><div><span>Etiqueta ' + preset.cellWidthMm + 'x' + preset.cellHeightMm + 'mm x ' + preset.cols + ' coluna' + (preset.cols > 1 ? 's' : '') + ' (' + (isQR ? "QR Code" : "EAN-13") + ')</span><br>';
  html += '<b>' + totalLabels + ' etiqueta' + (totalLabels > 1 ? 's' : '') + ' (' + items.length + ' produto' + (items.length > 1 ? 's' : '') + ') em ' + totalRows + ' linha' + (totalRows > 1 ? 's' : '') + '</b></div>';
  html += '<button id="printBtn" disabled onclick="window.print()">Marque a confirmação acima</button></div>';

  html += '<script>(function(){';
  html += 'var cb=document.getElementById("confirmSetup");';
  html += 'var btn=document.getElementById("printBtn");';
  html += 'var guide=document.getElementById("setupGuide");';
  html += 'cb.addEventListener("change",function(){';
  html += 'if(cb.checked){btn.disabled=false;btn.textContent="Imprimir";guide.classList.add("ready");}';
  html += 'else{btn.disabled=true;btn.textContent="Marque a confirmação acima";guide.classList.remove("ready");}';
  html += '});';
  html += '})();</scr' + 'ipt>';

  if (!isQR) {
    // ===== LOCKED — parametros do JsBarcode =====
    // Padrao: EAN13. Se falhar (ex: codigo invalido), fallback para CODE128.
    html += '<script>';
    html += 'document.querySelectorAll("[data-code]").forEach(function(el){';
    html += 'var code=el.getAttribute("data-code");';
    html += 'var opts={width:' + BARCODE_OPTS.width +
            ',height:' + BARCODE_OPTS.height +
            ',margin:' + BARCODE_OPTS.margin +
            ',displayValue:' + BARCODE_OPTS.displayValue +
            ',fontSize:' + BARCODE_OPTS.fontSize +
            ',textMargin:' + BARCODE_OPTS.textMargin +
            ',font:"' + BARCODE_OPTS.font + '"' +
            ',fontOptions:"' + BARCODE_OPTS.fontOptions + '"' +
            ',background:"' + BARCODE_OPTS.background + '"' +
            ',lineColor:"' + BARCODE_OPTS.lineColor + '"};';
    html += 'try{JsBarcode(el,code,Object.assign({},opts,{format:"EAN13"}));}';
    html += 'catch(e){try{JsBarcode(el,code,Object.assign({},opts,{format:"CODE128"}));}catch(e2){console.error(e2);}}';
    html += '});';
    html += '</scr' + 'ipt>';
    // =============================================
  }
  html += '</body></html>';
  return html;
}
