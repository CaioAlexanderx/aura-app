// ============================================================
// A regra global de fonte engolia a escolha da lojista.
//
// O painel injeta `*, *::before, *::after { font-family: <corpo>
// !important }`. Ela existe por um motivo real — sem ela o
// react-native-web espalha fonte de sistema por metade das telas — mas
// `!important` num seletor universal ganha também de quem tem motivo
// legítimo para usar outra fonte.
//
// Sintoma: o preview de tipografia mostrava as quatro opções idênticas.
// As quatro famílias carregavam (conferido no Google Fonts e em
// document.fonts), a escolha chegava no componente, e a regra global
// sobrescrevia as quatro. Na tela, os quatro espécimes computavam a mesma
// font-family e mediam os mesmos 214px de largura.
//
// A saída é o seletor de atributo: especificidade maior que `*`, então
// entre dois `!important` ele vence. Estes testes guardam as duas metades
// — a regra existir, e o componente usá-la.
// ============================================================
import fs from "fs";
import path from "path";
import { TIPOGRAFIAS, cssDeExcecaoDeFonte } from "@/constants/fonts";

const raiz = path.join(__dirname, "..");
const layout = fs.readFileSync(path.join(raiz, "app/(tabs)/_layout.tsx"), "utf8");
const preview = fs.readFileSync(
  path.join(raiz, "components/screens/canal/PreviewTipografia.tsx"), "utf8",
);

describe("as regras de exceção", () => {
  const css = cssDeExcecaoDeFonte();

  test("existe uma regra por par, para título e para corpo", () => {
    for (const par of Object.values(TIPOGRAFIAS)) {
      expect(css).toContain(`[data-aura-display="${par.chave}"]`);
      expect(css).toContain(`[data-aura-body="${par.chave}"]`);
    }
  });

  test("cada regra carrega a família daquele par", () => {
    // Se a regra existir mas apontar para a fonte errada, o preview volta
    // a mentir — só que de um jeito mais difícil de ver.
    for (const par of Object.values(TIPOGRAFIAS)) {
      const i = css.indexOf(`[data-aura-display="${par.chave}"]`);
      const regra = css.slice(i, css.indexOf("}", i));
      expect(regra).toContain(par.display);
    }
  });

  test("sem !important a exceção não vence — a regra global também tem", () => {
    const linhas = css.split("\n").filter((l) => l.trim());
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) expect(l).toContain("!important");
  });

  test("sai do MESMO objeto que descreve os pares", () => {
    // Uma quinta tipografia não pode exigir lembrar de um segundo lugar:
    // esquecer a regra faria a opção nova nascer invisível no preview.
    expect(css.split("\n").length).toBe(Object.keys(TIPOGRAFIAS).length * 2);
  });
});

describe("as duas pontas estão ligadas", () => {
  test("o painel injeta as regras junto com a regra global", () => {
    expect(layout).toContain("cssDeExcecaoDeFonte()");
  });

  test("a exceção vem DEPOIS da regra base", () => {
    // Empate de especificidade é resolvido pela ordem, e inverter a ordem
    // é o tipo de mudança inocente que reintroduz o bug.
    //
    // A âncora mudou em 25/08: a regra base deixou de ser o seletor
    // universal com !important e virou `html body [class]` sem
    // !important. Ver [[regra-global-de-fonte-do-painel]].
    const base = layout.indexOf("html body [class]");
    const excecao = layout.indexOf("cssDeExcecaoDeFonte()");
    expect(base).toBeGreaterThan(0);
    expect(excecao).toBeGreaterThan(base);
  });

  test("o preview marca título e corpo com a chave do par", () => {
    // Sem o dataSet o `fontFamily` do componente é ignorado e as quatro
    // amostras saem na mesma fonte — que é o bug original.
    expect(preview).toContain("dataSet: { auraDisplay: chave }");
    expect(preview).toContain("dataSet: { auraBody: chave }");
  });

  test("e continua carregando as quatro famílias", () => {
    // A marcação sozinha não basta: sem o <link> com as oito famílias, a
    // regra aponta para uma fonte que o navegador não tem.
    expect(preview).toContain("cssDeTodasTipografias()");
  });
});

describe("a especificidade que o bug ensinou", () => {
  const css = cssDeExcecaoDeFonte();

  test("o atributo é repetido de propósito", () => {
    // A regra global não é só o `*`: ela traz `div[dir] { … !important }`,
    // que tem especificidade (0,1,1) — maior que um seletor de atributo
    // sozinho, (0,1,0). Como o react-native-web renderiza <Text> como
    // <div dir="auto">, a exceção casava e PERDIA. Com o atributo
    // repetido a especificidade vai a (0,2,0) e vence.
    //
    // Este teste existe porque "limpar" o seletor duplicado parece uma
    // simplificação óbvia e reintroduz o bug em silêncio.
    for (const l of css.split("\n")) {
      const seletor = l.slice(0, l.indexOf("{"));
      const atributos = seletor.match(/\[/g) || [];
      expect(atributos.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("o atributo repetido virou cinto e suspensório — e fica", () => {
    // ATUALIZADO em 25/08. O `div[dir] { … !important }` que EXIGIA o
    // atributo repetido saiu: a regra base não usa mais !important, e
    // qualquer declaração !important passa a vencê-la por definição, com
    // um atributo só.
    //
    // O duplicado fica assim mesmo, por dois motivos: não custa nada, e é
    // a rede se alguém devolver o !important à regra base. Quem guarda
    // ESSA porta é o teste "NÃO usa !important" em
    // regraDeFonteDoPainel.test.ts — este aqui só registra que a duplicação
    // deixou de ser obrigatória e continua de propósito.
    expect(layout).not.toContain("div[dir] { font-family");
    expect(layout).toContain("html body [dir]");
  });
});
