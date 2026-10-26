// 24/10/2026 (tq-92) — link abre a empresa certa em conta multi-CNPJ
// (?empresa=<company_id>): troca antes da tela, limpa a URL, e sem acesso
// fica na empresa atual com um aviso discreto.
// 26/10/2026 — ?empresa=todas (e all) abre o consolidado, só para quem tem
// mais de uma empresa (relatório semanal de várias lojas).
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockParams: Record<string, any> = {};
jest.mock("expo-router", () => ({ useGlobalSearchParams: () => mockParams }));
const mockToastInfo = jest.fn();
jest.mock("@/components/Toast", () => ({ toast: { info: (m: string) => mockToastInfo(m) } }));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

const mockSwitch = jest.fn();
let mockState: any = {};
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = (sel: (s: any) => any) => sel(mockState);
  useAuthStore.getState = () => mockState;
  return { useAuthStore };
});

import {
  CONSOLIDADO, lerEmpresaDoLink, precisaTrocarEmpresa, podeAbrirConsolidado, urlSemEmpresa, avisoSemAcesso,
} from "@/utils/empresaPeloLink";
import { useEmpresaPeloLink } from "@/hooks/useEmpresaPeloLink";

describe("funções puras", () => {
  it("lerEmpresaDoLink aceita id e 'todas'/'all' (consolidado); recusa vazio e lixo", () => {
    expect(lerEmpresaDoLink("3f2a9c1e-0000-4000-8000-000000000001")).toBe("3f2a9c1e-0000-4000-8000-000000000001");
    expect(lerEmpresaDoLink(["abc", "def"])).toBe("abc");
    expect(lerEmpresaDoLink("todas")).toBe(CONSOLIDADO);
    expect(lerEmpresaDoLink(" Todas ")).toBe(CONSOLIDADO);
    expect(lerEmpresaDoLink("all")).toBe(CONSOLIDADO);
    expect(lerEmpresaDoLink("ALL")).toBe(CONSOLIDADO);
    expect(CONSOLIDADO).toBe("all"); // o mesmo id do switchCompany("all")
    expect(lerEmpresaDoLink("")).toBeNull();
    expect(lerEmpresaDoLink("a/b")).toBeNull();
    expect(lerEmpresaDoLink("<script>")).toBeNull();
    expect(lerEmpresaDoLink(undefined)).toBeNull();
  });

  it("precisaTrocarEmpresa: no consolidado sempre; numa empresa só se for outra", () => {
    expect(precisaTrocarEmpresa("a", { companyId: null, consolidatedView: true })).toBe(true);
    expect(precisaTrocarEmpresa("a", { companyId: "a", consolidatedView: false })).toBe(false);
    expect(precisaTrocarEmpresa("a", { companyId: "b", consolidatedView: false })).toBe(true);
  });

  it("precisaTrocarEmpresa com ?empresa=todas: no consolidado não troca; numa empresa troca", () => {
    expect(precisaTrocarEmpresa(CONSOLIDADO, { companyId: null, consolidatedView: true })).toBe(false);
    expect(precisaTrocarEmpresa(CONSOLIDADO, { companyId: "a", consolidatedView: false })).toBe(true);
  });

  it("consolidado só com mais de uma empresa", () => {
    expect(podeAbrirConsolidado(2)).toBe(true);
    expect(podeAbrirConsolidado(1)).toBe(false);
    expect(podeAbrirConsolidado(0)).toBe(false);
    expect(podeAbrirConsolidado(undefined)).toBe(false);
  });

  it("urlSemEmpresa tira só o parâmetro", () => {
    expect(urlSemEmpresa("https://app.getaura.com.br/crediario?filtro=atraso&empresa=abc")).toBe("/crediario?filtro=atraso");
    expect(urlSemEmpresa("https://app.getaura.com.br/crediario?empresa=abc#x")).toBe("/crediario#x");
    expect(urlSemEmpresa("https://app.getaura.com.br/crediario?filtro=atraso")).toBeNull();
  });

  it("aviso discreto por motivo", () => {
    expect(avisoSemAcesso(403)).toContain("não está no seu acesso");
    expect(avisoSemAcesso(500)).toContain("Não deu para abrir");
  });
});

describe("useEmpresaPeloLink", () => {
  let ultimo: boolean | null = null;
  function Sonda() { ultimo = useEmpresaPeloLink(); return null; }
  const montar = () => { let r!: renderer.ReactTestRenderer; act(() => { r = renderer.create(<Sonda />); }); return r; };

  beforeEach(() => {
    mockSwitch.mockReset();
    mockToastInfo.mockReset();
    ultimo = null;
    mockState = {
      token: "t", isHydrated: true, company: { id: "atual" }, consolidatedView: false, companyCount: 2,
      switchCompany: (id: string) => mockSwitch(id),
    };
  });

  it("empresa diferente: segura a tela e troca", async () => {
    mockParams = { empresa: "outra" };
    mockSwitch.mockResolvedValue(undefined);
    montar();
    expect(mockSwitch).toHaveBeenCalledWith("outra");
    await act(async () => { await Promise.resolve(); });
    expect(ultimo).toBe(false); // nativo: o estado novo basta
  });

  it("no consolidado, troca para a empresa do link", () => {
    mockParams = { empresa: "atual" };
    mockState.consolidatedView = true;
    mockState.company = null;
    mockSwitch.mockReturnValue(new Promise(() => {}));
    montar();
    expect(mockSwitch).toHaveBeenCalledWith("atual");
    expect(ultimo).toBe(true);
  });

  it("já na empresa do link: não chama o switch nem segura a tela", () => {
    mockParams = { empresa: "atual" };
    montar();
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(ultimo).toBe(false);
  });

  it("sem acesso: fica na atual, solta a tela e avisa", async () => {
    mockParams = { empresa: "alheia" };
    mockSwitch.mockRejectedValue(Object.assign(new Error("Sem acesso"), { status: 403 }));
    montar();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(ultimo).toBe(false);
    expect(mockToastInfo).toHaveBeenCalledWith(avisoSemAcesso(403));
  });

  it("sem sessão ainda (vai para o login): não troca; troca quando volta do login (tq-91)", () => {
    mockParams = { empresa: "outra" };
    mockState.token = null;
    mockSwitch.mockReturnValue(new Promise(() => {}));
    const r = montar();
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(ultimo).toBe(false);
    mockState = { ...mockState, token: "novo" };
    act(() => { r.update(<Sonda />); });
    expect(mockSwitch).toHaveBeenCalledTimes(1);
    expect(mockSwitch).toHaveBeenCalledWith("outra");
  });

  it("?empresa=todas com mais de uma empresa: segura a tela e abre o consolidado", () => {
    mockParams = { empresa: "todas" };
    mockSwitch.mockReturnValue(new Promise(() => {}));
    montar();
    expect(mockSwitch).toHaveBeenCalledWith("all");
    expect(ultimo).toBe(true);
  });

  it("?empresa=todas já no consolidado: não troca nem segura a tela", () => {
    mockParams = { empresa: "todas" };
    mockState.consolidatedView = true;
    mockState.company = null;
    montar();
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(ultimo).toBe(false);
  });

  it("?empresa=todas com uma empresa só: ignora (fica na empresa, sem aviso)", () => {
    mockParams = { empresa: "todas" };
    mockState.companyCount = 1;
    montar();
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
    expect(ultimo).toBe(false);
  });

  it("o mesmo id não é tratado duas vezes (o router ainda guarda o parâmetro)", () => {
    mockParams = { empresa: "outra" };
    mockSwitch.mockReturnValue(new Promise(() => {}));
    const r = montar();
    act(() => { r.update(<Sonda />); });
    act(() => { r.update(<Sonda />); });
    expect(mockSwitch).toHaveBeenCalledTimes(1);
  });
});
