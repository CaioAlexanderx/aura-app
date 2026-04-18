import { hexToName } from "@/utils/colorNames";

export function buildLabelName(name: string, size: string, color: string): string {
  if (!size && !color) return name;
  var parts = [name.length > 16 ? name.substring(0, 16).trim() + "..." : name];
  if (size) parts.push(size);
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) parts.push(hexToName(color));
  return parts.join(" | ");
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
};

type BuildOptions = {
  mode: "barcode" | "qr";
  storeName: string;
  showStoreName: boolean;
};

export function buildLabelHtml(items: LabelItem[], options: BuildOptions): string {
  var isQR = options.mode === "qr";
  var COLS = 3;
  var storeHeader = options.showStoreName && options.storeName ? esc(options.storeName.toUpperCase()) : "";
  var totalLabels = items.reduce(function(s, i) { return s + i.qty; }, 0);

  var firstCode = items[0]?.barcode || "";
  var numOnly = /^\d+$/.test(firstCode);
  var jsFormat = "CODE128";
  if (numOnly && firstCode.length === 13) jsFormat = "EAN13";
  else if (numOnly && firstCode.length === 8) jsFormat = "EAN8";
  else if (numOnly && firstCode.length === 12) jsFormat = "UPC";

  var cells: string[] = [];
  var labelIdx = 0;

  items.forEach(function(item) {
    var code = esc(item.barcode);
    var labelName = esc(buildLabelName(item.name, item.size, item.color));
    var price = "R$ " + item.price.toFixed(2).replace(".", ",");

    for (var q = 0; q < item.qty; q++) {
      if (isQR) {
        var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(item.barcode) + "&bgcolor=ffffff&color=000000&margin=1";
        cells.push(
          '<td class="cell"><div class="qr-inner"><img src="' + qrUrl + '" class="qr"><div class="info">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="name">' + labelName + '</div><div class="price">' + price + '</div></div></div></td>'
        );
      } else {
        cells.push(
          '<td class="cell"><div class="bc-inner">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="name">' + labelName + '</div>' +
          '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
          '<div class="price">' + price + '</div></div></td>'
        );
      }
      labelIdx++;
    }
  });

  while (cells.length % COLS !== 0) cells.push('<td class="cell"></td>');

  var rowsHtml = "";
  for (var r = 0; r < cells.length; r += COLS) {
    rowsHtml += "<tr>" + cells.slice(r, r + COLS).join("") + "</tr>\n";
  }
  var totalRows = cells.length / COLS;

  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Etiquetas Aura - ' + totalLabels + ' etiquetas</title>';
  if (!isQR) html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
  html += '<style>';
  html += '@page{margin:0;size:99mm 21mm}*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#000}';
  html += 'table{border-collapse:collapse;width:99mm;table-layout:fixed}tr{height:21mm;page-break-inside:avoid}';
  html += '.cell{width:33mm;height:21mm;overflow:hidden;vertical-align:top;padding:0}';
  html += '.bc-inner{padding:0.8mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;height:21mm;width:33mm;gap:0.3mm}';
  html += '.bc-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.bc-inner .name{font-size:5.5pt;font-weight:500;line-height:1.05;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000;max-height:4mm}';
  html += '.bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:31mm;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;padding:0.2mm 0}';
  html += '.bc-inner .bc-box svg{max-width:100%;max-height:100%;width:auto;height:auto;display:block}';
  html += '.bc-inner .price{font-size:9pt;font-weight:900;line-height:1;color:#000}';
  html += '.qr-inner{display:flex;flex-direction:row;align-items:center;padding:1mm 1.5mm;gap:1.5mm;height:21mm;width:33mm}';
  html += '.qr-inner .qr{width:17mm;height:17mm;flex-shrink:0;image-rendering:pixelated}';
  html += '.qr-inner .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.4mm;overflow:hidden}';
  html += '.qr-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.qr-inner .name{font-size:5.5pt;font-weight:600;line-height:1.15;max-height:9mm;overflow:hidden;word-break:break-word;color:#000}';
  html += '.qr-inner .price{font-size:8pt;font-weight:900;white-space:nowrap;color:#000;margin-top:0.4mm}';
  html += '.preview-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999;font-family:-apple-system,sans-serif}';
  html += '.preview-bar span{color:#a78bfa;font-size:12px}.preview-bar b{color:#e2e8f0;font-size:13px}';
  html += '.preview-bar button{background:#7c3aed;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}';
  html += '.preview-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;padding-bottom:80px}';
  html += '.preview-wrap table{border:1px dashed #ccc}.preview-wrap .cell{border:1px dashed #eee}';
  html += '@media print{.preview-bar{display:none!important}.preview-wrap{padding:0;gap:0}.preview-wrap table{border:none}.preview-wrap .cell{border:none}body{background:#fff}}';
  html += '</style></head><body>';
  html += '<div class="preview-wrap"><table>' + rowsHtml + '</table></div>';
  html += '<div class="preview-bar"><div><span>Etiqueta 33x21mm x 3 colunas (' + (isQR ? "QR Code" : "Codigo de barras") + ')</span><br>';
  html += '<b>' + totalLabels + ' etiqueta' + (totalLabels > 1 ? 's' : '') + ' (' + items.length + ' produto' + (items.length > 1 ? 's' : '') + ') em ' + totalRows + ' linha' + (totalRows > 1 ? 's' : '') + '</b></div>';
  html += '<button onclick="window.print()">Imprimir</button></div>';
  if (!isQR) {
    html += '<script>';
    html += 'document.querySelectorAll("[data-code]").forEach(function(el){';
    html += 'var code=el.getAttribute("data-code");';
    html += 'var opts={width:2,height:38,margin:2,displayValue:true,fontSize:13,textMargin:1,font:"Arial",fontOptions:"bold",background:"#ffffff",lineColor:"#000000"};';
    html += 'try{JsBarcode(el,code,Object.assign({},opts,{format:"' + jsFormat + '"}));}';
    html += 'catch(e){try{JsBarcode(el,code,Object.assign({},opts,{format:"CODE128"}));}catch(e2){console.error(e2);}}';
    html += '});';
    html += '</scr' + 'ipt>';
  }
  html += '</body></html>';
  return html;
}
