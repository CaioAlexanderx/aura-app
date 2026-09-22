// ============================================================
// Semi-vertical Matcon — chaves de módulo (22/09/2026).
//
// Espelho fiel de __tests__/moduloOtica.test.ts (M0,
// docs/matcon-faseamento-po-ux.md). Regra 3 do CLAUDE.md: toda tela nova
// tem `mod` próprio nos dois mapas e nunca herda o de outra. Este teste
// segura quatro coisas:
//   1. as quatro chaves existem nos dois mapas, com o plano combinado
//      (Orçamentos/Entregas/Profissionais no Negócio; Config no Essencial);
//   2. a umbrella `matcon.access` é a ÚNICA permissão que libera o matcon
//      para um membro — nenhuma outra (pdv, vendas, clientes) vaza;
//   3. override próprio esconde/mostra cada tela sem mexer nas outras.
//
// O toggle pdv_settings.matcon_enabled é filtrado no _layout
// (matconToggle), fora desta função, igual ao os_enabled/otica_enabled.
// Em M0 nenhuma dessas quatro telas existe ainda — este teste cobre só o
// encanamento dos mapas de plano/permissão, que já vale para quando o
// PdvSettingsCard concede o módulo como add-on via module_overrides.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const MODS = ["matcon.orcamentos", "matcon.entregas", "matcon.profissionais", "matcon.compras", "matcon.config"] as const;

describe("módulo Matcon: chaves próprias nos dois mapas", () => {
  test("plano mínimo por tela", () => {
    expect(MODULE_PLAN_MAP["matcon.orcamentos"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.entregas"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.profissionais"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.compras"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.config"]).toBe("essencial");
  });

  test("só matcon.access libera as telas de matcon", () => {
    expect(PERM_TO_MODULES["matcon.access"]).toEqual(expect.arrayContaining([...MODS]));
    Object.keys(PERM_TO_MODULES).filter((k) => k !== "matcon.access").forEach((k) => {
      MODS.forEach((m) => expect(PERM_TO_MODULES[k]).not.toContain(m));
    });
  });
});

describe("módulo Matcon: visibilidade por plano", () => {
  test("Essencial vê só a config; Negócio e Expansão veem tudo", () => {
    const ess = computeVisibleModules("essencial", null, undefined);
    expect(ess.has("matcon.config")).toBe(true);
    expect(ess.has("matcon.orcamentos")).toBe(false);
    expect(ess.has("matcon.entregas")).toBe(false);
    expect(ess.has("matcon.profissionais")).toBe(false);
    for (const plano of ["negocio", "expansao"]) {
      const v = computeVisibleModules(plano, null, undefined);
      MODS.forEach((m) => expect(v.has(m)).toBe(true));
    }
  });

  test("override true vende o matcon como add-on no Essencial", () => {
    const v = computeVisibleModules("essencial", { "matcon.orcamentos": true, "matcon.entregas": true }, undefined);
    expect(v.has("matcon.orcamentos")).toBe(true);
    expect(v.has("matcon.entregas")).toBe(true);
  });

  test("override false esconde só a tela apontada", () => {
    const v = computeVisibleModules("negocio", { "matcon.entregas": false }, undefined);
    expect(v.has("matcon.entregas")).toBe(false);
    expect(v.has("matcon.orcamentos")).toBe(true);
    expect(v.has("matcon.profissionais")).toBe(true);
    expect(v.has("matcon.config")).toBe(true);
  });
});

describe("módulo Matcon: permissão do membro", () => {
  test("dono vê tudo no Negócio", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: true, permissions: null });
    MODS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("membro sem matcon.access não vê o matcon, mesmo com pdv/vendas/clientes", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true, vendas: true, clientes: true } });
    MODS.forEach((m) => expect(v.has(m)).toBe(false));
    expect(v.has("pdv")).toBe(true);
  });

  test("membro com matcon.access vê as quatro telas", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: false, permissions: { "matcon.access": true } });
    MODS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("permissão não vence o plano: matcon.access no Essencial só libera a config", () => {
    const v = computeVisibleModules("essencial", null, { is_owner: false, permissions: { "matcon.access": true } });
    expect(v.has("matcon.config")).toBe(true);
    expect(v.has("matcon.orcamentos")).toBe(false);
  });
});
