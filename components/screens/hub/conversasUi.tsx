// ============================================================
// Conversas — peças visuais próprias da aba (Main / Fechada / Celular).
//
// Os tokens, as fontes, as keyframes, as quatro quedas (sem backdrop-filter,
// transparência reduzida, movimento reduzido, modo leve + a medição de quadros)
// e a receita do vidro vêm de components/whatsapp/waVisual.ts e waVidro.tsx
// (compartilhados com Configurações). Aqui ficam só as peças que só as Conversas
// usam: ícones do artboard, avatar com o tom da pessoa, bolinha, barra, botão
// redondo, botão principal com ícone, e um `K` curto com os nomes que o código
// da aba usa, derivados dos tokens compartilhados.
// ============================================================
import { createElement, useEffect, type ReactNode } from "react";
import { View, Text, Pressable, type TextProps, type ViewStyle, type StyleProp } from "react-native";
import {
  ANIM_FIO, ANIM_POP, ANIM_RISE, ESCURO, GRAD_BTN, MONO, SANS, SERIF, V, WEB, estiloSuperficie, modoLeve,
} from "@/components/whatsapp/waVisual";
import { Meta, Pilula as PilulaWa, t } from "@/components/whatsapp/waVidro";

export { MONO, SANS, SERIF, WEB, Meta };

/**
 * Foco visível de 2 px #c4b5fd (linguagem de vidro) nas áreas marcadas com data-wa-foco.
 * Injeta o CSS uma vez; marque o container com `dataSet={{ waFoco: "1" }}` (propriedade `FOCO`).
 */
export const FOCO: any = WEB ? { dataSet: { waFoco: "1" } } : {};
export function useFocoVisivel(): void {
  useEffect(() => {
    if (!WEB || typeof document === "undefined") return;
    try {
      if (!document.getElementById("wa-foco-css")) {
        const s = document.createElement("style");
        s.id = "wa-foco-css";
        s.textContent = "[data-wa-foco]:focus-visible,[data-wa-foco] :focus-visible{outline:2px solid #c4b5fd!important;outline-offset:2px!important}";
        document.head.appendChild(s);
      }
    } catch { /* sem foco desenhado: vale o do navegador */ }
  }, []);
}

/** Jest: o react-test-renderer não monta portais; a gaveta do celular fica no fluxo só aí. */
export const EM_TESTE = typeof process !== "undefined" && !!(process as any).env?.JEST_WORKER_ID;

/** Estilo só do navegador (gradiente, blur, sombra); fora dele, vazio. */
export const web = (o: Record<string, any>): any => (WEB ? o : {});

// Nomes curtos usados pela aba, todos derivados dos tokens compartilhados (V).
export const K = {
  bg: ESCURO ? "#04020f" : "#e6e4f0",
  ink: V.ink, ink2: V.ink2, ink3: V.ink3, acc: V.acc, acc2: V.acc2, ok: V.ok, warn: V.warn,
  red: ESCURO ? "#f87171" : "#dc2626",
  linha: V.rule, trilho: V.track, chipClaro: V.fill2,
  dry: `linear-gradient(160deg,${V.dryA},${V.dryB})`, dryFb: V.fill, dryBorda: V.dryLine, ibBg: V.fill,
  pillOnInk: V.onTxt,
  bolhaIn: ESCURO ? "linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.04))" : "linear-gradient(160deg,#ffffff,rgba(255,255,255,.7))",
  bolhaInFb: ESCURO ? "rgba(255,255,255,.08)" : "#ffffff",
  bolhaInBorda: ESCURO ? "rgba(255,255,255,.12)" : "rgba(109,40,217,.2)",
  bolhaOut: `linear-gradient(160deg,${V.bolhaA},${V.bolhaB})`, bolhaOutFb: V.bolhaA, bolhaOutBorda: V.bolhaLine,
  campo: V.campoBg, convSel: V.on, convSelBorda: V.lineOn, tag: V.fill2, tagOn: V.on,
  scrim: ESCURO ? "rgba(4,2,15,.45)" : "rgba(24,23,43,.4)", sheetMobile: V.solid,
};

// Receita do vidro: a mesma de Configurações (estiloSuperficie), com o raio do artboard.
export const superficie = {
  vidro: (r = 30): ViewStyle => estiloSuperficie("glass", r),
  seca: (r = 999): ViewStyle => estiloSuperficie("dry", r),
  solida: (r = 30): ViewStyle => estiloSuperficie("solid", r),
};

/** Animação de entrada do artboard (rise, pop, fio); `abre` usa o pop. Some no modo leve e com movimento reduzido. */
export const anima = (nome: "fio" | "rise" | "pop" | "abre", _dur?: number, _atraso = 0): any => {
  const a = nome === "fio" ? ANIM_FIO : nome === "rise" ? ANIM_RISE : ANIM_POP;
  return WEB && !modoLeve() ? { dataSet: { waAnim: "1" }, style: a } : { style: {} };
};

// ── Texto ────────────────────────────────────────────────────
export function Tx({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ fontFamily: SANS, color: V.ink, fontSize: 15, lineHeight: 22 } as any, style]} />;
}

// ── Pílula: o `Pilula` compartilhado, com os nomes de prop da aba ─────
export function Pilula({ on, pequena, onPress, children, testID, disabled, style, textoStyle, acessLabel, dataSet, role, semTab, dados }: {
  on?: boolean; pequena?: boolean; onPress?: () => void; children: ReactNode; testID?: string; disabled?: boolean;
  style?: StyleProp<ViewStyle>; textoStyle?: any; acessLabel?: string; dataSet?: any;
  /** radio = opção de um radiogroup (aria-checked); fora do grupo, botão. */
  role?: "button" | "radio"; semTab?: boolean; dados?: Record<string, string>;
}) {
  const filho = typeof children === "string" && textoStyle
    ? <Text style={[t(pequena ? 13 : 14, on ? V.onTxt : V.ink, "600"), textoStyle]}>{children}</Text>
    : children;
  return (
    <PilulaWa testID={testID} ligada={on} peq={pequena} onPress={onPress} disabled={disabled} label={acessLabel} style={style} tour={dataSet?.tour}
      role={role} semTab={semTab} dados={dados}
      estado={role === "radio" ? { checked: !!on, selected: !!on, disabled: !!disabled } : undefined}>
      {filho}
    </PilulaWa>
  );
}

// ── Ícones (SVG do artboard, traço 1.8) ──────────────────────
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
} as const;

export function Ico({ nome, size = 17, cor = "currentColor", traco = 1.8, preencher = false }: {
  nome: keyof typeof ICONES; size?: number; cor?: string; traco?: number; preencher?: boolean;
}) {
  if (!WEB) return null;
  const filhos = ICONES[nome].map((p, i) => {
    if (p.startsWith("circle:")) { const [cx, cy, r] = p.slice(7).split(","); return createElement("circle", { key: i, cx, cy, r }); }
    if (p.startsWith("rect:")) { const [x, y, w, h, rx] = p.slice(5).split(","); return createElement("rect", { key: i, x, y, width: w, height: h, rx }); }
    return createElement("path", { key: i, d: p });
  });
  return createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true,
    fill: preencher ? cor : "none", stroke: preencher ? "none" : cor, strokeWidth: traco, strokeLinecap: "round", strokeLinejoin: "round",
    style: { flex: "none", display: "block" },
  }, ...filhos);
}

// ── Peças ────────────────────────────────────────────────────
/** Botão redondo 44 px (.ib). */
export function BotaoRedondo({ children, on, onPress, testID, size = 44, style, acessLabel, disabled, dataSet }: {
  children: ReactNode; on?: boolean; onPress?: () => void; testID?: string; size?: number; style?: StyleProp<ViewStyle>; acessLabel?: string; disabled?: boolean; dataSet?: any;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={acessLabel} {...(dataSet ? ({ dataSet } as any) : {})}
      style={[{
        width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", borderWidth: 1,
        borderColor: on ? V.lineOn : V.line, backgroundColor: on ? V.on : V.fill, opacity: disabled ? 0.55 : 1,
      }, style]}>
      {children}
    </Pressable>
  );
}

/** Botão principal violeta com o ícone em círculo (.btn1): o único sólido da tela. */
export function BotaoPrincipal({ children, onPress, testID, disabled, icone = "seta", style }: {
  children: string; onPress?: () => void; testID?: string; disabled?: boolean; icone?: keyof typeof ICONES; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={[{
        borderRadius: 999, minHeight: 50, paddingLeft: 22, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: "#7c3aed", opacity: disabled ? 0.5 : 1,
      }, web({
        backgroundImage: GRAD_BTN,
        boxShadow: "0 0 0 1.5px rgba(236,228,255,.8), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.25), 0 12px 28px rgba(60,20,140,.5)",
      }), style]}>
      <Text style={t(15, "#fff", "700", { lineHeight: 20 })}>{children}</Text>
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
      <Tx style={{ fontWeight: "700", fontSize: size >= 46 ? 15 : 14, color: V.avTxt, lineHeight: size >= 46 ? 20 : 18 }}>{iniciais(nome)}</Tx>
      {children}
    </View>
  );
}

/** Linha de luz no topo do vidro (.fio). */
export function Fio() {
  if (!WEB || modoLeve()) return null;
  return (
    <View pointerEvents="none" {...({ dataSet: { waAnim: "1" } } as any)}
      style={[{ position: "absolute", left: "12%", right: "12%", top: -1, height: 1, opacity: 0.6 }, web({ backgroundImage: "linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent)" }), ANIM_FIO]} />
  );
}

/** Barra de preenchimento com gradiente violeta. */
export function Barra({ pct, altura = 6, largura }: { pct: number; altura?: number; largura?: number | string }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ height: altura, width: largura as any, borderRadius: 999, backgroundColor: V.track, overflow: "hidden" }}>
      <View style={[{ width: `${p * 100}%`, height: "100%", borderRadius: 999, backgroundColor: "#a78bfa" }, web({ backgroundImage: "linear-gradient(90deg,#a78bfa,#f3efff)" })]} />
    </View>
  );
}
