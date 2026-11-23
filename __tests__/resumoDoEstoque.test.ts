// p-202 (23/11/2026): "13034.5 unidades + 1 servico" no celular.
import { legendaUnidadesEServicos } from "@/utils/resumoDoEstoque";

describe("legendaUnidadesEServicos", () => {
  it("número no formato brasileiro e serviço com acento", () => {
    expect(legendaUnidadesEServicos(13034.5, 1)).toBe("13.034,5 unidades + 1 serviço");
  });
  it("plural certo de unidade e de serviço", () => {
    expect(legendaUnidadesEServicos(1, 0)).toBe("1 unidade");
    expect(legendaUnidadesEServicos(0, 2)).toBe("0 unidades + 2 serviços");
    expect(legendaUnidadesEServicos(1.5, 0)).toBe("1,5 unidades");
  });
  it("soma com resto de ponto flutuante não vira dízima", () => {
    expect(legendaUnidadesEServicos(0.1 + 0.2, 0)).toBe("0,3 unidades");
    expect(legendaUnidadesEServicos(1234567, 0)).toBe("1.234.567 unidades");
  });
});
