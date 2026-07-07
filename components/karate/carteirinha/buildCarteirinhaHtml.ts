// ============================================================
// buildCarteirinhaHtml — Aura Karatê (F5: impressão em lote)
//
// Gera um documento HTML completo para impressão de carteirinhas em A4,
// múltiplas por página (grid 2 colunas), no espírito do
// components/screens/estoque/labels/buildLabelHtml.ts (mesmo padrão de
// botão flutuante "Imprimir" + @media print escondendo controles).
//
// Reescrito para bater 1:1 com o mock aprovado "Carteirinhas FPKT"
// (Carteirinhas FPKT.dc.html, cartão CR80 640×404px, razão 0.63125),
// espelhando components/karate/CarteirinhaCard.tsx. Tokens Shoji/Kinari
// (colors.css/typography.css): papel #f0ebe0, sumi #2b2620, vermelhão
// hanko #b8463a, barra-preta #141210. Fontes: Shippori Mincho (heading),
// Zen Kaku Gothic New (body), DM Mono (dados) — carregadas via @import
// Google Fonts no <style> (não dependem de KarateFonts, que é RN-only).
//
// Dois designs, decididos pela faixa (isPreta):
//   - Design 01 (faixas coloridas): header direito "Carteira"/"do filiado";
//     SEM campo Faixa; sem barra preta.
//   - Design 02 (faixa-preta): header direito "Carteira" + badge quadrado
//     preto "faixa-preta"; barra preta 8px full-bleed abaixo da régua
//     vermelha (frente e verso); corpo COM campo Faixa (quadrado preto +
//     "Preta · Nº Dan").
//
// Discrepância sinalizada (ver PR): o cliente pediu para remover a
// assinatura "Presidente", mas o mock APROVADO mantém essa linha no
// footer da frente. Seguimos o mock (fiel ao design aprovado).
//
// Layout de impressão: para cada praticante, a FRENTE e o VERSO são
// emitidos em sequência no mesmo grid 2 colunas (frente, depois verso logo
// a seguir), cada um rotulado ("Frente"/"Verso") no card. Isso mantém a
// leitura simples em tela e permite impressão frente-e-verso manual
// (imprimir todas, virar a pilha, reimprimir nas costas) sem exigir duplex
// automático do navegador — o pareamento frente/verso fica visualmente
// adjacente na grade para facilitar o corte e a conferência.
//
// QR: reutiliza o MESMO serviço público que buildLabelHtml.ts já usa em
// produção (api.qrserver.com) — não há gerador de QR "RN-only" reaproveitável
// fora de contexto React (PixQRCode/QrCode dependem de libs RN). Mesma URL de
// verificação do CarteirinhaCard: https://app.getaura.com.br/karate/verify/<token>.
//
// Tamanho do cartão: CR80, 85.6mm x 54mm (padrão internacional de cartão de
// identificação, mesma proporção do mock 640x404px — 404/640 = 0.63125;
// 54/85.6 = 0.6308, arredondamento equivalente). Preserva exatamente essa
// dimensão física na impressão.
// ============================================================
import { resolveBeltKey } from "@/constants/karateTheme";
import { FPKT_LOGO_DATA_URI } from "./fpktLogoDataUri";
import type { MembershipCard } from "@/services/karateCardApi";

const RED = "#b8463a";
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const LINE = "rgba(43,38,32,0.10)";
const LINE_2 = "rgba(43,38,32,0.17)";
const BLACK_BAR = "#141210";

const CARD_W_MM = 85.6;
const CARD_H_MM = 54;

// Dojo Kun — os cinco princípios (espelha DOJO_KUN em CarteirinhaCard.tsx)
const DOJO_KUN = [
  "Esforçar-se para a formação do caráter",
  "Criar intuito de esforço",
  "Respeito acima de tudo",
  "Conter o espírito de agressão",
  "Fidelidade para com o verdadeiro caminho da razão",
];

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtBR(iso?: string | null): string {
  if (!iso) return "—";
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(iso);
  }
  if (isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isBeltPreta(card: MembershipCard): boolean {
  const key = resolveBeltKey(card.belt_name || card.belt || "");
  return key === "preta";
}

// "Preta · Nº Dan" — adapta formatBeltLabel (ex.: "Preta 1º Dan") para o
// formato do mock ("Preta · 1º Dan"). Espelha beltDanLabel em CarteirinhaCard.tsx.
function fmtCpf(cpf?: string | null): string {
  const d = String(cpf || "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return cpf || "—";
  return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
}

function beltDanLabel(card: MembershipCard): string {
  const raw = (card.belt_name || card.belt || "Preta").trim();
  const m = raw.match(/(\d+)/);
  if (m) return `Preta · ${m[1]}º Dan`;
  return "Preta · Dan";
}

function federationNameLines(name?: string | null): [string, string] {
  const fallback: [string, string] = ["Federação Paulista de", "Karatê-Dô Tradicional"];
  const n = (name || "").trim();
  if (!n || !/\s/.test(n)) return fallback;
  const words = n.split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function verifyUrlFor(card: MembershipCard): string {
  return `https://app.getaura.com.br/karate/verify/${encodeURIComponent(card.verify_token || "")}`;
}

function qrImgUrl(data: string, size = 220): string {
  return "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size +
    "&data=" + encodeURIComponent(data) + "&bgcolor=ffffff&color=1a1611&margin=1";
}

export type CarteirinhaBatchOptions = {
  federationName?: string;
};

function renderFront(card: MembershipCard, options?: CarteirinhaBatchOptions): string {
  const isPreta = isBeltPreta(card);
  const federationName = card.federation_name || options?.federationName || null;
  const [line1, line2] = federationNameLines(federationName);
  const logo = '<img class="logo-img" src="' + esc(card.federation_logo || FPKT_LOGO_DATA_URI) + '" alt="">';
  const photo = card.photo_url
    ? '<img class="photo" src="' + esc(card.photo_url) + '" alt="">'
    : '<div class="photo photo-empty"><span>FOTO</span><span class="photo-sub">3 &times; 4</span></div>';

  const headerRight = isPreta
    ? '<div class="hd-carteira">Carteira</div><div class="hd-badge"><span class="badge-sq"></span>faixa-preta</div>'
    : '<div class="hd-carteira">Carteira</div><div class="hd-sub">do filiado</div>';

  const blackBar = isPreta ? '<div class="black-bar"></div>' : '';

  const fieldsGrid = isPreta
    ? (
      // Design 02: mesma ordem do Design 01 [Nasc · Dojô / CPF · Nº registro]
      // + Faixa como ÚLTIMO item. Dojô em coluna larga com fallback de 2 linhas.
      '<div class="frow">' +
        '<div class="fld f-date"><div class="flabel">Nascimento</div><div class="fvalue mono">' + fmtBR(card.birth_date) + '</div></div>' +
        '<div class="fld f-dojo"><div class="flabel">Dojô</div><div class="fvalue dojo">' + esc(card.dojo_name || "—") + '</div></div>' +
      '</div>' +
      '<div class="frow">' +
        '<div class="fld f-half"><div class="flabel">CPF</div><div class="fvalue mono">' + esc(fmtCpf(card.cpf)) + '</div></div>' +
        '<div class="fld f-half"><div class="flabel">Nº de registro FPKT</div><div class="fvalue mono reg-num">' + esc(card.card_number || "—") + '</div></div>' +
      '</div>' +
      '<div class="fld reg-fld"><div class="flabel">Faixa</div><div class="belt-line"><span class="belt-sq"></span><span class="fvalue belt-label">' + beltDanLabel(card) + '</span></div></div>'
    )
    : (
      '<div class="frow">' +
        '<div class="fld f-date"><div class="flabel">Nascimento</div><div class="fvalue mono">' + fmtBR(card.birth_date) + '</div></div>' +
        '<div class="fld f-dojo"><div class="flabel">Dojô</div><div class="fvalue dojo">' + esc(card.dojo_name || "—") + '</div></div>' +
      '</div>' +
      '<div class="frow">' +
        '<div class="fld f-half"><div class="flabel">CPF</div><div class="fvalue mono">' + esc(fmtCpf(card.cpf)) + '</div></div>' +
        '<div class="fld f-half"><div class="flabel">Nº de registro FPKT</div><div class="fvalue mono reg-num">' + esc(card.card_number || "—") + '</div></div>' +
      '</div>'
    );

  return (
    '<div class="cr80' + (isPreta ? ' is-preta' : '') + '">' +
      '<img class="wm wm-front" src="' + esc(card.federation_logo || FPKT_LOGO_DATA_URI) + '" alt="">' +
      '<div class="face-pad">' +
        '<div class="head">' +
          '<div class="head-left">' +
            '<div class="logo">' + logo + '</div>' +
            '<div class="fed-name"><div>' + esc(line1) + '</div>' + (line2 ? '<div>' + esc(line2) + '</div>' : '') + '</div>' +
          '</div>' +
          '<div class="head-right">' + headerRight + '</div>' +
        '</div>' +
        '<div class="ruler-red"></div>' +
        blackBar +
        '<div class="body-row">' +
          photo +
          '<div class="fields">' +
            '<div class="fld name-fld"><div class="flabel">Nome</div><div class="fvalue name">' + esc(card.student_name) + '</div></div>' +
            fieldsGrid +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// Verso — espelha CarteirinhaCard.Back: Dojo Kun (os cinco princípios) à
// esquerda, QR de verificação + nº de registro + data de emissão à direita.
function renderBack(card: MembershipCard, options?: CarteirinhaBatchOptions): string {
  const isPreta = isBeltPreta(card);
  const federationName = card.federation_name || options?.federationName || null;
  const [line1, line2] = federationNameLines(federationName);
  const logo = '<img class="logo-img" src="' + esc(card.federation_logo || FPKT_LOGO_DATA_URI) + '" alt="">';
  const verifyUrl = verifyUrlFor(card);
  const qr = qrImgUrl(verifyUrl, 220);
  const blackBar = isPreta ? '<div class="black-bar"></div>' : '';
  const kunList = DOJO_KUN.map(function (line) {
    return '<div class="kun-item"><span class="kun-dot"></span><span class="kun-text">' + esc(line) + '</span></div>';
  }).join("");

  return (
    '<div class="cr80">' +
      '<img class="wm wm-back" src="' + esc(card.federation_logo || FPKT_LOGO_DATA_URI) + '" alt="">' +
      '<div class="face-pad">' +
        '<div class="head">' +
          '<div class="head-left">' +
            '<div class="logo">' + logo + '</div>' +
            '<div class="fed-name"><div>' + esc(line1) + '</div>' + (line2 ? '<div>' + esc(line2) + '</div>' : '') + '</div>' +
          '</div>' +
          '<div class="hd-verso">Verso</div>' +
        '</div>' +
        '<div class="ruler-red"></div>' +
        blackBar +
        '<div class="back-row">' +
          '<div class="kun-col">' +
            '<div class="kun-eyebrow">Lema do Karatê</div>' +
            '<div class="kun-title">Dojo Kun &middot; os cinco princípios</div>' +
            '<div class="kun-list">' + kunList + '</div>' +
          '</div>' +
          '<div class="verify-col">' +
            '<div class="verify-eyebrow">Identificação</div>' +
            '<div class="verify-title">Validação do filiado</div>' +
            '<img class="qr" src="' + qr + '" alt="QR de verificação">' +
            '<div class="verify-num">' + esc(card.card_number || "—") + '</div>' +
            '<div class="issued-col">' +
              '<div class="issued-label">Data de emissão</div>' +
              '<div class="issued-value">' + fmtBR(card.issued_at) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

export function buildCarteirinhaHtml(cards: MembershipCard[], options?: CarteirinhaBatchOptions): string {
  const total = cards.length;

  const cells = cards.map(function (card) {
    return renderFront(card, options) + "\n" + renderBack(card, options);
  }).join("\n");

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Carteirinhas Aura - ' + total + ' carteirinha(s)</title>';
  html += '<style>';
  // Fontes do mock aprovado (Shippori Mincho / Zen Kaku Gothic New / DM Mono)
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4;margin:10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:"Zen Kaku Gothic New",system-ui,sans-serif;background:#f5f5f5;color:' + INK + '}';
  html += '.grid{display:grid;grid-template-columns:repeat(2, ' + CARD_W_MM + 'mm);gap:6mm 8mm;justify-content:center;padding-top:64px;padding-bottom:80px}';

  // ── cartão CR80 ──
  html += '.cr80{width:' + CARD_W_MM + 'mm;height:' + CARD_H_MM + 'mm;background:#ffffff;border-radius:2.6mm;border:0.18mm solid ' + LINE_2 + ';overflow:hidden;page-break-inside:avoid;break-inside:avoid;position:relative}';
  html += '.face-pad{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;padding:4.2mm 5.1mm 3.5mm}';
  html += '.wm{position:absolute;pointer-events:none;object-fit:contain;z-index:1}';
  html += '.wm-front{left:50%;top:50%;width:46mm;opacity:0.06;transform:translate(-50%,-50%)}';
  html += '.wm-back{left:50%;top:56%;width:41mm;opacity:0.05;transform:translate(-50%,-50%)}';

  // header
  html += '.head{display:flex;align-items:flex-start;justify-content:space-between;min-height:7.3mm}';
  html += '.head-left{display:flex;align-items:center;gap:2.1mm}';
  html += '.logo{width:6.3mm;height:6.3mm;flex-shrink:0;display:flex;align-items:center;justify-content:center}';
  html += '.logo-img{max-width:100%;max-height:100%;object-fit:contain}';
  html += '.logo-fallback{font-size:4mm;color:' + RED + '}';
  html += '.fed-name{font-family:"Shippori Mincho",serif;font-size:6.4pt;font-weight:500;letter-spacing:0.05pt;color:' + INK + ';line-height:1.35}';
  html += '.hd-carteira{font-family:"Shippori Mincho",serif;font-size:7.3pt;font-weight:400;color:' + INK_2 + ';text-align:right}';
  html += '.hd-sub{font-size:3.7pt;letter-spacing:0.6pt;text-transform:uppercase;color:' + INK_3 + ';text-align:right;margin-top:0.6mm}';
  html += '.hd-badge{font-size:5pt;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_2 + ';font-weight:500;display:flex;align-items:center;gap:0.8mm;justify-content:flex-end;margin-top:0.7mm}';
  html += '.badge-sq{width:1.3mm;height:1.3mm;background:' + BLACK_BAR + ';display:inline-block}';
  html += '.hd-verso{font-size:3.7pt;letter-spacing:0.7pt;text-transform:uppercase;color:' + INK_3 + '}';

  // réguas
  html += '.ruler-red{margin:2.4mm -5.1mm 0;height:0.3mm;background:' + RED + '}';
  html += '.black-bar{margin:1.2mm -5.1mm 0;height:1.15mm;background:' + BLACK_BAR + '}';

  // body
  html += '.body-row{display:flex;gap:4.3mm;margin-top:2.0mm;flex:1;min-height:0;align-items:flex-start}';
  html += '.photo{width:21.7mm;height:28.9mm;flex-shrink:0;border-radius:1.4mm;border:0.15mm solid ' + LINE_2 + ';object-fit:cover;background:#faf8f3}';
  html += '.photo-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4mm;font-family:"DM Mono",monospace;font-size:4.6pt;letter-spacing:0.5pt;color:' + INK_4 + '}';
  html += '.photo-sub{font-size:4.2pt}';
  html += '.fields{flex:1;min-width:0;display:flex;flex-direction:column;gap:1.6mm}';
  html += '.flabel{font-family:"DM Mono",monospace;font-size:3.9pt;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_3 + '}';
  html += '.fvalue{font-family:"Zen Kaku Gothic New",sans-serif;font-size:6.4pt;font-weight:500;color:' + INK + ';margin-top:0.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.fvalue.dojo{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.12}';
  html += '.frow{display:flex;gap:2.6mm}';
  html += '.f-date{width:14mm;flex:none;min-width:0}';
  html += '.f-dojo{flex:1;min-width:0}';
  html += '.f-half{flex:1;min-width:0}';
  html += '.fvalue.name{font-size:9pt;font-weight:700;white-space:normal}';
  html += '.fvalue.mono{font-family:"DM Mono",monospace;font-weight:400}';
  html += '.name-fld{margin-bottom:0.4mm}';
  html += '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:2.2mm 2.6mm}';
  html += '.reg-fld{margin-top:1.1mm}';
  html += '.is-preta .body-row{margin-top:1.5mm}';
  html += '.is-preta .fields{gap:1.2mm}';
  html += '.is-preta .fvalue.name{font-size:8.4pt}';
  html += '.is-preta .reg-fld{margin-top:0.7mm}';
  html += '.is-preta .belt-line{margin-top:0.4mm}';
  html += '.is-preta .face-pad{padding-bottom:2.6mm}';
  html += '.reg-num{font-size:7.6pt;font-weight:500;color:' + RED + ';letter-spacing:0.2pt}';
  html += '.belt-line{display:flex;align-items:center;gap:1.1mm;margin-top:0.7mm}';
  html += '.belt-sq{width:1.9mm;height:1.9mm;background:' + BLACK_BAR + ';border-radius:0.3mm;flex-shrink:0}';
  html += '.belt-label{margin-top:0;font-weight:700}';

  // footer
  html += '.footer-row{margin-top:auto;display:flex;align-items:flex-end;justify-content:flex-end}';
  html += '.pres-line{width:20mm;height:0.15mm;background:' + INK_4 + '}';
  html += '.pres-label{font-family:"DM Mono",monospace;font-size:3.4pt;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_3 + ';margin-top:0.9mm}';
  html += '.valid-col{display:flex;align-items:center;gap:1.2mm}';
  html += '.valid-dot{width:0.7mm;height:0.7mm;border-radius:0.4mm;background:' + RED + ';flex-shrink:0}';
  html += '.valid-text{font-family:"DM Mono",monospace;font-size:3.2pt;letter-spacing:0.4pt;text-transform:uppercase;color:' + INK_3 + ';text-align:right;line-height:1.5}';

  // verso body
  html += '.back-row{display:flex;flex:1;margin-top:2.6mm;min-height:0}';
  html += '.kun-col{flex:1.45;padding-right:3.2mm;display:flex;flex-direction:column;justify-content:flex-start}';
  html += '.kun-eyebrow{font-family:"DM Mono",monospace;font-size:3.9pt;letter-spacing:0.55pt;text-transform:uppercase;color:' + RED + '}';
  html += '.kun-title{font-family:"Shippori Mincho",serif;font-size:6.8pt;font-weight:500;margin-top:0.9mm;color:' + INK + '}';
  html += '.kun-list{margin-top:2.4mm;display:flex;flex-direction:column;gap:1.6mm}';
  html += '.kun-item{display:flex;align-items:flex-start;gap:1.5mm}';
  html += '.kun-dot{width:0.8mm;height:0.8mm;background:' + RED + ';margin-top:0.7mm;flex-shrink:0}';
  html += '.kun-text{font-size:5pt;line-height:1.4;color:' + INK + '}';
  html += '.verify-col{flex:1;border-left:0.15mm solid ' + LINE + ';padding-left:3.2mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center}';
  html += '.verify-eyebrow{font-family:"DM Mono",monospace;font-size:3.9pt;letter-spacing:0.55pt;text-transform:uppercase;color:' + INK_3 + '}';
  html += '.verify-title{font-family:"Shippori Mincho",serif;font-size:6.8pt;font-weight:500;margin-top:0.9mm;color:' + INK + '}';
  html += '.qr{width:14.9mm;height:14.9mm;margin-top:2.1mm;background:#fff;image-rendering:pixelated}';
  html += '.verify-num{font-family:"DM Mono",monospace;font-size:5.2pt;color:' + INK + ';margin-top:1.6mm;letter-spacing:0.2pt}';
  html += '.issued-col{margin-top:2.1mm}';
  html += '.issued-label{font-family:"DM Mono",monospace;font-size:3.4pt;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_3 + '}';
  html += '.issued-value{font-family:"DM Mono",monospace;font-size:5.2pt;margin-top:0.5mm;color:' + INK + '}';

  // ── Controles de tela (escondidos na impressão) ──
  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.grid{padding-top:0;padding-bottom:0}body{background:#fff}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Carteirinhas Aura — A4, ' + CARD_W_MM + 'mm x ' + CARD_H_MM + 'mm · frente e verso</span><br>';
  html += '<b>' + total + ' carteirinha' + (total > 1 ? 's' : '') + ' selecionada' + (total > 1 ? 's' : '') + ' (' + (total * 2) + ' cartões p/ impressão)</b></div></div>';

  html += '<div class="grid">' + cells + '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

export default buildCarteirinhaHtml;
