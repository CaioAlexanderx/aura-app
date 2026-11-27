// ============================================================
// Régua do crediário depois da virada do WhatsApp (27/11/2026).
//
// O liga do envio automático saiu das Configurações do Crediário: o
// "cobrar" vive em WhatsApp > Configurações > Crediário. A régua (etapas,
// dias, Pix) continua aqui. Estes testes seguram:
//   1. não existe mais o interruptor, o bloco nem a prévia do WhatsApp oficial;
//   2. a tela aponta para o WhatsApp;
//   3. o whatsapp_auto gravado segue sendo ecoado no PUT (nada muda no dado).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1", name: "Loja Exemplo" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

var mockRules: any = {
  company_id: "loja-1", enabled: true, pix_key: "loja@exemplo.com",
  whatsapp_auto: true,
  rules: [
    { id: "lembrete", name: "Lembrete", days_relative: -3, template: "oi", channel: "whatsapp", enabled: true },
  ],
};
var mockUpdateRules = jest.fn((_id: string, body: any) => Promise.resolve({ ...mockRules, ...body }));
jest.mock("@/services/creditApi", () => ({
  creditApi: {
    getPlanConfig: () => Promise.resolve({ max_installments: 12, min_installment_value: 20 }),
    getCollectionRules: () => Promise.resolve(mockRules),
    updatePlanConfig: jest.fn(() => Promise.resolve({})),
    updateCollectionRules: (id: string, body: any) => mockUpdateRules(id, body),
  },
}));

import CrediarioSettingsScreen from "@/app/(tabs)/crediario/settings";

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 30));
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}
async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}><CrediarioSettingsScreen /></QueryClientProvider>
    );
  });
  await flush();
  return tree;
}
const tem = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;

describe("régua do crediário sem o liga do WhatsApp oficial", () => {
  beforeEach(() => { mockPush.mockClear(); mockUpdateRules.mockClear(); });

  it("não tem interruptor, bloco nem motivos do WhatsApp oficial", async () => {
    const tree = await montar();
    for (const id of ["crediario-wa-bloco", "crediario-wa-switch", "crediario-wa-switch-travado", "crediario-wa-motivos", "crediario-wa-configurar"]) {
      expect(tem(tree, id)).toBe(false);
    }
    tree.unmount();
  });

  it("aponta para o WhatsApp, onde o cobrar vive", async () => {
    const tree = await montar();
    expect(tem(tree, "crediario-wa-ir-para-whatsapp")).toBe(true);
    const link = tree.root.findAllByProps({ testID: "crediario-wa-ir-para-whatsapp" })[0];
    await act(async () => { link.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/whatsapp");
    tree.unmount();
  });

  it("o chip da etapa segue dizendo 'automático' quando o whatsapp_auto está gravado", async () => {
    const tree = await montar();
    expect(tem(tree, "crediario-canal-lembrete")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("automático");
    tree.unmount();
  });
});
