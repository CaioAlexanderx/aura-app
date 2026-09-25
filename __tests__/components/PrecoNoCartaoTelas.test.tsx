// ============================================================
// Preço no cartão — telas (docs/mockups/preco-no-cartao.html).
//
// Contrato "NÃO VAZA": com a opção da loja desligada (as props novas
// ausentes) o Caixa, o cadastro, a etiqueta e o orçamento renderizam como
// hoje — nenhuma linha, campo, par de preços ou texto novo. Ligada:
//   · carrinho: par "Dinheiro ou PIX · Cartão" no topo, o outro preço em
//     cinza na linha, e no dividido a linha "o que falta" com a conta;
//   · grid: "cartão R$ X" embaixo do preço;
//   · cadastro: "Preço no dinheiro e PIX" + "Preço no cartão" automático
//     (+11%) ou ajustado à mão, com "Voltar aos 11%";
//   · configuração: a frase do % e o exemplo;
//   · etiqueta e orçamento com os dois preços.
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

let mockPdvSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Depósito São Jorge", initial: "D" }),
}));

import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { SecaoPreco, type PrecoNoCartaoDoForm } from "@/components/screens/estoque/item-form/SecaoPreco";
import { CardPriceSection } from "@/components/screens/configuracoes/CardPriceSection";
import { buildLabelHtml } from "@/components/screens/estoque/labels/buildLabelHtml";
import { buildQuoteHtml } from "@/utils/quotePdf";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}

const CIMENTO: CartDisplayItem = {
  productId: "cim", productBaseId: "cim", name: "Cimento CP II 50 kg",
  price: 38, qty: 10, listPrice: 38, unit: "sc",
};

function propsDoCarrinho(extra: Record<string, any> = {}) {
  return {
    items: [CIMENTO],
    subtotal: 380, discountAmount: 0, total: 380, itemCount: 10,
    payMethods: [{ key: "pix", label: "PIX", icon: "dollar" }, { key: "cartao", label: "Crédito", icon: "receipt" }],
    activePay: "pix",
    onPay: jest.fn(), onInc: jest.fn(), onDec: jest.fn(), onRemove: jest.fn(), onClear: jest.fn(), onFinalize: jest.fn(),
    onToggleSplit: jest.fn(),
    ...extra,
  };
}

describe("Caixa — carrinho", () => {
  test("NÃO VAZA: sem pricePair nem otherPrice, nada de cartão na tela", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<CartPanel {...propsDoCarrinho()} />); });
    const t = flattenText(tree.toJSON());
    expect(porTestID(tree, "carrinho-par-precos")).toHaveLength(0);
    expect(porTestID(tree, "carrinho-outro-preco-cim")).toHaveLength(0);
    expect(t).not.toMatch(/dinheiro (e|ou) PIX/i);
    expect(t).not.toMatch(/cartão/i);
    expect(t).toContain("Subtotal");
    tree.unmount();
  });

  test("ligada: par no topo, o do chip aceso, e o outro preço na linha", () => {
    let tree!: renderer.ReactTestRenderer;
    const item = { ...CIMENTO, otherPrice: 42.2, otherLabel: "cartão" };
    act(() => {
      tree = renderer.create(
        <CartPanel {...propsDoCarrinho({ items: [item], pricePair: { cash: 380, card: 422, active: "cash" } })} />,
      );
    });
    expect(porTestID(tree, "carrinho-par-precos")).toHaveLength(1);
    const t = flattenText(tree.toJSON());
    expect(t).toContain("Dinheiro ou PIX");
    expect(t).toContain("Cartão");
    expect(t).toContain("R$ 422,00");
    expect(flattenText(porTestID(tree, "carrinho-outro-preco-cim")[0].children)).toBe(" · cartão R$ 42,20");
    tree.unmount();
  });

  test("dividido: a linha 'o que falta' com o acréscimo, a conta e o status nas duas línguas", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <CartPanel {...propsDoCarrinho({
          splitMode: true,
          splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 666, auto: true }],
          splitIsBalanced: true, splitRemaining: 0,
          splitStatusText: "Pronto · a conta fecha em R$ 1.066,00. No cartão, os R$ 600,00 que faltavam ficam R$ 666,00 (11% a mais).",
          onAddSplitPayment: jest.fn(), onUpdateSplitPayment: jest.fn(), onRemoveSplitPayment: jest.fn(),
        })} />,
      );
    });
    expect(flattenText(porTestID(tree, "carrinho-dividido-falta")[0].children)).toBe("o que falta, com o acréscimo do cartão");
    // Uma frase só (QA 23/09/2026): o "Pronto" já explica o valor no cartão.
    expect(porTestID(tree, "carrinho-dividido-conta")).toHaveLength(0);
    expect(flattenText(tree.toJSON())).toContain(
      "Pronto · a conta fecha em R$ 1.066,00. No cartão, os R$ 600,00 que faltavam ficam R$ 666,00 (11% a mais).",
    );
    tree.unmount();
  });
});

describe("Caixa — grid", () => {
  const P = { id: "cim", name: "Cimento CP II", price: 38, stock: 32, unit: "sc", cardPrice: null };
  test("NÃO VAZA: sem cardPriceFor, o card de sempre", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ProductGrid products={[P]} qtyById={{}} onAdd={jest.fn()} />); });
    expect(porTestID(tree, "grid-cartao-cim")).toHaveLength(0);
    expect(flattenText(tree.toJSON())).not.toMatch(/cartão/i);
    tree.unmount();
  });
  test("ligada: 'cartão R$ 42,20' embaixo do preço", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ProductGrid products={[P]} qtyById={{}} onAdd={jest.fn()} cardPriceFor={() => 42.2} />); });
    expect(flattenText(porTestID(tree, "grid-cartao-cim")[0].children)).toBe("cartão R$ 42,20");
    tree.unmount();
  });
});

describe("Cadastro — seção Preço", () => {
  function Harness({ ligado, onValor, onVoltar, manual = false, valor = "" }: { ligado: boolean; onValor?: any; onVoltar?: any; manual?: boolean; valor?: string }) {
    const [preco, setPreco] = useState("38,00");
    const [custo, setCusto] = useState("24,00");
    const cartao: PrecoNoCartaoDoForm | null = ligado
      ? { pct: 11, valor, manual, onValor: onValor || jest.fn(), onVoltar: onVoltar || jest.fn(), taxaPct: 4.5 }
      : null;
    return (
      <SecaoPreco
        type="product" narrow={false}
        preco={preco} onPreco={setPreco} custo={custo} onCusto={setCusto}
        duracao="" onDuracao={() => {}} onSubmit={() => {}}
        cartao={cartao}
      />
    );
  }

  test("NÃO VAZA: 'Preço de venda' e margem de uma linha", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Harness ligado={false} />); });
    const t = flattenText(tree.toJSON());
    expect(t).toContain("Preço de venda");
    expect(t).not.toContain("Preço no cartão");
    expect(t).not.toContain("dinheiro e PIX");
    expect(tree.root.findAll((n) => n.props?.testID === "preco-margem-dupla")).toHaveLength(0);
    tree.unmount();
  });

  test("ligada: dinheiro e PIX + cartão automático (+11% → R$ 42,20) e margem dupla", () => {
    let tree!: renderer.ReactTestRenderer;
    const onValor = jest.fn();
    act(() => { tree = renderer.create(<Harness ligado onValor={onValor} />); });
    const t = flattenText(tree.toJSON());
    expect(t).toContain("Preço no dinheiro e PIX");
    expect(t).toContain("Preço no cartão");
    expect(t).toContain("automático · +11%");
    expect(t).toContain("Segue os 11% da loja");
    const input = tree.root.findAll((n) => n.props?.testID === "preco-cartao-input" && n.props?.onChangeText)[0];
    expect(input.props.value).toBe("42,20");
    expect(t).toContain("no cartão, já tirada a taxa da maquininha (4,5%)");
    act(() => { input.props.onChangeText("4370"); });
    expect(onValor).toHaveBeenCalledWith("43,70");
    tree.unmount();
  });

  test("ajustado à mão: selo com o % real e 'Voltar aos 11%' sempre visível", () => {
    let tree!: renderer.ReactTestRenderer;
    const onVoltar = jest.fn();
    act(() => { tree = renderer.create(<Harness ligado manual valor="43,70" onVoltar={onVoltar} />); });
    const t = flattenText(tree.toJSON());
    expect(t).toContain("ajustado à mão · +15%");
    expect(t).toContain("Voltar aos 11% (R$ 42,20)");
    const voltar = tree.root.findAll((n) => n.props?.testID === "preco-cartao-voltar" && n.props?.onPress)[0];
    act(() => { voltar.props.onPress(); });
    expect(onVoltar).toHaveBeenCalled();
    tree.unmount();
  });

  test("ajustado mais barato que o dinheiro: avisa", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Harness ligado manual valor="30,00" />); });
    expect(flattenText(tree.toJSON())).toContain("No cartão está mais barato que no dinheiro");
    tree.unmount();
  });
});

// 25/09/2026: o PdvSettingsCard só renderiza esta seção em loja com Matcon
// ligado (decisão do Caio) — por isso os displays "ligada" trazem matcon_enabled.
describe("Configurações — Cobro mais no cartão", () => {
  const PALETA = {
    label: "#000", desc: "#333", hint: "#666", trackOff: "#ccc", trackOn: "#a78bfa",
    thumbOff: "#999", thumbOn: "#7c3aed", inputBg: "#fff", inputBorder: "#ddd", inputText: "#000", boxBorder: "#eee",
  };
  test("desligada: só a linha do toggle", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<CardPriceSection display={{} as any} saving={false} onToggle={jest.fn()} palette={PALETA} />); });
    expect(flattenText(tree.toJSON())).toContain("Cobro mais no cartão");
    expect(tree.root.findAll((n) => n.props?.testID === "pdv-settings-card-price-box")).toHaveLength(0);
    tree.unmount();
  });
  test("ligada: a frase do %, o exemplo e a contagem", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <CardPriceSection
          display={{ matcon_enabled: true, card_price_enabled: true, card_price_pct: 11 } as any}
          saving={false} onToggle={jest.fn()} palette={PALETA}
          contagem={{ auto: 342, manual: 18 }}
        />,
      );
    });
    const t = flattenText(tree.toJSON());
    expect(t).toContain("No cartão, cobro");
    expect(t).toContain("Um produto de R$ 100,00 sai a R$ 111,00 no cartão");
    expect(t).toContain("342 produtos seguem os 11%");
    expect(t).toContain("18 com preço no cartão ajustado à mão");
    tree.unmount();
  });

  // 23/09/2026 (QA em produção): ligar o toggle não grava card_price_pct —
  // fica null até o lojista digitar. Antes o campo lia isso como 0 e
  // mostrava "34 produtos seguem os 0%", que não faz sentido nenhum.
  test("recém-ligada, sem %: sugestão no placeholder, sem contagem nem exemplo", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <CardPriceSection
          display={{ matcon_enabled: true, card_price_enabled: true, card_price_pct: null } as any}
          saving={false} onToggle={jest.fn()} palette={PALETA}
          contagem={{ auto: 34, manual: 0 }}
        />,
      );
    });
    const input = tree.root.findAll((n) => n.props?.testID === "pdv-settings-card-price-pct")[0];
    expect(input.props.placeholder).toBe("ex.: 10");
    const t = flattenText(tree.toJSON());
    expect(t).not.toContain("seguem os 0%");
    expect(t).not.toContain("produtos seguem");
    expect(t).toContain("Digite quanto a mais o cliente paga no cartão");
    tree.unmount();
  });
});

describe("Papel — etiqueta e orçamento", () => {
  const ITEM = { name: "Cimento CP II 50 kg", price: 38, barcode: "7891234567895", size: "", color: "", qty: 1 };
  const OPTS = { mode: "barcode" as const, storeName: "Depósito", showStoreName: true };

  test("etiqueta NÃO VAZA: sem cardPrice, HTML idêntico ao de sempre (um preço, sem rótulo, sem price-wrap)", () => {
    const html = buildLabelHtml([ITEM], OPTS);
    expect(html).not.toContain("price-wrap");
    expect(html).not.toContain("price2");
    expect(html).not.toContain("bc-inner-card");
    expect(html).not.toContain("Cartão");
    expect(html).not.toContain("Dinheiro ou PIX");
    expect(html).toContain('<div class="price">R$ 38,00</div>');
  });
  test("etiqueta ligada: os dois preços com rótulo ('Dinheiro ou PIX' e 'Cartão')", () => {
    const html = buildLabelHtml([{ ...ITEM, cardPrice: 42.2 }], OPTS);
    expect(html).toContain(
      '<div class="price-wrap">' +
      '<div class="price-row"><span class="price-lbl">Dinheiro ou PIX</span><span class="price-val">R$ 38,00</span></div>' +
      '<div class="price-row price-row-card"><span class="price-lbl">Cartão</span><span class="price-val price-val-card">R$ 42,20</span></div>' +
      '</div>',
    );
    // QR também.
    const htmlQr = buildLabelHtml([{ ...ITEM, cardPrice: 42.2 }], { ...OPTS, mode: "qr" });
    expect(htmlQr).toContain("Dinheiro ou PIX");
    expect(htmlQr).toContain("Cartão");
    expect(htmlQr).toContain("R$ 42,20");
  });
  test("etiqueta ligada: o preço no cartão sai em pelo menos 7pt nos dois formatos (33x21 e 30x25) — era 5,5pt sem rótulo, ilegível", () => {
    (["99x21", "30x25"] as const).forEach((size) => {
      const html = buildLabelHtml([{ ...ITEM, cardPrice: 42.2 }], { ...OPTS, labelSize: size });
      const m = html.match(/\.price-row-card \.price-val\{font-size:([\d.]+)pt/);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeGreaterThanOrEqual(7);
    });
  });
  test("etiqueta ligada: NÃO toca no BARCODE_OPTS nem no .bc-box (código de barras não pode encolher)", () => {
    const htmlOff = buildLabelHtml([ITEM], OPTS);
    const htmlOn = buildLabelHtml([{ ...ITEM, cardPrice: 42.2 }], OPTS);
    // Mesmos parâmetros LOCKED do JsBarcode de sempre.
    expect(htmlOn).toContain("width:1,height:24,margin:1,displayValue:true,fontSize:7,textMargin:0");
    // A regra ".bc-inner .bc-box{...}" (LOCKED) sai idêntica ligado/desligado —
    // só a classe extra .bc-inner-card (fora do .bc-box) aperta o resto.
    const bcBoxRuleOff = htmlOff.match(/\.bc-inner \.bc-box\{[^}]*\}/)![0];
    const bcBoxRuleOn = htmlOn.match(/\.bc-inner \.bc-box\{[^}]*\}/)![0];
    expect(bcBoxRuleOn).toBe(bcBoxRuleOff);
  });

  const QUOTE = { items: [{ name: "Cimento", qty: 10, unitPrice: 38, cardUnitPrice: 42.2 }], total: 380, companyName: "Depósito" };
  test("orçamento NÃO VAZA: sem `card`, um total só", () => {
    const html = buildQuoteHtml(QUOTE);
    expect(html).not.toContain("Dinheiro ou PIX");
    expect(html).not.toContain("cartão");
  });
  test("orçamento ligado: dois preços por linha e dois totais, nunca 'à vista'", () => {
    const html = buildQuoteHtml({ ...QUOTE, card: { total: 422, totalAfterDiscount: 422 } });
    expect(html).toContain("cartão R$ 42,20");
    expect(html).toContain("cartão R$ 422,00");
    expect(html).toContain("Dinheiro ou PIX");
    expect(html).toContain("No cartão (débito ou crédito)");
    expect(html).not.toMatch(/à vista/i);
  });
});
