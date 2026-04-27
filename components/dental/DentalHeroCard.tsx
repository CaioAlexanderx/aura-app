// ============================================================
// DentalHeroCard — hero card do dash dental rico (PR16).
//
// Mostra metrica destaque (ex: faturamento do mes ou consultas
// hoje) com count-up + sparkline glow + 3 meta items + delta chip.
//
// Inspirado no HeroCard do shell negocio, mas com gradiente
// cyan->violet (cyan dominante mantendo identidade petala).
// ============================================================

import { useEffect, useState } from "react";
import { View, Text, Platform } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { DentalSparkline } from "./DentalSparkline";

interface MetaItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface Props {
  eyebrow: string;
  value: number;
  format?: "brl" | "int";
  delta?: number;
  deltaLabel?: string;
  spark?: number[];
  meta?: MetaItem[];
}

function fmtBrl(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (Platform.OS !== "web") { setVal(target); return; }
    const start = performance.now();
    const from = 0;
    let raf: any;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(from + (target - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

export function DentalHeroCard({ eyebrow, value, format = "brl", delta, deltaLabel, spark, meta }: Props) {
  const animated = useCountUp(value);
  const display = format === "brl" ? fmtBrl(animated) : Math.round(animated).toLocaleString("pt-BR");

  const deltaPositive = (delta || 0) >= 0;
  const deltaColor = deltaPositive ? DentalColors.green : DentalColors.red;

  return (
    <View style={{
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(6,182,212,0.20)",
      marginBottom: 18,
      ...(Platform.OS === "web" ? {
        background:
          "linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(14,165,233,0.10) 35%, rgba(124,58,237,0.10) 100%)",
        backgroundSize: "200% 200%",
        animation: "dentalHeroShift 14s ease-in-out infinite",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      } as any : { backgroundColor: DentalColors.cyanGhost }),
    }}>
      <View style={{ padding: 24, position: "relative" }}>
        <Text style={{
          fontSize: 10, color: DentalColors.cyan, fontWeight: "700",
          letterSpacing: 2, textTransform: "uppercase",
        }}>
          {eyebrow}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 8 }}>
          <Text
            style={{
              fontSize: 44, color: DentalColors.ink, fontWeight: "800", letterSpacing: -1.4,
              ...(Platform.OS === "web" ? {
                textShadow: "0 0 32px rgba(6,182,212,0.35)",
                fontVariantNumeric: "tabular-nums",
              } as any : {}),
            }}>
            {display}
          </Text>
          {delta !== undefined ? (
            <View style={{
              backgroundColor: deltaPositive ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
              borderWidth: 1, borderColor: deltaPositive ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              flexDirection: "row", alignItems: "center", gap: 4,
              marginBottom: 10,
            }}>
              <Text style={{ color: deltaColor, fontSize: 11, fontWeight: "700" }}>
                {deltaPositive ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
              </Text>
              {deltaLabel ? (
                <Text style={{ color: DentalColors.ink3, fontSize: 9, marginLeft: 4 }}>{deltaLabel}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {spark && spark.length > 1 ? (
          <View style={{ marginTop: 10, marginBottom: 4 }}>
            <DentalSparkline values={spark} width={420} height={56} variant="hero" glow color={DentalColors.cyan} />
          </View>
        ) : null}

        {meta && meta.length > 0 ? (
          <View style={{ flexDirection: "row", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
            {meta.map((m, i) => (
              <View key={i}>
                <Text style={{
                  fontSize: 9, color: DentalColors.ink3, fontWeight: "700",
                  letterSpacing: 1.2, textTransform: "uppercase",
                }}>
                  {m.label}
                </Text>
                <Text style={{
                  fontSize: 16, color: m.highlight ? DentalColors.cyan : DentalColors.ink,
                  fontWeight: "700", marginTop: 2,
                  ...(Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } as any : {}),
                }}>
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
