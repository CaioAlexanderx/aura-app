// ============================================================
// buildKataHtml — Aura Karatê (Fase 4: impressão da bateria de Kata)
//
// Gera um documento HTML completo para impressão da bateria de Kata:
// tabela da eliminatória (ordem de apresentação + nota + classificação)
// e tabela da final (ordem + nota + medalhas), no MESMO padrão de
// buildBracketHtml.ts (paleta Shoji colorida + @media print P&B-safe +
// botão flutuante "Imprimir" + Blob/window.open no componente chamador).
//
// P&B: classificação/medalha NUNCA é indicada só por cor — usamos texto
// ("Classificada"/"Eliminada", "Ouro"/"Prata"/"Bronze"), negrito na
// primeira colocação e borda mais escura, igual à decisão já tomada
// para o vencedor no bracket de Kumite.
// ============================================================
import type { KataScore } from "@/services/karateBracketsApi";

const RED = "#b8463a";
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const PAPER = "#f0ebe0";

const MEDALS = ["Ouro", "Prata", "Bronze"];

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtBRDateTime(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtNota(nota: number | null): string {
  return nota !== null && nota !== undefined ? nota.toFixed(1).replace(".", ",") : "—";
}

function renderRow(s: KataScore, idx: number, isFinal: boolean): string {
  const pos = s.presentation_order ?? idx + 1;
  const isFirst = idx === 0;
  const rowClass = "row" + (isFirst ? " row-first" : "");

  let statusHtml: string;
  if (isFinal) {
    statusHtml = idx < 3
      ? '<span class="medal">' + esc(MEDALS[idx]) + '</span>'
      : '<span class="pos-plain">' + (idx + 1) + 'º</span>';
  } else {
    if (s.advances === true) statusHtml = '<span class="tag tag-adv">Classificada</span>';
    else if (s.advances === false) statusHtml = '<span class="tag tag-elim">Eliminada</span>';
    else statusHtml = '<span class="tag tag-pending">—</span>';
  }

  return (
    '<tr class="' + rowClass + '">' +
      '<td class="col-order">' + esc(String(pos)) + '</td>' +
      '<td class="col-name"><div class="athlete-name' + (isFinal && idx < 3 ? ' bold' : '') + '">' + esc(s.student_name) + '</div>' +
        '<div class="athlete-dojo">' + esc(s.dojo_name || "&mdash;") + '</div></td>' +
      '<td class="col-nota">' + esc(fmtNota(s.nota)) + '</td>' +
      '<td class="col-status">' + statusHtml + '</td>' +
    '</tr>'
  );
}

function renderTable(title: string, subtitle: string, rows: KataScore[], isFinal: boolean): string {
  if (!rows.length) return "";
  const sorted = [...rows].sort((a, b) => {
    const ao = a.presentation_order;
    const bo = b.presentation_order;
    if (ao !== null && ao !== undefined && bo !== null && bo !== undefined) return ao - bo;
    return (b.nota ?? -1) - (a.nota ?? -1);
  });
  const bodyRows = sorted.map((s, i) => renderRow(s, i, isFinal)).join("\n");
  return (
    '<div class="table-block">' +
      '<div class="table-head"><span class="table-title">' + esc(title) + '</span><span class="table-sub">' + esc(subtitle) + '</span></div>' +
      '<table>' +
        '<thead><tr><th class="col-order">Ordem</th><th class="col-name">Atleta / Dojô</th><th class="col-nota">Nota</th><th class="col-status">' + (isFinal ? "Classificação" : "Status") + '</th></tr></thead>' +
        '<tbody>' + bodyRows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

export type BuildKataHtmlOptions = {
  competitionName?: string;
  categoryName?: string;
  federationName?: string;
};

export function buildKataHtml(scores: KataScore[], options?: BuildKataHtmlOptions): string {
  const printedAt = fmtBRDateTime(new Date());
  const federationName = options?.federationName || "Aura Karatê";
  const competitionName = options?.competitionName || "";
  const categoryName = options?.categoryName || "";

  const elim = scores.filter((s) => s.phase === "eliminatoria");
  const final = scores.filter((s) => s.phase === "final");

  const subtitleParts = [categoryName, competitionName].filter(Boolean).map(esc);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" &middot; ") : "";

  const elimTable = renderTable("Eliminatória", elim.length + " atletas", elim, false);
  const finalTable = renderTable("Final", final.length + " finalistas · medalhas", final, true);

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Bateria - ' + esc(categoryName || "Kata") + '</title>';
  html += '<style>';
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4 portrait;margin:14mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'html,body{background:' + PAPER + ';color:' + INK + ';font-family:"Zen Kaku Gothic New",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}';

  html += '.sheet{padding:70px 8px 60px}';
  html += '.header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid ' + INK + ';padding-bottom:10px;margin-bottom:24px}';
  html += '.header-left{display:flex;flex-direction:column;gap:2px}';
  html += '.fed-name{font-family:"Shippori Mincho",serif;font-size:14pt;font-weight:500;color:' + INK + '}';
  html += '.cat-name{font-size:10.5pt;font-weight:700;color:' + INK + ';margin-top:4px}';
  html += '.header-right{text-align:right;font-family:"DM Mono",monospace;font-size:8pt;color:' + INK_3 + '}';

  html += '.table-block{margin-bottom:30px}';
  html += '.table-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(43,38,32,0.17);padding-bottom:6px;margin-bottom:10px}';
  html += '.table-title{font-family:"Shippori Mincho",serif;font-size:13pt;font-weight:500;color:' + INK + '}';
  html += '.table-sub{font-family:"DM Mono",monospace;font-size:8pt;color:' + INK_3 + '}';

  html += 'table{width:100%;border-collapse:collapse;background:#fff;border:1.3px solid ' + INK + ';border-radius:6px;overflow:hidden}';
  html += 'thead th{font-family:"DM Mono",monospace;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1pt;color:' + INK_2 + ';text-align:left;padding:8px 10px;border-bottom:1.3px solid ' + INK + ';background:#eeeae2}';
  html += 'th.col-order,td.col-order{text-align:center;width:60px}';
  html += 'th.col-nota,td.col-nota{text-align:center;width:80px;font-family:"DM Mono",monospace}';
  html += 'th.col-status,td.col-status{text-align:center;width:130px}';
  html += 'tbody td{padding:7px 10px;border-top:1px solid rgba(43,38,32,0.12);font-size:9pt;vertical-align:middle}';

  html += 'tr.row-first{background:#eeeae2}';
  html += 'tr.row-first td:first-child{border-left:3px solid ' + INK + '}';

  html += '.athlete-name{font-size:9.2pt;font-weight:500;color:' + INK + '}';
  html += '.athlete-name.bold{font-weight:700}';
  html += '.athlete-dojo{font-family:"DM Mono",monospace;font-size:7pt;color:' + INK_3 + ';margin-top:1px}';
  html += '.col-nota{font-weight:700;font-size:10pt;color:' + INK + '}';

  html += '.tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6pt;border:1px solid ' + INK_3 + '}';
  html += '.tag-adv{border-color:' + INK + ';color:' + INK + ';background:#eeeae2}';
  html += '.tag-elim{border-color:' + INK_4 + ';color:' + INK_3 + ';background:transparent}';
  html += '.tag-pending{border-color:' + INK_4 + ';color:' + INK_4 + ';background:transparent}';

  html += '.medal{font-weight:700;font-size:9pt;color:' + INK + ';text-transform:uppercase;letter-spacing:0.5pt}';
  html += '.pos-plain{font-family:"DM Mono",monospace;font-size:9pt;color:' + INK_3 + '}';

  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.sheet{padding-top:0}html,body{background:#fff}table{background:#fff}thead th{background:#eeeae2!important}tr.row-first{background:#eeeae2!important}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Bateria Aura &mdash; A4 retrato</span><br>';
  html += '<b>' + esc(categoryName || "Kata") + (competitionName ? " &middot; " + esc(competitionName) : "") + '</b></div></div>';

  html += '<div class="sheet">';
  html += '<div class="header">';
  html += '<div class="header-left">';
  html += '<div class="fed-name">' + esc(federationName) + '</div>';
  if (subtitle) html += '<div class="cat-name">' + subtitle + '</div>';
  html += '</div>';
  html += '<div class="header-right">Impresso em ' + esc(printedAt) + '</div>';
  html += '</div>';

  html += elimTable;
  html += finalTable;
  html += '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

export default buildKataHtml;
