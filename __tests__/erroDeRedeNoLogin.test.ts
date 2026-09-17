// 17/09/2026: um cliente via "E-mail ou senha incorretos." no login, mas
// nenhuma tentativa dele chegava ao backend. O request() relançava o
// TypeError do fetch e a tela caía no texto padrão de senha errada.
// Falha de rede tem que sair como ApiError de rede; senha errada continua
// sendo o 401 com a mensagem do servidor.
import { request, ApiError } from "@/services/api";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe("request() sem resposta do servidor", () => {
  it("fetch rejeitado vira ApiError de rede depois das tentativas", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as any;

    const err: any = await request("/auth/login", { method: "POST", body: { email: "a@b.com", password: "x" }, retry: 1, token: null })
      .catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isNetworkError).toBe(true);
    expect(err.code).toBe("network");
    expect(err.message).toBe("Erro de conexão. Verifique sua internet.");
  });

  it("senha errada segue como 401 com a mensagem do backend", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401, ok: false, json: async () => ({ error: "Credenciais invalidas" }),
    }) as any;

    const err: any = await request("/auth/login", { method: "POST", body: { email: "a@b.com", password: "x" }, retry: 1, token: null })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.isNetworkError).toBe(false);
    expect(err.message).toBe("Credenciais invalidas");
  });
});
