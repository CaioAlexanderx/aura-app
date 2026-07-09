// ============================================================
// buildBracketHtml — Aura Karatê (Fase 3: impressão da chave Kumite)
//
// Gera um documento HTML completo para impressão da chave (bracket)
// de Kumite: rounds em colunas (mesmos rótulos de roundLabel em
// components/karate/chaves/shared.tsx), coluna do Campeão e a
// disputa de 3º lugar quando existir. Segue o MESMO padrão de
// buildCarteirinhaHtml.ts (botão flutuante "Imprimir" via window.print(),
// @media print escondendo os controles de tela, Blob + window.open no
// handler do componente que chama este builder).
//
// Paleta Shoji colorida (tokens do design): papel #f0ebe0/#fff, tinta
// #2b2620, vermelhão #b8463a — igual ao app. Mas a impressão PRECISA
// funcionar bem em P&B no papel comum (impressora comum de escritório,
// sem toner colorido): por isso o vencedor NUNCA é marcado só pela cor.
// Ver decisões de legibilidade P&B no cabeçalho de cada regra de estilo
// abaixo (bloco "── P&B ──").
// ============================================================
import type { BracketState, BracketMatch, BracketAthleteRef } from "@/services/karateBracketsApi";

const RED = "#b8463a";
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const PAPER = "#f0ebe0";
const PAPER_WARM = "#f6f1e7";
const LINE = "rgba(43,38,32,0.10)";
const LINE_2 = "rgba(43,38,32,0.17)";

// Mesmos rótulos/lógica de components/karate/chaves/shared.tsx (roundLabel),
// duplicados aqui porque o builder de impressão não pode depender de RN
// (StyleSheet/View) — só HTML/CSS puro, no espírito de buildCarteirinhaHtml.ts.
// MANTER EM SINCRONIA com shared.tsx: rótulo por número de confrontos na
// rodada (2^(totalRounds-1-round)), não por índice fixo — suporta chaves
// de qualquer tamanho (64/128/256+ atletas) sem cair em "R{n}".
const ROUND_LABELS_BY_MATCHES: Record<number, string> = {
  1: "Final",
  2: "Semifinais",
  4: "Quartas",
  8: "Oitavas",
};
function roundLabel(round: number, totalRounds: number): string {
  const matches = Math.pow(2, totalRounds - 1 - round);
  return ROUND_LABELS_BY_MATCHES[matches] ?? `${matches}-avos`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtBRDateTime(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isAthlete(v: BracketAthleteRef | "bye" | null | undefined): v is BracketAthleteRef {
  return !!v && v !== "bye";
}

// ── Lado do match (aka/shiro) ───────────────────────────────────────────
// P&B: o vencedor NUNCA é indicado só por cor. Usamos:
//   - ✓ (caractere, sempre visível em preto/cinza)
//   - negrito no nome
//   - classe "winner" que aplica fundo cinza-claro (funciona em grayscale)
//     e borda mais escura — além do wash vermelho (só aparece a cores)
//   - o lado perdedor fica com opacidade reduzida (cinza mais claro em P&B)
function renderSide(
  value: BracketAthleteRef | "bye" | null | undefined,
  winnerId: string | null | undefined,
  otherValue: BracketAthleteRef | "bye" | null | undefined,
  side: "aka" | "shiro",
  score: number | undefined,
): string {
  const isBye = value === "bye";
  const athlete = isAthlete(value) ? value : null;
  const otherAthlete = isAthlete(otherValue) ? otherValue : null;
  const isWinner = !!winnerId && !!athlete && winnerId === athlete.entry_id;
  const isLoser = !!winnerId && !!otherAthlete && winnerId === otherAthlete.entry_id;

  const sideClass = "side side-" + side + (isWinner ? " winner" : "") + (isLoser ? " loser" : "");
  const dotClass = "dot dot-" + side;

  let body: string;
  if (isBye) {
    body = '<span class="bye">BYE</span>';
  } else if (athlete) {
    const scoreTag = (isWinner && typeof score === "number")
      ? '<span class="score">' + esc(String(score)) + '</span>'
      : "";
    const check = isWinner ? '<span class="check">&#10003;</span>' : "";
    body =
      '<span class="' + dotClass + '"></span>' +
      '<span class="athlete-block">' +
        '<span class="athlete-name">' + esc(athlete.student_name) + '</span>' +
        '<span class="athlete-dojo">' + esc(athlete.dojo_name || "&mdash;") + '</span>' +
      '</span>' +
      scoreTag + check;
  } else {
    body = '<span class="pending">a definir</span>';
  }

  return '<div class="' + sideClass + '">' + body + '</div>';
}

function renderMatch(match: BracketMatch, label?: string): string {
  const aka = renderSide(match.aka, match.winner_entry_id, match.shiro, "aka", match.aka_score);
  const shiro = renderSide(match.shiro, match.winner_entry_id, match.aka, "shiro", match.shiro_score);
  const labelHtml = label ? '<div class="match-label">' + esc(label) + '</div>' : "";
  return (
    '<div class="match">' +
      labelHtml +
      '<div class="match-box">' + aka + '<div class="match-divider"></div>' + shiro + '</div>' +
    '</div>'
  );
}

// ── Planilha de confrontos (chaves grandes) ─────────────────────────────
// Acima de 8 confrontos na 1ª fase (>16 atletas na chave), a árvore visual
// não cabe legível numa folha A4. Em vez disso, geramos uma PLANILHA
// paginada — uma tabela por fase, em ordem — que é a ferramenta real de
// controle do organizador no papel durante o evento: confronto nº, aka,
// shiro, vencedor e placar (em branco pra anotar à mão quando pendente).
const LARGE_BRACKET_THRESHOLD = 8; // confrontos na 1ª fase (> 8 = > 16 atletas)

function sideLabel(value: BracketAthleteRef | "bye" | null | undefined): string {
  if (value === "bye") return "BYE";
  if (isAthlete(value)) {
    const dojo = value.dojo_name ? " (" + value.dojo_name + ")" : "";
    return esc(value.student_name) + esc(dojo);
  }
  return "";
}

function winnerLabel(match: BracketMatch): string {
  const akaId = isAthlete(match.aka) ? match.aka.entry_id : null;
  const shiroId = isAthlete(match.shiro) ? match.shiro.entry_id : null;
  if (!match.winner_entry_id) return "";
  if (match.winner_entry_id === akaId) return sideLabel(match.aka);
  if (match.winner_entry_id === shiroId) return sideLabel(match.shiro);
  return "";
}

function scoreLabel(match: BracketMatch): string {
  const hasAny = typeof match.aka_score === "number" || typeof match.shiro_score === "number";
  if (!hasAny) return "";
  const a = typeof match.aka_score === "number" ? String(match.aka_score) : "&mdash;";
  const s = typeof match.shiro_score === "number" ? String(match.shiro_score) : "&mdash;";
  return a + " &times; " + s;
}

// Uma linha da tabela: nº do confronto (dentro da fase), aka, shiro,
// vencedor/placar já preenchidos se houver resultado, senão espaço em
// branco (célula ".blank") pra anotar à mão durante o evento.
function renderSheetRow(match: BracketMatch, indexInPhase: number): string {
  const akaIsBye = match.aka === "bye";
  const shiroIsBye = match.shiro === "bye";
  const akaText = sideLabel(match.aka) || (akaIsBye ? "BYE" : '<span class="tbd">a definir</span>');
  const shiroText = sideLabel(match.shiro) || (shiroIsBye ? "BYE" : '<span class="tbd">a definir</span>');
  const winner = winnerLabel(match);
  const score = scoreLabel(match);
  const rowClass = winner ? "row-done" : "row-pending";

  return (
    '<tr class="' + rowClass + '">' +
      '<td class="col-num">' + (indexInPhase + 1) + '</td>' +
      '<td class="col-aka">' + akaText + '</td>' +
      '<td class="col-shiro">' + shiroText + '</td>' +
      '<td class="col-winner">' + (winner || '<span class="blank"></span>') + '</td>' +
      '<td class="col-score">' + (score || '<span class="blank"></span>') + '</td>' +
    '</tr>'
  );
}

// Uma tabela por fase (rounds[] na ordem) + a disputa de 3º lugar, se houver.
// page-break-before entre fases (exceto a primeira) pra cada fase começar
// numa página nova quando fizer sentido — o navegador decide o encaixe
// real com page-break-inside:avoid nas linhas/tabela.
function renderSheetTables(bracket: BracketState, totalRounds: number): string {
  const phases = bracket.rounds.map(function (round, rIdx) {
    const label = roundLabel(rIdx, totalRounds);
    const rows = round.map(function (m, i) { return renderSheetRow(m, i); }).join("\n");
    return (
      '<section class="phase">' +
        '<h2 class="phase-head">' + esc(label) + '<span class="phase-count">' + round.length + ' confronto' + (round.length === 1 ? "" : "s") + '</span></h2>' +
        '<table class="sheet-table">' +
          '<thead><tr>' +
            '<th class="col-num">Nº</th>' +
            '<th class="col-aka">Aka</th>' +
            '<th class="col-shiro">Shiro</th>' +
            '<th class="col-winner">Vencedor</th>' +
            '<th class="col-score">Placar</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</section>'
    );
  });

  if (bracket.third_place_match) {
    phases.push(
      '<section class="phase">' +
        '<h2 class="phase-head">3º lugar<span class="phase-count">1 confronto</span></h2>' +
        '<table class="sheet-table">' +
          '<thead><tr>' +
            '<th class="col-num">Nº</th>' +
            '<th class="col-aka">Aka</th>' +
            '<th class="col-shiro">Shiro</th>' +
            '<th class="col-winner">Vencedor</th>' +
            '<th class="col-score">Placar</th>' +
          '</tr></thead>' +
          '<tbody>' + renderSheetRow(bracket.third_place_match, 0) + '</tbody>' +
        '</table>' +
      '</section>'
    );
  }

  if (bracket.champion) {
    phases.push(
      '<section class="phase phase-champ">' +
        '<h2 class="phase-head">Campe&atilde;o</h2>' +
        '<div class="champ-line"><strong>' + esc(bracket.champion.student_name) + '</strong> &mdash; ' + esc(bracket.champion.dojo_name || "&mdash;") + '</div>' +
      '</section>'
    );
  }

  return phases.join("\n");
}

export type BuildBracketHtmlOptions = {
  competitionName?: string;
  categoryName?: string;
  federationName?: string;
};

export function buildBracketHtml(bracket: BracketState, options?: BuildBracketHtmlOptions): string {
  const totalRounds = bracket.rounds.length;
  const printedAt = fmtBRDateTime(new Date());

  const federationName = options?.federationName || "Aura Karat\u00ea";
  const competitionName = options?.competitionName || "";
  const categoryName = options?.categoryName || "";

  const firstPhaseMatches = bracket.rounds[0]?.length ?? 0;
  const isLarge = firstPhaseMatches > LARGE_BRACKET_THRESHOLD;

  const subtitleParts = [categoryName, competitionName].filter(Boolean).map(esc);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" &middot; ") : "";

  if (isLarge) {
    return buildLargeBracketSheetHtml(bracket, totalRounds, printedAt, federationName, categoryName, competitionName, subtitle);
  }

  // ── Colunas de rounds ──
  const roundsHtml = bracket.rounds.map(function (round, rIdx) {
    const matches = round.map(function (m) { return renderMatch(m); }).join("\n");
    return (
      '<div class="col">' +
        '<div class="col-head">' + esc(roundLabel(rIdx, totalRounds)) + '</div>' +
        '<div class="col-matches">' + matches + '</div>' +
      '</div>'
    );
  }).join("\n");

  // ── Coluna do Campeão ──
  const champHtml = bracket.champion
    ? (
      '<div class="champ-card">' +
        '<div class="champ-eyebrow">Campe&atilde;o</div>' +
        '<div class="champ-name">' + esc(bracket.champion.student_name) + '</div>' +
        '<div class="champ-dojo">' + esc(bracket.champion.dojo_name || "&mdash;") + '</div>' +
      '</div>'
    )
    : (
      '<div class="champ-card champ-pending">' +
        '<div class="champ-eyebrow">Campe&atilde;o</div>' +
        '<div class="champ-name-pending">a definir</div>' +
      '</div>'
    );

  const champCol =
    '<div class="col col-champ">' +
      '<div class="col-head">Campeão</div>' +
      champHtml +
    '</div>';

  // ── Disputa de 3º lugar ──
  const thirdHtml = bracket.third_place_match
    ? (
      '<div class="third-section">' +
        '<div class="third-head">3º lugar</div>' +
        renderMatch(bracket.third_place_match) +
      '</div>'
    )
    : "";

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Chave - ' + esc(categoryName || "Kumite") + '</title>';
  html += '<style>';
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4 landscape;margin:10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'html,body{background:' + PAPER + ';color:' + INK + ';font-family:"Zen Kaku Gothic New",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}';

  // ── Cabeçalho ──
  html += '.sheet{padding:70px 24px 60px}';
  html += '.header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid ' + INK + ';padding-bottom:10px;margin-bottom:20px}';
  html += '.header-left{display:flex;flex-direction:column;gap:2px}';
  html += '.fed-name{font-family:"Shippori Mincho",serif;font-size:13pt;font-weight:500;color:' + INK + '}';
  html += '.cat-name{font-size:10.5pt;font-weight:700;color:' + INK + ';margin-top:4px}';
  html += '.comp-sub{font-size:9pt;color:' + INK_2 + '}';
  html += '.header-right{text-align:right;font-family:"DM Mono",monospace;font-size:8pt;color:' + INK_3 + '}';

  // ── Grid do bracket ──
  html += '.bracket{display:flex;gap:26px;align-items:center;overflow:visible}';
  html += '.col{display:flex;flex-direction:column;gap:14px;min-width:190px}';
  html += '.col-champ{min-width:170px}';
  html += '.col-head{font-family:"DM Mono",monospace;font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.4pt;color:' + INK_2 + ';text-align:center;border-bottom:1px solid ' + LINE_2 + ';padding-bottom:6px;margin-bottom:2px}';
  html += '.col-matches{display:flex;flex-direction:column;justify-content:space-around;flex:1;gap:14px}';

  // ── Match card ──
  // P&B: borda preta sólida sempre visível (não depende de tinta colorida);
  // .match-box tem fundo branco puro (contraste máximo em qualquer impressora).
  html += '.match{display:flex;flex-direction:column;gap:2px}';
  html += '.match-label{font-family:"DM Mono",monospace;font-size:6.5pt;text-transform:uppercase;letter-spacing:0.8pt;color:' + INK_3 + '}';
  html += '.match-box{border:1.3px solid ' + INK + ';border-radius:6px;overflow:hidden;background:#ffffff}';
  html += '.side{display:flex;align-items:center;gap:6px;padding:6px 8px;min-height:34px;position:relative}';
  html += '.side-shiro{border-top:1px solid ' + INK + '}';

  // P&B: dot colorido (aka=vermelho, shiro=cinza-escuro) é SÓ decorativo —
  // a distinção real de lado vem do texto/posição, não da cor do dot.
  html += '.dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}';
  html += '.dot-aka{background:' + RED + '}';
  html += '.dot-shiro{background:' + INK_2 + '}';

  html += '.athlete-block{flex:1;min-width:0;display:flex;flex-direction:column}';
  html += '.athlete-name{font-size:8.6pt;font-weight:500;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}';
  html += '.athlete-dojo{font-family:"DM Mono",monospace;font-size:6.6pt;color:' + INK_3 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}';

  // ── P&B: vencedor/perdedor ──
  // Vencedor: fundo cinza MUITO claro (visível em grayscale, não some ao
  // imprimir sem toner colorido) + borda esquerda mais grossa/escura +
  // nome em negrito + ✓ + placar. É a combinação de 4 sinais não-cromáticos
  // que garante legibilidade em P&B — a cor (wash vermelho) é só um reforço
  // para quem imprime colorido.
  html += '.side.winner{background:#eeeae2;border-left:3px solid ' + INK + '}';
  html += '.side.winner .athlete-name{font-weight:700}';
  html += '.side.winner .check{font-size:9.5pt;font-weight:700;color:' + INK + ';margin-left:2px}';
  html += '.side.winner .score{font-family:"DM Mono",monospace;font-size:8pt;font-weight:700;color:' + INK + ';background:#fff;border:1px solid ' + INK_3 + ';border-radius:3px;padding:1px 5px;margin-left:4px}';
  // Perdedor: opacidade reduzida — em grayscale vira cinza mais claro
  // (contraste menor), sem depender de matiz.
  html += '.side.loser{opacity:0.45}';
  html += '.side .bye{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1pt;color:' + INK_4 + '}';
  html += '.side .pending{font-size:8pt;font-style:italic;color:' + INK_4 + '}';
  html += '.match-divider{display:none}'; // a borda de .side-shiro já faz a separação

  // ── Coluna do campeão ──
  html += '.champ-card{border:2px solid ' + INK + ';border-radius:8px;padding:16px 12px;text-align:center;background:#fff;display:flex;flex-direction:column;gap:4px}';
  html += '.champ-eyebrow{font-family:"DM Mono",monospace;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.4pt;color:' + INK_3 + '}';
  html += '.champ-name{font-family:"Shippori Mincho",serif;font-size:12.5pt;font-weight:500;color:' + INK + '}';
  html += '.champ-dojo{font-size:8.5pt;color:' + INK_2 + '}';
  html += '.champ-card.champ-pending{border-style:dashed;border-color:' + INK_3 + ';background:transparent}';
  html += '.champ-name-pending{font-family:"Shippori Mincho",serif;font-size:11pt;color:' + INK_4 + ';font-style:italic}';

  // ── 3º lugar ──
  html += '.third-section{margin-top:26px;max-width:260px}';
  html += '.third-head{font-family:"DM Mono",monospace;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.2pt;color:' + INK_2 + ';border-bottom:1px solid ' + LINE_2 + ';padding-bottom:6px;margin-bottom:10px}';

  // ── Controles de tela (escondidos na impressão) — mesmo padrão de buildCarteirinhaHtml.ts ──
  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.sheet{padding-top:0}html,body{background:#fff}.champ-card{background:#fff}.side.winner{background:#eeeae2!important}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Chave Aura &mdash; A4 paisagem</span><br>';
  html += '<b>' + esc(categoryName || "Kumite") + (competitionName ? " &middot; " + esc(competitionName) : "") + '</b></div></div>';

  html += '<div class="sheet">';
  html += '<div class="header">';
  html += '<div class="header-left">';
  html += '<div class="fed-name">' + esc(federationName) + '</div>';
  if (subtitle) html += '<div class="cat-name">' + subtitle + '</div>';
  html += '</div>';
  html += '<div class="header-right">Impresso em ' + esc(printedAt) + '</div>';
  html += '</div>';

  html += '<div class="bracket">' + roundsHtml + champCol + '</div>';
  html += thirdHtml;
  html += '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

// ── Chave grande (> 8 confrontos na 1ª fase, ou seja > 16 atletas) ───────
// Planilha de confrontos paginada, A4 RETRATO: uma tabela por fase, em vez
// da árvore visual (que não caberia legível numa única folha). É o formato
// que o organizador usa pra controlar o evento no papel — por isso colunas
// largas o bastante pra nome+dojô, e Vencedor/Placar em branco quando
// pendentes (preenchimento à mão durante o evento).
function buildLargeBracketSheetHtml(
  bracket: BracketState,
  totalRounds: number,
  printedAt: string,
  federationName: string,
  categoryName: string,
  competitionName: string,
  subtitle: string,
): string {
  const tablesHtml = renderSheetTables(bracket, totalRounds);
  const totalAthletes = (bracket.rounds[0]?.length ?? 0) * 2;

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Chave - ' + esc(categoryName || "Kumite") + '</title>';
  html += '<style>';
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4 portrait;margin:12mm 10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'html,body{background:' + PAPER + ';color:' + INK + ';font-family:"Zen Kaku Gothic New",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}';

  // ── Cabeçalho (repetido no topo do documento; fixo na 1ª página) ──
  html += '.sheet{padding:56px 6px 30px}';
  html += '.header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid ' + INK + ';padding-bottom:8px;margin-bottom:14px}';
  html += '.header-left{display:flex;flex-direction:column;gap:2px}';
  html += '.fed-name{font-family:"Shippori Mincho",serif;font-size:12pt;font-weight:500;color:' + INK + '}';
  html += '.cat-name{font-size:9.5pt;font-weight:700;color:' + INK + ';margin-top:2px}';
  html += '.meta-line{font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_3 + ';margin-top:2px}';
  html += '.header-right{text-align:right;font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_3 + '}';

  // ── Fases/tabelas — compactas, MUITAS linhas por página ──
  html += '.phase{page-break-inside:auto;margin-bottom:16px}';
  html += '.phase+.phase{page-break-before:auto}';
  html += '.phase-head{font-family:"DM Mono",monospace;font-size:9.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.2pt;color:' + INK + ';border-bottom:1.3px solid ' + INK + ';padding:6px 2px;margin-bottom:4px;display:flex;align-items:baseline;justify-content:space-between;page-break-after:avoid}';
  html += '.phase-count{font-family:"DM Mono",monospace;font-size:7.5pt;font-weight:500;text-transform:none;letter-spacing:0;color:' + INK_3 + '}';

  html += '.sheet-table{width:100%;border-collapse:collapse;font-size:8pt}';
  html += '.sheet-table thead{display:table-header-group}'; // repete cabeçalho da tabela em cada página
  html += '.sheet-table tr{page-break-inside:avoid}';
  html += '.sheet-table th{font-family:"DM Mono",monospace;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6pt;color:' + INK_2 + ';text-align:left;padding:4px 6px;border:1px solid ' + INK + ';background:' + PAPER_WARM + '}';
  html += '.sheet-table td{padding:3.5px 6px;border:1px solid ' + INK_4 + ';color:' + INK + ';vertical-align:middle;line-height:1.25}';
  html += '.sheet-table .col-num{width:26px;text-align:center;font-family:"DM Mono",monospace;font-weight:700}';
  html += '.sheet-table .col-aka{width:29%}';
  html += '.sheet-table .col-shiro{width:29%}';
  html += '.sheet-table .col-winner{width:26%;font-weight:700}';
  html += '.sheet-table .col-score{width:60px;font-family:"DM Mono",monospace;text-align:center}';

  // P&B: linha com resultado já lançado ganha fundo cinza claro (visível em
  // grayscale) + vencedor em negrito — nunca só cor. Linha pendente fica
  // neutra, com as células Vencedor/Placar em branco pra anotar à mão.
  html += 'tr.row-done{background:#eeeae2}';
  html += 'tr.row-done td.col-winner{font-weight:700}';
  html += '.tbd{font-style:italic;color:' + INK_3 + '}';
  html += '.blank{display:inline-block;min-width:100%;min-height:11px}';

  // ── Campeão (linha final da planilha) ──
  html += '.phase-champ{margin-top:10px}';
  html += '.champ-line{font-size:10pt;padding:8px 6px;border:2px solid ' + INK + ';border-radius:4px;background:#fff}';

  // ── Controles de tela ──
  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.sheet{padding-top:0}html,body{background:#fff}tr.row-done{background:#eeeae2!important}.sheet-table th{background:' + PAPER_WARM + '!important}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Chave Aura &mdash; planilha de controle (A4 retrato, ' + totalAthletes + ' atletas)</span><br>';
  html += '<b>' + esc(categoryName || "Kumite") + (competitionName ? " &middot; " + esc(competitionName) : "") + '</b></div></div>';

  html += '<div class="sheet">';
  html += '<div class="header">';
  html += '<div class="header-left">';
  html += '<div class="fed-name">' + esc(federationName) + '</div>';
  if (subtitle) html += '<div class="cat-name">' + subtitle + '</div>';
  html += '<div class="meta-line">Planilha de confrontos &mdash; ' + totalAthletes + ' atletas &middot; preencha Vencedor/Placar &agrave; m&atilde;o quando pendente</div>';
  html += '</div>';
  html += '<div class="header-right">Impresso em ' + esc(printedAt) + '</div>';
  html += '</div>';

  html += tablesHtml;
  html += '</div>';

  html += '<button class="print-fab" onclick="window.print()">Imprimir</button>';

  html += '</body></html>';
  return html;
}

export default buildBracketHtml;
