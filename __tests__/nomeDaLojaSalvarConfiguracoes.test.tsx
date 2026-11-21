// ============================================================================
// AURA. — Salvar o nome em Configurações vale na hora (21/11/2026)
//
// Pedido do Caio: trocar o nome em Configurações tem de valer em todo o app
// sem sair e entrar. useConfigProfile.handleSave grava e, com a resposta,
// atualiza a empresa do store (name, trade_name, legal_name), invalida o
// perfil em cache (Painel, banner) e relê a lista de lojas (seletor).
// ============================================================================
import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-router", () => {
  const R = require("react");
  return { useFocusEffect: (cb: any) => R.useEffect(() => cb(), [cb]) };
});

const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock("@/services/api", () => ({
  authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
  companiesApi: { getProfile: (...a: any[]) => mockGetProfile(...a), updateProfile: (...a: any[]) => mockUpdateProfile(...a) },
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore } from "@/stores/auth";
import { useConfigProfile } from "@/components/screens/configuracoes/useConfigProfile";
import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { nomeDaLojaDaEmpresa } from "@/components/screens/estoque/labels/nomeDaLoja";

const LOJA = "08c05f0e-b75b-4c12-870e-d7fb65f1dca0";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = jest.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: any) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { invalidar, ...renderHook(() => useConfigProfile(), { wrapper }) };
}

beforeEach(() => {
  mockGetProfile.mockReset();
  mockUpdateProfile.mockReset();
  const loadCompanies = jest.fn().mockResolvedValue(undefined);
  useAuthStore.setState({
    // Como o login antigo deixava: name = razão social (nome da dona).
    company: { id: LOJA, name: "MARIA DA SILVA 12345678900", trade_name: "Layali", legal_name: "MARIA DA SILVA 12345678900", plan: "negocio", onboarding_step: "done" } as any,
    user: { id: "u1", name: "Maria", email: "maria@exemplo.com.br", role: "client" } as any,
    isDemo: false,
    loadCompanies,
  } as any);
  mockGetProfile.mockResolvedValue({ id: LOJA, name: "Layali", trade_name: "Layali", legal_name: "MARIA DA SILVA 12345678900", email: "", phone: "", address: "", cnpj: "" });
});

test("salvar o nome atualiza a empresa do store na hora (etiqueta, Caixa, mensagens)", async () => {
  mockUpdateProfile.mockResolvedValue({ id: LOJA, name: "Layali Perfumaria Árabe", trade_name: "Layali Perfumaria Árabe", legal_name: "MARIA DA SILVA 12345678900", email: "", phone: "", address: "", updated: true });
  const { result, invalidar } = montar();
  await act(async () => {});
  expect(result.current.companyName).toBe("Layali");

  act(() => { result.current.setCompanyName("Layali Perfumaria Árabe"); });
  await act(async () => { await result.current.handleSave(); });

  expect(mockUpdateProfile).toHaveBeenCalledWith(LOJA, expect.objectContaining({ trade_name: "Layali Perfumaria Árabe" }));
  const c: any = useAuthStore.getState().company;
  expect(c.name).toBe("Layali Perfumaria Árabe");
  expect(c.trade_name).toBe("Layali Perfumaria Árabe");
  expect(c.legal_name).toBe("MARIA DA SILVA 12345678900");
  expect(nomeDaLojaDe(c)).toBe("Layali Perfumaria Árabe");
  expect(nomeDaLojaDaEmpresa(c)).toBe("Layali Perfumaria Árabe");
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ["company-profile", LOJA] });
  expect((useAuthStore.getState() as any).loadCompanies).toHaveBeenCalled();
});

test("backend anterior (resposta sem legal_name): mantém a razão social guardada", async () => {
  mockUpdateProfile.mockResolvedValue({ id: LOJA, name: "Layali Nova", trade_name: "Layali Nova", email: "", phone: "", address: "", updated: true });
  const { result } = montar();
  await act(async () => {});
  act(() => { result.current.setCompanyName("Layali Nova"); });
  await act(async () => { await result.current.handleSave(); });
  const c: any = useAuthStore.getState().company;
  expect(c.name).toBe("Layali Nova");
  expect(c.legal_name).toBe("MARIA DA SILVA 12345678900");
});
