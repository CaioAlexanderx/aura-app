// ============================================================
// AURA STUDIO · PDV — componentes atômicos (Fase 6)
// Theme-aware via useStudioTokens. Espelham o mockup aprovado.
// ============================================================
import { View, Text, Pressable, TextInput, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { Ic } from "./icons";

const money = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tone = "primary" | "success" | "warn" | "accent";
function toneColors(t: StudioPalette, tone?: Tone) {
  switch (tone) {
    case "success": return { fg: t.success, bg: t.successSoft };
    case "warn": return { fg: t.warning, bg: t.warningSoft };
    case "accent": return { fg: t.accentInk, bg: t.accentSoft };
    default: return { fg: t.primary, bg: t.primarySoft };
  }
}

// ─── KPI card ───────────────────────────────────────────────
export function KpiCard({
  t, icon, label, value, tone,
}: { t: StudioPalette; icon: string; label: string; value: string; tone?: Tone }) {
  const c = toneColors(t, tone);
  return (
    <View
      style={{
        backgroundColor: t.paperCard, borderRadius: 14, padding: 13,
        borderWidth: 1, borderColor: t.ink5, minWidth: 150,
        flexDirection: "row", alignItems: "center", gap: 11, flex: 1,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
        <Ic name={icon} size={20} color={c.fg} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
        <Text style={{ fontSize: 20, color: t.ink, fontWeight: "800", lineHeight: 24 }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Category chip ──────────────────────────────────────────
export function CategoryChip({
  t, label, count, active, onPress,
}: { t: StudioPalette; label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexDirection: "row", alignItems: "center", gap: 7,
          paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
          backgroundColor: active ? t.accentSoft : t.paperCard,
          borderWidth: 1, borderColor: active ? t.accentInk : t.ink5,
        },
        Platform.OS === "web" ? ({ cursor: "pointer", transition: "all .15s ease" } as any) : {},
      ]}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: active ? t.accentInk : t.ink2 }}>{label}</Text>
      {count != null && (
        <View style={{ minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9, backgroundColor: active ? t.accentInk : t.bgSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: active ? "#fff" : t.ink3 }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Personalizável badge ───────────────────────────────────
export function PersonalizableBadge({ t }: { t: StudioPalette }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accentInk,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      }}
    >
      <Ic name="sparkle" size={12} color={t.accentInk} />
      <Text style={{ fontSize: 9, color: t.accentInk, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>
        Personalizável
      </Text>
    </View>
  );
}

// ─── Themed input ───────────────────────────────────────────
export function FInput({
  t, value, onChangeText, placeholder, keyboardType, multiline, maxLength, autoFocus,
}: {
  t: StudioPalette; value: string; onChangeText: (s: string) => void; placeholder?: string;
  keyboardType?: any; multiline?: boolean; maxLength?: number; autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.ink3}
      keyboardType={keyboardType}
      multiline={multiline}
      maxLength={maxLength}
      autoFocus={autoFocus}
      style={{
        backgroundColor: t.paperCardElev, color: t.ink, padding: 12,
        borderRadius: 10, fontSize: 14, borderWidth: 1, borderColor: t.ink5,
        minHeight: multiline ? 60 : undefined,
      }}
    />
  );
}

// ─── Sum / total row ────────────────────────────────────────
export function SumRow({
  t, label, value, big,
}: { t: StudioPalette; label: string; value: string | number; big?: boolean }) {
  const v = typeof value === "number" ? "R$ " + money(value) : value;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontSize: big ? 14 : 12, color: big ? t.ink : t.ink3, fontWeight: big ? "800" : "500" }}>{label}</Text>
      <Text style={{ fontSize: big ? 19 : 12.5, color: big ? t.primary : t.ink, fontWeight: big ? "800" : "600" }}>{v}</Text>
    </View>
  );
}

// ─── Station pill (hero) ────────────────────────────────────
export function StationPill({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
        borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 10,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" }} />
      <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export { money };
