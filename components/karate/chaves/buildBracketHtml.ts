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
const ROUND_LABELS = ["Oitavas", "Quartas", "Semifinais", "Final"];
function roundLabel(round: number, totalRounds: number): string {
  const idx = totalRounds - 1 - round;
  return ROUND_LABELS[idx] ?? `R${round + 1}`;
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

export type BuildBracketHtmlOptions = {
  competitionName?: string;
  categoryName?: string;
  federationName?: string;
};

export function buildBracketHtml(bracket: BracketState, options?: BuildBracketHtmlOptions): string {
  const totalRounds = bracket.rounds.length;
  const printedAt = fmtBRDateTime(new Date());

  const federationName = options?.federationName || "Aura Karatê";
  const competitionName = options?.competitionName || "";
  const categoryName = options?.categoryName || "";

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

  const subtitleParts = [categoryName, competitionName].filter(Boolean).map(esc);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" &middot; ") : "";

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

export default buildBracketHtml;
