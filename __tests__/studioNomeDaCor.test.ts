// ============================================================
// __tests__/studioNomeDaCor.test.ts
//
// QA do detalhe do pedido (26/09/2026, achado 2d): "Cor: #000000" não
// dizia nada pra quem confere a peça antes de produzir. `nomeDaCor`
// traduz o hex pro nome em português, priorizando o rótulo que a
// lojista cadastrou pro swatch quando ele existe.
// ============================================================
import { nomeDaCor } from "@/components/studio/nomeDaCor";

describe("nomeDaCor", () => {
  it("nomeia as cores do achado do QA e dos presets do app", () => {
    expect(nomeDaCor("#000000")).toBe("preto");
    expect(nomeDaCor("#FFFFFF")).toBe("branco");
    expect(nomeDaCor("#EC4899")).toBe("rosa");
    expect(nomeDaCor("#7C3AED")).toBe("roxo");
    expect(nomeDaCor("#1E3A8A")).toBe("azul");
    expect(nomeDaCor("#D97706")).toBe("laranja");
    expect(nomeDaCor("#059669")).toBe("verde");
  });

  it("cobre as demais cores comuns pedidas no QA", () => {
    expect(nomeDaCor("#FFFF00")).toBe("amarelo");
    expect(nomeDaCor("#8B4513")).toBe("marrom");
    expect(nomeDaCor("#808080")).toBe("cinza");
    expect(nomeDaCor("#FFD700")).toBe("dourado");
    expect(nomeDaCor("#C0C0C0")).toBe("prata");
    expect(nomeDaCor("#FF0000")).toBe("vermelho");
  });

  it("o rótulo cadastrado pela lojista vence o nome genérico", () => {
    expect(nomeDaCor("#123456", "Azul Petróleo")).toBe("Azul Petróleo");
  });

  it("rótulo igual ao próprio hex não conta como cadastrado", () => {
    expect(nomeDaCor("#000000", "#000000")).toBe("preto");
  });

  it("hex sem cadastro e fora da tabela exata cai no cálculo por matiz/luz", () => {
    expect(nomeDaCor("#0f9d58")).toBe("verde"); // verde do Google, não está na tabela exata
  });

  it("hex inválido não quebra — devolve o valor bruto", () => {
    expect(nomeDaCor("nem-hex")).toBe("nem-hex");
  });
});
