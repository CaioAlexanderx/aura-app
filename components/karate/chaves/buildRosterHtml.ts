// ============================================================
// buildRosterHtml — Aura Karatê (Workspace do campeonato)
//
// Gera HTML de impressão da lista de inscritos de UMA categoria
// (aba "Inscritos" do workspace em torneio/[id].tsx): nome, nº de
// registro, dojô, status e colocação já lançada. Segue o MESMO padrão
// de buildBracketHtml.ts (HTML/CSS puro, P&B-safe, botão flutuante
// "Imprimir" via window.print(), @media print escondendo os controles
// de tela) — o componente que chama este builder é responsável por
// Blob + URL.createObjectURL + window.open (ver handlePrint em
// BracketView.tsx para o padrão exato de abertura).
//
// FASE 2 (refinamento do stub da Fase 1):
//   - Ordena por NOME (ordem alfabética) — é lista de chamada usada na
//     mesa de arbitragem para conferir presença; ordem por nome é o
//     que os árbitros/organizadores esperam encontrar, não por nº de
//     registro (que não segue nenhuma ordem previsível para quem
//     confere presença visualmente).
//   - Cabeçalho passa a incluir a data do evento (quando disponível),
//     junto de federação/categoria/modalidade/competição, para a folha
//     impressa não depender só da data de impressão.
// ============================================================
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const PAPER = "#f0ebe0";
const PAPER_WARM = "#f6f1e7";

export type RosterEntryLike = {
  student_name: string;
  karate_registration_number?: string | null;
  dojo_name?: string | null;
  status?: string | null;
  placement?: number | null;
};

export type BuildRosterHtmlOptions = {
  competitionName?: string;
  categoryName?: string;
  federationName?: string;
  modalityLabel?: string;
  /** Data do evento já formatada (tz-safe), ex.: "20/09/2026". Opcional. */
  eventDateLabel?: string | null;
};

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtBRDateTime(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = {
  registered: "Inscrito",
  confirmed: "Confirmado",
  checked_in: "Check-in",
  competing: "Em disputa",
  done: "Concluído",
  withdrawn: "Desistiu",
};

function statusLabel(status?: string | null): string {
  if (!status) return "—";
  return STATUS_LABEL[status] ?? esc(status);
}

// Ordem de chamada: alfabética por nome (localeCompare pt-BR, acento-safe).
// Não muda o array recebido (evita efeito colateral em quem chama).
function sortByName(entries: RosterEntryLike[]): RosterEntryLike[] {
  return [...entries].sort((a, b) =>
    String(a.student_name || "").localeCompare(String(b.student_name || ""), "pt-BR", { sensitivity: "base" })
  );
}

function renderRow(entry: RosterEntryLike, index: number): string {
  const reg = entry.karate_registration_number ? esc(entry.karate_registration_number) : "—";
  const dojo = entry.dojo_name ? esc(entry.dojo_name) : "—";
  const placement = entry.placement ? `${entry.placement}º` : "—";
  return (
    '<tr>' +
      '<td class="col-num">' + (index + 1) + '</td>' +
      '<td class="col-name">' + esc(entry.student_name) + '</td>' +
      '<td class="col-reg">' + reg + '</td>' +
      '<td class="col-dojo">' + dojo + '</td>' +
      '<td class="col-status">' + statusLabel(entry.status) + '</td>' +
      '<td class="col-place">' + placement + '</td>' +
    '</tr>'
  );
}

/** Gera um documento HTML completo (P&B-safe) para impressão da lista de inscritos de uma categoria. */
export function buildRosterHtml(entries: RosterEntryLike[], options?: BuildRosterHtmlOptions): string {
  const printedAt = fmtBRDateTime(new Date());
  const federationName = options?.federationName || "Aura Karatê";
  const competitionName = options?.competitionName || "";
  const categoryName = options?.categoryName || "";
  const modalityLabel = options?.modalityLabel || "";
  const eventDateLabel = options?.eventDateLabel || "";

  const sorted = sortByName(entries);

  const subtitleParts = [categoryName, modalityLabel, competitionName].filter(Boolean).map(esc);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" &middot; ") : "";
  const dateLine = eventDateLabel ? esc(eventDateLabel) : "";

  const rowsHtml = sorted.length > 0
    ? sorted.map((e, i) => renderRow(e, i)).join("\n")
    : '<tr><td class="col-empty" colspan="6">Nenhum inscrito nesta categoria.</td></tr>';

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Lista de inscritos - ' + esc(categoryName || "Categoria") + '</title>';
  html += '<style>';
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4 portrait;margin:12mm 10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'html,body{background:' + PAPER + ';color:' + INK + ';font-family:"Zen Kaku Gothic New",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}';

  html += '.sheet{padding:56px 6px 30px}';
  html += '.header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid ' + INK + ';padding-bottom:8px;margin-bottom:14px}';
  html += '.header-left{display:flex;flex-direction:column;gap:2px}';
  html += '.fed-name{font-family:"Shippori Mincho",serif;font-size:12pt;font-weight:500;color:' + INK + '}';
  html += '.cat-name{font-size:9.5pt;font-weight:700;color:' + INK + ';margin-top:2px}';
  html += '.meta-line{font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_3 + ';margin-top:2px}';
  html += '.header-right{text-align:right;font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_3 + '}';

  html += '.roster-table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}';
  html += '.roster-table thead{display:table-header-group}';
  html += '.roster-table tr{page-break-inside:avoid}';
  html += '.roster-table th{font-family:"DM Mono",monospace;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6pt;color:' + INK_2 + ';text-align:left;padding:5px 6px;border:1px solid ' + INK + ';background:' + PAPER_WARM + '}';
  html += '.roster-table td{padding:4px 6px;border:1px solid ' + INK_4 + ';color:' + INK + ';vertical-align:middle;line-height:1.3}';
  html += '.roster-table .col-num{width:28px;text-align:center;font-family:"DM Mono",monospace;font-weight:700}';
  html += '.roster-table .col-name{width:32%;font-weight:600}';
  html += '.roster-table .col-reg{width:14%;font-family:"DM Mono",monospace}';
  html += '.roster-table .col-dojo{width:24%}';
  html += '.roster-table .col-status{width:14%}';
  html += '.roster-table .col-place{width:60px;text-align:center;font-family:"DM Mono",monospace;font-weight:700}';
  html += '.col-empty{text-align:center;font-style:italic;color:' + INK_3 + ';padding:16px 6px}';

  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.sheet{padding-top:0}html,body{background:#fff}.roster-table th{background:' + PAPER_WARM + '!important}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Lista de inscritos Aura</span><br>';
  html += '<b>' + esc(categoryName || "Categoria") + (competitionName ? " &middot; " + esc(competitionName) : "") + '</b></div></div>';

  html += '<div class="sheet">';
  html += '<div class="header">';
  html += '<div class="header-left">';
  html += '<div class="fed-name">' + esc(federationName) + '</div>';
  if (subtitle) html += '<div class="cat-name">' + subtitle + '</div>';
  html += '<div class="meta-line">' + sorted.length + ' inscrito' + (sorted.length === 1 ? "" : "s") + (dateLine ? " &middot; Evento em " + dateLine : "") + '</div>';
  html += '</div>';
  html += '<div class="header-right">Impresso em ' + esc(printedAt) + '</div>';
  html += '</div>';

  html += '<table class="roster-table">';
  html += '<thead><tr>';
  html += '<th class="col-num">Nº</th>';
  html += '<th class="col-name">Nome</th>';
  html += '<th class="col-reg">Registro</th>';
  html += '<th class="col-dojo">Dojô</th>';
  html += '<th class="col-status">Status</th>';
  html += '<th class="col-place">Coloc.</th>';
  html += '</tr></thead>';
  html += '<tbody>' + rowsHtml + '</tbody>';
  html += '</table>';
  html += '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

export default buildRosterHtml;
