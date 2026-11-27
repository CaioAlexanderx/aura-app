// ============================================================
// WhatsApp · Conversas — linguagem visual do mockup aprovado (Main, Fechada,
// Celular .dc.html): vidro, pílulas, bolhas, botão violeta, DM Sans/DM Mono.
//
// Tudo que é CSS que o RN Web só aceita pelo navegador (gradiente, blur,
// sombra interna) entra por `web()`; fora do navegador (e no jest) cai numa
// cor sólida equivalente. Tema: o app recarrega a página ao trocar claro/escuro,
// então a paleta é escolhida uma vez, na carga (IS_DARK_MODE).
// ============================================================
import { createElement, useEffect, type ReactNode } from "react";
import { View, Text, Pressable, Platform, type TextProps, type ViewStyle, type TextStyle, type StyleProp } from "react-native";
import { IS_DARK_MODE } from "@/constants/colors";

export const WEB = Platform.OS === "web";

export const SANS = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
export const MONO = '"DM Mono", ui-monospace, monospace';
export const SERIF = '"Instrument Serif", Georgia, serif';

const DARK = {
  bg: "#04020f", ink: "#f3efff", ink2: "rgba(226,219,255,.82)", ink3: "rgba(184,172,223,.86)",
  acc: "#c4b5fd", acc2: "#9a6cf7", gb: "rgba(255,255,255,.17)", hi: "rgba(255,255,255,.32)",
  solid: "rgba(22,14,52,.94)", ok: "#6ee7b7", warn: "#fcd34d", red: "#f87171",
  glass: "linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.04))", glassFb: "rgba(34,24,70,.72)",
  glassSombra: "0 30px 80px rgba(3,0,20,.6), inset 0 1px 0 rgba(255,255,255,.32)",
  dry: "linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.025))", dryFb: "rgba(255,255,255,.06)",
  dryBorda: "rgba(255,255,255,.12)", drySombra: "inset 0 1px 0 rgba(255,255,255,.16)",
  solidSombra: "0 30px 80px rgba(3,0,20,.5), inset 0 1px 0 rgba(255,255,255,.32)",
  linha: "rgba(255,255,255,.1)", linhaFraca: "rgba(255,255,255,.07)",
  pillBg: "rgba(255,255,255,.05)", pillBorda: "rgba(255,255,255,.14)", pillOnBg: "rgba(167,139,250,.2)", pillOnBorda: "rgba(196,181,253,.62)", pillOnInk: "#ffffff",
  ibBg: "rgba(255,255,255,.04)", ibBorda: "rgba(255,255,255,.12)",
  bolhaIn: "linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.04))", bolhaInFb: "rgba(255,255,255,.08)", bolhaInBorda: "rgba(255,255,255,.12)",
  bolhaOut: "linear-gradient(160deg,rgba(139,92,246,.42),rgba(109,40,217,.3))", bolhaOutFb: "rgba(109,40,217,.42)", bolhaOutBorda: "rgba(196,181,253,.32)",
  trilho: "rgba(255,255,255,.12)", chipClaro: "rgba(255,255,255,.14)", tag: "rgba(255,255,255,.07)", tagOn: "rgba(167,139,250,.22)",
  convSel: "rgba(167,139,250,.14)", convSelBorda: "rgba(196,181,253,.35)", convHover: "rgba(255,255,255,.1)",
  spot: "radial-gradient(closest-side,rgba(139,92,246,.42),rgba(124,58,237,0))",
  avTexto: "#1b1338", scrim: "rgba(4,2,15,.45)", sheetMobile: "rgba(22,14,52,.96)", campo: "rgba(0,0,0,.22)",
} as const;

// Tema claro = tokens "claro" da seção 1 de linguagem-vidro.md (fundo #e6e4f0, vidro branco 90/50, borda violeta 20%).
const LIGHT = {
  bg: "#e6e4f0", ink: "#18172b", ink2: "#3b3461", ink3: "#3f3760",
  acc: "#4c1d95", acc2: "#6d28d9", gb: "rgba(109,40,217,.2)", hi: "#ffffff",
  solid: "rgba(250,249,255,.96)", ok: "#047857", warn: "#b45309", red: "#dc2626",
  glass: "linear-gradient(160deg,rgba(255,255,255,.9),rgba(255,255,255,.5))", glassFb: "rgba(250,249,255,.96)",
  glassSombra: "0 24px 60px rgba(76,29,149,.22), inset 0 1px 0 #ffffff",
  dry: "linear-gradient(160deg,rgba(255,255,255,.7),rgba(255,255,255,.4))", dryFb: "rgba(255,255,255,.7)",
  dryBorda: "rgba(109,40,217,.2)", drySombra: "inset 0 1px 0 #ffffff",
  solidSombra: "0 24px 60px rgba(76,29,149,.22), inset 0 1px 0 #ffffff",
  linha: "rgba(24,23,43,.16)", linhaFraca: "rgba(24,23,43,.1)",
  pillBg: "rgba(255,255,255,.6)", pillBorda: "rgba(109,40,217,.25)", pillOnBg: "rgba(109,40,217,.14)", pillOnBorda: "rgba(76,29,149,.6)", pillOnInk: "#4c1d95",
  ibBg: "rgba(255,255,255,.6)", ibBorda: "rgba(109,40,217,.25)",
  bolhaIn: "linear-gradient(160deg,#ffffff,rgba(255,255,255,.7))", bolhaInFb: "#ffffff", bolhaInBorda: "rgba(109,40,217,.2)",
  bolhaOut: "linear-gradient(160deg,rgba(139,92,246,.3),rgba(109,40,217,.2))", bolhaOutFb: "rgba(139,92,246,.26)", bolhaOutBorda: "rgba(109,40,217,.32)",
  trilho: "rgba(24,23,43,.12)", chipClaro: "rgba(109,40,217,.1)", tag: "rgba(109,40,217,.1)", tagOn: "rgba(109,40,217,.18)",
  convSel: "rgba(109,40,217,.1)", convSelBorda: "rgba(109,40,217,.38)", convHover: "rgba(109,40,217,.14)",
  spot: "radial-gradient(closest-side,rgba(139,92,246,.26),rgba(124,58,237,0))",
  avTexto: "#1b1338", scrim: "rgba(24,23,43,.4)", sheetMobile: "rgba(250,249,255,.98)", campo: "rgba(109,40,217,.07)",
} as const;
// As quatro quedas (linguagem-vidro, seção 10): sem backdrop-filter, transparência reduzida,
// modo leve (aparelho fraco / economia de dados) => superfície sólida equivalente, sem desfoque.
// Movimento reduzido é tratado no CSS injetado (useFontesWa). O modo leve guardado em
// sessionStorage ("aura-lite") e a decisão por aparelho seguem a receita; a medição por
// quadros, depois da carga, fica de fora (ver PR).
export const LEVE: boolean = (() => {
  if (!WEB || typeof window === "undefined") return false;
  try {
    const mm = (q: string) => !!(window.matchMedia && window.matchMedia(q).matches);
    const n: any = navigator;
    let guardado: string | null = null;
    try { guardado = sessionStorage.getItem("aura-lite"); } catch {}
    const pedido = !!(n.connection && n.connection.saveData) || mm("(prefers-reduced-transparency: reduce)");
    const fraco = !!((n.deviceMemory && n.deviceMemory <= 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4));
    return pedido || guardado === "1" || (guardado !== "0" && fraco);
  } catch { return false; }
})();
const SEM_BLUR: boolean = LEVE || (WEB && typeof CSS !== "undefined" && typeof CSS.supports === "function"
  && !(CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)")));

export const K: typeof DARK = (IS_DARK_MODE ? DARK : LIGHT) as any;

/** Estilo só do navegador (gradiente, blur, sombra); fora dele, vazio. */
export const web = (o: Record<string, any>): any => (WEB ? o : {});
const grad = (g: string, fb: string): any => (WEB ? { backgroundImage: g } : { backgroundColor: fb });
const blur = (px: number, sat: number): any => SEM_BLUR ? {} : web({ backdropFilter: `blur(${px}px) saturate(${sat}%)`, WebkitBackdropFilter: `blur(${px}px) saturate(${sat}%)` });

export const superficie = {
  /** Placa de vidro: gradiente + borda + fio de luz + sombra + desfoque real; sem desfoque cai na superfície sólida. */
  vidro: (r = 30, desfoque = 24, sat = 165): ViewStyle => ({
    borderWidth: 1, borderColor: K.gb, borderRadius: r, ...(SEM_BLUR ? { backgroundColor: K.solid } : grad(K.glass, K.glassFb)), ...blur(desfoque, sat), ...web({ boxShadow: K.glassSombra }),
  }),
  seca: (r = 999): ViewStyle => ({
    borderWidth: 1, borderColor: K.dryBorda, borderRadius: r, ...grad(K.dry, K.dryFb), ...web({ boxShadow: K.drySombra }),
  }),
  solida: (r = 30): ViewStyle => ({
    borderWidth: 1, borderColor: K.gb, borderRadius: r, backgroundColor: K.solid, ...web({ boxShadow: K.solidSombra }),
  }),
};

export const botaoPrincipal: any = {
  borderRadius: 999, minHeight: 50, paddingLeft: 22, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 12,
  backgroundColor: "#7c3aed",
  ...web({
    backgroundImage: "linear-gradient(135deg,#8b5cf6,#7c3aed 45%,#6d28d9)",
    boxShadow: "0 0 0 1.5px rgba(236,228,255,.8), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.25), 0 12px 28px rgba(60,20,140,.5)",
    cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
  }),
};

/** Carrega DM Sans / DM Mono / Instrument Serif só enquanto a tela está aberta (web). */
export function useFontesWa() {
  useEffect(() => {
    if (!WEB || typeof document === "undefined") return;
    if (document.getElementById("wa-fontes-dm")) return;
    const l = document.createElement("link");
    l.id = "wa-fontes-dm";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Instrument+Serif&display=swap";
    document.head.appendChild(l);
    if (!document.getElementById("wa-anim-css")) {
      const s = document.createElement("style");
      s.id = "wa-anim-css";
      // Só transform e opacity (fio, pop, rise, abre); sem movimento, estado final.
      s.textContent = "@keyframes wa-fio{0%{opacity:0;transform:scaleX(.2)}60%{opacity:1;transform:none}100%{opacity:.6;transform:none}}"
        + "@keyframes wa-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"
        + "@keyframes wa-pop{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}"
        + "@keyframes wa-abre{from{opacity:0;transform:translateY(8px) scale(.94)}to{opacity:1;transform:none}}"
        + "@media (prefers-reduced-motion:reduce){[data-wa-anim]{animation:none!important;transition:none!important}}"
        + ":focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}";
      document.head.appendChild(s);
    }
  }, []);
}

// ── Texto ────────────────────────────────────────────────────
export function Tx({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ fontFamily: SANS, color: K.ink, fontSize: 15, lineHeight: 22 }, style]} />;
}
export function Meta({ style, children, ...rest }: TextProps) {
  return (
    <Text {...rest} style={[{ fontFamily: MONO, fontWeight: "500", fontSize: 12, letterSpacing: 1.68, textTransform: "uppercase", color: K.ink3 }, style]}>
      {children}
    </Text>
  );
}

/** Título com gradiente metálico (DM Sans 800) e o ponto violeta. */
export function Titulo({ children, size = 46 }: { children: ReactNode; size?: number }) {
  const gradTxt: any = WEB
    ? { color: "transparent", backgroundImage: IS_DARK_MODE ? "linear-gradient(172deg,#fff 0%,#f3efff 24%,#cbc1ea 46%,#efeafc 56%,#a898d3 72%,#f3efff 88%,#c4b5fd 100%)" : "linear-gradient(172deg,#18172b 0%,#3b3461 58%,#6d28d9 100%)", backgroundSize: "100% 220%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }
    : { color: K.ink };
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: SANS, fontWeight: "800", fontSize: size, lineHeight: size, letterSpacing: -size * 0.045 }, LEVE ? { color: K.ink } : gradTxt]}>
      {children}
      <Text style={web({ WebkitTextFillColor: K.acc2 }) as TextStyle}>
        <Text style={{ color: K.acc2 }}>.</Text>
      </Text>
    </Text>
  );
}

// ── Ícones (SVG do mockup, traço 1.8) ────────────────────────
export const ICONES = {
  produto: ["M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z", "circle:7.5,7.5,1.5"],
  orcamento: ["M6 3h9l4 4v14H6z", "M9 12h7M9 16h5"],
  pix: ["M12 3l9 9-9 9-9-9z", "M8.5 12h7"],
  link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  foto: ["rect:3,5,18,14,3", "circle:9,10,1.8", "M21 16l-5-5-8 8"],
  etiqueta: ["circle:6,12,2.5", "circle:18,6,2.5", "circle:18,18,2.5"],
  mic: ["rect:9,3,6,11,3", "M5 11a7 7 0 0 0 14 0M12 18v3"],
  busca: ["circle:11,11,7", "M20 20l-3.5-3.5"],
  seta: ["M5 12h14M13 6l6 6-6 6"],
  voltar: ["M15 6l-6 6 6 6"],
  relogio: ["circle:12,12,9", "M12 7v5l3 2"],
  check: ["M20 6L9 17l-5-5"],
  cadeado: ["rect:5,11,14,10,2.5", "M8 11V8a4 4 0 0 1 8 0v3"],
  copiar: ["rect:9,9,11,11,2.5", "M5 15V5h10"],
  play: ["M8 5.5v13l11-6.5z"],
  mais: ["M12 5v14M5 12h14"],
  sino: ["M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z", "M10 20a2 2 0 0 0 4 0"],
} as const;

export function Ico({ nome, size = 17, cor = "currentColor", traco = 1.8, preencher = false }: {
  nome: keyof typeof ICONES; size?: number; cor?: string; traco?: number; preencher?: boolean;
}) {
  if (!WEB) return null;
  const filhos = ICONES[nome].map((p, i) => {
    if (p.startsWith("circle:")) {
      const [cx, cy, r] = p.slice(7).split(",");
      return createElement("circle", { key: i, cx, cy, r });
    }
    if (p.startsWith("rect:")) {
      const [x, y, w, h, rx] = p.slice(5).split(",");
      return createElement("rect", { key: i, x, y, width: w, height: h, rx });
    }
    return createElement("path", { key: i, d: p });
  });
  return createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true,
    fill: preencher ? cor : "none", stroke: preencher ? "none" : cor, strokeWidth: traco, strokeLinecap: "round", strokeLinejoin: "round",
    style: { flex: "none", display: "block" },
  }, ...filhos);
}

// ── Peças ────────────────────────────────────────────────────
/** Pílula do mockup (.pill / .pill.sm / .pill.on). */
export function Pilula({ on, pequena, onPress, children, testID, disabled, style, textoStyle, acessLabel, ...rest }: {
  on?: boolean; pequena?: boolean; onPress?: () => void; children: ReactNode; testID?: string; disabled?: boolean;
  style?: StyleProp<ViewStyle>; textoStyle?: StyleProp<TextStyle>; acessLabel?: string; [k: string]: any;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={acessLabel}
      accessibilityState={{ selected: !!on, disabled: !!disabled }} {...rest}
      style={[{
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        minHeight: pequena ? 36 : 44, paddingHorizontal: pequena ? 12 : 16, borderRadius: 999, borderWidth: 1,
        borderColor: on ? K.pillOnBorda : K.pillBorda, backgroundColor: on ? K.pillOnBg : K.pillBg,
        opacity: disabled ? 0.55 : 1,
      }, web({ cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap" }), style]}>
      {typeof children === "string"
        ? <Tx style={[{ fontSize: pequena ? 13 : 14, fontWeight: "600", lineHeight: 18, color: on ? K.pillOnInk : K.ink }, textoStyle]}>{children}</Tx>
        : children}
    </Pressable>
  );
}

/** Botão redondo 44 px (.ib). */
export function BotaoRedondo({ children, on, onPress, testID, size = 44, style, acessLabel, disabled, ...rest }: {
  children: ReactNode; on?: boolean; onPress?: () => void; testID?: string; size?: number; style?: StyleProp<ViewStyle>; acessLabel?: string; disabled?: boolean; [k: string]: any;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={acessLabel} {...rest}
      style={[{
        width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", borderWidth: 1,
        borderColor: on ? K.pillOnBorda : K.ibBorda, backgroundColor: on ? K.pillOnBg : K.ibBg, opacity: disabled ? 0.55 : 1,
      }, web({ cursor: disabled ? "default" : "pointer" }), style]}>
      {children}
    </Pressable>
  );
}

/** Botão principal violeta com a seta em círculo (.btn1). */
export function BotaoPrincipal({ children, onPress, testID, disabled, icone = "seta", style }: {
  children: string; onPress?: () => void; testID?: string; disabled?: boolean; icone?: keyof typeof ICONES; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={[botaoPrincipal, { opacity: disabled ? 0.5 : 1 }, style]}>
      <Tx style={{ color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 20 }}>{children}</Tx>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(9,9,11,.28)" }}>
        <Ico nome={icone} size={16} cor="#fff" traco={icone === "copiar" ? 2 : 2.2} />
      </View>
    </Pressable>
  );
}

export function Ponto({ cor, size = 7 }: { cor: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cor }} />;
}

const TONS: [string, string][] = [
  ["#e9e3ff", "#a78bfa"], ["#fde68a", "#f59e0b"], ["#a7f3d0", "#10b981"], ["#fbcfe8", "#ec4899"], ["#bfdbfe", "#3b82f6"],
];
/** Mesma pessoa, mesma cor: o tom vem de um resumo do texto. */
export function tomDe(chave: string): [string, string] {
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  return TONS[h % TONS.length];
}
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (!partes.length) return "#";
  const a = partes[0].charAt(0);
  const b = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
  return (a + b).toUpperCase();
}

export function Avatar({ nome, chave, size = 42, children }: { nome: string; chave?: string; size?: number; children?: ReactNode }) {
  const [a, b] = tomDe(chave || nome);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: b }, web({ backgroundImage: `linear-gradient(150deg,${a},${b})` })]}>
      <Tx style={{ fontWeight: "700", fontSize: size >= 46 ? 15 : 14, color: K.avTexto, lineHeight: size >= 46 ? 20 : 18 }}>{iniciais(nome)}</Tx>
      {children}
    </View>
  );
}

/** Linha de luz no topo do vidro (.fio). */
export function Fio() {
  if (!WEB) return null;
  const an = anima("fio", 0.4, 0.8);
  return <View pointerEvents="none" {...({ dataSet: an.dataSet } as any)} style={[{ position: "absolute", left: "12%", right: "12%", top: -1, height: 1, opacity: 0.6 }, web({ backgroundImage: `linear-gradient(90deg,transparent,${IS_DARK_MODE ? "rgba(255,255,255,.95)" : "#fff"},transparent)` }), an.style]} />;
}

/** Fundo da tela: escuro com brilho violeta (claro: lavanda com brilho suave). */
export function FundoWa({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useFontesWa();
  return (
    <View style={[{ position: "relative", backgroundColor: K.bg, overflow: "hidden", borderRadius: 0 }, web({ isolation: "isolate" }), style]}>
      {WEB && <View pointerEvents="none" style={[{ position: "absolute", left: "28%", top: 120, width: 900, height: 640, borderRadius: 450, zIndex: -1 }, web({ backgroundImage: K.spot })]} />}
      {WEB && <View pointerEvents="none" style={[{ position: "absolute", right: -120, top: -160, width: 620, height: 520, borderRadius: 310, opacity: 0.55, zIndex: -1 }, web({ backgroundImage: K.spot })]} />}
      {children}
    </View>
  );
}

/** Barra de preenchimento (6/8 px) com gradiente violeta. */
export function Barra({ pct, altura = 6, largura }: { pct: number; altura?: number; largura?: number | string }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ height: altura, width: largura as any, borderRadius: 999, backgroundColor: K.trilho, overflow: "hidden" }}>
      <View style={[{ width: `${p * 100}%`, height: "100%", borderRadius: 999, backgroundColor: "#a78bfa" }, web({ backgroundImage: "linear-gradient(90deg,#a78bfa,#f3efff)" })]} />
    </View>
  );
}

/** Animação de entrada (só web, só se o modo leve estiver desligado). */
export const anima = (nome: "fio" | "rise" | "pop" | "abre", dur: number, atraso = 0): any =>
  WEB && !LEVE ? { dataSet: { waAnim: "1" }, style: { animationName: `wa-${nome}`, animationDuration: `${dur}s`, animationDelay: `${atraso}s`, animationTimingFunction: nome === "rise" ? "cubic-bezier(.2,.7,.2,1)" : "cubic-bezier(.2,.8,.2,1)", animationFillMode: "backwards" } } : { style: {} };

export const rotuloSombra = (v: string) => web({ boxShadow: v });
