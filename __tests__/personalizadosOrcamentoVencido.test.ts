// B2 do QA de Personalizados (26/11/2026): orçamento vencido.
import { orcamentoVencido, estadoDoOrcamento, acoesDoRodape, diaEmSaoPaulo } from "@/components/studio/orcamentoModal/regras";
import { ehOrcamentoVencido } from "@/components/studio/storefront/posCompra/posCompra";
import { maskCurrency } from "@/utils/masks";

// 26/11/2026 12:00 em São Paulo
const HOJE = new Date("2026-11-26T15:00:00Z");
const enviado = (expires_at: string | null, extra: Record<string, any> = {}) =>
  ({ status: "sent" as const, expires_at, ajuste_pedido_em: null, ...extra });

describe("orçamento vencido", () => {
  test("validade de ontem vence; a de hoje ainda vale", () => {
    expect(orcamentoVencido(enviado("2026-11-25T23:59:59-03:00"), HOJE)).toBe(true);
    expect(orcamentoVencido(enviado("2026-11-26T23:59:59-03:00"), HOJE)).toBe(false);
    expect(orcamentoVencido(enviado("2026-12-01T03:00:00Z"), HOJE)).toBe(false);
  });
  test("usa o dia de São Paulo, não o do navegador (02:00 UTC ainda é o dia anterior)", () => {
    expect(diaEmSaoPaulo("2026-11-26T02:00:00Z")).toBe("2026-11-25");
  });
  test("só o enviado vence", () => {
    expect(orcamentoVencido({ status: "draft", expires_at: "2026-11-01T00:00:00Z", ajuste_pedido_em: null }, HOJE)).toBe(false);
    expect(orcamentoVencido({ status: "converted", expires_at: "2026-11-01T00:00:00Z", ajuste_pedido_em: null }, HOJE)).toBe(false);
    expect(orcamentoVencido(enviado(null), HOJE)).toBe(false);
  });
  test("estado e rodapé: Vencido, sem Aprovar, com Renovar validade", () => {
    const q = enviado("2026-11-25T23:59:59-03:00");
    expect(estadoDoOrcamento(q, HOJE)).toBe("vencido");
    const ids = acoesDoRodape("vencido", { temPecas: true, catalogoAberto: false }).map((a) => a.id);
    expect(ids).toContain("renovar");
    expect(ids).not.toContain("aprovar");
    expect(estadoDoOrcamento(enviado("2026-11-30T23:59:59-03:00"), HOJE)).toBe("enviado");
  });
  test("a página pública reconhece o código ORCAMENTO_VENCIDO", () => {
    expect(ehOrcamentoVencido({ code: "ORCAMENTO_VENCIDO" })).toBe(true);
    expect(ehOrcamentoVencido({ data: { error: "ORCAMENTO_VENCIDO" } })).toBe(true);
    expect(ehOrcamentoVencido({ code: "OUTRO" })).toBe(false);
  });
});

describe("custo do insumo com a máscara do Caixa", () => {
  test("dígitos entram como centavos", () => {
    expect(maskCurrency("085")).toBe("0,85");
    expect(maskCurrency("8500")).toBe("85,00");
  });
});
