// ============================================================
// Matcon M0 — o carrinho do Caixa e o fracionamento dirigido pela unidade
// (docs/matcon-faseamento-po-ux.md §2).
//
// Cobre o contrato de zero impacto e os dois ramos do item:
//   - toggle OFF: item em m² renderiza o stepper de hoje (− e +) com
//     maxLength 3. A loja que não é matcon não perde nem ganha nada.
//   - toggle ON + unidade fracionada: campo decimal, sem − e +, "12,5" na
//     tela e a linha "= 6 caixas · 13,92 m² · sobra 1,42 m²" embaixo.
//   - toggle ON + unidade NÃO fracionada (sc): o stepper de sempre, só que
//     com teto de 6 dígitos (1.200 tijolos cabem).
//   - digitar "2,5" no campo decimal e sair do campo chama onSetQty(id, 2.5)
//     — nada de parseInt no caminho.
//   - QA 22/09/2026: milheiro (mlh) com toggle ON pede peças ("500") e grava
//     milheiro (0,5); o campo inteiro corta no separador ("0,5" nunca vira 5).
//
// Icon é mockado porque react-native-svg não passa pelo transformIgnorePatterns
// do projeto (mesma razão de __tests__/components/pdv/ActionToolbar.test.tsx).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import React from "react";
import renderer, { act } from "react-test-renderer";

// Mock do usePdvSettings no padrão do CustomerRowBotoes.test.tsx: uma variável
// de módulo que cada teste ajusta antes de montar.
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

// React quebra texto interpolado em nós separados — achatamos a árvore
// renderizada pra afirmar sobre a frase inteira que o vendedor lê.
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

const PISO: CartDisplayItem = {
  productId: "prod-piso", productBaseId: "prod-piso",
  name: "Porcelanato Bianco 60×60", price: 54.9, qty: 12.5, listPrice: 54.9,
  unit: "m²", purchaseUnit: null, purchaseFactor: 2.32,
};

const CIMENTO: CartDisplayItem = {
  productId: "prod-cimento", productBaseId: "prod-cimento",
  name: "Cimento CP-II 50 kg", price: 32.9, qty: 10, listPrice: 32.9,
  unit: "sc", purchaseUnit: null, purchaseFactor: null,
};

// QA em produção 22/09/2026: tijolo em milheiro (R$ 890/mlh). 0,5 mlh =
// 500 tijolos — o que o vendedor digita.
const TIJOLO: CartDisplayItem = {
  productId: "prod-tijolo", productBaseId: "prod-tijolo",
  name: "Tijolo 6 furos 9x14x19", price: 890, qty: 0.5, listPrice: 890,
  unit: "mlh", purchaseUnit: null, purchaseFactor: null,
};

function montar(items: CartDisplayItem[], onSetQty = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CartPanel
        items={items}
        subtotal={100}
        discountAmount={0}
        total={100}
        itemCount={items.reduce((s, i) => s + i.qty, 0)}
        payMethods={[{ key: "pix", label: "PIX", icon: "dollar" }]}
        activePay="pix"
        onPay={jest.fn()}
        onInc={jest.fn()}
        onDec={jest.fn()}
        onSetQty={onSetQty}
        onRemove={jest.fn()}
        onClear={jest.fn()}
        onFinalize={jest.fn()}
      />
    );
  });
  return { tree, onSetQty };
}

function qtyInput(tree: renderer.ReactTestRenderer, produto: string): any {
  return tree.root.findAllByProps({ testID: "carrinho-qty-" + produto })[0];
}
// findAllByProps casa o composto E os hosts que herdam o testID, então o
// que interessa é presença, não contagem.
function temStepper(tree: renderer.ReactTestRenderer, produto: string): boolean {
  return tree.root.findAllByProps({ testID: "carrinho-dec-" + produto }).length > 0 &&
         tree.root.findAllByProps({ testID: "carrinho-inc-" + produto }).length > 0;
}

describe("CartPanel · Matcon M0 — quantidade dirigida pela unidade", () => {
  afterEach(() => { mockPdvSettings = { matcon_enabled: false }; });

  it("toggle OFF: item em m² renderiza o stepper de hoje, com maxLength 3", () => {
    mockPdvSettings = { matcon_enabled: false };
    const { tree } = montar([PISO]);

    // − e + presentes: é o stepper de sempre, unidade fracionada ou não.
    expect(temStepper(tree, "prod-piso")).toBe(true);
    expect(qtyInput(tree, "prod-piso").props.maxLength).toBe(3);
    expect(qtyInput(tree, "prod-piso").props.keyboardType).toBe("number-pad");
    // E nenhuma linha de embalagem, mesmo com purchaseFactor cadastrado.
    expect(flattenText(tree.toJSON())).not.toContain("caixas");

    tree.unmount();
  });

  it("toggle ON + m²: campo decimal sem − e +, com 12,5 e a linha das caixas", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_round_to_package: true };
    const { tree } = montar([PISO]);

    expect(temStepper(tree, "prod-piso")).toBe(false);
    const input = qtyInput(tree, "prod-piso");
    expect(input.props.value).toBe("12,5");
    expect(input.props.keyboardType).toBe("decimal-pad");
    expect(input.props.maxLength).toBe(9);

    expect(flattenText(tree.toJSON())).toContain("= 6 caixas · 13,92 m² · sobra 1,42 m²");

    tree.unmount();
  });

  it("toggle ON mas 'arredondar para embalagem' OFF: some a linha, fica o campo", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_round_to_package: false };
    const { tree } = montar([PISO]);

    expect(qtyInput(tree, "prod-piso").props.value).toBe("12,5");
    expect(flattenText(tree.toJSON())).not.toContain("caixas");

    tree.unmount();
  });

  it("toggle ON + sc: continua o stepper, mas com teto de 6 dígitos", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_round_to_package: true };
    const { tree } = montar([CIMENTO]);

    expect(temStepper(tree, "prod-cimento")).toBe(true);
    const input = qtyInput(tree, "prod-cimento");
    expect(input.props.maxLength).toBe(6);
    expect(input.props.keyboardType).toBe("number-pad");
    expect(input.props.value).toBe("10");

    tree.unmount();
  });

  it("digitar 2,5 no campo decimal e sair do campo chama onSetQty(id, 2.5)", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_round_to_package: true };
    const onSetQty = jest.fn();
    const { tree } = montar([PISO], onSetQty);

    const input = qtyInput(tree, "prod-piso");
    act(() => { input.props.onFocus(); });
    act(() => { input.props.onChangeText("2,5"); });
    act(() => { input.props.onBlur(); });

    expect(onSetQty).toHaveBeenCalledTimes(1);
    expect(onSetQty).toHaveBeenCalledWith("prod-piso", 2.5);

    tree.unmount();
  });

  // Digita no campo como o vendedor: foco, texto, sai do campo.
  function digitar(tree: renderer.ReactTestRenderer, produto: string, texto: string) {
    const input = qtyInput(tree, produto);
    act(() => { input.props.onFocus(); });
    act(() => { qtyInput(tree, produto).props.onChangeText(texto); });
    act(() => { qtyInput(tree, produto).props.onBlur(); });
  }

  it("milheiro com toggle ON: campo de peças sem − e +, '500' na tela e a conta embaixo", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_round_to_package: true };
    const { tree } = montar([TIJOLO]);

    expect(temStepper(tree, "prod-tijolo")).toBe(false);
    const input = qtyInput(tree, "prod-tijolo");
    expect(input.props.value).toBe("500");
    expect(input.props.keyboardType).toBe("number-pad");
    expect(input.props.maxLength).toBe(9);

    const texto = flattenText(tree.toJSON());
    expect(texto).toContain("500 un = 0,5 mlh · R$ 890,00/mlh → R$ 445,00");
    // O total da linha é o de 500 tijolos, não o de 500 milheiros.
    expect(texto).toContain("R$ 445,00");
    expect(texto).not.toContain("445.000");

    tree.unmount();
  });

  it("milheiro: digitar 500 grava 0,5 mlh; '1.500' grava 1,5 mlh; '0,5' não muda nada", () => {
    mockPdvSettings = { matcon_enabled: true };
    const onSetQty = jest.fn();
    const { tree } = montar([{ ...TIJOLO, qty: 1 }], onSetQty);

    digitar(tree, "prod-tijolo", "500");
    expect(onSetQty).toHaveBeenLastCalledWith("prod-tijolo", 0.5);

    digitar(tree, "prod-tijolo", "1.500");
    expect(onSetQty).toHaveBeenLastCalledWith("prod-tijolo", 1.5);

    onSetQty.mockClear();
    digitar(tree, "prod-tijolo", "0,5");
    expect(onSetQty).not.toHaveBeenCalled();

    tree.unmount();
  });

  it("milheiro com toggle OFF: o stepper de sempre, sem linha de peças", () => {
    mockPdvSettings = { matcon_enabled: false };
    const { tree } = montar([{ ...TIJOLO, qty: 2 }]);

    expect(temStepper(tree, "prod-tijolo")).toBe(true);
    expect(qtyInput(tree, "prod-tijolo").props.value).toBe("2");
    expect(flattenText(tree.toJSON())).not.toContain("un =");

    tree.unmount();
  });

  it("campo inteiro corta no separador: '12,5' -> 12 e '0,5' não vira 5 (com e sem Matcon)", () => {
    [false, true].forEach(ligado => {
      mockPdvSettings = { matcon_enabled: ligado };
      const onSetQty = jest.fn();
      const { tree } = montar([CIMENTO], onSetQty);

      digitar(tree, "prod-cimento", "12,5");
      expect(onSetQty).toHaveBeenLastCalledWith("prod-cimento", 12);

      onSetQty.mockClear();
      digitar(tree, "prod-cimento", "0,5");
      expect(onSetQty).not.toHaveBeenCalled();

      tree.unmount();
    });
  });

  it("decimal e stepper convivem na mesma venda (piso em m² + cimento em sc)", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_round_to_package: true };
    const { tree } = montar([PISO, CIMENTO]);

    expect(temStepper(tree, "prod-piso")).toBe(false);
    expect(temStepper(tree, "prod-cimento")).toBe(true);

    tree.unmount();
  });
});
