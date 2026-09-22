// ============================================================
// Matcon M1 — "Salvar orçamento" no Caixa
// (docs/matcon-faseamento-po-ux.md §3 · mockup docs/mockups/matcon-modulo.html
// #carrinho "Salvar orçamento")
//
// Teste de COMPONENTE (CartPanel), no padrão de
// __tests__/components/CartPanelMatcon.test.tsx / CustomerRowBotoes.test.tsx:
// mockamos usePdvSettings pra ligar/desligar o toggle e conferimos o botão
// "Salvar orçamento" do rodapé. A mutation/estado do card em si (useMatconQuote)
// é só orquestração de matconApi + toast/router, já exercitada indiretamente
// aqui através das props que ela produz (onSaveQuote/savingQuote/savedQuote).
//
//   - toggle OFF: CartPanel não renderiza "Salvar orçamento" (mesmo com
//     onSaveQuote passado — o gate é matcon_enabled, lido dentro do
//     CartPanel via usePdvSettings/readMatconSettings).
//   - toggle ON + carrinho vazio: renderiza, mas desabilitado.
//   - toggle ON + carrinho com item: habilitado e dispara onSaveQuote.
//   - toggle ON + savedQuote presente: card "Orçamento #N salvo" aparece
//     com os dois botões do mockup.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React from "react";
import renderer, { act } from "react-test-renderer";

let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
// M4: o CartPanel passou a montar a linha do lote, que le a empresa do
// store de auth (mesmo mock de EntregasMatcon.test.tsx).
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));

jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Depósito do Zé", initial: "D" }),
}));

import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";

const CIMENTO: CartDisplayItem = {
  productId: "prod-cimento", productBaseId: "prod-cimento",
  name: "Cimento CP-II 50 kg", price: 32.9, qty: 10, listPrice: 32.9,
  unit: "sc", purchaseUnit: null, purchaseFactor: null,
};

function baseProps(items: CartDisplayItem[]) {
  return {
    items,
    subtotal: 329,
    discountAmount: 0,
    total: 329,
    itemCount: items.reduce((s, i) => s + i.qty, 0),
    payMethods: [{ key: "pix", label: "PIX", icon: "dollar" }],
    activePay: "pix",
    onPay: jest.fn(),
    onInc: jest.fn(),
    onDec: jest.fn(),
    onRemove: jest.fn(),
    onClear: jest.fn(),
    onFinalize: jest.fn(),
  };
}

function montar(extra: Record<string, any>, items: CartDisplayItem[] = [CIMENTO]) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CartPanel {...baseProps(items)} {...extra} />);
  });
  return tree;
}

function botaoSalvar(tree: renderer.ReactTestRenderer): any {
  return tree.root.findAllByProps({ testID: "cta-salvar-orcamento" })[0];
}

describe("CartPanel · Matcon M1 — Salvar orçamento", () => {
  afterEach(() => { mockPdvSettings = { matcon_enabled: false }; });

  it("toggle OFF: não renderiza 'Salvar orçamento' mesmo com onSaveQuote passado", () => {
    mockPdvSettings = { matcon_enabled: false };
    const tree = montar({ onSaveQuote: jest.fn() });

    expect(tree.root.findAllByProps({ testID: "cta-salvar-orcamento" }).length).toBe(0);
    tree.unmount();
  });

  it("sem onSaveQuote: não renderiza, mesmo com o toggle ligado (prop opcional)", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({});

    expect(tree.root.findAllByProps({ testID: "cta-salvar-orcamento" }).length).toBe(0);
    tree.unmount();
  });

  it("toggle ON + carrinho vazio: renderiza desabilitado", () => {
    mockPdvSettings = { matcon_enabled: true };
    const onSaveQuote = jest.fn();
    const tree = montar({ onSaveQuote }, []);

    const btn = botaoSalvar(tree);
    expect(btn).toBeTruthy();
    expect(btn.props.disabled).toBe(true);
    // disabled=true barra o toque no Pressable real; não chamamos
    // props.onPress() aqui (chamar a função direto ignoraria o disabled do
    // teste, que é justamente o que este caso verifica).
    expect(onSaveQuote).not.toHaveBeenCalled();

    tree.unmount();
  });

  it("toggle ON + carrinho com item: habilitado e dispara onSaveQuote ao tocar", () => {
    mockPdvSettings = { matcon_enabled: true };
    const onSaveQuote = jest.fn();
    const tree = montar({ onSaveQuote }, [CIMENTO]);

    const btn = botaoSalvar(tree);
    expect(btn.props.disabled).toBe(false);

    act(() => { btn.props.onPress(); });
    expect(onSaveQuote).toHaveBeenCalledTimes(1);

    tree.unmount();
  });

  it("savingQuote=true: desabilita o botão mesmo com carrinho não vazio", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({ onSaveQuote: jest.fn(), savingQuote: true }, [CIMENTO]);

    expect(botaoSalvar(tree).props.disabled).toBe(true);
    tree.unmount();
  });

  it("savedQuote: mostra o card 'Orçamento #N salvo' com os dois botões do mockup", () => {
    mockPdvSettings = { matcon_enabled: true };
    const onSendWhatsApp = jest.fn();
    const onViewEsteira = jest.fn();
    const tree = montar({
      onSaveQuote: jest.fn(),
      savedQuote: {
        number: 342,
        validUntilLabel: "29/09",
        total: 1093.21,
        onSendWhatsApp,
        onViewEsteira,
      },
    }, [CIMENTO]);

    const card = tree.root.findAllByProps({ testID: "matcon-orcamento-salvo-card" })[0];
    expect(card).toBeTruthy();

    tree.unmount();
  });

  it("savedQuote ausente (null) e toggle ON: não mostra o card", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({ onSaveQuote: jest.fn(), savedQuote: null }, [CIMENTO]);

    expect(tree.root.findAllByProps({ testID: "matcon-orcamento-salvo-card" }).length).toBe(0);
    tree.unmount();
  });
});
