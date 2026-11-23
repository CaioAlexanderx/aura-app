// ============================================================
// Contraste dos textos pequenos da ficha (QA 23/11/2026, P2)
// Mínimo de 4,5:1 (WCAG AA) para 11–12 px.
// ============================================================
function lum(hex: string): number {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function razao(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// rgba sobre um fundo opaco → hex
function sobre(r: number, g: number, b: number, a: number, fundo: string): string {
  const f = [0, 2, 4].map(i => parseInt(fundo.slice(1 + i, 3 + i), 16));
  const mix = [r, g, b].map((v, i) => Math.round(v * a + f[i] * (1 - a)));
  return "#" + mix.map(v => v.toString(16).padStart(2, "0")).join("");
}

describe("cores da ficha", () => {
  test("tema claro: âmbar e verde dos textos sobre o fundo claro", () => {
    expect(razao("#92400e", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(razao("#92400e", "#fdf6e9")).toBeGreaterThanOrEqual(4.5); // âmbar 6% sobre branco
    expect(razao("#047857", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(razao("#047857", "#fafbff")).toBeGreaterThanOrEqual(4.5);
    // o que havia: abaixo
    expect(razao("#d97706", "#ffffff")).toBeLessThan(4.5);
  });
  test("tema escuro: texto secundário novo sobre os fundos da ficha", () => {
    const novo2 = sobre(196, 188, 245, 0.86, "#090c1a");
    const novo3 = sobre(196, 188, 245, 0.86, "#0e1228");
    expect(razao(novo2, "#090c1a")).toBeGreaterThanOrEqual(4.5);
    expect(razao(novo3, "#0e1228")).toBeGreaterThanOrEqual(4.5);
  });
  test("a ficha usa os tokens", () => {
    const fonte = require("fs").readFileSync(require("path").join(__dirname, "..", "components", "crediario", "ficha", "fichaStyles.ts"), "utf8");
    expect(fonte).toContain('secundario: IS_DARK_MODE ? "rgba(196,188,245,0.86)" : Colors.ink3');
    expect(fonte).toContain('ambarTexto: IS_DARK_MODE ? Colors.amber : "#92400e"');
    expect(fonte).toContain('verdeTexto: IS_DARK_MODE ? Colors.green : "#047857"');
  });
});
