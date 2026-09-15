// ============================================================
// Semi-vertical Ótica — chaves de módulo (15/09/2026).
//
// Regra 3 do CLAUDE.md: toda tela nova tem `mod` próprio nos dois mapas e
// nunca herda o de outra. Este teste segura três coisas:
//   1. as três chaves existem nos dois mapas, com o plano combinado
//      (Laboratório e Receitas no Negócio; Config no Essencial);
//   2. a umbrella `otica.access` é a ÚNICA permissão que libera a ótica
//      para um membro — nenhuma outra (pdv, vendas, clientes) vaza;
//   3. override próprio esconde/mostra cada tela sem mexer nas outras.
//
// O toggle pdv_settings.otica_enabled é filtrado no _layout (oticaToggle),
// fora desta função, igual ao os_enabled.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const MODS = ["otica.laboratorio", "otica.receitas", "otica.config"] as const;

describe("módulo Ótica: chaves próprias nos dois mapas", () => {
  test("plano mínimo por tela", () => {
    expect(MODULE_PLAN_MAP["otica.laboratorio"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["otica.receitas"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["otica.config"]).toBe("essencial");
  });

  test("só otica.access libera as telas de ótica", () => {
    expect(PERM_TO_MODULES["otica.access"]).toEqual(expect.arrayContaining([...MODS]));
    Object.keys(PERM_TO_MODULES).filter((k) => k !== "otica.access").forEach((k) => {
      MODS.forEach((m) => expect(PERM_TO_MODULES[k]).not.toContain(m));
    });
  });
});

describe("módulo Ótica: visibilidade por plano", () => {
  test("Essencial vê só a config; Negócio e Expansão veem tudo", () => {
    const ess = computeVisibleModules("essencial", null, undefined);
    expect(ess.has("otica.config")).toBe(true);
    expect(ess.has("otica.laboratorio")).toBe(false);
    expect(ess.has("otica.receitas")).toBe(false);
    for (const plano of ["negocio", "expansao"]) {
      const v = computeVisibleModules(plano, null, undefined);
      MODS.forEach((m) => expect(v.has(m)).toBe(true));
    }
  });

  test("override true vende a ótica como add-on no Essencial", () => {
    const v = computeVisibleModules("essencial", { "otica.laboratorio": true, "otica.receitas": true }, undefined);
    expect(v.has("otica.laboratorio")).toBe(true);
    expect(v.has("otica.receitas")).toBe(true);
  });

  test("override false esconde só a tela apontada", () => {
    const v = computeVisibleModules("negocio", { "otica.receitas": false }, undefined);
    expect(v.has("otica.receitas")).toBe(false);
    expect(v.has("otica.laboratorio")).toBe(true);
    expect(v.has("otica.config")).toBe(true);
  });
});

describe("módulo Ótica: permissão do membro", () => {
  test("dono vê tudo no Negócio", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: true, permissions: null });
    MODS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("membro sem otica.access não vê a ótica, mesmo com pdv/vendas/clientes", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true, vendas: true, clientes: true } });
    MODS.forEach((m) => expect(v.has(m)).toBe(false));
    expect(v.has("pdv")).toBe(true);
  });

  test("membro com otica.access vê as três telas", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: false, permissions: { "otica.access": true } });
    MODS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("permissão não vence o plano: otica.access no Essencial só libera a config", () => {
    const v = computeVisibleModules("essencial", null, { is_owner: false, permissions: { "otica.access": true } });
    expect(v.has("otica.config")).toBe(true);
    expect(v.has("otica.laboratorio")).toBe(false);
  });
});
