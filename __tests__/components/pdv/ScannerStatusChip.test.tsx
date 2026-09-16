// Fase 0 · I0.3 — o estado do leitor saiu do card de 52px da barra de ações
// (onde truncava "Escutando · pode b…") e virou chip na linha da busca.
// Vocabulário: o leitor LÊ, não escuta — "Lendo · pode bipar" / "Leitor
// pausado", nunca "Escutando".
import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  ScannerStatusChip,
  leitorStatusText,
  leitorStatusCurto,
  leitorStatusA11y,
} from "@/components/screens/pdv/ScannerStatusChip";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

function renderText(el: React.ReactElement): { t: renderer.ReactTestRenderer; text: string } {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return { t, text: flattenText(t.toJSON()) };
}

describe("leitorStatusText / leitorStatusCurto / leitorStatusA11y", () => {
  it("lendo: 'Lendo · pode bipar' (não 'Escutando')", () => {
    expect(leitorStatusText(true)).toBe("Lendo · pode bipar");
    expect(leitorStatusText(true)).not.toMatch(/Escutando/);
  });

  it("pausado: 'Leitor pausado'", () => {
    expect(leitorStatusText(false)).toBe("Leitor pausado");
  });

  it("versão curta (mobile): 'Lendo' / 'Pausado'", () => {
    expect(leitorStatusCurto(true)).toBe("Lendo");
    expect(leitorStatusCurto(false)).toBe("Pausado");
  });

  it("a11y inclui o último código lido quando presente", () => {
    expect(leitorStatusA11y(true)).toBe(
      "Leitor de código de barras ligado, pode bipar a qualquer momento",
    );
    expect(leitorStatusA11y(true, "7891000315507")).toBe(
      "Leitor de código de barras ligado, pode bipar a qualquer momento. Último código lido: 7891000315507",
    );
    expect(leitorStatusA11y(false)).toBe("Leitor de código de barras pausado");
  });
});

describe("ScannerStatusChip — render", () => {
  it("listening=true mostra 'Lendo · pode bipar'", () => {
    const { text } = renderText(<ScannerStatusChip listening lastCode={null} />);
    expect(text).toContain("Lendo · pode bipar");
  });

  it("listening=false mostra 'Leitor pausado', não 'Lendo'", () => {
    const { text } = renderText(<ScannerStatusChip listening={false} lastCode={null} />);
    expect(text).toContain("Leitor pausado");
    expect(text).not.toContain("Lendo");
  });

  it("compact (mobile) mostra só 'Lendo', a frase inteira vive no accessibilityLabel", () => {
    const { t, text } = renderText(<ScannerStatusChip listening compact lastCode={null} />);
    expect(text).toBe("Lendo");
    const wrap = t.root.findByProps({
      accessibilityLabel: "Leitor de código de barras ligado, pode bipar a qualquer momento",
    });
    expect(wrap).toBeTruthy();
  });

  it("com um código recém-lido, mostra o código como chip transitório", () => {
    const { text } = renderText(<ScannerStatusChip listening lastCode="7891000315507" />);
    expect(text).toContain("7891000315507");
  });
});
