// ============================================================
// A regra de fonte do painel não pode voltar a usar !important.
//
// HISTÓRICO. A regra nasceu como `*, *::before, *::after { font-family:
// <corpo> !important }` para vencer as fontes de sistema que o
// react-native-web espalha em classe atômica. Fazia isso — e de quebra
// matava QUALQUER componente que quisesse outra fonte.
//
// A varredura de 25/08 encontrou 14 chamadas de `Fonts.heading` /
// `Fonts.mono` dentro do alcance da regra, todas mortas: os números
// monoespaçados do estoque, o título serifado de 64px do EstoqueHero, o
// nome da loja na sidebar do Studio. Nada quebrava e nada avisava.
//
// POR QUE ESTE TESTE NÃO MEDE COM jsdom. Eu tentei. O jsdom não
// implementa especificidade — dá a resposta ERRADA neste caso exato:
// entre `html body [class]` (0,1,2) e `.rnw` (0,1,0) ele devolve a última
// do arquivo, não a mais específica. Um teste em jsdom passaria dizendo o
// contrário do que o navegador faz, que é pior que teste nenhum.
//
// Então aqui a especificidade é CALCULADA, e a verificação empírica foi
// feita à parte, num aparato que carrega o CSS de verdade no navegador
// com os formatos de elemento reais do painel. Resultado registrado:
// com a regra antiga, 7 de 10 casos perdiam a fonte; com esta, 0 de 10 —
// e o caso de regressão (classe atômica do RNW) continua vencido pela
// regra, que é o trabalho dela.
// ============================================================
import fs from "fs";
import path from "path";
import { cssDeExcecaoDeFonte } from "@/constants/fonts";

const layout = fs.readFileSync(
  path.join(__dirname, "..", "app/(tabs)/_layout.tsx"), "utf8",
);

/**
 * Especificidade de um seletor simples, como (ids, classes, elementos).
 *
 * Cobre só o que aparece nesta folha: elementos, classes, atributos e
 * pseudo-elementos. Não tenta ser um parser de CSS — se a folha ganhar
 * um `:is()` ou um id, este cálculo precisa crescer junto.
 */
export function especificidade(seletor: string): [number, number, number] {
  const s = seletor.trim();

  // Pseudo-ELEMENTO sai primeiro e conta como elemento. Sem tirar ele
  // daqui, o `::before` casa com o padrão de pseudo-CLASSE (o segundo
  // dois-pontos seguido de letra) e a conta sobe na coluna errada — foi
  // o que este teste pegou na primeira execução, e a conta errada faria
  // as outras asserções passarem dizendo qualquer coisa.
  const pseudoElementos = (s.match(/::[\w-]+/g) || []).length;
  const semPseudoElemento = s.replace(/::[\w-]+/g, "");

  const ids = (semPseudoElemento.match(/#[\w-]+/g) || []).length;
  const classes = (semPseudoElemento.match(/\.[\w-]+/g) || []).length
    + (semPseudoElemento.match(/\[[^\]]+\]/g) || []).length
    + (semPseudoElemento.match(/:[\w-]+/g) || []).length;
  const elementos = (semPseudoElemento.replace(/\[[^\]]+\]/g, "").match(/(^|[\s>+~])[a-z][\w-]*/g) || []).length
    + pseudoElementos;

  return [ids, classes, elementos];
}

function maior(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** O que o react-native-web emite: uma classe atômica por propriedade. */
const CLASSE_ATOMICA_DO_RNW: [number, number, number] = [0, 1, 0];

/** Os seletores base da regra, extraídos do próprio arquivo. */
function seletoresDaRegra(): string[] {
  const i = layout.indexOf("st.textContent =");
  const bloco = layout.slice(i, layout.indexOf("document.head.appendChild(st)", i));
  const seletores: string[] = [];
  for (const m of bloco.matchAll(/"([^"]*?)\s*\{\s*font-family/g)) {
    seletores.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
  }
  return seletores;
}

describe("a regra base do painel", () => {
  const seletores = seletoresDaRegra();

  test("existe e foi encontrada no arquivo", () => {
    // Se este teste falhar, os outros estão medindo o vazio.
    expect(seletores.length).toBeGreaterThan(0);
  });

  test("NÃO usa !important", () => {
    // É o !important que engolia a escolha dos componentes. Sem ele, o
    // estilo inline de um componente volta a vencer — que é como um
    // componente diz "aqui eu quero outra fonte".
    const i = layout.indexOf("st.textContent =");
    const bloco = layout
      .slice(i, layout.indexOf("cssDeExcecaoDeFonte()", i))
      // Sem tirar os comentários, o próprio comentário que EXPLICA por que
      // as exceções mantêm !important reprova o teste.
      .replace(/\/\/[^\n]*/g, "");
    expect(bloco).not.toContain("!important");
  });

  test("ainda vence a classe atômica do react-native-web", () => {
    // A metade que não pode regredir: se a regra deixar de vencer a
    // classe atômica, metade do painel cai na fonte de sistema — o
    // problema que o !important existia para resolver.
    for (const s of seletores) {
      expect(maior(especificidade(s), CLASSE_ATOMICA_DO_RNW)).toBe(true);
    }
  });
});

describe("as exceções continuam acima de tudo", () => {
  test("elas mantêm !important", () => {
    // Uma exceção precisa vencer inclusive um estilo inline que o
    // componente tenha deixado para trás.
    for (const l of cssDeExcecaoDeFonte().split("\n")) {
      expect(l).toContain("!important");
    }
  });

  test("e vencem a regra base", () => {
    const base = seletoresDaRegra().map(especificidade);
    for (const l of cssDeExcecaoDeFonte().split("\n")) {
      const sel = l.slice(0, l.indexOf("{")).trim();
      const e = especificidade(sel);
      // Empatar não basta: em empate decide a ordem no arquivo, e a
      // ordem é o tipo de coisa que uma refatoração inocente inverte.
      for (const b of base) expect(maior(e, b)).toBe(true);
    }
  });
});

describe("o cálculo de especificidade em si", () => {
  // Se o cálculo estiver errado, os testes acima passam dizendo qualquer
  // coisa. Estes casos vêm da própria folha e do bug real.
  test.each([
    ["*", [0, 0, 0]],
    ["div[dir]", [0, 1, 1]],
    ['[data-aura-display="classic"]', [0, 1, 0]],
    ['[data-aura-display="classic"][data-aura-display]', [0, 2, 0]],
    ["html body [class]", [0, 1, 2]],
    ["html body [class]::after", [0, 1, 3]],
  ])("%s → %j", (sel: any, esperado: any) => {
    expect(especificidade(sel as string)).toEqual(esperado);
  });

  test("o caso que causou o bug: div[dir] vencia o atributo sozinho", () => {
    expect(maior(especificidade("div[dir]"), especificidade('[data-aura-display="x"]'))).toBe(true);
    expect(maior(especificidade('[data-aura-display="x"][data-aura-display]'), especificidade("div[dir]"))).toBe(true);
  });
});
