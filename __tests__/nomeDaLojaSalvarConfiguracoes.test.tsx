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
const mockToastInfo = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { info: (...a: any[]) => mockToastInfo(...a), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore } from "@/stores/auth";
import { useConfigProfile } from "@/components/screens/configuracoes/useConfigProfile";
import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { nomeDaLojaDaEmpresa } from "@/components/screens/estoque/labels/nomeDaLoja";
import { montarSalvarCnpj } from "@/components/screens/configuracoes/CnpjSection";

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

// ── 23/11/2026: decisões do Caio ────────────────────────────────────────────
describe("3. aviso quando a loja online muda junto", () => {
  test("site_name_atualizado: true mostra o aviso aprovado", async () => {
    mockToastInfo.mockReset();
    mockUpdateProfile.mockResolvedValue({ id: LOJA, name: "Layali Nova", trade_name: "Layali Nova", legal_name: "MARIA DA SILVA 12345678900", site_name_atualizado: true, updated: true });
    const { result } = montar();
    await act(async () => {});
    act(() => { result.current.setCompanyName("Layali Nova"); });
    await act(async () => { await result.current.handleSave(); });
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledWith("O nome da sua loja online também mudou.");
  });

  test("sem a marca (false, ou backend de antes): nenhum aviso", async () => {
    for (const extra of [{ site_name_atualizado: false }, {}]) {
      mockToastInfo.mockReset();
      mockUpdateProfile.mockResolvedValue({ id: LOJA, name: "Layali Nova", trade_name: "Layali Nova", legal_name: "MARIA DA SILVA 12345678900", updated: true, ...extra });
      const { result, unmount } = montar();
      await act(async () => {});
      act(() => { result.current.setCompanyName("Layali Nova"); });
      await act(async () => { await result.current.handleSave(); });
      expect(mockToastInfo).not.toHaveBeenCalled();
      unmount();
    }
  });
});

describe("1. salvar o CNPJ grava a razão social da Receita e mantém o nome da loja", () => {
  const receita = { name: "Doces da Maria", legalName: "MARIA DA SILVA DOCES LTDA", address: "Rua A, 1", phone: "(11) 4000-0000", taxRegime: "simples_nacional" };

  test("com nome fantasia: grava legal_name e não manda trade_name", () => {
    const { body, aviso } = montarSalvarCnpj({ trade_name: "Doce Encanto", legal_name: "Doce Encanto" }, "12345678000190", receita);
    expect(body).toEqual({ cnpj: "12345678000190", legal_name: "MARIA DA SILVA DOCES LTDA", address: "Rua A, 1", phone: "(11) 4000-0000", tax_regime: "simples_nacional" });
    expect(aviso).toBe("CNPJ salvo! Razão social atualizada pela Receita Federal. O nome da sua loja continua o mesmo.");
  });

  test("sem nome fantasia: o nome que aparece hoje vira o nome fantasia (não muda)", () => {
    const { body, aviso } = montarSalvarCnpj({ trade_name: "  ", legal_name: "Ana Modas" }, "12345678000190", receita);
    expect(body.trade_name).toBe("Ana Modas");
    expect(body.legal_name).toBe("MARIA DA SILVA DOCES LTDA");
    expect(nomeDaLojaDe({ trade_name: body.trade_name, legal_name: body.legal_name })).toBe("Ana Modas");
    expect(aviso).toBe("CNPJ salvo! Razão social atualizada pela Receita Federal. O nome da sua loja continua o mesmo.");
  });

  test("loja sem nome nenhum: recebe o nome da Receita", () => {
    const { body, aviso } = montarSalvarCnpj({ trade_name: null, legal_name: null }, "12345678000190", receita);
    expect(body.trade_name).toBe("Doces da Maria");
    expect(body.legal_name).toBe("MARIA DA SILVA DOCES LTDA");
    expect(aviso).toBe("CNPJ salvo! Razão social e nome da loja preenchidos pela Receita Federal.");
  });

  test("sem dados da Receita: só o CNPJ", () => {
    expect(montarSalvarCnpj({ trade_name: "Layali" }, "12345678000190", null))
      .toEqual({ body: { cnpj: "12345678000190" }, aviso: "CNPJ salvo!" });
  });
});

describe("2. holerite com a razão social (documento trabalhista vai com o CNPJ)", () => {
  test("Payslip.tsx monta o holerite impresso e o do e-mail com razaoSocialDe", () => {
    const fs = require("fs");
    const path = require("path");
    const src: string = fs.readFileSync(path.join(__dirname, "..", "components", "screens", "folha", "Payslip.tsx"), "utf8");
    const chamadas = src.split("\n").filter((l) => /generatePayslipHtml\(emp,/.test(l));
    expect(chamadas).toHaveLength(2);
    for (const l of chamadas) expect(l).toMatch(/razaoSocialDe\(company\)/);
    expect(src).not.toMatch(/nomeDaLojaDe/);
  });
});
