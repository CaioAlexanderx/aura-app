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
import { DOJO_KUN_DATA_URI } from "./dojoKunDataUri";
import type { MembershipCard } from "@/services/karateCardApi";

const RED = "#b8463a";
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const LINE = "rgba(43,38,32,0.10)";
const LINE_2 = "rgba(43,38,32,0.17)";
const BLACK_BAR = "#141210";

// Tokens exclusivos de @media print — impressoras clareiam cinzas claros e
// afinam linhas finas; estes tons/larguras só entram no bloco @media print
// (não afetam a prévia em tela, que já foi aprovada).
const PRINT_LABEL = "#4a4335";
const PRINT_LINE = "rgba(43,38,32,0.55)";
const PRINT_LINE_2 = "rgba(43,38,32,0.78)";

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

// Opacidade única da marca (frente = verso), por pedido da federação.
const WM_OPACITY = 0.18;

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
      // Design 02: grid 1fr 1fr alinhado (igual ao mock aprovado) + Faixa no fim.
      '<div class="grid2">' +
        '<div class="fld"><div class="flabel">Data de nascimento</div><div class="fvalue mono">' + fmtBR(card.birth_date) + '</div></div>' +
        '<div class="fld"><div class="flabel">Dojô</div><div class="fvalue dojo">' + esc(card.dojo_name || "—") + '</div></div>' +
        '<div class="fld"><div class="flabel">CPF</div><div class="fvalue mono">' + esc(fmtCpf(card.cpf)) + '</div></div>' +
        '<div class="fld"><div class="flabel">Nº de registro FPKT</div><div class="fvalue mono reg-num">' + esc(card.card_number || "—") + '</div></div>' +
      '</div>' +
      // Faixa + Nº CBKT lado a lado (grid2) quando há CBKT — economiza altura e
      // evita o corte no rodapé do cartão faixa-preta; senão, Faixa sozinha.
      (card.cbkt_number
        ? '<div class="grid2 reg-fld">' +
            '<div class="fld"><div class="flabel">Faixa</div><div class="belt-line"><span class="belt-sq"></span><span class="fvalue belt-label">' + beltDanLabel(card) + '</span></div></div>' +
            '<div class="fld"><div class="flabel">Nº CBKT</div><div class="fvalue mono cbkt-num">' + esc(card.cbkt_number) + '</div></div>' +
          '</div>'
        : '<div class="fld reg-fld"><div class="flabel">Faixa</div><div class="belt-line"><span class="belt-sq"></span><span class="fvalue belt-label">' + beltDanLabel(card) + '</span></div></div>')
    )
    : (
      '<div class="grid2">' +
        '<div class="fld"><div class="flabel">Data de nascimento</div><div class="fvalue mono">' + fmtBR(card.birth_date) + '</div></div>' +
        '<div class="fld"><div class="flabel">Dojô</div><div class="fvalue dojo">' + esc(card.dojo_name || "—") + '</div></div>' +
        '<div class="fld"><div class="flabel">CPF</div><div class="fvalue mono">' + esc(fmtCpf(card.cpf)) + '</div></div>' +
        '<div class="fld"><div class="flabel">Nº de registro FPKT</div><div class="fvalue mono reg-num">' + esc(card.card_number || "—") + '</div></div>' +
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
    return '<div class="kun-item"><span class="kun-dot" aria-hidden="true">&#8226;</span><span class="kun-text">' + esc(line) + '</span></div>';
  }).join("");

  return (
    '<div class="cr80">' +
      '<div class="wm wm-back"></div>' +
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

function cardCss(): string {
  let html = '';
  // Fontes do mock aprovado (Shippori Mincho / Zen Kaku Gothic New / DM Mono)
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;600;700;900&family=DM+Mono:wght@400;500;600;700&display=swap\');';
  html += '@page{size:A4;margin:10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
  html += 'body{font-family:"Zen Kaku Gothic New","Arial","Helvetica Neue",Arial,sans-serif;background:#f5f5f5;color:' + INK + '}';
  html += '.grid{display:grid;grid-template-columns:repeat(2, ' + CARD_W_MM + 'mm);gap:6mm 8mm;justify-content:center;padding-top:64px;padding-bottom:80px}';

  // ── cartão CR80 ──
  html += '.cr80{width:' + CARD_W_MM + 'mm;height:' + CARD_H_MM + 'mm;background:#ffffff;border-radius:2.6mm;border:0.18mm solid ' + LINE_2 + ';overflow:hidden;page-break-inside:avoid;break-inside:avoid;position:relative}';
  html += '.face-pad{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;padding:2.85mm 6.2mm 4.2mm}';
  html += '.wm{position:absolute;pointer-events:none;object-fit:contain;z-index:1}';
  html += '.wm-front{left:70%;top:50%;width:52mm;opacity:' + WM_OPACITY + ';transform:translate(-50%,-50%)}';
  html += '.wm-back{left:50%;top:56%;width:60mm;height:35.75mm;opacity:' + WM_OPACITY + ';transform:translate(-50%,-50%);background-image:url(\'' + DOJO_KUN_DATA_URI + '\');background-repeat:no-repeat;background-position:center;background-size:contain}';

  // header
  // gap:3mm (15/07/2026) — o Caio pediu respiro entre o nome da federação e o
  // bloco "Carteira / FAIXA-PRETA". Com justify-content:space-between e
  // .head-left{flex:1}, o nome crescia até ENCOSTAR no head-right. O gap tira
  // largura do .fed-name, então foi medido antes: conteúdo 73.2mm − logo 13mm −
  // gap-logo 2.1mm − head-right ~15mm = ~43mm para um nome que ocupa ~29.6mm na
  // linha mais longa ("FEDERAÇÃO PAULISTA DE"). Folga ~13.5mm — 3mm cabe com
  // sobra e o ellipsis do .fed-name segura qualquer nome maior.
  // ⚠️ MEDIDO (15/07/2026), não estimado — a estimativa anterior errou 45% e
  // truncou o nome da federação na FRENTE ("FEDERAÇÃO PAULISTA…").
  // Métricas de fonte serifada real a 8pt: o nome precisa de ~43.5mm.
  //   conteúdo 73.2 − logo 13 − gap-logo 1.5 − gap 2 − head-right 15.5 = 42.2
  //   + margin-left −3.5mm (folga que sobrava à esquerda) = 44.7mm  → cabe.
  // Por que só a FRENTE truncava: o head-right dela é "Carteira/FAIXA-PRETA"
  // (~16mm); no VERSO é só "VERSO" (~6mm) — daí o verso nunca truncar.
  // O margin-left negativo usa o mesmo truque dos filetes (que sangram a
  // −6.2mm); aqui puxa 3.5mm, deixando a logo a 2.7mm da borda do cartão.
  html += '.head{display:flex;align-items:center;justify-content:space-between;gap:2mm;min-height:12.4mm;margin-left:-3.5mm}';
  html += '.head-left{display:flex;align-items:center;gap:1.5mm;flex:1;min-width:0}';
  html += '.logo{flex-shrink:0;display:flex;align-items:center}';
  html += '.logo-img{width:13mm;height:auto;object-fit:contain}';
  html += '.logo-fallback{font-size:4mm;font-weight:700;color:' + RED + '}';
  html += '.fed-name{font-family:"Shippori Mincho","Georgia","Times New Roman",serif;font-size:8pt;font-weight:800;letter-spacing:0.05pt;text-transform:uppercase;color:' + INK + ';line-height:1.2;min-width:0}';
  html += '.fed-name>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.head-right{flex-shrink:0;text-align:right}';
  html += '.hd-carteira{font-family:"Shippori Mincho","Georgia","Times New Roman",serif;font-size:6.6pt;font-weight:600;color:' + INK_2 + ';text-align:right}';
  html += '.hd-sub{font-size:3.7pt;font-weight:600;letter-spacing:0.6pt;text-transform:uppercase;color:' + INK_3 + ';text-align:right;margin-top:0.6mm}';
  html += '.hd-badge{font-size:4.6pt;letter-spacing:0.3pt;text-transform:uppercase;color:' + INK_2 + ';font-weight:600;display:flex;align-items:center;gap:0.8mm;justify-content:flex-end;margin-top:0.7mm}';
  html += '.badge-sq{width:1.15mm;height:1.15mm;background:' + BLACK_BAR + ';display:inline-block}';
  html += '.hd-verso{font-size:3.7pt;font-weight:600;letter-spacing:0.7pt;text-transform:uppercase;color:' + INK_3 + '}';

  // réguas
  html += '.ruler-red{margin:2.85mm -6.2mm 0;height:0.3mm;background:' + RED + '}';
  html += '.black-bar{margin:0.2mm -6.2mm 0;height:1.05mm;background:' + BLACK_BAR + '}';

  // body
  html += '.body-row{display:flex;gap:4.3mm;margin-top:1.8mm;flex:1;min-height:0;align-items:flex-start}';
  html += '.photo{width:21.7mm;height:28.9mm;flex-shrink:0;border-radius:1.4mm;border:0.15mm solid ' + LINE_2 + ';object-fit:cover;background:#faf8f3}';
  html += '.photo-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4mm;font-family:"DM Mono","Consolas","Courier New",monospace;font-size:4.6pt;font-weight:600;letter-spacing:0.5pt;color:' + INK_4 + '}';
  html += '.photo-sub{font-size:4.2pt}';
  html += '.fields{flex:1;min-width:0;display:flex;flex-direction:column;gap:2.4mm}';
  html += '.flabel{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:3.9pt;font-weight:600;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_3 + '}';
  html += '.fvalue{font-family:"Zen Kaku Gothic New","Arial","Helvetica Neue",Arial,sans-serif;font-size:6.4pt;font-weight:700;color:' + INK + ';margin-top:0.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.fvalue.dojo{white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;line-height:1.05;font-size:5.8pt;height:6.2mm;font-weight:900}';
  html += '.frow{display:flex;gap:2.6mm}';
  html += '.f-date{width:14mm;flex:none;min-width:0}';
  html += '.f-dojo{flex:1;min-width:0}';
  html += '.f-half{flex:1;min-width:0}';
  html += '.fvalue.name{font-size:9pt;font-weight:700;white-space:normal}';
  html += '.fvalue.mono{font-family:"DM Mono","Consolas","Courier New",monospace;font-weight:700}';
  html += '.name-fld{margin-bottom:0.4mm}';
  html += '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:2.6mm 2.7mm}';
  html += '.reg-fld{margin-top:1.6mm}';
  html += '.is-preta .body-row{margin-top:0.5mm}';
  html += '.is-preta .fields{gap:1.1mm}';
  html += '.is-preta .name-fld{margin-bottom:0mm}';
  html += '.is-preta .reg-fld{margin-top:0.6mm}';
  html += '.is-preta .grid2{gap:1.7mm 2.7mm}';
  html += '.is-preta .fvalue.dojo{height:5.0mm;-webkit-line-clamp:2}';
  html += '.is-preta .belt-line{margin-top:0.5mm}';
  html += '.reg-num{font-size:7.6pt;font-weight:700;color:' + RED + ';letter-spacing:0.2pt}';
  html += '.cbkt-fld{margin-top:1.0mm}';
  html += '.cbkt-num{font-family:"DM Mono","Consolas","Courier New",monospace;font-weight:700;font-size:6.8pt;color:' + INK + ';letter-spacing:0.2pt}';
  html += '.belt-line{display:flex;align-items:center;gap:1.1mm;margin-top:0.7mm}';
  html += '.belt-sq{width:1.9mm;height:1.9mm;background:' + BLACK_BAR + ';border-radius:0.3mm;flex-shrink:0}';
  html += '.belt-label{margin-top:0;font-weight:900}';

  // footer
  html += '.footer-row{margin-top:auto;display:flex;align-items:flex-end;justify-content:flex-end}';
  html += '.pres-line{width:20mm;height:0.15mm;background:' + INK_4 + '}';
  html += '.pres-label{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:3.4pt;font-weight:600;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_3 + ';margin-top:0.9mm}';
  html += '.valid-col{display:flex;align-items:center;gap:1.2mm}';
  html += '.valid-dot{width:0.7mm;height:0.7mm;border-radius:0.4mm;background:' + RED + ';flex-shrink:0}';
  html += '.valid-text{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:3.2pt;font-weight:600;letter-spacing:0.4pt;text-transform:uppercase;color:' + INK_3 + ';text-align:right;line-height:1.5}';

  // verso body
  html += '.back-row{display:flex;flex:1;margin-top:1.8mm;min-height:0}';
  html += '.kun-col{flex:1.45;padding-right:3.2mm;display:flex;flex-direction:column;justify-content:flex-start}';
  html += '.kun-eyebrow{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:3.9pt;font-weight:700;letter-spacing:0.55pt;text-transform:uppercase;color:' + RED + '}';
  html += '.kun-title{font-family:"Shippori Mincho","Georgia","Times New Roman",serif;font-size:6.4pt;font-weight:700;margin-top:0.4mm;color:' + INK + '}';
  html += '.kun-list{margin-top:0.5mm;display:flex;flex-direction:column;gap:1.05mm}';
  html += '.kun-item{display:flex;align-items:flex-start;gap:1.5mm}';
  html += '.kun-dot{width:2.6mm;flex-shrink:0;text-align:center;font-size:8pt;line-height:1.15;font-weight:700;color:' + RED + '}';
  html += '.kun-text{flex:1;min-width:0;font-family:"Zen Kaku Gothic New","Arial","Helvetica Neue",Arial,sans-serif;font-size:5.7pt;font-weight:900;line-height:1.15;color:' + INK + '}';
  html += '.verify-col{flex:1;border-left:0.15mm solid ' + LINE + ';padding-left:3.2mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center}';
  html += '.verify-eyebrow{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:3.9pt;font-weight:700;letter-spacing:0.55pt;text-transform:uppercase;color:' + INK_3 + ';line-height:1.15}';
  html += '.verify-title{font-family:"Shippori Mincho","Georgia","Times New Roman",serif;font-size:6.8pt;font-weight:700;margin-top:0.6mm;color:' + INK + ';line-height:1.15}';
  html += '.qr{width:12.5mm;height:12.5mm;margin-top:1.0mm;background:#fff;image-rendering:pixelated}';
  html += '.verify-num{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:5.2pt;font-weight:700;color:' + INK + ';margin-top:0.8mm;letter-spacing:0.2pt;line-height:1.15}';
  html += '.issued-col{margin-top:0.8mm}';
  html += '.issued-label{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:3.4pt;font-weight:600;letter-spacing:0.5pt;text-transform:uppercase;color:' + INK_3 + ';line-height:1.15}';
  html += '.issued-value{font-family:"DM Mono","Consolas","Courier New",monospace;font-size:5.2pt;font-weight:700;margin-top:0.3mm;color:' + INK + ';line-height:1.15}';

  // ── Controles de tela (escondidos na impressão) ──
  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  // ── Intensificações exclusivas de impressão (não tocam a prévia em tela) ──
  // Sintoma 1 (fontes fracas): rótulos abaixo de ~4.5pt somem/ficam cinza
  // claro no papel — sobe tamanho mínimo, peso e escurece p/ PRINT_LABEL.
  // Sintoma 3 (linhas somem): bordas 0.15–0.18mm em cinza claro viram
  // ≥0.3mm em PRINT_LINE/PRINT_LINE_2. Sintoma 5 (logo fraca): reforça
  // contraste do logo-img (a marca-d'água .wm permanece intocada — opacidade
  // baixa é intencional).
  html += '@media print{';
  html += '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}';
  html += '.print-fab{display:none!important}.top-bar{display:none!important}';
  html += '.grid{padding-top:0;padding-bottom:0}body{background:#fff}';
  // bordas e réguas
  html += '.cr80{border-width:0.32mm;border-color:' + PRINT_LINE_2 + '}';
  html += '.photo{border-width:0.32mm;border-color:' + PRINT_LINE_2 + '}';
  html += '.verify-col{border-left-width:0.32mm;border-left-color:' + PRINT_LINE + '}';
  html += '.ruler-red{height:0.4mm}';
  html += '.black-bar{height:1.3mm}';
  // rótulos pequenos — sobe tamanho mínimo (nada abaixo de 4.5pt), peso e escurece
  html += '.hd-sub{font-size:4.6pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.hd-verso{font-size:4.6pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.flabel{font-size:4.6pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.kun-eyebrow{font-size:4.6pt;font-weight:700}';
  html += '.kun-dot{font-size:9.5pt}';
  html += '.verify-eyebrow{font-size:4.6pt;font-weight:700;color:' + PRINT_LABEL + '}';
  html += '.pres-label{font-size:4.5pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.valid-text{font-size:4.5pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.issued-label{font-size:4.5pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.photo-sub{font-size:4.6pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.photo-empty{font-size:4.8pt;font-weight:600;color:' + PRINT_LABEL + '}';
  html += '.hd-badge{font-weight:600;color:' + INK_2 + '}';
  html += '.hd-carteira{font-weight:600}';
  // valores — cor sólida + peso >=600 (nome, faixa, nº registro, CBKT, etc.)
  html += '.fvalue{font-weight:700;color:' + INK + '}';
  html += '.fvalue.mono{font-weight:700}';
  html += '.fvalue.name{font-weight:700}';
  html += '.reg-num{font-weight:700;color:' + RED + '}';
  html += '.cbkt-num{font-weight:700}';
  html += '.belt-label{font-weight:900}';
  html += '.verify-num{font-weight:700;color:' + INK + '}';
  html += '.issued-value{font-weight:700;color:' + INK + '}';
  // logo — cor/contraste garantidos mesmo se o raster for de baixo contraste
  html += '.logo-img{filter:contrast(1.12) saturate(1.05)}';
  // marca d'água — impressão clareia tons claros; sobe um pouco mais que a
  // tela para permanecer perceptível no papel, sem competir com o texto
  // (a marca fica em z-index:1, sempre atrás de .face-pad z-index:2).
  html += '.wm-front,.wm-back{opacity:0.22}';
  html += '}';

  return html;
}

// Preview de UM cartão (frente OU verso) usando exatamente o mesmo HTML/CSS
// da impressão — usado pelo <iframe> do CarteirinhaPanel (preview = impressão).
// Um pequeno script escala o cartão (tamanho físico em mm) para preencher a
// largura do iframe, mantendo a proporção CR80.
export function buildSingleCardHtml(card: MembershipCard, face: "front" | "back"): string {
  const inner = face === "back" ? renderBack(card) : renderFront(card);
  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<style>' + cardCss();
  html += 'html,body{background:transparent!important}';
  html += 'body{margin:0;overflow:hidden}';
  html += '#wrap{transform-origin:top left}';
  html += '#wrap .cr80{box-shadow:0 6px 20px rgba(0,0,0,0.10)}';
  html += '</style></head><body>';
  html += '<div id="wrap">' + inner + '</div>';
  html += '<script>(function(){function fit(){var w=document.getElementById("wrap");if(!w)return;var c=w.firstElementChild;if(!c)return;var s=window.innerWidth/c.offsetWidth;w.style.transform="scale("+s+")";document.body.style.height=(c.offsetHeight*s)+"px";}window.addEventListener("resize",fit);fit();setTimeout(fit,60);setTimeout(fit,300);})();<\/script>';
  html += '</body></html>';
  return html;
}

export function buildCarteirinhaHtml(cards: MembershipCard[], options?: CarteirinhaBatchOptions): string {
  const total = cards.length;

  const cells = cards.map(function (card) {
    return renderFront(card, options) + "\n" + renderBack(card, options);
  }).join("\n");

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Carteirinhas Aura - ' + total + ' carteirinha(s)</title>';
  html += '<style>' + cardCss() + '</style></head><body>';

  html += '<div class="top-bar"><div><span>Carteirinhas Aura — A4, ' + CARD_W_MM + 'mm x ' + CARD_H_MM + 'mm · frente e verso</span><br>';
  html += '<b>' + total + ' carteirinha' + (total > 1 ? 's' : '') + ' selecionada' + (total > 1 ? 's' : '') + ' (' + (total * 2) + ' cartões p/ impressão)</b></div></div>';

  html += '<div class="grid">' + cells + '</div>';

  html += '<button class="print-fab" onclick="auraPrint()">Imprimir</button>';

  // Sintoma 2 (fontes fracas por causa de web-font ainda não carregada): o
  // botão Imprimir chama auraPrint() em vez de window.print() direto —
  // aguarda document.fonts.ready (Shippori Mincho/Zen Kaku Gothic New/DM Mono)
  // antes de abrir o diálogo, com timeout de segurança de 1.5s caso a API não
  // exista ou a Promise nunca resolva (rede lenta/offline).
  html += '<script>';
  html += 'function auraPrint(){';
  html += 'var done=false;function go(){if(done)return;done=true;window.print();}';
  html += 'var specs=[\'700 6pt "Zen Kaku Gothic New"\',\'600 6pt "Zen Kaku Gothic New"\',\'700 8pt "Shippori Mincho"\',\'600 8pt "Shippori Mincho"\',\'700 6pt "DM Mono"\',\'600 6pt "DM Mono"\',\'500 6pt "DM Mono"\'];';
  html += 'if(document.fonts&&document.fonts.load){try{specs.forEach(function(s){document.fonts.load(s);});}catch(e){}}';
  html += 'if(document.fonts&&document.fonts.ready){';
  html += 'setTimeout(go,1500);';
  html += 'document.fonts.ready.then(go,go);';
  html += '}else{go();}';
  html += '}';
  html += '<\/script>';

  html += '</body></html>';
  return html;
}

export default buildCarteirinhaHtml;
