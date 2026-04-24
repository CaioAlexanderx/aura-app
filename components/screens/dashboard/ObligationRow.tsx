import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt } from "./types";

// Maps "20/04/2026" or "2026-04-20" to { day: "20", mon: "ABR" }
function parseDate(due: string): { day: string; mon: string } {
  if (!due) return { day: "--", mon: "---" };
  const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  // dd/mm/yyyy
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(due);
  if (m) return { day: m[1], mon: MESES[parseInt(m[2], 10) - 1] || "---" };
  // yyyy-mm-dd
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (m) return { day: m[3], mon: MESES[parseInt(m[2], 10) - 1] || "---" };
  return { day: due.slice(0, 2), mon: "---" };
}

function statusStyle(status: string) {
  switch ((status || "").toLowerCase()) {
    case "pending":
    case "warn":
    case "vencendo":
      return { bg: "rgba(251,191,36,0.14)", fg: "#fbbf24", border: "rgba(251,191,36,0.28)", label: "Vencendo" };
    case "ok":
    case "agendado":
    case "paid":
      return { bg: "rgba(52,211,153,0.14)", fg: "#34d399", border: "rgba(52,211,153,0.28)", label: "Agendado" };
    default:
      return { bg: "rgba(167,139,250,0.16)", fg: "#a78bfa", border: "rgba(167,139,250,0.28)", label: "Aberto" };
  }
}

export function ObligationRow({ name, due, amount, status, category }: {
  name: string; due: string; amount: number | null; status: string; category: string;
}) {
  const { day, mon } = parseDate(due);
  const st = statusStyle(status);
  const cl = category === "aura_resolve" ? "Aura resolve" : "Aura facilita";

  return (
    <View style={s.row}>
      <View style={s.dateBox}>
        <Text style={s.day}>{day}</Text>
        <Text style={s.mon}>{mon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <Text style={s.sub}>{amount != null ? fmt(amount) : "Sem valor fixo"}  -  {cl}</Text>
      </View>
      <View style={[s.chip, { backgroundColor: st.bg, borderColor: st.border }]}>
        <Text style={[s.chipText, { color: st.fg }]}>{st.label}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  dateBox: {
    width: 46, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", flexShrink: 0,
  },
  day: { fontSize: 15, fontWeight: "700", color: Colors.ink, lineHeight: 16, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  mon: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  sub: { fontSize: 11, color: Colors.ink3, letterSpacing: 0.3, marginTop: 2, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  chipText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
});
