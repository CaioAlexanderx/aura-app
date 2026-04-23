// ============================================================
// AURA. — Navegador da agenda odonto
// Toggle Dia|Semana|Mes + Prev/Today/Next + display do periodo.
// Controlado: recebe view+date e callbacks; nao guarda estado interno.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export type AgendaView = "day" | "week" | "month";

interface Props {
  view: AgendaView;
  date: Date;
  onViewChange: (v: AgendaView) => void;
  onDateChange: (d: Date) => void;
}

const MONTHS_PT = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function startOfWeek(d: Date): Date {
  // Semana comeca na segunda (padrao brasileiro)
  const dow = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diff = dow === 0 ? -6 : 1 - dow;
  const r = new Date(d); r.setDate(d.getDate() + diff); r.setHours(0,0,0,0);
  return r;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return e;
}

function formatDay(d: Date): string {
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}
function formatWeekRange(d: Date): string {
  const s = startOfWeek(d), e = endOfWeek(d);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} a ${e.getDate()} de ${MONTHS_PT[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_PT[s.getMonth()]} — ${e.getDate()} ${MONTHS_PT[e.getMonth()]}`;
}
function formatMonth(d: Date): string {
  const m = MONTHS_PT[d.getMonth()];
  return `${m.charAt(0).toUpperCase() + m.slice(1)} de ${d.getFullYear()}`;
}

export function AgendaNavigator({ view, date, onViewChange, onDateChange }: Props) {
  function shift(direction: -1 | 1) {
    const d = new Date(date);
    if (view === "day")   d.setDate(d.getDate() + direction);
    if (view === "week")  d.setDate(d.getDate() + direction * 7);
    if (view === "month") d.setMonth(d.getMonth() + direction);
    onDateChange(d);
  }

  function today() {
    const t = new Date(); t.setHours(0,0,0,0);
    onDateChange(t);
  }

  const periodLabel =
    view === "day"   ? formatDay(date) :
    view === "week"  ? formatWeekRange(date) :
                       formatMonth(date);

  return (
    <View style={s.container}>
      {/* View toggle */}
      <View style={s.toggleGroup}>
        {(["day","week","month"] as AgendaView[]).map(v => (
          <Pressable key={v} onPress={() => onViewChange(v)} style={[s.toggleBtn, view === v && s.toggleBtnActive]}>
            <Text style={[s.toggleText, view === v && s.toggleTextActive]}>
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "M\u00eas"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Navegacao */}
      <View style={s.navRow}>
        <Pressable onPress={() => shift(-1)} style={s.navBtn} hitSlop={8}>
          <Icon name="arrow_left" size={14} color={Colors.ink} />
        </Pressable>
        <Pressable onPress={today} style={s.todayBtn}>
          <Text style={s.todayText}>Hoje</Text>
        </Pressable>
        <Pressable onPress={() => shift(1)} style={s.navBtn} hitSlop={8}>
          <Icon name="arrow_right" size={14} color={Colors.ink} />
        </Pressable>
        <Text style={s.periodLabel}>{periodLabel}</Text>
      </View>
    </View>
  );
}

// Helpers exportados para uso dos consumidores (determinar range da query).
export function agendaRangeFor(view: AgendaView, date: Date): { start: Date; end: Date } {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end = new Date(start);

  if (view === "day") {
    end.setDate(start.getDate() + 1);
  } else if (view === "week") {
    const s = startOfWeek(date);
    const e = new Date(s); e.setDate(s.getDate() + 7);
    return { start: s, end: e };
  } else {
    // month: dia 1 ate dia 1 do mes seguinte
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1);
  }
  return { start, end };
}

export { startOfWeek, endOfWeek };

const s = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  toggleGroup: { flexDirection: "row", gap: 2, backgroundColor: Colors.bg3, borderRadius: 8, padding: 3, borderWidth: 1, borderColor: Colors.border },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: Colors.violet || "#6d28d9" },
  toggleText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 200 },
  navBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  todayBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  todayText: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  periodLabel: { fontSize: 12, color: Colors.ink, fontWeight: "600", marginLeft: 6, textTransform: "capitalize" as any },
});

export default AgendaNavigator;
