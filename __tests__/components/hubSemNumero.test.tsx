// Conversas vazia: com o número NÃO conectado, "Conecte o número da loja para começar" + "Conectar WhatsApp";
// com o número conectado (ou sem saber), o texto de sempre.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/constants/helpers", () => ({ ...jest.requireActual("@/constants/helpers"), IS_WIDE: true }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

const mockHub: Record<string, jest.Mock> = {
  settings: jest.fn(), conversations: jest.fn(), etiquetas: jest.fn(), saldoAvisos: jest.fn(),
};
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

import { HubView } from "@/components/screens/hub/HubView";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

beforeEach(() => {
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.settings.mockResolvedValue({ enabled: true, approval_mode: true, model: null, extra_instructions: null });
  mockHub.conversations.mockResolvedValue({ conversations: [], counts: [] });
  mockHub.etiquetas.mockResolvedValue({ labels: [] });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  if (tree) act(() => { tree!.unmount(); });
  tree = null;
  qc.clear();
});

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
};
async function montar(props: any) {
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><HubView {...props} /></QueryClientProvider>); });
  await flush();
  return tree!;
}
const textoDe = (n: any): string => (typeof n === "string" ? n : Array.isArray(n.children) ? n.children.map(textoDe).join("") : n.children ? textoDe(n.children) : "");
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });

describe("Conversas vazia", () => {
  it("número não conectado: convite para conectar, e o botão chama aoConectarNumero", async () => {
    const aoConectar = jest.fn();
    const r = await montar({ numeroConectado: false, aoConectarNumero: aoConectar });
    const t = textoDe(r.toJSON());
    expect(t).toContain("Conecte o número da loja para começar");
    expect(t).toContain("Conectar WhatsApp");
    expect(t).not.toContain("Nenhuma conversa ainda");
    await act(async () => { porId(r, "hub-conectar-whatsapp")[0].props.onPress(); });
    expect(aoConectar).toHaveBeenCalledTimes(1);
  });

  it("número conectado (ou desconhecido) e sem conversa: o texto de sempre", async () => {
    for (const numeroConectado of [true, undefined]) {
      const r = await montar({ numeroConectado });
      const t = textoDe(r.toJSON());
      expect(t).toContain("Nenhuma conversa ainda");
      expect(t).not.toContain("Conecte o número da loja");
      expect(porId(r, "hub-sem-numero")).toHaveLength(0);
      act(() => { tree!.unmount(); });
      tree = null;
    }
  });
});
