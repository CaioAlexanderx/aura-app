// ============================================================
// A regra de fonte do Studio precisa alcançar o que está FORA de #root.
//
// Achado do QA (28/09/2026): o sino de notificações usa WebPortal — no
// web, a gaveta é um <div> anexado direto em `document.body` (Portal.tsx),
// IRMÃO de `#root`, não descendente dele. A regra de tipografia do Studio
// só cobria `#root ...`, então o portal caía no fallback de fonte do
// navegador (Times New Roman). Este teste trava que a regra também cubra
// `body ...` (superset de `#root ...`, que é filho de `body`), sem perder
// a especificidade que vence a classe atômica do react-native-web — mesmo
// método de cálculo do regraDeFonteDoPainel.test.ts (o jsdom não implementa
// especificidade de verdade).
// ============================================================
import fs from "fs";
import path from "path";

const layout = fs.readFileSync(
  path.join(__dirname, "..", "app/studio/(estudio)/_layout.tsx"), "utf8",
);

function especificidade(seletor: string): [number, number, number] {
  const s = seletor.trim();
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

const CLASSE_ATOMICA_DO_RNW: [number, number, number] = [0, 1, 0];

// A regra é montada com vários literais (template strings) concatenados
// por `+` — junta todos antes de separar os seletores, senão um seletor
// que caiu num literal diferente do que tem "{ font-family" some da
// leitura.
function textoDaRegra(): string {
  const i = layout.indexOf('st.id = "studio-typography"');
  const bloco = layout.slice(i, layout.indexOf("document.head.appendChild(st)", i));
  const partes = [...bloco.matchAll(/[`"]((?:[^`"\\]|\\.)*)[`"]/g)].map((m) => m[1]);
  return partes.join("");
}

function seletoresDaRegra(): string[] {
  const texto = textoDaRegra();
  const fim = texto.indexOf("{");
  if (fim < 0) return [];
  return texto.slice(0, fim).split(",").map((s) => s.trim()).filter(Boolean);
}

describe("regra de tipografia do Studio", () => {
  const seletores = seletoresDaRegra();

  test("existe e foi encontrada no arquivo", () => {
    expect(seletores.length).toBeGreaterThan(0);
  });

  test("cobre um portal anexado em document.body (fora de #root)", () => {
    // O WebPortal do sino (components/WebPortal.tsx) anexa um <div> em
    // document.body — irmão de #root, não filho — marcado com a classe
    // "aura-web-portal". Precisa de um seletor que NÃO exija #root como
    // ancestral, e que tenha especificidade de verdade (não um seletor
    // de elemento puro tipo "body input", que perde pra classe atômica
    // do react-native-web — ver o teste de especificidade abaixo).
    const cobrePortal = seletores.some((s) => s.includes(".aura-web-portal") && !s.includes("#root"));
    expect(cobrePortal).toBe(true);
  });

  test("continua cobrindo #root (sem regressão)", () => {
    expect(seletores.some((s) => s.startsWith("#root"))).toBe(true);
  });

  test("todo seletor da regra ainda vence a classe atômica do react-native-web", () => {
    for (const s of seletores) {
      expect(maior(especificidade(s), CLASSE_ATOMICA_DO_RNW)).toBe(true);
    }
  });
});
