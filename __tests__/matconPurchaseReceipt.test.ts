// ============================================================
// Matcon M4 › Compras — utils/matconPurchaseReceipt.ts (23/09/2026).
//
// A conferencia do XML avisa o backend que a nota entrou (Aura-backend#741):
//   - o emitente e o numero saem do XML (emit/xNome, emit/CNPJ, ide/nNF);
//   - o corpo leva so as linhas com produto, com quantidade e custo DA NOTA
//     (unidade de compra: 10 cx a R$ 89,90), nunca os ja convertidos;
//   - falha nunca lanca: vira o aviso em portugues simples;
//   - os pedidos mexidos viram "recebido por completo" / "em parte".
// ============================================================
import {
  AVISO_FALHA_ENTRADA,
  frasesDosPedidos,
  lerNotaDoFornecedor,
  montarEntradaDaNota,
  registrarEntradaDaNota,
} from "@/utils/matconPurchaseReceipt";
import type { PurchaseOrder } from "@/services/matconApi";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>
  <ide><nNF>12884</nNF></ide>
  <emit>
    <CNPJ>11111111000111</CNPJ>
    <xNome>Cerâmica Portobello Distribuidora</xNome>
    <enderEmit><fone>1140028922</fone></enderEmit>
  </emit>
  <dest><CNPJ>22222222000122</CNPJ><xNome>Depósito do Zé</xNome></dest>
  <det nItem="1"><prod><xProd>Porcelanato Bianco 60x60</xProd><qCom>10</qCom><vUnCom>89.90</vUnCom></prod></det>
</infNFe></NFe></nfeProc>`;

const NOTA = {
  supplier_name: "Cerâmica Portobello Distribuidora",
  supplier_cnpj: "11111111000111",
  supplier_phone: "1140028922",
  invoice_number: "12884",
};

function pedido(number: string, status: PurchaseOrder["status"]): PurchaseOrder {
  return {
    id: "po-" + number, number, status,
    supplier_name: NOTA.supplier_name, supplier_cnpj: NOTA.supplier_cnpj,
    items: [], total_est: 0, created_at: "2026-09-20T10:00:00Z",
  };
}

describe("lerNotaDoFornecedor", () => {
  it("lê o emitente (não o destinatário) e o número da nota", () => {
    expect(lerNotaDoFornecedor(XML)).toEqual(NOTA);
  });

  it("campo ausente vira null e XML quebrado não lança", () => {
    const semFone = XML.replace("<enderEmit><fone>1140028922</fone></enderEmit>", "");
    expect(lerNotaDoFornecedor(semFone).supplier_phone).toBeNull();
    const nada = lerNotaDoFornecedor("isto não é xml");
    expect(nada.supplier_cnpj).toBeNull();
    expect(nada.invoice_number).toBeNull();
  });
});

describe("montarEntradaDaNota", () => {
  it("leva só as linhas com produto, com quantidade e custo da nota sem converter", () => {
    const body = montarEntradaDaNota(NOTA, [
      { product_id: "prod-piso", quantity: 10, unit_cost: 89.9 },   // 10 cx (= 23,2 m²) — vai 10
      { product_id: null, quantity: 3, unit_cost: 12 },             // sem produto: fora
      { product_id: "prod-cimento", quantity: 0, unit_cost: 32.9 }, // quantidade zero: fora
      { product_id: "prod-areia", quantity: 2.5, unit_cost: 0 },
    ]);
    expect(body).toEqual({
      supplier_name: "Cerâmica Portobello Distribuidora",
      supplier_cnpj: "11111111000111",
      supplier_phone: "1140028922",
      invoice_number: "12884",
      items: [
        { product_id: "prod-piso", quantity: 10, unit_cost: 89.9 },
        { product_id: "prod-areia", quantity: 2.5, unit_cost: 0 },
      ],
    });
  });

  it("sem telefone não manda a chave; sem item nenhum não há corpo", () => {
    const body = montarEntradaDaNota({ ...NOTA, supplier_phone: null }, [{ product_id: "p", quantity: 1, unit_cost: 1 }]);
    expect(body).not.toHaveProperty("supplier_phone");
    expect(montarEntradaDaNota(NOTA, [{ product_id: null, quantity: 1, unit_cost: 1 }])).toBeNull();
    expect(montarEntradaDaNota(NOTA, [])).toBeNull();
  });
});

describe("registrarEntradaDaNota", () => {
  const body = montarEntradaDaNota(NOTA, [{ product_id: "prod-piso", quantity: 10, unit_cost: 89.9 }]);

  it("chama uma vez, na empresa da importação, e devolve os pedidos", async () => {
    const api = { registerPurchaseReceipt: jest.fn(() => Promise.resolve({ products_updated: 1, ignored: 0, orders: [pedido("C-0042", "received")] })) };
    const r = await registrarEntradaDaNota("loja-2", body, api as any);
    expect(api.registerPurchaseReceipt).toHaveBeenCalledTimes(1);
    expect(api.registerPurchaseReceipt).toHaveBeenCalledWith("loja-2", body);
    expect(r).toEqual({ orders: [pedido("C-0042", "received")], aviso: null });
  });

  it("falha (403 MATCON_DISABLED, rede) não lança: devolve o aviso", async () => {
    const erro = Object.assign(new Error("Materiais de construção não está ligado."), { status: 403, code: "MATCON_DISABLED" });
    const api = { registerPurchaseReceipt: jest.fn(() => Promise.reject(erro)) };
    await expect(registrarEntradaDaNota("loja-1", body, api as any)).resolves.toEqual({ orders: [], aviso: AVISO_FALHA_ENTRADA });
    expect(AVISO_FALHA_ENTRADA).toBe(
      "A nota entrou no estoque, mas não consegui registrar a compra no módulo de materiais de construção."
    );
  });

  it("sem corpo não chama a rota", async () => {
    const api = { registerPurchaseReceipt: jest.fn() };
    await expect(registrarEntradaDaNota("loja-1", null, api as any)).resolves.toEqual({ orders: [], aviso: null });
    expect(api.registerPurchaseReceipt).not.toHaveBeenCalled();
  });
});

describe("frasesDosPedidos", () => {
  it("fechado = por completo; ainda enviado = em parte", () => {
    expect(frasesDosPedidos([pedido("C-0042", "received"), pedido("C-0043", "sent")])).toEqual([
      "Pedido de compra C-0042 recebido por completo",
      "Pedido de compra C-0043 recebido em parte",
    ]);
    expect(frasesDosPedidos([])).toEqual([]);
  });
});
