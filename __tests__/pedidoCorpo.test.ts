// ============================================================
// Novo pedido (A2): o carrinho vira o corpo do POST /pedidos
// (Aura-backend#1069) e os atalhos de data do passo 2.
// ============================================================
import {
  corpoDoPedido, itemDoPedido, totalDoPedido, pecasDoPedido, assinaturaDosItens,
  atalhosDeData, dataCurta, dataLonga, numeroDoPedido, primeiroNome, hojeEmSaoPaulo,
} from "@/components/screens/pdv/pedido/corpoDoPedido";

const VESTIDO = "11111111-1111-4111-8111-111111111111";
const VARIANTE = "22222222-2222-4222-8222-222222222222";

describe("item do pedido", () => {
  test("chave produto__variante vira product_id + variant_id; preço de tabela e desconto do lápis", () => {
    expect(itemDoPedido({ productId: VESTIDO + "__" + VARIANTE, name: "Vestido (P)", price: 170, listPrice: 189.9, qty: 2 })).toEqual({
      product_id: VESTIDO, variant_id: VARIANTE, product_name: "Vestido (P)", quantity: 2, unit_price: 189.9, item_discount: 39.8,
    });
  });

  test("sem lápis, sem item_discount; item avulso vai sem product_id", () => {
    expect(itemDoPedido({ productId: VESTIDO, name: "Vestido", price: 189.9, qty: 1 })).toEqual({
      product_id: VESTIDO, variant_id: null, product_name: "Vestido", quantity: 1, unit_price: 189.9,
    });
    expect(itemDoPedido({ productId: "avulso-123", name: "Ajuste", price: 20, qty: 1 }).product_id).toBeNull();
  });

  test("preço no cartão ligado: vale o preço do dinheiro", () => {
    const it = itemDoPedido({ productId: VESTIDO, name: "Vestido", price: 199.9, listPrice: 199.9, cashPrice: 189.9, cashListPrice: 189.9, qty: 1 });
    expect(it.unit_price).toBe(189.9);
    expect(it.item_discount).toBeUndefined();
  });
});

describe("corpo do pedido", () => {
  const itens = [
    { productId: VESTIDO, name: "Vestido", price: 189.9, qty: 1 },
    { productId: VESTIDO + "__" + VARIANTE, name: "Blusa", price: 139.9, qty: 1 },
  ];

  test("cliente cadastrado, data e desconto do pedido", () => {
    expect(corpoDoPedido({ itens, desconto: 10, data: "2026-11-20", cliente: { tipo: "cadastro", id: "c-1", name: "Marina", phone: null } })).toEqual({
      items: [
        { product_id: VESTIDO, variant_id: null, product_name: "Vestido", quantity: 1, unit_price: 189.9 },
        { product_id: VESTIDO, variant_id: VARIANTE, product_name: "Blusa", quantity: 1, unit_price: 139.9 },
      ],
      promised_date: "2026-11-20",
      discount: 10,
      customer_id: "c-1",
    });
  });

  test("seguir sem cliente: só o nome; sem nome, nada", () => {
    expect(corpoDoPedido({ itens, desconto: 0, data: "2026-11-20", cliente: { tipo: "sem-cadastro", name: " Patrícia " } }).customer_name).toBe("Patrícia");
    const semNome = corpoDoPedido({ itens, desconto: 0, data: "2026-11-20", cliente: { tipo: "sem-cadastro", name: "" } });
    expect(semNome.customer_name).toBeUndefined();
    expect(semNome.customer_id).toBeUndefined();
    expect(semNome.discount).toBeUndefined();
  });

  test("total, peças e assinatura", () => {
    expect(totalDoPedido(itens, 0)).toBe(329.8);
    expect(totalDoPedido(itens, 29.8)).toBe(300);
    expect(pecasDoPedido([{ productId: VESTIDO, name: "x", price: 1, qty: 3 }])).toBe(3);
    expect(assinaturaDosItens(itens, 0)).toBe(assinaturaDosItens(itens.map((i) => ({ ...i })), 0));
    expect(assinaturaDosItens(itens, 0)).not.toBe(assinaturaDosItens([itens[0]], 0));
  });
});

describe("datas", () => {
  test("terça 17/11: Amanhã, Sexta e Em 7 dias", () => {
    expect(atalhosDeData("2026-11-17")).toEqual([
      { chave: "amanha", data: "2026-11-18" },
      { chave: "sexta", data: "2026-11-20" },
      { chave: "7dias", data: "2026-11-24" },
    ]);
  });

  test("quinta: amanhã já é sexta, a Sexta some; sexta: some também", () => {
    expect(atalhosDeData("2026-11-19").map((a) => a.chave)).toEqual(["amanha", "7dias"]);
    expect(atalhosDeData("2026-11-20").map((a) => a.chave)).toEqual(["amanha", "7dias"]);
  });

  test("virada de mês e formatos do mockup", () => {
    expect(atalhosDeData("2026-11-30")[0].data).toBe("2026-12-01");
    expect(dataCurta("2026-11-18")).toBe("qua, 18/11");
    expect(dataLonga("2026-11-20")).toBe("sexta, 20/11");
    expect(hojeEmSaoPaulo(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
  });

  test("número e primeiro nome", () => {
    expect(numeroDoPedido(12)).toBe("P-0012");
    expect(numeroDoPedido("#345")).toBe("P-0345");
    expect(numeroDoPedido("BAL-9")).toBe("BAL-9");
    expect(primeiroNome("Marina Duarte")).toBe("Marina");
    expect(primeiroNome("  ")).toBeNull();
  });
});
