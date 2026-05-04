// components/screens/financeiro/v2/HealthScoreHero.tsx
//
// Hero principal da Visao Geral. Donut com health score + 4 drivers.
// Em web usa conic-gradient (visual fiel ao prototipo); em nativo cai num
// fallback de barra horizontal pra nao depender de react-native-svg.

import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { FinancialInsights } from "./types";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var isWeb = Platform.OS === "web";

type Props = { insights: FinancialInsights };

function donutColor(score: number): string {
  if (score >= 75) return Colors.green;
  if (score >= 50) return Colors.amber;
  return Colors.red;
}

function statusColor(status: "ok" | "warn" | "bad"): string {
  if (status === "ok") return Colors.green;
  if (status === "warn") return Colors.amber;
  return Colors.red;
}

function Donut({ score }: { score: number }) {
  var size = NARROW ? 132 : 168;
  var inner = size - 28;
  var color = donutColor(score);
  var trackColor = Colors.violetD;

  if (isWeb) {
    var deg = Math.max(0, Math.min(360, (score / 100) * 360));
    return (
      <View
        style={[
          h.donutOuter,
          { width: size, height: size },
          {
            // @ts-ignore — backgroundImage so existe em web
            backgroundImage: "conic-gradient(from -90deg, " + color + " 0deg, " + color + " " + deg + "deg, " + trackColor + " " + deg + "deg)",
            transition: "background-image 0.6s ease",
          } as any,
        ]}
      >
        <View style={[h.donutInner, { width: inner, height: inner, backgroundColor: Colors.bg3 }]}>
          <Text style={[h.scoreNum, { color: Colors.ink }]}>{score}</Text>
          <Text style={h.scoreUnit}>de 100</Text>
        </View>
      </View>
    );
  }

  // Mobile fallback: barra horizontal grande + numero
  return (
    <View style={h.fallback}>
      <Text style={[h.scoreNum, { color: Colors.ink, fontSize: 56 }]}>{score}</Text>
      <Text style={h.scoreUnit}>de 100</Text>
      <View style={[h.fallbackTrack, { backgroundColor: Colors.bg4 }]}>
        <View style={[h.fallbackFill, { width: score + "%", backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatusBadge({ label }: { label: string }) {
  var bg = label === "Saudavel" ? Colors.greenD : label === "Atencao" ? Colors.amberD : label === "Critico" ? Colors.redD : Colors.violetD;
  var fg = label === "Saudavel" ? Colors.green : label === "Atencao" ? Colors.amber : label === "Critico" ? Colors.red : Colors.violet3;
  return (
    <View style={[h.badge, { backgroundColor: bg }]}>
      <View style={[h.badgeDot, { backgroundColor: fg }]} />
      <Text style={[h.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function DriverCard({ driver }: { driver: FinancialInsights["health"]["drivers"][number] }) {
  var color = statusColor(driver.status);
  return (
    <View style={[h.driver, { borderColor: Colors.border }]}>
      <View style={h.driverHeader}>
        <Text style={h.driverLabel}>{driver.label}</Text>
        <View style={[h.driverDot, { backgroundColor: color }]} />
      </View>
      <View style={h.driverValueRow}>
        <Text style={[h.driverCurrent, { color: Colors.ink }]} numberOfLines={1}>{driver.current}</Text>
        <Text style={h.driverTarget} numberOfLines={1}>{driver.target}</Text>
      </View>
      <View style={[h.driverTrack, { backgroundColor: Colors.bg4 }]}>
        <View
          style={[
            h.driverFill,
            { width: (driver.contribution * 100) + "%", backgroundColor: color },
            isWeb ? ({ transition: "width 0.6s ease" } as any) : null,
          ]}
        />
      </View>
      <Text style={[h.driverGap, { color: color }]} numberOfLines={1}>{driver.gap}</Text>
    </View>
  );
}

export function HealthScoreHero({ insights }: Props) {
  var health = insights.health;
  return (
    <View style={[h.card, { backgroundColor: Colors.bg3, borderColor: Colors.border2 }]}>
      <View style={NARROW ? h.bodyNarrow : h.body}>
        {/* Lado esquerdo: donut + badge */}
        <View style={NARROW ? h.donutBlockNarrow : h.donutBlock}>
          <Donut score={health.score} />
          <View style={{ marginTop: 12, alignItems: "center" }}>
            <StatusBadge label={health.label} />
          </View>
        </View>

        {/* Lado direito: titulo + frase + drivers */}
        <View style={NARROW ? h.rightNarrow : h.right}>
          <Text style={h.kicker}>SAUDE FINANCEIRA · {insights.runway.days >= 999 ? "—" : insights.runway.days + " DIAS DE CAIXA"}</Text>
          <Text style={[h.headline, { color: Colors.ink }]}>{health.narrative.headline}</Text>
          <Text style={[h.subline, { color: Colors.ink2 }]}>{health.narrative.subline}</Text>

          <View style={NARROW ? h.driversGridNarrow : h.driversGrid}>
            {health.drivers.map(function(d) {
              return <DriverCard key={d.id} driver={d} />;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

var h = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: NARROW ? 18 : 24,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  bodyNarrow: {
    flexDirection: "column",
    gap: 16,
  },
  donutBlock: { width: 200, alignItems: "center" },
  donutBlockNarrow: { width: "100%", alignItems: "center" },
  donutOuter: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  donutInner: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: { width: "100%", alignItems: "center", paddingVertical: 8 },
  fallbackTrack: { width: "80%", height: 8, borderRadius: 4, marginTop: 14, overflow: "hidden" },
  fallbackFill: { height: 8, borderRadius: 4 },
  scoreNum: {
    fontSize: NARROW ? 40 : 48,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: NARROW ? 42 : 50,
  },
  scoreUnit: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.6, marginTop: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  right: { flex: 1, gap: 14 },
  rightNarrow: { width: "100%", gap: 12 },
  kicker: {
    fontSize: 9.5,
    color: Colors.ink3,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  headline: {
    fontSize: NARROW ? 18 : 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: NARROW ? 24 : 28,
  },
  subline: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  driversGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  driversGridNarrow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  driver: {
    flex: 1,
    minWidth: NARROW ? "47%" : 0,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.bg,
  },
  driverHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  driverLabel: { fontSize: 9, color: Colors.ink3, letterSpacing: 0.6, fontWeight: "600", textTransform: "uppercase", flex: 1 },
  driverDot: { width: 6, height: 6, borderRadius: 3 },
  driverValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 6 },
  driverCurrent: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  driverTarget: { fontSize: 10, color: Colors.ink3 },
  driverTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  driverFill: { height: 4, borderRadius: 2 },
  driverGap: { fontSize: 10.5, marginTop: 6, fontWeight: "500" },
});

export default HealthScoreHero;
