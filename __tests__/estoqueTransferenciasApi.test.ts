// Serviço do estoque entre lojas (10/11/2026): caminhos e parâmetros.
// A chave do /variantes vai como veio, codificada na URL ("#2" vira %232:
// sem isso o "#" cortaria a query e o backend leria outra chave).
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import { estoqueTransferenciasApi } from "@/services/estoqueTransferenciasApi";

beforeEach(() => { mockRequest.mockReset(); mockRequest.mockResolvedValue({}); });

it("variantesPorLoja repassa a chave com #2 codificada", async () => {
  await estoqueTransferenciasApi.variantesPorLoja("bc:789#2");
  expect(mockRequest).toHaveBeenCalledWith("/me/estoque/por-loja/variantes?chave=bc%3A789%232");
});

it("porLoja manda só os filtros preenchidos", async () => {
  await estoqueTransferenciasApi.porLoja({ q: "saia azul", limit: 50, offset: 100 });
  expect(mockRequest.mock.calls[0][0]).toBe("/me/estoque/por-loja?q=saia%20azul&limit=50&offset=100");
});

it("criar vai na loja de origem, sem retry", async () => {
  const pedido = { destino_company_id: "c2", itens: [{ product_id: "p1", variant_id: null, quantidade: 2 }], observacao: null };
  await estoqueTransferenciasApi.criar("c1", pedido);
  expect(mockRequest).toHaveBeenCalledWith("/companies/c1/estoque/transferencias", expect.objectContaining({ method: "POST", body: pedido, retry: 0 }));
});

it("historico pagina por limit e offset", async () => {
  await estoqueTransferenciasApi.historico("c1", 20, 40);
  expect(mockRequest.mock.calls[0][0]).toBe("/companies/c1/estoque/transferencias?limit=20&offset=40");
});
