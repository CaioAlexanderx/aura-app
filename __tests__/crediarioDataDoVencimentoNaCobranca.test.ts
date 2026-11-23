// ============================================================
// Vencimento na prévia do Cobrar (QA 23/11/2026, P1-6)
//
// A ficha dizia 27/11 e a mensagem para a cliente, 26/11: o vencimento chegava
// como "2026-11-27T00:00:00.000Z" e o formatador da tela do crediário só
// tratava "YYYY-MM-DD" como data pura — o resto passava por new Date() e
// virava o dia anterior em São Paulo.
// ============================================================
import fs from "fs";
import path from "path";
import { diaMes } from "@/utils/crediarioCarne";
import { dataDoVencimento } from "@/utils/crediarioMovimentacao";
import { diasDeAtraso, situacaoDaParcela } from "@/utils/crediarioMensagem";
import { fmtDate } from "@/components/crediario/ficha/fichaHelpers";

describe("data de calendário nunca vira o dia anterior", () => {
  test.each([
    ["2026-11-27", "27/11"],
    ["2026-11-27T00:00:00Z", "27/11"],
    ["2026-11-27T00:00:00.000Z", "27/11"],
    // meia-noite de São Paulo gravada como instante
    ["2026-11-27T03:00:00.000Z", "27/11"],
  ])("diaMes(%s) = %s", (iso, esperado) => {
    expect(diaMes(iso)).toBe(esperado);
  });
  test("a ficha (dataDoVencimento) e o Pix (fichaHelpers.fmtDate) também", () => {
    expect(dataDoVencimento("2026-11-27T00:00:00.000Z", "2026-11-23")).toBe("27/11");
    expect(fmtDate("2026-11-27T00:00:00.000Z")).toBe("27/11/26");
  });
  test("a mensagem conta os dias pela data de calendário", () => {
    expect(situacaoDaParcela("2026-11-27T00:00:00.000Z", "2026-11-27")).toBe("vence_hoje");
    expect(diasDeAtraso("2026-11-26T00:00:00.000Z", "2026-11-27")).toBe(1);
  });
  test("a tela do crediário formata o vencimento da cobrança com diaMes", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "crediario.tsx"), "utf8");
    expect(fonte).toMatch(/var fmtDate = function\(iso: string\) \{\s*return diaMes\(iso\);/);
    expect(fonte).not.toMatch(/new Date\(s\)\.toLocaleDateString/);
  });
});
