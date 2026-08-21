// components/screens/financeiro/v2/goalScale.ts
//
// F3 (24/08/2026) — escala de cor da barra de gasto do ResumoHero.
//
// A barra mostra quanto da receita virou despesa e "esverdeia" conforme o
// negocio se afasta (pra baixo) da meta que o usuario configurou. Passou da
// meta, vira vermelho. Encostou nela, ambar.
//
// Logica pura e isolada aqui pra ser testavel sem montar componente.

// Interpola dois hex (#rrggbb) — usado pra transicao continua entre os tokens
// de cor do tema, em vez de trocar de cor em degraus.
export function hexLerp(from: string, to: string, t: number): string {
  var a = parseHex(from);
  var b = parseHex(to);
  if (!a || !b) return to;
  var k = Math.max(0, Math.min(1, t));
  var r = Math.round(a[0] + (b[0] - a[0]) * k);
  var g = Math.round(a[1] + (b[1] - a[1]) * k);
  var bl = Math.round(a[2] + (b[2] - a[2]) * k);
  return "#" + toHex(r) + toHex(g) + toHex(bl);
}

function toHex(n: number): string {
  var s = Math.max(0, Math.min(255, n)).toString(16);
  return s.length === 1 ? "0" + s : s;
}

function parseHex(hex: string): [number, number, number] | null {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  var v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Saude do gasto: 1 = folgado bem abaixo da meta, 0.5 = exatamente na meta,
// 0 = estourou. Continuo, pra cor nao pular em degraus.
//
//   ratio/meta <= 0.70  -> 1     (sobra confortavel)
//   ratio/meta == 1.00  -> 0.5   (no limite que o usuario definiu)
//   ratio/meta >= 1.10  -> 0     (acima da meta)
export function goalHealth(expenseRatioPct: number, goalPct: number): number {
  if (!isFinite(expenseRatioPct) || !isFinite(goalPct) || goalPct <= 0) return 0.5;
  if (expenseRatioPct <= 0) return 1;
  var r = expenseRatioPct / goalPct;
  if (r <= 0.7) return 1;
  if (r >= 1.1) return 0;
  if (r <= 1) return 0.5 + ((1 - r) / 0.3) * 0.5;
  return 0.5 * ((1.1 - r) / 0.1);
}

// Cor da barra a partir da saude. Recebe os tokens do tema pra funcionar
// igual em dark e light (as duas paletas tem hex diferentes pra green/red).
export function goalColor(
  expenseRatioPct: number,
  goalPct: number,
  palette: { green: string; amber: string; red: string }
): string {
  var health = goalHealth(expenseRatioPct, goalPct);
  // 0 .. 0.5 -> vermelho -> ambar ; 0.5 .. 1 -> ambar -> verde
  if (health <= 0.5) return hexLerp(palette.red, palette.amber, health / 0.5);
  return hexLerp(palette.amber, palette.green, (health - 0.5) / 0.5);
}

// Frase curta de status usada abaixo da barra. Fala do resultado, nao do
// indicador: "sobra" e o que o dono do negocio entende, nao "margem liquida".
export function goalCaption(expenseRatioPct: number, goalPct: number): string {
  if (!isFinite(expenseRatioPct) || expenseRatioPct <= 0) return "Sem despesas no período.";
  var diff = Math.round(goalPct - expenseRatioPct);
  if (diff > 0) return "Você está " + diff + " ponto" + (diff === 1 ? "" : "s") + " abaixo da sua meta.";
  if (diff === 0) return "Você está exatamente na sua meta.";
  return "Você passou " + Math.abs(diff) + " ponto" + (Math.abs(diff) === 1 ? "" : "s") + " da sua meta.";
}
