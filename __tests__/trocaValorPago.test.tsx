// ============================================================
// Troca: o item devolvido vale o que a cliente PAGOU (INC-2026-11-19-01)
//
// Caso real: blusa de R$ 79,90 vendida com R$ 25,00 de desconto na venda
// inteira (total R$ 54,90). O wizard mostrava (e mandava) R$ 79,90. Agora o
// backend devolve `valor_pago_unit` na busca da troca e a tela usa ele; sem o
// campo (backend antigo), o cálculo de antes.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: false }, isLoading: false, error: null, invalidate: jest.fn() }),
}));

import { Step2Returns } from "@/components/screens/pdv/troca/Step2Returns";
import { valorUnitDevolvido } from "@/components/screens/pdv/troca/devolucaoUtil";
import { montarOrigensDaTroca } from "@/components/screens/pdv/troca/pedidoOnline";
import type { SelectedSaleRow, ReturnEntry } from "@/components/screens/pdv/troca/types";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

function venda(item: Record<string, any>): SelectedSaleRow {
  return {
    id: "c1667516",
    total_amount: 54.9,
    payment_method: "pix",
    status: "completed",
    created_at: new Date().toISOString(),
    company_id: "company-1",
    company_name: "Loja",
    customer_id: "cli-1",
    customer_name: "Maria",
    cpf_cnpj: null,
    seller_id: null,
    seller_name: "Ana",
    is_cross_filial: false,
    item_count: 1,
    items: [{
      product_id: "prod-blusa",
      variant_id: null,
      product_name_snapshot: "BLUSA POLO FEMININA",
      quantity: 1,
      unit_price: 79.9,
      total_price: 79.9,
      original_sale_item_id: "si-1",
      ...item,
    }],
  } as any;
}

let ultimo: ReturnEntry[] = [];
function Harness({ sale }: { sale: SelectedSaleRow }) {
  const [entries, setEntries] = useState<ReturnEntry[]>([]);
  ultimo = entries;
  return <Step2Returns selectedSales={[sale]} returnEntries={entries} onChangeEntries={setEntries} />;
}

function montar(sale: SelectedSaleRow) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness sale={sale} />); });
  return tree;
}

describe("valorUnitDevolvido", () => {
  it("usa valor_pago_unit do backend", () => {
    expect(valorUnitDevolvido({ valor_pago_unit: 54.9 }, 79.9)).toBe(54.9);
    expect(valorUnitDevolvido({ valor_pago_unit: "54.90" as any }, 79.9)).toBe(54.9);
    expect(valorUnitDevolvido({ valor_pago_unit: 0 }, 79.9)).toBe(0);
  });

  it("sem o campo (backend antigo) ou valor inválido: o cálculo de antes", () => {
    expect(valorUnitDevolvido({}, 79.9)).toBe(79.9);
    expect(valorUnitDevolvido({ valor_pago_unit: null }, 79.9)).toBe(79.9);
    expect(valorUnitDevolvido({ valor_pago_unit: NaN }, 79.9)).toBe(79.9);
    expect(valorUnitDevolvido({ valor_pago_unit: -1 }, 79.9)).toBe(79.9);
    expect(valorUnitDevolvido(undefined, 12)).toBe(12);
  });
});

describe("Step2Returns · valor pago", () => {
  it("caso real: lista e devolução em R$ 54,90, não R$ 79,90", () => {
    const tree = montar(venda({ valor_pago_unit: 54.9, valor_pago_total: 54.9 }));
    expect(flattenText(tree.toJSON())).toContain("R$ 54,90 · qtd. orig.");

    const inc = tree.root.findAllByProps({ testID: "troca-dev-inc-prod-blusa" })
      .find((n: any) => typeof n.props.onPress === "function");
    act(() => { inc!.props.onPress(); });

    expect(ultimo).toHaveLength(1);
    expect(ultimo[0].item.valor_pago_unit).toBe(54.9);
    const texto = flattenText(tree.toJSON());
    expect(texto).toContain("devolvendo R$ 54,90");
    expect(texto).not.toContain("R$ 79,90");
    tree.unmount();
  });

  it("backend antigo (sem valor_pago_unit): igual a hoje", () => {
    const tree = montar(venda({}));
    expect(flattenText(tree.toJSON())).toContain("R$ 79,90 · qtd. orig.");
    tree.unmount();
  });

  it("o payload da troca leva o valor pago (montarOrigensDaTroca com o mesmo cálculo do TrocaModal)", () => {
    const sale = venda({ valor_pago_unit: 54.9 });
    const entries = [{
      saleId: sale.id, saleDate: sale.created_at, saleCompanyName: "Loja", sellerName: null,
      item: { id: "si-1", product_id: "prod-blusa", quantity: 1, unit_price: 79.9, total_price: 79.9, valor_pago_unit: 54.9 },
      returnQty: 1, previouslyReturnedQty: 0,
    }];
    const r = montarOrigensDaTroca([sale] as any, entries as any, (e: any) => valorUnitDevolvido(e.item, e.item.total_price / e.item.quantity));
    expect(r.returned_items[0]).toMatchObject({ original_sale_item_id: "si-1", unit_price: 54.9 });
  });
});
