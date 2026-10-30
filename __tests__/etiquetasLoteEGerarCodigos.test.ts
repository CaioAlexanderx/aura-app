// ============================================================
// Etiquetas: variantes em lote (p-72) e gerar código (p-75) — partes puras.
// ============================================================
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import { emPedacos, comLimite, buscarVariantesEmLote } from "@/components/screens/estoque/labels/variantesEmLote";
import { sondarGerarCodigos, gerarCodigos, alvosSemCodigo } from "@/components/screens/estoque/labels/gerarCodigos";

const erro = (status: number) => Object.assign(new Error("x"), { status });
beforeEach(() => mockRequest.mockReset());

test("emPedacos divide em no máximo N", () => {
  expect(emPedacos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(emPedacos([], 200)).toEqual([]);
});

test("comLimite nunca passa do limite e não rejeita quando uma tarefa falha", async () => {
  let emVoo = 0; let max = 0;
  const tarefas = Array.from({ length: 9 }, (_, i) => async () => {
    emVoo++; max = Math.max(max, emVoo);
    await new Promise((r) => setTimeout(r, 1));
    emVoo--;
    if (i === 3) throw new Error("falhou");
    return i;
  });
  const r = await comLimite(tarefas, 4);
  expect(max).toBe(4);
  expect(r[3]).toBeUndefined();
  expect(r[8]).toBe(8);
});

test("buscarVariantesEmLote: todo id pedido volta (omitido = sem variante)", async () => {
  mockRequest.mockResolvedValue({ variants_by_product: { a: [{ id: "v1" }] } });
  const m = await buscarVariantesEmLote("cid", ["a", "b"]);
  expect(mockRequest).toHaveBeenCalledWith("/companies/cid/products/variants?product_ids=a,b", { retry: 0 });
  expect(m).toEqual({ a: [{ id: "v1" }], b: [] });
});

test("buscarVariantesEmLote rejeita com rota ausente (backend antigo)", async () => {
  mockRequest.mockRejectedValue(erro(404));
  await expect(buscarVariantesEmLote("cid", ["a"])).rejects.toBeTruthy();
});

test("sondarGerarCodigos: 400 (lista vazia) = existe; 404 e 403 = não mostra o botão", async () => {
  mockRequest.mockRejectedValueOnce(erro(400));
  expect(await sondarGerarCodigos("cid")).toBe(true);
  expect(mockRequest.mock.calls[0]).toEqual(["/companies/cid/products/barcodes/generate", { method: "POST", body: { targets: [], dry_run: true }, retry: 0 }]);
  mockRequest.mockRejectedValueOnce(erro(404));
  expect(await sondarGerarCodigos("cid")).toBe(false);
  mockRequest.mockRejectedValueOnce(erro(403));
  expect(await sondarGerarCodigos("cid")).toBe(false);
  mockRequest.mockRejectedValueOnce(new Error("sem rede"));
  expect(await sondarGerarCodigos("cid")).toBe(false);
});

test("gerarCodigos manda no máximo 500 por chamada", async () => {
  mockRequest.mockImplementation((_p: string, o: any) => Promise.resolve({ items: o.body.targets.map((t: any) => ({ ...t, barcode: "2" })), skipped: [] }));
  const alvos = Array.from({ length: 501 }, (_, i) => ({ product_id: "p" + i, variant_id: null, nome: "x", comEstoque: true }));
  const r = await gerarCodigos("cid", alvos, true);
  expect(mockRequest).toHaveBeenCalledTimes(2);
  expect(mockRequest.mock.calls[0][1].body.targets).toHaveLength(500);
  expect(mockRequest.mock.calls[1][1].body).toEqual({ targets: [{ product_id: "p500", variant_id: null }], dry_run: true });
  expect(r.items).toHaveLength(501);
});

test("alvosSemCodigo: produto simples, variantes carregadas sem código, não carregadas ficam de fora", () => {
  const produtos = [
    { id: "s", name: "Simples", code: "---", barcode: "", stock: 2 },
    { id: "z", name: "Zerado", code: "---", barcode: "", stock: 0 },
    { id: "k", name: "Com SKU", code: "221", barcode: "", stock: 2 },
    { id: "v", name: "Vestido", code: "---", barcode: "", stock: 3, has_variants: true },
    { id: "n", name: "Não carregado", code: "---", barcode: "", stock: 3, has_variants: true },
  ];
  const cache = { v: [{ id: "v1", barcode: "", stock_qty: "3" }, { id: "v2", barcode: "2100000000017", stock_qty: "1" }, { id: "v3", barcode: null, stock_qty: "0" }] };
  const a = alvosSemCodigo(produtos, cache, (p, v) => p.name + " " + v.id);
  expect(a).toEqual([
    { product_id: "s", variant_id: null, nome: "Simples", comEstoque: true },
    { product_id: "z", variant_id: null, nome: "Zerado", comEstoque: false },
    { product_id: "v", variant_id: "v1", nome: "Vestido v1", comEstoque: true },
    { product_id: "v", variant_id: "v3", nome: "Vestido v3", comEstoque: false },
  ]);
});
