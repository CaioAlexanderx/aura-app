// 17/11/2026: na emissão de NFC-e em 375 px o subtotal do item quebrava em
// 3 linhas ("R$ 49,0 / 0"). O valor fica numa linha só (nowrap no web) e a
// fonte encolhe com o comprimento do valor.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: jest.fn() } }));
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-font", () => ({ isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: (sel: any) => sel({ company: null, token: null }) }));
jest.mock("@/services/api", () => ({ BASE_URL: "" }));
jest.mock("@/services/nfe55Api", () => ({ nfe55Api: {} }));
jest.mock("@/components/nfe55/nfe55Acoes", () => ({ abrirDanfe: jest.fn(), baixarXml: jest.fn() }));
jest.mock("@/components/nfe55/EventosNfe", () => ({ AcoesDeEventosNfe: () => null }));

import { EmitNfceForm, fonteDoSubtotal, type NfcePrefill } from "@/components/screens/nfe/EmitNfceForm";

function prefill(itens: Array<{ quantity: number; unit_price: number }>): NfcePrefill {
  return {
    rejectedFromId: "n1", rejectedFromNumero: 1, rejectedFromTipo: "nfce",
    rejectedAt: "2026-11-17T12:00:00Z", rejectedReason: null, sale_id: null,
    customer_cpf: null, customer_name: null, payment_method: "dinheiro",
    items: itens.map((it, i) => ({ product_name: "Item " + (i + 1), ...it })) as any,
  };
}

function subtotais(itens: Array<{ quantity: number; unit_price: number }>) {
  const qc = new QueryClient();
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <EmitNfceForm companyId="c1" prefill={prefill(itens)} />
      </QueryClientProvider>,
    );
  });
  return t.root.findAll((n) => n.props.testID === "nfce-item-subtotal" && typeof n.type !== "string", { deep: false });
}

describe("Subtotal do item na emissão de NFC-e", () => {
  it("o valor não quebra: uma linha, nowrap e fonte pelo comprimento", () => {
    const [a, b] = subtotais([{ quantity: 1, unit_price: 49 }, { quantity: 2, unit_price: 617.28 }]);
    expect(a.props.children).toBe("R$ 49,00");
    expect(a.props.numberOfLines).toBe(1);
    const estiloA = StyleSheet.flatten(a.props.style) as any;
    expect(estiloA.whiteSpace).toBe("nowrap");
    expect(estiloA.fontSize).toBe(13);

    expect(b.props.children).toBe("R$ 1.234,56");
    expect((StyleSheet.flatten(b.props.style) as any).fontSize).toBe(12);
  });

  it("a fonte encolhe com o comprimento do valor", () => {
    expect(fonteDoSubtotal("R$ 0,00")).toBe(13);
    expect(fonteDoSubtotal("R$ 49,00")).toBe(13);
    expect(fonteDoSubtotal("R$ 1.234,56")).toBe(12);
    expect(fonteDoSubtotal("R$ 12.345,67")).toBe(11);
    expect(fonteDoSubtotal("R$ 123.456,78")).toBe(10);
  });
});
