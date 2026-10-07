// ============================================================
// Frente da empresa (05/10/2026):
//   · Gestão Aura › Clientes › Frente salva via PATCH /segment com os campos
//     certos e mostra "Studio exige plano Negócio ou superior" no 409.
//   · Configurações › Políticas do Caixa: cliente não alterna Matcon/Ótica/OS
//     (lê "Sua frente"); staff continua com os switches.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardFeeSection", () => ({ CardFeeSection: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));

let mockAuth: any = {};
jest.mock("@/stores/auth", () => {
  const fn: any = (sel?: any) => (typeof sel === "function" ? sel(mockAuth) : mockAuth);
  fn.getState = () => mockAuth;
  return { useAuthStore: fn };
});

let mockSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

const mockRequest = jest.fn();
const mockSetSegment = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  adminApi: { setSegment: (...a: any[]) => mockSetSegment(...a) },
  pdvSettingsApi: { save: jest.fn() },
  companiesApi: { products: jest.fn() },
}));

import { FrenteSection } from "@/components/admin/FrenteSection";
import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { toast } from "@/components/Toast";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const byId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function mount(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await flush();
  return tree;
}

beforeEach(() => {
  mockRequest.mockReset(); mockSetSegment.mockReset();
  (toast.error as jest.Mock).mockReset();
  mockAuth = { token: "t", isStaff: true, company: { id: "staff-co" } };
  mockRequest.mockImplementation((path: string) => {
    if (path === "/admin/clients") {
      return Promise.resolve({ clients: [{ id: "c9", segment: "varejo", segment_source: "cnae", segment_suggested: "otica", cnae_principal: "4774100" }] });
    }
    if (path === "/companies/c9/pdv-settings") {
      return Promise.resolve({ settings: { matcon_enabled: true, otica_enabled: false, os_enabled: true } });
    }
    return Promise.resolve({});
  });
});

describe("Gestão Aura › Frente", () => {
  it("mostra frente, origem, sugestão, CNAE e o que está ligado", async () => {
    const tree = await mount(<FrenteSection companyId="c9" />);
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Loja em geral");
    expect(txt).toContain("pelo CNAE");
    expect(txt).toContain("Ótica");
    expect(txt).toContain("4774100");
    expect(byId(tree, "frente-ligado-matcon")).toHaveLength(1);
    expect(byId(tree, "frente-ligado-os")).toHaveLength(1);
    expect(byId(tree, "frente-ligado-otica")).toHaveLength(0);
    tree.unmount();
  });

  it("salva com segment, extras e disable", async () => {
    mockSetSegment.mockResolvedValue({ segment: "otica", segment_source: "staff", vertical_active: null,
      flags: { matcon_enabled: false, otica_enabled: true, os_enabled: true, studio_enabled: false } });
    const tree = await mount(<FrenteSection companyId="c9" />);
    await act(async () => { byId(tree, "frente-opcao-otica")[0].props.onPress(); });
    await act(async () => { byId(tree, "frente-extra-os")[0].props.onPress(); });
    await act(async () => { byId(tree, "frente-desligar-matcon")[0].props.onPress(); });
    await act(async () => { byId(tree, "frente-salvar")[0].props.onPress(); });
    await flush();
    expect(mockSetSegment).toHaveBeenCalledWith("c9", { segment: "otica", extras: ["os"], disable: ["matcon"] });
    expect(byId(tree, "frente-ligado-otica")).toHaveLength(1);
    expect(byId(tree, "frente-ligado-matcon")).toHaveLength(0);
    tree.unmount();
  });

  it("409 STUDIO_PLAN_REQUIRED vira a mensagem de plano", async () => {
    mockSetSegment.mockRejectedValue(Object.assign(new Error("x"), { status: 409, data: { error: "A frente Personalizados...", code: "STUDIO_PLAN_REQUIRED" } }));
    const tree = await mount(<FrenteSection companyId="c9" />);
    await act(async () => { byId(tree, "frente-opcao-studio")[0].props.onPress(); });
    await act(async () => { byId(tree, "frente-salvar")[0].props.onPress(); });
    await flush();
    expect(mockSetSegment).toHaveBeenCalledWith("c9", { segment: "studio" });
    const erro = byId(tree, "frente-erro")[0];
    expect(flatten(erro.props.children)).toBe("Studio exige plano Negócio ou superior");
    expect(toast.error).toHaveBeenCalledWith("Studio exige plano Negócio ou superior");
    tree.unmount();
  });
});

describe("Configurações › Políticas do Caixa — frente", () => {
  it("cliente: sem switches de Matcon/Ótica/OS, lê a frente e mantém os links de configuração", async () => {
    mockAuth = { token: "t", isStaff: false, company: { id: "c1", segment: "otica" } };
    mockSettings = { otica_enabled: true, os_enabled: false, matcon_enabled: false };
    const tree = await mount(<PdvSettingsCard />);
    expect(byId(tree, "pdv-settings-otica")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-matcon")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-os")).toHaveLength(0);
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Sua frente: Ótica");
    expect(txt).toContain("Ligado: Ótica");
    // 07/10/2026: o cliente troca a frente pela seta (frenteTrocadaPeloCliente.test.tsx)
    expect(txt).not.toContain("Pra mudar, fale com a gente");
    expect(txt).toContain("Laboratórios, validade da receita e garantia");
    expect(byId(tree, "pdv-settings-frente-whatsapp")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-frente-trocar")).toHaveLength(1);
    tree.unmount();
  });

  it("conta antiga sem frente com Matcon ligado lê como material de construção", async () => {
    mockAuth = { token: "t", isStaff: false, company: { id: "c1", segment: null } };
    mockSettings = { matcon_enabled: true };
    const tree = await mount(<PdvSettingsCard />);
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Sua frente: Material de construção");
    expect(txt).toContain("Unidades, entrega e parceiros");
    tree.unmount();
  });

  it("staff: continua com os três switches", async () => {
    mockAuth = { token: "t", isStaff: true, company: { id: "c1", segment: "varejo" } };
    mockSettings = {};
    const tree = await mount(<PdvSettingsCard />);
    expect(byId(tree, "pdv-settings-otica")).toHaveLength(1);
    expect(byId(tree, "pdv-settings-matcon")).toHaveLength(1);
    expect(byId(tree, "pdv-settings-os")).toHaveLength(1);
    tree.unmount();
  });
});
