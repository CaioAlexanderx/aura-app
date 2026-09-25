// ============================================================
// O tema da vitrine Studio vale na vitrine INTEIRA (S1 · 03/09/2026)
//
// `montarTema` existe desde 19/08/2026 e estava ligado em 3 dos 30
// componentes. Os outros 27 liam a constante `T` — azul-marinho #1E3A8A
// e magenta #EC4899 cravados. Da segunda tela em diante, a cliente
// entrava na loja da lojista e comprava numa loja da Aura. O cabeçalho do
// StoreNav registrava isso como "fase 03, ainda não feita".
//
// O que este teste guarda:
//  1. a superfície nova (papel quente) existe e é a do Studio;
//  2. a ponte paletaDaVitrine traduz a paleta antiga sem inventar cor;
//  3. a marca continua legível como texto E como preenchimento, para
//     QUALQUER cor que a lojista digite — inclusive o quase-preto real
//     da Sheid Mania e um amarelo-limão;
//  4. nenhum componente da vitrine importa a paleta congelada de volta.
// ============================================================
import fs from "fs";
import path from "path";
import {
  AURA, SUPERFICIE, montarTema, paletaDaVitrine, contraste,
  type ModoVitrine,
} from "@/components/studio/storefront/theme";

const RAIZ = path.join(__dirname, "..");
const VITRINE = path.join(RAIZ, "components/studio/storefront");
const AA = 4.5;

/** Cores reais de lojas publicadas, mais os extremos que quebram regra. */
const CORES = [
  "#1a1612", // Sheid Mania — quase preto
  "#6B4E1E", // a cor do handoff
  "#1E3A8A", // o azul-marinho que era cravado
  "#EC4899", // o magenta que era cravado
  "#EAFF00", // amarelo-limão: reprova com branco E com preto
  "#FFFFFF",
  "#000000",
];

describe("a superfície papel", () => {
  test("existe, e é papel quente — não o claro violeta da Aura", () => {
    expect(SUPERFICIE.papel).toBeDefined();
    expect(SUPERFICIE.papel.bg).toBe("#FBF8F3");
    expect(SUPERFICIE.papel.bg2).toBe("#FFFFFF");
    // O `claro` continua existindo e continua violeta: a MiniLoja do
    // painel monta o tema pelo mesmo motor, e trocá-lo mudaria a cara
    // dela sem ninguém ter pedido.
    expect(SUPERFICIE.claro.bg).toBe(AURA.bgClaro);
    expect(SUPERFICIE.papel.bg).not.toBe(SUPERFICIE.claro.bg);
  });

  test("os três modos têm os mesmos degraus de tinta", () => {
    const chaves = ["bg", "bg2", "bg3", "bg4", "ink", "ink2", "ink3", "ink4", "border"];
    (Object.keys(SUPERFICIE) as ModoVitrine[]).forEach((modo) => {
      chaves.forEach((k) => {
        expect(typeof (SUPERFICIE[modo] as any)[k]).toBe("string");
      });
    });
  });
});

describe("paletaDaVitrine — a ponte", () => {
  test("entrega todas as chaves que os componentes usavam", () => {
    const p = paletaDaVitrine(montarTema("#6B4E1E", "papel"));
    ["bg", "card", "border", "ink", "ink2", "ink3", "ink4",
     "primary", "primaryTexto", "sobrePrimary", "accent",
     "green", "amber", "red"].forEach((k) => {
      expect((p as any)[k]).toBeTruthy();
    });
  });

  test("nenhuma cor sai inventada: tudo vem do tema", () => {
    const tema = montarTema("#6B4E1E", "papel");
    const p = paletaDaVitrine(tema);
    expect(p.bg).toBe(tema.bg);
    expect(p.card).toBe(tema.bg2);
    expect(p.border).toBe(tema.border);
    expect(p.primary).toBe(tema.marcaFill);
    expect(p.primaryTexto).toBe(tema.marcaTexto);
    expect(p.sobrePrimary).toBe(tema.sobreMarca);
  });

  test("o magenta fixo do Studio deixou de ser o destaque", () => {
    // Numa vitrine white-label a loja tem UMA cor, e o destaque é ela.
    const p = paletaDaVitrine(montarTema("#6B4E1E", "papel"));
    expect(p.accent).not.toBe("#EC4899");
    expect(p.accent).toBe(paletaDaVitrine(montarTema("#6B4E1E", "papel")).primaryTexto);
  });
});

describe("legibilidade — a regra de ouro do motor", () => {
  test.each(CORES)("%s: o texto da marca passa em 4.5:1 no papel", (cor) => {
    const p = paletaDaVitrine(montarTema(cor, "papel"));
    expect(contraste(p.primaryTexto, p.bg)).toBeGreaterThanOrEqual(AA);
  });

  test.each(CORES)("%s: o botão cheio é legível com a tinta dele", (cor) => {
    const p = paletaDaVitrine(montarTema(cor, "papel"));
    expect(contraste(p.primary, p.sobrePrimary)).toBeGreaterThanOrEqual(AA);
  });

  test.each(CORES)("%s: o texto comum lê no fundo e no cartão", (cor) => {
    const p = paletaDaVitrine(montarTema(cor, "papel"));
    expect(contraste(p.ink, p.bg)).toBeGreaterThanOrEqual(AA);
    expect(contraste(p.ink, p.card)).toBeGreaterThanOrEqual(AA);
  });

  test("o quase-preto da Sheid sobrevive no papel, que é o motivo do modo", () => {
    // No escuro ele viraria cinza para ser legível — legibilidade salva,
    // identidade perdida. No papel ele continua sendo ele.
    const papel = montarTema("#1a1612", "papel");
    expect(papel.marcaTexto.toLowerCase()).toBe("#1a1612");
    const escuro = montarTema("#1a1612", "escuro");
    expect(escuro.marcaTexto.toLowerCase()).not.toBe("#1a1612");
  });
});

describe("a migração não deixou ninguém para trás", () => {
  const arquivos = [
    ...fs.readdirSync(VITRINE).filter((f) => f.endsWith(".tsx")).map((f) => path.join(VITRINE, f)),
    ...fs.readdirSync(path.join(VITRINE, "fields")).map((f) => path.join(VITRINE, "fields", f)),
    ...fs.readdirSync(path.join(VITRINE, "ui")).map((f) => path.join(VITRINE, "ui", f)),
  ].filter((f) => f.endsWith(".tsx"));

  test("nenhum componente da vitrine importa a paleta congelada", () => {
    const culpados = arquivos.filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      // Só o import de VALOR conta: `import type { StudioStoreProduct }`
      // do mesmo módulo é contrato de dados, não paleta.
      return /^import \{[^}]*\bT\b[^}]*\} from ".*types";$/m.test(s);
    });
    expect(culpados.map((f) => path.basename(f))).toEqual([]);
  });

  test("todo arquivo que usa a paleta pega ela do tema", () => {
    const semTema = arquivos.filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      if (!/\bT\./.test(s)) return false;
      // Duas formas válidas de ter a paleta viva em mãos: chamar o hook,
      // ou recebê-la do componente pai. FichaTecnica faz a segunda — é
      // folha, e quem a desenha já resolveu o tema.
      const pegaDoHook = s.includes("usePaletaDaVitrine");
      const vemDoPai = /\bT: *\{/.test(s) || /\{[^}]*\bT\b[^}]*\}: *Props/.test(s);
      return !pegaDoHook && !vemDoPai;
    });
    expect(semTema.map((f) => path.basename(f))).toEqual([]);
  });

  test("quem recebe a paleta do pai recebe a VIVA, não uma cravada", () => {
    const conf = fs.readFileSync(path.join(VITRINE, "ProductConfigurator.tsx"), "utf8");
    expect(conf).toContain("usePaletaDaVitrine()");
    expect(conf).toMatch(/<FichaTecnica[^>]*T=\{T\}/);
  });

  test("o provider embrulha a vitrine inteira, com a cor da loja", () => {
    // 04/09/2026: a tela saiu da rota e virou componente, porque agora
    // DUAS rotas a abrem (`/<slug>`, o endereço público, e o caminho
    // antigo). O provider foi junto — e é ele que precisa ficar por fora.
    const shell = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/PaginaDaVitrine.tsx"), "utf8");
    expect(shell).toContain("<TemaDaVitrine cor={");
    expect(shell).toContain("site?.primary_color");
    // Antes das telas: um provider por dentro deixaria a lista de fora.
    expect(shell.indexOf("<TemaDaVitrine")).toBeLessThan(shell.indexOf("<ProductList"));
  });
});

// ── Fase 1A (25/09/2026) ─────────────────────────────────────
describe("papel com contraste AA (Fase 1A)", () => {
  test("ink3 do papel é #756C61: passa em 4.5:1 no fundo e no cartão", () => {
    // Era #837A6E, 3,99:1 no #FBF8F3 — reprovava justo no texto de apoio.
    expect(SUPERFICIE.papel.ink3).toBe("#756C61");
    expect(contraste(SUPERFICIE.papel.ink3, SUPERFICIE.papel.bg)).toBeGreaterThanOrEqual(AA);
    expect(contraste(SUPERFICIE.papel.ink3, SUPERFICIE.papel.bg2)).toBeGreaterThanOrEqual(AA);
  });

  test("as semânticas do papel são legíveis como texto (o verde do escuro dava 1,9:1)", () => {
    const t = montarTema("#1a1612", "papel");
    [t.green, t.red, t.amber].forEach((c) => {
      expect(contraste(c, t.bg)).toBeGreaterThanOrEqual(AA);
      expect(contraste(c, t.bg2)).toBeGreaterThanOrEqual(AA);
    });
  });

  test("o escuro e o claro continuam com as semânticas de antes", () => {
    expect(montarTema("#1a1612", "escuro").green).toBe(AURA.green);
    expect(montarTema("#1a1612", "claro").red).toBe(AURA.red);
  });
});

describe("estilosDaVitrine — opção escolhida na cor da loja", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { estilosDaVitrine } = require("@/components/studio/storefront/estilosDaVitrine");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { tipografiaDoStudio } = require("@/constants/fonts");

  test.each(CORES)("%s: o chip escolhido usa a marca legível, nunca o azul-marinho", (cor) => {
    const tema = montarTema(cor, "papel");
    const e = estilosDaVitrine(tema, tipografiaDoStudio("classic"));
    expect(e.chipAtivo.borderColor).toBe(tema.marcaTexto);
    expect(e.chipAtivo.backgroundColor).toBe(tema.marcaWash);
    expect(e.chipTextoAtivo.color).toBe(tema.marcaTexto);
    expect(contraste(e.chipTextoAtivo.color, tema.bg2)).toBeGreaterThanOrEqual(AA);
  });

  test("numa loja amarela não sobra azul-marinho, magenta nem branco cravado", () => {
    const e = estilosDaVitrine(montarTema("#EAFF00", "papel"), tipografiaDoStudio("classic"));
    expect(JSON.stringify(e)).not.toMatch(/1E3A8A|EC4899|"#fff"/i);
  });

  test("o chip tem alvo de toque de 44 px", () => {
    const e = estilosDaVitrine(montarTema("#EAFF00", "papel"), tipografiaDoStudio("classic"));
    expect(e.chip.minHeight).toBeGreaterThanOrEqual(44);
  });

  test("o rótulo de seção fala na voz dos números (Bricolage, dígitos tabulares)", () => {
    const e = estilosDaVitrine(montarTema(null, "papel"), tipografiaDoStudio("modern"));
    expect(e.rotulo.fontFamily).toContain("Bricolage Grotesque");
    expect(e.rotulo.fontVariant).toEqual(["tabular-nums"]);
    expect(e.rotulo.textTransform).toBe("uppercase");
  });
});
