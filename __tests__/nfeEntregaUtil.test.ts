// ============================================================
// Matcon M2 — NF-e que nasce da entrega (22/09/2026).
//
// components/matcon/nfeEntregaUtil.ts é puro: casa item da entrega com
// produto por `product_id` (fonte de verdade; deliveries.items[] carrega
// isso desde o ajuste de contrato do §M2), caindo pro nome normalizado só
// quando o item não tem product_id (item avulso). Soma peso, aponta quem
// está sem CEST e monta o EmitBody que nfceApi.emit espera — usando
// `item.unit_price` (preço da venda), nunca o preço atual do produto.
// ============================================================
import {
  pesoDaEntrega, itensSemCest, montarEmitBody, formInicialNfeEntrega,
  type NfeEntregaForm,
} from "@/components/matcon/nfeEntregaUtil";
import type { Delivery, DeliveryItem } from "@/services/matconApi";
import type { Product } from "@/components/screens/estoque/types";

function delivery(over: Partial<Delivery>): Delivery {
  return {
    id: "entrega-1",
    sale_id: "venda-1",
    sale_number: 1204,
    sequence: 1,
    stage: "ready",
    scheduled_for: "2026-09-22",
    delivered_by: null,
    customer_name: "Marlene Souza",
    customer_phone: "(11) 98765-4321",
    address: "Rua das Acácias, 233",
    total: 1220.58,
    has_pending: false,
    public_token: "tok",
    items: [],
    created_at: "2026-09-22T09:00:00Z",
    ...over,
  };
}

function item(over: Partial<DeliveryItem>): DeliveryItem {
  return {
    sale_item_id: "i1",
    product_id: null, // default: casamento por nome (item avulso)
    unit_price: 32.9,
    name: "Cimento CP-II 50 kg",
    unit: "sc",
    quantity: 10,
    sold_quantity: 10,
    delivered_before: 0,
    ...over,
  };
}

function product(over: Partial<Product>): Product {
  return {
    id: "p1",
    name: "Cimento CP-II 50 kg",
    code: "CIM-050",
    barcode: "",
    category: "Cimento",
    price: 32.9,
    cost: 20,
    stock: 100,
    minStock: 10,
    unit: "sc",
    ...over,
  } as Product;
}

const CIMENTO = product({
  id: "p-cimento", name: "Cimento CP-II 50 kg", weightKg: 50, cest: "05.001.00", origem: 0, icmsStPaid: true, price: 32.9,
});
const PORCELANATO = product({
  id: "p-porcelanato", name: "Porcelanato Bianco 60x60", weightKg: 22, cest: null, origem: 0, icmsStPaid: null, price: 59.9,
});
const AREIA_SEM_PESO = product({
  id: "p-areia", name: "Areia média", weightKg: null, cest: "10.099.00", origem: 0, icmsStPaid: true, price: 120,
});

describe("pesoDaEntrega", () => {
  test("soma weight_kg × quantity só dos itens com produto casado e com peso", () => {
    const items = [
      item({ name: "Cimento CP-II 50 kg", quantity: 10, unit: "sc" }),
      item({ sale_item_id: "i2", name: "Porcelanato Bianco 60x60", quantity: 13.92, unit: "m²" }),
      item({ sale_item_id: "i3", name: "Areia média", quantity: 2, unit: "m³" }),
    ];
    const peso = pesoDaEntrega(items, [CIMENTO, PORCELANATO, AREIA_SEM_PESO]);
    // 10 sc × 50 kg = 500; 13,92 m² × 22 kg/m² = 306,24; areia sem peso = 0.
    expect(peso).toBeCloseTo(806.24, 3);
  });

  test("item sem produto correspondente é ignorado, não derruba a soma", () => {
    const items = [
      item({ name: "Cimento CP-II 50 kg", quantity: 10 }),
      item({ sale_item_id: "i2", name: "Produto que não existe no catálogo", quantity: 5 }),
    ];
    expect(pesoDaEntrega(items, [CIMENTO])).toBeCloseTo(500, 3);
  });

  test("entrega sem itens dá 0", () => {
    expect(pesoDaEntrega([], [CIMENTO])).toBe(0);
    expect(pesoDaEntrega(null as any, [CIMENTO])).toBe(0);
  });
});

describe("itensSemCest", () => {
  test("conta só itens cujo produto casado tem CEST vazio", () => {
    const items = [
      item({ name: "Cimento CP-II 50 kg" }),                 // tem CEST
      item({ sale_item_id: "i2", name: "Porcelanato Bianco 60x60" }), // sem CEST
      item({ sale_item_id: "i3", name: "Areia média" }),      // tem CEST
    ];
    const faltando = itensSemCest(items, [CIMENTO, PORCELANATO, AREIA_SEM_PESO]);
    expect(faltando.map((i) => i.name)).toEqual(["Porcelanato Bianco 60x60"]);
  });

  test("item sem produto correspondente não entra na lista (não dá pra afirmar)", () => {
    const items = [item({ name: "Produto desconhecido" })];
    expect(itensSemCest(items, [CIMENTO, PORCELANATO])).toEqual([]);
  });

  test("CEST com só espaços conta como vazio", () => {
    const comEspaco = product({ id: "p2", name: "Tinta acrílica", cest: "   " });
    const items = [item({ name: "Tinta acrílica" })];
    expect(itensSemCest(items, [comEspaco])).toHaveLength(1);
  });
});

describe("montarEmitBody", () => {
  const BASE_FORM: NfeEntregaForm = {
    customerName: "Marlene Souza",
    customerDoc: "123.456.789-00",
    fretePropio: true,
    quemRetira: "cliente",
    transportadoraNome: "",
    volumes: "3",
    pesoKg: "412",
    placa: "",
    ufPlaca: "",
  };

  test("modalidade 0 (frete próprio) quando fretePropio=true — 'própria' em transportadora_nome", () => {
    const d = delivery({ items: [item({})] });
    const body = montarEmitBody(d, [CIMENTO], BASE_FORM);
    expect(body.transporte?.modalidade).toBe(0);
    expect(body.transporte?.transportadora_nome).toBe("própria");
    expect(body.transporte?.volumes).toBe(3);
    expect(body.transporte?.peso_bruto_kg).toBe(412);
  });

  test("modalidade 9 (cliente retira) quando fretePropio=false e quemRetira='cliente'", () => {
    const d = delivery({ items: [item({})] });
    const form: NfeEntregaForm = { ...BASE_FORM, fretePropio: false, quemRetira: "cliente" };
    const body = montarEmitBody(d, [CIMENTO], form);
    expect(body.transporte?.modalidade).toBe(9);
    expect(body.transporte?.transportadora_nome).toBeNull();
  });

  test("modalidade 1 (transportadora) quando fretePropio=false e quemRetira='transportadora'", () => {
    const d = delivery({ items: [item({})] });
    const form: NfeEntregaForm = {
      ...BASE_FORM, fretePropio: false, quemRetira: "transportadora", transportadoraNome: "Rápido Bairro",
    };
    const body = montarEmitBody(d, [CIMENTO], form);
    expect(body.transporte?.modalidade).toBe(1);
    expect(body.transporte?.transportadora_nome).toBe("Rápido Bairro");
  });

  test("leva delivery_id, sale_id, tipo nfe e os itens com cest/origem/icms_st_paid do produto casado", () => {
    const d = delivery({
      id: "entrega-9", sale_id: "venda-9",
      items: [item({ product_id: "p-cimento", name: "Cimento CP-II 50 kg", quantity: 10, unit: "sc", unit_price: 33.5 })],
    });
    const body = montarEmitBody(d, [CIMENTO], BASE_FORM);
    expect(body.delivery_id).toBe("entrega-9");
    expect(body.sale_id).toBe("venda-9");
    expect(body.tipo).toBe("nfe");
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      product_id: "p-cimento", name: "Cimento CP-II 50 kg", quantity: 10, unit: "sc",
      cest: "05.001.00", origem: 0, icms_st_paid: true,
    });
  });

  test("unit_price do item é o preço DA VENDA (item.unit_price) — nunca o preço atual do produto", () => {
    // CIMENTO.price = 32.9; o item vendeu por 30 (promoção do dia da venda).
    const d = delivery({ items: [item({ product_id: "p-cimento", name: "Cimento CP-II 50 kg", unit_price: 30 })] });
    const body = montarEmitBody(d, [CIMENTO], BASE_FORM);
    expect(body.items[0].unit_price).toBe(30);
  });

  test("dois produtos com o mesmo nome e product_id diferentes — casa pelo id, não pelo nome", () => {
    const CIMENTO_LOJA_2 = product({
      id: "p-cimento-loja2", name: "Cimento CP-II 50 kg", weightKg: 50, cest: null, origem: 0, icmsStPaid: false, price: 34.9,
    });
    const d = delivery({
      items: [item({ product_id: "p-cimento-loja2", name: "Cimento CP-II 50 kg", quantity: 10, unit_price: 34.9 })],
    });
    const body = montarEmitBody(d, [CIMENTO, CIMENTO_LOJA_2], BASE_FORM);
    // Casou com CIMENTO_LOJA_2 (sem CEST), não com CIMENTO (primeiro da lista, tem CEST).
    expect(body.items[0].product_id).toBe("p-cimento-loja2");
    expect(body.items[0].cest).toBeNull();

    // itensSemCest também precisa casar pelo id, não pegar o primeiro nome batendo.
    const faltando = itensSemCest(d.items, [CIMENTO, CIMENTO_LOJA_2]);
    expect(faltando).toHaveLength(1);
    expect(faltando[0].sale_item_id).toBe(d.items[0].sale_item_id);

    // idem pesoDaEntrega: usa o peso do produto casado por id (50 kg × 10 = 500),
    // não o de outro produto de mesmo nome que porventura não tivesse peso.
    expect(pesoDaEntrega(d.items, [CIMENTO, CIMENTO_LOJA_2])).toBeCloseTo(500, 3);
  });

  test("CPF (≤11 dígitos) vai em customer_cpf; CNPJ (>11) vai em recipient_cnpj", () => {
    const d = delivery({ items: [item({})] });
    const comCpf = montarEmitBody(d, [CIMENTO], { ...BASE_FORM, customerDoc: "12345678900" });
    expect(comCpf.customer_cpf).toBe("12345678900");
    expect(comCpf.recipient_cnpj).toBeUndefined();

    const comCnpj = montarEmitBody(d, [CIMENTO], { ...BASE_FORM, customerDoc: "12.345.678/0001-90" });
    expect(comCnpj.recipient_cnpj).toBe("12345678000190");
    expect(comCnpj.customer_cpf).toBeUndefined();
  });
});

describe("formInicialNfeEntrega", () => {
  test("frete próprio ligado por padrão, peso pré-preenchido pela soma dos itens com peso", () => {
    const d = delivery({
      customer_name: "Marlene Souza",
      items: [
        item({ name: "Cimento CP-II 50 kg", quantity: 10, unit: "sc" }),
        item({ sale_item_id: "i2", name: "Porcelanato Bianco 60x60", quantity: 13.92, unit: "m²" }),
      ],
    });
    const form = formInicialNfeEntrega(d, [CIMENTO, PORCELANATO]);
    expect(form.fretePropio).toBe(true);
    expect(form.customerName).toBe("Marlene Souza");
    expect(Number(form.pesoKg)).toBeCloseTo(806.24, 3);
    expect(form.volumes).toBe("2");
  });
});
