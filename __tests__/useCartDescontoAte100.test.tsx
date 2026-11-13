// ============================================================
// Caixa — desconto manual até 100% (12/11/2026), hooks/useCart.ts +
// components/screens/pdv/DiscountSection.tsx.
//
// Relato de loja: R$ 80 de desconto numa peça de R$ 139,90 saía R$ 69,95
// (teto silencioso de 50%). Agora:
//   · vale o que foi digitado, até o total (100%);
//   · acima de 50% o Finalizar pede confirmação ("Confirmar desconto" /
//     "Voltar"); 50% ou menos, não;
//   · R$ acima do total: a tela avisa e limita ao total;
//   · a tela fecha no centavo com o servidor (mesma função de arredondamento);
//   · preço no cartão: a mesma regra nos dois preços.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));

const mockBodies: any[] = [];
let mockResposta: any = { sale: { id: "venda-1", sale_number: 1 } };
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => { mockBodies.push(body); cb?.onSuccess?.(mockResposta); },
  }),
}));

import { useCart } from "@/hooks/useCart";
import { DiscountSection } from "@/components/screens/pdv/DiscountSection";
import type { ConfigDoCartao } from "@/utils/precoNoCartao";

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
const LIGADO: ConfigDoCartao = { enabled: true, pct: 11 };

function carrinho(preco: number, tipo: "%" | "R$", valor: string, extra: { cardPrice?: number } = {}) {
  act(() => { api.addToCart({ id: "p1", name: "Peça", price: preco, ...extra }); });
  act(() => { api.setDiscountType(tipo); api.setDiscountValue(valor); });
}

beforeEach(() => {
  mockBodies.length = 0;
  mockResposta = { sale: { id: "venda-1", sale_number: 1 } };
  jest.clearAllMocks();
});

describe("desconto acima de 50%", () => {
  test("80% aplica 80% e o Finalizar pede confirmação; confirmado, a venda vai com 80%", () => {
    const tree = montar();
    carrinho(149.9, "%", "80");
    expect(api.manualDiscountAmount).toBe(119.92);
    expect(api.totalAfterCoupon).toBe(29.98);
    expect(api.descontoManual.pendente).toBe(true);

    act(() => { api.finalizeSale(); });
    expect(mockBodies).toHaveLength(0);
    expect(api.confirmacaoDoDesconto.aberta).toBe(true);
    expect(api.confirmacaoDoDesconto.mensagem).toBe("Desconto de 80% (R$ 119,92). Confirma?");

    act(() => { api.confirmacaoDoDesconto.confirmar(); });
    expect(api.confirmacaoDoDesconto.aberta).toBe(false);
    expect(mockBodies).toHaveLength(1);
    expect(mockBodies[0]).toMatchObject({ discount_type: "percent", discount_value: 80 });
    expect(api.lastSale).toMatchObject({ subtotal: 149.9, manualDiscount: 119.92, total: 29.98 });
    tree.unmount();
  });

  test("Voltar: nada é vendido e o desconto continua pendente", () => {
    const tree = montar();
    carrinho(139.9, "R$", "80");
    expect(api.manualDiscountAmount).toBe(80);
    expect(api.totalAfterCoupon).toBe(59.9);
    act(() => { api.finalizeSale(); });
    act(() => { api.confirmacaoDoDesconto.voltar(); });
    expect(mockBodies).toHaveLength(0);
    expect(api.confirmacaoDoDesconto.aberta).toBe(false);
    expect(api.descontoManual.pendente).toBe(true);
    tree.unmount();
  });

  test("ao sair do campo pergunta uma vez por valor; o Finalizar sempre confere", () => {
    const tree = montar();
    carrinho(100, "%", "60");
    act(() => { api.confirmacaoDoDesconto.aoTerminarDeDigitar!(); });
    expect(api.confirmacaoDoDesconto.aberta).toBe(true);
    act(() => { api.confirmacaoDoDesconto.voltar(); });
    act(() => { api.confirmacaoDoDesconto.aoTerminarDeDigitar!(); });
    expect(api.confirmacaoDoDesconto.aberta).toBe(false);
    act(() => { api.finalizeSale(); });
    expect(api.confirmacaoDoDesconto.aberta).toBe(true);
    expect(mockBodies).toHaveLength(0);
    tree.unmount();
  });

  test("confirmado ao sair do campo: o Finalizar não pergunta de novo", () => {
    const tree = montar();
    carrinho(100, "%", "60");
    act(() => { api.confirmacaoDoDesconto.aoTerminarDeDigitar!(); });
    act(() => { api.confirmacaoDoDesconto.confirmar(); });
    expect(api.descontoManual.pendente).toBe(false);
    act(() => { api.finalizeSale(); });
    expect(mockBodies).toHaveLength(1);
    expect(mockBodies[0]).toMatchObject({ discount_type: "percent", discount_value: 60 });
    tree.unmount();
  });

  test("mudar o valor depois de confirmar pede confirmação de novo", () => {
    const tree = montar();
    carrinho(100, "%", "60");
    act(() => { api.confirmacaoDoDesconto.aoTerminarDeDigitar!(); });
    act(() => { api.confirmacaoDoDesconto.confirmar(); });
    act(() => { api.setDiscountValue("90"); });
    expect(api.descontoManual.pendente).toBe(true);
    act(() => { api.finalizeSale(); });
    expect(mockBodies).toHaveLength(0);
    tree.unmount();
  });
});

describe("50% ou menos: sem confirmação", () => {
  test.each([["%", "50"], ["%", "10"], ["R$", "69,95"]] as const)("%s %s vai direto", (tipo, valor) => {
    const tree = montar();
    carrinho(139.9, tipo, valor);
    expect(api.descontoManual.pendente).toBe(false);
    act(() => { api.finalizeSale(); });
    expect(api.confirmacaoDoDesconto.aberta).toBe(false);
    expect(mockBodies).toHaveLength(1);
    tree.unmount();
  });
});

describe("R$ acima do total", () => {
  test("limita ao total (100%), avisa e grava o total", () => {
    const tree = montar();
    carrinho(139.9, "R$", "200");
    expect(api.manualDiscountAmount).toBe(139.9);
    expect(api.totalAfterCoupon).toBe(0);
    expect(api.descontoManual.limitadoAoTotal).toBe(true);
    act(() => { api.finalizeSale(); });
    act(() => { api.confirmacaoDoDesconto.confirmar(); });
    expect(mockBodies[0]).toMatchObject({ discount_type: "fixed", discount_value: 139.9 });
    tree.unmount();
  });
});

// Tela == servidor no centavo. O total do servidor sai da regra do backend
// (aura-backend services/descontoManual.js, tabela comum nos testes).
// [preço, tipo, digitado, total que o servidor grava]
const CASOS: [number, "%" | "R$", string, number][] = [
  [10.05, "%", "10", 9.04],
  [1.15, "%", "10", 1.03],
  [19.9, "%", "12,5", 17.41],
  [99.99, "%", "33,33", 66.66],
  [149.9, "%", "80", 29.98],
  [139.9, "%", "100", 0],
  [139.9, "R$", "80", 59.9],
  [139.9, "R$", "69,955", 69.94],
  [139.9, "R$", "200", 0],
];

describe("tela == servidor no centavo", () => {
  test.each(CASOS)("R$ %s, %s %s → R$ %s", (preco, tipo, valor, totalServidor) => {
    for (const cfg of [undefined, LIGADO]) {
      mockBodies.length = 0;
      const tree = montar(cfg);
      carrinho(preco, tipo, valor);
      expect(api.totalAfterCoupon).toBe(totalServidor);
      act(() => { api.finalizeSale(); });
      if (api.confirmacaoDoDesconto.aberta) act(() => { api.confirmacaoDoDesconto.confirmar(); });
      expect(mockBodies).toHaveLength(1);
      expect(api.lastSale!.total).toBe(totalServidor);
      tree.unmount();
    }
  });

  test("a tela final usa o que o servidor gravou", () => {
    mockResposta = { sale: { id: "venda-1", sale_number: 1, total_amount: "9.04", discount_amount: "1.01" } };
    const tree = montar();
    carrinho(10.05, "%", "10");
    act(() => { api.finalizeSale(); });
    expect(api.lastSale).toMatchObject({ subtotal: 10.05, discount: 1.01, manualDiscount: 1.01, total: 9.04 });
    tree.unmount();
  });
});

describe("preço no cartão", () => {
  test("80% vale nos dois preços; no cartão a venda vai com 80% depois de confirmada", () => {
    const tree = montar(LIGADO);
    carrinho(100, "%", "80", { cardPrice: 111 });
    expect(api.precoNoCartao).toMatchObject({ totalDinheiro: 20, totalCartao: 22.2 });
    act(() => { api.setPayment("cartao"); });
    expect(api.totalAfterCoupon).toBe(22.2);
    act(() => { api.finalizeSale(); });
    expect(mockBodies).toHaveLength(0);
    act(() => { api.confirmacaoDoDesconto.confirmar(); });
    expect(mockBodies[0]).toMatchObject({ discount_type: "percent", discount_value: 80 });
    expect(api.lastSale).toMatchObject({ subtotal: 111, manualDiscount: 88.8, total: 22.2 });
    tree.unmount();
  });

  test("R$ acima do preço no dinheiro: dinheiro zera, cartão fica com a diferença", () => {
    const tree = montar(LIGADO);
    carrinho(100, "R$", "105", { cardPrice: 111 });
    expect(api.precoNoCartao).toMatchObject({ totalDinheiro: 0, totalCartao: 6 });
    expect(api.descontoManual.limitadoAoTotal).toBe(true);
    act(() => { api.setPayment("cartao"); });
    expect(api.totalAfterCoupon).toBe(6);
    expect(api.descontoManual.limitadoAoTotal).toBe(false);
    tree.unmount();
  });

  test("10,05 − 10% no dinheiro com a opção ligada: 9,04, como o servidor", () => {
    const tree = montar(LIGADO);
    carrinho(10.05, "%", "10", { cardPrice: 11.2 });
    expect(api.precoNoCartao!.totalDinheiro).toBe(9.04);
    // 11,20 − 1,12 = 10,08
    expect(api.precoNoCartao!.totalCartao).toBe(10.08);
    tree.unmount();
  });
});

// ── DiscountSection ────────────────────────────────────────────
function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return textoDe(node.children);
}
function textoDoNo(n: any): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  return (n.children || []).map(textoDoNo).join("");
}
const achar = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });

function secao(props: Partial<React.ComponentProps<typeof DiscountSection>>) {
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <DiscountSection
        total={139.9} discountType="R$" setDiscountType={() => {}}
        discountValue="" setDiscountValue={() => {}} manualDiscountAmount={0} clearDiscount={() => {}}
        {...props}
      />,
    );
  });
  return t;
}

describe("DiscountSection", () => {
  test("R$ acima do total: o aviso aparece (nada de corte em silêncio)", () => {
    const t = secao({ discountValue: "200", manualDiscountAmount: 139.9 });
    const aviso = achar(t, "desconto-aviso-limite");
    expect(aviso).toHaveLength(1);
    expect(textoDoNo(aviso[0])).toBe("O desconto passou do total. Ficou no total, R$ 139,90 (100%).");
    expect(textoDe(t.toJSON())).toContain("(100%)");
    t.unmount();
  });

  test("sem passar do total: sem aviso; R$ mostra o percentual", () => {
    const t = secao({ discountValue: "80", manualDiscountAmount: 80 });
    expect(achar(t, "desconto-aviso-limite")).toHaveLength(0);
    expect(textoDe(t.toJSON())).toContain("(57,2%)");
    t.unmount();
  });

  test("pendente: avisa que vai pedir confirmação; a pergunta abre com os dois botões", () => {
    const confirmar = jest.fn(), voltar = jest.fn(), aoTerminar = jest.fn();
    const t = secao({
      discountType: "%", discountValue: "80", total: 149.9, manualDiscountAmount: 119.92, pendente: true,
      confirmacao: { aberta: true, mensagem: "Desconto de 80% (R$ 119,92). Confirma?", confirmar, voltar, aoTerminarDeDigitar: aoTerminar },
    });
    expect(achar(t, "desconto-pendente")).toHaveLength(1);
    const tudo = textoDe(t.toJSON());
    expect(tudo).toContain("Desconto de 80% (R$ 119,92). Confirma?");
    const botoes = t.root.findAllByType(Pressable);
    act(() => { botoes.find((b) => textoDoNo(b) === "Confirmar desconto")!.props.onPress(); });
    act(() => { botoes.find((b) => textoDoNo(b) === "Voltar")!.props.onPress(); });
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(voltar).toHaveBeenCalledTimes(1);
    act(() => { achar(t, "desconto-campo")[0].props.onBlur(); });
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    t.unmount();
  });

  test("sem a prop de confirmação: nenhuma pergunta", () => {
    const t = secao({ discountType: "%", discountValue: "80", total: 149.9, manualDiscountAmount: 119.92 });
    expect(textoDe(t.toJSON())).not.toContain("Confirmar desconto");
    t.unmount();
  });
});
