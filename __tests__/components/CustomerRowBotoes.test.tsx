// ============================================================
// I0.5 — os 3 botões mortos da linha expandida do cliente
// (Enviar WhatsApp, Pedir avaliação, Ver histórico) ganham ação real.
//
// Cobre:
//   - sem telefone válido, "Enviar WhatsApp" e "Pedir avaliação" ficam
//     desabilitados e mostram o hint "sem telefone" (nunca dependem de
//     hover — CLAUDE.md armadilha 7)
//   - com telefone válido, clicar em "Enviar WhatsApp" abre o wa.me certo
//   - "Ver histórico" abre o modal mesmo sem telefone (não depende dele)
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Matcon M3 (22/09/2026): CustomerRow agora importa MarcarProfissionalModal,
// que usa Icon — e react-native-svg não passa pelo transformIgnorePatterns
// do projeto (mesmo mock de __tests__/components/CartPanelMatcon.test.tsx).
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { otica_enabled: false }, isLoading: false, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja da Ana" } }),
}));
jest.mock("@/components/screens/clientes/ReceberPagamentoModal", () => ({
  ReceberPagamentoModal: (props: any) => (props.visible ? null : null),
}));
jest.mock("@/components/screens/clientes/HistoricoComprasModal", () => ({
  HistoricoComprasModal: ({ visible }: any) => (visible ? require("react").createElement("HistoricoAberto") : null),
}));

import { CustomerRow } from "@/components/screens/clientes/CustomerRow";
import type { Customer } from "@/components/screens/clientes/types";

// Espiona window.open (o que customerActions.openExternalUrl usa) em vez de
// mockar o módulo inteiro — assim o teste também valida o texto do link.
// Retorna um objeto truthy pra simular popup NÃO bloqueado — evita cair no
// fallback de navegação direta (window.location.href), que o jsdom não
// implementa e só sujaria a saída do teste com "Not implemented: navigation".
const openSpy = jest.spyOn(window, "open").mockImplementation(() => ({} as Window));

function achar(tree: any, testID: string): any {
  return tree.root.findAllByProps({ testID })[0];
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
  id: "cli-1", name: "Ana Souza", email: "ana@ex.com", phone: "11987654321",
  instagram: "", birthday: "01/01", lastPurchase: "01/09/2026", totalSpent: 500,
  visits: 5, firstVisit: "01/01/2026", notes: "", rating: null, creditBalance: 0,
};

describe("CustomerRow — botões da linha expandida", () => {
  beforeEach(() => { openSpy.mockClear(); });

  it("sem telefone válido, WhatsApp e avaliação ficam desabilitados com hint", () => {
    const cliente: Customer = { ...CLIENTE_BASE, phone: "" };
    let tree: any;
    act(() => { tree = montar(cliente); });

    const waBtn = achar(tree, "cliente-wa-cli-1");
    const avaliacaoBtn = achar(tree, "cliente-avaliacao-cli-1");
    expect(waBtn.props.disabled).toBe(true);
    expect(avaliacaoBtn.props.disabled).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("sem telefone");

    // "Ver histórico" não depende de telefone — continua clicável.
    const historicoBtn = achar(tree, "cliente-historico-cli-1");
    expect(historicoBtn.props.disabled).toBeFalsy();

    tree.unmount();
  });

  it("com telefone válido, os botões ficam habilitados e sem o hint", () => {
    let tree: any;
    act(() => { tree = montar(CLIENTE_BASE); });

    expect(achar(tree, "cliente-wa-cli-1").props.disabled).toBeFalsy();
    expect(achar(tree, "cliente-avaliacao-cli-1").props.disabled).toBeFalsy();
    expect(JSON.stringify(tree.toJSON())).not.toContain("sem telefone");

    tree.unmount();
  });

  it("clicar em Enviar WhatsApp abre o wa.me com o telefone normalizado e a saudação", () => {
    let tree: any;
    act(() => { tree = montar(CLIENTE_BASE); });

    act(() => { achar(tree, "cliente-wa-cli-1").props.onPress(); });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/wa\.me\/5511987654321\?text=/);
    expect(decodeURIComponent(url.split("text=")[1])).toContain("Oi, Ana!");
    expect(decodeURIComponent(url.split("text=")[1])).toContain("Loja da Ana");

    tree.unmount();
  });

  it("clicar em Pedir avaliação abre o wa.me com a mensagem de avaliação", () => {
    let tree: any;
    act(() => { tree = montar(CLIENTE_BASE); });

    act(() => { achar(tree, "cliente-avaliacao-cli-1").props.onPress(); });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(decodeURIComponent(url.split("text=")[1]).toLowerCase()).toContain("avaliação");

    tree.unmount();
  });

  it("Ver histórico abre o modal ao clicar, mesmo sem telefone", () => {
    const cliente: Customer = { ...CLIENTE_BASE, phone: "" };
    let tree: any;
    act(() => { tree = montar(cliente); });

    expect(JSON.stringify(tree.toJSON())).not.toContain("HistoricoAberto");
    act(() => { achar(tree, "cliente-historico-cli-1").props.onPress(); });
    expect(JSON.stringify(tree.toJSON())).toContain("HistoricoAberto");

    tree.unmount();
  });

  it("Receber pagamento só aparece quando o cliente tem saldo em aberto", () => {
    let tree: any;
    act(() => { tree = montar(CLIENTE_BASE); }); // creditBalance: 0
    expect(tree.root.findAllByProps({ testID: "cliente-receber-pagamento-cli-1" }).length).toBe(0);
    tree.unmount();

    act(() => { tree = montar({ ...CLIENTE_BASE, creditBalance: 87.4 }); });
    expect(tree.root.findAllByProps({ testID: "cliente-receber-pagamento-cli-1" }).length).toBeGreaterThan(0);
    tree.unmount();
  });
});
