// ============================================================
// Varredura do código-fonte da vitrine Studio (Fase 1A · 25/09/2026)
//
// "Casa arrumada" só fica arrumada se ninguém desarrumar. Este teste lê
// todos os componentes da vitrine (components/studio/storefront, fields/
// e ui/) e recusa o que a Fase 1A tirou de lá:
//   - a paleta antiga cravada (azul-marinho, magenta, cinzas frios);
//   - texto branco fixo — sobre a cor da loja ele some no amarelo; onde o
//     branco é legítimo (foto com véu, fundo do QR) ele tem nome no tema;
//   - emoji e glifo fazendo papel de ícone;
//   - `Text` puro do react-native (sai na fonte do sistema);
//   - `montarTema` fora do provider, `T.accent`, `accent_color`;
//   - `console.log` e `<img>` HTML sem guarda de plataforma.
// Comentários são ignorados: eles contam a história do que saiu.
// ============================================================
import fs from "fs";
import path from "path";

const VITRINE = path.join(__dirname, "..", "components/studio/storefront");

function arquivos(): string[] {
  const dirs = [VITRINE, path.join(VITRINE, "fields"), path.join(VITRINE, "ui")];
  return dirs.flatMap((d) =>
    fs.readdirSync(d).filter((f) => f.endsWith(".tsx")).map((f) => path.join(d, f)),
  );
}

/** O código sem comentários (bloco, JSX e de linha), linha a linha. */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => l.replace(/(^|\s)\/\/.*$/, "$1"))
    .join("\n");
}

const CODIGO = arquivos().map((f) => ({
  nome: path.relative(VITRINE, f),
  codigo: semComentarios(fs.readFileSync(f, "utf8")),
}));

/** Arquivos (e a primeira linha) em que o padrão aparece. */
function culpados(re: RegExp, excecoes: string[] = []): string[] {
  const out: string[] = [];
  for (const { nome, codigo } of CODIGO) {
    if (excecoes.includes(nome)) continue;
    const linhas = codigo.split("\n");
    const i = linhas.findIndex((l) => re.test(l));
    if (i >= 0) out.push(`${nome}:${i + 1}: ${linhas[i].trim().slice(0, 90)}`);
  }
  return out;
}

test("a varredura enxerga a vitrine inteira", () => {
  // Guarda contra o teste passar por não ler nada.
  expect(CODIGO.length).toBeGreaterThan(30);
  expect(CODIGO.map((c) => c.nome)).toEqual(
    expect.arrayContaining(["ProductConfigurator.tsx", "fields/FieldArtService.tsx", "ui/TotalRow.tsx"]),
  );
});

describe("sem cor cravada", () => {
  test("nada da paleta antiga: azul-marinho, magenta e os cinzas frios", () => {
    const antiga = new RegExp(
      [
        "#1E3A8A", "#EC4899",
        "rgba\\(\\s*30\\s*,\\s*58\\s*,\\s*138", "rgba\\(\\s*236\\s*,\\s*72\\s*,\\s*153",
        "#0F172A", "#334155", "#64748B", "#94A3B8", "#E5E7EB", "#D1D5DB",
        "#f3f4f6", "#FAFAFC", "#10B981", "#F59E0B", "#EF4444",
        "#fee2e2", "#fff1f2", "#fecdd3", "#f0fdf4",
      ].join("|"),
      "i",
    );
    expect(culpados(antiga)).toEqual([]);
  });

  test("nenhum texto branco fixo: a tinta sai do tema (sobreMarca, SOBRE_FOTO...)", () => {
    expect(culpados(/color\s*:\s*["']#fff(fff)?["']/i)).toEqual([]);
    expect(culpados(/color=\{?\s*["']#fff(fff)?["']/i)).toEqual([]);
  });

  test("T.accent saiu: destaque é a marca como texto, não um magenta", () => {
    expect(culpados(/\bT\.accent\b/)).toEqual([]);
  });

  test("accent_color não pinta nada — só a cor principal (PO, 25/09)", () => {
    expect(culpados(/accent_color/)).toEqual([]);
  });

  test("montarTema só no provider: as telas leem o tema do contexto (papel)", () => {
    expect(culpados(/montarTema\s*\(/, ["TemaDaVitrine.tsx"])).toEqual([]);
  });
});

describe("sem emoji", () => {
  test("nenhum emoji na interface", () => {
    expect(culpados(/\p{Extended_Pictographic}/u)).toEqual([]);
  });

  test("nenhum glifo fazendo papel de ícone (← ✓ ✕ ✦ ▾ ↻ ▭)", () => {
    expect(culpados(/[←✓✕✦▾↻▭]/)).toEqual([]);
  });
});

describe("sem Text puro", () => {
  test("ninguém importa Text do react-native — só o próprio Texto", () => {
    expect(
      culpados(/import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*["']react-native["']/, ["TipografiaVitrine.tsx"]),
    ).toEqual([]);
    expect(culpados(/<Text[\s>]/, ["TipografiaVitrine.tsx"])).toEqual([]);
  });
});

describe("limpeza", () => {
  test("nenhum console.log", () => {
    expect(culpados(/console\.log\(/)).toEqual([]);
  });

  test("todo <img> HTML está atrás de Platform.OS === \"web\"", () => {
    const soltos: string[] = [];
    for (const { nome, codigo } of CODIGO) {
      const linhas = codigo.split("\n");
      linhas.forEach((l, i) => {
        if (!/<img\b/.test(l)) return;
        const antes = linhas.slice(Math.max(0, i - 6), i + 1).join("\n");
        if (!/Platform\.OS\s*===\s*["']web["']/.test(antes)) soltos.push(`${nome}:${i + 1}`);
      });
    }
    expect(soltos).toEqual([]);
  });
});

describe("nada por cima da barra de compra (Tela 8)", () => {
  const le = (f: string) => fs.readFileSync(path.join(VITRINE, f), "utf8");
  const TELAS = [
    "ProductList.tsx", "ProductConfigurator.tsx", "Checkout.tsx",
    "SentConfirmation.tsx", "GradeDeModelos.tsx", "OrcamentoEmLote.tsx",
  ];

  test("a barra de cookies não é mais absoluta: entra no fluxo", () => {
    expect(semComentarios(le("ConsentimentoDaVitrine.tsx"))).not.toMatch(/position:\s*["']absolute["']/);
  });

  test.each(TELAS)("%s põe a barra de cookies no próprio fluxo", (f) => {
    expect(le(f)).toContain("<BarraDeCookies />");
  });

  test("na lista, os flutuantes (WhatsApp, carrinho) ficam ACIMA da barra", () => {
    const l = semComentarios(le("ProductList.tsx"));
    expect(l.indexOf("<BarraDeCookies />")).toBeGreaterThan(l.indexOf("<CartBar"));
    expect(l.indexOf("<BarraDeCookies />")).toBeGreaterThan(l.indexOf("<AncoraWhatsApp"));
  });

  test("o Powered by fixo saiu das telas de compra", () => {
    ["ProductConfigurator.tsx", "Checkout.tsx", "ProductList.tsx"].forEach((f) => {
      expect(semComentarios(le(f))).not.toContain("<PoweredByAura");
    });
  });
});
