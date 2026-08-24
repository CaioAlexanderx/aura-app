// ============================================================
// buildBracketHtml — Aura Karatê (Fase 3: impressão da chave Kumite)
//
// Gera um documento HTML completo para impressão da chave (bracket)
// de Kumite no MESMO layout de chave tradicional da tela (duas asas
// espelhadas convergindo para a final no centro), com os mesmos rótulos
// de roundLabel de components/karate/chaves/shared.tsx, o Campeão e a
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

// ── FOLHA TRADICIONAL (≤ 16 atletas) — mesma geometria do BracketView ───
// Duas asas espelhadas convergindo para a final no CENTRO (referência:
// folha oficial FPKT do Paulista JKA). Mesmo algoritmo do TraditionalSheet
// em BracketView.tsx: coluna 0 em passos fixos, coluna c centralizada na
// média das alimentadoras, asa direita espelhada (x' = canvasW − x − w).
// Tudo em divs absolutos; o transform:scale que faz caber no A4 paisagem
// é calculado AQUI em build time (a geometria é conhecida).
//
// P&B: o vencedor NUNCA é indicado só por cor — sublinhado MAIS GROSSO
// (2px vs 1.4px), nome em negrito, ✓ e placar; perdedor com opacidade
// reduzida. O traço vermelho do caminho do vencedor também é mais espesso,
// então sobrevive em grayscale como linha mais forte.
const TT = { SLOT_H: 26, SLOT_GAP: 14, GAP0: 20, COL_W: 195, CONN_W: 26, FINAL_W: 210 };
const TT_MATCH_H = TT.SLOT_H * 2 + TT.SLOT_GAP;
const AMBER_BG = "rgba(156,111,46,0.16)";
const AMBER_BORDER = "rgba(122,87,36,0.45)";
const AMBER_TEXT = "#7a5724";

function renderTradSlot(
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
  // AKA = linha vermelha, como na folha oficial (mesma regra do BracketView).
  const cls = "tslot" + (side === "aka" ? " taka" : "") + (isWinner ? " twin" : "") + (isLoser ? " tlose" : "");

  let inner: string;
  if (isBye) {
    inner = '<span class="tbye">BYE</span>';
  } else if (athlete) {
    const scoreTag = (isWinner && typeof score === "number")
      ? '<span class="tscore">' + esc(String(score)) + '</span>'
      : "";
    const check = isWinner ? '<span class="tcheck">&#10003;</span>' : "";
    inner =
      '<span class="tdot tdot-' + side + '"></span>' +
      '<span class="tname">' + esc(athlete.student_name) + '</span>' +
      scoreTag + check +
      '<span class="tdojo">' + esc(athlete.dojo_name || "") + '</span>';
  } else {
    inner = '<span class="tpend">a definir</span>';
  }
  return '<div class="' + cls + '">' + inner + '</div>';
}

// A "dupla" da folha: duas linhas sublinhadas + chip âmbar com o nº da
// luta no encontro das linhas. `dir` = L/R/C (asa esquerda/direita/centro).
function renderTradMatch(m: BracketMatch, dir: "L" | "R" | "C", num?: number): string {
  const chip = typeof num === "number"
    ? '<div class="tnumrow tnum-' + dir + '"><span class="tnum">' + num + '</span></div>'
    : "";
  return (
    '<div class="tmatch">' +
      renderTradSlot(m.aka, m.winner_entry_id, m.shiro, "aka", m.aka_score) +
      '<div class="tgap"></div>' +
      renderTradSlot(m.shiro, m.winner_entry_id, m.aka, "shiro", m.shiro_score) +
      chip +
    '</div>'
  );
}

function tradAthlete(v: BracketAthleteRef | "bye" | null | undefined): BracketAthleteRef | null {
  return isAthlete(v) ? v : null;
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

  // ── Geometria das duas asas (mesmo algoritmo do TraditionalSheet) ──
  const rounds = bracket.rounds;
  const hasWings = totalRounds >= 2;
  const wingRounds = totalRounds - 1;

  const wingL: BracketMatch[][] = [];
  const wingR: BracketMatch[][] = [];
  for (let c = 0; c < wingRounds; c++) {
    const half = Math.floor(rounds[c].length / 2);
    wingL.push(rounds[c].slice(0, half));
    wingR.push(rounds[c].slice(half));
  }

  const centers: number[][] = [];
  for (let c = 0; c < wingRounds; c++) {
    const arr: number[] = [];
    for (let i = 0; i < wingL[c].length; i++) {
      if (c === 0) { arr.push(i * (TT_MATCH_H + TT.GAP0) + TT_MATCH_H / 2); continue; }
      // Mesmo fallback do TraditionalSheet: chave que não é potência de 2
      // exata pode não ter a segunda alimentadora — evita NaN na geometria.
      const a = centers[c - 1][2 * i];
      const b = centers[c - 1][2 * i + 1];
      arr.push(b === undefined ? (a ?? i * (TT_MATCH_H + TT.GAP0) + TT_MATCH_H / 2) : (a + b) / 2);
    }
    centers.push(arr);
  }

  const wingW = wingRounds * (TT.COL_W + TT.CONN_W);
  const finalCenterY = hasWings ? centers[wingRounds - 1][0] : TT_MATCH_H / 2;
  const wingH = hasWings
    ? wingL[0].length * TT_MATCH_H + (wingL[0].length - 1) * TT.GAP0
    : TT_MATCH_H;
  const canvasW = wingW * 2 + TT.FINAL_W;
  const finalTopLocal = finalCenterY - TT_MATCH_H / 2;
  const stackH = TT_MATCH_H + 14 + 86 + (bracket.third_place_match ? 36 + TT_MATCH_H : 0);
  const canvasH = Math.max(wingH, finalTopLocal + stackH) + 8;

  // Numeração das lutas igual à folha: rodada a rodada, asa esquerda
  // primeiro, final por último.
  const numberById: Record<string, number> = {};
  let seq = 1;
  for (let r = 0; r < totalRounds; r++) {
    const round = rounds[r];
    if (round.length === 1) { numberById[round[0].id] = seq++; continue; }
    const half = Math.floor(round.length / 2);
    for (let i = 0; i < half; i++) numberById[round[i].id] = seq++;
    for (let i = half; i < round.length; i++) numberById[round[i].id] = seq++;
  }

  // ── Células + conectores (divs absolutos) ──
  let abs = "";
  (["L", "R"] as Array<"L" | "R">).forEach(function (side) {
    const wing = side === "L" ? wingL : wingR;
    for (let c = 0; c < wingRounds; c++) {
      const localX = c * (TT.COL_W + TT.CONN_W);
      const gx = side === "L" ? localX : canvasW - localX - TT.COL_W;
      wing[c].forEach(function (m, i) {
        const top = centers[c][i] - TT_MATCH_H / 2;
        abs += '<div class="tcell" style="left:' + gx + 'px;top:' + top + 'px;width:' + TT.COL_W + 'px">' +
          renderTradMatch(m, side, numberById[m.id]) + '</div>';
      });

      const colRight = localX + TT.COL_W;
      const midX = colRight + TT.CONN_W / 2;
      // P&B: o caminho do vencedor (vermelho) também é MAIS ESPESSO (2px vs
      // 1.4px) — sobrevive em grayscale como traço mais forte.
      // `alive` = vencedor ainda em prova (luta seguinte indefinida ou
      // vencida por ele) → traço vermelho GROSSO; eliminado = vermelho 2px.
      const seg = function (x: number, y: number, w: number, h: number, red: boolean, alive?: boolean) {
        const thick = alive ? 3 : (red ? 2 : 1.4);
        const horizontal = h === 0;
        const gxs = side === "L" ? x : canvasW - x - (horizontal ? w : 0);
        abs += '<div class="tline' + (red ? ' tred' : '') + '" style="left:' + (horizontal ? gxs : gxs - thick / 2) +
          'px;top:' + (y - thick / 2) + 'px;width:' + (horizontal ? w : thick) +
          'px;height:' + (horizontal ? thick : h + thick) + 'px"></div>';
      };
      const feederAlive = (feeder: BracketMatch | undefined, next: BracketMatch | undefined) => {
        const w = feeder?.winner_entry_id;
        if (!w) return false;
        const nw = next?.winner_entry_id;
        return !nw || nw === w;
      };
      if (c === wingRounds - 1) {
        seg(colRight, centers[c][0], TT.CONN_W, 0, !!wing[c][0]?.winner_entry_id,
          feederAlive(wing[c][0], rounds[totalRounds - 1][0]));
      } else {
        for (let i = 0; i < centers[c + 1].length; i++) {
          const topY = centers[c][2 * i];
          const botY = centers[c][2 * i + 1];
          if (topY === undefined || botY === undefined) continue;
          const childY = (topY + botY) / 2;
          const topRed = !!wing[c][2 * i]?.winner_entry_id;
          const botRed = !!wing[c][2 * i + 1]?.winner_entry_id;
          const child = wing[c + 1][i];
          const topAlive = feederAlive(wing[c][2 * i], child);
          const botAlive = feederAlive(wing[c][2 * i + 1], child);
          seg(colRight, topY, TT.CONN_W / 2, 0, topRed, topAlive);
          seg(colRight, botY, TT.CONN_W / 2, 0, botRed, botAlive);
          seg(midX, topY, 0, childY - topY, topRed, topAlive);
          seg(midX, childY, 0, botY - childY, botRed, botAlive);
          seg(midX, childY, TT.CONN_W / 2, 0, topRed || botRed, topAlive || botAlive);
        }
      }
    }
  });

  // ── Coluna central: final → campeão → disputa de 3º ──
  const finalMatch = rounds[totalRounds - 1][0];
  let center = '<div class="tcenter" style="left:' + wingW + 'px;top:' + finalTopLocal + 'px;width:' + TT.FINAL_W + 'px">';
  center += renderTradMatch(finalMatch, "C", numberById[finalMatch.id]);
  if (bracket.champion) {
    center += '<div class="tchamp"><div class="tchamp-eyebrow">Campe&atilde;o</div>' +
      '<div class="tchamp-name">' + esc(bracket.champion.student_name) + '</div>' +
      '<div class="tchamp-dojo">' + esc(bracket.champion.dojo_name || "&mdash;") + '</div></div>';
  } else {
    center += '<div class="tchamp tchamp-pending"><div class="tchamp-eyebrow">Campe&atilde;o</div>' +
      '<div class="tchamp-name-pending">a definir</div></div>';
  }
  if (bracket.third_place_match) {
    center += '<div class="tthird-label">Disputa de 3&ordm; lugar</div>' +
      renderTradMatch(bracket.third_place_match, "C");
  }
  center += '</div>';

  // ── Cabeçalhos de rodada ──
  let roundHeads = "";
  for (let c = 0; c < wingRounds; c++) {
    const lx = c * (TT.COL_W + TT.CONN_W);
    const label = esc(roundLabel(c, totalRounds));
    const count = rounds[c].length === 1 ? "1 luta" : rounds[c].length + " lutas";
    roundHeads += '<div class="thead-col" style="left:' + lx + 'px;width:' + TT.COL_W + 'px">' + label + '<span class="thead-count">' + count + '</span></div>';
    roundHeads += '<div class="thead-col" style="left:' + (canvasW - lx - TT.COL_W) + 'px;width:' + TT.COL_W + 'px">' + label + '<span class="thead-count">' + count + '</span></div>';
  }
  roundHeads += '<div class="thead-col" style="left:' + wingW + 'px;width:' + TT.FINAL_W + 'px">' + esc(roundLabel(totalRounds - 1, totalRounds)) + '<span class="thead-count">1 luta</span></div>';

  // ── Pódio (1º/2º/3º/3º — dois terceiros sem disputa, como na folha) ──
  const finalAka = tradAthlete(finalMatch.aka);
  const finalShiro = tradAthlete(finalMatch.shiro);
  const second = finalMatch.winner_entry_id
    ? (finalAka && finalAka.entry_id === finalMatch.winner_entry_id ? finalShiro : finalAka)
    : null;
  let thirds: Array<BracketAthleteRef | null> = [];
  if (bracket.third_place_match) {
    const tm = bracket.third_place_match;
    const ta = tradAthlete(tm.aka);
    const ts = tradAthlete(tm.shiro);
    thirds = [tm.winner_entry_id
      ? (ta && ta.entry_id === tm.winner_entry_id ? ta : ts && ts.entry_id === tm.winner_entry_id ? ts : null)
      : null];
  } else if (totalRounds >= 2) {
    thirds = (rounds[totalRounds - 2] || []).map(function (m) {
      if (!m.winner_entry_id) return null;
      const a = tradAthlete(m.aka);
      const s = tradAthlete(m.shiro);
      return a && a.entry_id === m.winner_entry_id ? s : a;
    });
  }
  const podiumLine = function (label: string, athlete: BracketAthleteRef | null): string {
    const fill = athlete
      ? esc(athlete.student_name) + (athlete.dojo_name ? '<span class="tpodium-dojo"> &middot; ' + esc(athlete.dojo_name) + '</span>' : "")
      : "&nbsp;";
    return '<div class="tpodium-line"><span class="tpodium-label">' + label + '</span><span class="tpodium-fill">' + fill + '</span></div>';
  };
  let podium = podiumLine("1&ordm; LUGAR", bracket.champion) + podiumLine("2&ordm; LUGAR", second);
  thirds.forEach(function (t) { podium += podiumLine("3&ordm; LUGAR", t); });

  // ── Observações de formato (phase_plan resolvido por rodada) ──
  let obs = "";
  const pbr = bracket.phases_by_round || [];
  if (pbr.length > 0) {
    let start = 0;
    for (let r = 1; r <= pbr.length; r++) {
      const cur = r < pbr.length ? ((pbr[r] && pbr[r].format_label) || null) : null;
      const prev = (pbr[start] && pbr[start].format_label) || null;
      if (r === pbr.length || cur !== prev) {
        if (prev) {
          const a = roundLabel(start, totalRounds);
          const b = roundLabel(r - 1, totalRounds);
          obs += '<div>' + esc(a === b ? a + ": " + prev : a + " até " + b + ": " + prev) + '</div>';
        }
        start = r;
      }
    }
  }
  if (!bracket.third_place_match && totalRounds >= 2) {
    obs += '<div>N&atilde;o tem disputa de 3&ordm; lugar</div>';
  }

  // ── Escala pra caber no A4 paisagem (margens de 10mm ≈ 1046×718px) ──
  const headerH = 62;
  const roundBandH = 28;
  const footerH = 120;
  const totalH = headerH + roundBandH + canvasH + footerH;
  const scale = Math.min(1, 1000 / canvasW, 660 / totalH);

  let html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Chave - ' + esc(categoryName || "Kumite") + '</title>';
  html += '<style>';
  html += '@import url(\'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap\');';
  html += '@page{size:A4 landscape;margin:10mm}';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'html,body{background:' + PAPER + ';color:' + INK + ';font-family:"Zen Kaku Gothic New",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}';

  html += '.sheet{padding:70px 24px 40px}';
  html += '.twrap{width:' + Math.ceil(canvasW * scale) + 'px;height:' + Math.ceil(totalH * scale) + 'px;margin:0 auto;overflow:visible}';
  html += '.tscale{width:' + canvasW + 'px;transform:scale(' + scale.toFixed(4) + ');transform-origin:top left}';

  // Cabeçalho da folha: Koto · categoria centralizada · Data
  html += '.theader{display:flex;align-items:flex-end;gap:14px;height:' + headerH + 'px;padding-bottom:10px}';
  html += '.tfield{flex:1;font-family:"DM Mono",monospace;font-size:8.5pt;color:' + INK_2 + '}';
  html += '.tfield.tright{text-align:right}';
  html += '.tcat-wrap{flex:2;text-align:center}';
  html += '.tcat{font-family:"Shippori Mincho",serif;font-size:13.5pt;font-weight:500;color:' + INK + '}';
  html += '.tcomp{font-size:8.5pt;font-weight:700;color:' + RED + ';text-transform:uppercase;letter-spacing:0.08em;margin-top:2px}';

  // Cabeçalhos de rodada
  html += '.theads{position:relative;height:' + roundBandH + 'px}';
  html += '.thead-col{position:absolute;top:0;text-align:center;font-family:"DM Mono",monospace;font-size:7pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + INK_2 + '}';
  html += '.thead-count{display:block;font-size:6.3pt;font-weight:400;letter-spacing:0;color:' + INK_3 + '}';

  // Canvas da árvore
  html += '.tcanvas{position:relative;width:' + canvasW + 'px;height:' + canvasH + 'px}';
  html += '.tcell{position:absolute}';
  html += '.tcenter{position:absolute}';
  html += '.tmatch{position:relative;height:' + TT_MATCH_H + 'px}';
  html += '.tgap{height:' + TT.SLOT_GAP + 'px}';

  // Linha do atleta: nome à esquerda, dojô à direita, sublinhado de tinta.
  // P&B: vencedor = sublinhado MAIS GROSSO + negrito + ✓ (nunca só cor).
  html += '.tslot{height:' + TT.SLOT_H + 'px;display:flex;align-items:flex-end;gap:5px;padding:0 2px 2px;border-bottom:1.4px solid ' + INK + '}';
  html += '.tslot.taka{border-bottom-color:' + RED + '}';
  html += '.tslot.twin{border-bottom:2.2px solid ' + RED + '}';
  html += '.tslot.twin .tname{font-weight:700}';
  html += '.tslot.tlose{opacity:0.5}';
  html += '.tdot{width:5px;height:5px;border-radius:50%;flex-shrink:0;margin-bottom:2px}';
  html += '.tdot-aka{background:' + RED + ';width:7px;height:7px}';
  html += '.tdot-shiro{background:' + INK_2 + '}';
  html += '.tname{font-size:8.4pt;font-weight:500;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1}';
  html += '.tdojo{margin-left:auto;font-family:"DM Mono",monospace;font-size:6.4pt;color:' + INK_3 + ';text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44%}';
  html += '.tscore{font-family:"DM Mono",monospace;font-size:7pt;font-weight:700;color:' + INK + ';background:#fff;border:1px solid ' + INK_3 + ';border-radius:3px;padding:0 3px}';
  html += '.tcheck{font-size:8pt;font-weight:700;color:' + RED + '}';
  html += '.tbye{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1pt;color:' + INK_4 + '}';
  html += '.tpend{font-size:7.5pt;font-style:italic;color:' + INK_4 + '}';

  // Chip do número da luta (o retângulo amarelo da folha oficial)
  html += '.tnumrow{position:absolute;left:0;right:0;top:' + (TT.SLOT_H + TT.SLOT_GAP / 2 - 8) + 'px;display:flex;padding:0 2px}';
  html += '.tnum-L{justify-content:flex-end}.tnum-R{justify-content:flex-start}.tnum-C{justify-content:center}';
  html += '.tnum{min-width:20px;height:15px;padding:0 4px;border-radius:3px;background:' + AMBER_BG + ';border:1px solid ' + AMBER_BORDER + ';color:' + AMBER_TEXT + ';font-family:"DM Mono",monospace;font-size:7.5pt;font-weight:700;display:flex;align-items:center;justify-content:center}';

  // Conectores em cotovelo; caminho do vencedor em vermelho (e mais espesso)
  html += '.tline{position:absolute;background:' + INK + '}';
  html += '.tline.tred{background:' + RED + '}';

  // Campeão / 3º lugar (coluna central)
  html += '.tchamp{margin-top:14px;border:2px solid ' + INK + ';border-radius:6px;background:#fff;text-align:center;padding:8px 6px}';
  html += '.tchamp-eyebrow{font-family:"DM Mono",monospace;font-size:6.8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:' + INK_3 + '}';
  html += '.tchamp-name{font-family:"Shippori Mincho",serif;font-size:11.5pt;font-weight:500;color:' + INK + ';margin-top:2px}';
  html += '.tchamp-dojo{font-size:7.5pt;color:' + INK_2 + '}';
  html += '.tchamp.tchamp-pending{border-style:dashed;border-color:' + INK_3 + ';background:transparent}';
  html += '.tchamp-name-pending{font-family:"Shippori Mincho",serif;font-size:10pt;color:' + INK_4 + ';font-style:italic;margin-top:2px}';
  html += '.tthird-label{margin-top:14px;margin-bottom:4px;text-align:center;font-family:"DM Mono",monospace;font-size:6.8pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + INK_2 + '}';

  // Rodapé da folha: pódio + observações + campos da mesa
  html += '.tfooter{display:flex;gap:26px;margin-top:14px;align-items:flex-start}';
  html += '.tpodium{flex:1;max-width:330px}';
  html += '.tpodium-line{display:flex;align-items:flex-end;gap:8px;margin-bottom:6px}';
  html += '.tpodium-label{font-family:"DM Mono",monospace;font-size:7.5pt;font-weight:700;color:' + INK_2 + ';width:70px}';
  html += '.tpodium-fill{flex:1;border-bottom:1px solid ' + INK_2 + ';min-height:12px;font-size:8pt;font-weight:700;color:' + INK + ';padding-bottom:1px}';
  html += '.tpodium-dojo{font-weight:400;color:' + INK_3 + ';font-size:7pt}';
  html += '.tobs{flex:1;text-align:right;font-size:7.5pt;font-weight:700;color:' + RED + ';text-transform:uppercase;letter-spacing:0.04em}';
  html += '.tobs div{margin-bottom:3px}';
  html += '.tfields{display:flex;gap:30px;margin-top:12px;font-family:"DM Mono",monospace;font-size:7.5pt;color:' + INK_2 + '}';
  html += '.tprinted{margin-left:auto;font-family:"DM Mono",monospace;font-size:6.8pt;color:' + INK_3 + '}';

  // Controles de tela (escondidos na impressão) — padrão buildCarteirinhaHtml.ts
  html += '.print-fab{position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(124,58,237,0.35);font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.print-fab:hover{background:#6d28d9}';
  html += '.top-bar{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;z-index:999;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,"Segoe UI",sans-serif}';
  html += '.top-bar span{color:#a78bfa;font-size:12px}.top-bar b{color:#e2e8f0;font-size:13px}';
  html += '@media print{.print-fab{display:none!important}.top-bar{display:none!important}.sheet{padding-top:0}html,body{background:#fff}.tchamp{background:#fff}}';
  html += '</style></head><body>';

  html += '<div class="top-bar"><div><span>Chave Aura &mdash; folha tradicional (A4 paisagem)</span><br>';
  html += '<b>' + esc(categoryName || "Kumite") + (competitionName ? " &middot; " + esc(competitionName) : "") + '</b></div></div>';

  const fedComp = [federationName, competitionName].filter(Boolean).map(esc).join(" &mdash; ");

  html += '<div class="sheet"><div class="twrap"><div class="tscale">';
  html += '<div class="theader">';
  html += '<div class="tfield">KOTO: ________</div>';
  html += '<div class="tcat-wrap"><div class="tcat">' + esc(categoryName || "Kumite") + '</div>' + (fedComp ? '<div class="tcomp">' + fedComp + '</div>' : '') + '</div>';
  html += '<div class="tfield tright">DATA: ___/___/___</div>';
  html += '</div>';
  html += '<div class="theads">' + roundHeads + '</div>';
  html += '<div class="tcanvas">' + abs + center + '</div>';
  html += '<div class="tfooter"><div class="tpodium">' + podium + '</div>' + (obs ? '<div class="tobs">' + obs + '</div>' : '') + '</div>';
  html += '<div class="tfields"><span>DURA&Ccedil;&Atilde;O: ____________</span><span>SHUCHIN: ____________________</span><span>MES&Aacute;RIO: ____________________</span><span class="tprinted">Impresso em ' + esc(printedAt) + '</span></div>';
  html += '</div></div></div>';

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
