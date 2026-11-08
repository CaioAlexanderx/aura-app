// ============================================================
// De/Por no Caixa e no bipe (p-87, 08/11/2026)
//
// Contrato De/Por (opção A): produto e variante trazem `em_promocao` e
// `preco_efetivo`; `price` continua sendo o preço normal. O POST /pdv/sale
// confia no unit_price do app, então o Caixa manda o preço da PROMOÇÃO.
//
//   1. regra pura (utils/precoEfetivo): backend antigo = preço de sempre;
//      promoção só vale se for menor que o normal;
//   2. carrinho: item em promoção entra por "por", guarda o "de" só para
//      mostrar, e o payload leva unit_price = "por", sem desconto de item;
//   3. preço no cartão acompanha na mesma proporção;
//   4. seletor de variante: a da variante, ou a do produto para variante
//      sem preço próprio; mostra "de/por";
//   5. linha do carrinho e cartão do produto mostram "de R$ X por R$ Y";
//   6. venda recuperada não avisa "preço mudou" por causa da promoção.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false }),
}));
const mockVariants = jest.fn();
jest.mock("@/services/api", () => ({
  pdvApi: { createSale: jest.fn() },
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
}));

const mockBodies: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => { mockBodies.push(body); cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 7 } }); },
  }),
}));

import { useCart } from "@/hooks/useCart";
import { promoDoItem, precoDaVariante } from "@/utils/precoEfetivo";
import { algumPrecoMudou } from "@/utils/vendaRecuperada";
import { VariantPickerModal } from "@/components/VariantPickerModal";
import { ProductCard } from "@/components/screens/pdv/ProductCard";
import { ProductGrid, type GridProduct } from "@/components/screens/pdv/ProductGrid";
import { precoNoCartaoDoProduto, precoNoCartaoNaGrade, type ConfigDoCartao } from "@/utils/precoNoCartao";

const PID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let api: ReturnType<typeof useCart>;
function Harness({ cfg }: { cfg?: ConfigDoCartao }) {
  api = useCart(cfg);
  return null;
}
function montar(cfg?: ConfigDoCartao) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness cfg={cfg} />); });
  return tree;
}
function porId(r: renderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n) => n.props.testID === id, { deep: false })[0];
}
function textoDe(node: any): string {
  if (!node) return "";
  return (node.children as any[]).map((c) => (typeof c === "string" ? c : textoDe(c))).join("");
}

beforeEach(() => { mockBodies.length = 0; mockVariants.mockReset(); });

// ── 1. Regra ─────────────────────────────────────────────────

describe("promoDoItem / precoDaVariante", () => {
  test("backend antigo (sem os campos): nada muda", () => {
    expect(promoDoItem({ price: 100 })).toBeNull();
    expect(precoDaVariante({ price_override: "80" }, { price: 100 })).toEqual({ price: 80, promoDe: null });
    expect(precoDaVariante({}, { price: 100 })).toEqual({ price: 100, promoDe: null });
  });

  test("lê o produto do catálogo e o objeto cru do bipe", () => {
    expect(promoDoItem({ price: 100, emPromocao: true, precoEfetivo: 79.9 })).toEqual({ por: 79.9, de: 100 });
    expect(promoDoItem({ price: "100", em_promocao: true, preco_efetivo: "79.90" })).toEqual({ por: 79.9, de: 100 });
  });

  test("fora do ar, maior ou igual ao normal, zero: preço normal", () => {
    expect(promoDoItem({ price: 100, em_promocao: false, preco_efetivo: 79.9 })).toBeNull();
    expect(promoDoItem({ price: 100, em_promocao: true, preco_efetivo: 100 })).toBeNull();
    expect(promoDoItem({ price: 100, em_promocao: true, preco_efetivo: 120 })).toBeNull();
    expect(promoDoItem({ price: 100, em_promocao: true, preco_efetivo: 0 })).toBeNull();
  });

  test("variante com preço próprio vale a promoção dela; sem preço próprio segue o produto", () => {
    expect(precoDaVariante({ price_override: "80", em_promocao: true, preco_efetivo: 60 }, { price: 100 })).toEqual({ price: 60, promoDe: 80 });
    // A promoção do produto NÃO vale para a variante com preço próprio.
    expect(precoDaVariante({ price_override: "80" }, { price: 100, emPromocao: true, precoEfetivo: 70 })).toEqual({ price: 80, promoDe: null });
    expect(precoDaVariante({}, { price: 100, emPromocao: true, precoEfetivo: 70 })).toEqual({ price: 70, promoDe: 100 });
  });
});

// ── 2/3. Carrinho e payload ──────────────────────────────────

describe("carrinho do Caixa", () => {
  test("sem os campos: item e payload de sempre", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: PID, name: "Vestido", price: 189.9 }); });
    expect(api.cart[0]).toEqual({ productId: PID, name: "Vestido", price: 189.9, qty: 1, listPrice: 189.9, unit: undefined, purchaseUnit: undefined, purchaseFactor: undefined });
    tree.unmount();
  });

  test("em promoção: entra por 'por', mostra o 'de', e o POST manda unit_price = 'por' sem desconto de item", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: PID, name: "Vestido", price: 189.9, emPromocao: true, precoEfetivo: 151.9 } as any); });
    expect(api.cart[0]).toMatchObject({ price: 151.9, listPrice: 151.9, promoDe: 189.9 });
    expect(api.totalAfterCoupon).toBe(151.9);
    act(() => { api.finalizeSale(); });
    expect(mockBodies[0].items[0]).toMatchObject({ product_id: PID, unit_price: 151.9, quantity: 1 });
    expect(mockBodies[0].items[0].item_discount).toBeUndefined();
    expect(JSON.stringify(mockBodies[0])).not.toContain("promoDe");
    tree.unmount();
  });

  test("variante escolhida no seletor já chega com o preço resolvido", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: PID, name: "Tênis", price: 249.99 }, { id: "v1", label: "39", price: 199.9, promoDe: 249.99 }); });
    expect(api.cart[0]).toMatchObject({ productId: PID + "__v1", price: 199.9, promoDe: 249.99 });
    tree.unmount();
  });

  test("preço no cartão: o da promoção e o 'de' do cartão na mesma regra", () => {
    const tree = montar({ enabled: true, pct: 10 });
    act(() => { api.addToCart({ id: PID, name: "Vestido", price: 100, cardPrice: null, emPromocao: true, precoEfetivo: 80 } as any); });
    expect(api.cart[0]).toMatchObject({ cashPrice: 80, cardPrice: 88, promoDe: 100 });
    act(() => { api.setPayment("cartao"); });
    expect(api.cart[0]).toMatchObject({ price: 88, promoDe: 110 });
    tree.unmount();
  });

  test("preço no cartão manual: card_price × preço da promoção / preço normal (contrato)", () => {
    const tree = montar({ enabled: true, pct: 10 });
    act(() => { api.addToCart({ id: PID, name: "Vestido", price: 100, cardPrice: 115, emPromocao: true, precoEfetivo: 80 } as any); });
    expect(api.cart[0]).toMatchObject({ cashPrice: 80, cardPrice: 92, promoDe: 100 });
    act(() => { api.finalizeSale(); });
    expect(mockBodies[0].items[0].unit_price).toBe(80);
    tree.unmount();
  });
});

// ── 4. Seletor de variante ───────────────────────────────────

describe("seletor de variante", () => {
  test("mostra 'de/por' e devolve o preço da promoção", async () => {
    // O Modal do RNW usa portal: monta no DOM de verdade (como seletorDeVarianteBipado).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRoot } = require("react-dom/client");
    const actDom = (React as any).act as (fn: () => any) => Promise<void>;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockVariants.mockResolvedValue({ variants: [
      { id: "v1", sku_suffix: "P", stock_qty: "3", is_active: true },
      { id: "v2", sku_suffix: "G", stock_qty: "3", is_active: true, price_override: "120", em_promocao: true, preco_efetivo: 90 },
    ] });
    const onSelect = jest.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await actDom(async () => {
      root.render(<VariantPickerModal visible product={{ id: "p1", name: "Blusa", price: 100, emPromocao: true, precoEfetivo: 75 }} onSelect={onSelect} onClose={jest.fn()} />);
    });
    await actDom(async () => { await Promise.resolve(); await Promise.resolve(); });
    const linha = (id: string) => document.querySelector('[data-testid="variante-' + id + '"]') as HTMLElement;
    expect(linha("v2").textContent).toContain("de R$ 120,00 por R$ 90,00");
    expect(linha("v1").textContent).toContain("de R$ 100,00 por R$ 75,00");
    await actDom(async () => { linha("v2").click(); });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v2", price: 90, promoDe: 120 }));
    await actDom(() => { root.unmount(); });
    host.remove();
  });
});

// ── 5. Cartão do produto ─────────────────────────────────────

describe("cartão do produto no Caixa", () => {
  const base = { id: "p1", name: "Vestido", price: 189.9, category: "Vestidos", stock: 3, barcode: "" };
  test("em promoção: de riscado e por", () => {
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<ProductCard product={{ ...base, emPromocao: true, precoEfetivo: 151.9 }} onAdd={jest.fn()} isWide={false} />); });
    expect(textoDe(porId(r, "produto-de-p1"))).toBe("de R$ 189,90");
    expect(textoDe(porId(r, "produto-por-p1"))).toBe("por R$ 151,90");
  });
  test("sem promoção (ou backend antigo): o de sempre", () => {
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<ProductCard product={base} onAdd={jest.fn()} isWide={false} />); });
    expect(porId(r, "produto-de-p1")).toBeUndefined();
  });
});

// QA 08/11/2026: a grade do Caixa (/pdv) é a do ProductGrid, não o
// ProductCard acima — em promoção o card seguia com o preço cheio enquanto o
// carrinho já vendia pelo "por".
describe("grade do Caixa (ProductGrid)", () => {
  const base: GridProduct = { id: "p1", name: "Água com gás", price: 8, stock: 12, unit: "un" };
  function grade(products: GridProduct[], cardPriceFor?: (p: GridProduct) => number | null) {
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<ProductGrid products={products} qtyById={{}} onAdd={jest.fn()} cardPriceFor={cardPriceFor} />); });
    return r;
  }

  test("em promoção: o card mostra 'por' (o que entra no carrinho) e o 'de' riscado", () => {
    const r = grade([{ ...base, emPromocao: true, precoEfetivo: 6.9 }]);
    expect(textoDe(porId(r, "grid-de-p1"))).toBe("de R$ 8,00");
    expect(textoDe(porId(r, "grid-por-p1"))).toBe("por R$ 6,90");
    const estiloDe = [].concat(porId(r, "grid-de-p1").props.style).reduce((a: any, b: any) => ({ ...a, ...b }), {});
    expect(estiloDe.textDecorationLine).toBe("line-through");
  });

  test("sem promoção, com em_promocao false ou backend antigo: o card de sempre, idêntico", () => {
    const antigo = JSON.stringify(grade([base]).toJSON());
    const semPromo = JSON.stringify(grade([{ ...base, emPromocao: false, precoEfetivo: null }]).toJSON());
    // Promoção "estranha" (por >= de) não vale: preço normal (utils/precoEfetivo).
    const estranha = JSON.stringify(grade([{ ...base, emPromocao: true, precoEfetivo: 9 }]).toJSON());
    expect(semPromo).toBe(antigo);
    expect(estranha).toBe(antigo);
    expect(antigo).not.toContain("grid-de-");
    expect(antigo).toContain("R$ 8,00");
  });

  test("com preço no cartão: 'cartão' do preço da promoção, a mesma conta do carrinho", () => {
    const cfg = { enabled: true, pct: 10 };
    const p = { ...base, price: 100, cardPrice: null, emPromocao: true, precoEfetivo: 80 };
    expect(precoNoCartaoNaGrade(p, cfg)).toBe(88);
    // Manual: card_price × por / de (como no carrinho: 115 × 80 / 100 = 92).
    expect(precoNoCartaoNaGrade({ ...p, cardPrice: 115 }, cfg)).toBe(92);
    // Sem promoção: exatamente o de antes.
    expect(precoNoCartaoNaGrade({ price: 100, cardPrice: 115 }, cfg)).toBe(precoNoCartaoDoProduto({ price: 100, cardPrice: 115 }, cfg));
    expect(precoNoCartaoNaGrade({ price: 100, cardPrice: null }, cfg)).toBe(precoNoCartaoDoProduto({ price: 100, cardPrice: null }, cfg));
    const r = grade([p], (x) => precoNoCartaoNaGrade(x as any, cfg));
    expect(textoDe(porId(r, "grid-por-p1"))).toBe("por R$ 80,00");
    expect(textoDe(porId(r, "grid-cartao-p1"))).toBe("cartão R$ 88,00");
  });
});

// ── 6. Venda recuperada ──────────────────────────────────────

describe("venda recuperada", () => {
  test("item guardado no preço da promoção não conta como 'preço mudou'", () => {
    const produtos = [{ id: "p1", price: 100, emPromocao: true, precoEfetivo: 80 }];
    expect(algumPrecoMudou([{ productId: "p1", price: 80, listPrice: 80 }], produtos)).toBe(false);
    expect(algumPrecoMudou([{ productId: "p1", price: 100, listPrice: 100 }], produtos)).toBe(true);
    expect(algumPrecoMudou([{ productId: "p1", price: 100, listPrice: 100 }], [{ id: "p1", price: 100 }])).toBe(false);
  });
});
