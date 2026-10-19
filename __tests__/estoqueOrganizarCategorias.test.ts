// ============================================================
// Estoque -> "Organizar categorias" (tq-28).
//
// O modal antigo de categorias (CategoriesModal) nao era aberto por nada
// e ficou montado em estoque.tsx. A lojista organiza categorias na arvore
// (/catalogo/organizar); o Estoque agora tem o atalho para la. Estes
// testes leem o codigo-fonte (a tela inteira do Estoque e pesada demais
// para renderizar aqui) e guardam:
//   1. o atalho existe e leva a /catalogo/organizar, nas duas larguras;
//   2. o modal aposentado nao volta (arquivo, import, estado);
//   3. o hook ficou so de leitura (sem create/update/remove);
//   4. "Ver planos" do AddCompanyModal vai direto a /(tabs)/planos.
// ============================================================
import fs from "fs";
import path from "path";

const raiz = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("Estoque: atalho Organizar categorias", () => {
  const estoque = raiz("app/(tabs)/estoque.tsx");

  test("o atalho leva a /catalogo/organizar", () => {
    expect(estoque).toContain('router.push("/catalogo/organizar")');
    expect(estoque).toContain("Organizar categorias");
  });

  test("aparece no layout largo e no estreito (375 px)", () => {
    const ocorrencias = estoque.split('testID="estoque-organizar-categorias"').length - 1;
    expect(ocorrencias).toBe(2);
  });
});

describe("CategoriesModal aposentado", () => {
  test("o arquivo do modal nao existe mais", () => {
    expect(fs.existsSync(path.join(__dirname, "..", "components/screens/estoque/CategoriesModal.tsx"))).toBe(false);
  });

  test("estoque.tsx nao importa, nao monta e nao guarda estado do modal", () => {
    const estoque = raiz("app/(tabs)/estoque.tsx");
    expect(estoque).not.toContain("CategoriesModal");
    expect(estoque).not.toContain("categoriesModal");
  });

  test("ninguem mais importa o modal", () => {
    const pastas = ["app", "components", "hooks", "services"];
    const achou: string[] = [];
    const varre = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") varre(p); continue; }
        if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
        if (fs.readFileSync(p, "utf8").includes("CategoriesModal")) achou.push(p);
      }
    };
    pastas.forEach((d) => varre(path.join(__dirname, "..", d)));
    expect(achou).toEqual([]);
  });

  test("useProductCategories ficou so de leitura", () => {
    const hook = raiz("hooks/useProductCategories.ts");
    expect(hook).toContain("categoryNames");
    expect(hook).not.toMatch(/useMutation|create:|update:|remove:/);
  });
});

describe("AddCompanyModal: Ver planos", () => {
  test("vai direto para a tela de planos, nao para Configuracoes", () => {
    const modal = raiz("components/AddCompanyModal.tsx");
    expect(modal).toContain('router.push("/(tabs)/planos")');
    expect(modal).not.toContain('router.push("/configuracoes")');
  });
});
