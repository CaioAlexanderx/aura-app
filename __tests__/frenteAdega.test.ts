// Frente "Adega e bar" (tq-50): entra nas frentes do check-in e do cartão
// "Sua frente", com os mesmos primeiros passos do varejo por ora.
import { FRENTES, SEGMENTOS, SEGMENT_LABEL, frenteDe, tituloDaFrente } from "@/constants/primeirosPassos";
import { opcoesDeFrente } from "@/utils/checkinRegras";

describe("frente Adega e bar", () => {
  it("tem rótulo e fica antes de Outro, em qualquer plano (sem studio no Essencial)", () => {
    expect(SEGMENT_LABEL.adega).toBe("Adega e bar");
    expect(SEGMENTOS).toContain("adega");
    expect(SEGMENTOS.indexOf("adega")).toBe(SEGMENTOS.indexOf("outro") - 1);
    expect(opcoesDeFrente("essencial")).toContain("adega");
    expect(opcoesDeFrente("negocio")).toContain("adega");
  });

  it("mesmos passos do varejo, sem módulo próprio", () => {
    expect(FRENTES.adega.passos).toBe(FRENTES.varejo.passos);
    expect(frenteDe("adega")).toBe(FRENTES.adega);
    expect(tituloDaFrente("adega")).toBe("Sua Aura já abre como adega e bar.");
    Object.values(FRENTES.adega.passos).forEach((p) => expect(p.mod === undefined || typeof p.mod === "string").toBe(true));
  });

  it("toda frente do tipo tem rótulo e configuração", () => {
    SEGMENTOS.forEach((s) => {
      expect(SEGMENT_LABEL[s]).toBeTruthy();
      expect(FRENTES[s]).toBeDefined();
    });
  });
});
