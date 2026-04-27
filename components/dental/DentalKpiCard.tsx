// ============================================================
// DentalKpiCard — KPI card rico do dash dental (PR16).
//
// Substitui o KpiCard interno do OdontoDashboard.tsx. Mantem
// a mesma assinatura basica (value/label/color/icon/sublabel)
// pra nao quebrar o callsite — extras (delta, spark) sao
// opcionais.
//
// Pattern do shell negocio: accent stripe + glass + icon chip
// color-mix + sparkline opcional + delta chip.
// ============================================================

import { View, Text, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";
import { DentalSparkline } from "./DentalSparkline";

interface Props {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  sublabel?: string;
  delta?: number;
  spark?: number[];
}

export function DentalKpiCard({ value, label, color, icon, sublabel, delta, spark }: Props) {
  const accentColor = color || DentalColors.cyan;
  const deltaPositive = (delta || 0) >= 0;
  const deltaColor = deltaPositive ? DentalColors.green : DentalColors.red;

  return (
    <View style={{
      flex: 1, minWidth: 160,
      backgroundColor: DentalColors.bg2,
      borderWidth: 1, borderColor: DentalColors.border,
      borderRadius: 14,
      padding: 14,
      overflow: "hidden",
      position: "relative",
      ...(Platform.OS === "web" ? {
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any : {}),
    }}>
      {/* Accent stripe topo */}
      <View
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          ...(Platform.OS === "web" ? {
            background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
          } as any : { backgroundColor: accentColor }),
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon ? (
          <View style={{
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: accentColor + "20",
            alignItems: "center", justifyContent: "center",
          }}>
            <Icon name={icon as any} size={14} color={accentColor} />
          </View>
        ) : null}
        <Text style={{
          flex: 1, fontSize: 9, color: DentalColors.ink3, fontWeight: "700",
          letterSpacing: 1.4, textTransform: "uppercase",
        }} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{
          fontSize: 22, fontWeight: "800", color: DentalColors.ink,
          letterSpacing: -0.5,
          ...(Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } as any : {}),
        }} numberOfLines={1}>
          {value}
        </Text>
        {delta !== undefined ? (
          <Text style={{ fontSize: 10, fontWeight: "700", color: deltaColor }}>
            {deltaPositive ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
          </Text>
        ) : null}
      </View>

      {sublabel ? (
        <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 2 }} numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}

      {spark && spark.length > 1 ? (
        <View style={{ marginTop: 8 }}>
          <DentalSparkline values={spark} width={140} height={20} color={accentColor} />
        </View>
      ) : null}
    </View>
  );
}
