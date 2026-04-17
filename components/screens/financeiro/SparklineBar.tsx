import { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "./types";
import { fmt } from "./types";

var isWeb = Platform.OS === "web";
var BAR_W = 680;
var BAR_H = 64;
var DAYS = 7;

type Props = { transactions: Transaction[] };

function last7Days(): string[] {
  var result: string[] = [];
  for (var i = DAYS - 1; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function toKey(t: Transaction): string {
  var raw = (t as any).due_date || (t as any).created_at || "";
  if (!raw || raw.length < 10) return "";
  try {
    var isDue = raw.length === 10;
    var d = new Date(raw);
    if (isDue) return raw;
    var sp = new Date(d.getTime() - 3 * 3600000);
    return sp.toISOString().slice(0, 10);
  } catch { return ""; }
}

export function SparklineBar({ transactions }: Props) {
  var days = last7Days();

  var data = useMemo(function() {
    var map: Record<string, { income: number; expense: number }> = {};
    days.forEach(function(d) { map[d] = { income: 0, expense: 0 }; });
    transactions.forEach(function(t) {
      var k = toKey(t);
      if (map[k]) {
        if (t.type === "income") map[k].income += t.amount;
        else map[k].expense += t.amount;
      }
    });
    return days.map(function(d) { return { day: d, income: map[d].income, expense: map[d].expense }; });
  }, [transactions]);

  var maxVal = Math.max(1, ...data.map(function(d) { return Math.max(d.income, d.expense); }));
  var gap = 8;
  var groupW = (BAR_W - 80 - gap * (DAYS - 1)) / DAYS;
  var barW = (groupW - 4) / 2;

  if (data.every(function(d) { return d.income === 0 && d.expense === 0; })) return null;

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>Ultimos 7 dias</Text>
        <View style={s.legend}>
          <View style={[s.legendDot, { backgroundColor: Colors.green }]} /><Text style={s.legendText}>Entradas</Text>
          <View style={[s.legendDot, { backgroundColor: Colors.red }]} /><Text style={s.legendText}>Saidas</Text>
        </View>
      </View>
      {isWeb ? (
        <View style={s.chartWrap}>
          <svg width="100%" viewBox={"0 0 " + BAR_W + " " + (BAR_H + 18)} style={{ display: "block" } as any}>
            {data.map(function(d, i) {
              var x = 40 + i * (groupW + gap);
              var hInc = (d.income / maxVal) * BAR_H;
              var hExp = (d.expense / maxVal) * BAR_H;
              var label = d.day.slice(8, 10) + "/" + d.day.slice(5, 7);
              return (
                <g key={d.day}>
                  <rect x={x} y={BAR_H - hInc} width={barW} height={Math.max(hInc, 1)} rx={3} fill={Colors.green} opacity={0.8} />
                  <rect x={x + barW + 4} y={BAR_H - hExp} width={barW} height={Math.max(hExp, 1)} rx={3} fill={Colors.red} opacity={0.7} />
                  <text x={x + groupW / 2} y={BAR_H + 14} textAnchor="middle" fill={Colors.ink3} fontSize={10} fontFamily="inherit">{label}</text>
                </g>
              );
            })}
          </svg>
        </View>
      ) : (
        <View style={s.fallback}>
          {data.map(function(d) {
            return (
              <View key={d.day} style={s.fallbackCol}>
                <Text style={s.fallbackVal}>{d.income > 0 ? "+" + Math.round(d.income / 100) : ""}</Text>
                <Text style={[s.fallbackDate]}>{d.day.slice(8, 10)}/{d.day.slice(5, 7)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.ink3 },
  chartWrap: { overflow: "hidden" },
  fallback: { flexDirection: "row", justifyContent: "space-around" },
  fallbackCol: { alignItems: "center", gap: 2 },
  fallbackVal: { fontSize: 10, color: Colors.green, fontWeight: "600" },
  fallbackDate: { fontSize: 9, color: Colors.ink3 },
});

export default SparklineBar;
