// ============================================================
// AURA KARATÊ — SÚMULA imprimível (P1)
//
// Reproduz a súmula real do ginásio (ver as folhas do Dossiê Shiai:
// "KATA MASC ATÉ 7 ANOS", "Kata Master II"): cabeçalho com KOTO e data,
// a chave com os slots numerados, o rodapé com as regras da prova
// (formato por fase, desempate, kata exigido) e os campos manuscritos —
// 1º/2º/3º/3º lugar, duração, shuchin e mesário.
//
// Mesma mecânica dos outros build*Html do app (Blob + window.open, com
// fallback document.write): web-only, sem libs.
// ============================================================
import type { Scoresheet, ScoresheetMatch } from "@/services/karateCompetitionP1Api";
import { DECISION_LABEL } from "@/services/karateCompetitionP1Api";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"]/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));

function fmtDate(iso?: string | null): string {
  if (!iso) return "___/___/______";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "___/___/______";
}

function sideHtml(side: ScoresheetMatch["aka"], score: number | null, isWinner: boolean): string {
  const name = side === "bye" ? "— bye —" : (side?.name || "");
  const dojo = side === "bye" ? "" : (side?.dojo_name || "");
  return `
    <div class="side${isWinner ? " win" : ""}">
      <span class="nm">${esc(name)}</span>
      <span class="dj">${esc(dojo)}</span>
      ${score != null ? `<span class="sc">${esc(score)}</span>` : ""}
    </div>`;
}

function matchHtml(m: ScoresheetMatch): string {
  const akaWin = !!m.winner_entry_id && m.aka !== "bye" && m.aka?.entry_id === m.winner_entry_id;
  const shiroWin = !!m.winner_entry_id && m.shiro !== "bye" && m.shiro?.entry_id === m.winner_entry_id;
  const dec = m.decision
    ? `<div class="dec">${esc(DECISION_LABEL[m.decision.method] || m.decision.method)}${
        m.decision.votes_aka != null && m.decision.votes_shiro != null
          ? ` ${m.decision.votes_aka}×${m.decision.votes_shiro}` : ""}</div>`
    : "";
  return `<div class="match">${sideHtml(m.aka, m.aka_score, akaWin)}${sideHtml(m.shiro, m.shiro_score, shiroWin)}${dec}</div>`;
}

export function buildScoresheetHtml(sheet: Scoresheet): string {
  const cat = sheet.category;
  const catLine = [cat.name, cat.division_name, cat.group_label].filter(Boolean).join(" · ");

  const roundsHtml = (sheet.rounds || []).map((r) => `
    <div class="round">
      <div class="rlabel">${esc(r.label)}${r.format_label ? ` — ${esc(r.format_label)}` : ""}${
        r.duration_sec ? ` (${Math.round(r.duration_sec / 60)}min${r.time_mode ? ` ${esc(r.time_mode)}` : ""})` : ""}</div>
      ${r.matches.map(matchHtml).join("")}
    </div>`).join("");

  const thirdHtml = sheet.third_place_match
    ? `<div class="round"><div class="rlabel">3º lugar</div>${matchHtml(sheet.third_place_match)}</div>`
    : "";

  const kataHtml = sheet.kata_scores?.length
    ? `<table class="kata">
        <tr><th>#</th><th>Atleta</th><th>Dojô</th><th>Fase</th><th>Nota</th></tr>
        ${sheet.kata_scores.map((k) => `
          <tr>
            <td>${esc(k.presentation_order ?? "")}</td>
            <td>${esc(k.name || "")}</td>
            <td>${esc(k.dojo_name || "")}</td>
            <td>${k.phase === "final" ? "Final" : "Eliminatória"}</td>
            <td class="nota">${k.nota != null ? k.nota.toFixed(1) : "____"}</td>
          </tr>`).join("")}
      </table>`
    : "";

  const athletesHtml = sheet.athletes.length
    ? `<div class="athletes"><b>Inscritos (${sheet.athletes.length}):</b> ${
        sheet.athletes.map((a) => esc(a.is_team ? `Equipe ${a.name}` : a.name)).join(" · ")}</div>`
    : "";

  const f = sheet.rules_footer;
  const rules: string[] = [];
  if (f.tiebreak?.length) rules.push(`<b>Desempate:</b> ${f.tiebreak.map((t, i) => `${i + 1}) ${esc(t)}`).join(" · ")}`);
  if (f.required_kata) rules.push(`<b>Kata exigido:</b> ${esc(f.required_kata)}`);
  rules.push(`<b>Premiação:</b> até ${esc(f.prize_places)}º lugar`);
  if (f.third_place_note) rules.push(`<b>${esc(f.third_place_note)}</b>`);
  if (f.notes) rules.push(esc(f.notes));

  const places = Array.from({ length: Math.max(1, f.prize_places) }, (_, i) => {
    const n = i + 1;
    // Sem disputa de 3º → dois 3ºs lugares (como nas súmulas reais).
    const label = !f.third_place_dispute && n === 4 ? "3º" : `${n}º`;
    return `<div class="place"><span>${label} LUGAR</span><i></i></div>`;
  }).join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Súmula — ${esc(cat.name)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #211d1a; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #211d1a; padding-bottom: 6px; margin-bottom: 10px; gap: 12px; }
  .head h1 { font-size: 17px; margin: 0 0 2px; }
  .head .meta { font-size: 11px; color: #544e47; }
  .koto { text-align: right; font-size: 12px; }
  .koto b { display: block; font-size: 15px; }
  .athletes { font-size: 10.5px; color: #544e47; margin-bottom: 8px; line-height: 1.5; }
  .rounds { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
  .round { min-width: 190px; flex: 1; }
  .rlabel { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #7a2231; margin-bottom: 5px; }
  .match { border: 1px solid #cfc9bf; border-radius: 3px; margin-bottom: 7px; }
  .side { display: flex; align-items: center; gap: 6px; padding: 4px 7px; border-bottom: 1px solid #e2ded6; min-height: 26px; }
  .side:last-child { border-bottom: 0; }
  .side.win { background: #f6e9eb; font-weight: 700; }
  .side .nm { flex: 1; }
  .side .dj { font-size: 9.5px; color: #8a8279; }
  .side .sc { font-weight: 700; color: #7a2231; }
  .dec { font-size: 9px; color: #7a2231; padding: 2px 7px; border-top: 1px dashed #e2ded6; }
  table.kata { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.kata th { text-align: left; border-bottom: 1px solid #211d1a; padding: 4px; font-size: 9.5px; text-transform: uppercase; }
  table.kata td { border-bottom: 1px solid #e2ded6; padding: 4px; }
  table.kata .nota { text-align: right; font-weight: 700; }
  .places { display: flex; gap: 14px; margin-top: 14px; }
  .place { flex: 1; font-size: 10px; }
  .place span { display: block; font-weight: 700; letter-spacing: .04em; color: #544e47; }
  .place i { display: block; border-bottom: 1px solid #211d1a; height: 18px; }
  .rules { margin-top: 12px; border-top: 1px solid #cfc9bf; padding-top: 6px; font-size: 9.5px; color: #544e47; line-height: 1.6; }
  .signs { display: flex; gap: 18px; margin-top: 16px; }
  .sign { flex: 1; font-size: 10px; }
  .sign i { display: block; border-bottom: 1px solid #211d1a; height: 20px; margin-bottom: 3px; }
  @media print { .noprint { display: none; } }
</style></head><body>
  <div class="head">
    <div>
      <h1>${esc(catLine)}</h1>
      <div class="meta">${esc(sheet.competition.name)}${sheet.competition.location ? ` · ${esc(sheet.competition.location)}` : ""}</div>
    </div>
    <div class="koto">
      <b>KOTO: ${esc(sheet.fields.koto || "______")}</b>
      DATA: ${fmtDate(sheet.competition.event_date)}
    </div>
  </div>

  ${athletesHtml}
  ${kataHtml || `<div class="rounds">${roundsHtml}${thirdHtml}</div>`}

  <div class="places">${places}</div>

  <div class="rules">${rules.join("<br>")}</div>

  <div class="signs">
    <div class="sign"><i></i>DURAÇÃO</div>
    <div class="sign"><i></i>SHUCHIN (árbitro-chefe da área)</div>
    <div class="sign"><i></i>MESÁRIO</div>
  </div>
</body></html>`;
}

/** Abre a súmula em nova aba para impressão (web-only). */
export function printScoresheet(sheet: Scoresheet): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const html = buildScoresheetHtml(sheet);
  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) { URL.revokeObjectURL(url); return false; }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    const win = window.open("", "_blank");
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    return true;
  }
}
