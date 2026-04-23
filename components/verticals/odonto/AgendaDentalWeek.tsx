// ============================================================
// AURA. — Visao SEMANAL da agenda odonto
// 7 colunas (seg-dom) x faixa horaria 07-18.
// Agendamentos viram blocos com cor por status. Dia atual destacado.
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { DentalAppointment } from "@/components/verticals/odonto/AgendaDental";
import { startOfWeek } from "@/components/verticals/odonto/AgendaNavigator";

interface Props {
  appointments: DentalAppointment[];
  anchorDate: Date;
  onAppointmentPress?: (a: DentalAppointment) => void;
  onSlotPress?: (date: Date) => void;
}

const DOW_LABELS = ["SEG","TER","QUA","QUI","SEX","SAB","DOM"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7..18

const STATUS_COLOR: Record<string, string> = {
  agendado: "#06B6D4", confirmado: "#10B981", em_atendimento: "#F59E0B",
  concluido: "#10B981", faltou: "#EF4444", cancelado: "#9CA3AF",
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AgendaDentalWeek({ appointments, anchorDate, onAppointmentPress, onSlotPress }: Props) {
  const today = new Date(); today.setHours(0,0,0,0);
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); d.setHours(0,0,0,0);
      return d;
    });
  }, [weekStart]);

  // Agrupa por dia+hora
  const grid = useMemo(() => {
    const map: Record<string, DentalAppointment[]> = {};
    for (const a of appointments) {
      if (a.status === "cancelado") continue;
      const dt = new Date(a.scheduled_at);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}-${dt.getHours()}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [appointments]);

  // Contador por dia (para header)
  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of appointments) {
      if (a.status === "cancelado") continue;
      const dt = new Date(a.scheduled_at);
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [appointments]);

  function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function cellKey(d: Date, h: number) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${h}`; }

  return (
    <View style={s.container}>
      {/* Header: dias da semana */}
      <View style={s.headerRow}>
        <View style={s.hourColHeader} />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          const count = countByDay[dayKey(d)] || 0;
          return (
            <View key={i} style={[s.dayHeader, isToday && s.dayHeaderToday]}>
              <Text style={[s.dowLabel, isToday && s.todayText]}>{DOW_LABELS[i]}</Text>
              <Text style={[s.dayNum, isToday && s.todayText]}>{d.getDate()}</Text>
              {count > 0 && <Text style={[s.dayCount, isToday && s.todayText]}>{count}</Text>}
            </View>
          );
        })}
      </View>

      {/* Grade scroll vertical */}
      <ScrollView style={s.scrollBody} showsVerticalScrollIndicator={false}>
        {HOURS.map(h => (
          <View key={h} style={s.row}>
            <View style={s.hourCol}>
              <Text style={s.hourLabel}>{String(h).padStart(2,"0")}:00</Text>
            </View>
            {days.map((d, di) => {
              const cell = grid[cellKey(d, h)];
              const isToday = sameDay(d, today);
              if (cell && cell.length > 0) {
                return (
                  <View key={di} style={[s.cell, isToday && s.cellToday]}>
                    {cell.slice(0, 2).map((a, ai) => {
                      const color = STATUS_COLOR[a.status] || "#06B6D4";
                      const dt = new Date(a.scheduled_at);
                      const time = `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => onAppointmentPress?.(a)}
                          style={[s.block, { borderLeftColor: color, backgroundColor: color + "22" }]}
                        >
                          <Text style={s.blockTime}>{time}</Text>
                          <Text style={s.blockName} numberOfLines={1}>{a.patient_name}</Text>
                        </Pressable>
                      );
                    })}
                    {cell.length > 2 && (
                      <Text style={s.moreText}>+{cell.length - 2}</Text>
                    )}
                  </View>
                );
              }
              // Slot vazio
              return (
                <Pressable
                  key={di}
                  onPress={() => {
                    const dt = new Date(d); dt.setHours(h, 0, 0, 0);
                    onSlotPress?.(dt);
                  }}
                  style={[s.cell, s.cellEmpty, isToday && s.cellToday]}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg2 || "#0f0f1e", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg3 },
  hourColHeader: { width: 48 },
  dayHeader: { flex: 1, paddingVertical: 8, alignItems: "center", borderLeftWidth: 1, borderLeftColor: Colors.border, gap: 1 },
  dayHeaderToday: { backgroundColor: "rgba(109,40,217,0.12)" },
  dowLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5 },
  dayNum: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  dayCount: { fontSize: 9, color: Colors.violet3, fontWeight: "600" },
  todayText: { color: Colors.violet3 || "#a78bfa" },
  scrollBody: { maxHeight: 520 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.border, minHeight: 44 },
  hourCol: { width: 48, paddingTop: 4, alignItems: "center" },
  hourLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600" },
  cell: { flex: 1, borderLeftWidth: 1, borderLeftColor: Colors.border, padding: 2, gap: 2 },
  cellEmpty: { backgroundColor: "transparent" },
  cellToday: { backgroundColor: "rgba(109,40,217,0.04)" },
  block: { borderRadius: 4, padding: 3, borderLeftWidth: 2, gap: 1 },
  blockTime: { fontSize: 8, color: Colors.ink3, fontWeight: "600" },
  blockName: { fontSize: 10, color: Colors.ink, fontWeight: "600" },
  moreText: { fontSize: 9, color: Colors.ink3, textAlign: "center", fontWeight: "600" },
});

export default AgendaDentalWeek;
