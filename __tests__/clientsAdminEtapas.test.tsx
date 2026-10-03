// Gestão Aura › Clientes: a lista abre no funil de trial e separa as etapas.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/admin/ResyncSubscriptionButton", () => ({ ResyncSubscriptionButton: "Resync" }));
jest.mock("@/hooks/useVisibleModules", () => ({ MODULE_PLAN_MAP: {}, PLAN_LEVEL: {} }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ token: "t", isStaff: true, company: null }),
}));

var mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  adminApi: { notes: { list: jest.fn(), create: jest.fn() }, extendTrial: jest.fn() },
}));

import { ClientsAdmin } from "@/components/admin/ClientsAdmin";

const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const base = {
  plan: "negocio", is_active: true, billing_status: "trial", billing_cycle: "monthly",
  module_overrides: null, tax_regime: "mei", owner_email: "a@b.com", owner_name: "Dona",
  health_score: null, risk_level: null, tx_count: 0, prod_count: 0, cust_count: 0, total_revenue: 0,
  vertical_active: null, legal_name: "",
};
const CLIENTS = [
  { ...base, id: "novo", trade_name: "Loja Nova", stage: "trial", created_at: at(-1), trial_ends_at: at(6), owner_phone: "92996277335" },
  { ...base, id: "urgente", trade_name: "Loja Urgente", stage: "trial", created_at: at(-6), trial_ends_at: at(0.9), prod_count: 138, login_days: 4 },
  { ...base, id: "venceu", trade_name: "Loja Vencida", stage: "vencido", created_at: at(-9), trial_ends_at: at(-2) },
  { ...base, id: "lixo", trade_name: "Nunca Usou", stage: "arquivo", archive_reason: "nao_aderiu", created_at: at(-92), trial_ends_at: at(-85) },
  { ...base, id: "paga", trade_name: "Cliente Pagante", stage: "cliente", billing_status: "active", created_at: at(-100), trial_ends_at: at(-70) },
];

async function mount() {
  mockRequest.mockResolvedValue({ total: CLIENTS.length, clients: CLIENTS });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><ClientsAdmin /></QueryClientProvider>);
  });
  await act(async () => { await Promise.resolve(); });
  return tree!;
}

// Sob react-native-web o testID vira data-testid no elemento de host.
const hostIds = (tree: renderer.ReactTestRenderer, prefix: string) =>
  tree.root.findAll((n) => typeof n.type === "string" && String(n.props["data-testid"] || "").startsWith(prefix))
    .map((n) => String(n.props["data-testid"]).replace(prefix, ""));
const rowIds = (tree: renderer.ReactTestRenderer) => hostIds(tree, "client-row-");
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

describe("ClientsAdmin — etapas", () => {
  it("abre em 'Em trial', só com trial vigente, quem vence primeiro no topo", async () => {
    const tree = await mount();
    expect(rowIds(tree)).toEqual(["urgente", "novo"]);
    const out = text(tree);
    expect(out).toContain("Em trial");
    expect(out).toContain("138 produtos · 4 dias de uso");
    expect(out).toContain("só cadastrou");
    expect(out).not.toContain("Nunca Usou");
    expect(out).not.toContain("Cliente Pagante");
    tree.unmount();
  });

  it("vencidos, arquivo e clientes ficam cada um na sua aba", async () => {
    const tree = await mount();
    const press = async (key: string) => {
      const tab = tree.root.findAllByProps({ testID: "stage-tab-" + key }, { deep: false })[0];
      await act(async () => { tab.props.onPress(); });
    };
    await press("vencido");
    expect(rowIds(tree)).toEqual(["venceu"]);
    await press("arquivo");
    expect(rowIds(tree)).toEqual(["lixo"]);
    expect(text(tree)).toContain("Não aderiu");
    await press("cliente");
    expect(rowIds(tree)).toEqual(["paga"]);
    tree.unmount();
  });

  it("botão de WhatsApp só aparece para quem tem telefone", async () => {
    const tree = await mount();
    expect(hostIds(tree, "client-wa-")).toEqual(["novo"]);
    tree.unmount();
  });
});
