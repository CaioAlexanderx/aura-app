// ============================================================
// A regra de fonte do Studio precisa alcançar o que está FORA de #root.
//
// Achado do QA (28/09/2026, rodada 1): o sino de notificações usa
// WebPortal — no web, a gaveta é um <div> anexado direto em
// `document.body` (WebPortal.tsx), IRMÃO de `#root`, não descendente
// dele. A regra de tipografia do Studio só cobria `#root ...`, então o
// portal caía no fallback de fonte do navegador (Times New Roman).
//
// Achado do QA (28/09/2026, rodada 2 — a correção da rodada 1 NÃO
// bastou): a regra da rodada 1 listava só `div[dir="auto"], input,
// textarea, button` dentro de `.aura-web-portal`. O CORPO da gaveta
// (NotificationDrawer.tsx, branch web) é escrito com HTML puro — o
// título "Notificações" e a maioria dos textos são `<span>`, que NUNCA
// bate em `div[dir="auto"]`. Só "Marcar tudo lido" (dentro de um
// <button>) saía em DM Sans — bate com o achado. O `document.body`
// também não tinha font-family nenhuma declarada antes desta regra
// (public/index.html não define), então até o body ficava Times New Roman.
//
// Correção: a regra agora tem DOIS blocos —
//   1. BASE herdada (`body, #root, .aura-web-portal`): cobre qualquer
//      texto solto sem atomic class do RNW (span, div, p — como os do
//      sino) via herança de CSS, sem precisar listar tag por tag.
//   2. OVERRIDE pontual (`div[dir="auto"], input, textarea, button,
//      select`, com `#root`/`.aura-web-portal` como ancestral): só estes
//      elementos ganham atomic class do react-native-web com a própria
//      font-family, então só eles precisam de um seletor com
//      especificidade MAIOR que essa classe pra vencer a cascata.
//
// Este teste trava as duas partes: a base cobre body/#root/.aura-web-portal
// (mesmo com especificidade baixa — não há atomic class disputando o
// body/root/portal em si), e todo seletor de OVERRIDE vence a classe
// atômica do react-native-web (jsdom não implementa especificidade de
// verdade, daí o cálculo manual abaixo — mesmo método do
// regraDeFonteDoPainel.test.ts).
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

// Seletores "base": ancoram a HERANÇA de font-family (não competem com
// nenhuma atomic class — RNW nunca dá classe atômica no próprio body,
// #root ou no container do portal), por isso ficam fora do teste de
// especificidade abaixo.
const SELETORES_BASE = new Set(["body", "#root", ".aura-web-portal"]);

// A regra é montada com vários literais (template strings) concatenados
// por `+` — junta todos antes de separar os seletores, senão um seletor
// que caiu num literal diferente do que tem "{ font-family" some da
// leitura. Pode haver MAIS de um bloco `seletores { ... }` na mesma
// string; cada `}` fecha um bloco e o próximo trecho até o `{` seguinte
// é outra lista de seletores.
function blocosDaRegra(): string[][] {
  // Ancora em `st.textContent =`, não em `st.id = "studio-typography"`:
  // esse id já é, ele mesmo, uma string entre aspas — incluí-lo no bloco
  // contamina a primeira string extraída (vira "studio-typographybody"
  // em vez de "body").
  const i = layout.indexOf("st.textContent =");
  const bloco = layout
    .slice(i, layout.indexOf("document.head.appendChild(st)", i))
    // Remove comentários de linha ANTES de procurar strings — os comentários
    // desta regra citam trechos de seletor/CSS entre aspas e crases (pra
    // explicar a decisão), e sem isso eles contaminam a extração.
    .replace(/\/\/[^\n]*/g, "");
  const partes = [...bloco.matchAll(/[`"]((?:[^`"\\]|\\.)*)[`"]/g)].map((m) => m[1]);
  const texto = partes.join("");

  const blocos: string[][] = [];
  let resto = texto;
  while (true) {
    const abre = resto.indexOf("{");
    if (abre < 0) break;
    const seletores = resto.slice(0, abre).split(",").map((s) => s.trim()).filter(Boolean);
    if (seletores.length) blocos.push(seletores);
    const fecha = resto.indexOf("}", abre);
    resto = fecha < 0 ? "" : resto.slice(fecha + 1);
  }
  return blocos;
}

describe("regra de tipografia do Studio", () => {
  const blocos = blocosDaRegra();
  const todosSeletores = blocos.flat();

  test("existe e foi encontrada no arquivo", () => {
    expect(todosSeletores.length).toBeGreaterThan(0);
  });

  test("cobre um portal anexado em document.body (fora de #root)", () => {
    // O WebPortal do sino (components/WebPortal.tsx) anexa um <div> em
    // document.body — irmão de #root, não filho — marcado com a classe
    // "aura-web-portal".
    const cobrePortal = todosSeletores.some((s) => s.includes(".aura-web-portal"));
    expect(cobrePortal).toBe(true);
  });

  test("continua cobrindo #root (sem regressão)", () => {
    expect(todosSeletores.some((s) => s.startsWith("#root"))).toBe(true);
  });

  test("define a fonte-base herdada em body, #root e .aura-web-portal", () => {
    // Base herdada: cobre texto SEM atomic class do RNW (ex.: os <span>
    // soltos do NotificationDrawer.tsx dentro do portal) sem precisar
    // listar toda tag possível.
    for (const s of SELETORES_BASE) {
      expect(todosSeletores).toContain(s);
    }
  });

  test("todo seletor de override (não-base) vence a classe atômica do react-native-web", () => {
    const seletoresDeOverride = todosSeletores.filter((s) => !SELETORES_BASE.has(s));
    expect(seletoresDeOverride.length).toBeGreaterThan(0);
    for (const s of seletoresDeOverride) {
      expect(maior(especificidade(s), CLASSE_ATOMICA_DO_RNW)).toBe(true);
    }
  });
});
