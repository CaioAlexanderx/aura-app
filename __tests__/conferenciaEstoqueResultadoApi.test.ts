// p-108 (entrega C): cliente das diferenças, aplicar, desfazer e histórico.
// Fetch falso: o request() de verdade monta a URL, o corpo e o ApiError.
import { conferenciaEstoqueResultadoApi as api, mensagemDaConferencia, MSG_CONFERENCIA_CHEGANDO, MSG_CONFERENCIA_NAO_ACHADA } from "@/services/conferenciaEstoqueResultadoApi";
import { BASE_URL } from "@/services/api";

const originalFetch = global.fetch;
let fetchMock: jest.Mock;
function responder(status: number, corpo: any) {
  fetchMock = jest.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => corpo });
  global.fetch = fetchMock as any;
}
function chamada(i = 0) {
  const [url, init] = fetchMock.mock.calls[i];
  return { url: String(url).replace(BASE_URL, ""), method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
}
afterEach(() => { global.fetch = originalFetch; });

describe("caminhos e corpos", () => {
  it("diferenças: GET na loja da conferência e números normalizados", async () => {
    responder(200, {
      resumo: { faltam: "1", sobram: 1, batem: 0, nao_contados: 1, valor_faltam: "48.00", valor_sobram: null, itens_sem_custo: "1" },
      itens: [
        { item_id: "i1", product_id: "p1", variant_id: "v1", nome: "Camiseta", variante: "Preta · G", codigo: "789", contado: "3", estoque_no_bipe: "4", estoque_atual: "3", diferenca: "-1", custo: "24", valor: "-24", grupo: "faltam" },
        { item_id: "i2", product_id: "p2", variant_id: null, nome: "Cinto", contado: 2, estoque_no_bipe: 1, estoque_atual: 1, diferenca: 1, custo: null, valor: null },
      ],
      nao_contados: [{ product_id: "p3", variant_id: null, nome: "Lenço", estoque_atual: "2", custo: null }],
    });
    const r = await api.diferencas("c1", "k9");
    expect(chamada()).toEqual({ url: "/companies/c1/estoque/conferencias/k9/diferencas", method: "GET", body: undefined });
    expect(r.resumo).toEqual({ faltam: 1, sobram: 1, batem: 0, nao_contados: 1, valor_faltam: 48, valor_sobram: null, itens_sem_custo: 1 });
    expect(r.itens[0]).toMatchObject({ contado: 3, estoque_no_bipe: 4, diferenca: -1, custo: 24, grupo: "faltam" });
    // sem `grupo`, sai pelo sinal da diferença
    expect(r.itens[1]).toMatchObject({ grupo: "sobram", custo: null, variant_id: null });
    expect(r.nao_contados[0].estoque_atual).toBe(2);
  });

  it("aplicar: POST com zerar_nao_contados explícito", async () => {
    responder(200, { conferencia: { id: "k9", numero: 3, status: "aplicada" } });
    await api.aplicar("c1", "k9", { zerar_nao_contados: false });
    expect(chamada()).toEqual({ url: "/companies/c1/estoque/conferencias/k9/aplicar", method: "POST", body: { zerar_nao_contados: false } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("desfazer: POST sem corpo, uma tentativa só", async () => {
    responder(200, {});
    await api.desfazer("c1", "k9");
    expect(chamada()).toEqual({ url: "/companies/c1/estoque/conferencias/k9/desfazer", method: "POST", body: undefined });
  });

  it("histórico: limit e before; aceita lista crua ou { conferencias }", async () => {
    responder(200, [{ id: "a", numero: 2, status: "aplicada" }]);
    const r = await api.historico("c1", { limit: 20, before: "2026-11-10T12:00:00.000Z" });
    expect(chamada().url).toBe("/companies/c1/estoque/conferencias?limit=20&before=2026-11-10T12%3A00%3A00.000Z");
    expect(r.conferencias).toHaveLength(1);
    responder(200, { conferencias: [{ id: "b" }], proximo: "cur" });
    const r2 = await api.historico("c1");
    expect(chamada().url).toBe("/companies/c1/estoque/conferencias");
    expect(r2).toEqual({ conferencias: [{ id: "b" }], proximo: "cur" });
  });

  it("obter: GET /:countId (cabeçalho e transferências)", async () => {
    responder(200, { conferencia: { id: "k9" }, transferencias: [] });
    await api.obter("c1", "k9");
    expect(chamada().url).toBe("/companies/c1/estoque/conferencias/k9");
  });
});

describe("antes do backend no ar", () => {
  it("503 MIGRATION_PENDING vira texto gentil, sem repetir", async () => {
    responder(503, { error: "Migration pendente", code: "MIGRATION_PENDING" });
    const e: any = await api.diferencas("c1", "k9").catch((x) => x);
    expect(e.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mensagemDaConferencia(e, "carregar")).toBe(MSG_CONFERENCIA_CHEGANDO);
  });

  it("404: na lista é 'está chegando'; numa conferência é 'não encontramos'", async () => {
    responder(404, { error: "Not found" });
    const e: any = await api.historico("c1").catch((x) => x);
    expect(mensagemDaConferencia(e, "lista")).toBe(MSG_CONFERENCIA_CHEGANDO);
    expect(mensagemDaConferencia(e, "carregar")).toBe(MSG_CONFERENCIA_NAO_ACHADA);
  });

  it("409 usa o texto do backend; 403 explica quem pode", () => {
    expect(mensagemDaConferencia({ status: 409, data: { error: "Passou o prazo de 7 dias para desfazer." } }, "desfazer")).toBe("Passou o prazo de 7 dias para desfazer.");
    expect(mensagemDaConferencia({ status: 409, data: {} }, "aplicar")).toMatch(/já foi ajustada/);
    expect(mensagemDaConferencia({ status: 403, data: {} }, "aplicar")).toMatch(/Só quem pode editar o estoque/);
  });
});
