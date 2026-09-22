// ============================================================
// Matcon M3 — CustomerRow · "Marcar como parceiro"
// (docs/CONTRACT_MATCON.md, seção M3 · mockup
// docs/mockups/matcon-m3-clube-calculadora.html #ficha).
//
// Cobre:
//   - matcon_club_enabled desligado: sem botão "Marcar como parceiro" nem linha
//   - matcon_club_enabled ligado, cliente comum: botão aparece, sem linha
//   - matcon_club_enabled ligado, `c.professional` presente: some o botão,
//     aparece a linha "Parceiro · profissão · N pontos · M indicações"
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

let mockPdvSettings: any = { otica_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito do Zé" } }),
}));
jest.mock("@/components/screens/clientes/ReceberPagamentoModal", () => ({
  ReceberPagamentoModal: () => null,
}));
jest.mock("@/components/screens/clientes/HistoricoComprasModal", () => ({
  HistoricoComprasModal: () => null,
}));
// MarcarProfissionalModal é testado à parte; aqui só verificamos se ele
// existe na árvore (visible ou não).
jest.mock("@/components/matcon/MarcarProfissionalModal", () => ({
  MarcarProfissionalModal: (props: any) =>
    props.visible ? require("react").createElement("MarcarProfissionalAberto") : null,
}));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));

import { CustomerRow } from "@/components/screens/clientes/CustomerRow";
import type { Customer } from "@/components/screens/clientes/types";

function achar(tree: any, testID: string): any[] {
  return tree.root.findAllByProps({ testID });
}

function montar(cliente: Customer) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderer.create(
    <QueryClientProvider client={qc}>
      <CustomerRow c={cliente} expanded onToggle={jest.fn()} />
    </QueryClientProvider>
  );
}

const CLIENTE_BASE: Customer = {
  id: "cli-9", name: "Nivaldo Pereira", email: "", phone: "11977223344",
  instagram: "", birthday: "01/01", lastPurchase: "01/09/2026", totalSpent: 500,
  visits: 5, firstVisit: "01/01/2026", notes: "", rating: null, creditBalance: 0,
};

describe("CustomerRow — Matcon M3 (profissionais parceiros)", () => {
  afterEach(() => { mockPdvSettings = { otica_enabled: false }; });

  it("matcon_club_enabled desligado: sem botão e sem linha de parceiro", () => {
    mockPdvSettings = { otica_enabled: false, matcon_enabled: false, matcon_club_enabled: true };
    let tree: any;
    act(() => { tree = montar(CLIENTE_BASE); });

    expect(achar(tree, "cliente-marcar-profissional-cli-9").length).toBe(0);
    expect(achar(tree, "cliente-profissional-cli-9").length).toBe(0);

    tree.unmount();
  });

  it("matcon_club_enabled ligado, cliente comum: botão 'Marcar como parceiro' aparece", () => {
    mockPdvSettings = { otica_enabled: false, matcon_enabled: true, matcon_club_enabled: true };
    let tree: any;
    act(() => { tree = montar(CLIENTE_BASE); });

    expect(achar(tree, "cliente-marcar-profissional-cli-9").length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain("Marcar como parceiro");
    expect(achar(tree, "cliente-profissional-cli-9").length).toBe(0);

    tree.unmount();
  });

  it("matcon_club_enabled ligado, cliente já parceiro: some o botão e mostra a linha com profissão e pontos", () => {
    mockPdvSettings = { otica_enabled: false, matcon_enabled: true, matcon_club_enabled: true };
    const cliente: Customer = {
      ...CLIENTE_BASE,
      professional: { id: "prof-1", trade: "pedreiro", points_balance: 1240, referrals_count: 9 },
    };
    let tree: any;
    act(() => { tree = montar(cliente); });

    expect(achar(tree, "cliente-marcar-profissional-cli-9").length).toBe(0);
    expect(achar(tree, "cliente-profissional-cli-9").length).toBeGreaterThan(0);

    const texto = JSON.stringify(tree.toJSON());
    expect(texto).toContain("Parceiro");
    expect(texto).toContain("pedreiro");
    expect(texto).toContain("1.240 pontos");
    expect(texto).toContain("9 indicações");

    tree.unmount();
  });
});
