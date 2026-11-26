// B3 do QA de Personalizados (26/11/2026): aviso de resolução da arte no orçamento.
import { resolucaoDaArte, avisoDeResolucao, areaDoLadoEmCm } from "@/components/studio/orcamentoVideo/resolucaoDaArte";

describe("resolução da arte no orçamento", () => {
  test("arte de 600x400 px numa área de 28x35 cm fica em ~54 dpi e avisa", () => {
    const area = { w: 28, h: 35 };
    const r = resolucaoDaArte({ w: 600, h: 400 }, area)!;
    expect(r.dpi).toBe(54);
    expect(r.faixa).toBe("ruim");
    const texto = avisoDeResolucao(r, area)!;
    expect(texto).toMatch(/54 dpi/);
    expect(texto).toMatch(/28,0 × 35,0 cm/);
    expect(texto).toMatch(/Nítida até 10,2 cm/);
  });
  test("arte grande o bastante não avisa", () => {
    const area = { w: 28, h: 35 };
    expect(avisoDeResolucao(resolucaoDaArte({ w: 4000, h: 3000 }, area), area)).toBeNull();
  });
  test("encolher a arte (escala) pode tirar o aviso", () => {
    const area = { w: 28, h: 35 };
    expect(avisoDeResolucao(resolucaoDaArte({ w: 600, h: 400 }, area, 0.3), area)).toBeNull();
  });
  test("sem medida da imagem ou da área, sem aviso", () => {
    expect(resolucaoDaArte(null, { w: 28, h: 35 })).toBeNull();
    expect(resolucaoDaArte({ w: 600, h: 400 }, null)).toBeNull();
    expect(areaDoLadoEmCm({}, "front")).toBeNull();
    expect(areaDoLadoEmCm({ print_area: { width_cm: 9, height_cm: 8 } }, "back")).toEqual({ w: 9, h: 8 });
  });
});
