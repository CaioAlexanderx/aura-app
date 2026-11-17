// ============================================================
// 17/11/2026 (p-157 / A5): bipe com o cursor na quantidade, no preço ou no
// desconto vai para o carrinho, em vez de ser digitado no campo.
//
// O leitor global não lê com o foco num campo (a pessoa precisa digitar).
// Antes, só a busca tinha o detector de rajada; agora os campos do carrinho
// também (hooks/useLeitorNoCampo, o mesmo criarLeitorDeCampo da busca).
// O que este arquivo trava:
//   1. rajada do leitor no campo: o código vai para onScan e o campo volta
//      ao texto de antes; com ou sem Enter no fim
//   2. digitação de gente (lenta, ou curta e rápida) continua no campo
//   3. sem onScan (a troca), o campo é o de sempre
//   4. CartPanel liga o leitor nos campos de quantidade e de desconto
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
import { useLeitorNoCampo } from "@/hooks/useLeitorNoCampo";
import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";
import { OCIOSO_MS, CONFIRMA_OCIOSO_MS } from "@/utils/leituraRapida";

let agora = 1_000_000;
function tecla(alvo: EventTarget, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
  Object.defineProperty(ev, "timeStamp", { value: agora });
  act(() => { alvo.dispatchEvent(ev); });
  return ev;
}
/** Como o navegador: se ninguém segurou a tecla, o caractere entra no campo. */
function digitar(campo: HTMLInputElement, texto: string, passoMs: number, fim?: "Enter") {
  for (const ch of texto) {
    const ev = tecla(campo, ch);
    if (!ev.defaultPrevented) campo.value += ch;
    agora += passoMs;
  }
  if (fim) tecla(campo, fim);
}

beforeEach(() => {
  jest.useFakeTimers();
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

function Campo({ campo, onScan, escrever }: { campo: HTMLInputElement; onScan?: (c: string) => void; escrever: (v: string) => void }) {
  const ligar = useLeitorNoCampo({ escrever, onLeitura: onScan });
  React.useEffect(() => { ligar(campo); }, [ligar, campo]);
  return null;
}
function montarCampo(valor: string, onScan?: jest.Mock) {
  const campo = document.createElement("input");
  campo.value = valor;
  const escrever = jest.fn((v: string) => { campo.value = v; });
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Campo campo={campo} onScan={onScan} escrever={escrever} />); });
  return { campo, escrever, t };
}

describe("useLeitorNoCampo", () => {
  test("bipe com Enter no campo da quantidade: vai para o carrinho e o campo volta a '2'", () => {
    const onScan = jest.fn();
    const { campo, t } = montarCampo("2", onScan);
    digitar(campo, "7891234567895", 8, "Enter");
    expect(onScan).toHaveBeenCalledWith("7891234567895");
    expect(campo.value).toBe("2");
    act(() => { t.unmount(); });
  });

  test("bipe sem Enter: fecha no silêncio", () => {
    const onScan = jest.fn();
    const { campo, t } = montarCampo("10,00", onScan);
    digitar(campo, "2001485473363", 8);
    act(() => { jest.advanceTimersByTime(OCIOSO_MS + CONFIRMA_OCIOSO_MS + 10); });
    expect(onScan).toHaveBeenCalledWith("2001485473363");
    expect(campo.value).toBe("10,00");
    act(() => { t.unmount(); });
  });

  test("gente digitando (devagar, ou '12' rápido) continua sendo digitação", () => {
    const onScan = jest.fn();
    const { campo, t } = montarCampo("", onScan);
    digitar(campo, "15", 180, "Enter");
    expect(campo.value).toBe("15");
    campo.value = "";
    digitar(campo, "12", 10, "Enter");
    act(() => { jest.advanceTimersByTime(500); });
    expect(campo.value).toBe("12");
    expect(onScan).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });

  test("sem onScan, nada é ligado: o código fica no campo, como antes", () => {
    const { campo, t } = montarCampo("", undefined);
    digitar(campo, "7891234567895", 8, "Enter");
    expect(campo.value).toBe("7891234567895");
    act(() => { t.unmount(); });
  });

  test("desligado ao desmontar", () => {
    const onScan = jest.fn();
    const { campo, t } = montarCampo("1", onScan);
    act(() => { t.unmount(); });
    digitar(campo, "7891234567895", 8, "Enter");
    expect(onScan).not.toHaveBeenCalled();
  });
});

describe("CartPanel: os campos do carrinho leem o bipe", () => {
  const ITEM: CartDisplayItem = { productId: "camiseta", productBaseId: "camiseta", name: "Camiseta", price: 50, qty: 2, listPrice: 50 } as any;

  function montarCarrinho(onScan?: jest.Mock) {
    const campos: HTMLInputElement[] = [];
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <CartPanel
          items={[ITEM]} subtotal={100} discountAmount={0} total={100} itemCount={2}
          payMethods={[{ key: "pix", label: "PIX", icon: "dollar" }] as any} activePay="pix"
          onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
          discountType="%" setDiscountType={jest.fn()} discountValue="" setDiscountValue={jest.fn()}
          manualDiscountAmount={0} clearDiscount={jest.fn()}
          onScan={onScan}
        />,
        {
          createNodeMock: (el: any) => {
            if (el.type !== "input") return document.createElement(typeof el.type === "string" ? el.type : "div");
            const campo = document.createElement("input");
            campo.setAttribute("data-testid", el.props["data-testid"] || "");
            campos.push(campo);
            return campo;
          },
        },
      );
    });
    return { t, campos };
  }

  test("bipe na quantidade e no desconto vai para onScan", () => {
    const onScan = jest.fn();
    const { t, campos } = montarCarrinho(onScan);
    const qtd = campos.find(c => c.getAttribute("data-testid") === "carrinho-qty-camiseta");
    const desconto = campos.find(c => c.getAttribute("data-testid") === "desconto-campo");
    expect(qtd).toBeTruthy();
    expect(desconto).toBeTruthy();
    qtd!.value = "2";
    digitar(qtd!, "7891234567895", 8, "Enter");
    desconto!.value = "";
    agora += 1000;
    digitar(desconto!, "7890000000017", 8, "Enter");
    expect(onScan.mock.calls.map(c => c[0])).toEqual(["7891234567895", "7890000000017"]);
    act(() => { t.unmount(); });
  });

  test("sem onScan o carrinho é o de sempre", () => {
    const { t, campos } = montarCarrinho(undefined);
    const qtd = campos.find(c => c.getAttribute("data-testid") === "carrinho-qty-camiseta")!;
    qtd.value = "";
    const ev = new KeyboardEvent("keydown", { key: "7", bubbles: true, cancelable: true });
    qtd.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    act(() => { t.unmount(); });
  });
});
