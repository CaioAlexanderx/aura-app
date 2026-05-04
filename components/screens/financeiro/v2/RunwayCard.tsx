// components/screens/financeiro/v2/RunwayCard.tsx
//
// Card de runway: dias ate esgotar caixa no ritmo atual.
// Barra 0-90d com markers em 30/60/90. Cor varia com criticidade.

import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt } from "../types";
import type { FinancialInsights } from "./types";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var isWeb = Platform.OS === "web";

type Props = { insights: FinancialInsights };

function runwayColor(days: number): string {
  if (days >= 999) return Colors.violet3; // sem dados
  if (days >= 60) return Colors.green;
  if (days >= 30) return Colors.amber;
  return Colors.red;
}

export function RunwayCard({ insights }: Props) {
  var r = insights.runway;
  var color = runwayColor(r.days);
  var maxScale = 90;
  var widthPct = r.days >= 999 ? 0 : Math.min(100, (r.days / maxScale) * 100);

  var subline =
    r.days >= 999 ? "sem dados suficientes pra projetar" :
    r.days < 30 ? "criticamente curto — priorize cobrar atrasados" :
    r.days < 60 ? "dentro da zona de atencao — vale estender" :
    "dentro da zona saudavel";

  return (
    <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
      <View style={s.headerRow}>
        <Text style={s.kicker}>RUNWAY DE CAIXA</Text>
      </View>

      <View style={s.numberRow}>
        <Text style={[s.bigNumber, { color: color }]}>
          {r.days >= 999 ? "—" : r.days}
        </Text>
        <Text style={[s.unit, { color: Colors.ink2 }]}>dias</Text>
      </View>
      <Text style={[s.helperItalic, { color: Colors.ink3 }]}>ate esgotar o caixa no ritmo atual</Text>

      <View style={s.barWrap}>
        <View style={[s.barTrack, { backgroundColor: Colors.bg4 }]}>
          <View
            style={[
              s.barFill,
              { width: widthPct + "%", backgroundColor: color },
              isWeb ? ({ transition: "width 1s ease" } as any) : null,
            ]}
          />
          {/* Markers em 30, 60, 90 */}
          {[30, 60, 90].map(function(m) {
            return (
              <View
                key={m}
                style={[
                  s.marker,
                  { left: ((m / maxScale) * 100) + "%", backgroundColor: Colors.border2 },
                ]}
              />
            );
          })}
        </View>
        <View style={s.barLabels}>
          <Text style={s.tick}>0</Text>
          <Text style={s.tick}>30d</Text>
          <Text style={s.tick}>60d</Text>
          <Text style={s.tick}>90d</Text>
        </View>
      </View>

      <Text style={[s.statusLine, { color: color }]}>{subline}</Text>

      <View style={[s.footer, { borderTopColor: Colors.border }]}>
        <View style={s.footerCol}>
          <Text style={s.footerLabel}>Caixa atual (estim.)</Text>
          <Text style={[s.footerVal, { color: Colors.ink }]} numberOfLines={1}>
            {r.cash_balance > 0 ? fmt(r.cash_balance) : "—"}
          </Text>
        </View>
        <View style={[s.footerCol, { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 14 }]}>
          <Text style={s.footerLabel}>Gasto por dia</Text>
          <Text style={[s.footerVal, { color: Colors.ink }]} numberOfLines={1}>
            {r.daily_burn > 0 ? fmt(r.daily_burn) : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  headerRow: { marginBottom: 8 },
  kicker: {
    fontSize: 9.5,
    color: Colors.ink3,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  numberRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  bigNumber: {
    fontSize: NARROW ? 44 : 56,
    fontWeight: "800",
    letterSpacing: -1.2,
    lineHeight: NARROW ? 46 : 58,
  },
  unit: { fontSize: 14, fontWeight: "700" },
  helperItalic: { fontSize: 11, fontStyle: "italic", marginTop: 2, marginBottom: 14 },
  barWrap: { marginBottom: 8 },
  barTrack: { height: 8, borderRadius: 4, overflow: "hidden", position: "relative" },
  barFill: { height: 8, borderRadius: 4 },
  marker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 1,
  },
  barLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  tick: { fontSize: 9.5, color: Colors.ink3 },
  statusLine: { fontSize: 11.5, fontWeight: "600", marginTop: 4, marginBottom: 12 },
  footer: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12, gap: 14 },
  footerCol: { flex: 1 },
  footerLabel: { fontSize: 9.5, color: Colors.ink3, letterSpacing: 0.6, marginBottom: 3, textTransform: "uppercase", fontWeight: "600" },
  footerVal: { fontSize: 14, fontWeight: "700" },
});

export default RunwayCard;
