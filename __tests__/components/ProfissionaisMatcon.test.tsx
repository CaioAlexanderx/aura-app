// ============================================================
// Matcon M3 — /matcon/profissionais (22/09/2026).
//
// Mesmo padrão de mocks de __tests__/components/EntregasMatcon.test.tsx:
// a tela lê o toggle do PDV, a empresa ativa e o ranking — nada disso
// precisa de rede real neste teste.
//
// Cobre:
//   - clube desligado (matcon_club_enabled: false, mesmo com matcon_enabled
//     ligado): a tela é só o recado curto de como ligar o clube, sem
//     esteira nem lista.
//   - clube ligado, 1 profissional ativo: nome, pontos e os dois botões
//     "Avisar no WhatsApp" e "Gerar cupom de resgate" (regra 7 — sempre
//     visíveis, sem hover).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/utils/whatsapp", () => ({ openWhatsApp: jest.fn(() => true) }));

// pdv_settings controlável por teste — mesmo padrão de EntregasMatcon.test.tsx.
let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));

// react-query: entrega o resultado do ranking sem rede.
let mockData: any = { professionals: [], summary: null };
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockData, isLoading: false, isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

import MatconProfissionaisRoute from "@/app/(tabs)/matcon/profissionais";

const NIVALDO = {
  id: "prof-1",
  customer_id: "cli-1",
  customer_name: "Nivaldo Pereira",
  customer_phone: "(11) 98765-4321",
  trade: "pedreiro",
  points_balance: 1240,
  points_earned_total: 1240,
  referrals_count: 9,
  referred_sales_total: 12480,
  last_referral_at: "2026-09-22",
  active: true,
  created_at: "2026-01-10",
};

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<MatconProfissionaisRoute />); });
  return tree;
}

describe("/matcon/profissionais — clube desligado", () => {
  test("Matcon ligado mas clube desligado: recado de como ligar, sem esteira nem lista", () => {
    mockPdvSettings = { matcon_enabled: true, matcon_club_enabled: false };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-profissionais-clube-desligado" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Ligue o clube do profissional");
    expect(tree.root.findAllByProps({ testID: "matcon-esteira-profissionais" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-lista-profissionais" }).length).toBe(0);

    tree.unmount();
  });

  test("Matcon desligado: o recado é o de ligar o módulo, não o do clube", () => {
    mockPdvSettings = { matcon_enabled: false };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-profissionais-desligado" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Materiais de construção");

    tree.unmount();
  });
});

describe("/matcon/profissionais — clube ligado, 1 profissional ativo", () => {
  test("mostra nome, pontos e os dois botões sempre visíveis", () => {
    mockPdvSettings = {
      matcon_enabled: true, matcon_club_enabled: true,
      matcon_points_per_100: 10, matcon_points_to_coupon: 100, matcon_coupon_value: 10,
    };
    mockData = {
      professionals: [NIVALDO],
      summary: { referred_total_month: 48300, active_count: 23, pending_redeems: 3 },
    };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-profissionais-desligado" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-profissionais-clube-desligado" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-esteira-profissionais" }).length).toBeGreaterThan(0);

    expect(texto).toContain("Nivaldo Pereira");
    expect(texto).toContain("1.240 pts");
    expect(texto).toContain("pedreiro");

    // Regra 7 do CLAUDE.md: os dois botões vivem no bloco de ações do
    // card, sempre renderizado — nunca atrás de hover.
    expect(tree.root.findAllByProps({ testID: "matcon-profissional-prof-1-acoes" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "matcon-whats-prof-1" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "matcon-cupom-prof-1" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Avisar no WhatsApp");
    expect(texto).toContain("Gerar cupom de resgate");

    tree.unmount();
  });

  test("profissional inativo (sem compra há 60+ dias) mostra só 'Chamar de volta'", () => {
    mockPdvSettings = {
      matcon_enabled: true, matcon_club_enabled: true,
      matcon_points_per_100: 10, matcon_points_to_coupon: 100, matcon_coupon_value: 10,
    };
    mockData = {
      professionals: [{ ...NIVALDO, id: "prof-2", customer_name: "Sebastião Duarte", active: false, points_balance: 730, last_referral_at: "2026-07-14" }],
      summary: { referred_total_month: 48300, active_count: 23, pending_redeems: 3 },
    };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(texto).toContain("730 pts");
    expect(texto).toContain("Chamar de volta");
    expect(texto).not.toContain("Gerar cupom de resgate");
    expect(tree.root.findAllByProps({ testID: "matcon-chamar-prof-2" }).length).toBeGreaterThan(0);

    tree.unmount();
  });
});
