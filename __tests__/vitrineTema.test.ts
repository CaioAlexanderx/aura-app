// ============================================================
// Vitrine white-label — a cor do lojista é arbitrária
//
// Ele digita qualquer hex no painel. Estes testes travam a única coisa
// que não pode falhar: nenhuma combinação escolhida por ele pode produzir
// texto ilegível na loja dele.
// ============================================================
import {
  AURA, SUPERFICIE, montarTema, contraste, tintaSobre, corLegivelSobre, parLegivel, wash,
  type ModoVitrine,
} from "@/components/studio/storefront/theme";

const MIN_WCAG_AA = 4.5;

describe("contraste", () => {
  test("preto e branco dão o extremo 21:1", () => {
    expect(Math.round(contraste("#000000", "#FFFFFF"))).toBe(21);
  });

  test("a mesma cor contra ela mesma dá 1:1", () => {
    expect(contraste("#7C3AED", "#7C3AED")).toBeCloseTo(1, 5);
  });

  test("é simétrico", () => {
    expect(contraste("#060816", "#F0EDFF")).toBeCloseTo(contraste("#F0EDFF", "#060816"), 5);
  });
});

describe("tintaSobre — o que escrever EM CIMA da cor da loja", () => {
  // O caso que quebra a regra ingênua "branco se for escuro": amarelo-limão
  // é claro o bastante para reprovar com branco.
  test("amarelo-limão recebe tinta escura, não branca", () => {
    expect(tintaSobre("#D4FF00")).toBe(AURA.inkClaro);
  });

  test("azul-marinho recebe tinta clara", () => {
    expect(tintaSobre("#1E3A8A")).toBe(AURA.ink);
  });

  test.each([
    ["#D4FF00", "amarelo-limão"],
    ["#1E3A8A", "azul-marinho"],
    ["#FFFFFF", "branco"],
    ["#000000", "preto"],
    ["#EC4899", "magenta Studio"],
    ["#7C3AED", "violeta Aura"],
    ["#C9A227", "dourado"],
    ["#34D399", "verde"],
  ])("%s (%s) sempre produz um par legível", (cor) => {
    const par = parLegivel(cor);
    expect(contraste(par.fundo, par.tinta)).toBeGreaterThanOrEqual(MIN_WCAG_AA);
  });

  // Duas lojas reais usam esse magenta. Nem tinta clara nem escura passam
  // nele: é o meio-tom que obriga o preenchimento a andar.
  test("magenta de meio-tom reprova com as duas tintas e por isso o fill anda", () => {
    const meio = "#db2777";
    expect(contraste(meio, AURA.ink)).toBeLessThan(MIN_WCAG_AA);
    expect(contraste(meio, AURA.inkClaro)).toBeLessThan(MIN_WCAG_AA);
    expect(parLegivel(meio).fundo).not.toBe(meio);
  });
});

describe("corLegivelSobre — a cor da loja como TEXTO", () => {
  test("azul-marinho cru é ilegível no fundo da vitrine", () => {
    // Prova de que o problema existe: por isso a função precisa existir.
    expect(contraste("#1E3A8A", AURA.bg)).toBeLessThan(MIN_WCAG_AA);
  });

  test.each([
    ["#1E3A8A", "azul-marinho"],
    ["#6D28D9", "violeta profundo"],
    ["#7C3AED", "violeta de ação"],
    ["#000000", "preto"],
    ["#3B2A1E", "marrom escuro"],
    ["#0F5257", "petróleo"],
  ])("%s (%s) vira legível sem deixar de ser a cor dele", (cor) => {
    const ajustada = corLegivelSobre(cor, AURA.bg);
    expect(contraste(ajustada, AURA.bg)).toBeGreaterThanOrEqual(MIN_WCAG_AA);
  });

  test("cor já legível passa intacta", () => {
    const clara = "#A78BFA";
    expect(corLegivelSobre(clara, AURA.bg)).toBe(clara);
  });
});

describe("montarTema", () => {
  test("sem cor configurada, a loja herda o violeta da Aura", () => {
    const t = montarTema(null);
    expect(t.padrao).toBe(true);
    expect(t.marca).toBe(AURA.violet);
  });

  test("hex inválido não derruba a loja — cai no padrão", () => {
    for (const ruim of ["", "azul", "#12", "#GGGGGG", "rgb(1,2,3)"]) {
      const t = montarTema(ruim);
      expect(t.padrao).toBe(true);
      expect(t.marca).toBe(AURA.violet);
    }
  });

  test("aceita hex de 3 dígitos", () => {
    expect(montarTema("#0AF").padrao).toBe(false);
  });

  test("a borda tingida acompanha a loja, não o violeta fixo", () => {
    const t = montarTema("#EC4899");
    expect(t.borderAccent).toBe(wash("#EC4899", 0.22));
    expect(t.borderAccent).not.toBe(AURA.borderAccent);
  });

  test("semânticas não mudam com a loja: dinheiro e erro têm cor própria", () => {
    const a = montarTema("#D4FF00");
    const b = montarTema("#1E3A8A");
    expect(a.green).toBe(b.green);
    expect(a.red).toBe(b.red);
  });

  // Cores REAIS de lojas publicadas em 19/08/2026 — a prova de que isto
  // não é exercício teórico. Sheid Mania (#1a1612) tem contraste 1.11 no
  // fundo escuro: sem ajuste, texto invisível na loja dela.
  const CORES_REAIS = [
    "#1a1612", // Sheid Mania
    "#374151", // Aura (conta de teste)
    "#7a1f3a", // Finesse
    "#0bbdea", // Davi Calçados
    "#db2777", // Looks da Jenny / FK Store
    "#7c3aed", // FPKT
  ];
  const MODOS: ModoVitrine[] = ["claro", "escuro"];

  test.each(MODOS)("no modo %s, qualquer cor de loja produz tema legível", (modo) => {
    const cores = [...CORES_REAIS, "#D4FF00", "#FFFFFF", "#000000", "#C9A227"];
    for (const cor of cores) {
      const t = montarTema(cor, modo);
      expect(contraste(t.marcaFill, t.sobreMarca)).toBeGreaterThanOrEqual(MIN_WCAG_AA);
      expect(contraste(t.marcaTexto, t.bg)).toBeGreaterThanOrEqual(MIN_WCAG_AA);
      expect(contraste(t.ink, t.bg)).toBeGreaterThanOrEqual(MIN_WCAG_AA);
      expect(contraste(t.ink2, t.bg)).toBeGreaterThan(1);
    }
  });

  test("o modo escolhido manda nas superfícies", () => {
    expect(montarTema("#EC4899", "escuro").bg).toBe(SUPERFICIE.escuro.bg);
    expect(montarTema("#EC4899", "claro").bg).toBe(SUPERFICIE.claro.bg);
  });

  test("o padrão é claro — a cor do lojista sobrevive melhor nele", () => {
    expect(montarTema("#1a1612").modo).toBe("claro");
  });

  // O achado que orientou a decisão de modo, travado como teste: cor
  // escura de lojista fica INTACTA no claro e precisa virar cinza no
  // escuro. Se alguém inverter o padrão, este teste explica o custo.
  test("cor quase-preta sobrevive intacta no claro e se perde no escuro", () => {
    const sheid = "#1a1612";
    expect(montarTema(sheid, "claro").marcaTexto).toBe(sheid);
    expect(montarTema(sheid, "escuro").marcaTexto).not.toBe(sheid);
  });
});
