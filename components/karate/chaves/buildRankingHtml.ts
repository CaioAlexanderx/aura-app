// ============================================================
// buildRankingHtml — Aura Karatê (Workspace do campeonato, Fase 2)
//
// Gera um documento HTML completo (P&B-safe) para impressão do RANKING
// GERAL do campeonato (classificação consolidada por atleta, somando
// points_awarded de todas as categorias em que competiu). Segue o MESMO
// padrão de buildBracketHtml.ts / buildRosterHtml.ts: HTML/CSS puro
// (sem dependência de RN), botão flutuante "Imprimir" via
// window.print(), @media print escondendo os controles de tela — o
// componente que chama este builder é responsável por
// Blob + URL.createObjectURL + window.open (ver handlePrint em
// BracketView.tsx / handlePrintRoster em torneio/[id].tsx).
// ============================================================
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const PAPER = "#f0ebe0";
const PAPER_WARM = "#f6f1e7";
const GOLD_BG = "#f6f1e7";

export type RankingRowLike = {
  student_id: string;
  student_name: string;
  dojo_name?: string | null;
  total_points: number;
  categories: string[];
  gold: number;
  silver: number;
  bronze: number;
};

export type BuildRankingHtmlOptions = {
  competitionName?: string;
  federationName?: string;
  eventDateLabel?: string | null;
};

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtBRDateTime(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// P&B: a posição (1º/2º/3º) NUNCA é indicada só por cor de medalha —
// sempre acompanhada do número por extenso na coluna "Pos." e do
// contador de medalhas (Ouro/Prata/Bronze) em texto simples.
function renderRow(row: RankingRowLike, position: number): string {
  const isPodium = position <= 3;
  const medals: string[] = [];
  if (row.gold > 0) medals.push(row.gold + "x Ouro");
  if (row.silver > 0) medals.push(row.silver + "x Prata");
  if (row.bronze > 0) medals.push(row.bronze + "x Bronze");
  const medalsLabel = medals.length > 0 ? medals.join(", ") : "&mdash;";
  const cats = row.categories.length > 0 ? row.categories.map(esc).join(", ") : "&mdash;";
  const dojo = row.dojo_name ? esc(row.dojo_name) : "&mdash;";

  return (
    '<tr class="' + (isPodium ? "podium-row" : "") + '">' +
      '<td class="col-pos">' + position + 'º</td>' +
      '<td class="col-name">' + esc(row.student_name) + '</td>' +
      '<td class="col-dojo">' + dojo + '</td>' +
      '<td class="col-cats">' + cats + '</td>' +
      '<td class="col-medals">' + medalsLabel + '</td>' +
      '<td class="col-pts">' + row.total_points + '</td>' +
    '</tr>'
  );
}

/** Gera um documento HTML completo (P&B-safe) para impressão do ranking geral do campeonato. */
export function buildRankingHtml(rows: RankingRowLike[], options?: BuildRankingHtmlOptions): string {
  const printedAt = fmtBRDateTime(new Date());
  const federationName = options?.federationName || "Aura Karatê";
  const competitionName = options?.competitionName || "";
  const eventDateLabel = options?.eventDateLabel || "";

  const metaParts = [competitionName, eventDateLabel].filter(Boolean).map(esc);
  const subtitle = metaParts.length > 0 ? metaParts.join(" &middot; ") : "";

  const rowsHtml = rows.length > 0
    ? rows.map((r, i) => renderRow(r, i + 1)).join("\n")
    : '<tr><td class="col-empty" colspan="6">Nenhum resultado lançado ainda.</td></tr>';

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Ranking geral - ' + esc(competitionName || "Campeonato") + '</title>';
  html += '<style>';
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4 portrait;margin:12mm 10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'html,body{background:' + PAPER + ';color:' + INK + ';font-family:"Zen Kaku Gothic New",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}';

  html += '.sheet{padding:56px 6px 30px}';
  html += '.header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid ' + INK + ';padding-bottom:8px;margin-bottom:14px}';
  html += '.header-left{display:flex;flex-direction:column;gap:2px}';
  html += '.fed-name{font-family:"Shippori Mincho",serif;font-size:12pt;font-weight:500;color:' + INK + '}';
  html += '.comp-name{font-size:9.5pt;font-weight:700;color:' + INK + ';margin-top:2px}';
  html += '.meta-line{font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_3 + ';margin-top:2px}';
  html += '.header-right{text-align:right;font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_3 + '}';

  html += '.ranking-table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}';
  html += '.ranking-table thead{display:table-header-group}';
  html += '.ranking-table tr{page-break-inside:avoid}';
  html += '.ranking-table th{font-family:"DM Mono",monospace;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6pt;color:' + INK_2 + ';text-align:left;padding:5px 6px;border:1px solid ' + INK + ';background:' + PAPER_WARM + '}';
  html += '.ranking-table td{padding:4px 6px;border:1px solid ' + INK_4 + ';color:' + INK + ';vertical-align:middle;line-height:1.3}';
  // P&B: pódio (top 3) destacado por fundo cinza-claro + negrito na posição
  // e no nome — funciona em grayscale, sem depender de cor de medalha.
  html += '.podium-row td{background:' + GOLD_BG + '}';
  html += '.podium-row .col-pos, .podium-row .col-name{font-weight:800}';
  html += '.ranking-table .col-pos{width:40px;text-align:center;font-family:"DM Mono",monospace;font-weight:700}';
  html += '.ranking-table .col-name{width:24%;font-weight:600}';
  html += '.ranking-table .col-dojo{width:20%}';
  html += '.ranking-table .col-cats{width:26%;font-size:7.8pt;color:' + INK_2 + '}';
  html += '.ranking-table .col-medals{width:16%;font-size:7.8pt}';
  html += '.ranking-table .col-pts{width:60px;text-align:center;font-family:"DM Mono",monospace;font-weight:800}';
  html += '.col-empty{text-align:center;font-style:italic;color:' + INK_3 + ';padding:16px 6px}';

  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.sheet{padding-top:0}html,body{background:#fff}.ranking-table th{background:' + PAPER_WARM + '!important}.podium-row td{background:' + GOLD_BG + '!important}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Ranking geral Aura</span><br>';
  html += '<b>' + esc(competitionName || "Campeonato") + '</b></div></div>';

  html += '<div class="sheet">';
  html += '<div class="header">';
  html += '<div class="header-left">';
  html += '<div class="fed-name">' + esc(federationName) + '</div>';
  if (subtitle) html += '<div class="comp-name">' + subtitle + '</div>';
  html += '<div class="meta-line">' + rows.length + ' atleta' + (rows.length === 1 ? "" : "s") + ' pontuando</div>';
  html += '</div>';
  html += '<div class="header-right">Impresso em ' + esc(printedAt) + '</div>';
  html += '</div>';

  html += '<table class="ranking-table">';
  html += '<thead><tr>';
  html += '<th class="col-pos">Pos.</th>';
  html += '<th class="col-name">Atleta</th>';
  html += '<th class="col-dojo">Dojô</th>';
  html += '<th class="col-cats">Categorias</th>';
  html += '<th class="col-medals">Medalhas</th>';
  html += '<th class="col-pts">Pontos</th>';
  html += '</tr></thead>';
  html += '<tbody>' + rowsHtml + '</tbody>';
  html += '</table>';
  html += '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

export default buildRankingHtml;
