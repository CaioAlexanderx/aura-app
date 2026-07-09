// buildCertificateHtml — motor de certificado (Fase 3).
// Composição dinâmica: layout selecionável (A..E) + selos configuráveis (PNG) +
// texto padrão OU personalizado (tags) + assinaturas + QR de verificação.
// Espelha o padrão do buildCarteirinhaHtml (HTML standalone p/ impressão/preview).

export type CertLayout = "A" | "B" | "C" | "D" | "E";
export type CertFont = "classica" | "imponente" | "elegante" | "sofisticada" | "tradicional";

export interface CertSeal { label: string; image_url: string | null; }
export interface CertSignatory { name: string; role?: string | null; signature_url?: string | null; }

export interface CertTemplate {
  layout: CertLayout;
  title?: string;               // default "CERTIFICADO"
  body_mode?: "default" | "custom";
  body_text?: string | null;    // usado quando custom; aceita tags {nome} etc.
  seals?: CertSeal[];           // FPKT + opcionais (JKA-SP, CEPEUSP, ...)
  font?: CertFont;              // preset tipográfico (default "classica")
  text_scale?: number;          // multiplicador de tamanho do texto (default 1)
  auto_fit?: boolean;           // ajusta tamanho ao comprimento do texto (preenche área)
}

// Presets tipográficos: par (título / corpo). "import" carrega a webfont quando necessário.
export interface CertFontDef { label: string; heading: string; body: string; import?: string; }
export const CERT_FONTS: Record<CertFont, CertFontDef> = {
  classica: {
    label: "Clássica",
    heading: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif',
  },
  imponente: {
    label: "Imponente",
    heading: '"Cinzel", Georgia, serif',
    body: '"EB Garamond", Georgia, serif',
    import: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap",
  },
  elegante: {
    label: "Elegante",
    heading: '"Playfair Display", Georgia, serif',
    body: '"Lato", "Helvetica Neue", Arial, sans-serif',
    import: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Lato:ital,wght@0,400;0,700;1,400&display=swap",
  },
  sofisticada: {
    label: "Sofisticada",
    heading: '"Cormorant Garamond", Georgia, serif',
    body: '"Cormorant Garamond", Georgia, serif',
    import: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap",
  },
  tradicional: {
    label: "Tradicional",
    heading: '"EB Garamond", Georgia, serif',
    body: '"EB Garamond", Georgia, serif',
    import: "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  },
};

// Fator de tamanho final. auto_fit: cresce quando o texto é curto (preenche a área).
function computeScale(t: CertTemplate, bodyPlainLen: number): number {
  if (t.auto_fit) {
    const l = bodyPlainLen;
    return l < 80 ? 1.42 : l < 120 ? 1.30 : l < 170 ? 1.18 : l < 230 ? 1.07 : 1;
  }
  const s = typeof t.text_scale === "number" && t.text_scale > 0 ? t.text_scale : 1;
  return Math.max(0.8, Math.min(1.6, s));
}

export interface CertData {
  participant_name: string;
  course_name: string;
  hours?: number | null;
  instructors_text?: string;    // "Sensei X, Sensei Y e Sensei Z"
  dates_text?: string;          // "01 e 02 de Novembro de 2025"
  days_count?: number | null;   // nº de dias do curso (1 → singular "no dia"; 2+ → "nos dias")
  location?: string;            // "São Paulo"
  issued_date_text?: string;    // "02 de Novembro de 2025"
  federation_name?: string;     // "FEDERAÇÃO PAULISTA DE KARATÊ-DÔ TRADICIONAL"
  signatories?: CertSignatory[];
  verify_url?: string;          // QR aponta pra cá
}

const FPKT_RED = "#b8463a";
const INK = "#2b2620";

function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Substitui as tags do texto personalizado pelos valores reais.
function fillTags(tpl: string, d: CertData): string {
  const map: Record<string, string> = {
    nome: d.participant_name || "",
    curso: d.course_name || "",
    carga_horaria: d.hours ? `${d.hours} horas/aula` : "",
    ministrantes: d.instructors_text || "",
    datas: d.dates_text || "",
    local: d.location || "",
    data_emissao: d.issued_date_text || "",
  };
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`));
}

// "no dia" (singular) vs "nos dias" (plural) conforme o nº de dias do curso.
// Usa days_count quando informado; senão infere do texto de datas (nº de datas
// numéricas DD/MM/AAAA, ou conjunção/lista tipo "01 e 02" / vírgulas).
function diaPreposicao(d: CertData): string {
  let multi: boolean;
  if (typeof d.days_count === "number") {
    multi = d.days_count >= 2;
  } else {
    const t = d.dates_text || "";
    const numericDates = (t.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || []).length;
    if (numericDates >= 2) multi = true;
    else if (numericDates === 1) multi = false;
    else multi = /\b\d{1,2}\s+e\s+\d{1,2}\b/i.test(t) || /,/.test(t);
  }
  return multi ? "nos dias" : "no dia";
}

// Corpo padrão (o do modelo aprovado). Nome/curso/valores em negrito.
function defaultBody(d: CertData): string {
  const carga = d.hours ? `<b>${d.hours} horas/aula</b>` : "";
  const cargaFrag = carga ? `, com duração de ${carga}` : "";
  const minFrag = d.instructors_text ? `, ministrado por <b>${esc(d.instructors_text)}</b>` : "";
  const datasFrag = d.dates_text ? ` ${diaPreposicao(d)} <b>${esc(d.dates_text)}</b>` : "";
  return `Certificamos que <b>${esc(d.participant_name)}</b> participou do <b>${esc(d.course_name)}</b>${cargaFrag}${minFrag}${datasFrag}.`;
}

function qrImg(url: string, size = 200): string {
  return "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size +
    "&margin=0&data=" + encodeURIComponent(url);
}

// ── CSS base compartilhado (parametrizado por fonte + escala de texto) ──
function baseCss(fontKey: CertFont, scale: number): string {
  const f = CERT_FONTS[fontKey] || CERT_FONTS.classica;
  const imp = f.import ? `@import url('${f.import}');\n` : "";
  const n = (base: number) => +(base * scale).toFixed(2);   // px/pt escalado
  const bodyMax = Math.min(230, Math.round(205 * (scale > 1 ? 1 : 1)));  // largura estável
  return `
${imp}@page { size: 297mm 210mm; margin: 0; }
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:${f.body};color:${INK};}
.cert{width:297mm;height:210mm;position:relative;overflow:hidden;background:#fff;}
.pad{position:absolute;inset:20mm 22mm;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.seals{display:flex;align-items:center;justify-content:center;gap:12mm;min-height:20mm;}
.seal{height:22mm;width:auto;object-fit:contain;}
.seal-ph{width:18mm;height:18mm;border:0.4mm dashed #b8b0a0;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#a89f8e;font-size:6pt;font-family:Arial,sans-serif;text-align:center;}
.fed{font-size:${n(9.5)}pt;letter-spacing:0.4pt;color:#4a443c;margin-top:3mm;text-align:center;text-transform:uppercase;}
.title{font-family:${f.heading};font-size:${n(33)}pt;font-weight:bold;letter-spacing:3pt;margin-top:5mm;color:${INK};line-height:1.05;}
.rule{width:50mm;height:0.8mm;background:${FPKT_RED};margin-top:3mm;}
.body{font-size:${n(14)}pt;line-height:1.85;text-align:center;max-width:${bodyMax}mm;margin-top:7mm;}
.body b{font-weight:bold;}
.place{font-size:${n(12)}pt;margin-top:7mm;}
.sigs{position:absolute;bottom:20mm;left:26mm;right:26mm;display:flex;justify-content:center;gap:18mm;}
.sig{text-align:center;min-width:46mm;max-width:70mm;font-family:${f.body};}
.sig-img{height:12mm;object-fit:contain;margin-bottom:-1mm;}
.sig-line{border-top:0.4mm solid ${INK};margin-bottom:1.5mm;}
.sig-name{font-size:10.5pt;font-weight:bold;}
.sig-role{font-size:8pt;color:#6a6154;margin-top:0.4mm;text-transform:uppercase;letter-spacing:0.3pt;}
.qr{position:absolute;bottom:14mm;left:18mm;text-align:center;}
.qr img{width:19mm;height:19mm;}
.qr-cap{font-size:6pt;color:#6a6154;margin-top:1mm;font-family:Arial,sans-serif;}
.wm{position:absolute;top:52%;left:50%;transform:translate(-50%,-50%);width:110mm;opacity:0.045;}
`;
}

// ── CSS por layout ──
function layoutCss(layout: CertLayout): string {
  switch (layout) {
    case "A": return `
.frame{position:absolute;inset:9mm;border:1.3mm solid ${FPKT_RED};}
.frame2{position:absolute;inset:11mm;border:0.35mm solid ${FPKT_RED};}
.corner{position:absolute;width:24mm;height:24mm;background:${FPKT_RED};}
.c-tl{top:0;left:0;clip-path:polygon(0 0,100% 0,0 100%);}
.c-br{bottom:0;right:0;clip-path:polygon(100% 100%,0 100%,100% 0);}`;
    case "B": return `
.cert{background:#f2ede1;}
.topbar{position:absolute;top:0;left:0;right:0;height:5mm;background:${FPKT_RED};}
.rule{background:${INK};}
.kline{position:absolute;bottom:8mm;left:22mm;right:22mm;height:0.3mm;background:rgba(43,38,32,0.25);}`;
    case "C": return `
.brush{position:absolute;}
.b1{top:6mm;left:6mm;width:120mm;height:5mm;background:${FPKT_RED};transform:rotate(-1deg);border-radius:3mm;}
.b2{top:9mm;left:8mm;width:80mm;height:2mm;background:#1a1410;transform:rotate(-0.6deg);border-radius:2mm;}
.b3{bottom:6mm;right:6mm;width:120mm;height:5mm;background:${FPKT_RED};transform:rotate(-1deg);border-radius:3mm;}
.b4{bottom:9mm;right:8mm;width:80mm;height:2mm;background:#1a1410;transform:rotate(-0.6deg);border-radius:2mm;}
.bl{top:6mm;left:6mm;width:5mm;height:120mm;background:${FPKT_RED};transform:rotate(0.6deg);border-radius:3mm;}
.br2{bottom:6mm;right:6mm;width:5mm;height:120mm;background:${FPKT_RED};transform:rotate(0.6deg);border-radius:3mm;}`;
    case "D": return `
.sidebar{position:absolute;top:0;bottom:0;left:0;width:16mm;background:${FPKT_RED};}
.sidebar2{position:absolute;top:0;bottom:0;left:16mm;width:1.5mm;background:#1a1410;}
.pad{inset:20mm 22mm 20mm 34mm;}
.title{letter-spacing:5pt;}`;
    case "E": return `
.frame{position:absolute;inset:8mm;border:0.5mm solid ${FPKT_RED};}
.frame2{position:absolute;inset:10mm;border:1.6mm double ${FPKT_RED};}
.orn{position:absolute;width:10mm;height:10mm;border:0.5mm solid ${FPKT_RED};}
.o1{top:12mm;left:12mm;border-right:0;border-bottom:0;}
.o2{top:12mm;right:12mm;border-left:0;border-bottom:0;}
.o3{bottom:12mm;left:12mm;border-right:0;border-top:0;}
.o4{bottom:12mm;right:12mm;border-left:0;border-top:0;}`;
  }
}

function layoutDeco(layout: CertLayout): string {
  switch (layout) {
    case "A": return '<div class="corner c-tl"></div><div class="corner c-br"></div><div class="frame"></div><div class="frame2"></div>';
    case "B": return '<div class="topbar"></div><div class="kline"></div>';
    case "C": return '<div class="brush b1"></div><div class="brush b2"></div><div class="brush b3"></div><div class="brush b4"></div><div class="brush bl"></div><div class="brush br2"></div>';
    case "D": return '<div class="sidebar"></div><div class="sidebar2"></div>';
    case "E": return '<div class="frame"></div><div class="frame2"></div><div class="orn o1"></div><div class="orn o2"></div><div class="orn o3"></div><div class="orn o4"></div>';
  }
}

function sealsHtml(seals: CertSeal[] | undefined): string {
  const list = seals && seals.length ? seals : [{ label: "FPKT", image_url: null }];
  return '<div class="seals">' + list.map((s) =>
    s.image_url ? `<img class="seal" src="${esc(s.image_url)}" alt="${esc(s.label)}"/>`
                : `<div class="seal-ph">${esc(s.label)}</div>`
  ).join("") + '</div>';
}

function sigsHtml(sigs: CertSignatory[] | undefined): string {
  const list = sigs && sigs.length ? sigs : [];
  if (!list.length) return "";
  return '<div class="sigs">' + list.map((s) =>
    '<div class="sig">' +
      (s.signature_url ? `<img class="sig-img" src="${esc(s.signature_url)}"/>` : "") +
      '<div class="sig-line"></div>' +
      `<div class="sig-name">${esc(s.name)}</div>` +
      (s.role ? `<div class="sig-role">${esc(s.role)}</div>` : "") +
    '</div>'
  ).join("") + '</div>';
}

// HTML de UM certificado (uma página). watermarkUrl opcional (marca d'água).
export function buildCertificateHtml(data: CertData, template: CertTemplate, watermarkUrl?: string | null): string {
  const layout = template.layout || "A";
  const fontKey: CertFont = template.font && CERT_FONTS[template.font] ? template.font : "classica";
  const title = template.title || "CERTIFICADO";
  const bodyHtml = template.body_mode === "custom" && template.body_text
    ? esc(fillTags(template.body_text, data)).replace(/\n/g, "<br>")
    : defaultBody(data);
  const bodyPlainLen = bodyHtml.replace(/<[^>]+>/g, "").length;
  const scale = computeScale(template, bodyPlainLen);
  const placeLine = (data.location || data.issued_date_text)
    ? `${esc(data.location || "")}${data.location && data.issued_date_text ? ", " : ""}${esc(data.issued_date_text || "")}.`
    : "";
  const wm = watermarkUrl ? `<img class="wm" src="${esc(watermarkUrl)}"/>` : "";
  const qr = data.verify_url
    ? `<div class="qr"><img src="${qrImg(data.verify_url)}"/><div class="qr-cap">Verificar autenticidade</div></div>`
    : "";

  let html = "<!doctype html><html lang='pt-BR'><head><meta charset='UTF-8'>";
  html += "<style>" + baseCss(fontKey, scale) + layoutCss(layout) + "</style></head><body>";
  html += "<div class='cert'>" + wm + layoutDeco(layout) + "<div class='pad'>";
  html += sealsHtml(template.seals);
  html += `<div class="fed">${esc(data.federation_name || "")}</div>`;
  html += `<div class="title">${esc(title)}</div>`;
  html += '<div class="rule"></div>';
  html += `<div class="body">${bodyHtml}</div>`;
  if (placeLine) html += `<div class="place">${placeLine}</div>`;
  html += "</div>";
  html += sigsHtml(data.signatories);
  html += qr;
  html += "</div></body></html>";
  return html;
}

export default buildCertificateHtml;
