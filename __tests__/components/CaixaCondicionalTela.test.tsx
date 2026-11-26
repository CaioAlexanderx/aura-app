// ============================================================
// Venda condicional (C12): a faixa "Cobrando a condicional" e o carrinho
// travado do Caixa. Render de verdade (react-test-renderer).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Loja", initial: "L" }),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { CartPanel } from "@/components/screens/pdv/CartPanel";
import { FaixaDaCondicional } from "@/components/screens/pdv/FaixaDaCondicional";

const METODOS = [{ key: "pix", label: "PIX", icon: "dollar" }];
const ITEM = { productId: "p1__v1", productBaseId: "p1", name: "Vestido Midi (Marinho · M)", price: 189.9, qty: 1, listPrice: 189.9, unit: "un", purchaseUnit: null, purchaseFactor: null };
const fn = () => () => {};

function textos(r: renderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.children) n.children.forEach(walk);
  };
  walk(r.toJSON());
  return out.join("|");
}
const existe = (r: renderer.ReactTestRenderer, id: string) => r.root.findAll((n: any) => n.props && n.props.testID === id).length > 0;
const achar = (r: renderer.ReactTestRenderer, id: string) => r.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onPress === "function")[0];

function carrinho(extra: Record<string, any>) {
  let r!: renderer.ReactTestRenderer;
  act(() => {
    r = renderer.create(
      <CartPanel
        subtotal={189.9} discountAmount={0} total={189.9} itemCount={1} items={[ITEM] as any}
        payMethods={METODOS as any} activePay="pix"
        onPay={fn()} onInc={fn()} onDec={fn()} onRemove={fn()} onClear={fn()} onFinalize={fn()}
        showOrcamento onGenerateQuote={fn()}
        {...extra}
      />,
    );
  });
  return r;
}

describe("carrinho do Caixa na condicional (C12)", () => {
  test("travado: sem + − nem lixeira, quantidade só lida, Sair no lugar de Limpar, Concluir a venda", () => {
    const onSair = jest.fn();
    const r = carrinho({ condicional: { onSair, textoDoBotao: "Concluir a venda", textoSair: "Sair" } });
    expect(existe(r, "carrinho-inc-p1__v1")).toBe(false);
    expect(existe(r, "carrinho-dec-p1__v1")).toBe(false);
    expect(existe(r, "carrinho-qty-p1__v1")).toBe(false);
    expect(textos(r)).toContain("1 peça");
    const t = textos(r);
    expect(t).toContain("Concluir a venda");
    expect(t).not.toContain("Finalizar venda");
    expect(t).not.toContain("Limpar");
    expect(t).not.toContain("Orçamento");
    act(() => { achar(r, "cond-sair-carrinho").props.onPress(); });
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  test("sem condicional: o carrinho de sempre (+ −, Limpar, Orçamento, Finalizar venda)", () => {
    const r = carrinho({});
    expect(existe(r, "carrinho-inc-p1__v1")).toBe(true);
    expect(existe(r, "carrinho-dec-p1__v1")).toBe(true);
    const t = textos(r);
    expect(t).toContain("Limpar");
    expect(t).toContain("Orçamento");
    expect(t).toContain("Finalizar venda");
    expect(t).not.toContain("Concluir a venda");
    expect(existe(r, "cond-sair-carrinho")).toBe(false);
  });
});

describe("faixa Cobrando a condicional (C12)", () => {
  function faixa(props: Record<string, any>) {
    let r!: renderer.ReactTestRenderer;
    act(() => {
      r = renderer.create(
        <FaixaDaCondicional estado={{ tipo: "pronta" }} numero="C-0007" cliente="Marina Duarte" aviso={null}
          onSair={fn()} onVoltar={fn()} onTrocarDeLoja={fn()} onTentarDeNovo={fn()} {...props} />,
      );
    });
    return r;
  }

  test("pronta: título com número e cliente, Sair, sem Voltar", () => {
    const onSair = jest.fn();
    const r = faixa({ onSair });
    expect(textos(r)).toContain("Cobrando a condicional C-0007 · Marina Duarte");
    expect(existe(r, "caixa-condicional-voltar")).toBe(false);
    act(() => { achar(r, "caixa-condicional-sair").props.onPress(); });
    expect(onSair).toHaveBeenCalled();
  });

  test("recusa do servidor: a frase dele e Voltar à condicional", () => {
    const onVoltar = jest.fn();
    const r = faixa({ aviso: "Estas peças já foram cobradas na venda #12.", onVoltar });
    expect(textos(r)).toContain("Estas peças já foram cobradas na venda #12.");
    act(() => { achar(r, "caixa-condicional-voltar").props.onPress(); });
    expect(onVoltar).toHaveBeenCalled();
  });

  test("outra loja: Trocar para a loja da condicional", () => {
    const onTrocarDeLoja = jest.fn();
    const r = faixa({ estado: { tipo: "outra_loja" }, aviso: "Esta condicional é de outra loja. Troque para ela para cobrar no Caixa.", onTrocarDeLoja });
    act(() => { achar(r, "caixa-condicional-trocar").props.onPress(); });
    expect(onTrocarDeLoja).toHaveBeenCalled();
  });

  test("sem condicional (estado null): não desenha nada", () => {
    const r = faixa({ estado: null });
    expect(r.toJSON()).toBeNull();
  });
});
