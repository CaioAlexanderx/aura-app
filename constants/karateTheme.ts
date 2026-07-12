// ============================================================
// KARATE (SHOJI) TOKENS — Aura Karatê · 障子 Shoji / Kinari
//
// Tokens CANÔNICOS do Design System Shoji (fonte: _ds_manifest.json
// do "Aura Karate - design system"). Papel de arroz opaco, sumi (tinta),
// vermelhão de carimbo como acento RARO (~5%), sombras quentes em
// camadas (nunca glow), muito "ma".
//
// Regras invioláveis: papel opaco (nunca glass iOS) · vermelho cerimonial
// · Shippori Mincho leve (nunca bold pesado) · sem emoji (só o selo 空)
// · status SEMPRE icon+texto, nunca cor isolada (WCAG 1.4.1).
//
// Compatibilidade: mantém todos os nomes de export anteriores (valores
// atualizados pro canônico); novos tokens (heading, type, shadows,
// spacing, glass) adicionados pro kit Shoji.
// ============================================================
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────
// Primitivos Shoji — paleta canônica
// ─────────────────────────────────────────────────────────────
export const ShojiPalette = {
  // Papel de arroz (fundos)
  paper:       "#f0ebe0",
  paperWarm:   "#f6f1e7",
  paper2:      "#ece5d8",
  paper3:      "#e7e0d1",

  // Sumi (tinta) — texto/estrutura, 4 níveis dessaturados
  ink:         "#2b2620",
  ink2:        "#6a6154",
  ink3:        "#9b9180",
  ink4:        "#c1b8a7",

  // Hairlines
  line:        "rgba(43,38,32,0.10)",
  line2:       "rgba(43,38,32,0.17)",

  // Vidro de papel (superfícies de card) — opaco, NÃO glass iOS
  glass:       "rgba(250,247,240,0.92)",
  glass2:      "rgba(252,250,245,0.96)",
  glassHi:     "rgba(255,253,249,0.98)",

  // Vermelhão de carimbo (hanko) — acento RARO
  red:         "#b8463a",
  red2:        "#9d3a30",
  red3:        "#843027",
  redWash:     "rgba(184,70,58,0.08)",
  redLine:     "rgba(184,70,58,0.42)",
  headRed:     "#a44c3e",   // faixa oxblood do header

  // Verde-chá — só "em dia / aprovado"
  ok:          "#3e673d",  // WCAG AA fix (G5): 3.50:1 -> 4.56:1 sobre okWash/paper2
  okWash:      "rgba(74,122,72,0.12)",
  okLine:      "rgba(74,122,72,0.30)",

  // Semânticos auxiliares (warm, dessaturados — coerência Shoji)
  warn:        "#7a5724",  // WCAG AA fix (G5): 3.12:1 -> 4.59:1 sobre warnWash/paper2
  warnWash:    "rgba(156,111,46,0.12)",
  alert:       "#904832",  // WCAG AA fix (G5): 3.62:1 -> 4.56:1 sobre alertWash/paper2
  alertWash:   "rgba(168,84,58,0.12)",
  danger:      "#a13d33",  // WCAG AA fix (G5): 3.71:1 -> 4.57:1 sobre dangerWash/paper2
  dangerWash:  "rgba(184,70,58,0.10)",
  neutral:     "#685f52",  // WCAG AA fix (G5): 4.44:1 -> 4.59:1 sobre neutralWash/paper2
  neutralWash: "rgba(43,38,32,0.05)",

  // ── compat (nomes antigos *Soft) ──
  redSoft:     "rgba(184,70,58,0.08)",
  surface:     "#f6f1e7",
  okSoft:      "rgba(74,122,72,0.12)",
  warnSoft:    "rgba(156,111,46,0.12)",
  alertSoft:   "rgba(168,84,58,0.12)",
  dangerSoft:  "rgba(184,70,58,0.10)",
  neutralSoft: "rgba(43,38,32,0.05)",
} as const;

// ─────────────────────────────────────────────────────────────
// KarateColors — alias semânticos
// ─────────────────────────────────────────────────────────────
export const KarateColors = {
  // Acento vermelhão (raro). NB: botão PRIMÁRIO Shoji = sumi (ink), não red.
  primary:        ShojiPalette.red,
  primary2:       ShojiPalette.red2,
  primarySoft:    ShojiPalette.redWash,
  primaryDim:     "rgba(184,70,58,0.12)",
  primaryLine:    ShojiPalette.redLine,
  headRed:        ShojiPalette.headRed,

  // Backgrounds / superfícies
  bg:             ShojiPalette.paper,
  bg2:            ShojiPalette.paper2,
  paperWarm:      ShojiPalette.paperWarm,
  surface:        ShojiPalette.paperWarm,
  glass:          ShojiPalette.glass,
  glass2:         ShojiPalette.glass2,
  glassHi:        ShojiPalette.glassHi,
  border:         ShojiPalette.line,
  border2:        ShojiPalette.line2,
  line:           ShojiPalette.line,
  line2:          ShojiPalette.line2,

  // Ink
  ink:            ShojiPalette.ink,
  ink2:           ShojiPalette.ink2,
  ink3:           ShojiPalette.ink3,
  ink4:           ShojiPalette.ink4,

  // Sumi (botões primários Shoji)
  sumi:           ShojiPalette.ink,

  // Status
  ok:             ShojiPalette.ok,
  okSoft:         ShojiPalette.okWash,
  okLine:         ShojiPalette.okLine,
  warn:           ShojiPalette.warn,
  warnSoft:       ShojiPalette.warnWash,
  alert:          ShojiPalette.alert,
  alertSoft:      ShojiPalette.alertWash,
  danger:         ShojiPalette.danger,
  dangerSoft:     ShojiPalette.dangerWash,
  neutral:        ShojiPalette.neutral,
  neutralSoft:    ShojiPalette.neutralWash,
} as const;

// ─────────────────────────────────────────────────────────────
// Radius — canônico 7/10/14/18 + pill
// ─────────────────────────────────────────────────────────────
export const KarateRadius = {
  sm:   7,
  md:   10,
  lg:   14,
  xl:   18,
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────
// Fontes Shoji. No web, carregadas via Google Fonts (useShojiFonts).
// No nativo, fallback de sistema até @expo-google-fonts (paridade).
// Display/títulos: Shippori Mincho (serifa de pincel, 400–500).
// Corpo: Zen Kaku Gothic New. Dados/IDs/números: DM Mono (tabular).
// ─────────────────────────────────────────────────────────────
export const KarateFonts = {
  heading: Platform.select({ web: "'Shippori Mincho', 'Times New Roman', serif", default: "ShipporiMincho" }) as string,
  body:    Platform.select({ web: "'Zen Kaku Gothic New', system-ui, sans-serif", default: "ZenKakuGothicNew" }) as string,
  mono:    Platform.select({ web: "'DM Mono', ui-monospace, monospace", default: "DMMono" }) as string,
  // Serifa do DOCUMENTO oficial (carteirinha FPKT, DESIGN-14) — NÃO é o Shoji.
  serif:   Platform.select({ web: "'Instrument Serif', Georgia, serif", default: "InstrumentSerif" }) as string,
} as const;

// ─────────────────────────────────────────────────────────────
// Tipografia — escala canônica
// ─────────────────────────────────────────────────────────────
export const KarateType = {
  display: 52,
  h1:      36,
  h2:      27,
  h3:      21,
  kpi:     48,
  body:    13,
  sm:      12,
  xs:      11,
  label:   10.5,
  trackingLabel:   0.10,  // em → multiplicar por fontSize no RN (letterSpacing)
  trackingEyebrow: 0.16,
} as const;

// ─────────────────────────────────────────────────────────────
// Sombras quentes (nunca glow). Web usa boxShadow em camadas;
// nativo aproxima com sombra quente única.
// ─────────────────────────────────────────────────────────────
export const KarateShadows = {
  sm: Platform.select({
    web:     { boxShadow: "0 1px 2px rgba(43,38,32,0.04), 0 8px 22px -14px rgba(43,38,32,0.32)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 2 } as any,
  }),
  card: Platform.select({
    web:     { boxShadow: "0 1px 2px rgba(43,38,32,0.03), 0 18px 50px -28px rgba(43,38,32,0.30)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 4 } as any,
  }),
  dry: Platform.select({
    web:     { boxShadow: "4px 4px 0 rgba(43,38,32,0.10)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.10, shadowRadius: 0, elevation: 2 } as any,
  }),
  // Item hierarquia (Praticantes/Dojôs): dois planos — header ELEVADO
  // (`raised`, sombra projetada suave pra baixo) e lista REBAIXADA
  // (`sunken`, sombra INTERNA no topo). Web usa `boxShadow` (inclui
  // `inset` no sunken); nativo não tem inset — cai só no drop-shadow
  // suave (raised) e em nenhuma sombra extra (sunken usa fundo+borda,
  // ver styles.pocoCap/pocoItem/pocoFoot no kit Shoji/telas Praticantes-Dojôs).
  raised: Platform.select({
    web:     { boxShadow: "0 16px 34px -24px rgba(43,38,32,0.30), 0 2px 5px rgba(43,38,32,0.05)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 3 } as any,
  }),
  sunken: Platform.select({
    web:     { boxShadow: "inset 0 10px 14px -12px rgba(43,38,32,0.22), inset 0 1px 0 rgba(43,38,32,0.05)" } as any,
    default: {} as any,
  }),
} as const;

// ─────────────────────────────────────────────────────────────
// Espaçamento base-4
// ─────────────────────────────────────────────────────────────
export const KarateSpacing = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 15: 60,
  sidebar: 236,
  contentMax: 1220,
} as const;

// ─────────────────────────────────────────────────────────────
// Status do Dojô — label + ícone + cor (sempre icon+texto)
// ─────────────────────────────────────────────────────────────
// Status do Dojô — apenas 'active'/'inactive' (derivado de is_active no backend,
// decisão de produto 02/07/2026). Inadimplência é métrica SEPARADA (anuidade),
// nunca status do dojô. 'suspended' é aceito só como sinônimo retroativo de inativo.
export type DojoStatus = "active" | "inactive";

export const KarateDojoStatus: Record<DojoStatus, {
  label: string; icon: string; color: string; bg: string;
}> = {
  active:   { label: "Ativo",   icon: "checkmark-circle", color: ShojiPalette.ok,      bg: ShojiPalette.okWash },
  inactive: { label: "Inativo", icon: "ban",              color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash },
} as const;

/** Normaliza qualquer valor (inclui 'suspended' legado) para a view do dojô. */
export function dojoStatusView(status?: string | null) {
  const key: DojoStatus = status === "active" ? "active" : "inactive";
  return { key, ...KarateDojoStatus[key] };
}

// ─────────────────────────────────────────────────────────────
// Status do Praticante — apenas 'active'/'inactive' (derivado de is_active).
// ─────────────────────────────────────────────────────────────
export type AffiliationStatus = "active" | "inactive";

export const KarateAffiliationStatus: Record<AffiliationStatus, {
  label: string; icon: string; color: string; bg: string;
}> = {
  active:   { label: "Ativo",   icon: "checkmark-circle", color: ShojiPalette.ok,      bg: ShojiPalette.okWash },
  inactive: { label: "Inativo", icon: "close-circle",     color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash },
} as const;

export function affiliationStatusView(status?: string | null) {
  const key: AffiliationStatus = status === "active" ? "active" : "inactive";
  return { key, ...KarateAffiliationStatus[key] };
}

// ─────────────────────────────────────────────────────────────
// Anuidade — estado EXIBIDO (derivado no backend). Vocabulário único e amigável:
// Pago · A vencer · Vencido · Inadimplente · Sem cobrança.
// Fonte única: colapsa 'suspended'(>180d) em Inadimplente, 'pending'→A vencer,
// 'confirmed'→Pago; qualquer outro cai em 'Sem cobrança'. Elimina a duplicação
// que existia em 4 telas com vocabulários levemente diferentes.
// ─────────────────────────────────────────────────────────────
export type AnnuityView = "paid" | "due" | "overdue" | "defaulting" | "no_charge";

export const KarateAnnuityStatus: Record<AnnuityView, {
  label: string; icon: string; color: string; bg: string;
}> = {
  paid:       { label: "Pago",         icon: "checkmark-circle",      color: ShojiPalette.ok,      bg: ShojiPalette.okWash },
  due:        { label: "A vencer",     icon: "time",                  color: ShojiPalette.warn,    bg: ShojiPalette.warnWash },
  overdue:    { label: "Vencido",      icon: "warning",               color: ShojiPalette.alert,   bg: ShojiPalette.alertWash },
  defaulting: { label: "Inadimplente", icon: "close-circle",          color: ShojiPalette.danger,  bg: ShojiPalette.dangerWash },
  no_charge:  { label: "Sem cobrança", icon: "remove-circle-outline", color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash },
} as const;

/** Normaliza qualquer status de anuidade (armazenado OU computado) para a view. */
export function annuityStatusView(status?: string | null) {
  let key: AnnuityView;
  switch (status) {
    case "paid": case "confirmed":       key = "paid"; break;
    case "due": case "pending":          key = "due"; break;
    case "overdue":                      key = "overdue"; break;
    case "defaulting": case "suspended": key = "defaulting"; break;
    default:                             key = "no_charge";
  }
  return { key, ...KarateAnnuityStatus[key] };
}

// ─────────────────────────────────────────────────────────────
// Faixas (Belt) — paleta DESSATURADA canônica (10 faixas Shotokan)
// ─────────────────────────────────────────────────────────────
export type BeltKey =
  | "branca" | "amarela" | "laranja" | "verde"
  | "azul_claro" | "roxo" | "azul_escuro"
  | "vermelha" | "marrom" | "preta";

export const KarateBelts: Record<BeltKey, {
  label: string; color: string; textColor: string; isLegacy?: boolean;
}> = {
  branca:      { label: "Branca",      color: "#e0d8c6", textColor: ShojiPalette.ink },
  amarela:     { label: "Amarela",     color: "#cfaa48", textColor: ShojiPalette.ink },
  laranja:     { label: "Laranja",     color: "#c06f35", textColor: "#fdf8f2" },
  verde:       { label: "Verde",       color: "#56804c", textColor: "#fdf8f2" },
  azul_claro:  { label: "Azul Claro",  color: "#73a0b8", textColor: "#fdf8f2" },
  roxo:        { label: "Roxa",        color: "#75568c", textColor: "#fdf8f2" },
  azul_escuro: { label: "Azul Escuro", color: "#374d6e", textColor: "#fdf8f2" },
  vermelha:    { label: "Vermelha",    color: "#a14a3e", textColor: "#fdf8f2", isLegacy: true },
  marrom:      { label: "Marrom",      color: "#7a4e30", textColor: "#fdf8f2" },
  preta:       { label: "Preta",       color: "#2b2620", textColor: "#fdf8f2" },
} as const;

// Normaliza um rótulo de faixa: minúsculo, sem acento, ordinais/separadores
// virando espaço. "Preta 1º Dan" → "preta 1 dan" · "Roxa" → "roxa" ·
// "azul-claro" → "azul claro". Base para casar nomes reais vindos do banco.
function normalizeBeltText(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[º°ª]/g, " ")          // ordinais → espaço
    .replace(/[_\-/]/g, " ")         // separadores → espaço
    .replace(/\s+/g, " ")
    .trim();
}

// Helper: resolve belt key a partir do belt_level OU belt_name da API.
//
// O banco (karate_current_belt / karate_belt_history) traz tanto códigos
// canônicos (ex.: '9kyu', '1dan') quanto nomes humanos da base importada
// (ex.: 'Preta', 'Preta 1º Dan', 'Roxa', 'Azul Claro', 'Vermelha'). Antes,
// só os códigos/chaves exatos casavam — 'Roxa' (a chave era 'roxo'),
// 'Preta 1º Dan' e similares caíam no fallback neutro, deixando a bolinha
// de faixa com a cor errada (roxa e preta foram os casos reportados).
// Agora normalizamos (acento/caixa/ordinal) e casamos por código kyu/dan
// e por nome de cor. É o helper compartilhado: conserta lista + detalhe.
export function resolveBeltKey(beltLevel: string): BeltKey | null {
  if (!beltLevel) return null;
  const n = normalizeBeltText(beltLevel);
  if (!n) return null;

  // 1) Códigos canônicos kyu/dan (qualquer dan = preta).
  const code = n.replace(/\s+/g, ""); // "1 dan" → "1dan"
  const codeMap: Record<string, BeltKey> = {
    "10kyu": "branca",
    "9kyu": "branca", "8kyu": "amarela", "7kyu": "laranja",
    "6kyu": "verde",  "5kyu": "azul_claro", "4kyu": "azul_escuro",
    "3kyu": "marrom", "2kyu": "marrom", "1kyu": "marrom",
  };
  if (codeMap[code]) return codeMap[code];
  if (/\bdan\b/.test(n)) return "preta"; // "1dan", "preta 1 dan", "2 dan"...

  // 2) Nomes de cor (base importada). Ordem importa: compostas e roxa
  //    antes das simples para não confundir azul claro/escuro etc.
  if (n.includes("azul"))   return n.includes("escur") ? "azul_escuro" : "azul_claro";
  if (n.includes("rox"))    return "roxo";        // roxa / roxo
  if (n.includes("marrom") || n.includes("marron")) return "marrom";
  if (n.includes("preta") || n.includes("preto"))   return "preta";
  if (n.includes("vermelh")) return "vermelha";
  if (n.includes("verde"))   return "verde";
  if (n.includes("laranja")) return "laranja";
  if (n.includes("amarel"))  return "amarela";    // amarela / amarelo
  if (n.includes("branc"))   return "branca";     // branca / branco

  // 3) Chaves canônicas exatas (compat antiga).
  const exact: Record<string, BeltKey> = {
    branca: "branca", amarela: "amarela", laranja: "laranja",
    verde: "verde", "azul claro": "azul_claro", roxo: "roxo", roxa: "roxo",
    "azul escuro": "azul_escuro", vermelha: "vermelha",
    marrom: "marrom", preta: "preta",
  };
  return exact[n] ?? null;
}

// ─────────────────────────────────────────────────────────────
// Rank hierárquico oficial da graduação (federação)
//
// Ordem ascendente (menor → maior grau) usada para ORDENAR faixas em
// gráficos/relatórios da graduação ATIVA:
//   Branca(1) · Amarela(2) · Laranja(3) · Verde(4) · (Azul Claro) ·
//   Roxa(5) · (Azul Escuro) · Marrom(6) · Preta(7, Dan).
// As graduações Dan (Preta 1º, 2º, …) ordenam DEPOIS das kyu, por grau.
//
// Vermelha é HISTÓRICA (isLegacy): a federação não usa mais essa cor.
// Recebe rank 0 e deve ser EXCLUÍDA da graduação ativa (ver isActiveBelt).
// Ela continua no histórico individual do praticante (aba Trajetória).
//
// Aceita tanto belt_level/código quanto belt_name humano (normaliza via
// resolveBeltKey). Faixas não reconhecidas vão para o fim (rank 999).
// ─────────────────────────────────────────────────────────────
const BELT_KEY_RANK: Record<BeltKey, number> = {
  branca:      1,
  amarela:     2,
  laranja:     3,
  verde:       4,
  azul_claro:  5,
  roxo:        6,
  azul_escuro: 7,
  marrom:      8,
  preta:       9,  // base Dan; o grau (1º, 2º…) refina via danDegree
  vermelha:    0,  // histórica — excluída da graduação ativa
};

// Extrai o grau Dan de um rótulo ("Preta 1º Dan" → 1, "2 dan" → 2).
// Retorna 0 quando não há grau explícito (Preta "crua").
function danDegree(raw: string): number {
  const n = String(raw || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!/\bdan\b/.test(n)) return 0;
  const m = n.match(/(\d+)\s*(?:º|o|a)?\s*dan/) || n.match(/dan\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Rank hierárquico de uma faixa para ORDENAÇÃO. Recebe belt_level OU
// belt_name. Preta ordena por grau Dan (Preta < Preta 1º Dan < 2º Dan…),
// ASCENDENTE: 1º Dan < 2º Dan < … < 7º Dan.
//
// IMPORTANTE: na base FPKT o belt_level da preta é só 'preta' (sem grau) e o
// GRAU vive no belt_name ('Preta 1°', 'Preta 2°'…). Por isso aceitamos um
// segundo argumento opcional `nameForDegree`: quando informado, o grau Dan é
// extraído dele (e cai no beltLevelOrName se não houver). Sem o name, todas as
// pretas colapsavam no mesmo rank e não saíam ordenadas por grau (Item 4).
//
// Vermelha (histórica) = 0; não reconhecida = 999 (vai pro fim).
export function beltRank(beltLevelOrName: string, nameForDegree?: string): number {
  const key = resolveBeltKey(beltLevelOrName);
  if (!key) return 999;
  const base = BELT_KEY_RANK[key];
  if (key === "preta") {
    // grau Dan: prioriza o belt_name (carrega '1°'/'2°'…), cai no level se vazio.
    const degree = danDegree(nameForDegree || "") || danDegree(beltLevelOrName);
    return base * 100 + degree;
  }
  return base * 100;
}

// True quando a faixa pertence à graduação ATIVA (exibível em gráficos/
// relatórios). Falso para a Vermelha (histórica/isLegacy) e para faixas
// marcadas isLegacy no mapa KarateBelts. NÃO afeta o histórico individual
// (Trajetória), que mantém a Vermelha.
export function isActiveBelt(beltLevelOrName: string): boolean {
  const key = resolveBeltKey(beltLevelOrName);
  if (!key) return true; // desconhecida → não esconder por engano
  return !KarateBelts[key].isLegacy;
}

// ─────────────────────────────────────────────────────────────
// KarateStatus — alias curto (Badge, KPIStrip)
// ─────────────────────────────────────────────────────────────
export const KarateStatus = {
  ok:      { color: ShojiPalette.ok,      bg: ShojiPalette.okWash,      icon: "checkmark-circle" as const },
  warn:    { color: ShojiPalette.warn,    bg: ShojiPalette.warnWash,    icon: "alert-circle"     as const },
  alert:   { color: ShojiPalette.alert,   bg: ShojiPalette.alertWash,   icon: "warning"          as const },
  danger:  { color: ShojiPalette.danger,  bg: ShojiPalette.dangerWash,  icon: "close-circle"     as const },
  neutral: { color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash, icon: "ellipse-outline"  as const },
} as const;

export type KarateStatusKey = keyof typeof KarateStatus;
