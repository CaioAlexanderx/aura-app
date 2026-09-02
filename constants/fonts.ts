import { Platform } from "react-native";

// Typography system for Aura.
// Web: Google Fonts (Instrument Serif + DM Sans)
// Native: system font fallbacks

const isWeb = Platform.OS === "web";

export const Fonts = {
  // Headings - Instrument Serif (elegant, editorial)
  heading: isWeb
    ? "'Instrument Serif', Georgia, serif"
    : "System",

  // Body - DM Sans (clean, modern)
  body: isWeb
    ? "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    : "System",

  // Mono - DM Mono (data, numbers)
  mono: isWeb
    ? "'DM Mono', 'SF Mono', Menlo, monospace"
    : "monospace",
} as const;

// Google Fonts CSS link (injected in web layout)
export const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&family=Instrument+Serif:ital@0;1&display=swap";

// ── Tipografia da loja (escolha do lojista) ──────────────────
//
// O lojista escolhe entre PARES CURADOS. Nao e upload livre de fonte: o
// piso de qualidade da vitrine depende de a gente controlar o conjunto —
// quatro opcoes boas nao produzem loja feia, um campo de texto produz.
//
// As chaves ja existiam em `digital_channel_config.font_family` e sao
// consumidas pela loja comum (src/templates/storefrontPage.js). NAO
// mudar o significado de `classic`: nove lojas ja usam, e trocar o par
// debaixo delas mudaria a cara de todas sem ninguem pedir.
export type ChaveTipografia = "classic" | "modern" | "humanist" | "editorial";

export type ParTipografico = {
  chave: ChaveTipografia;
  nome: string;
  hint: string;
  /** Titulos: hero, nome do produto. */
  display: string;
  /** Corpo, rotulos, precos. */
  body: string;
  /** Familias pro Google Fonts — so estas sao carregadas na vitrine. */
  familias: string[];
};

/**
 * Os quatro pares.
 *
 * REESCRITO em 23/08/2026. Antes TRES dos quatro eram serifados —
 * Instrument Serif, Fraunces e Playfair — e o quarto era DM Sans, que ja
 * era o CORPO do "classic". Num cartao de 19px ninguem distinguia: o
 * feedback foi literal, "não consigo diferenciá-las".
 *
 * Agora cada par e um TIPO DE LOJA diferente, e a diferenca aparece no
 * thumbnail:
 *
 *   Elegante   serifada fina, alto contraste   boutique, joalheria
 *   Moderna    sem serifa, geometrica          streetwear, tecnologia
 *   Marcante   peso alto, comercial            atacado, promocao
 *   Acolhedora serifada macia                  artesanal, doces, brecho
 *
 * As CHAVES continuam as mesmas (classic/modern/editorial/humanist)
 * porque estao gravadas no banco e no CHECK da migration 299. Elas sao
 * ids opacos; o que a lojista le e `nome`.
 */
export const TIPOGRAFIAS: Record<ChaveTipografia, ParTipografico> = {
  classic: {
    chave: "classic",
    nome: "Elegante",
    hint: "Serifada fina, de traço clássico. Boutique, joalheria, moda autoral.",
    // RE-CURADO em 02/09/2026 (redesign da loja, Claude Design). Os quatro
    // TIPOS continuam; mudam as familias. Espelho: aura-backend
    // src/templates/storefrontTypography.js — mexer nos dois.
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Figtree', -apple-system, BlinkMacSystemFont, sans-serif",
    familias: ["Cormorant+Garamond:ital,wght@0,500;0,600;1,500", "Figtree:wght@400;500;600;700"],
  },
  modern: {
    chave: "modern",
    nome: "Moderna",
    hint: "Sem serifa, geométrica. Streetwear, esporte, tecnologia.",
    display: "'Space Grotesk', -apple-system, sans-serif",
    body: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
    familias: ["Space+Grotesk:wght@500;600;700", "Manrope:wght@400;500;600;700"],
  },
  editorial: {
    chave: "editorial",
    nome: "Marcante",
    hint: "Peso alto e largura estreita. Atacado, liquidação, preço em destaque.",
    display: "'Anton', Impact, sans-serif",
    body: "'Archivo', -apple-system, BlinkMacSystemFont, sans-serif",
    familias: ["Anton", "Archivo:wght@400;500;600;700"],
  },
  humanist: {
    chave: "humanist",
    nome: "Acolhedora",
    hint: "Serifada macia, de curvas abertas. Artesanal, casa, presentes.",
    display: "'Lora', Georgia, serif",
    body: "'Karla', -apple-system, BlinkMacSystemFont, sans-serif",
    familias: ["Lora:ital,wght@0,400;0,500;0,600;1,400", "Karla:wght@400;500;600;700"],
  },
};

/** O par escolhido, com queda pro classico se vier lixo do banco. */
export function tipografiaDaLoja(chave?: string | null): ParTipografico {
  const k = String(chave || "").trim() as ChaveTipografia;
  return TIPOGRAFIAS[k] || TIPOGRAFIAS.classic;
}

/**
 * CSS do Google Fonts para UM par + as fontes de arte.
 *
 * So o par escolhido entra: carregar as oito familias das quatro opcoes
 * em toda vitrine seria pagar banda por escolha que o lojista nao fez.
 */
export function cssDaVitrine(chave?: string | null): string {
  const par = tipografiaDaLoja(chave);
  const familias = [
    ...par.familias,
    "DM+Mono:wght@400;500",
    ...ART_FONTS.map((f) => f.replace(/ /g, "+")),
  ];
  return "https://fonts.googleapis.com/css2?" +
    familias.map((f) => "family=" + f).join("&") +
    "&display=swap";
}

/**
 * CSS com TODAS as tipografias — so pro painel.
 *
 * A vitrine carrega apenas o par escolhido; aqui e o contrario, porque e
 * onde a lojista COMPARA os quatro. Sem isto o preview mostraria as
 * quatro opcoes renderizadas na mesma fonte de fallback, que e pior do
 * que nao ter preview: ela escolheria achando que viu.
 */
export function cssDeTodasTipografias(): string {
  const familias = new Set<string>();
  for (const par of Object.values(TIPOGRAFIAS)) par.familias.forEach((f) => familias.add(f));
  return "https://fonts.googleapis.com/css2?" +
    [...familias].map((f) => "family=" + f).join("&") +
    "&display=swap";
}

// ── Fontes de ARTE (vitrine) ─────────────────────────────────
// O lojista escolhe entre estas ao configurar um campo de texto
// (FONTS_PRESET em customizationConfig). Elas não fazem parte da UI —
// são a letra que vai ESTAMPADA na peça, então precisam estar carregadas
// onde o cliente vê a arte, senão o preview cai num fallback silencioso
// e a caneca "Pacifico" aparece em Arial.
export const ART_FONTS = ["Pacifico", "Caveat", "Playfair Display", "Bebas Neue"] as const;

/**
 * CSS de fontes da VITRINE: marca + fontes de arte.
 *
 * Até 21/08/2026 nenhuma rota de vitrine injetava fonte nenhuma — o
 * painel e a página de orçamento carregavam, a superfície que vende não.
 * Tudo lá renderizava em fonte de sistema.
 */
export const STOREFRONT_FONTS_CSS =
  "https://fonts.googleapis.com/css2" +
  "?family=DM+Mono:wght@400;500" +
  "&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800" +
  "&family=Instrument+Serif:ital@0;1" +
  "&family=Pacifico" +
  "&family=Caveat:wght@400;700" +
  "&family=Playfair+Display:ital,wght@0,400;0,700;1,400" +
  "&family=Bebas+Neue" +
  "&display=swap";

/** Pilha de fallback para uma fonte de arte escolhida pelo lojista. */
export function artFontStack(nome?: string | null): string {
  const escolhida = String(nome || "").trim();
  // Instrument Serif como penúltimo degrau: se a fonte de arte não
  // carregar, a peça cai na serifada da marca, não no sans do sistema.
  const base = "'Instrument Serif', Georgia, serif";
  return escolhida ? `'${escolhida.replace(/'/g, "")}', ${base}` : base;
}

// Shorthand for common text styles
export const Typography = {
  h1: { fontFamily: Fonts.heading, fontSize: 28, fontWeight: "400" as const },
  h2: { fontFamily: Fonts.heading, fontSize: 22, fontWeight: "400" as const },
  h3: { fontFamily: Fonts.heading, fontSize: 18, fontWeight: "400" as const },
  body: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "400" as const },
  bodyBold: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700" as const },
  label: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  caption: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "500" as const },
  mono: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: "500" as const },
} as const;

/**
 * A saída de emergência da regra global de fonte.
 *
 * O painel injeta `*, *::before, *::after { font-family: <corpo> !important }`
 * (ver app/(tabs)/_layout.tsx). A regra existe porque o react-native-web
 * espalha fontes de sistema por toda parte e sem ela metade do painel sai
 * na fonte errada — não é sujeira, é o que segura a tipografia da Aura.
 *
 * Só que `!important` num seletor universal ganha de TUDO, inclusive do
 * `fontFamily` que um componente define no próprio estilo. Foi por isso
 * que o preview de tipografia mostrava as quatro opções idênticas: as
 * quatro famílias carregavam, a escolha chegava no componente, e a regra
 * global sobrescrevia as quatro para DM Sans. Medido na tela: os quatro
 * espécimes computavam a mesma `font-family` e tinham a mesma largura em
 * pixels.
 *
 * Estas regras são a exceção declarada. Um seletor de atributo tem
 * especificidade maior que `*`, então entre duas declarações `!important`
 * ele vence. Quem quiser fugir da regra global marca o elemento com
 * `dataSet={{ auraDisplay: chave }}` (ou `auraBody`) — API do
 * react-native-web que vira `data-aura-display` no DOM.
 *
 * ATENÇÃO AO ATRIBUTO REPETIDO — não é engano de digitação.
 *
 * A regra global não é só o `*`: ela traz junto um
 * `div[dir] { … !important }`, e `div[dir]` tem especificidade (0,1,1),
 * MAIOR que um seletor de atributo sozinho (0,1,0). O react-native-web
 * renderiza `<Text>` como `<div dir="auto">`, então a exceção casava no
 * elemento e perdia mesmo assim. Repetindo o atributo a especificidade vai
 * a (0,2,0) e vence (0,1,1) sem depender da ordem das regras no arquivo.
 *
 * Medido no navegador: com um atributo só, os quatro espécimes seguiam em
 * DM Sans; com dois, saem em Instrument Serif, Space Grotesk, Archivo
 * Black e Fraunces.
 *
 * (É por isso que o `[data-aura-wm]` do wordmark funciona com um atributo
 * só: `<Text>` dentro de `<Text>` vira `<span dir>`, e `div[dir]` não casa
 * com span. O padrão da casa estava certo por acaso do tipo de elemento.)
 *
 * As regras saem daqui, do MESMO objeto que descreve os pares, para que
 * adicionar uma quinta tipografia não exija lembrar de um segundo lugar.
 */
export function cssDeExcecaoDeFonte(): string {
  const regras: string[] = [];
  for (const par of Object.values(TIPOGRAFIAS)) {
    const d = `[data-aura-display="${par.chave}"][data-aura-display]`;
    const b = `[data-aura-body="${par.chave}"][data-aura-body]`;
    regras.push(`${d} { font-family: ${par.display} !important; }`);
    regras.push(`${b} { font-family: ${par.body} !important; }`);
  }
  return regras.join("\n");
}
