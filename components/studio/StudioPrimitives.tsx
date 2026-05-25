// ============================================================
// AURA STUDIO · Primitives (Fase 8 — Design System)
//
// Consolida 6 componentes atômicos usados em todas as telas.
// Tudo num único arquivo pra reduzir overhead de imports.
//
// Componentes exportados:
//   - <StudioBrandMark size={40} />        — logo bolha navy→magenta com sparkle
//   - <GlassCard pad="lg" tone="primary">  — card translúcido com bordas orgânicas
//   - <BubbleIcon ico="..." tone="navy">   — círculo gradient com ícone interno
//   - <GradientHeader title="..." sub="..." gradient="brand" />
//   - <AlertBadge severity="warning" />    — badge minimalista de alerta
//   - <KpiTile label value icon tone />    — card de KPI com bolha
// ============================================================
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioTokens, StudioRadiusV2 } from "@/constants/studio-tokens-v2";

// ─── 1. StudioBrandMark ─────────────────────────────────────
type BrandProps = { size?: number; letter?: string };
export function StudioBrandMark({ size = 54, letter = "S" }: BrandProps) {
  return (
    <View
      style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: StudioTokens.primary,
        alignItems: "center", justifyContent: "center",
        position: "relative",
        shadowColor: StudioTokens.primary,
        shadowOpacity: 0.4, shadowRadius: size / 4,
        shadowOffset: { width: 0, height: size / 8 },
        elevation: 6,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.42, letterSpacing: -0.5 }}>
        {letter}
      </Text>
      <Text style={{ position: "absolute", top: -size * 0.15, right: -size * 0.18, fontSize: size * 0.28 }}>
        ✨
      </Text>
    </View>
  );
}

// ─── 2. GlassCard ───────────────────────────────────────────
type GlassProps = {
  children: React.ReactNode;
  pad?: "sm" | "md" | "lg";
  tone?: "neutral" | "primary" | "accent" | "warm" | "mint";
  organic?: 1 | 2 | 3 | 4;
  style?: any;
};
const TONE_BG = {
  neutral: StudioTokens.paperCard,
  primary: StudioTokens.primaryGhost,
  accent:  StudioTokens.accentGhost,
  warm:    StudioTokens.warningSoft,
  mint:    StudioTokens.successSoft,
};
const PAD = { sm: 12, md: 16, lg: 22 };
export function GlassCard({ children, pad = "md", tone = "neutral", organic, style }: GlassProps) {
  const radiusKey = organic ? `organic${organic}` as const : null;
  return (
    <View
      style={[{
        backgroundColor: TONE_BG[tone],
        padding: PAD[pad],
        borderRadius: radiusKey ? undefined : StudioRadiusV2.xl,
        borderWidth: 1,
        borderColor: StudioTokens.borderSoft,
      }, radiusKey && { borderRadius: undefined, ...({ borderRadius: StudioRadiusV2[radiusKey] } as any) }, style]}
    >
      {children}
    </View>
  );
}

// ─── 3. BubbleIcon ──────────────────────────────────────────
type BubbleProps = {
  ico: string;
  tone?: "navy" | "accent" | "warm" | "mint" | "violet" | "sky";
  size?: number;
  organic?: 1 | 2 | 3 | 4;
};
const BUBBLE_BG = {
  navy:    StudioTokens.primary,
  accent:  StudioTokens.accent,
  warm:    StudioTokens.warning,
  mint:    StudioTokens.success,
  violet:  "#7C3AED",
  sky:     "#06B6D4",
};
export function BubbleIcon({ ico, tone = "navy", size = 44, organic }: BubbleProps) {
  const radius = organic ? StudioRadiusV2[`bubble${organic}` as const] : size / 2;
  return (
    <View
      style={{
        width: size, height: size,
        borderRadius: typeof radius === "number" ? radius : undefined,
        ...(typeof radius === "string" ? { borderRadius: radius as any } : {}),
        backgroundColor: BUBBLE_BG[tone],
        alignItems: "center", justifyContent: "center",
        shadowColor: BUBBLE_BG[tone],
        shadowOpacity: 0.35, shadowRadius: size / 5,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <Icon name={ico as any} size={size * 0.45} color="#fff" />
    </View>
  );
}

// ─── 4. GradientHeader (texto com gradient simulado) ───────
type HeaderProps = {
  eyebrow?: string;
  title: string;
  sub?: string;
  rightSlot?: React.ReactNode;
};
export function GradientHeader({ eyebrow, title, sub, rightSlot }: HeaderProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <View style={{ flex: 1, minWidth: 280 }}>
        {eyebrow && (
          <Text style={{ fontSize: 11, color: StudioTokens.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>
            {eyebrow}
          </Text>
        )}
        <Text style={{ fontSize: 24, fontWeight: "800", color: StudioTokens.ink, marginTop: 4, letterSpacing: -0.4 }}>
          {title}
        </Text>
        {sub && (
          <Text style={{ fontSize: 13.5, color: StudioTokens.ink3, marginTop: 4 }}>
            {sub}
          </Text>
        )}
      </View>
      {rightSlot}
    </View>
  );
}

// ─── 5. AlertBadge ──────────────────────────────────────────
type AlertProps = {
  severity: "info" | "warning" | "danger";
  label: string;
};
const SEV_STYLES = {
  info:    { bg: StudioTokens.infoSoft,    fg: "#1E40AF" },
  warning: { bg: StudioTokens.warningSoft, fg: "#92400E" },
  danger:  { bg: StudioTokens.dangerSoft,  fg: "#991B1B" },
};
export function AlertBadge({ severity, label }: AlertProps) {
  const sv = SEV_STYLES[severity];
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: sv.bg,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sv.fg }} />
      <Text style={{ fontSize: 11, color: sv.fg, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

// ─── 6. KpiTile ─────────────────────────────────────────────
type KpiProps = {
  label: string;
  value: string;
  ico: string;
  tone?: "navy" | "accent" | "warm" | "mint";
  trend?: { dir: "up" | "down"; pct: number };
  onPress?: () => void;
};
export function KpiTile({ label, value, ico, tone = "navy", trend, onPress }: KpiProps) {
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={{
        flex: 1, minWidth: 150,
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: StudioTokens.paperCard,
        borderRadius: StudioRadiusV2.lg, padding: 14,
        borderWidth: 1, borderColor: StudioTokens.borderSoft,
      }}
    >
      <BubbleIcon ico={ico} tone={tone} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 11, color: StudioTokens.ink3, fontWeight: "600" }} numberOfLines={1}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: StudioTokens.ink, letterSpacing: -0.2 }}>
            {value}
          </Text>
          {trend && (
            <Text style={{
              fontSize: 10.5, fontWeight: "800",
              color: trend.dir === "up" ? StudioTokens.success : StudioTokens.danger,
              backgroundColor: trend.dir === "up" ? StudioTokens.successSoft : StudioTokens.dangerSoft,
              paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
            }}>
              {trend.dir === "up" ? "↑" : "↓"} {trend.pct}%
            </Text>
          )}
        </View>
      </View>
    </Wrap>
  );
}
