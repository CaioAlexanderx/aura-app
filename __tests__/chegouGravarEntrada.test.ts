// ============================================================
// "Chegou mercadoria" · A7: gravar a entrada (gravarEntrada.ts).
//   - o corpo segue o contrato do POST /products/stock-receipts
//     (Aura-backend#1056 e #1057);
//   - acima de 300 linhas divide em partes, cada uma com a sua chave, sempre
//     a mesma para a mesma abertura;
//   - resposta que não chega repete com a MESMA chave; erro de conteúdo não;
//   - a linha que casou pelo código de barras de uma variante ganha o
//     variant_id.
// ============================================================
import {
  itensDaConferencia, montarCorpos, resolverVariantes, enviarComAMesmaChave, gravarEntrada, errosPorLinha,
  resumoDoPronto, csvDosQueFaltam, deveRepetir, chaveDaParte, type ItemDaEntrada,
} from "@/components/screens/estoque/chegou/gravarEntrada";
import { indexarProdutos, conferirLinha, decisaoDeNovo, CHAVE_VALIDA } from "@/components/screens/estoque/chegou/chegouRegras";
import { lerNota } from "@/components/screens/estoque/chegou/lerNota";
import { XML_CONFERENCIA, PRODUTOS_CONFERENCIA } from "./fixtures/chegouNotas";

const CHAVE = "3f1c2b8e-1111-4222-8333-944455556666";

function linhasDaNota(decisoes: Record<number, any> = {}, ajustes: Record<number, any> = {}, produtos = PRODUTOS_CONFERENCIA) {
  const r = lerNota(XML_CONFERENCIA);
  if (!r.ok) throw new Error("fixture");
  const indice = indexarProdutos(produtos);
  return r.nota.itens.map((it) => conferirLinha(it, { indice, codigos: { "AL-0391": "p-acetona" }, decisao: decisoes[it.n], ajuste: ajustes[it.n], semCusto: false }));
}

const item = (n: number, extra: Partial<ItemDaEntrada> = {}): ItemDaEntrada => ({
  n, descricao: "ITEM " + n, produtoId: "p-" + n, novo: null, quantidade: 1, variantes: null, codigoDaVariante: null, custo: 2, codigoFornecedor: null, ...extra,
});

describe("itens e corpo", () => {
  test("só entram as linhas decididas; novo vai com nome, preço, NCM e código de barras", () => {
    const r = lerNota(XML_CONFERENCIA);
    if (!r.ok) throw new Error();
    const linhas = linhasDaNota({ 4: { ...decisaoDeNovo(r.nota.itens[3], false), categoria: "Esmaltes" } });
    const itens = itensDaConferencia(linhas, false);
    expect(itens.map((i) => i.n)).toEqual([1, 2, 3, 4]);
    expect(itens[0]).toMatchObject({ produtoId: "p-esmalte", quantidade: 24, custo: 6, codigoFornecedor: "AL-0100" });
    expect(itens[3]).toMatchObject({
      produtoId: null,
      novo: { name: "BASE FORTALECEDORA 10ML", price: 14.8, category: "Esmaltes", ncm: "33043000" },
      quantidade: 18, custo: 7.4,
    });
  });

  test("quem não vê custo: sem custo nos itens", () => {
    const itens = itensDaConferencia(linhasDaNota({ 4: { tipo: "fora" } }), true);
    expect(itens.every((i) => i.custo === null)).toBe(true);
  });

  test("grade escolhida vira variants; casou pela variante guarda o código para achar o variant_id", () => {
    const comGrade = PRODUTOS_CONFERENCIA.map((p: any) => (p.id === "p-lixa" ? { ...p, has_variants: true } : p.id === "p-esmalte" ? { ...p, barcode: "", has_variants: true, variant_barcodes: ["7891234567895"] } : p));
    const linhas = linhasDaNota({ 4: { tipo: "fora" } }, { 3: { variantes: { "v-p": 4, "v-m": 6 } } }, comGrade);
    const itens = itensDaConferencia(linhas, false);
    expect(itens.find((i) => i.n === 3)).toMatchObject({ variantes: [{ variant_id: "v-p", quantity: 4 }, { variant_id: "v-m", quantity: 6 }], quantidade: 10 });
    expect(itens.find((i) => i.n === 1)).toMatchObject({ produtoId: "p-esmalte", codigoDaVariante: "07891234567895", variantes: null });
  });

  test("corpo com fornecedor, nota e chave; supplier_code só com fornecedor; sem custo, sem unit_cost", () => {
    const itens = [item(1, { codigoFornecedor: "A-1" }), item(2, { custo: null, variantes: [{ variant_id: "v1", quantity: 2 }] }), item(3, { produtoId: null, novo: { name: "Novo", price: 9.9 } })];
    const [parte] = montarCorpos(itens, { chave: CHAVE, origem: "nota", fornecedorId: "f-1", numeroDaNota: "7731", chaveDaNota: "3".repeat(44), usarMedio: false });
    expect(parte.corpo).toEqual({
      idempotency_key: CHAVE, origin: "nota", update_cost: false, supplier_id: "f-1", invoice_number: "7731", nfe_key: "3".repeat(44),
      items: [
        { product_id: "p-1", quantity: 1, unit_cost: 2, supplier_code: "A-1" },
        { product_id: "p-2", variants: [{ variant_id: "v1", quantity: 2 }] },
        { new_product: { name: "Novo", price: 9.9 }, quantity: 1, unit_cost: 2 },
      ],
    });
    const [semForn] = montarCorpos([item(1, { codigoFornecedor: "A-1" })], { chave: CHAVE, origem: "digitar", fornecedorId: null, numeroDaNota: null, chaveDaNota: null, usarMedio: true });
    expect(semForn.corpo).toEqual({ idempotency_key: CHAVE, origin: "digitar", update_cost: true, items: [{ product_id: "p-1", quantity: 1, unit_cost: 2 }] });
  });

  test("acima de 300 linhas: partes de até 300, cada uma com a sua chave (sempre a mesma)", () => {
    const itens = Array.from({ length: 650 }, (_, i) => item(i + 1));
    const cab = { chave: CHAVE, origem: "planilha" as const, fornecedorId: null, numeroDaNota: null, chaveDaNota: null, usarMedio: true };
    const partes = montarCorpos(itens, cab);
    expect(partes.map((p) => p.itens.length)).toEqual([300, 300, 50]);
    expect(partes.map((p) => p.corpo.idempotency_key)).toEqual([CHAVE + "-p1", CHAVE + "-p2", CHAVE + "-p3"]);
    expect(montarCorpos(itens, cab).map((p) => p.corpo.idempotency_key)).toEqual(partes.map((p) => p.corpo.idempotency_key));
    for (const p of partes) expect(String(p.corpo.idempotency_key)).toMatch(CHAVE_VALIDA);
    expect(chaveDaParte(CHAVE, 0, 1)).toBe(CHAVE);
  });
});

describe("variant_id pelo código de barras", () => {
  test("acha a variante; quem não acha volta a pedir a grade", async () => {
    const buscar = jest.fn(async (pid: string) => ({
      variants: pid === "p-1" ? [{ id: "v-a", barcode: "7891234567895" }, { id: "v-b", barcode: "7891234567000" }] : [],
    }));
    const r = await resolverVariantes(
      [item(1, { codigoDaVariante: "07891234567895", quantidade: 5 }), item(2, { produtoId: "p-2", codigoDaVariante: "123456789" }), item(3)],
      buscar,
    );
    expect(r.itens[0]).toMatchObject({ variantes: [{ variant_id: "v-a", quantity: 5 }], codigoDaVariante: null });
    expect(r.semVariante).toEqual([2]);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});

describe("envio com a mesma chave", () => {
  const ok = { supplier: null, lines: [], totals: { lines: 0, products: 0, quantity: 0 } };

  test("resposta que não chega repete com o MESMO corpo (mesma chave)", async () => {
    const enviar = jest.fn()
      .mockRejectedValueOnce({ status: 0, isNetworkError: true })
      .mockRejectedValueOnce({ status: 409, data: { code: "EM_ANDAMENTO" } })
      .mockResolvedValueOnce(ok);
    const corpo = { idempotency_key: CHAVE, items: [] };
    await expect(enviarComAMesmaChave(enviar, corpo, { pausaMs: 0 })).resolves.toBe(ok);
    expect(enviar).toHaveBeenCalledTimes(3);
    for (const c of enviar.mock.calls) expect(c[0]).toBe(corpo);
  });

  test("erro de conteúdo não repete", async () => {
    const enviar = jest.fn().mockRejectedValue({ status: 400, data: { code: "LINHAS_COM_ERRO" } });
    await expect(enviarComAMesmaChave(enviar, {}, { pausaMs: 0 })).rejects.toMatchObject({ status: 400 });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(deveRepetir({ status: 503 })).toBe(false);
    expect(deveRepetir({ status: 502 })).toBe(true);
  });

  test("desiste depois das tentativas", async () => {
    const enviar = jest.fn().mockRejectedValue({ status: 0, isNetworkError: true });
    await expect(enviarComAMesmaChave(enviar, {}, { pausaMs: 0, tentativas: 3 })).rejects.toBeTruthy();
    expect(enviar).toHaveBeenCalledTimes(3);
  });

  test("falha no meio: para na parte que falhou e diz quantos entraram", async () => {
    const itens = Array.from({ length: 650 }, (_, i) => item(i + 1));
    const partes = montarCorpos(itens, { chave: CHAVE, origem: "planilha", fornecedorId: null, numeroDaNota: null, chaveDaNota: null, usarMedio: true });
    const enviar = jest.fn()
      .mockResolvedValueOnce({ ...ok, lines: [{ index: 0, product_id: "p-1", name: "x", quantity: 1 }] })
      .mockRejectedValue({ status: 0, isNetworkError: true });
    const progresso = jest.fn();
    const r = await gravarEntrada(partes, enviar, progresso, { pausaMs: 0, tentativas: 2 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.partesFeitas).toBe(1);
    expect(r.itensFeitos).toBe(300);
    expect(progresso).toHaveBeenCalledWith(300);
    expect(r.parteComErro.corpo.idempotency_key).toBe(CHAVE + "-p2");
  });
});

describe("erros e pronto", () => {
  test("erros por linha voltam ao n da tela", () => {
    const parte = { corpo: {}, itens: [item(4), item(7)] };
    expect(errosPorLinha({ data: { lines: [{ index: 1, error: "Produto não encontrado" }] } }, parte)).toEqual({ 7: "Produto não encontrado" });
  });

  test("resumo do Pronto soma as partes", () => {
    const r = resumoDoPronto([
      { supplier: { id: "f", name: "Distribuidora Alfa", created: false }, lines: [{ index: 0, product_id: "a", name: "A", quantity: 1 }, { index: 1, product_id: "b", name: "B", quantity: 1, created: true }], totals: { lines: 2, products: 2, quantity: 2, total_cost: 10 } },
      { supplier: null, lines: [{ index: 0, product_id: "c", name: "C", quantity: 1 }], totals: { lines: 1, products: 1, quantity: 1, total_cost: 5.5 } },
    ]);
    expect(r).toEqual({ comEntrada: 3, jaTinha: 2, cadastrados: 1, fornecedor: "Distribuidora Alfa", totalDaCompra: 15.5 });
  });

  test("lista dos que faltam em CSV", () => {
    expect(csvDosQueFaltam([item(1, { descricao: "Acetona; 100 ml", quantidade: 2.5, custo: 3.2, codigoFornecedor: "A-1" })]))
      .toBe('nome;codigo;quantidade;custo\n"Acetona; 100 ml";A-1;2,5;3,2');
  });
});
