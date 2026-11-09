// ============================================================
// Incidente 09/11/2026 (app instalado deslogando), lado do request():
//   · 401 de rota DEPOIS de um refresh que deu certo não desloga;
//   · /auth/refresh com erro do servidor (5xx) ou 403 de borda não desloga;
//   · só 401 do /auth/refresh termina a sessão;
//   · refresh token novo (prazo deslizante do app) é guardado;
//   · na abertura a frio, o refresh vem do storage se o estado ainda não tem.
// ============================================================
const estado: any = { token: "access-velho", refreshToken: "refresh-1" };
jest.mock("@/services/instalarApp", () => ({ estaInstalado: () => true }));

import { request, setTokenGetter, setOnUnauthorized, setSessaoDoRefresh, ApiError } from "@/services/api";

const resposta = (status: number, body: any = {}) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as any);

let logout: jest.Mock;
let chamadas: { url: string; init: any }[];

beforeEach(() => {
  estado.token = "access-velho";
  estado.refreshToken = "refresh-1";
  window.localStorage.clear();
  window.localStorage.setItem("aura_refresh_token", "refresh-1");
  chamadas = [];
  logout = jest.fn();
  setTokenGetter(() => estado.token);
  setSessaoDoRefresh({ getState: () => estado, setState: (p: any) => Object.assign(estado, p) });
  setOnUnauthorized(logout);
});

function fetchCom(roteiro: (url: string, init: any) => Promise<any>) {
  (global as any).fetch = jest.fn((url: string, init: any) => { chamadas.push({ url, init }); return roteiro(url, init); });
}

test("401 da rota depois de refresh ok: erro para a tela, sessão fica", async () => {
  fetchCom((url) => (url.endsWith("/auth/refresh") ? resposta(200, { token: "access-novo" }) : resposta(401, { error: "Sem permissão" })));
  const p = request("/companies/c1/web-push/test", { method: "POST", retry: 0 });
  await expect(p).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  expect(logout).not.toHaveBeenCalled();
  expect(estado.token).toBe("access-novo");
});

test.each([500, 502, 503, 403])("/auth/refresh com %i: não desloga", async (st) => {
  fetchCom((url) => (url.endsWith("/auth/refresh") ? resposta(st) : resposta(401)));
  await expect(request("/dashboard", { retry: 0 })).rejects.toBeInstanceOf(ApiError);
  expect(logout).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("aura_refresh_token")).toBe("refresh-1");
});

test("só 401 do /auth/refresh termina a sessão", async () => {
  fetchCom((url) => (url.endsWith("/auth/refresh") ? resposta(401, { code: "REFRESH_EXPIRED" }) : resposta(401)));
  await expect(request("/dashboard", { retry: 0 })).rejects.toMatchObject({ code: "session_expired" });
  expect(logout).toHaveBeenCalledTimes(1);
});

test("refresh renovado com retry 0: a chamada é refeita (antes saía 'sem conexão')", async () => {
  let n = 0;
  fetchCom((url) => {
    if (url.endsWith("/auth/refresh")) return resposta(200, { token: "access-novo" });
    n++;
    return n === 1 ? resposta(401) : resposta(200, { ok: true });
  });
  await expect(request("/dashboard", { retry: 0 })).resolves.toEqual({ ok: true });
  expect(logout).not.toHaveBeenCalled();
});

test("refresh token novo (app instalado) vai para o estado e o storage; /refresh leva X-Aura-App", async () => {
  fetchCom((url) => (url.endsWith("/auth/refresh")
    ? resposta(200, { token: "access-novo", refresh_token: "refresh-2" })
    : (estado.token === "access-novo" ? resposta(200, {}) : resposta(401))));
  await request("/dashboard", { retry: 0 });
  expect(estado.refreshToken).toBe("refresh-2");
  expect(window.localStorage.getItem("aura_refresh_token")).toBe("refresh-2");
  const r = chamadas.find((c) => c.url.endsWith("/auth/refresh"))!;
  expect(r.init.headers["X-Aura-App"]).toBe("standalone");
});

test("abertura a frio: estado ainda sem refresh, usa o do storage em vez de deslogar", async () => {
  estado.refreshToken = null;
  fetchCom((url, init) => (url.endsWith("/auth/refresh")
    ? (JSON.parse(init.body).refresh_token === "refresh-1" ? resposta(200, { token: "access-novo" }) : resposta(401))
    : (estado.token === "access-novo" ? resposta(200, {}) : resposta(401))));
  await request("/dashboard", { retry: 0 });
  expect(logout).not.toHaveBeenCalled();
  expect(estado.refreshToken).toBe("refresh-1");
});

test("outra aba já trocou o refresh: 401 com o velho tenta o do storage antes de deslogar", async () => {
  window.localStorage.setItem("aura_refresh_token", "refresh-da-outra-aba");
  fetchCom((url, init) => (url.endsWith("/auth/refresh")
    ? (JSON.parse(init.body).refresh_token === "refresh-da-outra-aba" ? resposta(200, { token: "access-novo" }) : resposta(401))
    : (estado.token === "access-novo" ? resposta(200, {}) : resposta(401))));
  await request("/dashboard", { retry: 0 });
  expect(logout).not.toHaveBeenCalled();
});
