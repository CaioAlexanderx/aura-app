// ============================================================
// O desconto do Pix, com a MESMA conta dos dois lados (S5 · 03/09/2026)
//
// O backend passou a aplicar o desconto no pedido Studio no S0
// (Aura-backend#665). Até aqui o app somava subtotal + frete e pronto:
// a partir do dia em que uma lojista ligasse o desconto, a tela mostraria
// um total e a cobrança seria outra.
//
// Hoje as duas lojas Studio estão em 0%, então ninguém viu diferença —
// e é exatamente por isso que o defeito passaria despercebido até
// alguém ligar o desconto e um cliente reclamar.
//
// Este teste guarda a fórmula. Ela é copiada do servidor de propósito:
// `Math.round(subtotal * pct) / 100`, com o frete FORA. Conta de
// dinheiro em dois lugares é conta que diverge; o jeito de conviver com
// isso é ela ser idêntica e ter teste dos dois lados.
// ============================================================
import fs from "fs";
import path from "path";

/** A conta do app, extraída como no useStorefront. */
function descontoDoApp(subtotal: number, pct: number, metodo: string): number {
  if (metodo !== "pix" || pct <= 0) return 0;
  return Math.round(subtotal * pct) / 100;
}

/** A conta do servidor, transcrita de routes/storefront.js. */
function descontoDoServidor(subtotal: number, pct: number, metodo: string): number {
  return metodo === "pix" && pct > 0 ? Math.round(subtotal * pct) / 100 : 0;
}

describe("as duas contas dão o mesmo número", () => {
  const casos: Array<[number, number]> = [
    [100, 5], [39.9, 5], [39.9, 10], [634.8, 5], [0.01, 5],
    [1234.56, 7], [99.99, 3], [49.9, 15], [0, 5], [10, 100],
  ];

  test.each(casos)("subtotal %p com %p%%", (subtotal, pct) => {
    expect(descontoDoApp(subtotal, pct, "pix")).toBe(descontoDoServidor(subtotal, pct, "pix"));
  });

  test("o caso do desenho: 12 canecas de R$ 49,90 com 5%", () => {
    // 598,80 × 5% = 29,94
    expect(descontoDoApp(598.8, 5, "pix")).toBe(29.94);
  });

  test("arredonda em centavos, não em reais", () => {
    // 39,90 × 5% = 1,995 → 2,00 (round no centavo, como o servidor)
    expect(descontoDoApp(39.9, 5, "pix")).toBe(2);
  });
});

describe("quando o desconto não existe", () => {
  test("outro meio de pagamento não ganha desconto de Pix", () => {
    expect(descontoDoApp(100, 5, "card")).toBe(0);
    expect(descontoDoApp(100, 5, "on_delivery")).toBe(0);
  });

  test("loja sem desconto configurado — as duas lojas Studio hoje", () => {
    expect(descontoDoApp(100, 0, "pix")).toBe(0);
  });
});

describe("o total, e o que fica de fora dele", () => {
  const total = (sub: number, desc: number, frete: number) => sub - desc + frete;

  test("o frete NÃO entra no desconto, igual ao servidor", () => {
    // R$ 100 de peça + R$ 12 de frete, 5% no Pix: desconta 5 sobre 100,
    // não sobre 112.
    const desc = descontoDoApp(100, 5, "pix");
    expect(desc).toBe(5);
    expect(total(100, desc, 12)).toBe(107);
  });

  test("sem Pix, o total é subtotal mais frete", () => {
    expect(total(100, descontoDoApp(100, 5, "card"), 12)).toBe(112);
  });
});

describe("os dois lados continuam ligados", () => {
  const RAIZ = path.join(__dirname, "..");

  test("o app calcula o desconto e o desconta do total", () => {
    const s = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/useStorefront.ts"), "utf8");
    expect(s).toContain("Math.round(cartSubtotal * pixDiscountPct) / 100");
    expect(s).toContain("cartSubtotal - pixDiscount + shippingFee");
    // O percentual vem do payload, nunca cravado na tela.
    expect(s).toContain("payment?.pix_discount_pct");
  });

  test("o resumo mostra a linha, e só quando ela existe", () => {
    const s = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/Checkout.tsx"), "utf8");
    expect(s).toContain("sf.pixDiscount > 0 ?");
    expect(s).toContain("Desconto no Pix");
  });
});
