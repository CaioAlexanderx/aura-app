// ============================================================
// Modulos proprios que sairam de dentro do "pdv" — 14/09/2026.
//
// Os itens /os (Ordem de Servico) e /cupons do NAV usavam mod "pdv"
// emprestado (armadilha 3 do CLAUDE.md). A troca para chaves proprias NAO
// pode mudar quem ve cada tela. Este teste segura isso varrendo a matriz
// inteira de entradas que decidem visibilidade:
// plano x override do pdv x permissao do membro — e exigindo que cada chave
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

const MODULOS = ["os", "cupons"];

for (const modulo of MODULOS) {
  describe(`modulo ${modulo} tem a mesma visibilidade que o pdv tinha`, () => {
    test("registrado nos dois mapas, com o plano minimo do pdv", () => {
      expect(MODULE_PLAN_MAP[modulo]).toBe(MODULE_PLAN_MAP.pdv);
      expect(PERM_TO_MODULES.pdv).toContain(modulo);
      // nenhuma outra permissao passa a liberar o modulo
      const outras = Object.keys(PERM_TO_MODULES).filter((k) => k !== "pdv");
      outras.forEach((k) => expect(PERM_TO_MODULES[k]).not.toContain(modulo));
    });

    for (const plano of PLANOS) {
      for (const ov of OVERRIDES_PDV) {
        for (const perm of PERMS) {
          test(`plano=${plano} overrides=${JSON.stringify(ov)} perms=${JSON.stringify(perm)}`, () => {
            const v = computeVisibleModules(plano, ov, perm);
            expect(v.has(modulo)).toBe(v.has("pdv"));
          });
        }
      }
    }

    test(`override proprio ${modulo}:false esconde so ele, sem mexer no Caixa`, () => {
      const v = computeVisibleModules("essencial", { [modulo]: false }, undefined);
      expect(v.has(modulo)).toBe(false);
      expect(v.has("pdv")).toBe(true);
    });

    test(`override proprio ${modulo}:true vence o pdv:false herdado`, () => {
      const v = computeVisibleModules("essencial", { pdv: false, [modulo]: true }, undefined);
      expect(v.has(modulo)).toBe(true);
      expect(v.has("pdv")).toBe(false);
    });
  });
}

test("os e cupons sao independentes entre si", () => {
  const semOs = computeVisibleModules("essencial", { os: false }, undefined);
  expect(semOs.has("cupons")).toBe(true);
  const semCupons = computeVisibleModules("essencial", { cupons: false }, undefined);
  expect(semCupons.has("os")).toBe(true);
});
