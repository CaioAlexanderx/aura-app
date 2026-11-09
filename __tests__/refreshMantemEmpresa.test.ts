// ============================================================
// Defeito 09/11/2026: depois de 1 h a empresa escolhida no seletor voltava
// sozinha para a principal (ou o consolidado). O /auth/refresh agora leva a
// empresa atual (id ou "all"); o backend confere o acesso antes de assinar.
// ============================================================
const estado: any = {};
jest.mock("@/services/instalarApp", () => ({ estaInstalado: () => false }));

import { request, setTokenGetter, setOnUnauthorized, setSessaoDoRefresh } from "@/services/api";
import { empresaParaORefresh, contextoMudou, lerPayloadDoToken } from "@/utils/empresaDoRefresh";

const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// JWT só com o payload (a assinatura não importa para o app).
const jwt = (p: any) => "h." + btoa(JSON.stringify(p)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + ".s";

const resposta = (status: number, body: any = {}) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as any);

let corpos: any[];
function fetchCom(respostaDoRefresh: any) {
  corpos = [];
  (global as any).fetch = jest.fn((url: string, init: any) => {
    if (url.endsWith("/auth/refresh")) { corpos.push(JSON.parse(init.body)); return resposta(200, respostaDoRefresh); }
    return estado.token === "access-novo" ? resposta(200, { ok: true }) : resposta(401);
  });
}

beforeEach(() => {
  for (const k of Object.keys(estado)) delete estado[k];
  Object.assign(estado, { refreshToken: "refresh-1", refreshMe: jest.fn(() => Promise.resolve()) });
  window.localStorage.clear();
  setTokenGetter(() => estado.token);
  setSessaoDoRefresh({ getState: () => estado, setState: (p: any) => Object.assign(estado, p) });
  setOnUnauthorized(jest.fn());
});

describe("o /auth/refresh leva a empresa atual", () => {
  test("empresa escolhida (do token): company_id = ela", async () => {
    estado.token = jwt({ id: "u1", company: B, consolidated_view: false });
    fetchCom({ token: "access-novo", consolidated_view: false, current_company_id: B });
    await request("/dashboard", { retry: 0 });
    expect(corpos[0]).toEqual({ refresh_token: "refresh-1", company_id: B });
    expect(estado.refreshMe).not.toHaveBeenCalled();
  });

  test("consolidado: company_id = 'all'", async () => {
    estado.token = jwt({ id: "u1", company: null, consolidated_view: true });
    fetchCom({ token: "access-novo", consolidated_view: true, current_company_id: null });
    await request("/dashboard", { retry: 0 });
    expect(corpos[0].company_id).toBe("all");
    expect(estado.refreshMe).not.toHaveBeenCalled();
  });

  test("abertura a frio: estado sem empresa, o token guardado diz qual era", async () => {
    estado.token = null;
    estado.company = null;
    window.localStorage.setItem("aura_token", jwt({ id: "u1", company: B }));
    fetchCom({ token: "access-novo" });
    await request("/dashboard", { retry: 0 }).catch(() => {});
    expect(corpos[0].company_id).toBe(B);
  });

  test("sem token legível: usa o estado; sem nada, não manda o campo (igual a antes)", async () => {
    estado.token = "nao-e-jwt";
    estado.company = { id: A };
    fetchCom({ token: "access-novo" });
    await request("/dashboard", { retry: 0 });
    expect(corpos[0].company_id).toBe(A);

    estado.token = "nao-e-jwt";
    estado.company = null;
    fetchCom({ token: "access-novo" });
    await request("/dashboard", { retry: 0 });
    expect(corpos[0]).toEqual({ refresh_token: "refresh-1" });
  });

  test("servidor caiu no padrão (perdeu o acesso): relê o /me", async () => {
    estado.token = jwt({ id: "u1", company: B });
    fetchCom({ token: "access-novo", consolidated_view: false, current_company_id: A });
    await request("/dashboard", { retry: 0 });
    await new Promise((r) => setTimeout(r, 5));
    expect(estado.refreshMe).toHaveBeenCalledTimes(1);
  });

  test("backend antigo (sem current_company_id): não relê nada", async () => {
    estado.token = jwt({ id: "u1", company: B });
    fetchCom({ token: "access-novo", consolidated_view: true });
    await request("/dashboard", { retry: 0 });
    await new Promise((r) => setTimeout(r, 5));
    expect(estado.refreshMe).not.toHaveBeenCalled();
  });
});

describe("utils/empresaDoRefresh", () => {
  test("token manda sobre o estado", () => {
    expect(empresaParaORefresh({ company: { id: A } }, jwt({ company: B }))).toBe(B);
    expect(empresaParaORefresh({ company: { id: A } }, jwt({ consolidated_view: true }))).toBe("all");
    expect(empresaParaORefresh({ consolidatedView: true }, null)).toBe("all");
    expect(empresaParaORefresh(null, null)).toBeNull();
    expect(lerPayloadDoToken("x.!!!.y")).toBeNull();
  });

  test("contextoMudou", () => {
    expect(contextoMudou(B, { current_company_id: B, consolidated_view: false })).toBe(false);
    expect(contextoMudou(B, { current_company_id: A, consolidated_view: false })).toBe(true);
    expect(contextoMudou(B, { current_company_id: null, consolidated_view: true })).toBe(true);
    expect(contextoMudou("all", { current_company_id: null, consolidated_view: true })).toBe(false);
    expect(contextoMudou("all", { current_company_id: A, consolidated_view: false })).toBe(true);
    expect(contextoMudou(B, { consolidated_view: true })).toBe(false);
    expect(contextoMudou(null, { current_company_id: A })).toBe(false);
  });
});
