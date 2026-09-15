// ============================================================
// Modulo proprio "os" (Ordem de Servico) — 14/09/2026.
//
// O item /os do NAV usava mod "pdv" emprestado (armadilha 3 do CLAUDE.md).
// A troca para "os" NAO pode mudar quem ve a OS. Este teste segura isso
// varrendo a matriz inteira de entradas que decidem visibilidade:
// plano x override do pdv x permissao do membro — e exigindo que "os"
// saia visivel exatamente quando "pdv" sai.
//
// O toggle pdv_settings.os_enabled continua sendo filtrado no _layout,
// fora desta funcao, e nao mudou.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const PLANOS = [undefined, "essencial", "negocio", "expansao", "plano_desconhecido"];
const OVERRIDES_PDV: Array<Record<string, boolean> | null> = [null, {}, { pdv: true }, { pdv: false }];
const PERMS: any[] = [
  undefined,                                          // /auth/my-permissions ainda carregando
  { is_owner: true, permissions: null },              // dono
  { is_owner: false, permissions: null },             // membro sem objeto de permissao
  { is_owner: false, permissions: { pdv: true } },
  { is_owner: false, permissions: { pdv: false } },
  { is_owner: false, permissions: { painel: true, financeiro: true } },
  { is_owner: false, permissions: { vendas: true } }, // vendas nao da acesso ao Caixa
];

describe("modulo os tem a mesma visibilidade que o pdv tinha", () => {
  test("registrado nos dois mapas, com o plano minimo do pdv", () => {
    expect(MODULE_PLAN_MAP.os).toBe(MODULE_PLAN_MAP.pdv);
    expect(PERM_TO_MODULES.pdv).toContain("os");
    // nenhuma outra permissao passa a liberar a OS
    const outras = Object.keys(PERM_TO_MODULES).filter((k) => k !== "pdv");
    outras.forEach((k) => expect(PERM_TO_MODULES[k]).not.toContain("os"));
  });

  for (const plano of PLANOS) {
    for (const ov of OVERRIDES_PDV) {
      for (const perm of PERMS) {
        test(`plano=${plano} overrides=${JSON.stringify(ov)} perms=${JSON.stringify(perm)}`, () => {
          const v = computeVisibleModules(plano, ov, perm);
          expect(v.has("os")).toBe(v.has("pdv"));
        });
      }
    }
  }

  test("override proprio os:false esconde so a OS, sem mexer no Caixa", () => {
    const v = computeVisibleModules("essencial", { os: false }, undefined);
    expect(v.has("os")).toBe(false);
    expect(v.has("pdv")).toBe(true);
  });

  test("override proprio os:true vence o pdv:false herdado", () => {
    const v = computeVisibleModules("essencial", { pdv: false, os: true }, undefined);
    expect(v.has("os")).toBe(true);
    expect(v.has("pdv")).toBe(false);
  });
});
