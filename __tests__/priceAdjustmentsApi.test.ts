// ============================================================
// Reajuste de preço em lote (p-52): o botão "Ajustar preço" só aparece
// com o backend novo no ar. Rota existe = prévia vazia responde 400
// INVALID_INPUT; rota ausente = 404; rede/500 = esconde também.
// ============================================================
const mockRequest = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; code: string | null;
    constructor(m: string, status: number, data?: any, _net = false, code: string | null = null) {
      super(m); this.status = status; this.data = data; this.code = code;
    }
  }
  return { request: (...a: any[]) => mockRequest(...a), ApiError };
});

import { priceAdjustmentsApi, codigoDoErro } from "@/services/priceAdjustmentsApi";
import { ApiError } from "@/services/api";

beforeEach(() => mockRequest.mockReset());

describe("backend do reajuste no ar?", () => {
  it("400 INVALID_INPUT = rota existe", async () => {
    mockRequest.mockRejectedValueOnce(new (ApiError as any)("product_ids deve ser...", 400, { code: "INVALID_INPUT" }));
    await expect(priceAdjustmentsApi.disponivel("c1")).resolves.toBe(true);
    const [path, opts] = mockRequest.mock.calls[0];
    expect(path).toBe("/companies/c1/products/price-adjustments");
    expect(opts).toMatchObject({ method: "POST", body: { product_ids: [], dry_run: true }, retry: 0 });
  });

  it("404, 500 ou rede = escondido", async () => {
    mockRequest.mockRejectedValueOnce(new (ApiError as any)("Não encontrado", 404, {}));
    await expect(priceAdjustmentsApi.disponivel("c1")).resolves.toBe(false);
    mockRequest.mockRejectedValueOnce(new (ApiError as any)("Erro", 500, {}, false, "server_error"));
    await expect(priceAdjustmentsApi.disponivel("c1")).resolves.toBe(false);
    mockRequest.mockRejectedValueOnce(new Error("rede"));
    await expect(priceAdjustmentsApi.disponivel("c1")).resolves.toBe(false);
  });

  it("prévia nunca grava: dry_run true e sem abaixo do custo", async () => {
    mockRequest.mockResolvedValueOnce({});
    await priceAdjustmentsApi.previa("c1", { product_ids: ["a"], mode: "percent", direction: "up", value: 10, rounding: "none", dry_run: false });
    expect(mockRequest.mock.calls[0][1].body).toMatchObject({ dry_run: true, allow_below_cost: false });
  });

  it("código do erro vem do corpo", () => {
    expect(codigoDoErro(new (ApiError as any)("x", 409, { code: "BELOW_COST" }))).toBe("BELOW_COST");
    expect(codigoDoErro(new Error("x"))).toBeNull();
  });
});
