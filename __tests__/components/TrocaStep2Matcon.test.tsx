// ============================================================
// Matcon M4 — devolução de sobra de obra, Step2Returns do wizard de troca
// (docs/mockups/matcon-m4-profundidade.html §"Passo 2 — o que voltou";
// docs/CONTRACT_MATCON.md §"Devolução de sobra de obra"). Criado: 22/09/2026.
//
//   - toggle OFF: item em m² é idêntico a hoje — stepper (− e +).
//   - toggle ON + item fracionado: campo decimal; ao digitar 4,64 com
//     purchase_factor 2,32 aparece "2 caixas fechadas ... 4,64 m² ...".
//
// Icon mockado pelo mesmo motivo de CartPanelMatcon.test.tsx (svg não passa
// pelo transformIgnorePatterns do projeto).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

import { Step2Returns } from "@/components/screens/pdv/troca/Step2Returns";
import type { SelectedSaleRow, ReturnEntry } from "@/components/screens/pdv/troca/types";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

const VENDA: SelectedSaleRow = {
  id: "sale-1",
  total_amount: 5490,
  payment_method: "pix",
  status: "completed",
  created_at: new Date().toISOString(),
  company_id: "company-1",
  company_name: "Depósito do Zé",
  customer_id: null,
  customer_name: null,
  cpf_cnpj: null,
  seller_id: null,
  seller_name: "Marlene",
  is_cross_filial: false,
  item_count: 1,
  items: [
    {
      product_id: "prod-porcelanato",
      variant_id: null,
      product_name_snapshot: "Porcelanato Bianco 60×60",
      quantity: 100,
      unit_price: 54.9,
      unit: "m²",
      purchase_factor: 2.32,
      lot_code: "27B",
      lot_id: "lot-27b",
    },
  ],
} as any;

function Harness({ sale }: { sale: SelectedSaleRow }) {
  const [entries, setEntries] = useState<ReturnEntry[]>([]);
  return (
    <Step2Returns
      selectedSales={[sale]}
      returnEntries={entries}
      onChangeEntries={setEntries}
    />
  );
}

// findAllByProps casa o composto (DecimalQtyInput) E o host (TextInput) —
// mesmo padrão de qtyInput em CartPanelMatcon.test.tsx. O host é quem tem
// onFocus/onChangeText/onBlur de verdade.
function qtyInput(tree: renderer.ReactTestRenderer, testID: string): any {
  return tree.root.findAllByProps({ testID }).find((n: any) => typeof n.props.onFocus === "function");
}

function montar(sale: SelectedSaleRow = VENDA) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Harness sale={sale} />);
  });
  return tree;
}

describe("Step2Returns · Matcon M4 — devolução de sobra de obra", () => {
  afterEach(() => { mockPdvSettings = { matcon_enabled: false }; });

  it("toggle OFF: item em m² renderiza o stepper de sempre", () => {
    mockPdvSettings = { matcon_enabled: false };
    const tree = montar();

    expect(tree.root.findAllByProps({ testID: "troca-dev-dec-prod-porcelanato" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "troca-dev-inc-prod-porcelanato" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "troca-dev-qty-prod-porcelanato" }).length).toBe(0);
    expect(flattenText(tree.toJSON())).not.toContain("caixas fechadas");

    tree.unmount();
  });

  it("toggle ON: item fracionado troca o stepper pelo campo decimal", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar();

    expect(tree.root.findAllByProps({ testID: "troca-dev-dec-prod-porcelanato" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "troca-dev-inc-prod-porcelanato" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "troca-dev-qty-prod-porcelanato" }).length).toBeGreaterThan(0);

    tree.unmount();
  });

  it("digitar 4,64 (2 caixas de 2,32) mostra a linha verde com o lote e o crédito", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar();

    const input = qtyInput(tree, "troca-dev-qty-prod-porcelanato");
    act(() => { input.props.onFocus(); });
    act(() => { input.props.onChangeText("4,64"); });
    act(() => { input.props.onBlur(); });

    const text = flattenText(tree.toJSON());
    expect(text).toContain("2 caixas fechadas");
    expect(text).toContain("4,64 m²");
    expect(text).toContain("no lote 27B");
    expect(text).toContain("R$ 254,74");
    expect(text).not.toContain("caixa aberta");

    tree.unmount();
  });

  it("digitar 5,8 (2 caixas + sobra) mostra a linha verde E o aviso âmbar da caixa aberta", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar();

    const input = qtyInput(tree, "troca-dev-qty-prod-porcelanato");
    act(() => { input.props.onFocus(); });
    act(() => { input.props.onChangeText("5,8"); });
    act(() => { input.props.onBlur(); });

    const text = flattenText(tree.toJSON());
    expect(text).toContain("2 caixas fechadas");
    expect(text).toContain("Caixa aberta");
    expect(text).toContain("1,16 m²");
    expect(text).toContain("não volta ao estoque e vale R$ 0");

    tree.unmount();
  });

  it("cimento (unidade não fracionada) continua no stepper mesmo com o toggle ligado", () => {
    mockPdvSettings = { matcon_enabled: true };
    const cimento: SelectedSaleRow = {
      ...VENDA,
      items: [{
        product_id: "prod-cimento",
        variant_id: null,
        product_name_snapshot: "Cimento CP-II 50kg",
        quantity: 20,
        unit_price: 32.9,
        unit: "sc",
        purchase_factor: null,
      }],
    } as any;
    const tree = montar(cimento);

    expect(tree.root.findAllByProps({ testID: "troca-dev-dec-prod-cimento" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "troca-dev-qty-prod-cimento" }).length).toBe(0);

    tree.unmount();
  });
});
