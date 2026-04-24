import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Sparkline } from "./Sparkline";
import { IS_WIDE, fmt, webOnly, GRAD } from "./types";

type Props = {
  net: number;
  sparkNet?: number[];
  revenue?: number;
  expenses?: number;
  projection?: number;
  netDelta?: number;
};

// Count-up animation for the hero value — rAF on web, instant on native.
function useCountUp(target: number, dur = 1400) {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web") { setVal(target); return; }
    startRef.current = null;
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const p = Math.min(1, (now - (startRef.current || now)) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target * 100) / 100);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

export function HeroCard({ net, sparkNet, revenue, expenses, projection, netDelta }: Props) {
  const isPositive = net >= 0;
  const animated = useCountUp(Math.abs(net || 0));
  const abs = Math.abs(animated);

  const intPart = Math.floor(abs).toLocaleString("pt-BR");
  const cents = (abs % 1).toFixed(2).slice(2).padEnd(2, "0");

  const deltaColor = isPositive ? Colors.green : Colors.red;

  const webCard = webOnly({
    background: "linear-gradient(135deg, rgba(124,58,237,0.20), rgba(79,91,213,0.06))",
    backdropFilter: "blur(18px) saturate(150%)",
    WebkitBackdropFilter: "blur(18px) saturate(150%)",
    boxShadow: "0 20px 50px -20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
    position: "relative",
  });
  const webLabel = webOnly({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  return (
    <View style={[s.hero, Platform.OS === "web" ? (webCard as any) : { backgroundColor: Colors.bg3 }]}>
      {Platform.OS === "web" && (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute", top: "-60%", right: "-30%", width: "80%", height: "220%",
              background: `radial-gradient(ellipse, ${GRAD.violet3}44, transparent 60%)`,
              pointerEvents: "none", animation: "auraHeroShift 12s ease-in-out infinite",
            } as any}
          />
          <span
            aria-hidden
            style={{
              position: "absolute", inset: 0 as any,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "linear-gradient(135deg, #000, transparent 70%)",
              WebkitMaskImage: "linear-gradient(135deg, #000, transparent 70%)",
              pointerEvents: "none",
            } as any}
          />
        </>
      )}

      <View style={s.grid}>
        <View style={{ flex: 1.2, minWidth: 0 }}>
          <View style={[s.labelRow, Platform.OS === "web" ? (webLabel as any) : null]}>
            <View style={s.labelBar} />
            <Text style={s.label}>Saldo liquido - este mes</Text>
          </View>

          <View style={s.valueRow}>
            <Text style={[s.cur, { color: isPositive ? "#fff" : deltaColor }]}>R$ </Text>
            <Text style={[s.valueBig, { color: isPositive ? "#fff" : deltaColor }]}>{isPositive ? "" : "-"}{intPart}</Text>
            <Text style={[s.cents, { color: isPositive ? "#fff" : deltaColor }]}>,{cents}</Text>
          </View>

          {typeof netDelta === "number" && Math.abs(netDelta) > 0.0001 && (
            <View style={[s.deltaChip, { backgroundColor: netDelta >= 0 ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)", borderColor: netDelta >= 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)" }]}>
              <Text style={{ color: netDelta >= 0 ? Colors.green : Colors.red, fontSize: 11, fontWeight: "700" }}>
                {netDelta >= 0 ? "+" : ""}{netDelta.toFixed(1)}% vs. mes anterior
              </Text>
            </View>
          )}

          <View style={s.metaRow}>
            {typeof revenue === "number" && (
              <View style={s.metaItem}>
                <Text style={s.metaK}>Receita</Text>
                <Text style={s.metaV}>{fmt(revenue)}</Text>
              </View>
            )}
            {typeof expenses === "number" && (
              <View style={s.metaItem}>
                <Text style={s.metaK}>Despesas</Text>
                <Text style={s.metaV}>{fmt(expenses)}</Text>
              </View>
            )}
            {typeof projection === "number" && projection > 0 && (
              <View style={s.metaItem}>
                <Text style={s.metaK}>Projecao fim do mes</Text>
                <Text style={[s.metaV, { color: Colors.violet3 }]}>{fmt(projection)}</Text>
              </View>
            )}
          </View>
        </View>

        {sparkNet && sparkNet.length >= 2 && (
          <View style={s.sparkWrap}>
            <Sparkline
              data={sparkNet}
              width={IS_WIDE ? 380 : 260}
              height={IS_WIDE ? 130 : 70}
              rainbow
              glow
              strokeWidth={2.5}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    borderRadius: 22, padding: IS_WIDE ? 28 : 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 24,
  },
  grid: { flexDirection: IS_WIDE ? "row" : "column", gap: 24, alignItems: IS_WIDE ? "center" : "stretch", position: "relative", zIndex: 2 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  labelBar: { width: 20, height: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  label: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: 1.6, textTransform: "uppercase" },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 12, marginBottom: 14 },
  cur: { fontSize: IS_WIDE ? 22 : 16, opacity: 0.55, fontWeight: "500" },
  valueBig: { fontSize: IS_WIDE ? 52 : 38, fontWeight: "700", letterSpacing: -1.2, lineHeight: IS_WIDE ? 54 : 40 },
  cents: { fontSize: IS_WIDE ? 24 : 18, opacity: 0.6, fontWeight: "500" },
  deltaChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginBottom: 16 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 4 },
  metaItem: { gap: 3 },
  metaK: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: 1.2, textTransform: "uppercase" },
  metaV: { fontSize: 13, color: "#fff", fontWeight: "600" },
  sparkWrap: { flex: 1, alignItems: IS_WIDE ? "flex-end" : "flex-start", justifyContent: "center" },
});
