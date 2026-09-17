// 17/09/2026 (Finesse, venda 2307): o Salvar do "Editar lancamento" mandava o
// valor de quando o modal abriu e regravou R$ 674,60 por cima do abatimento de
// uma devolucao (R$ 514,70). Ver utils/editarLancamento.ts.
import { valorDoPatch } from "@/utils/editarLancamento";

describe("valorDoPatch", () => {
  it("A Receber do crediario nunca manda valor", () => {
    expect(valorDoPatch({ digitado: 674.6, base: 514.7, isCreditReceivable: true })).toBeUndefined();
    expect(valorDoPatch({ digitado: 514.7, base: 514.7, isCreditReceivable: true })).toBeUndefined();
  });

  it("valor igual a base (lojista nao mexeu) nao vai no PATCH", () => {
    expect(valorDoPatch({ digitado: 250, base: 250, isCreditReceivable: false })).toBeUndefined();
    // arredondamento de centavos do campo mascarado
    expect(valorDoPatch({ digitado: 0.3, base: 0.1 + 0.2, isCreditReceivable: false })).toBeUndefined();
  });

  it("valor mudado pela lojista vai no PATCH", () => {
    expect(valorDoPatch({ digitado: 240, base: 250, isCreditReceivable: false })).toBe(240);
  });

  it("sem base conhecida manda o digitado", () => {
    expect(valorDoPatch({ digitado: 99.9, base: null, isCreditReceivable: false })).toBe(99.9);
  });
});
