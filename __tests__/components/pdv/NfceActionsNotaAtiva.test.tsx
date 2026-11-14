// ============================================================
// NfceActions com a nota fiscal da loja desligada (CP4b, 14/11/2026):
// convite para ligar no lugar do "Emitir NFC-e" (que falhava ao tocar), e
// a emissão automática não dispara. Sem `notaAtiva` (Troca): como sempre.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/QrCode", () => ({ QrCode: () => null }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ token: "t" }) }));
const mockEmit = jest.fn(() => new Promise(() => {}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: (...a: any[]) => (mockEmit as any)(...a), get: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useMutation: (o: any) => ({ mutate: () => { o.onMutate && o.onMutate(); o.mutationFn(); } }),
}));

import { NfceActions } from "@/components/screens/pdv/NfceActions";

const BASE = { companyId: "loja-a", saleId: "venda-1", items: [{ product_id: "p1", product_name: "Cimento", quantity: 1, unit_price: 10 }], total: 10 };
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });

beforeEach(() => jest.clearAllMocks());

it("nota desligada: convite e nenhuma emissão, nem a automática", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<NfceActions {...BASE} autoEmit notaAtiva={false} />); });
  expect(porId(t, "convite-nota-fiscal")).toHaveLength(1);
  expect(mockEmit).not.toHaveBeenCalled();
});

it("nota ligada (ou sem a informação): a automática emite como sempre", () => {
  act(() => { renderer.create(<NfceActions {...BASE} autoEmit notaAtiva />); });
  expect(mockEmit).toHaveBeenCalledTimes(1);
  act(() => { renderer.create(<NfceActions {...BASE} autoEmit />); });
  expect(mockEmit).toHaveBeenCalledTimes(2);
});
