// 03/11/2026 — entrada de mercadoria e custo por fornecedor
// (utils/entradaDeMercadoria.ts). Números do mockup aprovado e a mesma
// conta do backend (Aura-backend#950, services/entradaDeMercadoria.js).
import {
  custoMedioPonderado, previaDaEntrada, custoMuitoAcima, maisBarato,
  corpoDosFornecedores, comUmPrincipal, faixaDeCusto, corpoDaEntrada, numeroPositivo,
} from "@/utils/entradaDeMercadoria";

describe("custo médio (igual ao backend)", () => {
  test("tela 2: 4 a R$ 5,50 + 20 a R$ 5,90 = 5,8333", () => {
    expect(custoMedioPonderado({ estoqueAntes: 4, custoAtual: 5.5, quantidade: 20, custoUnitario: 5.9 })).toBe(5.8333);
  });
  test("tela 3: 4 a R$ 5,50 + 10 a R$ 4,80 = 5,00", () => {
    expect(custoMedioPonderado({ estoqueAntes: 4, custoAtual: 5.5, quantidade: 10, custoUnitario: 4.8 })).toBe(5);
  });
  test("estoque negativo fora da média; sem custo não muda", () => {
    expect(custoMedioPonderado({ estoqueAntes: -2, custoAtual: 9, quantidade: 1, custoUnitario: 3 })).toBe(3);
    expect(custoMedioPonderado({ estoqueAntes: 4, custoAtual: 5.5, quantidade: 1, custoUnitario: null })).toBe(5.5);
  });
});

test("número da máscara: vírgula e milhar", () => {
  expect(numeroPositivo("5,90")).toBe(5.9);
  expect(numeroPositivo("1.234,56")).toBe(1234.56);
  expect(numeroPositivo("0,00")).toBeNull();
  expect(numeroPositivo("")).toBeNull();
});

test("prévia da tela 2: estoque, custo, margem e total", () => {
  expect(previaDaEntrada({ estoqueAntes: 4, custoAtual: 5.5, quantidade: 20, custoUnitario: 5.9, preco: 35 })).toEqual({
    estoqueAntes: 4, estoqueDepois: 24, custoAntes: 5.5, custoDepois: 5.8333,
    margemAntes: 84, margemDepois: 83, total: 118,
  });
});

test("aviso 'Confere?' só 50% acima do custo médio", () => {
  expect(custoMuitoAcima(5.9, 59)).toBe(true);
  expect(custoMuitoAcima(5.5, 8.25)).toBe(false);
  expect(custoMuitoAcima(null, 59)).toBe(false);
});

test("mais barato pelo último custo (tela 5)", () => {
  const r = maisBarato([
    { supplier_id: "a", supplier_name: "Alfa", quantity: 40, unit_cost: 5.9 },
    { supplier_id: "b", supplier_name: "Brás", quantity: 30, unit_cost: 5.21 },
    { supplier_id: "c", supplier_name: "Sem custo", quantity: 2, unit_cost: null },
  ]);
  expect(r).toMatchObject({ barato: { supplier_name: "Brás" }, caro: { supplier_name: "Alfa" }, diferenca: 0.69 });
  expect(maisBarato([{ supplier_id: "a", supplier_name: "A", quantity: 1, unit_cost: 5 }])).toBeNull();
  expect(maisBarato([{ supplier_id: "a", supplier_name: "A", quantity: 1, unit_cost: 5 }, { supplier_id: "b", supplier_name: "B", quantity: 1, unit_cost: 5 }])).toBeNull();
});

describe("fornecedores do produto (tela 8)", () => {
  const linhas = [
    { supplier_id: "s1", name: "Brás", custo: "5,21", codigo: " BC-1550 ", principal: false },
    { supplier_id: "s2", name: "Alfa", custo: "5,90", codigo: "", principal: true },
    { supplier_id: "s2", name: "Alfa (repetido)", custo: "1,00", codigo: "", principal: false },
  ];
  test("corpo do PUT: sem repetido, código limpo, custo em número", () => {
    expect(corpoDosFornecedores(linhas, false)).toEqual({ suppliers: [
      { supplier_id: "s1", supplier_code: "BC-1550", is_main: false, cost: 5.21 },
      { supplier_id: "s2", supplier_code: null, is_main: true, cost: 5.9 },
    ] });
  });
  test("sem custo visível, a chave cost nem vai (o backend mantém o gravado)", () => {
    expect(corpoDosFornecedores(linhas, true).suppliers.every((x) => !("cost" in x))).toBe(true);
  });
  test("sempre um principal; faixa de custo", () => {
    const sem = linhas.slice(0, 2).map((l) => ({ ...l, principal: false }));
    expect(comUmPrincipal(sem).map((l) => l.principal)).toEqual([true, false]);
    expect(faixaDeCusto(linhas.slice(0, 2))).toEqual({ min: 5.21, max: 5.9 });
    expect(faixaDeCusto(linhas.slice(0, 1))).toBeNull();
  });
});

describe("corpo da entrada", () => {
  test("simples, com fornecedor existente, custo e nota", () => {
    expect(corpoDaEntrada({ fornecedor: { tipo: "existente", id: "s1", name: "Alfa" }, quantidade: "20", custo: "5,90", nota: " 004512 ", usarCustoMedio: true, semCusto: false }))
      .toEqual({ corpo: { quantity: 20, supplier_id: "s1", unit_cost: 5.9, update_cost: true, invoice_number: "004512" }, total: 20 });
  });
  test("fornecedor novo e grade (zeros saem)", () => {
    const r: any = corpoDaEntrada({
      fornecedor: { tipo: "novo", name: " Centro ", phone: "(11) 9", cnpj: "" },
      grade: [{ variant_id: "v1", quantidade: "4" }, { variant_id: "v2", quantidade: "" }],
      custo: "24,00", usarCustoMedio: true, semCusto: false,
    });
    expect(r.corpo).toMatchObject({ items: [{ variant_id: "v1", quantity: 4 }], new_supplier: { name: "Centro", phone: "(11) 9" } });
    expect(r.total).toBe(4);
  });
  test("sem custo visível: nem custo nem update_cost vão", () => {
    const r: any = corpoDaEntrada({ fornecedor: null, quantidade: "3", custo: "9,99", usarCustoMedio: true, semCusto: true });
    expect(r.corpo).toEqual({ quantity: 3 });
  });
  test("erros: sem quantidade, grade vazia, fornecedor novo sem nome", () => {
    expect(corpoDaEntrada({ fornecedor: null, quantidade: "", custo: null, usarCustoMedio: true, semCusto: false })).toHaveProperty("erro");
    expect(corpoDaEntrada({ fornecedor: null, grade: [{ variant_id: "v1", quantidade: "0" }], custo: null, usarCustoMedio: true, semCusto: false })).toHaveProperty("erro");
    expect(corpoDaEntrada({ fornecedor: { tipo: "novo", name: " " }, quantidade: "1", custo: null, usarCustoMedio: true, semCusto: false })).toHaveProperty("erro");
  });
});
