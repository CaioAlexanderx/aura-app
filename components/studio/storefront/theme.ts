// ============================================================
// AURA STUDIO · vitrine — tema white-label (Fase 01 do rebranding)
//
// A vitrine é a loja DO LOJISTA hospedada pela Aura. A divisão de
// responsabilidade, decidida em 19/08/2026:
//
//   Aura entrega a ESTRUTURA — fundo, superfícies, bordas, raios,
//   tipografia, movimento. Tudo vem do Aura Design System (dark-first,
//   #060816, bordas violeta-tingidas, Instrument Serif + DM Sans + DM Mono,
//   200–250ms numa curva só).
//
//   O lojista entra com a COR. Ela ocupa exatamente o lugar que o violeta
//   #7c3aed ocupa no sistema — é o acento, não o tema inteiro.
//
// Por que isto existe: até agora `logo_url` e `primary_color` do lojista
// eram lidos num único ponto (o hero da lista). Da segunda tela em diante a
// paleta era a constante `T`, cravada. A cliente entrava na loja da lojista
// e comprava numa loja da Aura.
//
// REGRA DE OURO: a cor do lojista é arbitrária — ele digita qualquer hex.
// Nada aqui pode assumir que ela é clara, escura ou saturada. Todo par
// (fundo, texto) que use a cor dele passa por cálculo de contraste. Uma
// loja não pode ficar ilegível porque a dona escolheu amarelo-limão.
// ============================================================

/** Tokens do Aura Design System que NÃO dependem do lojista. */
export const AURA = {
  // Superfícies — dark-first, sobem em degraus
  bg: "#060816",
  bg2: "#090C1A",
  bg3: "#0E1228",
  bg4: "#141830",

  // Tinta — no escuro é derivada de opacidade, some limpo nos washes
  ink: "#F0EDFF",
  ink2: "rgba(220,215,255,0.75)",
  ink3: "rgba(170,160,235,0.65)",

  // Bordas são violeta-tingidas, nunca cinza: o container lê como
  // contornado por aura, não como caixa.
  border: "rgba(255,255,255,0.07)",
  borderAccent: "rgba(120,100,240,0.22)",

  // Violeta da marca — o lojista SUBSTITUI isto pela cor dele
  violet: "#7C3AED",
  violetDeep: "#6D28D9",
  violetSoft: "#A78BFA",

  // Modo claro — mesma família, invertida. Neutros puxados para o violeta
  // (nunca cinza puro), para o claro continuar lendo como Aura.
  bgClaro: "#FBFAFF",
  bg2Claro: "#FFFFFF",
  bg3Claro: "#F6F4FD",
  bg4Claro: "#EFEBFA",
  inkClaro: "#14121F",
  ink2Claro: "rgba(28,24,48,0.72)",
  ink3Claro: "rgba(60,52,100,0.60)",
  borderClaro: "rgba(109,40,217,0.12)",

  // Semânticas não mudam com a loja: dinheiro e erro têm cor própria
  green: "#34D399",
  red: "#F87171",
  amber: "#FBBF24",

  radius: { sm: 6, md: 8, lg: 10, xl: 12, card: 16, editorial: 24, pill: 999 },
  space: [4, 6, 8, 10, 12, 16, 20, 24, 32, 48],
  font: {
    display: "Instrument Serif",
    body: "DM Sans",
    mono: "DM Mono",
  },
  type: { h1: 28, h2: 22, h3: 18, body: 14, caption: 12, label: 11, mono: 13 },
  motion: {
    ease: "cubic-bezier(0.4, 0, 0.2, 1)",
    fast: 150,
    base: 220,
    hoverLift: -2,
    hoverScale: 1.02,
    pressScale: 0.98,
  },
} as const;

// ── Contraste ───────────────────────────────────────────────
// WCAG 2.1: luminância relativa e razão de contraste. É o que separa
// "a cor do lojista funciona" de "o cliente não lê o botão".

function hexToRgb(hex: string): [number, number, number] | null {
  const s = String(hex || "").trim().replace(/^#/, "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function canal(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (0 = preto, 1 = branco). */
export function luminancia(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * canal(rgb[0]) + 0.7152 * canal(rgb[1]) + 0.0722 * canal(rgb[2]);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Tinta legível SOBRE uma cor de fundo.
 *
 * Não adianta escolher "branco se for escuro": amarelo-limão tem
 * luminância alta e reprova com branco. Aqui as duas opções competem e
 * ganha a de maior contraste real.
 */
export function tintaSobre(fundo: string): string {
  const claro = AURA.ink;
  const escuro = AURA.inkClaro;
  return contraste(fundo, claro) >= contraste(fundo, escuro) ? claro : escuro;
}

/** Mistura `hex` com preto (t<0) ou branco (t>0), de 0 a 1. */
function ajustar(hex: string, t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const alvo = t >= 0 ? 255 : 0;
  const p = Math.abs(t);
  const [r, g, b] = rgb.map((c) => Math.round(c + (alvo - c) * p));
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/**
 * Par (preenchimento, tinta) garantidamente legível a partir da cor da loja.
 *
 * Escolher só a tinta não basta: cores de meio-tom — magenta #db2777 é o
 * caso real de duas lojas — reprovam em 4.5:1 tanto com tinta clara quanto
 * com escura. Nesses casos o próprio PREENCHIMENTO precisa andar.
 *
 * Andamos nas duas direções e fica a que chegou primeiro, ou seja, a que
 * menos afasta da cor original: um botão magenta continua magenta, só o
 * suficiente para o texto em cima ser legível.
 */
export function parLegivel(hex: string): { fundo: string; tinta: string } {
  const direto = tintaSobre(hex);
  if (contraste(hex, direto) >= 4.5) return { fundo: hex, tinta: direto };

  for (let i = 1; i <= 12; i++) {
    const passo = i * 0.06;
    for (const cand of [ajustar(hex, -passo), ajustar(hex, passo)]) {
      const tinta = tintaSobre(cand);
      if (contraste(cand, tinta) >= 4.5) return { fundo: cand, tinta };
    }
  }
  // Inalcançável na prática (preto e branco sempre resolvem), mas nunca
  // devolvemos um par ilegível.
  return { fundo: AURA.inkClaro, tinta: AURA.ink };
}

/** `hex` com opacidade — para washes de fundo e bordas tingidas. */
export function wash(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "transparent";
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Ajusta a cor do lojista até ela ser legível como TEXTO sobre `fundo`.
 *
 * Um azul-marinho #1E3A8A tem contraste 1.9 contra o #060816 — como texto
 * é invisível. Em vez de recusar a cor dele, andamos com o tom até passar
 * em 4.5:1, preservando a matiz: clareando se o fundo é escuro, escurecendo
 * se é claro. A marca continua sendo a dele; só fica legível.
 *
 * LIMITE CONHECIDO: uma cor quase-preta num fundo escuro só vira legível
 * virando cinza (#1a1612 → #7f7c7b). A legibilidade é salva, a identidade
 * não. É por isso que o modo da vitrine não é detalhe de implementação.
 */
export function corLegivelSobre(hex: string, fundo: string): string {
  const fundoEscuro = luminancia(fundo) < 0.5;
  const passo = fundoEscuro ? 0.08 : -0.08; // clareia no escuro, escurece no claro
  let atual = hex;
  for (let i = 0; i < 12; i++) {
    if (contraste(atual, fundo) >= 4.5) return atual;
    atual = ajustar(atual, passo);
  }
  // Desistiu: entrega a tinta do próprio modo em vez de texto ilegível.
  return fundoEscuro ? AURA.ink : AURA.inkClaro;
}

/** @deprecated use corLegivelSobre(hex, fundo) */
export function corLegivelSobreEscuro(hex: string, fundo: string = AURA.bg): string {
  return corLegivelSobre(hex, fundo);
}

/**
 * Superfícies dos dois modos.
 *
 * O Aura Design System é dark-first — e isso vale para o PAINEL, que é
 * produto da Aura. A vitrine é a loja do lojista, e aí a evidência aponta
 * para o outro lado: das 6 lojas publicadas em 19/08/2026, 4 têm cor que
 * sobrevive intacta no claro e só 1 no escuro. O lojista escolhe a cor
 * imaginando ela no branco — cartão, embalagem, logo.
 *
 * Por isso o modo é PARÂMETRO, não constante: a decisão é de marca, não
 * de código, e pode ser tomada (ou revertida) sem reescrever a vitrine.
 */
export const SUPERFICIE = {
  escuro: {
    bg: AURA.bg, bg2: AURA.bg2, bg3: AURA.bg3, bg4: AURA.bg4,
    ink: AURA.ink, ink2: AURA.ink2, ink3: AURA.ink3, ink4: "rgba(140,130,200,0.45)",
    border: AURA.border,
  },
  claro: {
    bg: AURA.bgClaro, bg2: AURA.bg2Claro, bg3: AURA.bg3Claro, bg4: AURA.bg4Claro,
    ink: AURA.inkClaro, ink2: AURA.ink2Claro, ink3: AURA.ink3Claro,
    ink4: "rgba(60,52,100,0.38)",
    border: AURA.borderClaro,
  },
  /**
   * Papel quente — o Studio Premium.
   *
   * `claro` puxa os neutros para o violeta, porque nasceu para a vitrine
   * comum, que e produto da Aura. A vitrine Studio vende objeto feito a
   * mao: caneca, camiseta, lembranca de festa. O design system dela pede
   * papel quente, e neutro violeta sobre foto de produto artesanal briga
   * com a foto.
   *
   * Nasce como modo NOVO em vez de substituir `claro` de proposito: a
   * MiniLoja do painel monta o tema pelo mesmo motor, e trocar `claro`
   * mudaria a cara dela sem ninguem ter pedido.
   */
  papel: {
    bg: "#FBF8F3", bg2: "#FFFFFF", bg3: "#F6F1E8", bg4: "#F0E9DC",
    ink: "#1A1714", ink2: "#4A443C", ink3: "#837A6E", ink4: "#B4A99A",
    border: "#E7DFD3",
  },
} as const;

export type ModoVitrine = keyof typeof SUPERFICIE;

export type VitrineTema = {
  /** true quando a loja não configurou cor e o violeta da Aura assume. */
  padrao: boolean;
  /** Fundo em que este tema foi montado. */
  modo: ModoVitrine;
  bg: string; bg2: string; bg3: string; bg4: string;
  ink: string; ink2: string; ink3: string;
  /** O degrau mais apagado da tinta — placeholder, campo vazio, desabilitado. */
  ink4: string;
  border: string; borderAccent: string;
  /** Cor da loja como veio — use em preenchimento, nunca como texto. */
  marca: string;
  /** A mesma cor, ajustada para ser legível como texto/ícone no fundo. */
  marcaTexto: string;
  /** Cor de PREENCHIMENTO (botão cheio), já garantida legível com `sobreMarca`. */
  marcaFill: string;
  /** Tinta que fica POR CIMA de `marcaFill`. */
  sobreMarca: string;
  /** Fundos suaves derivados da marca. */
  marcaWash: string;
  marcaWashForte: string;
  green: string; red: string; amber: string;
  radius: typeof AURA.radius;
  font: typeof AURA.font;
  type: typeof AURA.type;
  motion: typeof AURA.motion;
};

/**
 * Monta o tema da vitrine a partir da cor da loja.
 *
 * Sem cor configurada, o violeta da Aura assume — a loja nunca fica sem
 * identidade, ela herda a nossa.
 */
export function montarTema(corDaLoja?: string | null, modo: ModoVitrine = "claro"): VitrineTema {
  const valida = typeof corDaLoja === "string" && hexToRgb(corDaLoja) !== null;
  const marca = valida ? corDaLoja!.trim() : AURA.violet;
  const s = SUPERFICIE[modo];
  const par = parLegivel(marca);

  return {
    padrao: !valida,
    modo,
    bg: s.bg,
    bg2: s.bg2,
    bg3: s.bg3,
    bg4: s.bg4,
    ink: s.ink,
    ink2: s.ink2,
    ink3: s.ink3,
    ink4: s.ink4,
    border: s.border,
    // A borda tingida acompanha a loja, não o violeta fixo.
    borderAccent: wash(marca, 0.22),
    marca,
    marcaTexto: corLegivelSobre(marca, s.bg),
    marcaFill: par.fundo,
    sobreMarca: par.tinta,
    marcaWash: wash(marca, 0.08),
    marcaWashForte: wash(marca, 0.16),
    green: AURA.green,
    red: AURA.red,
    amber: AURA.amber,
    radius: AURA.radius,
    font: AURA.font,
    type: AURA.type,
    motion: AURA.motion,
  };
}

/**
 * Gradiente radial da casca. O sistema é explícito: fundo NUNCA chapado.
 * Devolve string CSS — no nativo o degradê vira um View com opacidade.
 */
export function cascaGradiente(tema: VitrineTema): string {
  return [
    `radial-gradient(ellipse at 20% 0%, ${wash(tema.marca, 0.12)} 0%, transparent 50%)`,
    `radial-gradient(ellipse at 80% 100%, ${wash(tema.marca, 0.08)} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 50% 50%, rgba(91,140,255,0.05) 0%, transparent 60%)`,
  ].join(", ");
}

/**
 * Sombra tingida pela marca — o sistema proíbe elevação em preto neutro.
 * `nivel` 1 = repouso, 2 = hover.
 */
export function sombra(tema: VitrineTema, nivel: 1 | 2 = 1) {
  return nivel === 1
    ? { shadowColor: tema.marca, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }
    : { shadowColor: tema.marca, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 };
}

/**
 * A paleta antiga (`T`), montada a partir do tema vivo.
 *
 * A vitrine tinha DUAS paletas: `montarTema` — este motor, que deriva
 * tudo da cor da loja — ligado em 3 componentes, e a constante `T` de
 * `types.ts`, azul-marinho e magenta cravados, nos outros 27. A migração
 * ficou pela metade em 08/2026 e o cabeçalho do StoreNav registrava isso
 * como "fase 03, ainda não feita".
 *
 * Traduzir aqui, UMA vez, em vez de reescrever 290 usos: cada componente
 * troca o import por `usePaleta()` e o corpo dele não muda. O que era
 * decisão cravada vira decisão do tema — e as três que exigem julgamento
 * ficam explícitas abaixo, em vez de espalhadas.
 */
export type PaletaDaVitrine = {
  bg: string; card: string; border: string;
  ink: string; ink2: string; ink3: string; ink4: string;
  /** Preenchimento da marca. Já garantido legível com `sobrePrimary`. */
  primary: string;
  /** A marca como TEXTO. Um azul-marinho vira legível sem deixar de ser azul. */
  primaryTexto: string;
  /** A tinta que fica POR CIMA de `primary`. */
  sobrePrimary: string;
  /** Destaque. Na vitrine white-label ele é a própria marca, não um magenta fixo. */
  accent: string;
  green: string; amber: string; red: string;
};

export function paletaDaVitrine(tema: VitrineTema): PaletaDaVitrine {
  return {
    bg: tema.bg,
    // `card` era branco cravado; agora é a segunda superfície do modo.
    card: tema.bg2,
    border: tema.border,
    ink: tema.ink,
    ink2: tema.ink2,
    ink3: tema.ink3,
    ink4: tema.ink4,
    // Das 23 aparições de `primary` na vitrine, 19 são preenchimento —
    // por isso ele mapeia para `marcaFill`, que vem com tinta garantida.
    // As 3 que são texto usam `primaryTexto`.
    primary: tema.marcaFill,
    primaryTexto: tema.marcaTexto,
    sobrePrimary: tema.sobreMarca,
    // O magenta #EC4899 era a cor de destaque do Aura Studio, não da
    // loja. Numa vitrine white-label a loja tem UMA cor, e o destaque é
    // ela — legível como texto, que é como o destaque aparece.
    accent: tema.marcaTexto,
    green: tema.green,
    amber: tema.amber,
    red: tema.red,
  };
}
