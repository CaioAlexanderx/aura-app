// ============================================================
// QA 27/09 · o preço no Pix e o endereço de retirada
//
// P1: a peça mostrava R$ 47,40 para R$ 49,90 a 5%, e a sacola fazia
// outra conta. Regra canônica, combinada com o backend:
//   precoCentavos    = Math.round(preco * 100)
//   precoPixCentavos = Math.round(precoCentavos * (100 - pct) / 100)
//   desconto         = preço − preço no Pix
//
// P0: o lugar de retirada vem de `delivery.pickup_address` quando o
// servidor manda; senão, o endereço do negócio, como era.
// ============================================================
import { precoNoPix, descontoDoPix } from "@/components/studio/storefront/precoDaSacola";
import { precoNoPix as precoNoPixDoCartao } from "@/components/studio/storefront/precoNoPix";
import { enderecoDeRetiradaDaLoja, lugarDaLoja, selosDaHome } from "@/components/studio/storefront/home/regrasDaHome";
import { enderecoDeRetirada } from "@/components/studio/storefront/produto/regrasDaPagina";

describe("o preço no Pix, uma conta só", () => {
  test.each([
    [49.9, 5, 47.41],
    [99.8, 10, 89.82],
    [49.9, 7.5, 46.16],
    [94.8, 10, 85.32],
    [39.9, 10, 35.91],
  ])("R$ %s a %s%% → R$ %s", (preco, pct, pix) => {
    expect(precoNoPix(preco, pct)).toBe(pix);
    // desconto = preço − preço no Pix, em centavos
    expect(descontoDoPix(preco, pct)).toBe(Math.round((preco - pix) * 100) / 100);
  });

  test("os descontos dos exemplos", () => {
    expect(descontoDoPix(49.9, 5)).toBe(2.49);
    expect(descontoDoPix(99.8, 10)).toBe(9.98);
    expect(descontoDoPix(49.9, 7.5)).toBe(3.74);
    expect(descontoDoPix(94.8, 10)).toBe(9.48);
    expect(descontoDoPix(39.9, 10)).toBe(3.99);
    expect(descontoDoPix(217.69, 5)).toBe(10.88);
  });

  test("pct 0 ou nulo: nada de Pix", () => {
    expect(precoNoPix(49.9, 0)).toBeNull();
    expect(precoNoPix(49.9, null)).toBeNull();
    expect(precoNoPix(49.9, undefined)).toBeNull();
    expect(descontoDoPix(49.9, 0)).toBe(0);
    expect(descontoDoPix(49.9, null)).toBe(0);
  });

  test("preço zero ou inválido: nada de Pix", () => {
    expect(precoNoPix(0, 10)).toBeNull();
    expect(precoNoPix(NaN, 10)).toBeNull();
    expect(descontoDoPix(0, 10)).toBe(0);
  });

  test("o cartão da grade e o destaque usam a MESMA função da sacola", () => {
    expect(precoNoPixDoCartao).toBe(precoNoPix);
  });
});

describe("o endereço de retirada", () => {
  const loja = (delivery: any, endereco: string | null = "Av Dom Pedro I, 553 - Jardim Colonial") => ({
    delivery, site: { endereco }, payment: {},
  });

  test("com pickup_address, é ele", () => {
    expect(enderecoDeRetiradaDaLoja(loja({ pickup_address: "  Rua das Flores, 10 - Centro " }))).toBe("Rua das Flores, 10 - Centro");
  });

  test("sem pickup_address (null, vazio, backend antigo), o endereço do negócio", () => {
    expect(enderecoDeRetiradaDaLoja(loja({ pickup_address: null }))).toBe("Av Dom Pedro I, 553 - Jardim Colonial");
    expect(enderecoDeRetiradaDaLoja(loja({ pickup_address: "   " }))).toBe("Av Dom Pedro I, 553 - Jardim Colonial");
    expect(enderecoDeRetiradaDaLoja(loja({}))).toBe("Av Dom Pedro I, 553 - Jardim Colonial");
    expect(enderecoDeRetiradaDaLoja(loja(null))).toBe("Av Dom Pedro I, 553 - Jardim Colonial");
    expect(enderecoDeRetiradaDaLoja(loja(null, null))).toBe("");
    expect(enderecoDeRetiradaDaLoja(null)).toBe("");
  });

  test("a peça parte o endereço de retirada em bairro e rua", () => {
    const e = enderecoDeRetiradaDaLoja(loja({ pickup_address: "Rua das Flores, 10 - Centro" }));
    expect(enderecoDeRetirada(e)).toEqual({ bairro: "Centro", rua: "Rua das Flores, 10" });
    expect(lugarDaLoja(e)).toBe("Centro");
  });

  test("o selo 'Retire na loja' da home fala do lugar de retirada", () => {
    const base = { revisions: { max_included: 0 }, numeros: {}, sla: {} };
    const comRetirada = { ...base, ...loja({ pickup_enabled: true, delivery_enabled: false, pickup_address: "Rua das Flores, 10 - Centro" }) };
    expect(selosDaHome(comRetirada as any).find((s) => s.titulo === "Retire na loja")?.texto).toBe("Centro");
    const semRetirada = { ...base, ...loja({ pickup_enabled: true, delivery_enabled: false }) };
    expect(selosDaHome(semRetirada as any).find((s) => s.titulo === "Retire na loja")?.texto).toBe("Jardim Colonial");
  });
});
