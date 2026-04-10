// ============================================================
// AURA. — Barcode/QR Code generation utilities (pure JS, no deps)
// ============================================================

export type LabelPreset = {
  id: string; name: string; width: number; height: number; columns: number; gap: number;
};

export const LABEL_PRESETS: LabelPreset[] = [
  { id: '33x21', name: '33 x 21 mm (A4 – 65 por folha)', width: 33, height: 21, columns: 3, gap: 1 },
  { id: '30x25', name: '30 x 25 mm (Argox, Elgin)', width: 30, height: 25, columns: 3, gap: 2 },
  { id: '40x25', name: '40 x 25 mm (Zebra GC420)', width: 40, height: 25, columns: 2, gap: 3 },
  { id: '40x40', name: '40 x 40 mm (QR Code)', width: 40, height: 40, columns: 2, gap: 3 },
  { id: '50x30', name: '50 x 30 mm (Zebra ZD220)', width: 50, height: 30, columns: 2, gap: 3 },
  { id: '60x40', name: '60 x 40 mm (Bematech)', width: 60, height: 40, columns: 3, gap: 3 },
  { id: '100x30', name: '100 x 30 mm (Gondola)', width: 100, height: 30, columns: 2, gap: 2 },
  { id: 'a4', name: 'A4 (Folha comum)', width: 70, height: 36, columns: 3, gap: 2 },
];

export function getSavedPreset(): string {
  try { if (typeof localStorage === 'undefined') return '40x25'; return localStorage.getItem('aura_label_preset') || '40x25'; } catch { return '40x25'; }
}
export function savePreset(id: string) {
  try { if (typeof localStorage === 'undefined') return; localStorage.setItem('aura_label_preset', id); } catch {}
}
export function getPreset(id: string): LabelPreset {
  return LABEL_PRESETS.find(p => p.id === id) || LABEL_PRESETS[2];
}

// CODE-128 Barcode Generator
const CODE128_START_B = 104;
const CODE128_STOP = 106;
const CODE128_PATTERNS: number[][] = [[2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],[2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],[2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],[2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],[2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],[2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],[3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],[1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],[2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],[1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],[1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,3,1,1,1,2]];

function encodeCode128(text: string): boolean[] {
  const values: number[] = [CODE128_START_B];
  for (let i = 0; i < text.length; i++) values.push(text.charCodeAt(i) - 32);
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  values.push(checksum % 103);
  values.push(CODE128_STOP);
  const bars: boolean[] = [];
  for (const val of values) {
    const pattern = CODE128_PATTERNS[val];
    let isBar = true;
    for (const width of pattern) { for (let w = 0; w < width; w++) bars.push(isBar); isBar = !isBar; }
  }
  return bars;
}

export function generateBarcodeSVG(text: string, width = 280, height = 80): string {
  const bars = encodeCode128(text);
  const barWidth = width / bars.length;
  let rects = '';
  for (let i = 0; i < bars.length; i++) {
    if (bars[i]) rects += `<rect x="${i * barWidth}" y="0" width="${barWidth + 0.5}" height="${height - 20}" fill="#000"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fff"/>${rects}<text x="${width/2}" y="${height - 4}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000">${text}</text></svg>`;
}

// fix: usar PNG (sem format=svg) — Image component nao renderiza SVG externo
export function generateQRSVGUrl(text: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=4`;
}

export function generateQRDataURL(text: string, size = 200): string {
  return generateQRSVGUrl(text, size);
}

export function generateProductCode(prefix = 'AURA'): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${prefix}-${ts}${rand}`;
}

export function generatePrintHTML(
  products: { name: string; code: string; price: number; type: 'barcode' | 'qr' }[],
  presetId?: string
): string {
  const preset = getPreset(presetId || getSavedPreset());
  const { width, height, columns, gap } = preset;
  const isQR = products[0]?.type === 'qr';

  // Calcula alturas internas com base no tamanho real da etiqueta
  // Reserva espaco para nome (2.8mm) + preco (3mm) + padding vertical (2mm)
  const reservedMm = isQR ? 7 : 9; // barcode precisa de mais espaço para texto do codigo
  const codeHmm = Math.max(4, height - reservedMm);
  const codeHpx = Math.round(codeHmm * 3.78); // 1mm ~= 3.78px

  // Tamanho da fonte proporcional ao tamanho da etiqueta
  const nameFontPx = Math.max(6, Math.min(10, Math.round(width / 5)));
  const priceFontPx = Math.max(7, Math.min(13, Math.round(width / 4)));
  const codeFontPx = Math.max(5, Math.min(9, Math.round(width / 5.5)));

  // Padding interno minimo para nao cortar nas bordas
  const padMm = Math.max(0.8, gap * 0.4);

  const labels = products.map(p => {
    const visual = p.type === 'barcode'
      ? generateBarcodeSVG(p.code, width * 3.78, codeHpx)
      : `<img src="${generateQRSVGUrl(p.code, codeHpx * 2)}" style="display:block;margin:0 auto;width:${codeHmm}mm;height:${codeHmm}mm;max-width:100%"/>`;
    return `<div class="label">${visual}<div class="name">${p.name}</div><div class="price">R$ ${p.price.toFixed(2).replace('.',',')}</div></div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas Aura</title><style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:auto;margin:${gap}mm}
body{font-family:system-ui,-apple-system,sans-serif;padding:0}
.preset-info{padding:4mm;font-size:9px;color:#888;text-align:center;border-bottom:1px solid #eee;margin-bottom:${gap}mm}
.grid{
  display:grid;
  grid-template-columns:repeat(${columns},${width}mm);
  gap:${gap}mm;
  justify-content:center;
  align-items:start
}
.label{
  width:${width}mm;
  height:${height}mm;
  border:0.3pt solid #ccc;
  border-radius:1mm;
  padding:${padMm}mm;
  text-align:center;
  overflow:visible;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  page-break-inside:avoid;
  break-inside:avoid
}
.label svg{
  width:100%;
  height:${codeHmm}mm;
  max-height:${codeHmm}mm;
  display:block
}
.name{
  font-size:${nameFontPx}px;
  font-weight:600;
  margin-top:0.5mm;
  width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  line-height:1.2;
  text-align:center
}
.price{
  font-size:${priceFontPx}px;
  font-weight:800;
  margin-top:0.3mm;
  line-height:1.2;
  text-align:center
}
@media print{
  .preset-info{display:none}
  .label{border:0.2pt solid #999;overflow:visible}
}
</style></head><body>
<div class="preset-info">Preset: ${preset.name} | ${products.length} etiqueta(s) | Aura.</div>
<div class="grid">${labels}</div>
<script>window.print();</script>
</body></html>`;
}
