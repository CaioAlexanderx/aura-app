// ============================================================
// Valor combinado — contrato com o backend (Aura-backend#840)
//
// Confere o que o app envia: rotas, métodos, nomes de campo, billing_type da
// cotação (só PIX | CREDIT_CARD) e o ?reason= do DELETE.
// ============================================================
var mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import { adminApi } from "@/services/adminApi";
import { billingApi } from "@/services/billingApi";
import { corpoDoValorCombinado, validarValorCombinado } from "@/utils/valorCombinado";

beforeEach(() => { jest.clearAllMocks(); mockRequest.mockResolvedValue({}); });

describe("admin › custom-subscription", () => {
  it("GET dedicado por empresa (não vem do clients-360)", async () => {
    await adminApi.customSubscription("emp-1");
    expect(mockRequest.mock.calls[0][0]).toBe("/admin/clients/emp-1/custom-subscription");
    expect(mockRequest.mock.calls[0][1]?.method).toBeUndefined();
  });

  it("PUT com exatamente value, plan, cycle, note, reason", async () => {
    const f = { valor: "211,20", plano: "negocio", ciclo: "annual", nota: "2 lojas", motivo: "WhatsApp" };
    const v = validarValorCombinado(f);
    await adminApi.setCustomSubscription("emp-1", corpoDoValorCombinado(f, v.valor as number));
    const [path, opts] = mockRequest.mock.calls[0];
    expect(path).toBe("/admin/clients/emp-1/custom-subscription");
    expect(opts.method).toBe("PUT");
    expect(Object.keys(opts.body).sort()).toEqual(["cycle", "note", "plan", "reason", "value"]);
    expect(opts.body).toEqual({ value: 211.2, plan: "negocio", cycle: "annual", note: "2 lojas", reason: "WhatsApp" });
  });

  it("DELETE leva o motivo no corpo e em ?reason= codificado", async () => {
    await adminApi.clearCustomSubscription("emp-1", "voltou p/ tabela & cia");
    const [path, opts] = mockRequest.mock.calls[0];
    expect(path).toBe("/admin/clients/emp-1/custom-subscription?reason=" + encodeURIComponent("voltou p/ tabela & cia"));
    expect(opts.method).toBe("DELETE");
    expect(opts.body).toEqual({ reason: "voltou p/ tabela & cia" });
  });
});

describe("billing › quote", () => {
  it("envia plan, cycle e billing_type (PIX | CREDIT_CARD) na query", async () => {
    await billingApi.quote("emp-1", "negocio", "annual", "CREDIT_CARD");
    expect(mockRequest.mock.calls[0][0]).toBe(
      "/companies/emp-1/billing/quote?plan=negocio&cycle=annual&billing_type=CREDIT_CARD");
    await billingApi.quote("emp-1", "essencial", "monthly", "PIX");
    expect(mockRequest.mock.calls[1][0]).toBe(
      "/companies/emp-1/billing/quote?plan=essencial&cycle=monthly&billing_type=PIX");
  });
});
