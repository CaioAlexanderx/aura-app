// Aba Conversas (hub_social) abre pela permissao Clientes; o plano continua mandando.
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
import { computeVisibleModules, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const membro = (permissions: Record<string, boolean>) => ({ is_owner: false, permissions });

describe("hub_social por permissão", () => {
  test("Clientes e Agentes dão hub_social", () => {
    expect(PERM_TO_MODULES.clientes).toContain("hub_social");
    expect(PERM_TO_MODULES.agentes).toContain("hub_social");
  });
  test("membro só com Clientes, empresa com hub_social: vê Conversas", () => {
    expect(computeVisibleModules("expansao", null, membro({ clientes: true })).has("hub_social")).toBe(true);
  });
  test("add-on (override) liga hub_social em plano menor", () => {
    expect(computeVisibleModules("negocio", { hub_social: true }, membro({ clientes: true })).has("hub_social")).toBe(true);
  });
  test("empresa sem hub_social: Clientes sozinho não mostra", () => {
    // 27/11/2026: hub_social vale desde o Essencial; só o override desliga.
    expect(computeVisibleModules("essencial", null, membro({ clientes: true })).has("hub_social")).toBe(true);
    expect(computeVisibleModules("negocio", { hub_social: false }, membro({ clientes: true })).has("hub_social")).toBe(false);
    expect(computeVisibleModules("expansao", { hub_social: false }, membro({ clientes: true })).has("hub_social")).toBe(false);
  });
  test("membro só com Agentes continua com hub_social", () => {
    expect(computeVisibleModules("expansao", null, membro({ agentes: true })).has("hub_social")).toBe(true);
  });
  test("membro sem Clientes nem Agentes não vê", () => {
    expect(computeVisibleModules("expansao", null, membro({ pdv: true })).has("hub_social")).toBe(false);
  });
});
