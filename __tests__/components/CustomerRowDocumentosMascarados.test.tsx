// ============================================================
// Ótica · ficha aberta do cliente com a lista mascarada (24/11/2026)
//
// Aura-backend#1099: a lista manda CPF e RG mascarados. A ficha aberta
// (CustomerRow expandida, ótica ligada) busca o inteiro no GET /:cid da loja
// do cliente; sem máscara (backend antigo), nenhuma chamada a mais; se o GET
// falhar, mostra a máscara — nunca o número cortado.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { otica_enabled: true }, isLoading: false, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-ativa", name: "Ótica Visão" } }),
}));
jest.mock("@/components/screens/clientes/ReceberPagamentoModal", () => ({ ReceberPagamentoModal: () => null }));
jest.mock("@/components/screens/clientes/HistoricoComprasModal", () => ({ HistoricoComprasModal: () => null }));
jest.mock("@/components/matcon/MarcarProfissionalModal", () => ({ MarcarProfissionalModal: () => null }));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ companiesApi: {}, ApiError: class ApiError extends Error {}, request: (...a: any[]) => mockRequest(...a) }));

import { CustomerRow } from "@/components/screens/clientes/CustomerRow";
import type { Customer } from "@/components/screens/clientes/types";

function textoDe(n: any): string {
  if (typeof n === "string") return n;
  return (n?.children || []).map(textoDe).join("");
}
const valorDe = (t: renderer.ReactTestRenderer, rotulo: string) => {
  const n = t.root.findAll((x) => x.props?.testID === `cliente-ficha-${rotulo}`, { deep: false })[0];
  return n ? textoDe(n) : null;
};

function montar(c: Customer, expanded = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <CustomerRow c={c} expanded={expanded} onToggle={jest.fn()} />
      </QueryClientProvider>,
    );
  });
  return t;
}

const DA_LISTA: Customer = {
  id: "c1", name: "Marina Prado", email: "", phone: "12998124410", instagram: "", birthday: "14/03/1968",
  lastPurchase: "---", totalSpent: 0, visits: 0, firstVisit: "01/01/2026", notes: "", rating: null, creditBalance: 0,
  cpf: "***.***.247-25", rg: "***4-7", docsMasked: true, company_id: "loja-b",
};

beforeEach(() => mockRequest.mockReset());

describe("Ficha aberta com a lista mascarada", () => {
  it("busca o GET na loja do cliente e mostra CPF e RG inteiros", async () => {
    mockRequest.mockImplementation((path: string) => path === "/companies/loja-b/customers/c1"
      ? Promise.resolve({ customer: { id: "c1", cpf_cnpj: "52998224725", rg: "32.118.404-7", docs_masked: false } })
      : new Promise(() => {}));
    const t = montar(DA_LISTA);
    expect(mockRequest).toHaveBeenCalledWith("/companies/loja-b/customers/c1", expect.anything());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(valorDe(t, "CPF")).toContain("529.982.247-25");
    expect(valorDe(t, "RG")).toContain("32.118.404-7");
  });

  it("se o GET falhar, mostra a máscara e não o número cortado", async () => {
    mockRequest.mockImplementation((path: string) => path === "/companies/loja-b/customers/c1"
      ? Promise.reject(new Error("rede"))
      : new Promise(() => {}));
    const t = montar(DA_LISTA);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(valorDe(t, "CPF")).toContain("***.***.247-25");
    expect(valorDe(t, "CPF")).not.toContain("247.25");
  });

  it("backend antigo (documento inteiro na lista): nenhuma chamada da ficha", () => {
    const t = montar({ ...DA_LISTA, cpf: "52998224725", rg: "32.118.404-7", docsMasked: false });
    expect(mockRequest.mock.calls.filter(([p]) => String(p).includes("/customers/c1"))).toHaveLength(0);
    expect(valorDe(t, "CPF")).toContain("529.982.247-25");
  });

  it("linha fechada não busca documento", () => {
    montar(DA_LISTA, false);
    expect(mockRequest.mock.calls.filter(([p]) => String(p).includes("/customers/c1"))).toHaveLength(0);
  });
});
