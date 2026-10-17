// ============================================================
// Checkout avisa que abriu (17/10/2026, card t2-04)
//
// O degrau "viu checkout" do painel estava em 0 eventos. A tela de checkout
// agora chama POST /billing/checkout-viewed uma vez por abertura, inclusive
// para quem ainda está no trial. Demo e staff não contam; falha nunca aparece.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import * as fs from "fs";
import * as path from "path";

var mockBilling = { checkoutViewed: jest.fn() };
jest.mock("@/services/api", () => ({ get billingApi() { return mockBilling; } }));

import { useCheckoutViewed } from "@/hooks/useCheckoutViewed";

function Tela({ id }: { id: string | null | undefined }) {
  useCheckoutViewed(id);
  return null;
}

const espera = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

beforeEach(() => {
  jest.clearAllMocks();
  mockBilling.checkoutViewed.mockResolvedValue({ registrado: true });
});

describe("useCheckoutViewed", () => {
  it("avisa uma vez ao abrir a tela, com o id da empresa", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Tela id="emp-1" />); });
    await espera();
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(1);
    expect(mockBilling.checkoutViewed).toHaveBeenCalledWith("emp-1");
    tree!.unmount();
  });

  it("re-render (troca de plano, refetch do status) não repete o aviso", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Tela id="emp-1" />); });
    for (let i = 0; i < 4; i++) {
      await act(async () => { tree!.update(<Tela id="emp-1" />); });
    }
    await espera();
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(1);
    tree!.unmount();
  });

  it("a empresa hidrata depois do mount: avisa quando o id aparece, uma vez só", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Tela id={undefined} />); });
    await espera();
    expect(mockBilling.checkoutViewed).not.toHaveBeenCalled();
    await act(async () => { tree!.update(<Tela id="emp-1" />); });
    await act(async () => { tree!.update(<Tela id="emp-1" />); });
    await espera();
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(1);
    tree!.unmount();
  });

  it("id nulo (demo ou staff) não avisa", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Tela id={null} />); });
    await espera();
    expect(mockBilling.checkoutViewed).not.toHaveBeenCalled();
    tree!.unmount();
  });

  it("abrir a tela de novo (novo mount) avisa de novo: é outra abertura", async () => {
    for (let i = 0; i < 2; i++) {
      let tree: renderer.ReactTestRenderer;
      await act(async () => { tree = renderer.create(<Tela id="emp-1" />); });
      await espera();
      tree!.unmount();
    }
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(2);
  });

  it("erro de rede ou backend antigo (404) não quebra nem aparece", async () => {
    mockBilling.checkoutViewed.mockRejectedValue(new Error("404"));
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Tela id="emp-1" />); });
    await espera();
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(1);
    tree!.unmount();
  });

  it("mock sem a função (testes antigos da tela) também não quebra", async () => {
    const original = mockBilling.checkoutViewed;
    (mockBilling as any).checkoutViewed = undefined;
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Tela id="emp-1" />); });
    await espera();
    tree!.unmount();
    mockBilling.checkoutViewed = original;
  });
});

describe("tela de checkout", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "checkout.tsx"), "utf8");

  it("usa o hook e deixa demo e staff de fora", () => {
    expect(src).toContain('from "@/hooks/useCheckoutViewed"');
    expect(src).toMatch(/useCheckoutViewed\(isDemo \|\| isStaff \? null : company\?\.id\)/);
  });
});
