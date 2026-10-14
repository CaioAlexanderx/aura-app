// ============================================================
// Revalidar o /auth/me com a aba aberta (card t2-16, 14/10/2026).
//
// Caso real: a equipe ligou o Studio para a Maria Thais (03/10) e a Talita
// (13/10) e as duas só viram a frente depois de recarregar a página. O app
// carregava plano/frente na abertura e revalidava só no mount de alguns
// layouts (armadilha 1 do CLAUDE.md).
//
// Agora: revalidação periódica + ao voltar o foco da aba, com teto de uma
// chamada por minuto e sem re-render quando nada mudou.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
const mockMe = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { me: (...a: any[]) => mockMe(...a) },
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore, __zerarControleDoMe, JANELA_DO_ME_MS } from "@/stores/auth";
import {
  criarRevalidador, useRevalidarMe, REVALIDAR_INTERVALO_MS, REVALIDAR_MIN_MS,
} from "@/hooks/useRevalidarMe";

const raiz = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

// ── criarRevalidador: a regra de "quando", sem React ─────────
describe("criarRevalidador", () => {
  function montar(extra: any = {}) {
    let t = 1_000_000;
    const revalidar = jest.fn(() => Promise.resolve());
    const r = criarRevalidador({ revalidar, agora: () => t, ...extra });
    return { r, revalidar, avancar: (ms: number) => { t += ms; } };
  }

  test("logo depois da montagem não repete: o layout acabou de revalidar", () => {
    const { r, revalidar } = montar();
    expect(r.tentar()).toBe(false);
    expect(revalidar).not.toHaveBeenCalled();
  });

  test("passado o mínimo, dispara; antes dele, não", async () => {
    const { r, revalidar, avancar } = montar();
    avancar(REVALIDAR_MIN_MS - 1);
    expect(r.tentar()).toBe(false);
    avancar(1);
    expect(r.tentar()).toBe(true);
    expect(revalidar).toHaveBeenCalledTimes(1);
  });

  test("rajada de gatilhos (foco, visibilidade, timer) vira uma chamada só", async () => {
    const { r, revalidar, avancar } = montar();
    avancar(REVALIDAR_MIN_MS + 5);
    const resultados = [r.tentar(), r.tentar(), r.tentar()];
    expect(resultados).toEqual([true, false, false]);
    expect(revalidar).toHaveBeenCalledTimes(1);
  });

  test("com uma chamada em voo não empilha outra, mesmo passado o mínimo", async () => {
    let solta: () => void = () => {};
    const revalidar = jest.fn(() => new Promise<void>((res) => { solta = res; }));
    let t = 0;
    const r = criarRevalidador({ revalidar, agora: () => t, minimoMs: 10 });
    t += 20;
    expect(r.tentar()).toBe(true);
    t += 20;
    expect(r.tentar()).toBe(false);
    solta();
    await Promise.resolve(); await Promise.resolve();
    t += 20;
    expect(r.tentar()).toBe(true);
    expect(revalidar).toHaveBeenCalledTimes(2);
  });

  test("sem sessão (ativo=false) não chama", () => {
    const { r, revalidar, avancar } = montar({ ativo: () => false });
    avancar(REVALIDAR_MIN_MS * 5);
    expect(r.tentar()).toBe(false);
    expect(revalidar).not.toHaveBeenCalled();
  });

  test("erro na revalidação não propaga e libera a próxima", async () => {
    let t = 0;
    const revalidar = jest.fn(() => Promise.reject(new Error("rede")));
    const r = criarRevalidador({ revalidar, agora: () => t, minimoMs: 10 });
    t += 20;
    expect(() => r.tentar()).not.toThrow();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    t += 20;
    expect(r.tentar()).toBe(true);
  });
});

// ── refreshMe: sem piscar ────────────────────────────────────
describe("refreshMe só grava o que mudou", () => {
  const BASE = {
    user: { id: "u1", email: "loja@exemplo.com" },
    company: { id: "c1", plan: "negocio", vertical_active: null, module_overrides: {} },
    consolidated_view: false,
    company_count: 1,
  };
  let agora = 5_000_000;

  beforeEach(() => {
    agora = 5_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => agora);
    mockMe.mockReset();
    __zerarControleDoMe();
    useAuthStore.setState({
      token: "tok", user: BASE.user, company: BASE.company, isStaff: false,
      trialActive: false, trialEndsAt: null, consolidatedView: false, companyCount: 1,
    } as any);
  });
  afterEach(() => { (Date.now as jest.Mock).mockRestore?.(); });

  test("resposta igual: nenhuma notificação aos assinantes e a mesma referência", async () => {
    mockMe.mockResolvedValue(JSON.parse(JSON.stringify(BASE)));
    const antes = useAuthStore.getState().company;
    const ouvinte = jest.fn();
    const cancela = useAuthStore.subscribe(ouvinte);
    await useAuthStore.getState().refreshMe();
    cancela();
    expect(mockMe).toHaveBeenCalledTimes(1);
    expect(ouvinte).not.toHaveBeenCalled();
    expect(useAuthStore.getState().company).toBe(antes);
  });

  test("frente mudada pela Gestão Aura entra no estado", async () => {
    mockMe.mockResolvedValue({
      ...BASE, company: { ...BASE.company, vertical_active: "studio", module_overrides: { canal: true } },
    });
    await useAuthStore.getState().refreshMe();
    expect((useAuthStore.getState().company as any).vertical_active).toBe("studio");
    expect((useAuthStore.getState().company as any).module_overrides).toEqual({ canal: true });
  });

  test("grava só o campo que mudou: user igual mantém a referência", async () => {
    mockMe.mockResolvedValue({ ...BASE, user: { ...BASE.user }, company: { ...BASE.company, plan: "expansao" } });
    const userAntes = useAuthStore.getState().user;
    await useAuthStore.getState().refreshMe();
    expect(useAuthStore.getState().user).toBe(userAntes);
    expect((useAuthStore.getState().company as any).plan).toBe("expansao");
  });

  test("erro de rede mantém o estado e não derruba", async () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockMe.mockRejectedValue(new Error("rede"));
    await expect(useAuthStore.getState().refreshMe()).resolves.toBeUndefined();
    expect(useAuthStore.getState().company).toBe(BASE.company);
    aviso.mockRestore();
  });

  test("a janela de 3 s do hydrate continua valendo", () => {
    expect(JANELA_DO_ME_MS).toBe(3000);
  });
});

// ── o hook, com a aba de verdade (jsdom) ─────────────────────
describe("useRevalidarMe", () => {
  function Sonda() { useRevalidarMe(); return null; }
  let agora = 9_000_000;
  let visibilidade: "visible" | "hidden" = "visible";

  beforeEach(() => {
    jest.useFakeTimers();
    agora = 9_000_000;
    visibilidade = "visible";
    jest.spyOn(Date, "now").mockImplementation(() => agora);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilidade });
    mockMe.mockReset();
    mockMe.mockResolvedValue({
      user: { id: "u1" }, company: { id: "c1", plan: "negocio" }, consolidated_view: false, company_count: 1,
    });
    __zerarControleDoMe();
    useAuthStore.setState({ token: "tok", user: { id: "u1" }, company: { id: "c1" }, switching: false } as any);
  });
  afterEach(() => {
    jest.useRealTimers();
    (Date.now as jest.Mock).mockRestore?.();
  });

  async function passar(ms: number) {
    agora += ms;
    await act(async () => { jest.advanceTimersByTime(ms); });
  }

  test("o timer revalida com a aba visível, e só depois do mínimo", async () => {
    let arvore: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<Sonda />); });
    await passar(REVALIDAR_INTERVALO_MS);
    expect(mockMe).toHaveBeenCalledTimes(1);
    await passar(REVALIDAR_INTERVALO_MS);
    expect(mockMe).toHaveBeenCalledTimes(2);
    await act(async () => { arvore!.unmount(); });
  });

  test("aba escondida não revalida; ao voltar o foco, revalida na hora", async () => {
    let arvore: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<Sonda />); });
    visibilidade = "hidden";
    await passar(REVALIDAR_INTERVALO_MS * 3);
    expect(mockMe).not.toHaveBeenCalled();

    visibilidade = "visible";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(mockMe).toHaveBeenCalledTimes(1);

    // foco logo em seguida: dentro do mínimo, não repete
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(mockMe).toHaveBeenCalledTimes(1);
    await act(async () => { arvore!.unmount(); });
  });

  test("sem token não escuta nada; ao desmontar, para de revalidar", async () => {
    useAuthStore.setState({ token: null } as any);
    let arvore: renderer.ReactTestRenderer;
    await act(async () => { arvore = renderer.create(<Sonda />); });
    await passar(REVALIDAR_INTERVALO_MS * 2);
    expect(mockMe).not.toHaveBeenCalled();
    await act(async () => { arvore!.unmount(); });

    useAuthStore.setState({ token: "tok" } as any);
    await act(async () => { arvore = renderer.create(<Sonda />); });
    await act(async () => { arvore!.unmount(); });
    await passar(REVALIDAR_INTERVALO_MS * 2);
    expect(mockMe).not.toHaveBeenCalled();
  });
});

// ── fonte ────────────────────────────────────────────────────
describe("fonte", () => {
  test("o layout raiz monta o hook uma vez, no AuthGuard", () => {
    const src = raiz("app/_layout.tsx");
    expect(src).toContain('import { useRevalidarMe } from "@/hooks/useRevalidarMe";');
    expect((src.match(/useRevalidarMe\(\)/g) || []).length).toBe(1);
    expect(src.indexOf("useRevalidarMe()")).toBeGreaterThan(src.indexOf("function AuthGuard"));
  });

  test("o hook escuta visibilitychange, focus e AppState, e tem intervalo", () => {
    const src = raiz("hooks/useRevalidarMe.ts");
    expect(src).toContain('"visibilitychange"');
    expect(src).toContain('"focus"');
    expect(src).toContain("AppState.addEventListener");
    expect(src).toContain("setInterval");
    expect(REVALIDAR_MIN_MS).toBe(60_000);
  });
});
