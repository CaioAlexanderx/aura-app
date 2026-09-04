// ============================================================
// O endereço da vitrine (04/09/2026)
//
// A vitrine vivia em `app.getaura.com.br/cardapio/studio/<slug>` — o host
// do PAINEL, com uma palavra que faz loja de caneca parecer restaurante —
// enquanto o painel copiava e divulgava `loja.getaura.com.br/<slug>`, que
// servia a OUTRA loja da mesma empresa.
//
// A decisão: empresa em modo Studio tem uma loja só, em
// `loja.getaura.com.br/<slug>`. O backend serve a vitrine ali; o app
// ganhou uma rota na raiz que casa com esse caminho.
// ============================================================
import { slugDaVitrine, recadoInjetado } from "@/components/studio/storefront/slugDaVitrine";
import { studioStorefrontUrl, studioStorefrontLabel } from "@/utils/storefrontUrl";

describe("o endereço que a lojista divulga", () => {
  test("é a loja, sem sufixo nenhum", () => {
    expect(studioStorefrontUrl("sheid-mania")).toBe("https://loja.getaura.com.br/sheid-mania");
    expect(studioStorefrontLabel("sheid-mania")).toBe("loja.getaura.com.br/sheid-mania");
  });

  test("não sobrou nada de 'cardapio' nem do host do painel", () => {
    const url = studioStorefrontUrl("x");
    expect(url).not.toContain("cardapio");
    expect(url).not.toContain("app.getaura");
  });

  test("slug com caractere estranho não escapa da URL", () => {
    expect(studioStorefrontUrl("a b/c")).toBe("https://loja.getaura.com.br/a%20b%2Fc");
  });
});

describe("qual loja abrir", () => {
  // O jest roda em jsdom: `window` ja existe. Trocar o global inteiro nao
  // muda o que o modulo enxerga — o que se mexe e a propriedade.
  afterEach(() => { delete (window as any).__AURA_VITRINE__; });

  test("sem recado do servidor, vale o caminho", () => {
    expect(slugDaVitrine("sheid-mania", null)).toBe("sheid-mania");
  });

  test("o recado do servidor vence o caminho", () => {
    // É o que o servidor SABE. Sobrevive a qualquer diferença entre o
    // endereço visível e a rota que casou.
    expect(slugDaVitrine("outra", { slug: "sheid-mania" })).toBe("sheid-mania");
  });

  test("recado vazio ou sem slug cai no caminho", () => {
    expect(slugDaVitrine("sheid-mania", {})).toBe("sheid-mania");
    expect(slugDaVitrine("sheid-mania", { slug: "   " })).toBe("sheid-mania");
    expect(slugDaVitrine("sheid-mania", { slug: 42 })).toBe("sheid-mania");
  });

  test("normaliza como a API espera", () => {
    expect(slugDaVitrine("  Sheid-Mania  ", null)).toBe("sheid-mania");
    expect(slugDaVitrine("x", { slug: " SHEID-MANIA " })).toBe("sheid-mania");
  });

  test("sem loja nenhuma, devolve vazio em vez de pedir /storefront//", () => {
    expect(slugDaVitrine(undefined, null)).toBe("");
    expect(slugDaVitrine(null, null)).toBe("");
  });

  test("lê o recado do window quando existe", () => {
    (window as any).__AURA_VITRINE__ = { slug: "sheid-mania" };
    expect(recadoInjetado()).toEqual({ slug: "sheid-mania" });
    expect(slugDaVitrine("qualquer")).toBe("sheid-mania");
  });

  test("window sem o recado não quebra", () => {
    expect(recadoInjetado()).toBeNull();
    expect(slugDaVitrine("sheid-mania")).toBe("sheid-mania");
  });
});

describe("as duas rotas abrem a mesma tela", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..");

  test("a rota pública e a antiga montam PaginaDaVitrine", () => {
    // Duplicar a tela seria a quinta cópia da mesma coisa neste produto.
    for (const rota of ["app/[slug].tsx", "app/cardapio/studio/[slug].tsx"]) {
      const fonte = fs.readFileSync(path.join(RAIZ, rota), "utf8");
      expect(fonte).toContain("<PaginaDaVitrine slug={slugDaVitrine(params.slug)} />");
    }
  });

  test("a vitrine pública passa pelo guarda de autenticação", () => {
    // Verificado no ar em 04/09: sem isto, `app.getaura.com.br/<slug>`
    // caía na tela de login. O guarda libera por PRIMEIRO SEGMENTO, e o
    // segmento dinâmico da raiz chega como o literal "[slug]" — uma
    // loja aberta por quem não tem conta não pode pedir senha.
    const layout = fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8");
    expect(layout).toContain('segments.length === 1 && segments[0] === "[slug]"');
    expect(layout).toContain("onVitrinePublica ||");
  });

  test("a tela mora em componente, não na rota", () => {
    const tela = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/PaginaDaVitrine.tsx"), "utf8");
    expect(tela).toContain("export function PaginaDaVitrine({ slug }");
    // Quem lê a rota é quem monta; a tela não pode depender do caminho.
    expect(tela).not.toContain("useLocalSearchParams");
  });
});
