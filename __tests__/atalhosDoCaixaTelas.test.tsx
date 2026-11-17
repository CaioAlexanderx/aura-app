// ============================================================
// 17/11/2026 (p-154 / A2): as teclas novas dentro das telas do Caixa.
//   1. Troco: Enter confirma, com as guardas do seletor de tamanho (250 ms
//      depois de abrir, sem `repeat`) e sem confirmar no fim de um bipe
//   2. Carrinho: o primeiro F8 deixa a lixeira do último item no estado de
//      confirmação, e o segundo toque (clique) tira o item
// Mocks do padrão do repo; testID + deep:false.
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
// O Modal do react-native-web usa portal (o test renderer não tem DOM): aqui
// ele só mostra o conteúdo quando visível.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return new Proxy(RN, {
    get(alvo: any, nome: string) {
      if (nome === "Modal") return ({ visible, children }: any) => (visible ? children : null);
      return alvo[nome];
    },
  });
});

import React from "react";
import renderer, { act } from "react-test-renderer";
import { CashChangeModal, TROCO_ENTER_LIBERADO_MS } from "@/components/screens/pdv/CashChangeModal";
import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";

let agora = 1_000_000;
function tecla(init: KeyboardEventInit, alvo: EventTarget = window): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(ev, "timeStamp", { value: agora });
  act(() => { alvo.dispatchEvent(ev); });
  return ev;
}

beforeEach(() => {
  jest.useFakeTimers();
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe("troco: Enter confirma", () => {
  function abrir(onConfirm: jest.Mock, total = 50) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<CashChangeModal visible total={total} onCancel={jest.fn()} onConfirm={onConfirm} />); });
    return t;
  }

  test("depois de 250 ms o Enter confirma (o valor vem preenchido com o total)", () => {
    const onConfirm = jest.fn();
    const t = abrir(onConfirm);
    agora += TROCO_ENTER_LIBERADO_MS + 10;
    const ev = tecla({ key: "Enter", code: "Enter" });
    expect(ev.defaultPrevented).toBe(true);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => { t.unmount(); });
  });

  test("o Enter (ou o F9 segurado) que abriu o troco não confirma sozinho", () => {
    const onConfirm = jest.fn();
    const t = abrir(onConfirm);
    agora += 100;
    tecla({ key: "Enter", code: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
    agora += 400;
    tecla({ key: "Enter", code: "Enter", repeat: true });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });

  test("bipe no campo do valor (rajada + Enter) não confirma a venda", () => {
    const onConfirm = jest.fn();
    const t = abrir(onConfirm);
    agora += 1000;
    for (const ch of "7891234567895") { tecla({ key: ch }); agora += 8; }
    tecla({ key: "Enter", code: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
    // e o Enter de gente, depois, confirma
    agora += 1000;
    tecla({ key: "Enter", code: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => { t.unmount(); });
  });

  test("Enter com o foco num botão é do botão; Ctrl+Enter não é o Enter do troco", () => {
    const onConfirm = jest.fn();
    const t = abrir(onConfirm);
    agora += 1000;
    const botao = document.createElement("button");
    document.body.appendChild(botao);
    tecla({ key: "Enter", code: "Enter" }, botao);
    document.body.removeChild(botao);
    tecla({ key: "Enter", code: "Enter", ctrlKey: true });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });

  test("fechado: não escuta", () => {
    const onConfirm = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<CashChangeModal visible={false} total={50} onCancel={jest.fn()} onConfirm={onConfirm} />); });
    agora += 1000;
    expect(tecla({ key: "Enter", code: "Enter" }).defaultPrevented).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });
});

describe("carrinho: F8 arma a remoção do último item", () => {
  const A: CartDisplayItem = { productId: "a", productBaseId: "a", name: "Camiseta", price: 50, qty: 1, listPrice: 50 } as any;
  const B: CartDisplayItem = { productId: "b", productBaseId: "b", name: "Bermuda", price: 80, qty: 1, listPrice: 80 } as any;
  function montar(remocaoArmada: string | null, onRemove = jest.fn()) {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <CartPanel
          items={[A, B]} subtotal={130} discountAmount={0} total={130} itemCount={2}
          payMethods={[{ key: "pix", label: "PIX", icon: "dollar" }] as any} activePay="pix"
          onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={onRemove} onClear={jest.fn()} onFinalize={jest.fn()}
          remocaoArmada={remocaoArmada}
        />,
      );
    });
    return t;
  }
  const armadas = (t: renderer.ReactTestRenderer) =>
    t.root.findAll((n: any) => n.props && n.props.testID === "pdv-remocao-armada", { deep: false });

  test("sem tecla: nenhuma lixeira armada", () => {
    const t = montar(null);
    expect(armadas(t)).toHaveLength(0);
    act(() => { t.unmount(); });
  });

  test("armada pela tecla: só a do item certo, e um clique nela tira o item", () => {
    const onRemove = jest.fn();
    const t = montar("b", onRemove);
    const lixeira = armadas(t);
    expect(lixeira).toHaveLength(1);
    act(() => { lixeira[0].props.onPress(); });
    expect(onRemove).toHaveBeenCalledWith("b");
    act(() => { t.unmount(); });
  });
});
