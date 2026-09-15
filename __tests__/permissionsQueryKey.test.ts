import { permissionsQueryKey } from "../utils/permissionsQueryKey";

// A query de GET /auth/my-permissions precisa mudar de chave quando o
// contexto do JWT muda (switchCompany), senao o react-query devolve as
// permissoes da empresa anterior ate o staleTime vencer.
describe("permissionsQueryKey", () => {
  test("empresas diferentes geram chaves diferentes", () => {
    expect(permissionsQueryKey("company-a", false)).not.toEqual(permissionsQueryKey("company-b", false));
  });

  test("a mesma empresa gera a mesma chave (cache reaproveitado)", () => {
    expect(permissionsQueryKey("company-a", false)).toEqual(permissionsQueryKey("company-a", false));
  });

  test("consolidado tem chave propria, diferente de qualquer empresa", () => {
    expect(permissionsQueryKey(null, true)).toEqual(["my-permissions", "all"]);
    expect(permissionsQueryKey("company-a", true)).toEqual(["my-permissions", "all"]);
    expect(permissionsQueryKey("company-a", false)).not.toEqual(permissionsQueryKey(null, true));
  });

  test("sem empresa nem consolidado tem chave estavel", () => {
    expect(permissionsQueryKey(null, false)).toEqual(["my-permissions", "none"]);
    expect(permissionsQueryKey(undefined, false)).toEqual(["my-permissions", "none"]);
  });

  test("continua prefixada por my-permissions (invalidate por prefixo segue valendo)", () => {
    expect(permissionsQueryKey("company-a", false)[0]).toBe("my-permissions");
  });
});
