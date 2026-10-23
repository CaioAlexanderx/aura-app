// Regressão do CSS da sidebar após o AuthStage passar a injetar as fontes
// antes de o layout principal montar. O carregamento da fonte e os estilos do
// painel são recursos independentes: existir #aura-fonts não pode interromper
// a instalação de #aura-font-override ou #aura-sb-premium-css.
import fs from "fs";
import path from "path";

const layout = fs.readFileSync(
  path.join(__dirname, "..", "app/(tabs)/_layout.tsx"),
  "utf8",
);

function bootstrapDoPainel(): string {
  const start = layout.indexOf("function useWebFonts()");
  const end = layout.indexOf("function useScreenWidth()", start);
  if (start < 0 || end < 0) throw new Error("Não foi possível localizar useWebFonts()");
  return layout.slice(start, end);
}

describe("bootstrap de estilos do painel", () => {
  const bootstrap = bootstrapDoPainel();

  test("a fonte existente não interrompe a inicialização dos estilos", () => {
    expect(bootstrap).not.toMatch(
      /if\s*\(document\.getElementById\(["']aura-fonts["']\)\)\s*return/,
    );
    expect(bootstrap).toContain('if (!document.getElementById("aura-fonts")) {');
    expect(bootstrap).toContain('if (!document.getElementById("aura-font-override")) {');
    expect(bootstrap).toContain('if (!document.getElementById("aura-sb-premium-css")) {');
  });

  test("o CSS da marca da sidebar continua definindo o tamanho do logo", () => {
    expect(bootstrap).toContain(".aura-brand-glyph { position: relative; width: 40px; height: 40px;");
    expect(bootstrap).toContain(".aura-brand-glyph img { width: 40px; height: 40px;");
  });
});
