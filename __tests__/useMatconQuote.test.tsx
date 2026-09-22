// ============================================================
// Matcon M1 — "Orçamento" no Caixa
// (docs/matcon-faseamento-po-ux.md §3 · mockup docs/mockups/matcon-modulo.html
// #carrinho "Salvar orçamento")
//
// Teste de COMPONENTE (CartPanel), no padrão de
// __tests__/components/CartPanelMatcon.test.tsx / CustomerRowBotoes.test.tsx:
// mockamos usePdvSettings pra ligar/desligar o toggle e conferimos o botão
// "Orçamento" do rodapé. A mutation/estado do card em si (useMatconQuote)
// é só orquestração de matconApi + toast/router, já exercitada indiretamente
// aqui através das props que ela produz (onSaveQuote/savingQuote/savedQuote).
//
// 22/09/2026 (QA em produção, decisão do Caio): o quarto botão do M1
// sobrecarregava o rodapé. Rodapé volta a três botões sempre; o "Orçamento"
// passa a SALVAR (testID cta-salvar-orcamento) quando matcon_enabled +
// onSaveQuote estão presentes, e continua IMPRIMINDO (onGenerateQuote) nos
// outros casos. O card salvo ganhou "Imprimir".
//
//   - toggle OFF: CartPanel não renderiza o "Orçamento" em modo salvar (mesmo
//     com onSaveQuote passado — o gate é matcon_enabled, lido dentro do
//     CartPanel via usePdvSettings/readMatconSettings).
//   - toggle ON + carrinho vazio: renderiza em modo salvar, mas desabilitado.
//   - toggle ON + carrinho com item: habilitado e dispara onSaveQuote.
//   - sem Matcon: "Orçamento" continua chamando onGenerateQuote (imprimir).
//   - toggle ON + savedQuote presente: card "Orçamento #N salvo" aparece
//     com os três botões (Enviar no WhatsApp / Imprimir / Ver orçamentos).
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

// React quebra texto interpolado em nós separados — achatamos a árvore
// renderizada pra afirmar sobre a frase inteira que o vendedor lê (mesmo
// padrão de __tests__/components/CartPanelMatcon.test.tsx).
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

describe("CartPanel · Matcon M1 — Orçamento (salvar/imprimir)", () => {
  afterEach(() => { mockPdvSettings = { matcon_enabled: false }; });

  it("toggle OFF: não renderiza o botão em modo salvar mesmo com onSaveQuote passado", () => {
    mockPdvSettings = { matcon_enabled: false };
    const tree = montar({ onSaveQuote: jest.fn() });

    expect(tree.root.findAllByProps({ testID: "cta-salvar-orcamento" }).length).toBe(0);
    tree.unmount();
  });

  it("sem onSaveQuote: não renderiza modo salvar, mesmo com o toggle ligado (prop opcional)", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({});

    expect(tree.root.findAllByProps({ testID: "cta-salvar-orcamento" }).length).toBe(0);
    tree.unmount();
  });

  it("sem Matcon: 'Orçamento' continua imprimindo via onGenerateQuote (comportamento de sempre)", () => {
    mockPdvSettings = { matcon_enabled: false };
    const onGenerateQuote = jest.fn();
    const onSaveQuote = jest.fn();
    const tree = montar({ showOrcamento: true, onGenerateQuote, onSaveQuote }, [CIMENTO]);

    // Sem Matcon o botão nunca ganha o testID de salvar — continua o botão
    // de imprimir de sempre.
    expect(tree.root.findAllByProps({ testID: "cta-salvar-orcamento" }).length).toBe(0);
    const btn = tree.root.findAllByProps({ onPress: onGenerateQuote })[0];
    expect(btn).toBeTruthy();

    act(() => { btn.props.onPress(); });
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
    expect(onSaveQuote).not.toHaveBeenCalled();

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

  it("savedQuote: mostra o card 'Orçamento #N salvo' com Enviar/Imprimir/Ver orçamentos", () => {
    mockPdvSettings = { matcon_enabled: true };
    const onSendWhatsApp = jest.fn();
    const onViewEsteira = jest.fn();
    const onGenerateQuote = jest.fn();
    const tree = montar({
      onSaveQuote: jest.fn(),
      onGenerateQuote,
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

    // "Ver orçamentos" — texto na tela é língua do lojista, nada de "esteira".
    const texto = flattenText(tree.toJSON());
    expect(texto).toContain("Ver orçamentos");
    expect(texto).not.toContain("esteira");
    expect(texto).toContain("Imprimir");
    expect(texto).toContain("Enviar no WhatsApp");

    // "Imprimir" chama o gerador de impressão de sempre (onGenerateQuote),
    // não onSaveQuote nem onSendWhatsApp/onViewEsteira.
    const imprimirBtn = tree.root.findAllByProps({ testID: "matcon-orcamento-imprimir" })[0];
    expect(imprimirBtn).toBeTruthy();
    act(() => { imprimirBtn.props.onPress(); });
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
    expect(onSendWhatsApp).not.toHaveBeenCalled();
    expect(onViewEsteira).not.toHaveBeenCalled();

    tree.unmount();
  });

  it("savedQuote sem onGenerateQuote: card não quebra, só não mostra 'Imprimir'", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({
      onSaveQuote: jest.fn(),
      savedQuote: {
        number: 342,
        validUntilLabel: "29/09",
        total: 1093.21,
        onSendWhatsApp: jest.fn(),
        onViewEsteira: jest.fn(),
      },
    }, [CIMENTO]);

    expect(tree.root.findAllByProps({ testID: "matcon-orcamento-salvo-card" })[0]).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "matcon-orcamento-imprimir" }).length).toBe(0);

    tree.unmount();
  });

  it("savedQuote ausente (null) e toggle ON: não mostra o card", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({ onSaveQuote: jest.fn(), savedQuote: null }, [CIMENTO]);

    expect(tree.root.findAllByProps({ testID: "matcon-orcamento-salvo-card" }).length).toBe(0);
    tree.unmount();
  });
});
