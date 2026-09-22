// ============================================================
// Matcon M3 — as contas dos Profissionais Parceiros (22/09/2026).
//
// components/matcon/profissionaisUtil.ts é puro de propósito: é onde mora
// a conta "quantos cupons esses pontos já cobrem" (docs/mockups/
// matcon-m3-clube-calculadora.html#whatsapp) e o texto que sai no WhatsApp
// do profissional. jest.config fixa TZ=America/Sao_Paulo (mesmo cuidado de
// __tests__/matconQuotesUtil.test.ts).
// ============================================================
import {
  cupomPossivel, rotuloResumo, textoExtratoWhatsApp, textoChamarDeVolta,
  diasSemCompra, ehNovo, fmtMoneyCurto, fmtPontos, primeiroNome,
} from "@/components/matcon/profissionaisUtil";
import type { Professional } from "@/services/matconApi";

const HOJE = new Date(2026, 8, 22, 12, 0, 0); // terça, 22/09/2026, meio-dia

function professional(over: Partial<Professional> = {}): Professional {
  return {
    id: "prof-1",
    customer_id: "cli-1",
    customer_name: "Nivaldo Pereira",
    customer_phone: "(11) 98765-4321",
    trade: "pedreiro",
    points_balance: 1240,
    points_earned_total: 1240,
    referrals_count: 9,
    referred_sales_total: 12480,
    last_referral_at: "2026-09-22",
    active: true,
    created_at: "2026-01-10",
    ...over,
  };
}

describe("cupomPossivel", () => {
  test("1.240 pontos a 100/10 dão 12 cupons de R$ 120, sobram 40", () => {
    expect(cupomPossivel(1240, 100, 10)).toEqual({ cupons: 12, valor: 120, sobra: 40 });
  });

  test("730 pontos a 100/10 dão 7 cupons de R$ 70, sobram 30", () => {
    expect(cupomPossivel(730, 100, 10)).toEqual({ cupons: 7, valor: 70, sobra: 30 });
  });

  test("menos que uma faixa: zero cupom, sobra é o próprio saldo", () => {
    expect(cupomPossivel(40, 100, 10)).toEqual({ cupons: 0, valor: 0, sobra: 40 });
  });

  test("regra desligada ou zerada não divide por zero", () => {
    expect(cupomPossivel(1240, 0, 10)).toEqual({ cupons: 0, valor: 0, sobra: 1240 });
    expect(cupomPossivel(0, 100, 10)).toEqual({ cupons: 0, valor: 0, sobra: 0 });
  });
});

describe("rotuloResumo", () => {
  test("ofício · indicações · trazido este mês", () => {
    expect(rotuloResumo(professional())).toBe("pedreiro · 9 indicações · R$ 12.480 trazidos este mês");
  });

  test("singular de indicação", () => {
    expect(rotuloResumo(professional({ referrals_count: 1, referred_sales_total: 980 }))).toBe(
      "pedreiro · 1 indicação · R$ 980 trazidos este mês",
    );
  });

  test("ofício desconhecido cai em 'profissional' (outro)", () => {
    expect(rotuloResumo(professional({ trade: "outro" as any }))).toContain("profissional ·");
  });
});

describe("textoExtratoWhatsApp", () => {
  const settings = { matcon_points_to_coupon: 100, matcon_coupon_value: 10 };

  test("já dá pra resgatar — mesma frase do mockup", () => {
    const texto = textoExtratoWhatsApp(professional(), settings, "Depósito Santa Rita");
    expect(texto).toBe("Seu Nivaldo, você tem 1.240 pontos no Depósito Santa Rita — já dá um cupom de R$ 120. Quer resgatar?");
  });

  test("ainda não dá: mostra quanto falta, nunca 'cupom de R$ 0'", () => {
    const texto = textoExtratoWhatsApp(professional({ points_balance: 40 }), settings, "Depósito Santa Rita");
    expect(texto).not.toContain("R$ 0");
    expect(texto).toContain("faltam 60");
  });

  test("sem nome de cliente cai numa saudação neutra", () => {
    const texto = textoExtratoWhatsApp(professional({ customer_name: "" }), settings, "Depósito Santa Rita");
    expect(texto.startsWith("Oi,")).toBe(true);
  });
});

describe("textoChamarDeVolta", () => {
  test("profissional com pontos parados: menciona o cupom possível", () => {
    const settings = { matcon_points_to_coupon: 100, matcon_coupon_value: 10 };
    const texto = textoChamarDeVolta(professional({ points_balance: 730 }), settings, "Depósito Santa Rita");
    expect(texto).toContain("Seu Nivaldo");
    expect(texto).toContain("730 pontos parados");
    expect(texto).toContain("R$ 70");
  });
});

describe("diasSemCompra", () => {
  test("conta de meia-noite a meia-noite", () => {
    expect(diasSemCompra("2026-09-22", HOJE)).toBe(0);
    expect(diasSemCompra("2026-07-14", HOJE)).toBe(70);
  });

  test("sem indicação nenhuma -> null, nunca NaN", () => {
    expect(diasSemCompra(null, HOJE)).toBeNull();
    expect(diasSemCompra(undefined, HOJE)).toBeNull();
  });
});

describe("ehNovo", () => {
  test("marcado há menos de 30 dias é novo", () => {
    expect(ehNovo("2026-09-01", HOJE)).toBe(true);
  });

  test("marcado há mais de 30 dias não é mais novo", () => {
    expect(ehNovo("2026-01-10", HOJE)).toBe(false);
  });
});

describe("formatação", () => {
  test("fmtMoneyCurto sem centavos, separador de milhar", () => {
    expect(fmtMoneyCurto(12480)).toBe("R$ 12.480");
  });

  test("fmtPontos com separador de milhar, sem sufixo", () => {
    expect(fmtPontos(1240)).toBe("1.240");
  });

  test("primeiroNome pega só o primeiro nome", () => {
    expect(primeiroNome("Nivaldo Pereira")).toBe("Nivaldo");
    expect(primeiroNome(null)).toBe("");
  });
});
