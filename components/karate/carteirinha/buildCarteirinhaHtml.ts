// ============================================================
// buildCarteirinhaHtml — Aura Karatê (F5: impressão em lote)
//
// Gera um documento HTML completo para impressão de carteirinhas em A4,
// múltiplas por página (grid 2 colunas), no espírito do
// components/screens/estoque/labels/buildLabelHtml.ts (mesmo padrão de
// botão flutuante "Imprimir" + @media print escondendo controles).
//
// Reconstrói em HTML/CSS o layout de components/karate/CarteirinhaCard.tsx
// (frente apenas — verso/Dojo Kun fica fora do lote por ora, o objetivo é
// identificação rápida em lote). Mantém fidelidade nos campos: logo/nome da
// federação, nome do aluno, nº carteirinha, faixa com cor (KarateBelts),
// dojô, foto (se houver) e QR de verificação.
//
// QR: reutiliza o MESMO serviço público que buildLabelHtml.ts já usa em
// produção (api.qrserver.com) — não há gerador de QR "RN-only" reaproveitável
// fora de contexto React (PixQRCode/QrCode dependem de libs RN). Mesma URL de
// verificação do CarteirinhaCard: https://app.getaura.com.br/karate/verify/<token>.
//
// Tamanho do cartão: 80mm x 50mm — padrão da carteirinha emitida pela
// federação. O layout de impressão preserva exatamente essa dimensão.
// ============================================================
import { resolveBeltKey, KarateBelts } from "@/constants/karateTheme";
import type { MembershipCard } from "@/services/karateCardApi";

const ACCENT = "#D4121B";
const CARD_W_MM = 80;
const CARD_H_MM = 50;

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

function beltColor(card: MembershipCard): { bg: string; text: string; label: string } {
  const key = resolveBeltKey(card.belt_name || card.belt || "");
  if (key && KarateBelts[key]) {
    const b = KarateBelts[key];
    return { bg: b.color, text: b.textColor, label: card.belt_name || b.label };
  }
  return { bg: "#e0d8c6", text: "#2b2620", label: card.belt_name || card.belt || "—" };
}

function verifyUrlFor(card: MembershipCard): string {
  return `https://app.getaura.com.br/karate/verify/${encodeURIComponent(card.verify_token || "")}`;
}

function qrImgUrl(data: string, size = 150): string {
  return "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size +
    "&data=" + encodeURIComponent(data) + "&bgcolor=ffffff&color=000000&margin=1";
}

export type CarteirinhaBatchOptions = {
  federationName?: string;
};

export function buildCarteirinhaHtml(cards: MembershipCard[], options?: CarteirinhaBatchOptions): string {
  const total = cards.length;

  const cells = cards.map(function (card) {
    const belt = beltColor(card);
    const verifyUrl = verifyUrlFor(card);
    const qr = qrImgUrl(verifyUrl, 150);
    const logo = card.federation_logo
      ? '<img class="logo-img" src="' + esc(card.federation_logo) + '" alt="">'
      : '<div class="logo-fallback">空</div>';
    const federationLabel = esc(card.federation_name || options?.federationName || "Federação de Karatê");
    const photo = card.photo_url
      ? '<img class="photo" src="' + esc(card.photo_url) + '" alt="">'
      : '<div class="photo photo-empty">Foto</div>';

    return (
      '<div class="card">' +
        '<div class="card-head">' +
          '<div class="logo">' + logo + '</div>' +
          '<div class="head-text">' +
            '<div class="fed-name">' + federationLabel + '</div>' +
            '<div class="doc-title">Carteira do Atleta</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-body">' +
          photo +
          '<div class="fields">' +
            '<div class="field">' +
              '<div class="flabel">Nome</div>' +
              '<div class="fvalue name">' + esc(card.student_name) + '</div>' +
            '</div>' +
            '<div class="field-row">' +
              '<div class="field">' +
                '<div class="flabel">Nº registro</div>' +
                '<div class="fvalue mono accent">' + esc(card.card_number || "—") + '</div>' +
              '</div>' +
              '<div class="field">' +
                '<div class="flabel">Dojô</div>' +
                '<div class="fvalue">' + esc(card.dojo_name || "—") + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="belt-row">' +
              '<span class="belt-tag" style="background:' + belt.bg + ';color:' + belt.text + '">' + esc(belt.label) + '</span>' +
              '<span class="issued">Emissão: ' + fmtBR(card.issued_at) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="qr-col">' +
            '<img class="qr" src="' + qr + '" alt="QR de verificação">' +
            '<div class="qr-hint">verificar</div>' +
          '</div>' +
        '</div>' +
        '<div class="cut-hint"></div>' +
      '</div>'
    );
  }).join("\n");

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Carteirinhas Aura - ' + total + ' carteirinha(s)</title>';
  html += '<style>';
  html += '@page{size:A4;margin:10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#000}';
  html += '.grid{display:grid;grid-template-columns:repeat(2, ' + CARD_W_MM + 'mm);gap:6mm 8mm;justify-content:center;padding-top:64px;padding-bottom:80px}';
  html += '.card{width:' + CARD_W_MM + 'mm;height:' + CARD_H_MM + 'mm;background:#fcfcfd;border-radius:2.2mm;border:0.3mm solid rgba(0,0,0,0.12);overflow:hidden;page-break-inside:avoid;break-inside:avoid;display:flex;flex-direction:column;position:relative}';
  html += '.card-head{height:9mm;padding:0 3mm;display:flex;align-items:center;gap:2mm;border-bottom:0.6mm solid ' + ACCENT + ';background:#fff;flex-shrink:0}';
  html += '.logo{width:7mm;height:7mm;flex-shrink:0;display:flex;align-items:center;justify-content:center}';
  html += '.logo-img{max-width:100%;max-height:100%;object-fit:contain}';
  html += '.logo-fallback{font-size:5mm;color:' + ACCENT + '}';
  html += '.head-text{min-width:0;flex:1}';
  html += '.fed-name{font-size:6.2pt;font-weight:700;color:' + ACCENT + ';text-transform:uppercase;letter-spacing:0.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.doc-title{font-size:5.4pt;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.4pt}';
  html += '.card-body{flex:1;display:flex;padding:2mm 3mm;gap:2.4mm;min-height:0}';
  html += '.photo{width:12mm;height:15mm;border-radius:1mm;border:0.2mm solid rgba(17,17,17,0.16);object-fit:cover;flex-shrink:0;background:#f2f2f4}';
  html += '.photo-empty{display:flex;align-items:center;justify-content:center;font-size:5pt;color:#aaa;text-align:center}';
  html += '.fields{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1.2mm}';
  html += '.field{min-width:0}';
  html += '.field-row{display:flex;gap:2.4mm}';
  html += '.field-row .field{flex:1;min-width:0}';
  html += '.flabel{font-size:4.6pt;font-weight:700;letter-spacing:0.3pt;text-transform:uppercase;color:#8a8a8a;margin-bottom:0.3mm}';
  html += '.fvalue{font-size:6.6pt;font-weight:600;color:#161616;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.fvalue.name{font-size:7.6pt;font-weight:800}';
  html += '.fvalue.mono{font-family:"Courier New",monospace}';
  html += '.fvalue.accent{color:' + ACCENT + ';font-weight:800}';
  html += '.belt-row{display:flex;align-items:center;gap:1.6mm;margin-top:0.6mm}';
  html += '.belt-tag{font-size:5pt;font-weight:800;padding:0.5mm 1.6mm;border-radius:3mm;white-space:nowrap;text-transform:uppercase;letter-spacing:0.2pt}';
  html += '.issued{font-size:4.6pt;color:#9a9a9a;font-family:"Courier New",monospace}';
  html += '.qr-col{width:13mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.6mm}';
  html += '.qr{width:11mm;height:11mm;image-rendering:pixelated}';
  html += '.qr-hint{font-size:4pt;color:#9a9a9a;text-transform:uppercase;letter-spacing:0.3pt}';
  html += '.cut-hint{position:absolute;inset:0;border:0.15mm dashed rgba(0,0,0,0.15);border-radius:2.2mm;pointer-events:none}';

  // ── Controles de tela (escondidos na impressão) ──
  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.grid{padding-top:0;padding-bottom:0}body{background:#fff}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Carteirinhas Aura — A4, ' + CARD_W_MM + 'mm x ' + CARD_H_MM + 'mm</span><br>';
  html += '<b>' + total + ' carteirinha' + (total > 1 ? 's' : '') + ' selecionada' + (total > 1 ? 's' : '') + '</b></div></div>';

  html += '<div class="grid">' + cells + '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

export default buildCarteirinhaHtml;
