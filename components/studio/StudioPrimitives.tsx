// ============================================================
// AURA STUDIO · Primitives (Fase 8 — Design System)
// Fase 0 redesign (30/05/2026): theme-aware. Cores vêm de
// useStudioTokens() (light+dark) e estado de useStudioSemantic().
// Radius/scale (StudioRadiusV2) seguem estáticos (theme-independent).
//
// Componentes exportados:
//   - <StudioBrandMark size={40} />
//   - <GlassCard pad="lg" tone="primary">
//   - <BubbleIcon ico="..." tone="navy">
//   - <GradientHeader title="..." sub="..." />
//   - <AlertBadge severity="warning" />
//   - <KpiTile label value icon tone />
// ============================================================
import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioRadiusV2 } from "@/constants/studio-tokens-v2";
import { useStudioTokens, useStudioSemantic } from "@/contexts/StudioThemeMode";

// ─── 1. StudioBrandMark ─────────────────────────────────────
type BrandProps = { size?: number; letter?: string };
export function StudioBrandMark({ size = 54, letter = "S" }: BrandProps) {
  const t = useStudioTokens();
  return (
    <View
      style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: t.primary,
        alignItems: "center", justifyContent: "center",
        position: "relative",
        shadowColor: t.primary,
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
const PAD = { sm: 12, md: 16, lg: 22 };
export function GlassCard({ children, pad = "md", tone = "neutral", organic, style }: GlassProps) {
  const t = useStudioTokens();
  const TONE_BG: Record<NonNullable<GlassProps["tone"]>, string> = {
    neutral: t.paperCard,
    primary: t.primaryGhost,
    accent:  t.accentGhost,
    warm:    t.warningSoft,
    mint:    t.successSoft,
  };
  const radiusKey = organic ? (`organic${organic}` as const) : null;
  return (
    <View
      style={[{
        backgroundColor: TONE_BG[tone],
        padding: PAD[pad],
        borderRadius: radiusKey ? (StudioRadiusV2[radiusKey] as any) : StudioRadiusV2.xl,
        borderWidth: 1,
        borderColor: t.ink5,
      }, style]}
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
export function BubbleIcon({ ico, tone = "navy", size = 44, organic }: BubbleProps) {
  const t = useStudioTokens();
  const BUBBLE_BG: Record<NonNullable<BubbleProps["tone"]>, string> = {
    navy:   t.primary,
    accent: t.accent,
    warm:   t.warning,
    mint:   t.success,
    violet: t.violet,
    sky:    t.sky,
  };
  const radius = organic ? StudioRadiusV2[`bubble${organic}` as const] : size / 2;
  const bg = BUBBLE_BG[tone];
  return (
    <View
      style={{
        width: size, height: size,
        borderRadius: typeof radius === "number" ? radius : undefined,
        ...(typeof radius === "string" ? { borderRadius: radius as any } : {}),
        backgroundColor: bg,
        alignItems: "center", justifyContent: "center",
        shadowColor: bg,
        shadowOpacity: 0.35, shadowRadius: size / 5,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <Icon name={ico as any} size={size * 0.45} color="#fff" />
    </View>
  );
}

// ─── 4. GradientHeader ──────────────────────────────────────
type HeaderProps = {
  eyebrow?: string;
  title: string;
  sub?: string;
  rightSlot?: React.ReactNode;
};
export function GradientHeader({ eyebrow, title, sub, rightSlot }: HeaderProps) {
  const t = useStudioTokens();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <View style={{ flex: 1, minWidth: 280 }}>
        {eyebrow && (
          <Text style={{ fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>
            {eyebrow}
          </Text>
        )}
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.4 }}>
          {title}
        </Text>
        {sub && (
          <Text style={{ fontSize: 13.5, color: t.ink3, marginTop: 4 }}>
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
export function AlertBadge({ severity, label }: AlertProps) {
  const sem = useStudioSemantic();
  const intent = severity === "danger" ? "danger" : severity === "warning" ? "waiting" : "production";
  const sv = sem[intent];
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: sv.soft,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sv.base }} />
      <Text style={{ fontSize: 11, color: sv.ink, fontWeight: "700" }}>{label}</Text>
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
  const t = useStudioTokens();
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={{
        flex: 1, minWidth: 150,
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: t.paperCard,
        borderRadius: StudioRadiusV2.lg, padding: 14,
        borderWidth: 1, borderColor: t.ink5,
      }}
    >
      <BubbleIcon ico={ico} tone={tone} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }} numberOfLines={1}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }}>
            {value}
          </Text>
          {trend && (
            <Text style={{
              fontSize: 10.5, fontWeight: "800",
              color: trend.dir === "up" ? t.success : t.danger,
              backgroundColor: trend.dir === "up" ? t.successSoft : t.dangerSoft,
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
