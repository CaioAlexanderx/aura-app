// ============================================================
// p-108 (entrega B): cliente da conferência de estoque com fetch falso.
//   1. URLs, métodos e corpos das 6 chamadas.
//   2. GET / em lista pura ou embrulhada.
//   3. Sem retry no POST e no PUT itens (quem reenvia é a fila da tela).
//   4. Erros: 503 MIGRATION_PENDING e 404 da rota viram "em preparo" com
//      texto gentil; 409 traz o texto do servidor; rede é "rede".
// ============================================================
import { setTokenGetter, ApiError } from "@/services/api";
// 14/11/2026: o teste de "sem rede" anota uma falha de conexão; sem zerar,
// o próximo teste veria o envio dessa telemetria como a última chamada.
import { __reiniciarFalhasDeConexao } from "@/services/falhasDeConexao";
import {
  conferenciaEstoqueApi,
  lerErroDaConferencia,
  lerItemRegistrado,
  lerListaDeConferencias,
  MSG_EM_PREPARO,
} from "@/services/conferenciaEstoqueApi";

const originalFetch = global.fetch;
let chamadas: Array<{ url: string; init: any }> = [];

function responder(status: number, corpo: any) {
  global.fetch = jest.fn(async (url: any, init: any) => {
    chamadas.push({ url: String(url), init });
    return { status, ok: status >= 200 && status < 300, json: async () => corpo } as any;
  }) as any;
}

beforeEach(() => { chamadas = []; setTokenGetter(() => "tk"); __reiniciarFalhasDeConexao(); });
afterEach(() => { global.fetch = originalFetch; });

function ultima() { return chamadas[chamadas.length - 1]; }
function corpo() { return JSON.parse(ultima().init.body); }

describe("chamadas", () => {
  it("criar: POST com escopo, às cegas e motivo", async () => {
    responder(201, { conferencia: { id: "k1", numero: 1, status: "rascunho" } });
    const r = await conferenciaEstoqueApi.criar("c1", { escopo: { tipo: "categoria", category_ids: ["cat1"] }, as_cegas: true, motivo: "Inventário" });
    expect(r.conferencia.id).toBe("k1");
    expect(ultima().url).toMatch(/\/companies\/c1\/estoque\/conferencias$/);
    expect(ultima().init.method).toBe("POST");
    expect(corpo()).toEqual({ escopo: { tipo: "categoria", category_ids: ["cat1"] }, as_cegas: true, motivo: "Inventário" });
    expect(ultima().init.headers.Authorization).toBe("Bearer tk");
  });

  it("criar: às cegas é o padrão e motivo vazio vai null", async () => {
    responder(201, { conferencia: { id: "k1" } });
    await conferenciaEstoqueApi.criar("c1", { escopo: { tipo: "loja_toda" } });
    expect(corpo()).toEqual({ escopo: { tipo: "loja_toda" }, as_cegas: true, motivo: null });
  });

  it("criar: sem retry (um 500 não repete o POST)", async () => {
    responder(500, { error: "x" });
    await conferenciaEstoqueApi.criar("c1", { escopo: { tipo: "loja_toda" } }).catch(() => {});
    expect(chamadas).toHaveLength(1);
  });

  it("listar: GET com limit e aceita lista pura ou embrulhada", async () => {
    responder(200, [{ id: "a" }]);
    expect(await conferenciaEstoqueApi.listar("c1", { limit: 20 })).toEqual([{ id: "a" }]);
    expect(ultima().url).toMatch(/\/companies\/c1\/estoque\/conferencias\?limit=20$/);
    responder(200, { conferencias: [{ id: "b" }] });
    expect(await conferenciaEstoqueApi.listar("c1")).toEqual([{ id: "b" }]);
    expect(lerListaDeConferencias(null)).toEqual([]);
  });

  it("obter: GET /:countId", async () => {
    responder(200, { conferencia: { id: "k1" }, itens: [], escopo_total: 8 });
    const r = await conferenciaEstoqueApi.obter("c1", "k1");
    expect(r.escopo_total).toBe(8);
    expect(ultima().url).toMatch(/\/estoque\/conferencias\/k1$/);
  });

  it("registrarItem: PUT /itens com modo e variante (null quando não tem)", async () => {
    responder(200, { item: { id: "i1", contado: 3 } });
    const r = await conferenciaEstoqueApi.registrarItem("c1", "k1", { product_id: "p1", quantidade: 3, modo: "definir" });
    expect(lerItemRegistrado(r)).toEqual({ id: "i1", contado: 3 });
    expect(ultima().url).toMatch(/\/estoque\/conferencias\/k1\/itens$/);
    expect(ultima().init.method).toBe("PUT");
    expect(corpo()).toEqual({ product_id: "p1", variant_id: null, quantidade: 3, modo: "definir" });
  });

  it("registrarItem: sem retry na queda de rede", async () => {
    global.fetch = jest.fn(async (url: any, init: any) => { chamadas.push({ url: String(url), init }); throw new TypeError("Failed to fetch"); }) as any;
    const e: any = await conferenciaEstoqueApi.registrarItem("c1", "k1", { product_id: "p1", quantidade: 1, modo: "somar" }).catch((x) => x);
    expect(chamadas).toHaveLength(1);
    expect(lerErroDaConferencia(e).tipo).toBe("rede");
  });

  it("removerItem e descartar: DELETE", async () => {
    responder(200, { ok: true });
    await conferenciaEstoqueApi.removerItem("c1", "k1", "i1");
    expect(ultima().url).toMatch(/\/estoque\/conferencias\/k1\/itens\/i1$/);
    expect(ultima().init.method).toBe("DELETE");
    await conferenciaEstoqueApi.descartar("c1", "k1");
    expect(ultima().url).toMatch(/\/estoque\/conferencias\/k1$/);
    expect(ultima().init.method).toBe("DELETE");
  });

  it("lerItemRegistrado aceita o item direto", () => {
    expect(lerItemRegistrado({ id: "i2" })).toEqual({ id: "i2" });
    expect(lerItemRegistrado({ ok: true })).toBeNull();
  });
});

describe("erros com texto gentil", () => {
  it("503 MIGRATION_PENDING: em preparo", async () => {
    responder(503, { error: "MIGRATION_PENDING", code: "MIGRATION_PENDING" });
    const e = await conferenciaEstoqueApi.listar("c1").catch((x) => x);
    expect(lerErroDaConferencia(e)).toEqual({ tipo: "em_preparo", mensagem: MSG_EM_PREPARO });
  });

  it("404 da rota (backend antigo): em preparo", async () => {
    responder(404, { error: "Rota nao encontrada" });
    const e = await conferenciaEstoqueApi.listar("c1").catch((x) => x);
    expect(lerErroDaConferencia(e).tipo).toBe("em_preparo");
    expect(lerErroDaConferencia(new ApiError("x", 404, {})).tipo).toBe("em_preparo");
  });

  it("404 da conferência: não encontrada", () => {
    expect(lerErroDaConferencia(new ApiError("x", 404, { error: "Conferência não encontrada" })).tipo).toBe("nao_encontrada");
  });

  it("409 traz o texto do servidor", async () => {
    responder(409, { error: "Este produto é do catálogo do grupo e o estoque dele fica na Loja Centro." });
    const e = await conferenciaEstoqueApi.registrarItem("c1", "k1", { product_id: "p1", quantidade: 1, modo: "definir" }).catch((x) => x);
    expect(lerErroDaConferencia(e)).toEqual({ tipo: "recusado", mensagem: "Este produto é do catálogo do grupo e o estoque dele fica na Loja Centro." });
  });

  it("403 e 400", () => {
    expect(lerErroDaConferencia(new ApiError("x", 403, {})).tipo).toBe("sem_permissao");
    expect(lerErroDaConferencia(new ApiError("Escopo inválido", 400, { error: "Escopo inválido" }))).toEqual({ tipo: "outro", mensagem: "Escopo inválido" });
  });

  it("nenhuma mensagem mostra código HTTP", () => {
    [0, 400, 403, 404, 409, 500, 503].forEach((st) => {
      expect(lerErroDaConferencia(new ApiError("", st, {})).mensagem).not.toMatch(/\b(4|5)\d\d\b/);
    });
  });
});
