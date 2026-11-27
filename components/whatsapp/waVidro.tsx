// ============================================================
// waVidro — a linguagem visual aprovada da aba Configurações do WhatsApp
//
// Traduz o CSS dos artboards (Automaticas, Aniversario, Crediario, VendaMais,
// Editor) para estilos do RN Web: vidro (fundo translúcido + blur + borda
// clara), títulos grandes com o ponto violeta, DM Sans / DM Mono, botão
// principal com gradiente, pílulas, cápsulas e a bolha "Como chega".
//
// No web, backdropFilter, gradientes e sombras vão por estilo web (`as any`),
// com fundo sólido de reserva. Fora do web (celular, jest) só o que o RN
// entende vale: nada daqui muda comportamento, só aparência.
// Tema: o app troca de tema recarregando a página, então a escolha por
// IS_DARK_MODE no carregamento do módulo é segura. Claro = versão coerente
// (paleta da página de regras do mockup).
// ============================================================
import React from "react";
import { View, Text, Pressable, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { animCai, animVai, ANIM_TRACA, ANIM_BRILHO, ANIM_FIO, ANIM_POUSA, ANIM_POP, ANIM_RISE, ESCURO, GRAD_BTN, modoLeve, GRAD_TITULO, MONO, SANS, V, WEB, estiloBolha, estiloSuperficie, useWaFontes, useWaKeyframes, useWaQuedas, type VarianteSuperficie } from "./waVisual";
export { animCai, animVai, ANIM_TRACA, ESCURO, EDITOR_INLINE, MONO, SANS, V, WEB, estiloBolha, estiloSuperficie, useWaFontes, useWaKeyframes, useWaQuedas, modoLeve } from "./waVisual";
import { Icon } from "@/components/Icon";
import { tourTarget } from "@/utils/tourTarget";

// ── Superfícies ──────────────────────────────────────────────────────
interface SuperficieProps {
  variante?: VarianteSuperficie;
  raio?: number;
  padding?: number | { h: number; v: number };
  gap?: number;
  style?: any;
  testID?: string;
  /** Chave do tour (data-tour) para os guias apontarem. */
  tour?: string;
  children?: React.ReactNode;
}

export function Superficie({ variante = "glass", raio = 28, padding = 22, gap = 14, style, testID, tour, children }: SuperficieProps) {
  const pad = typeof padding === "number" ? { padding } : { paddingHorizontal: padding.h, paddingVertical: padding.v };
  return (
    <View style={[estiloSuperficie(variante, raio), pad, { gap, minWidth: 0 }, variante === "dry" ? null : ANIM_RISE, style]} testID={testID} {...(WEB ? ({ dataSet: { waAnim: "1", ...(tour ? { tour } : {}) } } as any) : {})}>
      {variante === "glass" && WEB && !modoLeve() && (
        // fio de luz no alto do vidro
        <View
          pointerEvents="none"
          style={{
            position: "absolute", left: "12%", right: "12%", top: -1, height: 1, opacity: 0.6,
            backgroundImage: "linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent)", ...ANIM_FIO,
          } as any}
        />
      )}
      {children}
    </View>
  );
}

/** Os brilhos violeta atrás da tela (os "spots" do mockup). */
export function Spots() {
  if (!WEB) return null;
  const spot = (st: any) => (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", borderRadius: 9999,
        backgroundImage: `radial-gradient(closest-side,${V.spot},rgba(124,58,237,0))`, ...st,
      } as any}
    />
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden", zIndex: 0 } as any}>
      {spot({ left: "6%", top: 120, width: 900, height: 520 })}
      {spot({ left: "46%", top: 620, width: 760, height: 460, opacity: 0.5 })}
    </View>
  );
}

// ── Texto ────────────────────────────────────────────────────────────
export function Meta({ children, style, testID }: { children?: React.ReactNode; style?: any; testID?: string }) {
  return (
    <Text
      testID={testID}
      style={[{
        fontFamily: MONO, fontWeight: "500", fontSize: 12, letterSpacing: 1.7, textTransform: "uppercase", color: V.ink3,
      } as any, style]}
    >
      {children}
    </Text>
  );
}

/** Título grande (h1 52 / h2 30) com o ponto violeta. */
export function Titulo({ children, tamanho = 52, ponto = true, testID, style }: {
  children?: React.ReactNode; tamanho?: number; ponto?: boolean; testID?: string; style?: any;
}) {
  const fonte = WEB && tamanho >= 36 ? tamanho : tamanho;
  const gradiente: any = WEB
    ? { backgroundImage: GRAD_TITULO, ...(tamanho >= 40 ? { backgroundSize: "100% 220%" } : {}), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" }
    : { color: V.ink };
  return (
    <Text
      accessibilityRole="header"
      testID={testID}
      style={[{
        fontFamily: SANS, fontWeight: "800", fontSize: fonte, lineHeight: Math.round(fonte * 1.04),
        letterSpacing: -fonte * (tamanho >= 40 ? 0.045 : 0.035), ...gradiente, ...(tamanho >= 40 ? ANIM_BRILHO : null),
      } as any, style]}
    >
      {children}
      {ponto && <Text style={{ color: V.acc2, ...(WEB ? { WebkitTextFillColor: V.acc2 } : {}) } as any}>.</Text>}
    </Text>
  );
}

export function t(tamanho: number, cor: string = V.ink2, peso: any = "400", extra?: any): any {
  return { fontFamily: SANS, fontSize: tamanho, color: cor, fontWeight: peso, lineHeight: Math.round(tamanho * 1.45), ...extra };
}

/** "← Automáticas": volta à seção anterior. */
export function Voltar({ rotulo, onPress, testID }: { rotulo: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID} style={{ minHeight: 32, justifyContent: "center", alignSelf: "flex-start" }}>
      <Text style={t(14, V.acc, "600")}>← {rotulo}</Text>
    </Pressable>
  );
}

// ── Botões ───────────────────────────────────────────────────────────
/** Botão principal: gradiente violeta, anel claro e a bolinha com a seta. */
export function BtnPrimario({ children, rotuloCurto, onPress, desabilitado, disabled, carregando, testID, semSeta, tour }: {
  children?: React.ReactNode;
  /** Celular (até 400 px): rótulo mais curto, para o botão manter a seta e ficar em uma linha. */
  rotuloCurto?: string;
  onPress?: () => void; desabilitado?: boolean; disabled?: boolean; carregando?: boolean; testID?: string; semSeta?: boolean; tour?: string;
}) {
  const off = !!(desabilitado || disabled);
  const { width } = useWindowDimensions();
  const larguraReal = WEB && typeof window !== "undefined" && window.innerWidth ? window.innerWidth : width; // o hook só faz repintar no resize
  const estreito = larguraReal <= 400; // celular: rótulo curto; o botão (.btn1) é o mesmo do desktop, com a seta
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      testID={testID}
      {...(tour ? tourTarget(tour) : {})}
      style={[{
        flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 12, minHeight: 50,
        paddingLeft: 22, paddingRight: semSeta ? 22 : 8, borderRadius: 999, backgroundColor: "#7c3aed",
        opacity: off ? 0.45 : 1,
      } as any, WEB ? {
        isolation: "isolate",
        backgroundImage: GRAD_BTN,
        boxShadow: "0 0 0 1.5px rgba(236,228,255,.8), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.25), 0 12px 28px rgba(60,20,140,.5)",
      } as any : null]}
    >
      {WEB && !off && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: -30, right: -30, top: -18, bottom: -18, borderRadius: 999, zIndex: -1, backgroundImage: "radial-gradient(closest-side,rgba(196,181,253,.45),rgba(139,92,246,0))", ...ANIM_POUSA } as any}
        />
      )}
      {carregando && <ActivityIndicator size="small" color="#fff" />}
      <Text numberOfLines={1} style={t(15, "#fff", "700", { flexShrink: 0 })}>{estreito && rotuloCurto ? rotuloCurto : children}</Text>
      {!semSeta && (
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(9,9,11,.28)" }}>
          <Icon name="arrow_right" size={16} color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

/** O botão sem permissão (tracejado): "Ajuste o item amarelo para mandar". */
export function BtnTracejado({ children, testID, disabled = true, onPress }: { children?: React.ReactNode; testID?: string; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} testID={testID}
      style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: V.capFreeLine, alignSelf: "flex-start" }}
    >
      <Text style={t(14, V.ink2, "600")}>{children}</Text>
    </Pressable>
  );
}
/** Pílula (.pill): `ligada` pinta a escolhida; `peq` é a .pill.sm. */
export function Pilula({ children, ligada, onPress, desabilitado, disabled, peq, testID, role = "button", estado, style, tour, label }: {
  children?: React.ReactNode; ligada?: boolean; onPress?: () => void; desabilitado?: boolean; disabled?: boolean; peq?: boolean; testID?: string;
  role?: "button" | "checkbox" | "radio"; estado?: any; style?: any; tour?: string; label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado || disabled}
      accessibilityRole={role as any}
      accessibilityLabel={label}
      {...(tour ? tourTarget(tour) : {})}
      accessibilityState={estado || { selected: !!ligada, disabled: !!(desabilitado || disabled) }}
      testID={testID}
      style={[{
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: peq ? 36 : 44,
        paddingHorizontal: peq ? 12 : 16, borderRadius: 999, borderWidth: 1,
        borderColor: ligada ? V.lineOn : V.line, backgroundColor: ligada ? V.on : V.fill,
        opacity: (desabilitado || disabled) ? 0.5 : 1,
      } as any, style]}
    >
      {typeof children === "string"
        ? <Text style={t(peq ? 13 : 14, ligada ? V.onTxt : V.ink, "600")}>{children}</Text>
        : children}
    </Pressable>
  );
}

/** Link (.lnk). */
export function Lnk({ children, onPress, testID, style, desabilitado, tour }: {
  children?: React.ReactNode; onPress?: () => void; testID?: string; style?: any; desabilitado?: boolean; tour?: string;
}) {
  return (
    <Pressable
      onPress={onPress} disabled={desabilitado} accessibilityRole="button" testID={testID} {...(tour ? tourTarget(tour) : {})}
      style={[{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4, alignSelf: "flex-start", opacity: desabilitado ? 0.5 : 1 }, style]}
    >
      <Text style={t(14, V.acc, "600")}>{children}</Text>
    </Pressable>
  );
}

/** Interruptor 56x32 do mockup. */
export function Sw({ ligado, onToggle, onPress, desabilitado, rotulo, testID, tour }: {
  ligado: boolean; onToggle?: () => void; onPress?: () => void; desabilitado?: boolean; rotulo: string; testID: string; tour?: string;
}) {
  return (
    <Pressable
      {...(tour ? tourTarget(tour) : {})}
      onPress={onPress || onToggle}
      disabled={desabilitado}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado, disabled: !!desabilitado }}
      accessibilityLabel={rotulo}
      testID={testID}
      style={[{
        width: 56, height: 32, borderRadius: 999, borderWidth: 1, justifyContent: "center",
        borderColor: ligado ? "rgba(236,228,255,.75)" : V.swLine,
        backgroundColor: ligado ? "#7c3aed" : V.swOff, opacity: desabilitado ? 0.6 : 1,
      } as any, WEB && ligado ? ({ backgroundImage: "linear-gradient(135deg,#8b5cf6,#6d28d9)" } as any) : null]}
    >
      <View
        style={{
          position: "absolute", top: 3, left: ligado ? 27 : 3, width: 24, height: 24, borderRadius: 12,
          backgroundColor: ligado ? "#f3efff" : V.knob,
          ...(WEB ? { boxShadow: "0 2px 6px rgba(0,0,0,.4)", transition: "left .24s cubic-bezier(.2,.8,.2,1)" } : {}),
        } as any}
      />
    </Pressable>
  );
}

/** + e − da divisão (.step 44x44). */
export function Passo44({ rotulo, simbolo, onPress, disabled, testID }: {
  rotulo: string; simbolo: string; onPress: () => void; disabled?: boolean; testID: string;
}) {
  return (
    <Pressable
      onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!disabled }} testID={testID}
      style={{
        width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1,
        borderColor: V.line, backgroundColor: V.fill, opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text style={t(20, V.ink, "600", { lineHeight: 24 })}>{simbolo}</Text>
    </Pressable>
  );
}

// ── Bolha "Como chega" ───────────────────────────────────────────────
/** O celular do mockup: cabeçalho da loja + a bolha (children). */
export function Celular({ loja, legenda, children, minAltura = 240, testID }: {
  loja: string; legenda: string; children?: React.ReactNode; minAltura?: number; testID?: string;
}) {
  const ini = (loja || "A").trim().charAt(0).toUpperCase();
  return (
    <Superficie variante="solid" raio={34} padding={14} gap={12} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: V.rule }}>
        <View
          style={[{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#2a1a63" } as any,
            WEB ? ({ backgroundImage: "radial-gradient(120% 90% at 10% 0%,#5b3fb0,#1c1240 70%)" } as any) : null]}
        >
          <Text style={{ fontFamily: WEB ? 'Georgia, "Instrument Serif", serif' : undefined, fontSize: 18, color: "#f3efff" } as any}>
            {ini}<Text style={{ color: "#c4b5fd" }}>.</Text>
          </Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={t(15, V.ink, "700")}>{loja || "Sua loja"}</Text>
          <Text style={t(12, V.ink3)}>{legenda}</Text>
        </View>
      </View>
      <View style={{ minHeight: minAltura, justifyContent: "flex-end", gap: 10, padding: 6 }}>{children}</View>
    </Superficie>
  );
}

/** Cartinha de destaque (badge do mockup): "Pronta", "Em aprovação"... */
export function Selo({ texto, tom, testID }: { texto: string; tom: "ok" | "warn" | "danger" | "neutro"; testID?: string }) {
  const bg = tom === "ok" ? V.okBg : tom === "warn" ? V.warnBg : tom === "danger" ? V.badBg : V.fill2;
  const cor = tom === "ok" ? V.ok : tom === "warn" ? V.warn : tom === "danger" ? V.bad : V.ink2;
  return (
    <View testID={testID} style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: bg, justifyContent: "center" }}>
      <Text style={t(13, cor, "600", { lineHeight: 18 })}>{texto}</Text>
    </View>
  );
}

/** Círculo com as iniciais (.av). */
export function Avatar({ nome, cor, tamanho = 40 }: { nome: string; cor?: string; tamanho?: number }) {
  const partes = String(nome || "?").trim().split(/\s+/);
  const ini = ((partes[0]?.[0] || "?") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  const paleta = ["#fde68a", "#fbcfe8", "#a7f3d0", "#e9e3ff", "#bfdbfe"];
  const c = cor || paleta[(ini.charCodeAt(0) + (ini.charCodeAt(1) || 0)) % paleta.length];
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, alignItems: "center", justifyContent: "center", backgroundColor: c }}>
      <Text style={t(13, V.avTxt, "700", { lineHeight: 16 })}>{ini}</Text>
    </View>
  );
}

/** O ícone do botão Guias (ponto de interrogação no círculo, do artboard GuiaCentral): SVG inline no web. */
export function IconeAjuda({ tamanho = 17, cor }: { tamanho?: number; cor?: string }) {
  const c = cor || V.ink;
  if (!WEB) return <Text style={t(tamanho, c, "700", { lineHeight: tamanho + 2 })}>?</Text>;
  return React.createElement(
    "svg",
    { width: tamanho, height: tamanho, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    React.createElement("circle", { cx: 12, cy: 12, r: 9 }),
    React.createElement("path", { d: "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" }),
  );
}
