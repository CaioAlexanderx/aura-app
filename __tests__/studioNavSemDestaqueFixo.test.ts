// ============================================================
// O menu do Studio só destaca a rota atual (04/09/2026)
//
// O "Caixa / PDV" nasceu como "porta primária": barra, fundo e texto em
// navy mesmo quando inativo. Visto de fora, era um item permanentemente
// selecionado ao lado do item ativo de verdade — o Caio reportou exatamente
// isso: "fica sempre em azul, como se estivesse selecionado".
//
// A regra que fica: nenhum item de navegação carrega ênfase própria. A
// única fonte de destaque é a rota atual, decidida por quem renderiza.
// ============================================================
import { STUDIO_NAV } from "@/components/studio/StudioShell/nav";
import { GROUPS } from "@/components/studio/StudioShell/types";

describe("nenhum item de navegação nasce com cara de selecionado", () => {
  test("a fonte única de nav não declara destaque fixo em item algum", () => {
    for (const item of STUDIO_NAV) {
      expect((item as any).primary).toBeUndefined();
    }
  });

  test("os grupos derivados também não carregam o campo", () => {
    for (const g of GROUPS) {
      for (const c of g.children) {
        expect((c as any).primary).toBeUndefined();
      }
    }
  });

  test("o Caixa / PDV continua no menu, igual aos vizinhos", () => {
    // Normalizar não é esconder: o item fica, só perde a ênfase.
    const caixa = STUDIO_NAV.find((i) => i.route === "/studio/vendas/caixa");
    expect(caixa?.label).toBe("Caixa / PDV");
    expect(caixa?.group).toBe("VENDAS");
  });
});

describe("os renderizadores não conhecem mais o destaque fixo", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..", "components", "studio", "StudioShell");

  test.each(["Sidebar.tsx", "MobileMenuSheet.tsx", "types.ts"])(
    "%s não lê `primary` de item de nav",
    (arquivo) => {
      const fonte = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
      // `c.primary`/`t.primary`/`tk.primary` é a COR navy dos tokens e
      // continua existindo para outros usos; o que não pode voltar é o
      // campo do item de nav e a prop que o levava até o botão.
      expect(fonte).not.toMatch(/\bitem\.primary\b|primary=\{/);
      expect(fonte).not.toMatch(/primary\?: boolean/);
    }
  );
});
