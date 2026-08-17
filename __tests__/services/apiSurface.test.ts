// Regressão do bug de 17/08/2026: `import { api } from "@/services/api"` era
// um símbolo fantasma. O Metro não faz type-check no bundle, então o import
// virava `undefined` e só estourava em runtime — o botão de aprovar Pix do
// Canal Digital ficou quebrado de 03/05 a 17/08/2026 sem ninguém perceber.
// Este teste trava o contrato: se `api` sumir ou perder um verbo, o CI quebra
// antes do deploy.
import { api } from "../../services/api";

describe("services/api — superfície pública do `api`", () => {
  it("exporta `api` com os 5 verbos usados no app", () => {
    expect(api).toBeDefined();
    for (const verb of ["get", "post", "put", "patch", "delete"]) {
      expect(typeof (api as any)[verb]).toBe("function");
    }
  });

  it("api.post envia POST com body JSON (shape usado em approve-payment)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    (global as any).fetch = fetchMock;

    const res = await api.post<any>(
      "/companies/c1/digital-channel/orders/o1/approve-payment",
      {}
    );

    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/companies/c1/digital-channel/orders/o1/approve-payment"
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
  });

  it("api.get envia GET sem body", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ modules: [] }),
    });
    (global as any).fetch = fetchMock;

    await api.get<any>("/companies/c1/modules");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });
});
