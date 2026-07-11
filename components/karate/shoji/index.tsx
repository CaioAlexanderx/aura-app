// ============================================================
// Shoji Kit — Aura Karatê · 障子 Shoji / Kinari
//
// Camada de componentes do Design System Shoji em React Native,
// espelhando o shoji.css / _ds_manifest do design system canônico.
// Papel opaco, sumi, vermelhão raro, Shippori Mincho, sombras quentes.
//
// No web as fontes vêm do Google Fonts (useShojiFonts). No nativo,
// fallback de sistema até @expo-google-fonts (paridade).
// ============================================================
import React, { useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ViewStyle, TextStyle, StyleProp, Animated, Easing,
} from "react-native";
import { useCountUp } from "@/hooks/useCountUp";
import { TextInput } from "react-native";
import { useFonts } from "expo-font";
import { ShipporiMincho_400Regular } from "@expo-google-fonts/shippori-mincho";
import { ZenKakuGothicNew_400Regular } from "@expo-google-fonts/zen-kaku-gothic-new";
import { DMMono_400Regular } from "@expo-google-fonts/dm-mono";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R,
  KarateFonts as F, KarateType as T, KarateShadows as SH, KarateSpacing as SP,
  KarateStatus, KarateStatusKey, KarateDojoStatus, KarateAffiliationStatus,
  DojoStatus, AffiliationStatus, KarateBelts, resolveBeltKey,
} from "@/constants/karateTheme";

// ── tracking helper (em → px no RN) ─────────────────────────
const track = (em: number, fontSize: number) => em * fontSize;

// ── Fonts (web): injeta o stylesheet do Google Fonts uma vez ──
const GF_HREF =
  "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap";

export function useShojiFonts() {
  // Nativo: carrega os .ttf via expo-font (no web usamos a folha do Google Fonts).
  useFonts(Platform.OS === "web" ? {} : {
    ShipporiMincho:   ShipporiMincho_400Regular,
    ZenKakuGothicNew: ZenKakuGothicNew_400Regular,
    DMMono:           DMMono_400Regular,
    InstrumentSerif:  InstrumentSerif_400Regular,
  });
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("shoji-fonts")) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "anonymous";
    const link = document.createElement("link");
    link.id = "shoji-fonts"; link.rel = "stylesheet"; link.href = GF_HREF;
    document.head.appendChild(pre1); document.head.appendChild(pre2); document.head.appendChild(link);
  }, []);
}

// ── Fundo washi (papel + lavagem de chá + fibra), web-only overlays ──
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const TEA_WASH =
  "radial-gradient(1000px 760px at 88% 2%, rgba(184,70,58,0.05), transparent 60%), radial-gradient(820px 680px at 4% 100%, rgba(150,120,70,0.06), transparent 62%), radial-gradient(1200px 950px at 50% 42%, rgba(255,250,240,0.45), transparent 72%)";

export function ShojiBackground({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  useShojiFonts();
  return (
    <View style={[{ flex: 1, backgroundColor: P.paper }, style]}>
      {Platform.OS === "web" && (
        <>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: TEA_WASH } as any]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: NOISE, backgroundSize: "220px 220px", opacity: 0.1, mixBlendMode: "multiply" } as any]} />
        </>
      )}
      {children}
    </View>
  );
}

// ── Tipografia ───────────────────────────────────────────────
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, { letterSpacing: track(T.trackingEyebrow, T.xs) }, style]}>{children}</Text>;
}
export function Display({ children, style, dot }: { children: React.ReactNode; style?: StyleProp<TextStyle>; dot?: boolean }) {
  return <Text style={[styles.display, style]}>{children}{dot ? <Text style={{ color: P.red }}>.</Text> : null}</Text>;
}
export function H1({ children, style, dot }: { children: React.ReactNode; style?: StyleProp<TextStyle>; dot?: boolean }) {
  return <Text style={[styles.h1, style]}>{children}{dot ? <Text style={{ color: P.red }}>.</Text> : null}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function H3({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h3, style]}>{children}</Text>;
}
export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: C.ink3 }, style]}>{children}</Text>;
}
export function Mono({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.mono, style]}>{children}</Text>;
}

// ── Logo oficial da FPKT (marca dos headers) ─────────────────
export { FpktLogo } from "@/components/karate/FpktLogo";

// ── Selo 空 (flourish decorativo Shoji) ──────────────────────
export function Seal({ size = 42, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      width: size, height: size, borderRadius: size * 0.26,
      backgroundColor: P.red, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "rgba(43,38,32,0.14)",
    }, style]}>
      <Text style={{ fontFamily: F.heading, fontSize: size * 0.56, color: "#fbeee4", lineHeight: size * 0.7 }}>空</Text>
    </View>
  );
}

// ── PageHead (eyebrow + Mincho h1 c/ ponto vermelho + sub + ações) ──
export function PageHead({ eyebrow, title, sub, actions, style }: {
  eyebrow?: string; title: string; sub?: string; actions?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pageHead, style]}>
      <View style={{ flex: 1, minWidth: 240 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <H1 dot style={{ marginTop: eyebrow ? 14 : 0 }}>{title}</H1>
        {sub ? <Body muted style={{ marginTop: 14, maxWidth: 580, lineHeight: 21 }}>{sub}</Body> : null}
      </View>
      {actions ? <View style={styles.pageHeadActions}>{actions}</View> : null}
    </View>
  );
}

// ── SectionHead (h2 serif + filete vermelho) ─────────────────
export function SectionHead({ title, sub, actions, style }: {
  title: string; sub?: string; actions?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHead, style]}>
      <View style={{ flex: 1 }}>
        <H2>{title}</H2>
        <View style={styles.filete} />
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      {actions ? <View style={styles.sectionActions}>{actions}</View> : null}
    </View>
  );
}

// ── Card (vidro de papel) ────────────────────────────────────
export function Card({ children, style, flush }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  return <View style={[styles.card, flush && { padding: 0, overflow: "hidden" }, SH.card, style]}>{children}</View>;
}

// ── KPI band (faixa única dividida por hairlines) ────────────
export type KpiItem = { label: string; value: string | number; meta?: string; accent?: boolean };

// Count-up só quando o value já chega como NÚMERO puro (não string
// pré-formatada, ex. moeda/percentual — essas já vêm prontas dos callers
// via fmtMoney/fmtPct/toLocaleString e são mostradas direto, sem animar).
function KpiCell({ item, isLast }: { item: KpiItem; isLast: boolean }) {
  const isNumeric = typeof item.value === "number" && Number.isFinite(item.value);
  const animated = useCountUp(isNumeric ? (item.value as number) : 0, 700);
  const display = isNumeric ? Math.round(animated).toLocaleString("pt-BR") : String(item.value);
  return (
    <View style={[styles.kpiCell, !isLast && styles.kpiCellDivider]}>
      <Text style={styles.kpiLabel} numberOfLines={1}>{item.label}</Text>
      {/* numberOfLines={1}: defesa contra bandas com muitas colunas — sem isso um
          valor monetário longo (ex. "R$ 37.465") pode quebrar NO MEIO do número
          em vez de truncar de forma previsível. */}
      <Text style={[styles.kpiNum, item.accent && { color: P.red }]} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
      {item.meta ? <Text style={styles.kpiMeta} numberOfLines={1}>{item.meta}</Text> : null}
    </View>
  );
}

export function KpiBand({ items, style }: { items: KpiItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.kpiBand, SH.card, style]}>
      {items.map((k, i) => (
        <KpiCell key={i} item={k} isLast={i === items.length - 1} />
      ))}
    </View>
  );
}

// ── Bar row (gráfico de barras) ──────────────────────────────
// `index` (opcional) escalona o crescimento da barra (stagger ~60ms por
// posição) — usado na pirâmide de faixas do Painel. Sem index, anima sem
// delay (comportamento padrão preservado).
export function BarRow({ label, value, max, color, index }: { label: string; value: number; max: number; color?: string; index?: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  const anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const delay = Math.min(index ?? 0, 20) * 60;
    const timer = Animated.timing(anim, {
      toValue: pct,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timer.start();
    return () => { timer.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, index]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width, backgroundColor: color ?? C.ink2 }]} />
      </View>
      <Text style={styles.barVal}>{value}</Text>
    </View>
  );
}

// ── Alert (acompanhamento) ───────────────────────────────────
export function Alert({ urgent, title, desc, when, onPress }: {
  urgent?: boolean; title: string; desc?: string; when?: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.alert, SH.sm]} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <View style={[styles.alertMarker, urgent && { backgroundColor: P.red }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.alertTitle}>{title}</Text>
        {desc ? <Text style={styles.alertDesc}>{desc}</Text> : null}
      </View>
      {when ? <Mono style={{ fontSize: 11, color: C.ink3 }}>{when}</Mono> : null}
      {onPress ? <Icon name="chevron_right" size={16} color={C.ink4} /> : null}
    </TouchableOpacity>
  );
}

// ── Botões Shoji (sumi/ghost/text/accent) ────────────────────
type BtnVariant = "sumi" | "ghost" | "text" | "accent";
export function ShojiButton({ label, icon, variant = "sumi", onPress, style }: {
  label: string; icon?: string; variant?: BtnVariant; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const v = BTN[variant];
  return (
    <TouchableOpacity style={[styles.btn, v.box, variant !== "text" && SH.sm, style]} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      {icon ? <Icon name={icon as any} size={14} color={v.fg} /> : null}
      <Text style={[styles.btnLabel, { color: v.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const BTN: Record<BtnVariant, { box: ViewStyle; fg: string }> = {
  sumi:   { box: { backgroundColor: P.ink }, fg: P.paperWarm },
  ghost:  { box: { backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2 }, fg: P.ink },
  text:   { box: { backgroundColor: "transparent", paddingHorizontal: 8 }, fg: P.red },
  accent: { box: { backgroundColor: P.red }, fg: "#fdf8f2" },
};

// ── Pill ─────────────────────────────────────────────────────
export function Pill({ label, accent, style }: { label: string; accent?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, accent && { backgroundColor: P.redWash, borderColor: P.redLine }, style]}>
      <Text style={[styles.pillText, accent && { color: P.red, fontWeight: "600" }]}>{label}</Text>
    </View>
  );
}

// ── SearchField ──────────────────────────────────────────────
export function SearchField({ value, onChangeText, placeholder, onSubmit, style }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; onSubmit?: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.search, style]}>
      <Icon name="search" size={16} color={C.ink3} />
      <TextInput
        style={styles.searchInput as any}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.ink4}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}

// ── Chip (filtro) ────────────────────────────────────────────
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Badge de status (icon + texto, nunca cor isolada) ────────
export function ShojiBadge({ status, dojoStatus, affiliationStatus, label }: {
  status?: KarateStatusKey; dojoStatus?: DojoStatus; affiliationStatus?: AffiliationStatus; label?: string;
}) {
  let color: string, bg: string, icon: string, txt: string;
  // b1: fallback defensivo — se `dojoStatus` vier com um valor que a UI ainda
  // não conhece (ex.: novo status do backend), cai em "Inativo" em vez de
  // quebrar o render.
  if (dojoStatus) { const s = KarateDojoStatus[dojoStatus] ?? KarateDojoStatus.inactive; color = s.color; bg = s.bg; icon = s.icon; txt = label ?? s.label; }
  else if (affiliationStatus) { const s = KarateAffiliationStatus[affiliationStatus] ?? KarateAffiliationStatus.inactive; color = s.color; bg = s.bg; icon = s.icon; txt = label ?? s.label; }
  else { const s = KarateStatus[status ?? "neutral"]; color = s.color; bg = s.bg; icon = s.icon; txt = label ?? (status ?? ""); }
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessibilityLabel={txt}>
      <Icon name={icon as any} size={11} color={color} />
      <Text style={[styles.badgeText, { color }]}>{txt}</Text>
    </View>
  );
}

// ── BeltTag (faixa dessaturada) ──────────────────────────────
export function BeltTag({ level, name }: { level: string; name?: string }) {
  const key = resolveBeltKey(level);
  const belt = key ? KarateBelts[key] : null;
  return (
    <View style={styles.beltCell}>
      <View style={[styles.beltDot, { backgroundColor: belt?.color ?? C.ink4 }]} />
      <Text style={styles.beltLabel}>{name ?? belt?.label ?? level}</Text>
    </View>
  );
}

// ── Avatar (iniciais) ────────────────────────────────────────
export function Avatar({ name, size = 32, dark, accent }: { name: string; size?: number; dark?: boolean; accent?: boolean }) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 },
      dark && { backgroundColor: P.ink, borderColor: P.ink }, accent && { backgroundColor: P.red, borderColor: P.red2 }]}>
      <Text style={[styles.avatarTxt, { fontSize: size * 0.4 }, (dark || accent) && { color: "#fdf8f2" }]}>{initials}</Text>
    </View>
  );
}

// ── KV (cadastro) ────────────────────────────────────────────
export function KV({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // typography
  eyebrow: { fontFamily: F.body, fontSize: T.xs, fontWeight: "500", color: C.ink3, textTransform: "uppercase" } as TextStyle,
  display: { fontFamily: F.heading, fontSize: T.display, fontWeight: "400", color: C.ink, lineHeight: T.display } as TextStyle,
  h1:      { fontFamily: F.heading, fontSize: T.h1, fontWeight: "400", color: C.ink, lineHeight: T.h1 * 1.05 } as TextStyle,
  h2:      { fontFamily: F.heading, fontSize: T.h2, fontWeight: "400", color: C.ink, lineHeight: T.h2 * 1.1 } as TextStyle,
  h3:      { fontFamily: F.heading, fontSize: T.h3, fontWeight: "400", color: C.ink, lineHeight: T.h3 * 1.15 } as TextStyle,
  body:    { fontFamily: F.body, fontSize: T.body, color: C.ink2, lineHeight: T.body * 1.6 } as TextStyle,
  mono:    { fontFamily: F.mono, fontSize: T.sm, color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,

  // page head
  pageHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: SP[12] } as ViewStyle,
  pageHeadActions: { flexDirection: "row", gap: 10, alignItems: "center" } as ViewStyle,

  // section head
  sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, paddingBottom: SP[4], marginBottom: SP[6], borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  filete: { width: 34, height: 2, backgroundColor: P.red, opacity: 0.7, marginTop: 12 } as ViewStyle,
  sectionSub: { fontFamily: F.body, fontSize: T.sm, color: C.ink3, marginTop: 6 } as TextStyle,
  sectionActions: { flexDirection: "row", gap: 8, alignItems: "center" } as ViewStyle,

  // card
  card: { backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.xl, padding: SP[6] } as ViewStyle,

  // kpi band
  kpiBand: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: C.line, borderRadius: R.xl, backgroundColor: P.glass, overflow: "hidden" } as ViewStyle,
  kpiCell: { flexGrow: 1, flexBasis: 160, paddingVertical: 24, paddingHorizontal: 24 } as ViewStyle,
  kpiCellDivider: { borderRightWidth: 1, borderRightColor: C.line } as ViewStyle,
  kpiLabel: { fontFamily: F.body, fontSize: T.label, fontWeight: "500", color: C.ink3, textTransform: "uppercase", letterSpacing: track(T.trackingLabel, T.label) } as TextStyle,
  kpiNum: { fontFamily: F.heading, fontSize: T.kpi, fontWeight: "400", color: C.ink, marginTop: 14, lineHeight: T.kpi } as TextStyle,
  kpiMeta: { fontFamily: F.body, fontSize: T.xs, color: C.ink3, marginTop: 12 } as TextStyle,

  // bars
  barRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 } as ViewStyle,
  barLabel: { width: 120, fontFamily: F.body, fontSize: T.sm, color: C.ink2 } as TextStyle,
  barTrack: { flex: 1, height: 7, borderRadius: 999, backgroundColor: "rgba(43,38,32,0.06)", overflow: "hidden" } as ViewStyle,
  barFill: { height: "100%", borderRadius: 999 } as ViewStyle,
  barVal: { width: 40, textAlign: "right", fontFamily: F.mono, fontSize: T.sm, color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,

  // alert
  alert: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 18, paddingHorizontal: 22, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, backgroundColor: P.glass } as ViewStyle,
  alertMarker: { width: 3, height: 32, borderRadius: 2, backgroundColor: C.ink4 } as ViewStyle,
  alertTitle: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink, lineHeight: 18 } as TextStyle,
  alertDesc: { fontFamily: F.body, fontSize: T.sm, color: C.ink3, marginTop: 4 } as TextStyle,

  // button
  btn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10, paddingHorizontal: 16, borderRadius: R.md } as ViewStyle,
  btnLabel: { fontFamily: F.body, fontSize: 12.5, fontWeight: "500" } as TextStyle,

  // pill
  pill: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, borderRadius: R.pill, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line } as ViewStyle,
  pillText: { fontFamily: F.body, fontSize: T.xs, fontWeight: "500", color: C.ink2 } as TextStyle,

  // search
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 } as ViewStyle,
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink, minHeight: 22, outlineStyle: "none" } as any,

  // chip
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: R.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2 } as ViewStyle,
  chipActive: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  chipText: { fontFamily: F.body, fontSize: T.sm, fontWeight: "500", color: C.ink3 } as TextStyle,
  chipTextActive: { color: P.red, fontWeight: "700" } as TextStyle,

  // badge
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 10, borderRadius: R.pill } as ViewStyle,
  badgeText: { fontFamily: F.body, fontSize: T.xs, fontWeight: "600" } as TextStyle,

  // belt
  beltCell: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  beltDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(43,38,32,0.15)" } as ViewStyle,
  beltLabel: { fontFamily: F.body, fontSize: T.sm, color: C.ink2 } as TextStyle,

  // avatar
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  avatarTxt: { fontFamily: F.body, fontWeight: "600", color: C.ink } as TextStyle,

  // kv
  kvRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line, gap: 16 } as ViewStyle,
  kvKey: { width: 140, fontFamily: F.body, fontSize: T.xs, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600" } as TextStyle,
  kvVal: { flex: 1, fontFamily: F.body, fontSize: T.body, color: C.ink } as TextStyle,
});
