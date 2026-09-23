// ============================================================
// Matcon M4 — components/matcon/comprasUtil.ts (22/09/2026).
//
// Funções puras que a esteira /matcon/compras usa: agrupamento por
// fornecedor (ordem = mais dinheiro faltando primeiro), a frase de cada
// item da sugestão (exemplo do cimento do mockup #compras) e o progresso
// "40 de 60 sc" de um pedido recebido parcial (mockup #pedido).
// ============================================================
import {
  agruparPorFornecedor, fraseDaSugestao, textoPedidoWhatsApp, progressoDoPedido,
  produtosJaPedidos, fraseJaPedido,
} from "@/components/matcon/comprasUtil";
import type { PurchaseOrder, PurchaseSuggestion } from "@/services/matconApi";

function sugestao(over: Partial<PurchaseSuggestion> = {}): PurchaseSuggestion {
  return {
    product_id: "prod-1",
    name: "Cimento CP-II 50 kg",
    unit: "sc",
    stock: 12,
    min_stock: 40,
    weekly_sales: 18,
    suggested_qty: 60,
    est_cost: 1974,
    supplier_name: "Cimentos Ipê Distribuidora",
    supplier_cnpj: "11.111.111/0001-11",
    supplier_phone: "(11) 4002-8922",
    days_to_stockout: null,
    ...over,
  };
}

function pedido(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "pedido-1",
    number: "C-0039",
    status: "sent",
    supplier_name: "Cimentos Ipê Distribuidora",
    supplier_cnpj: "11.111.111/0001-11",
    supplier_phone: "(11) 4002-8922",
    items: [
      { product_id: "prod-1", name: "Cimento CP-II 50 kg", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 0 },
    ],
    total_est: 1974,
    sent_at: "2026-09-19T10:00:00Z",
    received_at: null,
    received_invoice: null,
    created_at: "2026-09-19T09:00:00Z",
    ...over,
  };
}

describe("agruparPorFornecedor", () => {
  test("agrupa por fornecedor e soma o total_est", () => {
    const grupos = agruparPorFornecedor([
      sugestao({ product_id: "p1", est_cost: 1974 }),
      sugestao({ product_id: "p2", name: "Argamassa AC-III 20 kg", est_cost: 1512 }),
      sugestao({
        product_id: "p3", name: "Porcelanato Cinza Concreto 60x60", est_cost: 2518,
        supplier_name: "Cerâmica Elizabeth", supplier_cnpj: "22.222.222/0001-22", supplier_phone: null,
      }),
    ]);

    expect(grupos).toHaveLength(2);
    const ipe = grupos.find((g) => g.supplier_name === "Cimentos Ipê Distribuidora");
    expect(ipe?.items).toHaveLength(2);
    expect(ipe?.total_est).toBeCloseTo(1974 + 1512);
  });

  test("ordena do fornecedor com mais dinheiro faltando para o com menos", () => {
    const grupos = agruparPorFornecedor([
      sugestao({ product_id: "p1", est_cost: 2000, supplier_name: "A", supplier_cnpj: "a" }),
      sugestao({ product_id: "p2", est_cost: 5000, supplier_name: "B", supplier_cnpj: "b" }),
      sugestao({ product_id: "p3", est_cost: 3000, supplier_name: "C", supplier_cnpj: "c" }),
    ]);
    expect(grupos.map((g) => g.supplier_name)).toEqual(["B", "C", "A"]);
  });

  test("sem fornecedor cadastrado agrupa como 'Sem fornecedor identificado'", () => {
    const grupos = agruparPorFornecedor([
      sugestao({ product_id: "p1", supplier_name: null, supplier_cnpj: null, supplier_phone: null }),
    ]);
    expect(grupos[0].supplier_name).toBe("Sem fornecedor identificado");
  });

  test("min_days_to_stockout é o menor prazo entre os itens do fornecedor", () => {
    const grupos = agruparPorFornecedor([
      sugestao({ product_id: "p1", days_to_stockout: 10 }),
      sugestao({ product_id: "p2", days_to_stockout: 3 }),
    ]);
    expect(grupos[0].min_days_to_stockout).toBe(3);
  });

  test("lista vazia devolve lista vazia", () => {
    expect(agruparPorFornecedor([])).toEqual([]);
  });
});

describe("fraseDaSugestao", () => {
  test("o exemplo do cimento do mockup #compras", () => {
    const frase = fraseDaSugestao(sugestao());
    expect(frase).toBe("tem 12 sc, mínimo 40, vende 18/semana → sugerimos 60 sc (~R$ 1.974)");
  });

  test("arredonda o custo estimado, sem centavos", () => {
    const frase = fraseDaSugestao(sugestao({ est_cost: 2087.6 }));
    expect(frase).toContain("~R$ 2.088");
  });
});

describe("fraseDaSugestao — motivo do backend (QA 23/09/2026, regra do Estoque)", () => {
  test("zerado sem mínimo: nada de 'mínimo 0'", () => {
    const frase = fraseDaSugestao(sugestao({ reason: "zerado_sem_minimo", stock: 0, min_stock: 0, unit: "cx", suggested_qty: 1, est_cost: 49.9 }));
    expect(frase).toBe("estoque zerado · sem mínimo cadastrado — sugiro 1 caixa (~R$ 50)");
    expect(frase).not.toContain("mínimo 0");
  });

  test("vai acabar: 'acaba em N dias no ritmo atual'", () => {
    const frase = fraseDaSugestao(sugestao({ reason: "vai_acabar", days_to_stockout: 4 }));
    expect(frase).toBe("tem 12 sacos, acaba em 4 dias no ritmo atual → sugerimos 60 sacos (~R$ 1.974)");
    expect(fraseDaSugestao(sugestao({ reason: "vai_acabar", days_to_stockout: 1 }))).toContain("acaba em 1 dia no ritmo atual");
  });

  test("abaixo do mínimo ou sem motivo: a frase de sempre", () => {
    const deSempre = "tem 12 sc, mínimo 40, vende 18/semana → sugerimos 60 sc (~R$ 1.974)";
    expect(fraseDaSugestao(sugestao({ reason: "abaixo_do_minimo" }))).toBe(deSempre);
    expect(fraseDaSugestao(sugestao())).toBe(deSempre);
  });
});

describe("produtosJaPedidos — o que já está num pedido enviado", () => {
  test("só pedido enviado, e só o item que ainda não chegou inteiro", () => {
    const mapa = produtosJaPedidos([
      pedido({ id: "o1", number: "C-0001", status: "sent", items: [
        { product_id: "p1", name: "Cimento", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 0 },
        { product_id: "p2", name: "Areia", unit: "m³", quantity: 5, unit_cost_est: 120, received_qty: 5 },
      ] }),
      pedido({ id: "o2", number: "C-0002", status: "draft", items: [
        { product_id: "p3", name: "Brita", unit: "m³", quantity: 3, unit_cost_est: 110, received_qty: 0 },
      ] }),
    ]);
    expect(mapa).toEqual({ p1: "C-0001" });
    expect(fraseJaPedido(mapa.p1)).toBe("já pedido no C-0001, chega em breve");
  });
});

describe("textoPedidoWhatsApp", () => {
  test("monta o texto pronto para o fornecedor", () => {
    const texto = textoPedidoWhatsApp(
      pedido({
        items: [
          { product_id: "p1", name: "Cimento CP-II 50 kg", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 0 },
          { product_id: "p2", name: "Argamassa AC-III 20 kg", unit: "sc", quantity: 80, unit_cost_est: 18.9, received_qty: 0 },
        ],
      }),
      "Depósito Santa Rita",
    );
    expect(texto).toBe(
      "Bom dia! Aqui é do Depósito Santa Rita.\n" +
      "Preciso de:\n" +
      "· 60 sc de Cimento CP-II 50 kg\n" +
      "· 80 sc de Argamassa AC-III 20 kg\n" +
      "Consegue entregar esta semana? Obrigado!",
    );
  });
});

describe("progressoDoPedido", () => {
  test("40 de 60 sc — recebimento parcial", () => {
    const p = progressoDoPedido(pedido({
      items: [
        { product_id: "p1", name: "Cimento CP-II 50 kg", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 40 },
      ],
    }));
    expect(p.itens[0].label).toBe("40 de 60 sc");
    expect(p.itens[0].completo).toBe(false);
    expect(p.pct).toBeCloseTo(66.67, 0);
  });

  test("pedido totalmente recebido fica completo, 100%", () => {
    const p = progressoDoPedido(pedido({
      items: [
        { product_id: "p1", name: "Cimento CP-II 50 kg", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 60 },
      ],
    }));
    expect(p.itens[0].completo).toBe(true);
    expect(p.pct).toBe(100);
  });

  test("pedido ainda sem nada recebido fica em 0%", () => {
    const p = progressoDoPedido(pedido());
    expect(p.itens[0].label).toBe("0 de 60 sc");
    expect(p.pct).toBe(0);
  });
});
