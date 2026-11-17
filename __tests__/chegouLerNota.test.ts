// ============================================================
// "Chegou mercadoria": leitura do XML da nota (lerNota).
// O leitor de hoje não trazia código de barras, código do fornecedor nem a
// chave da nota. Este traz, e recusa o PDF e o arquivo que não é nota.
// ============================================================
import { lerNota, pareceUmPdf, codigoDeBarrasDaNota } from "@/components/screens/estoque/chegou/lerNota";
import { XML_ALFA } from "./fixtures/chegouNotas";

describe("lerNota", () => {
  test("lê cabeçalho, emitente, totais e itens com os códigos", () => {
    const r = lerNota(XML_ALFA, "nota-4512.xml");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const n = r.nota;
    expect(n.numero).toBe("004512");
    expect(n.serie).toBe("1");
    expect(n.chave).toBe("35261112345678000190550010000045121000045120");
    expect(n.emitidaEm).toBe("2026-11-14");
    expect(n.emitente).toEqual({ nome: "Distribuidora Alfa", cnpj: "12345678000190", telefone: "1133334444" });
    expect(n.totalDosProdutos).toBe(182.4);
    expect(n.totalDaNota).toBe(190);
    expect(n.itens).toHaveLength(3);
    expect(n.itens[0]).toEqual({
      n: 1, descricao: "ESMALTE CREM VERM 8ML", codigoFornecedor: "AL-0100", codigoBarras: "7891234567895",
      ncm: "33043000", unidade: "UN", quantidade: 24, custoUnitario: 6, total: 144,
    });
  });

  test("desconto do item entra no custo; 'SEM GTIN' vira sem código de barras", () => {
    const r = lerNota(XML_ALFA);
    if (!r.ok) throw new Error("devia ler");
    const acetona = r.nota.itens[1];
    expect(acetona.codigoBarras).toBeNull();
    expect(acetona.total).toBe(38.4);
    expect(acetona.custoUnitario).toBe(3.2);
  });

  test("item com quantidade zero vem como está (a conferência decide)", () => {
    const r = lerNota(XML_ALFA);
    if (!r.ok) throw new Error("devia ler");
    expect(r.nota.itens[2].quantidade).toBe(0);
    expect(r.nota.itens[2].codigoBarras).toBeNull();
  });

  test("chave pelo Id do infNFe quando não há protocolo", () => {
    const semProt = XML_ALFA.replace(/<protNFe>.*<\/protNFe>/, "");
    const r = lerNota(semProt);
    if (!r.ok) throw new Error("devia ler");
    expect(r.nota.chave).toBe("35261112345678000190550010000045121000045120");
  });

  test("PDF, planilha e XML que não é nota são recusados", () => {
    expect(lerNota("%PDF-1.7 ...", "nota.pdf")).toEqual({ ok: false, motivo: "pdf" });
    expect(lerNota("<x/>", "danfe.PDF")).toEqual({ ok: false, motivo: "pdf" });
    expect(lerNota("nome;preco\nA;1", "lista.csv")).toEqual({ ok: false, motivo: "nao_e_nota" });
    expect(lerNota("<?xml version='1.0'?><pedido><item/></pedido>", "pedido.xml")).toEqual({ ok: false, motivo: "nao_e_nota" });
    expect(lerNota("<nfeProc><NFe><infNFe></infNFe></NFe></nfeProc>")).toEqual({ ok: false, motivo: "nao_e_nota" });
    expect(lerNota("")).toEqual({ ok: false, motivo: "nao_e_nota" });
  });

  test("ajudantes", () => {
    expect(pareceUmPdf("x.pdf", "")).toBe(true);
    expect(pareceUmPdf("x.xml", "  %PDF-1.4")).toBe(true);
    expect(pareceUmPdf("x.xml", "<nfeProc/>")).toBe(false);
    expect(codigoDeBarrasDaNota("SEM GTIN")).toBeNull();
    expect(codigoDeBarrasDaNota("0000000000000")).toBeNull();
    expect(codigoDeBarrasDaNota("07891234567895")).toBe("07891234567895");
  });
});
