// ============================================================
// Interruptores da Equipe: todas as telas da loja (hotfix 24/11/2026).
//
// Pedido do Caio: "a ideia do toggle dos funcionários é ter todas as janelas
// disponíveis para a loja escolher o que o funcionário vai ver". Gatilho:
// funcionário novo da Finesse sem a tela Vendas, porque a chave "vendas" não
// tinha interruptor em components/MembersSection.tsx. O que este teste segura:
//   a. paridade: toda chave de PERM_TO_MODULES tem interruptor ou está em
//      PERMISSOES_SEM_TOGGLE com o motivo (tela nova não volta a nascer sem);
//   b. Vendas aparece, liga e desliga;
//   c. chave de plano que a loja não tem não aparece (Essencial: some);
//   d. onlyWhen continua filtrando as frentes;
//   e. ninguém que já é membro muda: chave ausente = tela fechada, e os
//      modelos prontos só ligam chaves que têm interruptor.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

const mockPdv: { settings: any } = { settings: {} };
const mockRefreshMe = jest.fn(() => Promise.resolve());

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
jest.mock("@/components/ContratarAcessoBotao", () => ({ ContratarAcessoBotao: () => null }));
jest.mock("@/hooks/useMembers", () => ({ useMembers: jest.fn() }));
jest.mock("@/hooks/useMemberAudit", () => ({ useMemberAudit: jest.fn(), AUDIT_LABELS: {} }));
jest.mock("@/hooks/useMemberTemplates", () => ({ useMemberTemplates: jest.fn() }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockPdv.settings, isLoading: false }) }));
jest.mock("@/hooks/usePersonalizadosLiberado", () => ({ usePersonalizadosLiberado: () => true }));
jest.mock("@/stores/auth", () => {
  const { create } = jest.requireActual("zustand");
  const useAuthStore = create(() => ({
    company: { id: "c1", plan: "essencial", module_overrides: {}, vertical_active: null },
    consolidatedView: false, user: { id: "u1" }, token: "t",
    refreshMe: () => mockRefreshMe(),
  }));
  return { useAuthStore };
});

import { useAuthStore } from "@/stores/auth";
import { computeVisibleModules, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import {
  MODULE_GROUPS, PERMISSOES_SEM_TOGGLE, BUILT_IN_TEMPLATES, togglesVisiveis, ModuleGroupSelector,
} from "@/components/MembersSection";

const FRENTES_DESLIGADAS = { otica: false, matcon: false, personalizados: false };
const CHAVES_DOS_TOGGLES = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

function chavesVisiveis(plano: string, frentes: Record<string, boolean> = FRENTES_DESLIGADAS, overrides: Record<string, boolean> = {}) {
  return togglesVisiveis(computeVisibleModules(plano, overrides, null), frentes).flatMap((g) => g.modules.map((m) => m.key));
}

function empresa(parcial: Record<string, any>) {
  (useAuthStore as any).setState({ company: { id: "c1", plan: "essencial", module_overrides: {}, vertical_active: null, ...parcial } });
}

async function montar(value: Record<string, boolean>, onChange: (v: Record<string, boolean>) => void) {
  let arvore!: renderer.ReactTestRenderer;
  await act(async () => { arvore = renderer.create(<ModuleGroupSelector value={value} onChange={onChange} />); });
  return arvore;
}

function interruptor(arvore: renderer.ReactTestRenderer, chave: string) {
  return arvore.root.findAll((n) => n.props.testID === "toggle-" + chave && typeof n.props.onValueChange === "function", { deep: false });
}

function textos(arvore: renderer.ReactTestRenderer): string[] {
  return arvore.root.findAll((n) => typeof n.props.children === "string").map((n) => n.props.children as string);
}

beforeEach(() => {
  mockPdv.settings = {};
  empresa({});
});

describe("a. paridade entre PERM_TO_MODULES e os interruptores", () => {
  test("toda chave que abre tela tem interruptor ou motivo para não ter", () => {
    const semInterruptor = Object.keys(PERM_TO_MODULES).filter(
      (k) => !CHAVES_DOS_TOGGLES.includes(k) && !(k in PERMISSOES_SEM_TOGGLE),
    );
    expect(semInterruptor).toEqual([]);
  });

  test("as exceções existem em PERM_TO_MODULES e não têm interruptor", () => {
    Object.keys(PERMISSOES_SEM_TOGGLE).forEach((k) => {
      expect(PERM_TO_MODULES[k]).toBeDefined();
      expect(CHAVES_DOS_TOGGLES).not.toContain(k);
    });
  });

  test("todo interruptor que não é derivado abre ao menos uma tela", () => {
    MODULE_GROUPS.flatMap((g) => g.modules).filter((m) => !m.derived).forEach((m) => {
      expect({ chave: m.key, telas: (PERM_TO_MODULES[m.key] || []).length > 0 }).toEqual({ chave: m.key, telas: true });
    });
  });

  test("chave sem repetir entre grupos", () => {
    expect(new Set(CHAVES_DOS_TOGGLES).size).toBe(CHAVES_DOS_TOGGLES.length);
  });
});

describe("b. Vendas aparece, liga e desliga", () => {
  test("está no Essencial, logo depois do Caixa", () => {
    const operacao = togglesVisiveis(computeVisibleModules("essencial", {}, null), FRENTES_DESLIGADAS)[0];
    const chaves = operacao.modules.map((m) => m.key);
    expect(chaves.indexOf("vendas")).toBe(chaves.indexOf("pdv") + 1);
  });

  test("liga e desliga pelo interruptor", async () => {
    const onChange = jest.fn();
    const desligado = await montar({ painel: true, pdv: true }, onChange);
    const [sw] = interruptor(desligado, "vendas");
    expect(sw.props.value).toBe(false);
    act(() => { sw.props.onValueChange(true); });
    expect(onChange).toHaveBeenLastCalledWith({ painel: true, pdv: true, vendas: true });
    desligado.unmount();

    const ligado = await montar({ painel: true, pdv: true, vendas: true }, onChange);
    const [sw2] = interruptor(ligado, "vendas");
    expect(sw2.props.value).toBe(true);
    act(() => { sw2.props.onValueChange(false); });
    expect(onChange).toHaveBeenLastCalledWith({ painel: true, pdv: true, vendas: false });
    ligado.unmount();
  });

  test("a dica fala do Crediário só onde a loja tem Crediário", async () => {
    const essencial = await montar({}, jest.fn());
    expect(textos(essencial)).toContain("Histórico de vendas, cancelamento e fechamentos de caixa");
    expect(textos(essencial).some((t) => t.includes("Crediário"))).toBe(false);
    essencial.unmount();

    empresa({ plan: "negocio" });
    const negocio = await montar({}, jest.fn());
    expect(textos(negocio)).toContain("Histórico de vendas, cancelamento, fechamentos de caixa e Crediário");
    negocio.unmount();
  });

  test("ligar Vendas abre Vendas e, no Negócio, o Crediário", () => {
    const v = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { painel: true, vendas: true } });
    expect(v.has("vendas")).toBe(true);
    expect(v.has("crediario")).toBe(true);
    expect(v.has("pdv")).toBe(false);
  });
});

describe("c. só aparece o que o plano da loja tem", () => {
  test("Essencial: tudo de hoje continua, Agentes e Personalizados somem", () => {
    const chaves = chavesVisiveis("essencial", { otica: false, matcon: false, personalizados: true });
    expect(chaves).toEqual([
      "painel", "pdv", "vendas", "estoque", "estoque_consulta", "clientes",
      "financeiro", "relatorios", "folha", "custos", "configuracoes",
    ]);
  });

  test("Essencial: o grupo Crescimento não aparece nem vazio", async () => {
    const arvore = await montar({}, jest.fn());
    expect(textos(arvore)).not.toContain("Crescimento");
    expect(interruptor(arvore, "agentes")).toHaveLength(0);
    arvore.unmount();
  });

  test("Negócio: Personalizados aparece com a frente ligada; Agentes ainda não", () => {
    const chaves = chavesVisiveis("negocio", { otica: false, matcon: false, personalizados: true });
    expect(chaves).toContain("personalizados.access");
    expect(chaves).not.toContain("agentes");
  });

  test("Expansão: Agentes aparece no grupo Crescimento", async () => {
    empresa({ plan: "expansao" });
    const arvore = await montar({}, jest.fn());
    expect(textos(arvore)).toContain("Crescimento");
    expect(interruptor(arvore, "agentes")).toHaveLength(1);
    arvore.unmount();
  });

  test("override da loja vale como no menu: liberado aparece, escondido some", () => {
    expect(chavesVisiveis("negocio", FRENTES_DESLIGADAS, { agentes: true })).toContain("agentes");
    expect(chavesVisiveis("essencial", FRENTES_DESLIGADAS, { pdv: false, os: false, cupons: false })).not.toContain("pdv");
  });
});

describe("d. onlyWhen continua filtrando as frentes", () => {
  test("Ótica e Matcon só com a frente ligada", () => {
    expect(chavesVisiveis("essencial")).not.toContain("otica.access");
    expect(chavesVisiveis("essencial")).not.toContain("matcon.access");
    expect(chavesVisiveis("essencial", { otica: true, matcon: false, personalizados: false })).toContain("otica.access");
    expect(chavesVisiveis("essencial", { otica: false, matcon: true, personalizados: false })).toContain("matcon.access");
  });

  test("Personalizados só com a frente ligada, mesmo no Negócio", () => {
    expect(chavesVisiveis("negocio")).not.toContain("personalizados.access");
  });

  test("no seletor, lendo o pdv_settings da loja", async () => {
    mockPdv.settings = { otica_enabled: true };
    const comOtica = await montar({}, jest.fn());
    expect(interruptor(comOtica, "otica.access")).toHaveLength(1);
    expect(interruptor(comOtica, "matcon.access")).toHaveLength(0);
    comOtica.unmount();
  });
});

describe("e. ninguém que já é membro muda", () => {
  test("membro sem a chave vendas gravada continua sem Vendas", () => {
    const v = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { painel: true, pdv: true, clientes: true } });
    expect(v.has("vendas")).toBe(false);
    expect(v.has("crediario")).toBe(false);
    expect(v.has("pdv")).toBe(true);
  });

  test("abrir o seletor não liga nada sozinho", async () => {
    const onChange = jest.fn();
    const arvore = await montar({ painel: true, pdv: true }, onChange);
    expect(onChange).not.toHaveBeenCalled();
    expect(interruptor(arvore, "vendas")[0].props.value).toBe(false);
    arvore.unmount();
  });

  test("modelos prontos: Gerente leva Vendas, Caixa não, e só ligam chaves com interruptor", () => {
    const porChave = Object.fromEntries(BUILT_IN_TEMPLATES.map((t) => [t.key, t.permissions]));
    expect(porChave.gerente?.vendas).toBe(true);
    expect(porChave.caixa?.vendas).toBeUndefined();
    BUILT_IN_TEMPLATES.forEach((t) => {
      Object.keys(t.permissions || {}).forEach((k) => expect(CHAVES_DOS_TOGGLES).toContain(k));
    });
  });
});
