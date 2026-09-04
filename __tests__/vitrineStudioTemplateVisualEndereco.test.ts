// ============================================================
// O mockup 3D fala pelo endereço da vitrine (QA de 04/09/2026)
//
// Todo fetch da vitrine já usava `enderecoDaApi()` — menos o do template
// visual, que passava pelo cliente genérico do app e caía no nome do
// provedor. Sob a CSP de loja.getaura.com.br o navegador bloqueava a
// chamada, o `.catch` devolvia null e a caneca aparecia como foto plana:
// nenhuma loja mostrava o 3D, e nada acusava erro. Este teste prende o
// endereço ao domínio nosso, como o de enderecoDaApi já faz para o resto.
// ============================================================
import { urlDoTemplateVisual } from "@/components/studio/storefront/visualTemplatePublic";
import { API_DA_AURA } from "@/components/studio/storefront/enderecoDaApi";

describe("o endereço do template visual", () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  });

  test("é o domínio nosso, nunca o do provedor", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const url = urlDoTemplateVisual("aura-qa", "1297684d-6ccc-4039-b465-348738855bbe");
    expect(url).toBe(
      API_DA_AURA + "/storefront/aura-qa/studio/products/1297684d-6ccc-4039-b465-348738855bbe/visual-template"
    );
    expect(url).not.toContain("railway.app");
  });

  test("respeita a variável de ambiente, como o resto da vitrine", () => {
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:3000/api/v1";
    expect(urlDoTemplateVisual("loja", "p1")).toBe(
      "http://localhost:3000/api/v1/storefront/loja/studio/products/p1/visual-template"
    );
  });

  test("escapa o slug e o id", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(urlDoTemplateVisual("a b", "x/y")).toContain("/storefront/a%20b/studio/products/x%2Fy/");
  });
});
