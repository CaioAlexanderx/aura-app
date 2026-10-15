// ============================================================
// Valor combinado da assinatura (14/10/2026) — regras puras.
//
// O checkout só usa o valor do backend quando custom === true e a cotação é
// do plano/ciclo da tela; o resto cai no cálculo de tabela. A Gestão Aura
// valida o formulário que define o valor (mínimo R$ 5, motivo, plano, ciclo).
// ============================================================
import {
  valorCombinadoDaCotacao, totalDoCheckout, textoValorPorMes, formatarBRL,
  lerValorDigitado, validarValorCombinado, corpoDoValorCombinado, formInicialValorCombinado,
  lerValorCombinado, resumoDoValorCombinado, ROTULO_VALOR_COMBINADO, VALOR_COMBINADO_MINIMO,
  TEXTO_CONFIRMACAO_VALOR_COMBINADO,
} from "@/utils/valorCombinado";

const COTACAO = { plan: "negocio", cycle: "annual", value: 211.2, custom: true, table_value: 159.83 };

describe("valorCombinadoDaCotacao", () => {
  it("custom:true com plano e ciclo da tela devolve o valor combinado", () => {
    expect(valorCombinadoDaCotacao(COTACAO, "negocio", "annual")).toBe(211.2);
  });
  it("aceita value em texto (numeric do Postgres)", () => {
    expect(valorCombinadoDaCotacao({ ...COTACAO, value: "211.20" }, "negocio", "annual")).toBe(211.2);
  });
  it("custom:false não vale: a tela fica na tabela", () => {
    expect(valorCombinadoDaCotacao({ ...COTACAO, custom: false }, "negocio", "annual")).toBeNull();
  });
  it("cotação de outro plano ou ciclo (resposta atrasada) não vale", () => {
    expect(valorCombinadoDaCotacao(COTACAO, "expansao", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao(COTACAO, "negocio", "monthly")).toBeNull();
  });
  it("sem resposta, erro ou lixo: null", () => {
    expect(valorCombinadoDaCotacao(undefined, "negocio", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao(null, "negocio", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao({ custom: true } as any, "negocio", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao({ ...COTACAO, value: 0 }, "negocio", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao({ ...COTACAO, value: -5 }, "negocio", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao({ ...COTACAO, value: "abc" }, "negocio", "annual")).toBeNull();
    expect(valorCombinadoDaCotacao("erro" as any, "negocio", "annual")).toBeNull();
  });
});

describe("totalDoCheckout (fallback sem endpoint)", () => {
  it("com valor combinado, o total é o do backend e marca como combinado", () => {
    expect(totalDoCheckout(159.83, COTACAO, "negocio", "annual")).toEqual({ total: 211.2, combinado: true });
  });
  it("sem cotação (endpoint ausente ou com erro), mantém o total de tabela", () => {
    expect(totalDoCheckout(159.83, undefined, "negocio", "annual")).toEqual({ total: 159.83, combinado: false });
  });
  it("cotação sem valor combinado, mantém o total de tabela", () => {
    expect(totalDoCheckout(159.83, { plan: "negocio", cycle: "annual", value: 159.83, custom: false }, "negocio", "annual"))
      .toEqual({ total: 159.83, combinado: false });
  });
});

describe("textos", () => {
  it("R$ X por mês, sem valor de tabela", () => {
    expect(textoValorPorMes(211.2)).toBe("R$ 211,20 por mês");
    expect(formatarBRL(1234.5)).toBe("R$ 1.234,50");
    expect(ROTULO_VALOR_COMBINADO).toBe("Valor combinado");
  });
  it("a confirmação da equipe diz o que o valor faz", () => {
    expect(TEXTO_CONFIRMACAO_VALOR_COMBINADO).toBe(
      "Passa a valer no próximo checkout da empresa e protege o valor contra reajuste automático de acessos extras.");
  });
});

describe("Gestão Aura › formulário do valor combinado", () => {
  it("lê o que a equipe digita", () => {
    expect(lerValorDigitado("211,20")).toBe(211.2);
    expect(lerValorDigitado("R$ 211,20")).toBe(211.2);
    expect(lerValorDigitado("1.234,56")).toBe(1234.56);
    expect(lerValorDigitado("211.20")).toBe(211.2);
    expect(lerValorDigitado("1.234")).toBe(1234);
    expect(lerValorDigitado("211")).toBe(211);
    expect(lerValorDigitado("")).toBeNull();
    expect(lerValorDigitado("abc")).toBeNull();
    expect(lerValorDigitado("211,2345")).toBeNull();
  });

  const OK = { valor: "211,20", plano: "negocio", ciclo: "annual", nota: "2 lojas", motivo: "fechado por WhatsApp" };

  it("formulário completo valida e monta o corpo do PUT", () => {
    const v = validarValorCombinado(OK);
    expect(v.ok).toBe(true);
    expect(v.valor).toBe(211.2);
    expect(corpoDoValorCombinado(OK, v.valor as number)).toEqual({
      value: 211.2, plan: "negocio", cycle: "annual", note: "2 lojas", reason: "fechado por WhatsApp",
    });
  });
  it("nota vazia vai como null", () => {
    expect(corpoDoValorCombinado({ ...OK, nota: "  " }, 211.2).note).toBeNull();
  });
  it("recusa valor abaixo do mínimo, sem motivo, plano ou ciclo inválidos", () => {
    expect(validarValorCombinado({ ...OK, valor: "4,99" }).erros.valor).toContain("mínimo");
    expect(VALOR_COMBINADO_MINIMO).toBe(5);
    expect(validarValorCombinado({ ...OK, valor: "" }).ok).toBe(false);
    expect(validarValorCombinado({ ...OK, motivo: " " }).erros.motivo).toBeTruthy();
    expect(validarValorCombinado({ ...OK, plano: "ouro" }).erros.plano).toBeTruthy();
    expect(validarValorCombinado({ ...OK, ciclo: "weekly" }).erros.ciclo).toBeTruthy();
  });

  it("lê o bloco do backend e resume para a ficha", () => {
    const bloco = { value: "211.20", plan: "negocio", cycle: "annual", note: "2 lojas", set_at: "2026-10-14T10:00:00Z" };
    expect(lerValorCombinado(bloco)).toMatchObject({ value: 211.2, plan: "negocio", cycle: "annual", note: "2 lojas" });
    expect(resumoDoValorCombinado(bloco)).toBe("R$ 211,20/mês · Negócio · anual");
    expect(resumoDoValorCombinado(null)).toBe("Valor de tabela");
    expect(lerValorCombinado(null)).toBeNull();
    expect(lerValorCombinado({ value: 0, plan: "negocio", cycle: "annual" })).toBeNull();
  });

  it("formulário inicial: parte do valor atual, senão do plano e ciclo da empresa", () => {
    expect(formInicialValorCombinado({ value: 211.2, plan: "negocio", cycle: "annual", note: "x" }, "essencial", "monthly"))
      .toMatchObject({ valor: "211,20", plano: "negocio", ciclo: "annual", nota: "x", motivo: "" });
    expect(formInicialValorCombinado(null, "expansao", "annual"))
      .toMatchObject({ valor: "", plano: "expansao", ciclo: "annual" });
    expect(formInicialValorCombinado(undefined, "karate", null))
      .toMatchObject({ plano: "negocio", ciclo: "monthly" });
  });
});
