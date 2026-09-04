// ============================================================
// A leitura da cor, em português (S7 · 03/09/2026)
//
// O motor de tema já sabia ajustar qualquer hex até ele ser legível. O
// que faltava era CONTAR isso para quem escolhe a cor: a lojista abre um
// seletor, escolhe um tom e não tem como saber que a vitrine vai
// escurecê-lo um pouco para o cliente conseguir ler.
//
// O que este teste guarda é o recado — que ele seja verdade, e que ele
// mude quando a sorte da cor muda.
// ============================================================
import {
  lerCorDaLoja, corNosDoisModos, MINIMO_AA,
} from "@/components/studio/storefront/leituraDaCor";
import { contraste } from "@/components/studio/storefront/theme";

describe("cores que sobrevivem inteiras", () => {
  test("o quase-preto da Sheid, no papel quente", () => {
    const l = lerCorDaLoja("#1a1612", "papel");
    expect(l.intacta).toBe(true);
    expect(l.tom).toBe("ok");
    expect(l.comoTexto.toLowerCase()).toBe("#1a1612");
    expect(l.recado).toMatch(/exatamente como você escolheu/i);
  });

  test("um marrom médio, a cor do handoff", () => {
    const l = lerCorDaLoja("#6B4E1E", "papel");
    expect(l.contrasteTexto).toBeGreaterThanOrEqual(MINIMO_AA);
    expect(l.contrasteBotao).toBeGreaterThanOrEqual(MINIMO_AA);
  });
});

describe("cores que o motor precisa ajustar", () => {
  test("amarelo-limão: exato no botão, escurecido como texto", () => {
    // O caso é mais interessante do que "não funciona": amarelo é claro
    // demais para ser lido sobre papel, mas é um ótimo FUNDO de botão
    // com tinta escura em cima. O motor preserva o que dá para preservar.
    const l = lerCorDaLoja("#EAFF00", "papel");
    expect(l.intacta).toBe(false);
    expect(l.tom).toBe("ajustada");
    expect(l.botao.fundo.toLowerCase()).toBe("#eaff00");
    expect(l.comoTexto.toLowerCase()).not.toBe("#eaff00");
    expect(l.recado).toMatch(/no botão sua cor aparece exata/i);
    // O recado promete legibilidade — e ela tem que ser verdade.
    expect(l.contrasteTexto).toBeGreaterThanOrEqual(MINIMO_AA);
    expect(l.contrasteBotao).toBeGreaterThanOrEqual(MINIMO_AA);
  });

  test("a cor que não serve para nenhum dos dois ganha o recado forte", () => {
    // Um tom médio que reprova como texto no claro E precisa andar para
    // virar botão legível.
    const l = lerCorDaLoja("#C9A15C", "papel");
    if (!l.intacta && l.tom === "fraca") {
      expect(l.recado).toMatch(/some no fundo claro/i);
    }
    expect(l.contrasteTexto).toBeGreaterThanOrEqual(MINIMO_AA);
    expect(l.contrasteBotao).toBeGreaterThanOrEqual(MINIMO_AA);
  });

  test("qualquer que seja o ajuste, a promessa se cumpre", () => {
    ["#EAFF00", "#00FF00", "#FF00FF", "#FFFFFF", "#000000", "#1E3A8A", "#EC4899"]
      .forEach((c) => {
        const l = lerCorDaLoja(c, "papel");
        expect(contraste(l.comoTexto, "#FBF8F3")).toBeGreaterThanOrEqual(MINIMO_AA);
        expect(contraste(l.botao.fundo, l.botao.tinta)).toBeGreaterThanOrEqual(MINIMO_AA);
      });
  });

  test("sem cor válida, avisa que a loja está com o roxo da Aura", () => {
    const l = lerCorDaLoja("não é cor", "papel");
    expect(l.tom).toBe("fraca");
    expect(l.recado).toMatch(/roxo da Aura/i);
  });
});

describe("o argumento do papel quente", () => {
  test("o quase-preto da Sheid sobrevive no papel e não no escuro", () => {
    // É a razão de o modo ser parâmetro, e não constante: no escuro a
    // legibilidade é salva virando cinza, e a identidade se perde.
    const { papel, escuro } = corNosDoisModos("#1a1612");
    expect(papel.intacta).toBe(true);
    expect(escuro.intacta).toBe(false);
  });

  test("nos dois modos a legibilidade é garantida — muda só a identidade", () => {
    const { papel, escuro } = corNosDoisModos("#1a1612");
    expect(papel.contrasteTexto).toBeGreaterThanOrEqual(MINIMO_AA);
    expect(escuro.contrasteTexto).toBeGreaterThanOrEqual(MINIMO_AA);
  });
});

describe("o recado é uma frase, não um número", () => {
  test("nunca cita contraste, WCAG ou hexadecimal", () => {
    ["#1a1612", "#EAFF00", "#6B4E1E", "#FFFFFF"].forEach((c) => {
      const r = lerCorDaLoja(c, "papel").recado;
      expect(r).not.toMatch(/WCAG|contraste|4\.5|#[0-9a-f]{6}/i);
      expect(r.length).toBeGreaterThan(30);
    });
  });
});

describe("a aba de Aparência mostra o que faltava", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..");
  const aba = fs.readFileSync(
    path.join(RAIZ, "components/screens/studio-loja-digital/TabStudioAparencia.tsx"), "utf8");

  test("lê a cor no modo em que a vitrine roda, não no do painel", () => {
    expect(aba).toContain('lerCorDaLoja(String(corDaLoja || ""), "papel")');
  });

  test("mostra a tipografia do STUDIO, não a da loja comum", () => {
    // É o ponto da decisão 1: a mesma chave resolve em famílias
    // diferentes, e a lojista não tinha como ver isso.
    expect(aba).toContain("tipografiaDoStudio(chaveTipografia)");
    expect(aba).not.toContain("tipografiaDaLoja(");
  });

  test("dá tela ao vínculo 3D, que tinha endpoint e nenhuma", () => {
    expect(aba).toContain("setProductVisualTemplate");
    // Falha ao salvar volta o chip: mostrar vinculado o que não salvou
    // faria a lojista contar com uma prévia que a vitrine não tem.
    expect(aba).toContain("setVinculos((v) => ({ ...v, [pid]: antes }))");
  });

  test("revisões e SLA continuam nas abas próprias (decisão 5)", () => {
    // A aba só aponta para lá; duplicar o formulário criaria dois lugares
    // para configurar a mesma coisa.
    expect(aba).toContain('onIrPara("revisions")');
    expect(aba).not.toContain("max_revisions_included");
  });

  test("o painel monta a aba ao lado de Design", () => {
    const painel = fs.readFileSync(
      path.join(RAIZ, "app/studio/(estudio)/vendas/loja-digital.tsx"), "utf8");
    expect(painel).toContain('{ key: "aparencia"');
    expect(painel).toContain("<TabStudioAparencia");
    expect(painel.indexOf('key: "design"')).toBeLessThan(painel.indexOf('key: "aparencia"'));
  });
});
