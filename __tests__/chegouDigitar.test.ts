// ============================================================
// "Chegou mercadoria" · A5: origem "Digitar os itens" (digitarRegras).
// ============================================================
import { conferirDigitadas, quantidadeDaLinha, type LinhaDigitada } from "@/components/screens/estoque/chegou/digitarRegras";
import { indexarProdutos } from "@/components/screens/estoque/chegou/chegouRegras";

const P = { id: "p", name: "Acetona", barcode: "", code: "", stock: 4, cost: 3.1, price: 7.9, unit: "un" };
const G = { id: "g", name: "Camiseta", barcode: "", code: "", stock: 2, cost: 20, price: 49.9, unit: "un", has_variants: true };
const porId = indexarProdutos([P, G]).porId;
const linha = (id: string, d: Partial<LinhaDigitada>): LinhaDigitada => ({ id, produtoId: null, novo: null, quantidade: null, grade: null, custo: null, ...d });

test("produto, grade e novo viram itens; o n é a posição na lista", () => {
  const r = conferirDigitadas([
    linha("a", { produtoId: "p", quantidade: 5, custo: 3.2 }),
    linha("b", { produtoId: "g", grade: { v1: 2, v2: 1 }, custo: 21 }),
    linha("c", { novo: { nome: " Esponja ", preco: 9.9 }, quantidade: 2 }),
  ], porId, false);
  expect(r.faltam).toBe(0);
  expect(r.podeDarEntrada).toBe(true);
  expect(r.total).toBe(79);
  expect(r.itens).toEqual([
    { n: 1, descricao: "Acetona", produtoId: "p", novo: null, quantidade: 5, variantes: null, codigoDaVariante: null, custo: 3.2, codigoFornecedor: null },
    { n: 2, descricao: "Camiseta", produtoId: "g", novo: null, quantidade: 3, variantes: [{ variant_id: "v1", quantity: 2 }, { variant_id: "v2", quantity: 1 }], codigoDaVariante: null, custo: 21, codigoFornecedor: null },
    { n: 3, descricao: "Esponja", produtoId: null, novo: { name: "Esponja", price: 9.9 }, quantidade: 2, variantes: null, codigoDaVariante: null, custo: null, codigoFornecedor: null },
  ]);
});

test("sem quantidade, sem grade ou novo sem preço: falta e trava", () => {
  const r = conferirDigitadas([
    linha("a", { produtoId: "p" }),
    linha("b", { produtoId: "g", quantidade: 3 }),
    linha("c", { novo: { nome: "X", preco: null }, quantidade: 1 }),
    linha("d", { produtoId: "p", quantidade: 1 }),
  ], porId, false);
  expect(r.faltam).toBe(3);
  expect(r.itens.map((i) => i.n)).toEqual([4]);
  expect(r.podeDarEntrada).toBe(false);
  expect(conferirDigitadas([], porId, false).podeDarEntrada).toBe(false);
});

test("quem não vê custo: sem custo e sem total", () => {
  const r = conferirDigitadas([linha("a", { produtoId: "p", quantidade: 5, custo: 3.2 })], porId, true);
  expect(r.itens[0].custo).toBeNull();
  expect(r.total).toBe(0);
});

test("quantidade da linha de grade é a soma da grade", () => {
  expect(quantidadeDaLinha(linha("x", { grade: { a: 1.5, b: 2 }, quantidade: 99 }), G as any)).toBe(3.5);
  expect(quantidadeDaLinha(linha("x", { quantidade: 2 }), P as any)).toBe(2);
});
